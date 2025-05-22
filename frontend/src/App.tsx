import React from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Button, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';
import WalrusUpload from './EncryptAndUpload';
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { MarketplaceLanding } from './MarketplaceLanding';
import { MarketplaceLayout } from './components/MarketplaceLayout';
import { CreateAdvertisement } from './CreateAdvertisement';
import { BrowseAdvertisements } from './BrowseAdvertisements';
import { MyAdvertisements } from './MyAdvertisements';
import { UserProfile } from './UserProfile';
import { AdvertisementDetail } from './AdvertisementDetail';
import { AdminPanel } from './AdminPanel';
import { NotificationCenter } from './NotificationCenter';

function LandingPage() {
 return <Navigate to="/marketplace" replace />;
}

function App() {
  const currentAccount = useCurrentAccount();
  const [recipientAllowlist, setRecipientAllowlist] = useState<string>('');
  const [capId, setCapId] = useState<string>('');
  return (
    <Container>
      <Flex position="sticky" px="4" py="2" justify="between" align="center" style={{ 
        marginBottom: '2rem', 
        borderBottom: '1px solid var(--gray-5)', 
        paddingBottom: '12px',
        height: '64px' 
      }}>
        <Flex align="center" gap="4">
          <Box 
            style={{ 
              backgroundColor: 'var(--gray-3)', 
              padding: '8px 16px', 
              borderRadius: '8px',
              border: '1px solid var(--gray-5)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
          >
            <Text size="2" style={{ color: 'var(--gray-11)' }}>
              Make sure your SUI wallet is set to Testnet and has some balance (<a href="https://faucet.sui.io/" style={{ color: 'var(--accent-9)', textDecoration: 'none', fontWeight: 500 }}>faucet.sui.io</a>)
            </Text>
          </Box>
          
          {/* Notification center commented out as it's not ready yet */}
          {/* {currentAccount && <NotificationCenter />} */}
        </Flex>
        
        <Box>
          <ConnectButton />
        </Box>
      </Flex>
      {currentAccount ? (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/marketplace" element={<MarketplaceLayout />}>
              <Route index element={<MarketplaceLanding />} />
              <Route path="create" element={<CreateAdvertisement />} />
              <Route path="browse" element={<BrowseAdvertisements />} />
              {/* <Route path="my-advertisements" element={<MyAdvertisements />} /> {/* Old route that was replaced */}
              <Route path="my-listings" element={<MyAdvertisements routeMode="seller" />} /> {/* New route for sellers */}
              <Route path="my-deals" element={<MyAdvertisements routeMode="client" />} /> {/* New route for clients */}
              <Route path="profile/:address" element={<UserProfile />} />
              <Route path="advertisement/:id" element={<AdvertisementDetail />} />
              <Route path="chat/:id" element={<AdvertisementDetail />} />
              <Route path="admin" element={<AdminPanel />} />
            </Route>
          </Routes>
        </BrowserRouter>
      ) : (
        <p>Please connect your wallet to continue</p>
      )}
    </Container>
  );
}

export default App;
