// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultManager is Ownable, Pausable {
    IERC20 public immutable token;
    address public feeReceiver;

    // 📊 Tracking tiền phạt rút sớm
    uint256 public totalPenaltyCollected = 0;
    
    event VaultFunded(address indexed admin, uint256 amount);
    event VaultWithdrawn(address indexed admin, uint256 amount);
    event PenaltyCollected(uint256 amount, address indexed from);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
        feeReceiver = msg.sender; // Mặc định là Admin 
    }

    // Admin nạp tiền vào quỹ trả lãi 
    function fundVault(uint256 amount) external onlyOwner {
        token.transferFrom(msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    // Admin rút tiền từ quỹ 
    function withdrawVault(uint256 amount) external onlyOwner {
        token.transfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount);
    }

    // Thiết lập địa chỉ nhận phí phạt rút trước hạn 
    function setFeeReceiver(address _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid address");
        feeReceiver = _receiver;
    }

    // Cơ chế tạm dừng khẩn cấp 
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Trong VaultManager.sol
    mapping(address => bool) public isCoreContract;

    function setCoreContract(address _core, bool _status) external onlyOwner {
        isCoreContract[_core] = _status;
    }

    // Hàm để SavingCore gọi trả tiền lãi cho user
    function payInterest(address to, uint256 amount) external {
        require(isCoreContract[msg.sender], "Only Core Contract");
        token.transfer(to, amount);
    }
    
    // 📊 Hàm để SavingCore báo cáo tiền phạt nhận được
    function recordPenalty(uint256 amount) external {
        require(isCoreContract[msg.sender], "Only Core Contract");
        totalPenaltyCollected += amount;
        emit PenaltyCollected(amount, msg.sender);
    }
    
    // Thêm hàm lấy feeReceiver để SavingCore chuyển tiền phạt
    function getFeeReceiver() external view returns (address) {
        return feeReceiver;
    }
    
    // 📊 Kiểm tra tổng tiền phạt đã thu
    function getPenaltyBalance() external view returns (uint256) {
        return totalPenaltyCollected;
    }
}