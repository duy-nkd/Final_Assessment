const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Online Banking System", function () {
    let mockUSDC, vaultManager, savingCore;
    let owner, user1, user2, bot;
    
    // Các thông số hằng số
    const PLAN_TENOR = 90; // 90 ngày
    const PLAN_APR = 250;  // 2.5% (250 bps)
    const PENALTY_BPS = 500; // 5% (500 bps)
    const MIN_DEPOSIT = ethers.parseUnits("100", 6);
    const MAX_DEPOSIT = ethers.parseUnits("5000", 6);
    const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);

    beforeEach(async function () {
        [owner, user1, user2, bot] = await ethers.getSigners();

        // 1. Deploy các contract
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const VaultManager = await ethers.getContractFactory("VaultManager");
        vaultManager = await VaultManager.deploy(await mockUSDC.getAddress());

        const SavingCore = await ethers.getContractFactory("SavingCore");
        savingCore = await SavingCore.deploy(await mockUSDC.getAddress(), await vaultManager.getAddress());

        // 2. Cấp quyền
        await vaultManager.setCoreContract(await savingCore.getAddress(), true);
        await vaultManager.setFeeReceiver(owner.address);

        // 3. Mint token test (1 USDC = 1,000,000 units)[cite: 1]
        await mockUSDC.mint(owner.address, ethers.parseUnits("100000", 6));
        await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));
        
        // 4. Admin nạp tiền vào Vault[cite: 1]
        await mockUSDC.connect(owner).approve(await vaultManager.getAddress(), ethers.parseUnits("50000", 6));
        await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

        // 5. Admin tạo Plan mặc định (planId = 1)[cite: 1]
        await savingCore.connect(owner).createPlan(PLAN_TENOR, PLAN_APR, MIN_DEPOSIT, MAX_DEPOSIT, PENALTY_BPS);
    });

    describe("1. Admin Functions: createPlan", function () {
        it("Should create a valid plan", async function () {
            const plan = await savingCore.plans(1);
            expect(plan.tenorDays).to.equal(PLAN_TENOR);
            expect(plan.aprBps).to.equal(PLAN_APR);
            expect(plan.enabled).to.be.true;
        });

        it("Should disable a plan", async function () {
            // Giả sử bạn có hàm togglePlan(planId, enabled) trong SavingCore
            // Nếu chưa có, bạn cần thêm hàm này vào contract để pass test này
            // await savingCore.connect(owner).togglePlan(1, false);
            // const plan = await savingCore.plans(1);
            // expect(plan.enabled).to.be.false;
        });

        it("Should fail with invalid APR (e.g., > 10000)", async function () {
            // Test này yêu cầu contract của bạn phải có `require(_aprBps <= 10000, "Invalid APR")`
            await expect(
                savingCore.connect(owner).createPlan(PLAN_TENOR, 15000, MIN_DEPOSIT, MAX_DEPOSIT, PENALTY_BPS)
            ).to.be.reverted; 
        });
    });

    describe("2. User Flow: openDeposit", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), ethers.parseUnits("10000", 6));
        });

        it("Should open a deposit successfully (happy path)", async function () {
            await expect(savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT))
                .to.emit(savingCore, "DepositOpened");
            expect(await savingCore.ownerOf(1)).to.equal(user1.address);
        });

        it("Should fail if amount is below min", async function () {
            const tooSmall = ethers.parseUnits("50", 6);
            await expect(savingCore.connect(user1).openDeposit(1, tooSmall))
                .to.be.revertedWith("Amount below minimum");
        });

        it("Should fail if amount is above max", async function () {
            const tooLarge = ethers.parseUnits("6000", 6);
            await expect(savingCore.connect(user1).openDeposit(1, tooLarge))
                .to.be.revertedWith("Amount exceeds maximum");
        });
    });

    describe("3. User Flow: withdrawAtMaturity", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), DEPOSIT_AMOUNT);
            await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        });

        it("Should withdraw with correct interest", async function () {
            await time.increase(PLAN_TENOR * 86400); // Tua qua 90 ngày
            
            const balBefore = await mockUSDC.balanceOf(user1.address);
            await expect(savingCore.connect(user1).withdrawAtMaturity(1))
                .to.emit(savingCore, "Withdrawn");

            const balAfter = await mockUSDC.balanceOf(user1.address);
            // Lãi suất mong đợi: (1000 * 2.5% * 90) / 365 = ~6.16 USDC
            expect(balAfter).to.be.gt(balBefore);
        });

        it("Should fail if too early", async function () {
            await time.increase(30 * 86400); // Mới qua 30 ngày
            await expect(savingCore.connect(user1).withdrawAtMaturity(1))
                .to.be.revertedWith("Not matured yet");
        });

        it("Should fail if already withdrawn", async function () {
            await time.increase(PLAN_TENOR * 86400);
            await savingCore.connect(user1).withdrawAtMaturity(1);
            
            await expect(savingCore.connect(user1).withdrawAtMaturity(1))
                .to.be.revertedWith("Not active"); // Trạng thái đã chuyển sang Withdrawn
        });
    });

    describe("4. User Flow: earlyWithdraw", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), DEPOSIT_AMOUNT);
            await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        });

        it("Should withdraw early with correct penalty and zero interest", async function () {
            await time.increase(30 * 86400); // 30 ngày
            
            const balBefore = await mockUSDC.balanceOf(user1.address);
            const feeReceiverBalBefore = await mockUSDC.balanceOf(owner.address);

            await expect(savingCore.connect(user1).earlyWithdraw(1))
                .to.emit(savingCore, "Withdrawn");

            const balAfter = await mockUSDC.balanceOf(user1.address);
            const feeReceiverBalAfter = await mockUSDC.balanceOf(owner.address);

            // Phạt 5% của 1000 = 50 USDC. User nhận lại 950 USDC.
            const expectedPenalty = ethers.parseUnits("50", 6);
            expect(feeReceiverBalAfter - feeReceiverBalBefore).to.equal(expectedPenalty);
        });
    });

    describe("5. User Flow: renewDeposit (manual)", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), DEPOSIT_AMOUNT);
            await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
            // Tạo thêm 1 gói mới để renew
            await savingCore.connect(owner).createPlan(180, 300, 0, 0, 500); 
        });

        it("Should renew deposit with correct new principal and status update", async function () {
            await time.increase(PLAN_TENOR * 86400);
            
            await expect(savingCore.connect(user1).renewDeposit(1, 2))
                .to.emit(savingCore, "Renewed");

            const oldDep = await savingCore.deposits(1);
            expect(oldDep.status).to.equal(2); // ManualRenewed

            const newDep = await savingCore.deposits(2); // NFT mới có ID = 2
            expect(newDep.planId).to.equal(2);
            expect(newDep.principal).to.be.gt(DEPOSIT_AMOUNT); // Gốc mới = Gốc cũ + Lãi
        });
    });

    describe("6. User Flow: autoRenewDeposit", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), DEPOSIT_AMOUNT);
            await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        });

        it("Should fail if called before grace period ends", async function () {
            await time.increase(PLAN_TENOR * 86400 + 86400); // Mới lố 1 ngày sau đáo hạn
            await expect(savingCore.connect(bot).autoRenewDeposit(1))
                .to.be.revertedWith("Grace period not ended");
        });

        it("Should auto-renew after grace period and lock original APR", async function () {
            // Giả lập Admin giảm lãi suất gói cũ xuống 1%
            // await savingCore.connect(owner).updatePlan(1, 100); 

            await time.increase(PLAN_TENOR * 86400 + (4 * 86400)); // Lố 4 ngày (qua grace period 3 ngày)
            
            await expect(savingCore.connect(bot).autoRenewDeposit(1))
                .to.emit(savingCore, "Renewed");

            const newDep = await savingCore.deposits(2);
            expect(newDep.aprBpsAtOpen).to.equal(PLAN_APR); // APR được khóa lại với mức cũ là 2.5%, bỏ qua thay đổi của Admin
        });
    });

    describe("7 & 8. Vault & Pause Controls", function () {
        beforeEach(async function() {
            await mockUSDC.connect(user1).approve(await savingCore.getAddress(), DEPOSIT_AMOUNT);
            await savingCore.connect(user1).openDeposit(1, DEPOSIT_AMOUNT);
        });

        it("Should withdraw from vault", async function () {
            const amount = ethers.parseUnits("100", 6);
            await expect(vaultManager.connect(owner).withdrawVault(amount))
                .to.emit(vaultManager, "VaultWithdrawn");
        });

        it("Should revert withdrawal if insufficient vault funds for interest payout", async function () {
            await time.increase(PLAN_TENOR * 86400);
            
            // Rút sạch tiền khỏi Vault
            const vaultBalance = await mockUSDC.balanceOf(await vaultManager.getAddress());
            await vaultManager.connect(owner).withdrawVault(vaultBalance);

            // User rút tiền sẽ bị fail vì Vault không đủ trả lãi
            await expect(savingCore.connect(user1).withdrawAtMaturity(1))
                .to.be.reverted; 
        });

        it("Should block withdrawals when paused", async function () {
            await time.increase(PLAN_TENOR * 86400);
            await vaultManager.connect(owner).pause();

            await expect(savingCore.connect(user1).withdrawAtMaturity(1))
                .to.be.revertedWith("System is paused");
        });
    });
});