// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultManager is Ownable, Pausable {
    IERC20 public immutable token;
    address public feeReceiver;

    // 📊 Tracking early withdrawal penalties
    uint256 public totalPenaltyCollected = 0;
    
    event VaultFunded(address indexed admin, uint256 amount);
    event VaultWithdrawn(address indexed admin, uint256 amount);
    event PenaltyCollected(uint256 amount, address indexed from);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
        feeReceiver = msg.sender; // Default is Admin
    }

    // Admin funds the interest payment vault
    function fundVault(uint256 amount) external onlyOwner {
        token.transferFrom(msg.sender, address(this), amount);
        emit VaultFunded(msg.sender, amount);
    }

    // Admin withdraws funds from the vault
    function withdrawVault(uint256 amount) external onlyOwner {
        token.transfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount);
    }

    // Set the address to receive early withdrawal penalty fees
    function setFeeReceiver(address _receiver) external onlyOwner {
        require(_receiver != address(0), "Invalid address");
        feeReceiver = _receiver;
    }

    // Emergency pause mechanism
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // In VaultManager.sol
    mapping(address => bool) public isCoreContract;

    function setCoreContract(address _core, bool _status) external onlyOwner {
        isCoreContract[_core] = _status;
    }

    // Function for SavingCore to pay interest to users
    function payInterest(address to, uint256 amount) external {
        require(isCoreContract[msg.sender], "Only Core Contract");
        token.transfer(to, amount);
    }
    
    // 📊 Function for SavingCore to report collected penalties
    function recordPenalty(uint256 amount) external {
        require(isCoreContract[msg.sender], "Only Core Contract");
        totalPenaltyCollected += amount;
        emit PenaltyCollected(amount, msg.sender);
    }
    
    // Add function to get feeReceiver for SavingCore to transfer penalties
    function getFeeReceiver() external view returns (address) {
        return feeReceiver;
    }
    
    // 📊 Check total penalties collected
    function getPenaltyBalance() external view returns (uint256) {
        return totalPenaltyCollected;
    }
}