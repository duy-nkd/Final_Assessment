# Online Banking System - React Frontend Setup Guide

## Overview
This is a complete React.js frontend for your Web3 Online Banking System built with ethers.js v6 and Tailwind CSS.

## Prerequisites
- Node.js 16+ and npm/yarn
- MetaMask browser extension installed
- Your deployed smart contract addresses (MockUSDC and SavingCore)

## Installation & Setup

### 1. Initialize React Project (if starting fresh)
```bash
npx create-react-app frontend
cd frontend
npm install ethers
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. Configure Tailwind CSS
Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. Update Contract Addresses
In `src/App.js`, replace the placeholder addresses at the top:
```javascript
const USDC_ADDRESS = "0xYourMockUSDCContractAddress";
const CORE_ADDRESS = "0xYourSavingCoreContractAddress";
```

Or use environment variables by creating `.env`:
```
REACT_APP_USDC_ADDRESS=0xYourMockUSDCContractAddress
REACT_APP_CORE_ADDRESS=0xYourSavingCoreContractAddress
```

Then in `App.js`:
```javascript
const USDC_ADDRESS = process.env.REACT_APP_USDC_ADDRESS;
const CORE_ADDRESS = process.env.REACT_APP_CORE_ADDRESS;
```

### 4. Run Development Server
```bash
npm start
```
The app will open at http://localhost:3000

## Features Implemented

### 1. **Wallet Connection**
- Connect/disconnect MetaMask wallet
- Display connected address and USDC balance
- Real-time balance updates every 30 seconds

### 2. **View Available Plans**
- Fetch plan details from SavingCore contract (Plan #1)
- Display Tenor (days), APR (%), Min/Max deposit, and penalty rate

### 3. **Open Deposit**
- Input field to specify deposit amount
- 2-step transaction process:
  1. Approve USDC spending
  2. Call openDeposit() with approval confirmed
- Validates amount against plan limits
- Auto-refresh balances after successful deposit

### 4. **View Active Deposits**
- Loop through deposits and filter user's deposits by ownerOf()
- Display:
  - Deposit ID
  - Principal amount (formatted from 6 decimals)
  - Status (Active, Withdrawn, ManualRenewed, AutoRenewed)
  - Maturity date (converted from Unix timestamp)
  - APR percentage
- Smart action buttons based on maturity status

### 5. **Deposit Actions**
Three buttons per deposit:
- **Withdraw at Maturity**: Available after maturity date - calls withdrawAtMaturity()
- **Early Withdraw**: Available before maturity - calls earlyWithdraw() with penalty confirmation
- **Renew**: Available at/after maturity - calls renewDeposit()

### 6. **Error Handling**
- Try-catch wrappers on all ethers.js calls
- User-friendly error alerts showing transaction revert reasons
- Console logging for debugging
- Validation for input amounts
- MetaMask installation check

## Code Structure

```
App.js
├── Constants & ABIs
│   ├── Contract Addresses
│   └── Contract ABIs
├── Utility Functions
│   ├── formatBalance()
│   ├── formatTimestamp()
│   └── shortenAddress()
└── Main Component
    ├── State Variables
    ├── connectWallet()
    ├── fetchUSDCBalance()
    ├── fetchPlans()
    ├── fetchUserDeposits()
    ├── handleOpenDeposit()
    ├── handleWithdrawAtMaturity()
    ├── handleEarlyWithdraw()
    ├── handleRenewDeposit()
    ├── Auto-refresh Effect
    └── JSX Rendering
```

## Contract Function Calls

### MockUSDC Functions
- `approve(spender, amount)` - Approve spending
- `balanceOf(account)` - Get user balance
- `decimals()` - Get token decimals (6)

### SavingCore Functions
- `plans(planId)` - Fetch plan details
- `deposits(depositId)` - Fetch deposit info
- `nextDepositId()` - Get next deposit ID
- `ownerOf(tokenId)` - Check NFT ownership
- `openDeposit(planId, amount)` - Create new deposit
- `withdrawAtMaturity(depositId)` - Withdraw at maturity
- `earlyWithdraw(depositId)` - Withdraw before maturity
- `renewDeposit(oldDepositId, newPlanId)` - Renew deposit

## Important Notes

### 1. Plan ID Selection
Currently set to fetch Plan #1. If you have multiple plans, modify the fetchPlans() function:
```javascript
// Fetch multiple plans
for (let planId = 1; planId <= maxPlanId; planId++) {
  const planData = await coreContract.plans(planId);
  // ...
}
```

### 2. Decimal Handling
- MockUSDC uses 6 decimals (standard for USDC)
- All amounts are converted using ethers.parseUnits() and ethers.formatUnits()

### 3. Timestamp Conversion
- SavingCore stores maturity as Unix timestamp (seconds)
- Frontend converts to readable date using JavaScript Date object
- Maturity check: `block.timestamp >= maturityAt`

### 4. Deposit Enumeration
- Since contracts don't use ERC721Enumerable, deposits are fetched by:
  1. Getting `nextDepositId` to know the range
  2. Looping from 1 to nextDepositId - 1
  3. Checking ownership with `ownerOf(id)`
  4. Fetching deposit data if user owns it

### 5. Status Mapping
```
0 = Active
1 = Withdrawn
2 = ManualRenewed
3 = AutoRenewed
```

## Common Issues & Fixes

### "Cannot read property of undefined" for USDC/CORE addresses
- Ensure contract addresses are correctly set at the top of App.js
- Check network matches where contracts are deployed

### MetaMask not prompting to connect
- Check browser console for errors
- Ensure MetaMask is installed and unlocked
- Try refreshing the page

### Transaction reverts with "Not matured yet"
- For withdrawAtMaturity(), ensure the current timestamp >= maturity date
- For renewDeposit(), maturity must be reached first

### "Insufficient allowance" error
- The approve() transaction didn't complete before openDeposit() was called
- Add explicit wait() calls (already in the code) to ensure approvals are mined

## Styling
- Tailwind CSS utility classes used throughout
- Responsive grid layout (2 columns on desktop, 1 on mobile)
- Color-coded status badges and action buttons
- Gradient background with blue/indigo theme

## Development Tips

1. **Testing with Mock Data**: Set up local test values before connecting real contracts

2. **Gas Optimization**: Consider batching deposits or using multicall for gas efficiency

3. **UI Enhancements**: 
   - Add loading spinners instead of text
   - Implement toast notifications instead of alerts
   - Add transaction hash links to blockchain explorer

4. **Security**:
   - Always validate contract addresses
   - Check ABIs match deployed contracts
   - Never expose private keys in frontend

## Next Steps

1. Deploy your MockUSDC and SavingCore contracts
2. Copy contract addresses to App.js
3. Test with a small amount first
4. Consider adding web3-react for better wallet management in production

## Support

For errors or issues:
1. Check browser console (F12) for detailed error messages
2. Verify contract addresses and ABIs
3. Ensure contracts are deployed on the connected network
4. Check ethers.js v6 documentation: https://docs.ethers.org/v6/
