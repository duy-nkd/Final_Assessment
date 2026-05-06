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

  // 4. Initial setup for Frontend Demo
  console.log("Setting up initial data for frontend demo...");
  await vaultManager.setCoreContract(coreAddress, true);
  
  // Mint test tokens for user and Admin
  await mockUSDC.mint(deployer.address, ethers.parseUnits("100000", 6));
  await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));

  // Admin funds the interest vault
  await mockUSDC.approve(vaultAddress, ethers.parseUnits("50000", 6));
  await vaultManager.fundVault(ethers.parseUnits("50000", 6));

  // Admin creates Saving Plan #1: 90 days, 2.5% APR
  await savingCore.createPlan(90, 250, ethers.parseUnits("100", 6), ethers.parseUnits("5000", 6), 500);
  console.log("Plan #1 created! System is ready.");

  // 5. Update .env file
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, "..", ".env");
  const envContent = `REACT_APP_USDC_ADDRESS=${usdcAddress}\nREACT_APP_CORE_ADDRESS=${coreAddress}\nREACT_APP_VAULT_ADDRESS=${vaultAddress}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env with new addresses.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});