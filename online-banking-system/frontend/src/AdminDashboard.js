import React, { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';

const ADMIN_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

const USDC_ADDRESS = process.env.REACT_APP_USDC_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CORE_ADDRESS = process.env.REACT_APP_CORE_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const VAULT_ADDRESS = process.env.REACT_APP_VAULT_ADDRESS || "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";

const USDC_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)"
];

const CORE_ABI = [
  "function nextPlanId() public view returns (uint256)",
  "function plans(uint256 planId) public view returns (uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 earlyWithdrawPenaltyBps, bool enabled)",
  "function createPlan(uint256 tenorDays, uint256 aprBps, uint256 minDeposit, uint256 maxDeposit, uint256 earlyWithdrawPenaltyBps) external",
  "function updatePlan(uint256 planId, uint256 newAprBps) external",
  "function enablePlan(uint256 planId) external",
  "function disablePlan(uint256 planId) external"
];

const VAULT_ABI = [
  "function fundVault(uint256 amount) external",
  "function withdrawVault(uint256 amount) external",
  "function setFeeReceiver(address receiver) external",
  "function pause() external",
  "function unpause() external",
  "function paused() public view returns (bool)",
  "function getFeeReceiver() external view returns (address)"
];

const formatAmount = (value, decimals = 6) => {
  try {
    return ethers.formatUnits(value, decimals);
  } catch {
    return '0';
  }
};

const toAmount = (value, decimals = 6) => {
  if (!value || Number.isNaN(Number(value))) {
    return 0n;
  }
  return ethers.parseUnits(value, decimals);
};

function AdminDashboard({ connectedWallet, provider, signer }) {
  const isAdmin = useMemo(() => {
    if (!connectedWallet) return false;
    return connectedWallet.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  }, [connectedWallet]);

  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [vaultBalance, setVaultBalance] = useState('0');
  const [paused, setPaused] = useState(false);
  const [feeReceiver, setFeeReceiver] = useState('');

  const [createPlanForm, setCreatePlanForm] = useState({
    tenorDays: '',
    aprBps: '',
    minDeposit: '',
    maxDeposit: '',
    penaltyBps: ''
  });

  const [updatePlanForm, setUpdatePlanForm] = useState({
    planId: '',
    aprBps: ''
  });

  const [vaultForm, setVaultForm] = useState({
    fundAmount: '',
    withdrawAmount: ''
  });

  const [feeReceiverInput, setFeeReceiverInput] = useState('');

  const refreshAdminData = async () => {
    if (!provider) return;

    try {
      setLoadingPlans(true);
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, provider);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

      const nextPlanId = await coreContract.nextPlanId({ blockTag: 'latest' });
      const planItems = [];

      for (let i = 1; i < Number(nextPlanId); i += 1) {
        const planData = await coreContract.plans(i, { blockTag: 'latest' });
        planItems.push({
          id: i,
          tenor: Number(planData.tenorDays),
          aprBps: Number(planData.aprBps),
          minDeposit: formatAmount(planData.minDeposit),
          maxDeposit: planData.maxDeposit === 0n ? 'Unlimited' : formatAmount(planData.maxDeposit),
          penaltyBps: Number(planData.earlyWithdrawPenaltyBps),
          enabled: planData.enabled
        });
      }

      const balance = await usdcContract.balanceOf(VAULT_ADDRESS, { blockTag: 'latest' });
      const feeReceiverAddress = await vaultContract.getFeeReceiver({ blockTag: 'latest' });
      const pausedStatus = await vaultContract.paused({ blockTag: 'latest' });

      setPlans(planItems);
      setVaultBalance(formatAmount(balance));
      setFeeReceiver(feeReceiverAddress);
      setPaused(pausedStatus);
      setLoadingPlans(false);
    } catch (error) {
      console.error('Admin data refresh failed:', error);
      alert(`Admin refresh error: ${error.reason || error.message}`);
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      refreshAdminData();
    }
  }, [isAdmin, provider]);

  if (!isAdmin) {
    return null;
  }

  const handleCreatePlan = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);
      const tenorDays = Number(createPlanForm.tenorDays);
      const aprBps = Number(createPlanForm.aprBps);
      const minDeposit = toAmount(createPlanForm.minDeposit);
      const maxDeposit = createPlanForm.maxDeposit ? toAmount(createPlanForm.maxDeposit) : 0n;
      const penaltyBps = Number(createPlanForm.penaltyBps);

      if (!tenorDays || !aprBps || !penaltyBps || minDeposit <= 0n) {
        alert('Please fill in all required fields');
        return;
      }

      const tx = await coreContract.createPlan(
        tenorDays,
        aprBps,
        minDeposit,
        maxDeposit,
        penaltyBps
      );
      await tx.wait();

      alert('Plan created successfully');
      setCreatePlanForm({
        tenorDays: '',
        aprBps: '',
        minDeposit: '',
        maxDeposit: '',
        penaltyBps: ''
      });
      await refreshAdminData();
    } catch (error) {
      console.error('Create plan error:', error);
      alert(`Create plan error: ${error.reason || error.message}`);
    }
  };

  const handleUpdatePlan = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const planId = Number(updatePlanForm.planId);
      const aprBps = Number(updatePlanForm.aprBps);

      if (!planId || !aprBps) {
        alert('Please provide plan ID and APR');
        return;
      }

      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);
      const tx = await coreContract.updatePlan(planId, aprBps);
      await tx.wait();

      alert('Plan updated successfully');
      setUpdatePlanForm({ planId: '', aprBps: '' });
      await refreshAdminData();
    } catch (error) {
      console.error('Update plan error:', error);
      alert(`Update plan error: ${error.reason || error.message}`);
    }
  };

  const handleTogglePlan = async (shouldEnable) => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const planId = Number(updatePlanForm.planId);
      if (!planId) {
        alert('Please provide a plan ID');
        return;
      }

      const coreContract = new ethers.Contract(CORE_ADDRESS, CORE_ABI, signer);
      const tx = shouldEnable
        ? await coreContract.enablePlan(planId)
        : await coreContract.disablePlan(planId);
      await tx.wait();

      alert(`Plan ${shouldEnable ? 'enabled' : 'disabled'} successfully`);
      await refreshAdminData();
    } catch (error) {
      console.error('Toggle plan error:', error);
      alert(`Toggle plan error: ${error.reason || error.message}`);
    }
  };

  const handleFundVault = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const amountWei = toAmount(vaultForm.fundAmount);
      if (amountWei <= 0n) {
        alert('Enter a valid amount');
        return;
      }

      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

      const approveTx = await usdcContract.approve(VAULT_ADDRESS, amountWei);
      await approveTx.wait();

      const tx = await vaultContract.fundVault(amountWei);
      await tx.wait();

      alert('Vault funded successfully');
      setVaultForm((prev) => ({ ...prev, fundAmount: '' }));
      await refreshAdminData();
    } catch (error) {
      console.error('Fund vault error:', error);
      alert(`Fund vault error: ${error.reason || error.message}`);
    }
  };

  const handleWithdrawVault = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const amountWei = toAmount(vaultForm.withdrawAmount);
      if (amountWei <= 0n) {
        alert('Enter a valid amount');
        return;
      }

      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const tx = await vaultContract.withdrawVault(amountWei);
      await tx.wait();

      alert('Vault withdrawal successful');
      setVaultForm((prev) => ({ ...prev, withdrawAmount: '' }));
      await refreshAdminData();
    } catch (error) {
      console.error('Withdraw vault error:', error);
      alert(`Withdraw vault error: ${error.reason || error.message}`);
    }
  };

  const handleSetFeeReceiver = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    if (!feeReceiverInput) {
      alert('Enter a valid address');
      return;
    }

    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const tx = await vaultContract.setFeeReceiver(feeReceiverInput);
      await tx.wait();

      alert('Fee receiver updated');
      setFeeReceiverInput('');
      await refreshAdminData();
    } catch (error) {
      console.error('Set fee receiver error:', error);
      alert(`Set fee receiver error: ${error.reason || error.message}`);
    }
  };

  const handlePause = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const tx = await vaultContract.pause();
      await tx.wait();

      alert('System paused');
      await refreshAdminData();
    } catch (error) {
      console.error('Pause error:', error);
      alert(`Pause error: ${error.reason || error.message}`);
    }
  };

  const handleUnpause = async () => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const tx = await vaultContract.unpause();
      await tx.wait();

      alert('System unpaused');
      await refreshAdminData();
    } catch (error) {
      console.error('Unpause error:', error);
      alert(`Unpause error: ${error.reason || error.message}`);
    }
  };

  return (
    <section className="bg-white rounded-lg p-6 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          <p className="text-sm text-gray-600">Restricted to approved admin wallet</p>
        </div>
        <button
          onClick={refreshAdminData}
          className="px-3 py-2 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
        >
          Refresh Admin Data
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Vault Balance</p>
          <p className="text-2xl font-bold text-indigo-600">${Number(vaultBalance).toFixed(2)} mUSDC</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">System Status</p>
          <p className={`text-2xl font-bold ${paused ? 'text-red-600' : 'text-green-600'}`}>
            {paused ? 'Paused' : 'Unpaused'}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Fee Receiver</p>
          <p className="text-sm font-semibold text-gray-900 break-all">{feeReceiver || 'Unknown'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan Management</h3>

          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Tenor (days)"
                value={createPlanForm.tenorDays}
                onChange={(e) => setCreatePlanForm((prev) => ({ ...prev, tenorDays: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <input
                type="number"
                placeholder="APR (bps)"
                value={createPlanForm.aprBps}
                onChange={(e) => setCreatePlanForm((prev) => ({ ...prev, aprBps: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Min deposit (USDC)"
                value={createPlanForm.minDeposit}
                onChange={(e) => setCreatePlanForm((prev) => ({ ...prev, minDeposit: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <input
                type="number"
                placeholder="Max deposit (USDC, 0 = unlimited)"
                value={createPlanForm.maxDeposit}
                onChange={(e) => setCreatePlanForm((prev) => ({ ...prev, maxDeposit: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <input
              type="number"
              placeholder="Early withdraw penalty (bps)"
              value={createPlanForm.penaltyBps}
              onChange={(e) => setCreatePlanForm((prev) => ({ ...prev, penaltyBps: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <button
              onClick={handleCreatePlan}
              className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Create Plan
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Update Plan APR</h4>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Plan ID"
                value={updatePlanForm.planId}
                onChange={(e) => setUpdatePlanForm((prev) => ({ ...prev, planId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <input
                type="number"
                placeholder="New APR (bps)"
                value={updatePlanForm.aprBps}
                onChange={(e) => setUpdatePlanForm((prev) => ({ ...prev, aprBps: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <button
              onClick={handleUpdatePlan}
              className="w-full bg-indigo-500 text-white font-semibold py-2 rounded-lg hover:bg-indigo-600 transition"
            >
              Update APR
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTogglePlan(true)}
                className="w-full bg-emerald-500 text-white font-semibold py-2 rounded-lg hover:bg-emerald-600 transition"
              >
                Enable Plan
              </button>
              <button
                onClick={() => handleTogglePlan(false)}
                className="w-full bg-red-500 text-white font-semibold py-2 rounded-lg hover:bg-red-600 transition"
              >
                Disable Plan
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Vault Management</h3>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Fund vault (USDC)"
                value={vaultForm.fundAmount}
                onChange={(e) => setVaultForm((prev) => ({ ...prev, fundAmount: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <button
                onClick={handleFundVault}
                className="w-full bg-green-600 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
              >
                Fund Vault
              </button>

              <input
                type="number"
                placeholder="Withdraw from vault (USDC)"
                value={vaultForm.withdrawAmount}
                onChange={(e) => setVaultForm((prev) => ({ ...prev, withdrawAmount: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <button
                onClick={handleWithdrawVault}
                className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg hover:bg-amber-700 transition"
              >
                Withdraw Vault
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">System Controls</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Fee receiver address"
                value={feeReceiverInput}
                onChange={(e) => setFeeReceiverInput(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <button
                onClick={handleSetFeeReceiver}
                className="w-full bg-indigo-500 text-white font-semibold py-2 rounded-lg hover:bg-indigo-600 transition"
              >
                Update Fee Receiver
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePause}
                  className="w-full bg-red-500 text-white font-semibold py-2 rounded-lg hover:bg-red-600 transition"
                >
                  Pause
                </button>
                <button
                  onClick={handleUnpause}
                  className="w-full bg-emerald-500 text-white font-semibold py-2 rounded-lg hover:bg-emerald-600 transition"
                >
                  Unpause
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">Plan Status</div>
        <div className="divide-y divide-gray-200">
          {loadingPlans ? (
            <div className="p-4 text-sm text-gray-600">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">No plans found</div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm text-gray-700">
                <div>#{plan.id}</div>
                <div>{plan.tenor} days</div>
                <div>{(plan.aprBps / 100).toFixed(2)}% APR</div>
                <div>Min: {Number(plan.minDeposit).toFixed(2)}</div>
                <div>Max: {plan.maxDeposit === 'Unlimited' ? 'Unlimited' : Number(plan.maxDeposit).toFixed(2)}</div>
                <div className={plan.enabled ? 'text-green-600' : 'text-red-600'}>
                  {plan.enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminDashboard;
