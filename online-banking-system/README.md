# Online Banking System

A blockchain-based term deposit system built with Hardhat and a React frontend. Users lock tokens into saving plans, receive an ERC721 NFT as a deposit certificate, earn interest at maturity, and can withdraw early with a penalty.

## Table of Contents

- Features
- Project Structure
- Smart Contracts
- Local Setup
- Test Coverage
- Frontend
- Tech Stack

## Features

- Create saving plans with tenor, APR, limits, and early-withdraw penalty.
- Open deposits using a mock USDC token.
- Withdraw at maturity (principal + interest).
- Early withdraw (principal - penalty, zero interest).
- Manual renew at maturity into a new plan.
- Pause/unpause the system for emergencies.
- React UI for wallet connection, plans, and deposits.

## Project Structure

```text
online-banking-system/
├── contracts/           Solidity contracts
│   ├── MockUSDC.sol
│   ├── VaultManager.sol
│   └── SavingCore.sol
├── scripts/             Hardhat scripts
│   ├── deploy.js
│   └── test-deploy.js
├── test/                Hardhat tests
│   └── SavingSystem.test.js
├── frontend/            React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── hardhat.config.js
├── package.json
└── README.md
```

## Smart Contracts

- MockUSDC: ERC20 test token with 6 decimals used for local testing.
- VaultManager: holds interest funds and manages fee receiver, pause, and vault operations.
- SavingCore: core business logic for plans, deposits, NFT minting, withdrawals, and renewals.

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
cd online-banking-system
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Local Network

```bash
npx hardhat node
```

### Deploy Contracts (Localhost)

In another terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

The script logs contract addresses and sets up initial demo data for the frontend.

## Test Coverage

```bash
npx hardhat coverage
```

To run tests without coverage:

```bash
npx hardhat test
```

## Frontend

The React app lives in [frontend/](frontend/). Configure contract addresses in `frontend/.env` and start the dev server.

```bash
cd frontend
npm install
npm start
```

Default dev server: http://localhost:3000

## Tech Stack

- Solidity 0.8.28
- Hardhat 2.22.x
- ethers.js 6.x
- OpenZeppelin Contracts 5.x
- React 18 + react-scripts
- Tailwind CSS 3.x

