// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SavingCore is ERC721, Ownable {
    IERC20 public immutable depositToken; // Token dùng để gửi (MockUSDC)
    
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
    event DepositOpened(uint256 depositId, address owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);

    constructor(address _tokenAddress) ERC721("Deposit Certificate", "DPC") Ownable(msg.sender) {
        depositToken = IERC20(_tokenAddress);
    }
    
    // Admin tạo gói tiết kiệm mới
    function createPlan(
        uint256 _tenorDays,
        uint256 _aprBps,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _earlyWithdrawPenaltyBps
    ) external onlyOwner {
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
}