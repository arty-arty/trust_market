import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button, Card, Flex, Grid, Text, Box, Tabs, Badge } from '@radix-ui/themes';
import { Link } from 'react-router-dom';
import { ShoppingBag, Store, ShieldCheck, DollarSign, Search, User, Settings, BarChart3, MessageCircle, Clock, CheckCircle } from 'lucide-react';

// Role types
type Role = 'buyer' | 'seller' | 'admin';

export function MarketplaceLanding() {
  const currentAccount = useCurrentAccount();
  // Use localStorage to persist role selection
  const [selectedRole, setSelectedRole] = useState<Role>(() => {
    const savedRole = localStorage.getItem('marketplaceRole');
    return (savedRole as Role) || 'buyer';
  });
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check if user is admin (in a real app, this would check against a list of admin addresses)
  useEffect(() => {
    // For demo purposes, we'll just set a hardcoded check
    // In a real app, this would be a check against a list of admin addresses
    // Using the first few characters of the address for demo purposes
    const isAdminUser = currentAccount?.address && 
      (currentAccount.address.startsWith('0x123') || 
       currentAccount.address.startsWith('0xabc') ||
       // Allow any address to be admin for demo purposes if it ends with specific characters
       currentAccount.address.endsWith('789'));
    
    setIsAdmin(!!isAdminUser);
    
    // If the user was previously on admin role but is not an admin, reset to buyer role
    if (selectedRole === 'admin' && !isAdminUser) {
      setSelectedRole('buyer');
    }
  }, [currentAccount, selectedRole]);

  // Role card styling
  const getRoleCardStyle = (role: Role) => {
    const isSelected = selectedRole === role;
    const isDisabled = role === 'admin' && !isAdmin;
    
    return {
      padding: '24px',
      borderRadius: '16px',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      border: isSelected ? '2px solid var(--accent-9)' : '1px solid var(--gray-5)',
      backgroundColor: isSelected ? 'var(--accent-3)' : isDisabled ? 'var(--gray-3)' : 'rgba(79, 70, 229, 0.1)',
      opacity: isDisabled ? 0.6 : 1,
      transition: 'all 0.2s ease',
      height: '100%',
      boxShadow: isSelected ? '0 8px 16px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
      transform: isSelected ? 'translateY(-4px)' : 'none'
    };
  };

  // Role icon styling
  const getRoleIconStyle = (role: Role) => {
    const isSelected = selectedRole === role;
    
    return {
      backgroundColor: isSelected ? 'var(--accent-9)' : 'var(--gray-5)',
      color: isSelected ? 'white' : 'var(--gray-11)',
      padding: '16px',
      borderRadius: '50%',
      marginBottom: '16px',
      boxShadow: isSelected ? '0 4px 8px rgba(0, 0, 0, 0.15)' : 'none',
      transition: 'all 0.2s ease'
    };
  };

  // Handle role selection
  const handleRoleSelect = (role: Role) => {
    if (role === 'admin' && !isAdmin) {
      return; // Don't allow selecting admin if not an admin
    }
    setSelectedRole(role);
    // Save to localStorage for persistence
    localStorage.setItem('marketplaceRole', role);
  };

  return (
    <Flex direction="column" gap="4">
      <Box style={{ 
        textAlign: 'center', 
        padding: '32px 0', 
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1))',
        borderRadius: '12px',
        marginBottom: '16px'
      }}>
        <Flex align="center" justify="center" gap="3" style={{ marginBottom: '8px' }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_2051_2)">
              <path d="M34.6766 8.23425C32.1621 7.56316 29.7057 6.69116 27.3309 5.62665C24.9945 4.61314 22.7391 3.42237 20.5844 2.06477L19.9741 1.6875L19.3749 2.07587C17.2202 3.43347 14.9648 4.62423 12.6284 5.63774C10.2497 6.69903 7.78955 7.56733 5.27167 8.23425L4.43945 8.44508V17.6993C4.43945 32.5571 19.4526 38.1163 19.5968 38.1718L19.9741 38.3049L20.3514 38.1718C20.5067 38.1718 35.5088 32.5682 35.5088 17.6993V8.44508L34.6766 8.23425ZM33.2895 17.6993C33.2895 29.9051 22.1933 35.0204 19.9741 35.9303C17.7549 35.0204 6.65869 29.894 6.65869 17.6993V10.165C8.9994 9.49207 11.2907 8.65786 13.5161 7.66834C15.7417 6.7063 17.8993 5.59412 19.9741 4.33949C22.0489 5.59412 24.2065 6.7063 26.4321 7.66834C28.6575 8.65786 30.9488 9.49207 33.2895 10.165V17.6993Z" fill="#3E63DD"/>
              <path d="M12.0716 18.7424C11.8593 18.5606 11.5863 18.4656 11.307 18.4764C11.0278 18.4872 10.7629 18.603 10.5652 18.8006C10.3676 18.9982 10.2518 19.2631 10.2411 19.5424C10.2303 19.8217 10.3253 20.0947 10.5071 20.307L17.1648 26.9647L29.2929 15.3026C29.5048 15.0966 29.6262 14.8149 29.6303 14.5194C29.6345 14.2239 29.5211 13.9388 29.3151 13.7269C29.1091 13.5151 28.8273 13.3937 28.5319 13.3895C28.2364 13.3854 27.9513 13.4987 27.7394 13.7047L17.2313 23.9021L12.0716 18.7424Z" fill="#3E63DD"/>
            </g>
            <defs>
              <clipPath id="clip0_2051_2">
                <rect width="39.9463" height="39.9463" fill="white" transform="translate(0 0.0231934)"/>
              </clipPath>
            </defs>
          </svg>
          <Text size="8" weight="bold">Trust Market Place</Text>
        </Flex>
        <Text size="3" color="gray">
          Secure platform with encrypted chat and escrow protection
        </Text>
      </Box>

      {/* Role Selection */}
      <Card style={{ 
        padding: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--accent-6)',
      }}>
        <Flex direction="column" gap="3">
          <Text size="5" weight="bold" style={{ textAlign: 'center' }}>Select Your Role</Text>
          <Text size="2" color="gray" style={{ textAlign: 'center', marginBottom: '12px' }}>Choose how you want to use the marketplace today</Text>
          
          <Grid columns="3" gap="4">
            {/* Client Role (formerly Buyer) */}
            <Box onClick={() => handleRoleSelect('buyer')} style={getRoleCardStyle('buyer')}>
              <Flex direction="column" align="center" gap="2">
                <Box style={{
                  ...getRoleIconStyle('buyer'),
                  background: selectedRole === 'buyer' ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'var(--gray-5)',
                  padding: '16px',
                }}>
                  <ShoppingBag size={28} />
                </Box>
                <Text size="4" weight="bold">Client</Text>
                <Text size="2" align="center">Find freelancers and hire for gigs</Text>
              </Flex>
            </Box>
            
            {/* Freelancer Role (formerly Seller) */}
            <Box onClick={() => handleRoleSelect('seller')} style={getRoleCardStyle('seller')}>
              <Flex direction="column" align="center" gap="2">
                <Box style={{
                  ...getRoleIconStyle('seller'),
                  background: selectedRole === 'seller' ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--gray-5)',
                  padding: '16px',
                }}>
                  <Store size={28} />
                </Box>
                <Text size="4" weight="bold">Freelancer</Text>
                <Text size="2" align="center">Offer your services and complete gigs</Text>
              </Flex>
            </Box>
            
            {/* Admin Role */}
            <Box onClick={() => handleRoleSelect('admin')} style={getRoleCardStyle('admin')}>
              <Flex direction="column" align="center" gap="2">
                <Box style={{
                  ...getRoleIconStyle('admin'),
                  background: selectedRole === 'admin' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--gray-5)',
                  padding: '16px',
                }}>
                  <ShieldCheck size={28} />
                </Box>
                <Text size="4" weight="bold">Admin</Text>
                <Text size="2" align="center">
                  {isAdmin ? 'Resolve disputes and manage users' : 'Admin access required'}
                </Text>
                {!isAdmin && (
                  <Badge color="gray" size="1">Restricted Access</Badge>
                )}
              </Flex>
            </Box>
          </Grid>
        </Flex>
      </Card>

      {/* Role-specific content */}
      {selectedRole === 'buyer' && (
        <>
          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <Search size={20} />
                  <Text size="5" weight="bold">Browse Advertisements</Text>
                </Flex>
                <Text>
                  Find skilled freelancers offering their services.
                  Filter by rating, price, and expertise to find your perfect match.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/browse">
                    <Button size="3" variant="solid">Browse Listings</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <MessageCircle size={20} />
                  <Text size="5" weight="bold">My Transactions</Text>
                </Flex>
                <Text>
                  View your active and completed gigs.
                  Chat with freelancers and manage your projects.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/my-deals">
                    <Button size="3" variant="solid">View Transactions</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
          </Grid>

          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <User size={20} />
                  <Text size="5" weight="bold">My Profile</Text>
                </Flex>
                  <Text>
                    View your reputation, project history, and reviews.
                    A strong profile helps build trust with potential freelancers.
                  </Text>
                <Box>
                  <Link to={`/marketplace/profile/${currentAccount?.address}`}>
                    <Button size="3" variant="soft">View Profile</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
            
          </Grid>
        </>
      )}

      {selectedRole === 'seller' && (
        <>
          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <DollarSign size={20} />
                  <Text size="5" weight="bold">Create Advertisement</Text>
                </Flex>
                <Text>
                  Create a new gig listing to offer your services.
                  Set your price, describe your skills, and wait for interested clients.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/create">
                    <Button size="3" variant="solid">Create Listing</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <Settings size={20} />
                  <Text size="5" weight="bold">Manage Listings</Text>
                </Flex>
                <Text>
                  View and manage your active gig listings.
                  Handle client requests and track your completed jobs.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/my-listings">
                    <Button size="3" variant="solid">My Listings</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
          </Grid>

          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <BarChart3 size={20} />
                  <Text size="5" weight="bold">Performance Dashboard</Text>
                </Flex>
                  <Text>
                    Track your gig performance, client satisfaction, and earnings.
                    Gain insights to improve your freelancing strategy.
                  </Text>
                <Box>
                  <Link to={`/marketplace/profile/${currentAccount?.address}`}>
                    <Button size="3" variant="soft">View Dashboard</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
            
          </Grid>
        </>
      )}

      {selectedRole === 'admin' && isAdmin && (
        <>
          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <ShieldCheck size={20} />
                  <Text size="5" weight="bold">Dispute Resolution</Text>
                </Flex>
                <Text>
                  Review and resolve disputes between clients and freelancers.
                  Ensure fair outcomes for all marketplace participants.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/admin">
                    <Button size="3" variant="solid">Manage Disputes</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>

            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <User size={20} />
                  <Text size="5" weight="bold">User Management</Text>
                </Flex>
                <Text>
                  Review user accounts, handle reports, and manage permissions.
                  Maintain a safe and trustworthy marketplace environment.
                </Text>
                <Box style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/admin">
                    <Button size="3" variant="solid">Manage Users</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
          </Grid>

          <Grid columns="2" gap="4">
            <Card>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex align="center" gap="2">
                  <BarChart3 size={20} />
                  <Text size="5" weight="bold">Marketplace Analytics</Text>
                </Flex>
                <Text>
                  View comprehensive marketplace statistics and trends.
                  Monitor transaction volume, user growth, and platform health.
                </Text>
                <Box>
                  <Link to="/marketplace/admin">
                    <Button size="3" variant="soft">View Analytics</Button>
                  </Link>
                </Box>
              </Flex>
            </Card>
            
          </Grid>
        </>
      )}

      <Card>
        <Flex direction="column" gap="2">
          <Text size="5" weight="bold">How It Works</Text>
          <Flex direction="column" gap="2">
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Search size={16} />
              </Box>
              <Text>Browse gigs or create your own listing as a freelancer</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <DollarSign size={16} />
              </Box>
              <Text>When a client hires you, funds are securely locked in escrow</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageCircle size={16} />
              </Box>
              <Text>Communicate securely with end-to-end encrypted chat</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #10B981, #059669)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle size={16} />
              </Box>
              <Text>Freelancer marks the job as completed when work is done</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle size={16} />
              </Box>
              <Text>Client reviews the work and approves payment release</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #F59E0B, #D97706)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={16} />
              </Box>
              <Text>If there's a dispute, an admin can help resolve it fairly</Text>
            </Flex>
            <Flex gap="2" align="center">
              <Box style={{ 
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={16} />
              </Box>
              <Text>Leave a review to build your reputation in the marketplace</Text>
            </Flex>
          </Flex>
        </Flex>
      </Card>
{/* 
      <Card>
        <Flex direction="column" gap="2">
          <Text size="5" weight="bold">Debug Mode</Text>
          <Text>
            Try the marketplace in debug mode without blockchain interactions.
            This allows you to explore the UI and functionality without spending real tokens.
          </Text>
          <Box>
            <Link to="/marketplace/debug">
              <Button size="2" variant="soft">Enter Debug Mode</Button>
            </Link>
          </Box>
        </Flex>
      </Card> */}
    </Flex>
  );
}
