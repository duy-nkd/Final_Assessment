/* global BigInt */
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import AdminDashboard from './AdminDashboard';

// ==================== HARDCODED ADDRESSES ====================
const USDC_ADDRESS = process.env.REACT_APP_USDC_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CORE_ADDRESS = process.env.REACT_APP_CORE_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const VAULT_ADDRESS = process.env.REACT_APP_VAULT_ADDRESS || "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const ADMIN_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

// ==================== CONTRACT ABIs ====================
const USDC_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function mint(address to, uint256 amount) external"
];

const CORE_ABI = [
  "function plans(uint256 planId) public view returns (uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 earlyWithdrawPenaltyBps, bool enabled)",
  "function deposits(uint256 depositId) public view returns (uint256 planId, uint256 principal, uint256 startTimestamp, uint256 maturityAt, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen, uint8 status)",
  "function nextDepositId() public view returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function openDeposit(uint256 planId, uint256 amount) external",
  "function withdrawAtMaturity(uint256 depositId) external",
  "function earlyWithdraw(uint256 depositId) external",
  "function renewDeposit(uint256 oldDepositId, uint256 newPlanId) external",
  "function autoWithdrawDeposit(uint256 depositId) external"
];

// 📊 VaultManager ABI
const VAULT_ABI = [
  "function getPenaltyBalance() external view returns (uint256)",
  "function getFeeReceiver() external view returns (address)"
];

// ==================== UTILITY FUNCTIONS ====================
const formatBalance = (balance, decimals = 6) => {
  return ethers.formatUnits(balance, decimals);
};

const formatTimestamp = (timestamp) => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const shortenAddress = (address) => {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
};

// ==================== MAIN APP COMPONENT ====================
function App() {
  // ============= STATE VARIABLES =============
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [usdcBalance, setUsdcBalance] = useState('0'); // Start with "0", not hardcoded
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Available Plans State
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Active Deposits State
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  // 📊 Penalty Tracking State
  const [totalPenalty, setTotalPenalty] = useState('0');

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(1);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [activeTab, setActiveTab] = useState('user');

  // Action Buttons State
  const [loadingActionId, setLoadingActionId] = useState(null);
  const isAdmin = userAddress && userAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  // ============= WALLET CONNECTION =============
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('MetaMask is not installed');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();
      const address = accounts[0];

      console.log('🔗 Wallet Connected!');
      console.log('📍 Connected Address:', address);
      console.log('📍 USDC Contract:', USDC_ADDRESS);
      console.log('📍 CORE Contract:', CORE_ADDRESS);

      setProvider(newProvider);
      setSigner(newSigner);
      setUserAddress(address);
      setWalletConnected(true);

      // Fetch USDC balance
      await fetchUSDCBalance(newProvider, address);

      // Fetch plans, deposits, and penalty balance
      await fetchPlans(newProvider);
      await fetchUserDeposits(newProvider, address);
      await fetchPenaltyBalance(newProvider);
    } catch (error) {
      console.error('❌ Wallet connection error:', error);
      console.error('   Error message:', error.message);
      alert(`Failed to connect wallet: ${error.message}`);
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setUserAddress('');
    setUsdcBalance('0');
    setProvider(null);
    setSigner(null);
    setPlans([]);
    setDeposits([]);
    setActiveTab('user');
  };

  // ============= FETCH USDC BALANCE =============
  const fetchUSDCBalance = async (prov, address) => {
    try {
      console.log('📊 Fetching USDC balance for:', address);
      console.log('📍 USDC Contract Address:', USDC_ADDRESS);

      // Check network
      const network = await prov.getNetwork();
      console.log('🌐 Connected Network:', network.name, '(ChainID:', network.chainId + ')');

      // Check contract code
      const code = await prov.getCode(USDC_ADDRESS);
      console.log('📝 Contract code exists:', code !== '0x');

      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, prov);
      const balance = await usdcContract.balanceOf(address, { blockTag: 'latest' });
      const formattedBalance = formatBalance(balance, 6);

      console.log('✅ USDC Balance fetched:', formattedBalance, 'for address:', address);
      setUsdcBalance(formattedBalance);
    } catch (error) {
      console.error('❌ Error fetching USDC balance:', error);
      console.error('   Error message:', error.message);
      console.error('   Contract Address:', USDC_ADDRESS);
      console.error('   Full error:', error);

      // Attempt detailed check
      try {
        const network = await prov.getNetwork();
        const code = await prov.getCode(USDC_ADDRESS);
        console.log('🔍 Debug Info:');
        console.log('   Network:', network.name, 'ChainID:', network.chainId);
        console.log('   Contract exists at address:', code !== '0x');
      } catch (debugError) {
        console.error('   Debug error:', debugError.message);
      }

      setUsdcBalance('0');
      alert(`❌ Balance fetch error:\n\nAddress: ${USDC_ADDRESS}\n\nError: ${error.message}\n\nPlease open Console (F12) to see debug info`);
    }
  };

  // ============= MINT USDC FOR TESTING =============
  const handleMintUSTC = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const amount = prompt('Enter amount to mint (in USDC, e.g., 1000):');
      if (!amount || parseFloat(amount) <= 0) {
        alert('Invalid amount');
        return;
      }

      const amountInWei = ethers.parseUnits(amount, 6);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      console.log('🪙 Minting', amount, 'USDC...');
      const tx = await usdcContract.mint(userAddress, amountInWei);
      const receipt = await tx.wait();

      console.log('✅ Mint successful:', receipt.transactionHash);
      alert(`Successfully minted ${amount} USDC`);

      // Refresh balance
      await fetchUSDCBalance(provider, userAddress);
    } catch (error) {
      console.error('❌ Error minting USDC:', error);
      alert(`Mint error: ${error.reason || error.message}`);
    }
  };

  // ============= FETCH PLANS =============
  const fetchPlans = async (prov) => {
    try {
      setLoadingPlans(true);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, prov);

      // For this example, fetch plan 1. Adjust loop if you have multiple plans.
      const planData = await coreContract.plans(1, { blockTag: 'latest' });

      if (planData.enabled) {
        const plan = {
          id: 1,
          tenor: parseInt(planData.tenorDays),
          apr: parseInt(planData.aprBps) / 100, // Convert bps to %
          minDeposit: formatBalance(planData.minDeposit, 6),
          maxDeposit: planData.maxDeposit === 0n ? 'Unlimited' : formatBalance(planData.maxDeposit, 6),
          penaltyBps: parseInt(planData.earlyWithdrawPenaltyBps)
        };
        setPlans([plan]);
      }
      setLoadingPlans(false);
    } catch (error) {
      console.error('Error fetching plans:', error);
      setLoadingPlans(false);
    }
  };

  // ============= FETCH USER DEPOSITS =============
  const fetchUserDeposits = async (prov, address) => {
    try {
      setLoadingDeposits(true);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, prov);

      // Get current block timestamp from blockchain (not local machine time)
      const latestBlock = await prov.getBlock('latest');
      const currentTimestamp = latestBlock.timestamp;

      // Get next deposit ID to know the range
      const nextDepositId = await coreContract.nextDepositId({ blockTag: 'latest' });

      // Create list of IDs to check
      const ids = Array.from({ length: Number(nextDepositId) - 1 }, (_, i) => i + 1);

      // Fetch all owners in parallel to increase speed
      const owners = await Promise.all(
        ids.map(id => coreContract.ownerOf(id, { blockTag: 'latest' }).catch(() => null))
      );

      // Filter IDs belonging to the user
      const userIds = ids.filter((id, index) => owners[index] && owners[index].toLowerCase() === address.toLowerCase());

      // Fetch deposit data in parallel
      const depositResults = await Promise.all(
        userIds.map(id => coreContract.deposits(id, { blockTag: 'latest' }))
      );

      const statusEnum = ['Active', 'Withdrawn', 'ManualRenewed', 'AutoRenewed'];
      const userDeposits = depositResults.map((data, index) => ({
        id: userIds[index],
        principal: formatBalance(data.principal, 6),
        status: statusEnum[parseInt(data.status)],
        maturityDate: formatTimestamp(data.maturityAt),
        maturityTimestamp: parseInt(data.maturityAt),
        aprBps: parseInt(data.aprBpsAtOpen),
        penaltyBps: parseInt(data.penaltyBpsAtOpen),
        isMatured: currentTimestamp >= parseInt(data.maturityAt)
      }));

      // Sort newest IDs first so user sees renewal results immediately
      userDeposits.sort((a, b) => b.id - a.id);

      setDeposits(userDeposits);
      setLoadingDeposits(false);
    } catch (error) {
      console.error('Error fetching user deposits:', error);
      setLoadingDeposits(false);
    }
  };

  // ============= FETCH PENALTY BALANCE =============
  const fetchPenaltyBalance = async (prov) => {
    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, prov);
      const penaltyBalance = await vaultContract.getPenaltyBalance({ blockTag: 'latest' });
      const formatted = formatBalance(penaltyBalance, 6);

      console.log('📊 Total Penalty Collected:', formatted);
      setTotalPenalty(formatted);
    } catch (error) {
      console.error('Error fetching penalty balance:', error);
    }
  };

  // ============= OPEN DEPOSIT (2-STEP TRANSACTION) =============
  const handleOpenDeposit = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setLoadingDeposit(true);

      // Parse amount to wei (6 decimals for USDC)
      const amountInWei = ethers.parseUnits(depositAmount, 6);

      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);

      // Step 1: Approve USDC spending
      console.log('Step 1: Approving USDC...');
      const approveTx = await usdcContract.approve(CORE_ADDRESS, amountInWei);
      const approveReceipt = await approveTx.wait();
      console.log('Approve transaction confirmed:', approveReceipt.transactionHash);

      // Step 2: Open deposit
      console.log('Step 2: Opening deposit...');
      const depositTx = await coreContract.openDeposit(selectedPlanId, amountInWei);
      const depositReceipt = await depositTx.wait();
      console.log('Deposit transaction confirmed:', depositReceipt.transactionHash);

      alert('Deposit opened successfully!');
      setDepositAmount('');

      // Refresh balance and deposits
      await fetchUSDCBalance(provider, userAddress);
      await fetchUserDeposits(provider, userAddress);
      setLoadingDeposit(false);
    } catch (error) {
      console.error('Error opening deposit:', error);
      alert(`Error: ${error.reason || error.message}`);
      setLoadingDeposit(false);
    }
  };

  // ============= WITHDRAW AT MATURITY =============
  const handleWithdrawAtMaturity = async (depositId) => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      setLoadingActionId(depositId);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);

      console.log('Withdrawing at maturity for deposit:', depositId);
      const tx = await coreContract.withdrawAtMaturity(depositId);
      const receipt = await tx.wait();
      console.log('Withdraw transaction confirmed:', receipt.transactionHash);

      alert('Withdrawal successful!');

      // Refresh deposits, balance, and penalty vault
      await fetchUSDCBalance(provider, userAddress);
      await fetchUserDeposits(provider, userAddress);
      await fetchPenaltyBalance(provider);
      setLoadingActionId(null);
    } catch (error) {
      console.error('Error withdrawing at maturity:', error);
      alert(`Error: ${error.reason || error.message}`);
      setLoadingActionId(null);
    }
  };

  // ============= CALCULATE PENALTY =============
  const calculatePenalty = (principal, penaltyBps) => {
    const principalWei = ethers.parseUnits(principal, 6);
    const penaltyAmountWei = (principalWei * BigInt(penaltyBps)) / 10000n;
    const amountReceivedWei = principalWei - penaltyAmountWei;
    const amountReceived = ethers.formatUnits(amountReceivedWei, 6);
    const penaltyAmount = ethers.formatUnits(penaltyAmountWei, 6);
    const principalFormatted = ethers.formatUnits(principalWei, 6);
    return {
      principal: principalFormatted,
      penaltyBps: penaltyBps,
      penaltyPercent: penaltyBps / 100,
      penaltyAmount: penaltyAmount,
      amountReceived: amountReceived
    };
  };

  // ============= EARLY WITHDRAW =============
  const handleEarlyWithdraw = async (depositId) => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      // Find deposit to calculate penalty
      const deposit = deposits.find(d => d.id === depositId);
      if (!deposit) {
        alert('Deposit not found');
        return;
      }

      console.log('🔍 Current USDC Balance before early withdraw:', usdcBalance);

      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);

      console.log('🔍 Debug Early Withdraw Info:');
      console.log('   Deposit ID:', depositId);
      console.log('   Principal:', deposit.principal);
      console.log('   PenaltyBps from state:', deposit.penaltyBps);
      console.log('   APRBps from state:', deposit.aprBps);

      // Read directly from contract
      const depositData = await provider.call({
        to: CORE_ADDRESS,
        data: coreContract.interface.encodeFunctionData('deposits', [depositId])
      }).catch(() => null);

      console.log('   Raw contract data:', depositData);

      // Calculate detailed penalty (using correct penaltyBps)
      const penalty = calculatePenalty(deposit.principal, deposit.penaltyBps);

      console.log('💰 Calculated Penalty:', penalty);

      // Improve confirm dialog with penalty details
      const confirmMessage = `⚠️ EARLY WITHDRAW - PENALTY FEE
 
📊 Withdrawal Details:
━━━━━━━━━━━━━━━━━━━━
💰 Principal amount: $${parseFloat(penalty.principal).toFixed(2)}
📉 Penalty fee: ${penalty.penaltyPercent.toFixed(2)}% = -$${parseFloat(penalty.penaltyAmount).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
✅ You will receive: $${parseFloat(penalty.amountReceived).toFixed(2)}
 
❓ Confirm early withdrawal?`;

      const confirmWithdraw = window.confirm(confirmMessage);
      if (!confirmWithdraw) return;

      setLoadingActionId(depositId);

      console.log('Early withdrawing deposit:', depositId);
      console.log('Penalty details:', penalty);
      const tx = await coreContract.earlyWithdraw(depositId);
      const receipt = await tx.wait();
      console.log('Early withdraw transaction confirmed:', receipt?.transactionHash);

      const txHash = receipt?.transactionHash ? receipt.transactionHash.slice(0, 10) + '...' : 'Pending';
      alert(`✅ EARLY WITHDRAW SUCCESSFUL!

📊 Transaction Details:
━━━━━━━━━━━━━━━━━━━━
💵 Principal amount: $${parseFloat(penalty.principal).toFixed(2)}
📉 Penalty fee: -$${parseFloat(penalty.penaltyAmount).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
🎯 Received: $${parseFloat(penalty.amountReceived).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━

📝 TX Hash: ${txHash}`);

      console.log('🔄 Refreshing balance after early withdraw...');

      // Refresh balance, deposits and penalty vault
      await fetchUSDCBalance(provider, userAddress);
      await fetchUserDeposits(provider, userAddress);
      await fetchPenaltyBalance(provider);
      setLoadingActionId(null);
    } catch (error) {
      console.error('Error during early withdraw:', error);
      alert(`❌ Withdrawal Error: ${error.reason || error.message}`);
      setLoadingActionId(null);
    }
  };

  // ============= RENEW DEPOSIT =============
  const handleRenewDeposit = async (depositId) => {
    if (!signer && provider) {
      const newSigner = await provider.getSigner();
      setSigner(newSigner);
    }
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      setLoadingActionId(depositId);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);

      console.log('Renewing deposit:', depositId);
      const tx = await coreContract.renewDeposit(depositId, selectedPlanId);
      const receipt = await tx.wait();
      console.log('Renew transaction confirmed:', receipt.transactionHash);

      alert('Deposit renewed successfully!');

      // Refresh balance, deposits, and penalty vault
      await fetchUSDCBalance(provider, userAddress);
      await fetchUserDeposits(provider, userAddress);
      await fetchPenaltyBalance(provider);
      setLoadingActionId(null);
    } catch (error) {
      console.error('Error renewing deposit:', error);
      alert(`Error: ${error.reason || error.message}`);
      setLoadingActionId(null);
    }
  };

  // ============= FETCH DATA WHEN WALLET CHANGES =============
  useEffect(() => {
    if (walletConnected && provider && userAddress) {
      fetchUSDCBalance(provider, userAddress);
      fetchPlans(provider);
      fetchUserDeposits(provider, userAddress);
      fetchPenaltyBalance(provider);
    }
  }, [userAddress, walletConnected, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============= AUTO-REFRESH DATA =============
  useEffect(() => {
    if (walletConnected && provider) {
      const interval = setInterval(() => {
        fetchUserDeposits(provider, userAddress);
        fetchPenaltyBalance(provider);
      }, 20000); // Refresh every 10 seconds (was 30s)

      return () => clearInterval(interval);
    }
  }, [walletConnected, provider, userAddress]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('user');
    }
  }, [isAdmin, activeTab]);

  // ============= RENDER =============
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ===== HEADER ===== */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Online Banking System</h1>
          {walletConnected ? (
            <div className="text-right">
              <p className="text-sm text-gray-600">Connected: {shortenAddress(userAddress)}</p>
              <button
                onClick={disconnectWallet}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition shadow-lg"
            >
              Connect MetaMask
            </button>
          )}
        </div>

        {!walletConnected ? (
          <div className="bg-white rounded-lg p-8 shadow-lg text-center">
            <p className="text-xl text-gray-600 mb-4">Please connect your MetaMask wallet to get started</p>
          </div>
        ) : (
          <>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('user')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  User View
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'admin'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  Admin Panel
                </button>
              </div>
            )}

            {activeTab === 'admin' && isAdmin ? (
              <>
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-6 shadow-lg mb-6 border-2 border-orange-200">
                  <h2 className="text-2xl font-bold text-orange-900 mb-2">💰 Admin Penalty Vault</h2>
                  <p className="text-3xl font-bold text-orange-600">${parseFloat(totalPenalty).toFixed(2)} mUSDC</p>
                  <p className="text-sm text-orange-700 mt-2">Total penalties collected from early withdrawals</p>
                  <button
                    onClick={() => fetchPenaltyBalance(provider)}
                    className="mt-4 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition"
                  >
                    🔄 Refresh Penalty Balance
                  </button>
                </div>

                <AdminDashboard
                  connectedWallet={userAddress}
                  provider={provider}
                  signer={signer}
                  onRefreshNeeded={() => fetchPenaltyBalance(provider)}
                />
              </>
            ) : (
              <>
                {/* ===== USER BALANCE ===== */}
                <div className="bg-white rounded-lg p-6 shadow-lg mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Balance</h2>
                  <p className="text-3xl font-bold text-indigo-600">${parseFloat(usdcBalance).toFixed(2)} mUSDC</p>
                  <button
                    onClick={handleMintUSTC}
                    className="mt-4 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition mr-2"
                  >
                    🪙 Mint USDC (Test)
                  </button>
                  <button
                    onClick={() => fetchUSDCBalance(provider, userAddress)}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
                  >
                    🔄 Refresh Balance
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* ===== VIEW AVAILABLE PLANS ===== */}
                  <div className="bg-white rounded-lg p-6 shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Plans</h2>
                    {loadingPlans ? (
                      <p className="text-gray-600">Loading plans...</p>
                    ) : plans.length === 0 ? (
                      <p className="text-gray-600">No plans available</p>
                    ) : (
                      <div className="space-y-3">
                        {plans.map((plan) => (
                          <div key={plan.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold text-gray-900">Plan #{plan.id}</h3>
                              <span className="text-lg font-bold text-green-600">{plan.apr}% APR</span>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Tenor: {plan.tenor} days</p>
                              <p>Min Deposit: ${parseFloat(plan.minDeposit).toFixed(2)}</p>
                              <p>Max Deposit: ${plan.maxDeposit === 'Unlimited' ? 'Unlimited' : parseFloat(plan.maxDeposit).toFixed(2)}</p>
                              <p>Early Withdrawal Penalty: {(plan.penaltyBps / 100).toFixed(2)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ===== OPEN A DEPOSIT ===== */}
                  <div className="bg-white rounded-lg p-6 shadow-lg">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Open a Deposit</h2>
                    {plans.length > 0 && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Plan</label>
                          <select
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                Plan {plan.id} - {plan.apr}% APR, {plan.tenor} days
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (mUSDC)</label>
                          <input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="Enter amount"
                            step="0.01"
                            min="0"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          onClick={handleOpenDeposit}
                          disabled={loadingDeposit || !depositAmount}
                          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition"
                        >
                          {loadingDeposit ? 'Processing...' : 'Open Deposit'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== ACTIVE DEPOSITS ===== */}
                <div className="bg-white rounded-lg p-6 shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Your Deposits</h2>
                  <button
                    onClick={() => fetchUserDeposits(provider, userAddress)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                  >
                    🔄 Refresh
                  </button>
                  </div>

                  {loadingDeposits ? (
                    <div className="text-center py-8">
                    <p className="text-gray-600 text-lg">Loading deposits...</p>
                    </div>
                  ) : deposits.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <p className="text-gray-600 text-lg">📭 You don't have any deposits yet</p>
                      <p className="text-gray-500 mt-2">Create your first deposit in the "Open Deposit" section</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deposits.map((deposit) => (
                        <div
                          key={deposit.id}
                          className="border-2 border-gray-200 rounded-lg p-5 hover:border-indigo-400 transition bg-gradient-to-br from-white to-gray-50"
                        >
                          {/* Header */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">
                                🏦 Deposit #{deposit.id}
                              </h3>
                              <p className="text-sm text-gray-600 mt-1">
                                {deposit.status === 'Active'
                                  ? '✅ Active'
                                  : deposit.status === 'Withdrawn'
                                    ? '✅ Withdrawn'
                                    : '🔄 ' + deposit.status}
                              </p>
                            </div>
                            <span
                              className={`px-4 py-2 rounded-full font-semibold text-sm ${deposit.status === 'Active'
                                ? 'bg-green-100 text-green-800'
                                : deposit.status === 'Withdrawn'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-blue-100 text-blue-800'
                                }`}
                            >
                              {deposit.status === 'ManualRenewed' ? 'Renewed' : deposit.status}
                            </span>
                          </div>

                          {/* Details Grid */}
                          <div className="grid md:grid-cols-4 gap-4 mb-4 py-3 border-y border-gray-200">
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">💰 Principal Amount</p>
                              <p className="text-xl font-bold text-indigo-600 mt-1">${parseFloat(deposit.principal).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">📊 Interest Rate (APR)</p>
                              <p className="text-xl font-bold text-green-600 mt-1">
                                {(deposit.aprBps / 100).toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">📅 Maturity Date</p>
                              <p className="text-sm text-gray-900 mt-1">{deposit.maturityDate}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">⏰ Status</p>
                              <p className={`text-sm font-semibold mt-1 ${deposit.isMatured
                                ? 'text-red-600'
                                : 'text-amber-600'
                                }`}>
                                {deposit.isMatured ? '🔓 Matured' : '🔒 Not matured'}
                              </p>
                            </div>
                          </div>

                          {/* Penalty Info for Active Deposits */}
                          {deposit.status === 'Active' && !deposit.isMatured && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 mb-4 rounded">
                              <p className="text-xs text-orange-600 font-semibold">⚠️ Early Withdrawal Fee</p>
                              <p className="text-sm text-orange-700 mt-1">
                                Early withdrawal will be deducted <span className="font-bold">{(deposit.penaltyBps / 100).toFixed(2)}%</span> = <span className="font-bold">${(parseFloat(deposit.principal) * deposit.penaltyBps / 10000).toFixed(2)}</span>
                              </p>
                              <p className="text-xs text-orange-600 mt-1">
                                You will receive: ${(parseFloat(deposit.principal) - parseFloat(deposit.principal) * deposit.penaltyBps / 10000).toFixed(2)}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          {deposit.status === 'Active' ? (
                            <div className="flex flex-wrap gap-3">
                              {deposit.isMatured ? (
                                <>
                                  <button
                                    onClick={() => handleWithdrawAtMaturity(deposit.id)}
                                    disabled={loadingActionId === deposit.id}
                                    className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                                  >
                                    {loadingActionId === deposit.id ? (
                                      <>⏳ Processing...</>
                                    ) : (
                                      <>✅ Withdraw at Maturity (Principal + Interest)</>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleRenewDeposit(deposit.id)}
                                    disabled={loadingActionId === deposit.id}
                                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                                  >
                                    {loadingActionId === deposit.id ? (
                                      <>⏳ Processing...</>
                                    ) : (
                                      <>🔄 Renew (Reinvest)</>
                                    )}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEarlyWithdraw(deposit.id)}
                                    disabled={loadingActionId === deposit.id}
                                    className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                                  >
                                    {loadingActionId === deposit.id ? (
                                      <>⏳ Processing...</>
                                    ) : (
                                      <>⚡ Early Withdraw (With Penalty)</>
                                    )}
                                  </button>
                                  <button
                                    disabled
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed"
                                  >
                                    🔒 Renew (Not Matured)
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-3 text-center">
                              <p className="text-gray-700 font-semibold">
                                {deposit.status === 'Withdrawn'
                                  ? '✅ This deposit has been withdrawn'
                                  : '🔄 This deposit has been ' + deposit.status}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
