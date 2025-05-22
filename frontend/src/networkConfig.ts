import { getFullnodeUrl } from '@mysten/sui/client';
import { TESTNET_PACKAGE_ID, TESTNET_REGISTRY_ID } from './constants';
import { createNetworkConfig } from '@mysten/dapp-kit';

const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      packageId: TESTNET_PACKAGE_ID,
      registryId: TESTNET_REGISTRY_ID,
      gqlClient: 'https://sui-testnet.mystenlabs.com/graphql',
    },
  },
});

export { useNetworkVariable, useNetworkVariables, networkConfig };
