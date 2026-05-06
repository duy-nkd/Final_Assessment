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
    IERC20 public immutable depositToken; // Token dùng để gửi (MockUSDC)
    IVaultManager public vaultManager;
    
    // Định nghĩa 4 trạng thái của một khoản gửi
    enum DepositStatus { Active, Withdrawn, ManualRenewed, AutoRenewed }

    // Cấu trúc của một gói tiết kiệm
    struct SavingPlan {
        uint256 tenorDays;
        uint256 aprBps;
        uint256 minDeposit;
        uint256 maxDeposit; // Nếu bằng 0 nghĩa là không giới hạn
        uint256 earlyWithdrawPenaltyBps;
        bool enabled;
    }

    // Cấu trúc của một khoản tiền gửi (NFT)
    struct DepositInfo {
        uint256 planId;
        uint256 principal; // Số tiền gốc
        uint256 startTimestamp;
        uint256 maturityAt;
        uint256 aprBpsAtOpen;     // Snapshot APR lúc mở
        uint256 penaltyBpsAtOpen; // Snapshot Penalty lúc mở
        DepositStatus status;     // Trạng thái
    }

    // Biến đếm ID
    uint256 public nextPlanId = 1;
    uint256 public nextDepositId = 1;

    // Lưu trữ dữ liệu
    mapping(uint256 => SavingPlan) public plans;
    mapping(uint256 => DepositInfo) public deposits;

    // Khai báo các Events bắt buộc
    event PlanCreated(uint256 planId, uint256 tenorDays, uint256 aprBps);
    event PlanUpdated(uint256 planId, uint256 newAprBps);
    event DepositOpened(uint256 depositId, address owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);
    event Withdrawn(uint256 depositId, address owner, uint256 principal, uint256 interest, bool isEarlyWithdraw);
    event Renewed(uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal, uint256 newPlanId);

    constructor(address _tokenAddress, address _vaultAddress) ERC721("Deposit Certificate", "DPC") Ownable(msg.sender) {
        depositToken = IERC20(_tokenAddress);
        vaultManager = IVaultManager(_vaultAddress);
    }
    
    // Admin tạo gói tiết kiệm mới
    function createPlan(
        uint256 _tenorDays,
        uint256 _aprBps,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _earlyWithdrawPenaltyBps
    ) external onlyOwner {
        // Thêm dòng này để chặn APR lớn hơn 100% (10000 bps)
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

        // Phát ra sự kiện báo hiệu đã tạo thành công
        emit PlanCreated(planId, _tenorDays, _aprBps);
    }
    // Người dùng mở khoản tiền gửi
    function openDeposit(uint256 planId, uint256 amount) external {
        SavingPlan storage plan = plans[planId];
        
        // 1. Kiểm tra gói có đang được bật (enabled) hay không
        require(plan.enabled, "Plan is not enabled");
        
        // 2. Kiểm tra số tiền có nằm trong giới hạn min/max không
        require(amount >= plan.minDeposit, "Amount below minimum");
        if (plan.maxDeposit > 0) {
            require(amount <= plan.maxDeposit, "Amount exceeds maximum");
        }

        // 3. Chuyển token từ người dùng vào Contract (Contract giữ tiền gốc)
        // Lưu ý: Người dùng phải gọi hàm `approve` ở Frontend trước khi gọi hàm này
        require(depositToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // 4. Tính toán thời gian đáo hạn (maturityAt)
        uint256 maturityAt = block.timestamp + (plan.tenorDays * 86400);

        // 5. Lưu thông tin khoản gửi và "Snapshot" APR, Penalty
        uint256 depositId = nextDepositId++;
        deposits[depositId] = DepositInfo({
            planId: planId,
            principal: amount,
            startTimestamp: block.timestamp,
            maturityAt: maturityAt,
            aprBpsAtOpen: plan.aprBps,                 // Snapshot để không bị ảnh hưởng sau này
            penaltyBpsAtOpen: plan.earlyWithdrawPenaltyBps, // Snapshot
            status: DepositStatus.Active               // Set trạng thái Active
        });

        // 6. Đúc NFT (mint) cho người dùng
        _mint(msg.sender, depositId);

        // 7. Phát ra sự kiện DepositOpened
        emit DepositOpened(depositId, msg.sender, planId, amount, maturityAt, plan.aprBps);
    }

    // Các hàm tính toán nội bộ (Toán học chính xác)
    function _calculateInterest(uint256 principal, uint256 aprBps, uint256 tenorDays) internal pure returns (uint256) {
        uint256 tenorSeconds = tenorDays * 86400; //
        // Sử dụng (a * b * c) / d để tránh sai số
        return (principal * aprBps * tenorSeconds) / (31536000 * 10000); 
    }

    function _calculatePenalty(uint256 principal, uint256 penaltyBps) internal pure returns (uint256) {
        return (principal * penaltyBps) / 10000; //
    }

    // Thêm modifier chặn giao dịch khi Admin pause
    modifier whenNotPaused() {
        require(!vaultManager.paused(), "System is paused");
        _;
    }
    // Rút tiền khi đáo hạn
    function withdrawAtMaturity(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "Not the owner");
        DepositInfo storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= dep.maturityAt, "Not matured yet");

        dep.status = DepositStatus.Withdrawn;

        uint256 interest = _calculateInterest(dep.principal, dep.aprBpsAtOpen, plans[dep.planId].tenorDays);

        // Trả gốc từ SavingCore
        require(depositToken.transfer(msg.sender, dep.principal), "Principal transfer failed");
        
        // Trả lãi từ VaultManager
        vaultManager.payInterest(msg.sender, interest);

        emit Withdrawn(depositId, msg.sender, dep.principal, interest, false);
    }

    // Rút tiền trước hạn (Phạt tiền gốc, không nhận lãi)
    function earlyWithdraw(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "Not the owner");
        DepositInfo storage dep = deposits[depositId];
        require(dep.status == DepositStatus.Active, "Not active");
        require(block.timestamp < dep.maturityAt, "Matured, use withdrawAtMaturity");

        dep.status = DepositStatus.Withdrawn;

        uint256 penalty = _calculatePenalty(dep.principal, dep.penaltyBpsAtOpen);
        uint256 amountToUser = dep.principal - penalty;
        address feeReceiver = vaultManager.getFeeReceiver(); //

        // Trả tiền trừ phạt cho User
        require(depositToken.transfer(msg.sender, amountToUser), "Transfer to user failed");
        // Chuyển phí phạt cho Admin
        require(depositToken.transfer(feeReceiver, penalty), "Penalty transfer failed");
        
        // 📊 Báo cáo penalty cho VaultManager
        vaultManager.recordPenalty(penalty);

        emit Withdrawn(depositId, msg.sender, dep.principal, 0, true);
    }
    // Gia hạn thủ công (Manual Renew)
    function renewDeposit(uint256 oldDepositId, uint256 newPlanId) external whenNotPaused {
        require(ownerOf(oldDepositId) == msg.sender, "Not the owner");
        DepositInfo storage oldDep = deposits[oldDepositId];
        require(oldDep.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= oldDep.maturityAt, "Not matured yet");

        SavingPlan storage newPlan = plans[newPlanId];
        require(newPlan.enabled, "New plan not enabled");

        oldDep.status = DepositStatus.ManualRenewed; //

        // Tính lãi của khoản cũ
        uint256 interest = _calculateInterest(oldDep.principal, oldDep.aprBpsAtOpen, plans[oldDep.planId].tenorDays);
        uint256 newPrincipal = oldDep.principal + interest; //

        // Kéo tiền lãi từ VaultManager về SavingCore để gộp làm gốc mới
        vaultManager.payInterest(address(this), interest);

        // Tạo khoản gửi mới (Mint NFT mới)
        uint256 newDepositId = nextDepositId++;
        uint256 newMaturityAt = block.timestamp + (newPlan.tenorDays * 86400);

        deposits[newDepositId] = DepositInfo({
            planId: newPlanId,
            principal: newPrincipal,
            startTimestamp: block.timestamp,
            maturityAt: newMaturityAt,
            aprBpsAtOpen: newPlan.aprBps, // Dùng APR của gói mới
            penaltyBpsAtOpen: newPlan.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active
        });

        _mint(msg.sender, newDepositId);
        emit Renewed(oldDepositId, newDepositId, newPrincipal, newPlanId);
    }

    // Tự động gia hạn (Auto Renew) do Bot gọi
    function autoRenewDeposit(uint256 oldDepositId) external whenNotPaused {
        DepositInfo storage oldDep = deposits[oldDepositId];
        require(oldDep.status == DepositStatus.Active, "Not active");
        
        // Phải quá 3 ngày ân hạn kể từ lúc đáo hạn
        require(block.timestamp >= oldDep.maturityAt + 3 days, "Grace period not ended");

        oldDep.status = DepositStatus.AutoRenewed;
        SavingPlan storage oldPlan = plans[oldDep.planId];

        uint256 interest = _calculateInterest(oldDep.principal, oldDep.aprBpsAtOpen, oldPlan.tenorDays);
        uint256 newPrincipal = oldDep.principal + interest; //

        vaultManager.payInterest(address(this), interest);

        uint256 newDepositId = nextDepositId++;
        uint256 newMaturityAt = block.timestamp + (oldPlan.tenorDays * 86400);

        // Tự động gia hạn giữ nguyên cấu hình cũ, đặc biệt là APR
        deposits[newDepositId] = DepositInfo({
            planId: oldDep.planId,
            principal: newPrincipal,
            startTimestamp: block.timestamp,
            maturityAt: newMaturityAt,
            aprBpsAtOpen: oldDep.aprBpsAtOpen,       // KHÓA APR CŨ 
            penaltyBpsAtOpen: oldDep.penaltyBpsAtOpen,
            status: DepositStatus.Active
        });

        _mint(ownerOf(oldDepositId), newDepositId);
        emit Renewed(oldDepositId, newDepositId, newPrincipal, oldDep.planId);
    }
    // Cập nhật lãi suất của gói (chỉ ảnh hưởng đến khoản gửi mới sau này)
    function updatePlan(uint256 planId, uint256 newAprBps) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].aprBps = newAprBps;
        emit PlanUpdated(planId, newAprBps);
    }

    // Bật gói tiết kiệm
    function enablePlan(uint256 planId) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].enabled = true;
    }

    // Tắt gói tiết kiệm (người dùng không thể gửi thêm vào gói này)
    function disablePlan(uint256 planId) external onlyOwner {
        require(planId > 0 && planId < nextPlanId, "Plan does not exist");
        plans[planId].enabled = false;
    }
}