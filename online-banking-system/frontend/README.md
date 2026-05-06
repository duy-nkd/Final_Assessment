# Online Banking System - React Frontend

A complete, production-ready React.js frontend for interacting with the Online Banking Smart Contracts using ethers.js v6 and Tailwind CSS.

## 🎯 Overview

This application provides a user-friendly interface for:
- **Wallet Connection** - Connect MetaMask and view your balance
- **Deposit Plans** - Browse available saving plans with different APRs and tenors
- **Create Deposits** - Open new deposits with a 2-step approval process
- **Manage Deposits** - Track your deposits with real-time status updates
- **Withdrawal Options** - Withdraw at maturity or early (with penalty)
- **Renewal** - Automatically renew deposits with compound interest

## 📁 Project Structure

```
frontend/
├── public/
│   └── index.html                    # HTML entry point
├── src/
│   ├── App.js                        # Main application component (1000+ lines)
│   ├── index.js                      # React DOM render
│   └── index.css                     # Tailwind CSS imports
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── package.json                      # Dependencies and scripts
├── tailwind.config.js                # Tailwind configuration
├── postcss.config.js                 # PostCSS configuration
├── SETUP_GUIDE.md                    # Detailed setup instructions
├── QUICK_START.md                    # Quick start checklist
├── ABI_REFERENCE.md                  # Contract ABIs documentation
├── ERROR_HANDLING_GUIDE.md           # Error handling and testing
└── README.md                         # This file
```

## ✨ Features

### 1. **Wallet Connection**
- MetaMask integration using ethers.js BrowserProvider
- Display connected wallet address (shortened)
- Show real-time USDC balance
- Disconnect and reconnect functionality
- Auto-refresh balance every 30 seconds

### 2. **Available Plans**
- Fetch plan details from SavingCore contract
- Display plan information:
  - Tenor (duration in days)
  - APR (Annual Percentage Rate)
  - Min/Max deposit limits
  - Early withdrawal penalty percentage

### 3. **Open Deposits**
- Select plan from dropdown
- Enter deposit amount
- Validation against plan limits
- **2-Step Transaction Process:**
  1. Approve USDC spending via MockUSDC.approve()
  2. Execute openDeposit() on SavingCore contract
- Auto-refresh balance and deposits after success

### 4. **View Active Deposits**
- Enumeration: Loop from 1 to nextDepositId-1
- Ownership check: ownerOf(id) == userAddress
- Display for each deposit:
  - Deposit ID
  - Principal amount (formatted from 6 decimals)
  - Current status
  - Maturity date (Unix timestamp converted to readable format)
  - APR percentage
  - Action buttons based on status

### 5. **Deposit Actions**
Three context-aware buttons per deposit:

| Action | Available When | Function | Outcome |
|--------|---|----------|---------|
| **Withdraw** | Deposit matured | `withdrawAtMaturity()` | Receive principal + interest |
| **Early Withdraw** | Before maturity | `earlyWithdraw()` | Receive principal - penalty |
| **Renew** | At/after maturity | `renewDeposit()` | Create new deposit with compounded interest |

### 6. **Error Handling**
- Try-catch blocks on all async operations
- User-friendly error messages via alerts
- Console logging for debugging
- Validation for all user inputs
- MetaMask availability check
- Transaction wait confirmation

### 7. **User Experience**
- Responsive design (mobile, tablet, desktop)
- Loading states on buttons
- Disabled states during transactions
- Gradient background with modern styling
- Color-coded status badges
- Tailwind CSS utility classes

## 🚀 Quick Start

### Prerequisites
```bash
# Check Node.js version (v16+)
node --version

# Check npm version
npm --version

# Install MetaMask browser extension
# Deploy smart contracts and note addresses
```

### Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your contract addresses
# REACT_APP_USDC_ADDRESS=0x...
# REACT_APP_CORE_ADDRESS=0x...

# Start development server
npm start
```

The app will open at **http://localhost:3000**

## 📝 Configuration

### Update Contract Addresses

**Option 1: Using Environment Variables**
```bash
# .env file
REACT_APP_USDC_ADDRESS=0xYourMockUSDCAddress
REACT_APP_CORE_ADDRESS=0xYourSavingCoreAddress
```

Then import in App.js:
```javascript
const USDC_ADDRESS = process.env.REACT_APP_USDC_ADDRESS;
const CORE_ADDRESS = process.env.REACT_APP_CORE_ADDRESS;
```

**Option 2: Direct in Code**
```javascript
// App.js (top of file)
const USDC_ADDRESS = "0xYourMockUSDCAddress";
const CORE_ADDRESS = "0xYourSavingCoreAddress";
```

### Configure Network
Update MetaMask to correct network:
- Localhost (for local testing): http://localhost:8545
- Sepolia Testnet
- Ethereum Mainnet
- Custom network

## 🔧 Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI Framework | 18.2.0 |
| **ethers.js** | Web3 Integration | 6.10.0 |
| **Tailwind CSS** | Styling | 3.3.0 |
| **MetaMask** | Wallet Connection | Latest |

## 📚 Contract Integration

### Supported Functions

#### MockUSDC (ERC20)
```javascript
approve(spender, amount)      // Approve spending
balanceOf(account)             // Check balance
decimals()                     // Get decimals (6)
transfer(to, amount)           // Transfer tokens
```

#### SavingCore (ERC721)
```javascript
// Read Functions
plans(planId)                  // Get plan details
deposits(depositId)            // Get deposit info
nextDepositId()                // Get next ID
ownerOf(tokenId)               // Check ownership

// Write Functions
openDeposit(planId, amount)   // Create deposit
withdrawAtMaturity(depositId)  // Withdraw at maturity
earlyWithdraw(depositId)       // Early withdrawal
renewDeposit(oldId, newPlanId) // Renew deposit
```

## 🎨 UI Components

### Main Sections
1. **Header**
   - Title
   - Wallet connection/disconnect button
   - Connected address display

2. **Balance Card**
   - Shows user's USDC balance
   - Real-time updates

3. **Plans Section**
   - Lists available deposit plans
   - Shows APR, tenor, limits

4. **Deposit Form**
   - Amount input
   - Plan selector
   - Open deposit button

5. **Active Deposits Table**
   - Scrollable deposit list
   - Status indicators
   - Action buttons
   - Real-time updates

## 🔐 Security Features

- MetaMask handles private key management
- No sensitive data stored locally
- All transactions require wallet confirmation
- Error messages don't expose sensitive info
- Contract addresses hardcoded (not from user input)

## 🧪 Testing

### Test Workflow
```javascript
// 1. Connect wallet
// 2. Check available plans
// 3. Open a deposit
// 4. Check USDC balance decreased
// 5. Wait for maturity or test early withdrawal
// 6. Withdraw and verify balance increase
// 7. Test renewal
```

### Test With Local Network
```bash
# Terminal 1: Run local blockchain
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Run frontend
npm start
```

Connect MetaMask to `localhost:8545`

## 📖 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed installation and configuration
- **[QUICK_START.md](./QUICK_START.md)** - Quick start checklist
- **[ABI_REFERENCE.md](./ABI_REFERENCE.md)** - Contract ABIs and usage examples
- **[ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md)** - Error handling and testing

## 🐛 Troubleshooting

### MetaMask Not Connecting
```javascript
// Check if MetaMask is installed
if (!window.ethereum) {
  alert('MetaMask not found');
}

// Check browser console for detailed errors
```

### Contract Not Found
- Verify contract address in `.env` or `App.js`
- Check you're on correct network
- Verify contract is deployed at address

### Balance Not Updating
- Refresh browser
- Check network connection
- Ensure transactions are confirmed

See **[ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md)** for more issues and solutions.

## 🚢 Production Deployment

### Build Optimized Bundle
```bash
npm run build
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
# Follow prompts, set environment variables
```

### Deploy to Netlify
```bash
npm run build
# Drag 'build' folder to Netlify
# Set environment variables in dashboard
```

### Environment Variables for Production
Set in hosting platform dashboard:
```
REACT_APP_USDC_ADDRESS=0x...
REACT_APP_CORE_ADDRESS=0x...
```

## 📊 Performance

- Auto-refresh every 30 seconds (configurable)
- Lazy loading for deposits (show on demand)
- Efficient contract calls using view functions
- Minimal re-renders using React hooks
- Tailwind CSS pure CSS (no runtime overhead)

## 🔄 State Management

Uses React Hooks (useState, useEffect):
- `walletConnected` - Connection state
- `userAddress` - Connected wallet address
- `usdcBalance` - Current USDC balance
- `plans` - Available deposit plans
- `deposits` - User's active deposits
- `loadingDeposit` - Form submission state
- `loadingActionId` - Action button state

## 🎓 Learning Resources

- **ethers.js v6 Docs**: https://docs.ethers.org/v6/
- **React Hooks**: https://react.dev/reference/react/hooks
- **Tailwind CSS**: https://tailwindcss.com/docs
- **MetaMask API**: https://docs.metamask.io/
- **Solidity**: https://docs.soliditylang.org/

## 📄 License

This frontend is part of the Online Banking System project.

## 🤝 Contributing

To contribute:
1. Clone repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## ✅ Checklist Before Going Live

- [ ] Contract addresses verified
- [ ] Network configuration correct
- [ ] All functions tested in testnet
- [ ] Error messages user-friendly
- [ ] MetaMask installation checked
- [ ] Balance updates working
- [ ] All 3 withdrawal options work
- [ ] Renewal creates new deposit correctly
- [ ] Build runs without errors: `npm run build`
- [ ] No console errors in production build
- [ ] Environment variables set on hosting
- [ ] Responsive design tested on mobile

## 📞 Support

For issues or questions:
1. Check documentation in this repo
2. Review error messages in browser console (F12)
3. Check block explorer for transaction details
4. Verify contract addresses and ABIs match deployment

---

**Built with ❤️ for Web3 Banking**

Last Updated: 2026

For the complete smart contract documentation, see the main project README.
