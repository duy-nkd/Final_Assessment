# Contract ABIs and Function Reference

## MockUSDC ABI

### Included Functions:

```javascript
const USDC_ABI = [
  // ERC20 Standard Functions
  
  // Approve spending of USDC
  // @param spender: Contract address to allow spending (CORE_ADDRESS)
  // @param amount: Amount in Wei (uint256, use ethers.parseUnits(amount, 6))
  "function approve(address spender, uint256 amount) public returns (bool)",
  
  // Get balance of an account
  // @param account: Address to check balance
  // @return: Balance in Wei (uint256, format with ethers.formatUnits(balance, 6))
  "function balanceOf(address account) public view returns (uint256)",
  
  // Get number of decimals (6 for MockUSDC)
  // @return: 6
  "function decimals() public view returns (uint8)",
  
  // Transfer tokens (rarely used in this app)
  // @param to: Recipient address
  // @param amount: Amount in Wei
  "function transfer(address to, uint256 amount) public returns (bool)"
];
```

### Usage Examples:

```javascript
// Create contract instance
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

// Approve spending
const approveTx = await usdcContract.approve(CORE_ADDRESS, ethers.parseUnits('1000', 6));
await approveTx.wait();

// Get balance
const balance = await usdcContract.balanceOf(userAddress);
const formattedBalance = ethers.formatUnits(balance, 6); // "1000.00"

// Get decimals
const decimals = await usdcContract.decimals(); // 6
```

---

## SavingCore ABI

### Included Functions:

```javascript
const CORE_ABI = [
  // ===== VIEW FUNCTIONS (Read-only) =====
  
  // Get plan details
  // @param planId: Plan ID (typically 1)
  // @return: {
  //   tenorDays: uint256,           // Duration in days
  //   aprBps: uint256,              // APR in basis points (divide by 100 for %)
  //   minDeposit: uint256,          // Minimum deposit amount (Wei)
  //   maxDeposit: uint256,          // Maximum deposit amount (0 = unlimited)
  //   earlyWithdrawPenaltyBps: uint256, // Penalty in basis points
  //   enabled: bool                 // Is plan active?
  // }
  "function plans(uint256 planId) public view returns (uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 earlyWithdrawPenaltyBps, bool enabled)",
  
  // Get deposit details
  // @param depositId: Deposit ID (NFT token ID)
  // @return: {
  //   planId: uint256,              // Which plan was used
  //   principal: uint256,           // Original deposit amount (Wei)
  //   startTimestamp: uint256,      // When deposit was opened (Unix timestamp)
  //   maturityAt: uint256,          // When deposit matures (Unix timestamp)
  //   aprBpsAtOpen: uint256,        // APR snapshot at opening
  //   penaltyBpsAtOpen: uint256,    // Penalty snapshot at opening
  //   status: uint8                 // 0=Active, 1=Withdrawn, 2=ManualRenewed, 3=AutoRenewed
  // }
  "function deposits(uint256 depositId) public view returns (uint256 planId, uint256 principal, uint256 startTimestamp, uint256 maturityAt, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen, uint8 status)",
  
  // Get next deposit ID (for enumeration)
  // @return: Next available deposit ID
  "function nextDepositId() public view returns (uint256)",
  
  // Get NFT owner (ERC721)
  // @param tokenId: Deposit ID
  // @return: Owner address
  "function ownerOf(uint256 tokenId) public view returns (address)",
  
  // ===== STATE-CHANGING FUNCTIONS =====
  
  // Create a new deposit (requires prior approve() on MockUSDC)
  // @param planId: Plan ID to use
  // @param amount: Amount to deposit (Wei, use ethers.parseUnits(amount, 6))
  // Emits: DepositOpened(depositId, owner, planId, principal, maturityAt, aprBpsAtOpen)
  "function openDeposit(uint256 planId, uint256 amount) external",
  
  // Withdraw deposit at or after maturity (gets principal + interest)
  // @param depositId: Deposit ID to withdraw
  // Requires: block.timestamp >= maturityAt
  // Emits: Withdrawn(depositId, owner, principal, interest, false)
  "function withdrawAtMaturity(uint256 depositId) external",
  
  // Withdraw before maturity (gets principal minus penalty)
  // @param depositId: Deposit ID to withdraw
  // Requires: block.timestamp < maturityAt
  // Emits: Withdrawn(depositId, owner, principal, 0, true)
  "function earlyWithdraw(uint256 depositId) external",
  
  // Renew a matured deposit with a new plan
  // @param oldDepositId: Matured deposit to renew
  // @param newPlanId: New plan to use (typically 1)
  // Requires: block.timestamp >= oldMaturityAt
  // Emits: Renewed(oldDepositId, newDepositId, newPrincipal, newPlanId)
  "function renewDeposit(uint256 oldDepositId, uint256 newPlanId) external"
];
```

### Usage Examples:

```javascript
// Create contract instance
const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, provider);

// Fetch plan details
const planData = await coreContract.plans(1);
const aprPercent = parseInt(planData.aprBps) / 100; // Convert basis points to %
// planData.tenorDays = days
// planData.minDeposit = minimum amount (Wei)
// planData.maxDeposit = maximum amount (Wei, 0 = unlimited)

// Fetch deposit details
const depositData = await coreContract.deposits(5);
// depositData.principal = original amount
// depositData.maturityAt = Unix timestamp of maturity
// depositData.status: 0=Active, 1=Withdrawn, 2=ManualRenewed, 3=AutoRenewed

// Check NFT ownership
const owner = await coreContract.ownerOf(5); // Returns address

// Get next deposit ID
const nextId = await coreContract.nextDepositId();

// Open a deposit (requires 2 transactions via signer)
const signerContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);
const amount = ethers.parseUnits('1000', 6);

// First: Approve USDC
const approveTx = await usdcContract.approve(CORE_ADDRESS, amount);
await approveTx.wait();

// Then: Open deposit
const depositTx = await signerContract.openDeposit(1, amount);
const receipt = await depositTx.wait();

// Withdraw at maturity
const withdrawTx = await signerContract.withdrawAtMaturity(5);
await withdrawTx.wait();

// Early withdraw
const earlyTx = await signerContract.earlyWithdraw(5);
await earlyTx.wait();

// Renew deposit
const renewTx = await signerContract.renewDeposit(5, 1);
await renewTx.wait();
```

---

## Common ABI Patterns

### Reading Data (View Functions - No Gas)
```javascript
// Use provider (read-only)
const contract = new ethers.Contract(address, ABI, provider);
const data = await contract.functionName();
```

### Sending Transactions (State-Changing - Costs Gas)
```javascript
// Use signer (connected wallet)
const contract = new ethers.Contract(address, ABI, signer);
const tx = await contract.functionName(params);
const receipt = await tx.wait(); // Wait for confirmation

// Check transaction result
console.log(receipt.transactionHash);
console.log(receipt.status); // 1 = success, 0 = failed
```

---

## Important Notes

1. **Basis Points (bps)**: 
   - 1 bps = 0.01%
   - To convert: divide by 100 to get percentage
   - 1000 bps = 10%

2. **Decimals**:
   - MockUSDC has 6 decimals
   - Always use ethers.parseUnits() for sending (user input → Wei)
   - Always use ethers.formatUnits() for displaying (Wei → user readable)

3. **Timestamps**:
   - Stored as Unix time (seconds since epoch)
   - JavaScript Date expects milliseconds, so multiply by 1000

4. **Deposit Enumeration**:
   - Get range: 1 to (nextDepositId - 1)
   - Filter by ownership: ownerOf(id) == userAddress
   - Status check: deposits(id).status to verify it's Active

5. **Transaction Waiting**:
   - Always await tx.wait() to ensure transaction is mined
   - Required before calling functions that depend on state changes
