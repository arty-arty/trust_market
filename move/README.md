# Marketplace Smart Contract

This directory contains the Move smart contract for the Trust Marketplace - A P2P Marketplace with encrypted chat functionality.

## Structure

- `sources/marketplace.move`: The main contract file containing all the logic for the marketplace
- `sources/utils.move`: Utility functions used by the marketplace contract
- `deploy.js`: Script to deploy the contract to the Sui network
- `.env.example`: Example environment variables file (copy to `.env` and fill in your values)

## Features

- Create advertisements for buying or selling gigs
- Join advertisements and lock funds in escrow
- End-to-end encrypted chat between buyer and seller
- Dispute resolution with admin intervention
- User reputation system

## Deployment

To deploy the contract:

1. Copy `.env.example` to `.env` and fill in your mnemonic phrase and desired network:

```
cp .env.example .env
```

2. Edit `.env` with your values:

```
PHRASE=your mnemonic phrase here
NET=testnet  # or devnet, mainnet
```

3. Install dependencies:

```
npm install
```

4. Deploy the contract:

```
npm run deploy
```

This will:
- Build the Move contract
- Deploy it to the specified network
- Save the package ID to `package.id`
- Update the package ID in the frontend configuration

## Development

To build the contract without deploying:

```
npm run build
```

## Interaction Model

The contract uses a flexible interaction model that allows users to have multiple interactions with the same advertisement:

1. Each user has a `UserProfile` that contains a vector of `Interaction` objects
2. Each `Interaction` represents a transaction between the advertisement creator and a user
3. Each `Interaction` has its own chat history and state (JOINED, COMPLETED, DISPUTED)
4. Users can interact with the same advertisement multiple times, as long as their previous interaction is completed

This model provides organization and privacy, while maintaining the security features.
