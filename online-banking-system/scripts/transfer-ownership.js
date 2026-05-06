const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const NEW_OWNER = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

async function main() {
  const envPath = path.join(__dirname, "..", ".env");
  const envVars = loadEnvFile(envPath);
  const coreAddress = process.env.REACT_APP_CORE_ADDRESS || envVars.REACT_APP_CORE_ADDRESS;
  const vaultAddress = process.env.REACT_APP_VAULT_ADDRESS || envVars.REACT_APP_VAULT_ADDRESS;

  if (!coreAddress || !vaultAddress) {
    throw new Error("Missing REACT_APP_CORE_ADDRESS or REACT_APP_VAULT_ADDRESS in .env");
  }

  const [caller] = await ethers.getSigners();
  console.log("Caller:", caller.address);
  console.log("New owner:", NEW_OWNER);
  console.log("SavingCore:", coreAddress);
  console.log("VaultManager:", vaultAddress);

  const savingCore = await ethers.getContractAt("SavingCore", coreAddress);
  const vaultManager = await ethers.getContractAt("VaultManager", vaultAddress);

  const currentCoreOwner = await savingCore.owner();
  const currentVaultOwner = await vaultManager.owner();
  console.log("Current SavingCore owner:", currentCoreOwner);
  console.log("Current VaultManager owner:", currentVaultOwner);

  const coreTx = await savingCore.transferOwnership(NEW_OWNER);
  await coreTx.wait();
  console.log("SavingCore ownership transferred");

  const vaultTx = await vaultManager.transferOwnership(NEW_OWNER);
  await vaultTx.wait();
  console.log("VaultManager ownership transferred");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, "utf8");
  return contents.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return acc;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) {
      return acc;
    }
    acc[key] = rest.join("=").trim();
    return acc;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
