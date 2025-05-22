import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import { Link } from 'react-router-dom';
import { Search, Star, DollarSign, Users, Clock, Filter } from 'lucide-react';
import { Advertisement, UserReputation } from './types';
import { 
  fetchAdvertisements, 
  formatCurrency as formatCurrencyApi, 
  formatAddress,
  getStateInfo,
  joinAdvertisement, 
} from './api';
import { JoinAdvertisementConfirmation } from './components/ConfirmationDialogs'; 
import { SealClient, getAllowlistedKeyServers } from '@mysten/seal'; 
// import { toast } from 'react-toastify'; // Removed toast for now

// Define a local interface for mock data that matches the UI needs
interface MockAdvertisement {
  id: string;
  title: string;
  description: string;
  amount: number;
  creator: string;
  state: number; // 0: available, 1: joined, 2: completed, 3: disputed
  createdAt: number;
}

interface MockUserReputation {
  user: string;
  rating: number;
  totalDeals: number;
  totalVolume: number;
  peacefulResolutions: number;
  disputedDeals: number;
}


// Mock data for user reputations (will be replaced with real data from blockchain)
const mockReputations: Record<string, MockUserReputation> = {
  '0x7890abcdef123456': {
    user: '0x7890abcdef123456',
    rating: 4.9,
    totalDeals: 47,
    totalVolume: 25430,
    peacefulResolutions: 45,
    disputedDeals: 2
  },
  '0x7890abcdef123457': {
    user: '0x7890abcdef123457',
    rating: 4.2,
    totalDeals: 23,
    totalVolume: 12750,
    peacefulResolutions: 20,
    disputedDeals: 3
  },
  '0x7890abcdef123458': {
    user: '0x7890abcdef123458',
    rating: 5.0,
    totalDeals: 18,
    totalVolume: 8920,
    peacefulResolutions: 18,
    disputedDeals: 0
  },
  '0x7890abcdef123459': {
    user: '0x7890abcdef123459',
    rating: 4.3,
    totalDeals: 31,
    totalVolume: 15300,
    peacefulResolutions: 28,
    disputedDeals: 3
  }
};

export function BrowseAdvertisements() {
  const packageId = useNetworkVariable('packageId');
  const registryId = useNetworkVariable('registryId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  // State for advertisements
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [filteredAds, setFilteredAds] = useState<Advertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [minDeals, setMinDeals] = useState(0);
  const [minVolume, setMinVolume] = useState(0);
  const [showBuyOnly, setShowBuyOnly] = useState(false);
  const [showSellOnly, setShowSellOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // State for Join Advertisement Dialog
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedAdForJoin, setSelectedAdForJoin] = useState<Advertisement | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Instantiate SealClient
  const sealClient = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'), // Or 'mainnet' based on config
    verifyKeyServers: false, // Adjust as needed
  });
  
  // Load advertisements
  useEffect(() => {
    const loadAdvertisements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (suiClient) {
          // Fetch advertisements from the blockchain
          const ads = await fetchAdvertisements(suiClient, packageId, registryId);
          setAdvertisements(ads);
          setFilteredAds(ads);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching advertisements:', err);
        setError('Failed to load advertisements. Please try again.');
        setIsLoading(false);
      }
    };
    
    loadAdvertisements();
  }, [packageId, registryId, suiClient]);
  
  // Apply filters when filter state changes
  useEffect(() => {
    if (advertisements.length === 0) return;
    
    let filtered = [...advertisements];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ad => 
        ad.title.toLowerCase().includes(query) || 
        ad.description.toLowerCase().includes(query)
      );
    }
    
    // Apply buy/sell filters
    if (showBuyOnly && !showSellOnly) {
      filtered = filtered.filter(ad => ad.title.toLowerCase().includes('buy'));
    } else if (showSellOnly && !showBuyOnly) {
      filtered = filtered.filter(ad => ad.title.toLowerCase().includes('sell'));
    }
    
    // Apply rating filter
    if (minRating > 0) {
      filtered = filtered.filter(ad => {
        const reputation = mockReputations[ad.creator];
        return reputation && reputation.rating >= minRating;
      });
    }
    
    // Apply deals filter
    if (minDeals > 0) {
      filtered = filtered.filter(ad => {
        const reputation = mockReputations[ad.creator];
        return reputation && reputation.totalDeals >= minDeals;
      });
    }
    
    // Apply volume filter
    if (minVolume > 0) {
      filtered = filtered.filter(ad => {
        const reputation = mockReputations[ad.creator];
        return reputation && reputation.totalVolume >= minVolume;
      });
    }
    
    setFilteredAds(filtered);
  }, [advertisements, searchQuery, minRating, minDeals, minVolume, showBuyOnly, showSellOnly]);
  
  // Get state badge
  const getStateBadge = (state: number) => {
    const stateInfo = getStateInfo(state);
    const colorClass = stateInfo.color === 'blue' ? 'design-badge-info' : 
                       stateInfo.color === 'green' ? 'design-badge-success' :
                       stateInfo.color === 'red' ? 'design-badge-error' :
                       stateInfo.color === 'yellow' ? 'design-badge-warning' : 'design-badge-info';
    
    return <span className={`design-badge ${colorClass}`}>{stateInfo.label}</span>;
  };
  
  // Check if the advertisement is created by the current user
  const isOwnAdvertisement = (ad: Advertisement): boolean => {
    return !!currentAccount && ad.creator === currentAccount.address;
  };

  // Render stars for rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} size={14} fill="var(--amber-9)" color="var(--amber-9)" />
        ))}
        {hasHalfStar && (
          <div style={{ position: 'relative' }}>
            <Star size={14} color="var(--amber-9)" style={{ opacity: 0.3 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
              <Star size={14} fill="var(--amber-9)" color="var(--amber-9)" />
            </div>
          </div>
        )}
        <span style={{ marginLeft: 'var(--space-1)', fontSize: '14px' }}>{rating.toFixed(1)}</span>
      </div>
    );
  };
  
  return (
    <div className="design-flex design-flex-col design-gap-6">
      <div className="design-flex design-flex-between" style={{ alignItems: 'center' }}>
        <h2 className="design-heading-2">Browse Advertisements</h2>
        <Link to="/marketplace/create">
          <button className="design-button design-button-primary">Create Advertisement</button>
        </Link>
      </div>
      
      <div className="design-card">
        <div className="design-flex design-flex-col design-gap-4">
          {/* Search and filters */}
          <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
            <div className="design-search-container" style={{ flex: 1 }}>
              <Search size={16} className="design-search-icon" />
              <input
                className="design-input design-search-input"
                placeholder="Search advertisements..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className="design-button design-button-secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
          
          {/* Advanced filters */}
          {showFilters && (
            <div className="design-card" style={{ backgroundColor: 'var(--gray-3)', padding: 'var(--space-4)' }}>
              <div className="design-flex design-flex-col design-gap-4">
                <div className="design-flex design-gap-4" style={{ alignItems: 'center' }}>
                  <label className="design-flex design-gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={showBuyOnly} 
                      onChange={() => setShowBuyOnly(!showBuyOnly)} 
                      style={{ margin: 0 }}
                    />
                    <span>Buy advertisements only</span>
                  </label>
                  
                  <label className="design-flex design-gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={showSellOnly} 
                      onChange={() => setShowSellOnly(!showSellOnly)} 
                      style={{ margin: 0 }}
                    />
                    <span>Sell advertisements only</span>
                  </label>
                </div>
                
                <div className="design-form-group">
                  <label className="design-form-label">Minimum Seller Rating</label>
                  <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
                    <input 
                      type="range" 
                      value={minRating} 
                      onChange={(e) => setMinRating(parseFloat(e.target.value))} 
                      min={0} 
                      max={5} 
                      step={0.5}
                      style={{ flex: 1 }}
                      className="design-slider"
                    />
                    <span style={{ fontSize: '14px' }}>{minRating} ★</span>
                  </div>
                </div>
                
                <div className="design-form-group">
                  <label className="design-form-label">Minimum Completed Deals</label>
                  <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
                    <input 
                      type="range" 
                      value={minDeals} 
                      onChange={(e) => setMinDeals(parseInt(e.target.value))} 
                      min={0} 
                      max={50} 
                      step={5}
                      style={{ flex: 1 }}
                      className="design-slider"
                    />
                    <span style={{ fontSize: '14px' }}>{minDeals}</span>
                  </div>
                </div>
                
                <div className="design-form-group">
                  <label className="design-form-label">Minimum Transaction Volume</label>
                  <div className="design-flex design-gap-3" style={{ alignItems: 'center' }}>
                    <input 
                      type="range" 
                      value={minVolume} 
                      onChange={(e) => setMinVolume(parseInt(e.target.value))} 
                      min={0} 
                      max={30000} 
                      step={1000}
                      style={{ flex: 1 }}
                      className="design-slider"
                    />
                    <span style={{ fontSize: '14px' }}>${minVolume}</span>
                  </div>
                </div>
                
                <div className="design-flex design-flex-end">
                  <button 
                    className="design-button design-button-secondary"
                    onClick={() => {
                      setMinRating(0);
                      setMinDeals(0);
                      setMinVolume(0);
                      setShowBuyOnly(false);
                      setShowSellOnly(false);
                      setSearchQuery('');
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Results count */}
      <p style={{ color: 'var(--gray-11)', fontSize: '16px' }}>
        Results: {filteredAds.length} advertisements found
      </p>
      
      {/* Advertisement grid */}
      {isLoading ? (
        <div className="design-grid design-grid-responsive">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="design-card">
              <div className="design-flex design-flex-col design-gap-3">
                <div className="design-flex design-flex-between" style={{ alignItems: 'flex-start' }}>
                  <div className="design-skeleton" style={{ width: '60%', height: '24px' }}></div>
                  <div className="design-flex design-gap-2">
                    <div className="design-skeleton" style={{ width: '60px', height: '20px', borderRadius: 'var(--radius-sm)' }}></div>
                  </div>
                </div>
                <div className="design-skeleton" style={{ width: '100%', height: '16px' }}></div>
                <div className="design-skeleton" style={{ width: '90%', height: '16px' }}></div>
                <div className="design-flex design-gap-4" style={{ alignItems: 'center' }}>
                  <div className="design-skeleton" style={{ width: '80px', height: '20px' }}></div>
                  <div className="design-skeleton" style={{ width: '100px', height: '20px' }}></div>
                </div>
                <div className="design-skeleton" style={{ width: '100%', height: '36px', marginTop: 'var(--space-2)' }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="design-empty-state">
          <div className="design-empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 className="design-heading-3" style={{ marginBottom: 'var(--space-2)' }}>
            Error Loading Advertisements
          </h3>
          <p style={{ color: 'var(--gray-9)', fontSize: '14px' }}>{error}</p>
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="design-empty-state">
          <div className="design-empty-state-icon">
            <Search size={48} />
          </div>
          <h3 className="design-heading-3" style={{ marginBottom: 'var(--space-2)' }}>
            No Advertisements Found
          </h3>
          <p style={{ color: 'var(--gray-9)', fontSize: '14px' }}>
            No advertisements found matching your filters. Try adjusting your search criteria.
          </p>
        </div>
      ) : (
        <div className="design-grid design-grid-responsive">
          {filteredAds.map((ad) => {
            const reputation = mockReputations[ad.creator];
            const isBuy = ad.title.toLowerCase().includes('buy');
            const isOwn = isOwnAdvertisement(ad);
            
            return (
              <div key={ad.id} className="design-card design-card-interactive">
                <div className="design-flex design-flex-col design-gap-4">
                  <div className="design-flex design-flex-between" style={{ alignItems: 'flex-start' }}>
                    <h3 className="design-heading-3" style={{ flex: 1 }}>{ad.title}</h3>
                    <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                      {isOwn && (
                        <span className="design-badge design-badge-info">Your Ad</span>
                      )}
                      <span className={`design-badge ${isBuy ? 'design-badge-success' : 'design-badge-info'}`}>
                        {isBuy ? 'Buy' : 'Sell'}
                      </span>
                    </div>
                  </div>
                  
                  <p style={{ 
                    fontSize: '14px',
                    color: 'var(--gray-11)',
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical',
                    minHeight: '40px',
                    lineHeight: 1.4,
                    margin: 0
                  }}>
                    {ad.description}
                  </p>
                  
                  <div className="design-flex design-gap-4" style={{ alignItems: 'center' }}>
                    <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                      <DollarSign size={16} />
                      <span style={{ fontWeight: 'bold' }}>{formatCurrencyApi(ad.amount)}</span>
                    </div>
                    
                    <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                      <Clock size={16} />
                      <span style={{ fontSize: '14px' }}>{new Date(ad.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {reputation && (
                    <div className="design-flex design-flex-col design-gap-2">
                      <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
                        <span style={{ fontSize: '14px' }}>Seller:</span>
                        {renderStars(reputation.rating)}
                      </div>
                      
                      <div className="design-flex design-gap-4">
                        <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                          <Users size={14} />
                          <span style={{ fontSize: '12px' }}>{reputation.totalDeals} deals</span>
                        </div>
                        
                        <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                          <DollarSign size={14} />
                          <span style={{ fontSize: '12px' }}>${reputation.totalVolume}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className={`design-button design-button-primary ${isOwn ? '' : 'design-focus-visible'}`}
                    style={{ width: '100%' }} 
                    disabled={isOwn}
                    onClick={() => {
                      if (!isOwn) {
                        setSelectedAdForJoin(ad);
                        setShowJoinDialog(true);
                      }
                    }}
                  >
                    {isOwn ? 'Cannot Join Own Ad' : 'Join Advertisement'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAdForJoin && (
        <JoinAdvertisementConfirmation
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
          amount={selectedAdForJoin.amount}
          isLoading={isJoining}
          onConfirm={async () => {
            if (!selectedAdForJoin || !currentAccount?.address || !suiClient) {
              console.error("Cannot join advertisement: Missing required information.");
              alert("Cannot join advertisement: Missing required information.");
              return;
            }
            setIsJoining(true);
            try {
              // Determine the interaction ID based on existing user interactions
              // If user has no interactions, use 0, otherwise use the length of interactions array
              const userProfiles = selectedAdForJoin.userProfiles || {};
              const userProfile = userProfiles[currentAccount.address];
              const interactionId = userProfile ? userProfile.interactions.length : 0;
              
              console.log(`User ${currentAccount.address} joining ad ${selectedAdForJoin.id} with interaction ID: ${interactionId}`);
              console.log(`User profile exists: ${!!userProfile}, Interactions count: ${userProfile ? userProfile.interactions.length : 0}`);

              const { transaction: tx, ephemeralKey } = await joinAdvertisement(
                suiClient,
                sealClient,
                packageId,
                selectedAdForJoin.id,
                currentAccount.address,
                interactionId, 
                selectedAdForJoin.amount 
              );

              signAndExecuteTransaction(
                { transaction: tx },
                {
                  onSuccess: (result) => {
                    console.log('Joined advertisement successfully:', result);
                    alert(`Successfully joined advertisement: ${selectedAdForJoin.title}`);
                    setIsJoining(false);
                    setShowJoinDialog(false);
                    setSelectedAdForJoin(null);
                    // TODO: Consider re-fetching advertisements or updating UI more gracefully
                    // For now, user might need to manually refresh to see changes in their joined ads.
                    // Calling loadAdvertisements() here might be an option if it's refactored to be callable.
                  },
                  onError: (error) => {
                    console.error('Error joining advertisement:', error);
                    alert(`Failed to join advertisement: ${error.message || 'Unknown error'}`);
                    setIsJoining(false);
                  },
                }
              );
            } catch (error: any) {
              console.error('Error preparing join transaction:', error);
              alert(`Error preparing to join: ${error.message || 'Unknown error'}`);
              setIsJoining(false);
            }
          }}
        />
      )}
    </div>
  );
}
