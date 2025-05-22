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
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.6 : 1,
      height: '100%',
      transform: isSelected ? 'translateY(-4px)' : 'none',
      borderColor: isSelected ? 'var(--accent-9)' : 'var(--gray-5)',
      borderWidth: isSelected ? '2px' : '1px',
      backgroundColor: isSelected ? 'var(--accent-3)' : isDisabled ? 'var(--gray-3)' : 'rgba(79, 70, 229, 0.1)',
      boxShadow: isSelected ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
    };
  };

  // Role icon styling
  const getRoleIconStyle = (role: Role) => {
    const isSelected = selectedRole === role;
    
    return {
      backgroundColor: isSelected ? 'var(--accent-9)' : 'var(--gray-5)',
      color: isSelected ? 'white' : 'var(--gray-11)',
      padding: 'var(--space-4)',
      borderRadius: '50%',
      marginBottom: 'var(--space-4)',
      boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
      transition: 'all var(--transition-normal)'
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
    <div className="design-flex design-flex-col design-gap-6">
      {/* Hero Section */}
      <div className="design-card" style={{ 
        textAlign: 'center', 
        padding: 'var(--space-8)', 
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(124, 58, 237, 0.1))',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-4)'
      }}>
        <div className="design-flex design-flex-center design-gap-3" style={{ marginBottom: 'var(--space-2)' }}>
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
          <h1 className="design-heading-1">Trust Market Place</h1>
        </div>
        <Text size="4" style={{ color: 'var(--gray-11)' }}>
          Secure platform with encrypted chat and escrow protection
        </Text>
      </div>

      {/* Role Selection */}
      <Card className="design-card" style={{ 
        padding: 'var(--space-6)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--accent-6)',
      }}>
        <div className="design-flex design-flex-col design-gap-4">
          <h2 className="design-heading-2" style={{ textAlign: 'center' }}>Select Your Role</h2>
          <Text size="3" style={{ textAlign: 'center', marginBottom: 'var(--space-3)', color: 'var(--gray-11)' }}>
            Choose how you want to use the marketplace today
          </Text>
          
          <div className="design-grid design-grid-3">
            {/* Client Role (formerly Buyer) */}
            <div 
              className="design-card design-card-interactive"
              onClick={() => handleRoleSelect('buyer')} 
              style={getRoleCardStyle('buyer')}
            >
              <div className="design-flex design-flex-col design-flex-center design-gap-3">
                <div style={{
                  ...getRoleIconStyle('buyer'),
                  background: selectedRole === 'buyer' ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'var(--gray-5)',
                }}>
                  <ShoppingBag size={28} />
                </div>
                <h3 className="design-heading-3">Client</h3>
                <Text size="2" style={{ textAlign: 'center' }}>Find freelancers and hire for gigs</Text>
              </div>
            </div>
            
            {/* Freelancer Role (formerly Seller) */}
            <div 
              className="design-card design-card-interactive"
              onClick={() => handleRoleSelect('seller')} 
              style={getRoleCardStyle('seller')}
            >
              <div className="design-flex design-flex-col design-flex-center design-gap-3">
                <div style={{
                  ...getRoleIconStyle('seller'),
                  background: selectedRole === 'seller' ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--gray-5)',
                }}>
                  <Store size={28} />
                </div>
                <h3 className="design-heading-3">Freelancer</h3>
                <Text size="2" style={{ textAlign: 'center' }}>Offer your services and complete gigs</Text>
              </div>
            </div>
            
            {/* Admin Role */}
            <div 
              className="design-card design-card-interactive"
              onClick={() => handleRoleSelect('admin')} 
              style={getRoleCardStyle('admin')}
            >
              <div className="design-flex design-flex-col design-flex-center design-gap-3">
                <div style={{
                  ...getRoleIconStyle('admin'),
                  background: selectedRole === 'admin' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--gray-5)',
                }}>
                  <ShieldCheck size={28} />
                </div>
                <h3 className="design-heading-3">Admin</h3>
                <Text size="2" style={{ textAlign: 'center' }}>
                  {isAdmin ? 'Resolve disputes and manage users' : 'Admin access required'}
                </Text>
                {!isAdmin && (
                  <span className="design-badge design-badge-warning">Restricted Access</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Role-specific content */}
      {selectedRole === 'buyer' && (
        <>
          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <Search size={20} />
                  <h3 className="design-heading-3">Browse Advertisements</h3>
                </div>
                <Text>
                  Find skilled freelancers offering their services.
                  Filter by rating, price, and expertise to find your perfect match.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/browse">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      Browse Listings
                    </button>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <MessageCircle size={20} />
                  <h3 className="design-heading-3">My Transactions</h3>
                </div>
                <Text>
                  View your active and completed gigs.
                  Chat with freelancers and manage your projects.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/my-deals">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      View Transactions
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <User size={20} />
                  <h3 className="design-heading-3">My Profile</h3>
                </div>
                <Text>
                  View your reputation, project history, and reviews.
                  A strong profile helps build trust with potential freelancers.
                </Text>
                <div>
                  <Link to={`/marketplace/profile/${currentAccount?.address}`}>
                    <button className="design-button design-button-secondary" style={{ width: '100%' }}>
                      View Profile
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {selectedRole === 'seller' && (
        <>
          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <DollarSign size={20} />
                  <h3 className="design-heading-3">Create Advertisement</h3>
                </div>
                <Text>
                  Create a new gig listing to offer your services.
                  Set your price, describe your skills, and wait for interested clients.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/create">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      Create Listing
                    </button>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <Settings size={20} />
                  <h3 className="design-heading-3">Manage Listings</h3>
                </div>
                <Text>
                  View and manage your active gig listings.
                  Handle client requests and track your completed jobs.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/my-listings">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      My Listings
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <BarChart3 size={20} />
                  <h3 className="design-heading-3">Performance Dashboard</h3>
                </div>
                <Text>
                  Track your gig performance, client satisfaction, and earnings.
                  Gain insights to improve your freelancing strategy.
                </Text>
                <div>
                  <Link to={`/marketplace/profile/${currentAccount?.address}`}>
                    <button className="design-button design-button-secondary" style={{ width: '100%' }}>
                      View Dashboard
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {selectedRole === 'admin' && isAdmin && (
        <>
          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <ShieldCheck size={20} />
                  <h3 className="design-heading-3">Dispute Resolution</h3>
                </div>
                <Text>
                  Review and resolve disputes between clients and freelancers.
                  Ensure fair outcomes for all marketplace participants.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/admin">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      Manage Disputes
                    </button>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <User size={20} />
                  <h3 className="design-heading-3">User Management</h3>
                </div>
                <Text>
                  Review user accounts, handle reports, and manage permissions.
                  Maintain a safe and trustworthy marketplace environment.
                </Text>
                <div style={{ marginTop: 'auto' }}>
                  <Link to="/marketplace/admin">
                    <button className="design-button design-button-primary" style={{ width: '100%' }}>
                      Manage Users
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          <div className="design-grid design-grid-2">
            <Card className="design-card">
              <div className="design-flex design-flex-col design-gap-4" style={{ height: '100%' }}>
                <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                  <BarChart3 size={20} />
                  <h3 className="design-heading-3">Marketplace Analytics</h3>
                </div>
                <Text>
                  View comprehensive marketplace statistics and trends.
                  Monitor transaction volume, user growth, and platform health.
                </Text>
                <div>
                  <Link to="/marketplace/admin">
                    <button className="design-button design-button-secondary" style={{ width: '100%' }}>
                      View Analytics
                    </button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* How It Works Section */}
      <Card className="design-card">
        <div className="design-flex design-flex-col design-gap-4">
          <h2 className="design-heading-2">How It Works</h2>
          <div className="design-flex design-flex-col design-gap-3">
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>Browse gigs or create your own listing as a freelancer</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>When a client hires you, funds are securely locked in escrow</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>Communicate securely with end-to-end encrypted chat</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>Freelancer marks the job as completed when work is done</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>Client reviews the work and approves payment release</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>If there's a dispute, an admin can help resolve it fairly</Text>
            </div>
            <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
              <div style={{ 
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
              </div>
              <Text>Leave a review to build your reputation in the marketplace</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
