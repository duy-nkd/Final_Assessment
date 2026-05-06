# Error Handling & Testing Guide

## Error Handling Implemented in App.js

### 1. Try-Catch Pattern
All ethers.js calls are wrapped in try-catch blocks with user-friendly error messages:

```javascript
try {
  // Call ethers.js function
  const tx = await contract.someFunction();
  const receipt = await tx.wait();
  // Success handling
} catch (error) {
  console.error('Error description:', error);
  alert(`Error: ${error.reason || error.message}`);
}
```

### 2. Common Smart Contract Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Not the owner" | Trying to withdraw/renew someone else's deposit | Ensure you own the deposit |
| "Not active" | Deposit already withdrawn or in invalid state | Check deposit status in UI |
| "Not matured yet" | Trying to withdraw before maturity | Wait until maturity date |
| "Matured, use withdrawAtMaturity" | Trying early withdraw on matured deposit | Use "Withdraw" button instead |
| "Amount below minimum" | Deposit less than plan minimum | Check plan details and increase amount |
| "Amount exceeds maximum" | Deposit more than plan maximum | Reduce amount if plan has limit |
| "Plan is not enabled" | Plan not available | Check available plans in UI |
| "System is paused" | VaultManager is paused by admin | Wait for system to resume |
| "Transfer failed" / "Principal transfer failed" | Contract doesn't have enough tokens | Contact admin to fund vault |

### 3. Transaction Errors

```javascript
// Insufficient Allowance
// Cause: Approve didn't complete before calling openDeposit()
// Solution: Code already handles this with await tx.wait()

// Insufficient Balance
// Cause: User doesn't have enough USDC
// Solution: Mint USDC using MockUSDC.mint() or use faucet

// Out of Gas
// Cause: Gas limit too low (rare in app)
// Solution: Increase gas limit or check network congestion

// Reverted (no reason)
// Cause: Invalid state or contract bug
// Solution: Check transaction in block explorer, check contract addresses
```

### 4. Network Errors

```javascript
// "MetaMask is not installed"
if (!window.ethereum) {
  alert('MetaMask is not installed');
}

// Wrong Network
// ethers.js will throw when network doesn't match
// Solution: Manual check in connectWallet():
async function checkNetwork() {
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    alert('Please switch to correct network');
  }
}

// Connection Lost
// ethers.js will throw during provider calls
// Solution: Wrap in try-catch and retry
```

## Testing Guide

### Test Scenario 1: Full Deposit Flow

```javascript
// 1. Connect wallet (should show address and balance)
// Expected: Address displayed, USDC balance shown

// 2. View plans (should show Plan 1 details)
// Expected: Tenor, APR, Min/Max deposit visible

// 3. Open deposit with valid amount
// Expected: 
//   - Approve transaction sent (check MetaMask)
//   - Wait for approval to be mined
//   - Deposit transaction sent
//   - New deposit appears in active deposits table

// 4. Verify deposit created
// Expected:
//   - Deposit ID visible
//   - Principal matches input
//   - Status shows "Active"
//   - Maturity date shown
//   - USDC balance decreased
```

### Test Scenario 2: Early Withdrawal Before Maturity

```javascript
// Prerequisites: Active deposit not yet matured

// 1. Click "Early Withdraw" button
// Expected: Confirmation dialog

// 2. Confirm withdrawal
// Expected:
//   - Transaction sent
//   - Deposit status changes to "Withdrawn"
//   - USDC balance increases (minus penalty)
//   - Early withdraw button disabled

// 3. Verify penalty deducted
// Expected: Returned amount < Principal (due to penalty)
```

### Test Scenario 3: Withdrawal at Maturity

```javascript
// Prerequisites: Matured deposit (current time >= maturity date)

// 1. Wait until deposit matures (or use blockchain timestamp manipulation in testing)
// Expected: "Withdraw" button appears (instead of "Early Withdraw")

// 2. Click "Withdraw" button
// Expected:
//   - Transaction sent
//   - Deposit status changes to "Withdrawn"
//   - USDC balance increases (principal + interest)
//   - Withdraw button disabled

// 3. Verify interest calculated
// Expected: 
//   - Formula: principal * (aprBps / 10000) * (tenorDays / 365)
//   - Returned amount > Principal
```

### Test Scenario 4: Renewal

```javascript
// Prerequisites: Matured deposit with status "Active"

// 1. Click "Renew" button
// Expected: Transaction sent

// 2. Verify new deposit created
// Expected:
//   - Old deposit status changes to "ManualRenewed"
//   - New deposit appears with:
//     - Principal = old principal + interest
//     - New maturity date
//     - Same or different APR (depending on plan)

// 3. Verify automatic status updates
// Expected: UI shows new deposit in active list
```

### Test Scenario 5: Error Cases

```javascript
// Test 1: Withdraw before maturity (without early withdraw button)
// Expected: Error "Not matured yet"

// Test 2: Deposit with amount < minimum
// Expected: Error "Amount below minimum"

// Test 3: Deposit without approval
// Expected: Error during deposit (approval required)

// Test 4: View someone else's deposit
// Expected: Only user's deposits shown

// Test 5: Disconnect and reconnect wallet
// Expected: State resets, can reconnect and see same deposits
```

## Local Testing Setup

### Using Hardhat with Local Network

```bash
# In your smart contracts directory
npx hardhat node

# In another terminal
npx hardhat run scripts/deploy.js --network localhost
```

Then connect MetaMask to localhost:8545 and update contract addresses in App.js.

### Using Mock Data for Frontend Testing

```javascript
// In App.js - add development mode
const DEV_MODE = true;

const mockPlan = {
  id: 1,
  tenor: 30,
  apr: 5.5,
  minDeposit: '100.00',
  maxDeposit: '10000.00',
  penaltyBps: 250
};

const mockDeposit = {
  id: 1,
  principal: '1000.00',
  status: 'Active',
  maturityDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString(),
  maturityTimestamp: Math.floor(Date.now() / 1000) + 30 * 86400,
  aprBps: 550,
  isMatured: false
};

// Use mock data when DEV_MODE = true for UI testing without transactions
```

## Debugging Tips

### 1. Browser DevTools
```javascript
// Monitor contract interactions
console.log('Approving:', CORE_ADDRESS, amount);

// Check contract responses
const planData = await contract.plans(1);
console.log('Plan data:', planData);

// Verify timestamps
console.log('Current time:', Math.floor(Date.now() / 1000));
console.log('Maturity:', parseInt(deposit.maturityAt));
console.log('Difference:', parseInt(deposit.maturityAt) - Math.floor(Date.now() / 1000), 'seconds');
```

### 2. MetaMask Debugging
- Click MetaMask icon → Settings → Advanced → Show test networks
- Use Network dropdown to see transaction history
- Click on transaction to see details and revert reason

### 3. Block Explorer
```
Use Etherscan (mainnet) or similar for deployed networks:
1. Search transaction hash
2. View status (Success/Failed)
3. Check "Logs" tab for emitted events
4. See actual gas used vs estimated
```

### 4. Contract ABI Verification
```javascript
// Verify ABI matches contract functions
const contract = new ethers.Contract(address, ABI, provider);
try {
  const result = await contract.someFunction();
  console.log('Function exists and works');
} catch (e) {
  console.error('Function not found or wrong signature');
}
```

## Performance Optimization

### Current Implementation
- Auto-refresh every 30 seconds
- Loads full deposit history on wallet connect
- Fetches plan details on wallet connect

### For Production
```javascript
// Add pagination for deposits
const DEPOSITS_PER_PAGE = 10;
const [page, setPage] = useState(0);

// Lazy load deposits
async function loadMoreDeposits() {
  // Load next batch of deposit IDs
}

// Cache plan data
const [cachedPlans, setCachedPlans] = useState({});
if (cachedPlans[planId]) {
  return cachedPlans[planId];
}

// Use event listeners instead of polling
window.ethereum.on('accountsChanged', handleAccountChange);
window.ethereum.on('chainChanged', handleChainChange);
```

## Common Testing Issues

### Issue 1: "ownerOf() throws" 
**Cause**: Trying to check ownership of non-existent deposit
**Fix**: Wrap in try-catch:
```javascript
try {
  const owner = await coreContract.ownerOf(i);
} catch (error) {
  // Deposit doesn't exist, skip
  continue;
}
```

### Issue 2: Balance not updating
**Cause**: Refresh timeout too long or pending transaction
**Fix**: 
- Manual refresh button
- WebSocket provider instead of HTTP
- Reduce refresh interval

### Issue 3: Timestamps in wrong format
**Cause**: JavaScript Date expects milliseconds, contract returns seconds
**Fix**: Always multiply by 1000
```javascript
const date = new Date(parseInt(timestamp) * 1000);
```

### Issue 4: Button disabled when shouldn't be
**Cause**: `loadingActionId` state persists
**Fix**: Ensure to reset state after transaction:
```javascript
try {
  // ... transaction
  setLoadingActionId(null); // Reset immediately
} catch (error) {
  setLoadingActionId(null); // Reset in error case too
}
```

## Monitoring & Logging

For production, add logging service:

```javascript
// Error tracking
try {
  // ...
} catch (error) {
  logError({
    action: 'openDeposit',
    error: error.message,
    user: userAddress,
    timestamp: new Date().toISOString()
  });
}

// Transaction tracking
const tx = await contract.function();
logTransaction({
  type: 'openDeposit',
  hash: tx.hash,
  from: userAddress,
  timestamp: new Date().toISOString()
});
```

## Support Resources

- **ethers.js v6 docs**: https://docs.ethers.org/v6/
- **Solidity ABI**: https://docs.soliditylang.org/en/latest/abi-spec.html
- **MetaMask docs**: https://docs.metamask.io/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Hooks**: https://react.dev/reference/react/hooks
