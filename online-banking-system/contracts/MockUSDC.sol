// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    // Ghi đè hàm decimals để trả về 6 (giống USDC thật) 
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // Hàm mint để lấy token test
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}