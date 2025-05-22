import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Button, Card, Container, Flex, Grid, Text } from '@radix-ui/themes';
import WalrusUpload from './EncryptAndUpload';
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

// Enhanced header component with Apple-level UX
function EnhancedHeader() {
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate dynamic opacity and blur based on scroll
  const headerOpacity = Math.min(0.8 + (scrollY / 200) * 0.2, 1);
  const blurAmount = Math.min(scrollY / 50, 8);
  const shadowOpacity = Math.min(scrollY / 100, 0.1);

  return (
    <header 
      className="design-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: `rgba(var(--gray-1-rgb, 17, 17, 17), ${headerOpacity})`,
        borderBottom: `1px solid rgba(var(--gray-5-rgb, 68, 68, 68), ${isScrolled ? 1 : 0.3})`,
        backdropFilter: `blur(${blurAmount}px)`,
        WebkitBackdropFilter: `blur(${blurAmount}px)`,
        boxShadow: `0 1px 3px rgba(0, 0, 0, ${shadowOpacity})`,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: `translateY(${Math.max(-scrollY * 0.1, -5)}px)`,
      }}
    >
      <div 
        className="design-header-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${isScrolled ? 'var(--space-3)' : 'var(--space-4)'} var(--space-4)`,
          maxWidth: '1200px',
          margin: '0 auto',
          transition: 'padding 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Flex align="center" gap="4" style={{ flex: 1 }}>
          <Box 
            className="design-card"
            style={{ 
              backgroundColor: `rgba(var(--gray-3-rgb, 34, 34, 34), ${isScrolled ? 0.9 : 1})`, 
              padding: `${isScrolled ? 'var(--space-2)' : 'var(--space-3)'} var(--space-4)`, 
              borderRadius: 'var(--radius-md)',
              border: `1px solid rgba(var(--gray-6-rgb, 102, 102, 102), ${isScrolled ? 0.8 : 1})`,
              boxShadow: `var(--shadow-sm)`,
              margin: 0,
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `scale(${isScrolled ? 0.95 : 1})`,
            }}
          >
            <Text 
              size={isScrolled ? "1" : "2"} 
              style={{ 
                color: 'var(--gray-11)', 
                lineHeight: 1.4,
                transition: 'font-size 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Make sure your SUI wallet is set to Testnet and has some balance (
              <a 
                href="https://faucet.sui.io/" 
                className="design-link"
                style={{
                  transition: 'color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                faucet.sui.io
              </a>
              )
            </Text>
          </Box>
          
          {/* Notification center commented out as it's not ready yet */}
          {/* {currentAccount && <NotificationCenter />} */}
        </Flex>
        
        <Box
          style={{
            transform: `scale(${isScrolled ? 0.9 : 1})`,
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <ConnectButton />
        </Box>
      </div>
    </header>
  );
}

function App() {
  const currentAccount = useCurrentAccount();
  const [recipientAllowlist, setRecipientAllowlist] = useState<string>('');
  const [capId, setCapId] = useState<string>('');
  
  return (
    <Container style={{ padding: 0 }}>
      <EnhancedHeader />
      
      <main style={{ 
        padding: 'var(--space-6)',
        minHeight: 'calc(100vh - 80px)', // Ensure content fills viewport
      }}>
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
          <div className="design-empty-state">
            <div className="design-empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <Text size="4" weight="medium" style={{ marginBottom: 'var(--space-2)' }}>
              Connect Your Wallet
            </Text>
            <Text size="2" color="gray">
              Please connect your wallet to continue using the marketplace
            </Text>
          </div>
        )}
      </main>
    </Container>
  );
}

export default App;
