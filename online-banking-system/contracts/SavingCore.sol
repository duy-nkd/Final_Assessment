// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface must be declared at file level, not inside contract
interface IVaultManager {
    function payInterest(address to, uint256 amount) external;
    function getFeeReceiver() external view returns (address);
    function paused() external view returns (bool);
    function recordPenalty(uint256 amount) external;
}

contract SavingCore is ERC721, Ownable {
    IERC20 public immutable depositToken; // Token used for deposits (MockUSDC)
    IVaultManager public vaultManager;
    
    // Define 4 states of a deposit
    enum DepositStatus { Active, Withdrawn, ManualRenewed, AutoRenewed }

    // Structure of a saving plan
    struct SavingPlan {
        uint256 tenorDays;
        uint256 aprBps;
        uint256 minDeposit;
        uint256 maxDeposit; // If 0, it means unlimited
        uint256 earlyWithdrawPenaltyBps;
        bool enabled;
    }

    // Structure of a deposit (NFT)
    struct DepositInfo {
        uint256 planId;
        uint256 principal; // Principal amount
        uint256 startTimestamp;
        uint256 maturityAt;
        uint256 aprBpsAtOpen;     // Snapshot APR at opening
        uint256 penaltyBpsAtOpen; // Snapshot Penalty at opening
        DepositStatus status;     // Status
    }

    // ID counters
    uint256 public nextPlanId = 1;
    uint256 public nextDepositId = 1;

    // Data storage
    mapping(uint256 => SavingPlan) public plans;
    mapping(uint256 => DepositInfo) public deposits;

    // Required Events declaration
    event PlanCreated(uint256 planId, uint256 tenorDays, uint256 aprBps);
    event PlanUpdated(uint256 planId, uint256 newAprBps);
    event DepositOpened(uint256 depositId, address owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);
    event Withdrawn(uint256 depositId, address owner, uint256 principal, uint256 interest, bool isEarlyWithdraw);
    event Renewed(uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal, uint256 newPlanId);

    constructor(address _tokenAddress, address _vaultAddress) ERC721("Deposit Certificate", "DPC") Ownable(msg.sender) {
        depositToken = IERC20(_tokenAddress);
        vaultManager = IVaultManager(_vaultAddress);
    }
    
    // Admin creates a new saving plan
    function createPlan(
        uint256 _tenorDays,
        uint256 _aprBps,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _earlyWithdrawPenaltyBps
    ) external onlyOwner {
        // Prevent APR greater than 100% (10000 bps)
        require(_aprBps <= 10000, "Invalid APR");
        uint256 planId = nextPlanId++;
        
        plans[planId] = SavingPlan({
            tenorDays: _tenorDays,
            aprBps: _aprBps,
            minDeposit: _minDeposit,
            maxDeposit: _maxDeposit,
            earlyWithdrawPenaltyBps: _earlyWithdrawPenaltyBps,
            enabled: true
        });

        // Emit event to signal successful creation
        emit PlanCreated(planId, _tenorDays, _aprBps);
    }
    // User opens a deposit
    function openDeposit(uint256 planId, uint256 amount) external {
        SavingPlan storage plan = plans[planId];
        
        // 1. Check if the plan is enabled
        require(plan.enabled, "Plan is not enabled");
        
        // 2. Check if the amount is within min/max limits
        require(amount >= plan.minDeposit, "Amount below minimum");
        if (plan.maxDeposit > 0) {
            require(amount <= plan.maxDeposit, "Amount exceeds maximum");
        }

        // 3. Transfer token from user to Contract (Contract holds principal)
        // Note: User must call `approve` on Frontend before calling this
        require(depositToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // 4. Calculate maturity time (maturityAt)
        uint256 maturityAt = block.timestamp + (plan.tenorDays * 86400);

        // 5. Save deposit info and "Snapshot" APR, Penalty
        uint256 depositId = nextDepositId++;
        deposits[depositId] = DepositInfo({
            planId: planId,
            principal: amount,
            startTimestamp: block.timestamp,
            maturityAt: maturityAt,
            aprBpsAtOpen: plan.aprBps,                 // Snapshot to avoid future changes
            penaltyBpsAtOpen: plan.earlyWithdrawPenaltyBps, // Snapshot
            status: DepositStatus.Active               // Set status to Active
        });

        // 6. Mint NFT to user
        _mint(msg.sender, depositId);

        // 7. Emit DepositOpened event
        emit DepositOpened(depositId, msg.sender, planId, amount, maturityAt, plan.aprBps);
    }

    // Internal calculation functions (Precise math)
    function _calculateInterest(uint256 principal, uint256 aprBps, uint256 tenorDays) internal pure returns (uint256) {
        uint256 tenorSeconds = tenorDays * 86400; //
        // Use (a * b * c) / d to avoid precision errors
        return (principal * aprBps * tenorSeconds) / (31536000 * 10000); 
    }

    function _calculatePenalty(uint256 principal, uint256 penaltyBps) internal pure returns (uint256) {
        return (principal * penaltyBps) / 10000; //
    }

    // Modifier to block transactions when Admin pauses
    modifier whenNotPaused() {
        require(!vaultManager.paused(), "System is paused");
        _;
    }
    // Withdraw at maturity
    function withdrawAtMaturity(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "Not the owner");
        DepositInfo storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= dep.maturityAt, "Not matured yet");

        dep.status = DepositStatus.Withdrawn;

        uint256 interest = _calculateInterest(dep.principal, dep.aprBpsAtOpen, plans[dep.planId].tenorDays);

        // Return principal from SavingCore
        require(depositToken.transfer(msg.sender, dep.principal), "Principal transfer failed");
        
        // Pay interest from VaultManager
        vaultManager.payInterest(msg.sender, interest);

        emit Withdrawn(depositId, msg.sender, dep.principal, interest, false);
    }

    // Early withdrawal (Penalty on principal, no interest)
    function earlyWithdraw(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "Not the owner");
        DepositInfo storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Active, "Not active");
        require(block.timestamp < dep.maturityAt, "Matured, use withdrawAtMaturity");

        dep.status = DepositStatus.Withdrawn;

        uint256 penalty = _calculatePenalty(dep.principal, dep.penaltyBpsAtOpen);
        uint256 amountToUser = dep.principal - penalty;
        address feeReceiver = vaultManager.getFeeReceiver(); //

        // Return principal minus penalty to User
        require(depositToken.transfer(msg.sender, amountToUser), "Transfer to user failed");
        // Transfer penalty to Admin
        require(depositToken.transfer(feeReceiver, penalty), "Penalty transfer failed");
        
        // 📊 Report penalty to VaultManager
        vaultManager.recordPenalty(penalty);

        emit Withdrawn(depositId, msg.sender, dep.principal, 0, true);
    }
    // Manual Renew
    function renewDeposit(uint256 oldDepositId, uint256 newPlanId) external whenNotPaused {
        require(ownerOf(oldDepositId) == msg.sender, "Not the owner");
        DepositInfo storage oldDep = deposits[oldDepositId];
        require(oldDep.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= oldDep.maturityAt, "Not matured yet");

        SavingPlan storage newPlan = plans[newPlanId];
        require(newPlan.enabled, "New plan not enabled");

        oldDep.status = DepositStatus.ManualRenewed; //

        // Calculate interest of old deposit
        uint256 interest = _calculateInterest(oldDep.principal, oldDep.aprBpsAtOpen, plans[oldDep.planId].tenorDays);
        uint256 newPrincipal = oldDep.principal + interest; //

        // Pull interest from VaultManager to SavingCore to combine as new principal
        vaultManager.payInterest(address(this), interest);

        // Create new deposit (Mint new NFT)
        uint256 newDepositId = nextDepositId++;
        uint256 newMaturityAt = block.timestamp + (newPlan.tenorDays * 86400);

        deposits[newDepositId] = DepositInfo({
            planId: newPlanId,
            principal: newPrincipal,
            startTimestamp: block.timestamp,
            maturityAt: newMaturityAt,
            aprBpsAtOpen: newPlan.aprBps, // Use APR of the new plan
            penaltyBpsAtOpen: newPlan.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active
        });

        _mint(msg.sender, newDepositId);
        emit Renewed(oldDepositId, newDepositId, newPrincipal, newPlanId);
    }

    // Auto Withdraw after 3 days past maturity
    function autoWithdrawDeposit(uint256 depositId) external whenNotPaused {
        DepositInfo storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Active, "Not active");
        
        // Must be past 3-day grace period since maturity
        require(block.timestamp >= dep.maturityAt + 3 days, "Grace period not ended");

        dep.status = DepositStatus.Withdrawn;
        
        uint256 interest = _calculateInterest(dep.principal, dep.aprBpsAtOpen, plans[dep.planId].tenorDays);
        address owner = ownerOf(depositId);

        // Return principal from SavingCore
        require(depositToken.transfer(owner, dep.principal), "Principal transfer failed");
        
        // Pay interest from VaultManager
        vaultManager.payInterest(owner, interest);

        emit Withdrawn(depositId, owner, dep.principal, interest, false);
    }

    // Update plan APR (only affects new deposits)
    function updatePlan(uint256 planId, uint256 newAprBps) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].aprBps = newAprBps;
        emit PlanUpdated(planId, newAprBps);
    }

    // Enable saving plan
    function enablePlan(uint256 planId) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].enabled = true;
    }

    // Disable saving plan (users cannot open new deposits in this plan)
    function disablePlan(uint256 planId) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].enabled = false;
    }
}