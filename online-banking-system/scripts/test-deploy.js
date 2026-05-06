const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  try {
    // Test 1: Deploy MockUSDC
    console.log("\n1️⃣  Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
    const usdcAddress = await mockUSDC.getAddress();
    console.log("✅ MockUSDC deployed to:", usdcAddress);

    // Test 2: Mint tokens
    console.log("\n2️⃣  Minting tokens...");
    await mockUSDC.mint(deployer.address, ethers.parseUnits("100000", 6));
    const balance = await mockUSDC.balanceOf(deployer.address);
    console.log("✅ Balance:", ethers.formatUnits(balance, 6), "USDC");

    // Test 3: Deploy VaultManager
    console.log("\n3️⃣  Deploying VaultManager...");
    const VaultManager = await ethers.getContractFactory("VaultManager");
    const vaultManager = await VaultManager.deploy(usdcAddress);
    await vaultManager.waitForDeployment();
    const vaultAddress = await vaultManager.getAddress();
    console.log("✅ VaultManager deployed to:", vaultAddress);

    // Test 4: Deploy SavingCore
    console.log("\n4️⃣  Deploying SavingCore...");
    const SavingCore = await ethers.getContractFactory("SavingCore");
    const savingCore = await SavingCore.deploy(usdcAddress, vaultAddress);
    await savingCore.waitForDeployment();
    const coreAddress = await savingCore.getAddress();
    console.log("✅ SavingCore deployed to:", coreAddress);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 All contracts deployed successfully!");
    console.log("=".repeat(60));
    console.log("REACT_APP_USDC_ADDRESS=" + usdcAddress);
    console.log("REACT_APP_CORE_ADDRESS=" + coreAddress);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ Deployment failed!");
    console.error("Error:", error.message);
    if (error.data) {
      console.error("Data:", error.data);
    }
    process.exitCode = 1;
  }
}

main();
