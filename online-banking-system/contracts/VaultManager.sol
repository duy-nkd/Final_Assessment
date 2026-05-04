// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultManager is Ownable, Pausable {
    IERC20 public immutable token;
    address public feeReceiver;

    event VaultFunded(address indexed admin, uint256 amount);
    event VaultWithdrawn(address indexed admin, uint256 amount);

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
    
    // Thêm hàm lấy feeReceiver để SavingCore chuyển tiền phạt
    function getFeeReceiver() external view returns (address) {
        return feeReceiver;
    }
}