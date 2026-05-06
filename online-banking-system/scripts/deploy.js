const { ethers } = require("hardhat");

async function main() {
  const [deployer, user1] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // 2. Deploy VaultManager
  const VaultManager = await ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy(usdcAddress);
  await vaultManager.waitForDeployment();
  const vaultAddress = await vaultManager.getAddress();
  console.log("VaultManager deployed to:", vaultAddress);

  // 3. Deploy SavingCore
  const SavingCore = await ethers.getContractFactory("SavingCore");
  const savingCore = await SavingCore.deploy(usdcAddress, vaultAddress);
  await savingCore.waitForDeployment();
  const coreAddress = await savingCore.getAddress();
  console.log("SavingCore deployed to:", coreAddress);

  // 4. Setup ban đầu cho Demo Frontend
  console.log("Setting up initial data for frontend demo...");
  await vaultManager.setCoreContract(coreAddress, true);
  
  // Mint token test cho người dùng và Admin
  await mockUSDC.mint(deployer.address, ethers.parseUnits("100000", 6));
  await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));

  // Admin nạp tiền vào quỹ lãi
  await mockUSDC.approve(vaultAddress, ethers.parseUnits("50000", 6));
  await vaultManager.fundVault(ethers.parseUnits("50000", 6));

  // Admin tạo Gói tiết kiệm số 1: 90 ngày, 2.5% APR
  await savingCore.createPlan(90, 250, ethers.parseUnits("100", 6), ethers.parseUnits("5000", 6), 500);
  console.log("Plan #1 created! System is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});