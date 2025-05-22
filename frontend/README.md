# Trust Marketplace Frontend

This directory contains the frontend application for the Trust Marketplace - P2P Marketplace on SUI with encrypted chat functionality.

## Features

- Browse advertisements for buying or selling gigs
- Create new advertisements
- Join advertisements and lock funds in escrow
- End-to-end encrypted chat between buyer and seller
- User reputation system
- Dispute resolution with admin intervention

## Setup

1. Install dependencies:

```
npm install
```

2. Start the development server:

```
npm run dev
```

## Deployment

To deploy the frontend:

```
npm run build
```

This will create a production build in the `dist` directory.

## Contract Deployment

The frontend interacts with a Move smart contract deployed on the Sui blockchain. To deploy the contract:

1. Navigate to the `move` directory:

```
cd ../move
```

2. Follow the instructions in the `move/README.md` file to deploy the contract.

3. After deployment, the package ID will be automatically updated in the frontend configuration.

## Interaction Model

The marketplace uses a flexible interaction model that allows users to have multiple interactions with the same advertisement:

1. Each user has a profile that contains a list of interactions
2. Each interaction represents a transaction between the advertisement creator and a user
3. Each interaction has its own chat history and state (JOINED, COMPLETED, DISPUTED)
4. Users can interact with the same advertisement multiple times, as long as their previous interaction is completed

This model provides organization and privacy, while maintaining the security features.

## Components

- `BrowseAdvertisements.tsx`: Browse and filter advertisements
- `CreateAdvertisement.tsx`: Create new advertisements
- `MyAdvertisements.tsx`: View and manage your advertisements
- `AdvertisementDetail.tsx`: View details of an advertisement
- `Chat.tsx`: End-to-end encrypted chat between buyer and seller
- `ReviewForm.tsx`: Leave reviews for other users
- `UserProfile.tsx`: View user profiles and reputation
- `AdminPanel.tsx`: Admin interface for dispute resolution

## API

The frontend interacts with the smart contract through the functions defined in `api.ts`. These functions create and execute transactions on the Sui blockchain.

## Encryption

The chat functionality uses end-to-end encryption to ensure privacy. The key is fetched from Seal by access policies described in the contract. The encryption logic is implemented in `utils.ts`.
