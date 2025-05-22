import React, { useState, useEffect } from 'react';
// Removed duplicate React import line
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Button, Card, Flex, Grid, Text, Heading, Badge, Slider, Checkbox, Box, Dialog } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { Link } from 'react-router-dom'; // Re-added Link
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
    return <Badge color={stateInfo.color as any}>{stateInfo.label}</Badge>;
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
      <Flex gap="1" align="center">
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
        <Text size="2" style={{ marginLeft: '4px' }}>{rating.toFixed(1)}</Text>
      </Flex>
    );
  };
  
  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center">
        <Heading size="5">Browse Advertisements</Heading>
        <Link to="/marketplace/create">
          <Button>Create Advertisement</Button>
        </Link>
      </Flex>
      
      <Card>
        <Flex direction="column" gap="3">
          {/* Search and filters */}
          <Flex gap="3" align="center">
            <Flex style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-9)' }} />
              <input
                placeholder="Search advertisements..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 8px 8px 32px', 
                  borderRadius: '4px', 
                  border: '1px solid var(--gray-5)' 
                }}
              />
            </Flex>
            <Button variant="soft" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} />
              Filters
            </Button>
          </Flex>
          
          {/* Advanced filters */}
          {showFilters && (
            <Card style={{ backgroundColor: 'var(--gray-2)' }}>
              <Flex direction="column" gap="3">
                <Flex gap="3" align="center">
                  <Checkbox checked={showBuyOnly} onCheckedChange={() => setShowBuyOnly(!showBuyOnly)} id="buy-only" />
                  <label htmlFor="buy-only">Buy advertisements only</label>
                  
                  <Checkbox checked={showSellOnly} onCheckedChange={() => setShowSellOnly(!showSellOnly)} id="sell-only" />
                  <label htmlFor="sell-only">Sell advertisements only</label>
                </Flex>
                
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Minimum Seller Rating</Text>
                  <Flex gap="3" align="center">
                    <Slider 
                      value={[minRating]} 
                      onValueChange={(value) => setMinRating(value[0])} 
                      min={0} 
                      max={5} 
                      step={0.5}
                      style={{ flex: 1 }}
                    />
                    <Text size="2">{minRating} ★</Text>
                  </Flex>
                </Flex>
                
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Minimum Completed Deals</Text>
                  <Flex gap="3" align="center">
                    <Slider 
                      value={[minDeals]} 
                      onValueChange={(value) => setMinDeals(value[0])} 
                      min={0} 
                      max={50} 
                      step={5}
                      style={{ flex: 1 }}
                    />
                    <Text size="2">{minDeals}</Text>
                  </Flex>
                </Flex>
                
                <Flex direction="column" gap="1">
                  <Text size="2" weight="bold">Minimum Transaction Volume</Text>
                  <Flex gap="3" align="center">
                    <Slider 
                      value={[minVolume]} 
                      onValueChange={(value) => setMinVolume(value[0])} 
                      min={0} 
                      max={30000} 
                      step={1000}
                      style={{ flex: 1 }}
                    />
                    <Text size="2">${minVolume}</Text>
                  </Flex>
                </Flex>
                
                <Flex justify="end">
                  <Button variant="soft" onClick={() => {
                    setMinRating(0);
                    setMinDeals(0);
                    setMinVolume(0);
                    setShowBuyOnly(false);
                    setShowSellOnly(false);
                    setSearchQuery('');
                  }}>
                    Reset Filters
                  </Button>
                </Flex>
              </Flex>
            </Card>
          )}
        </Flex>
      </Card>
      
      {/* Results count */}
      <Text>Results: {filteredAds.length} advertisements found</Text>
      
      {/* Advertisement grid */}
      {isLoading ? (
        <Text>Loading advertisements...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : filteredAds.length === 0 ? (
        <Text>No advertisements found matching your filters.</Text>
      ) : (
        <Grid columns={{ initial: '1', sm: '2', md: '2', lg: '3' }} gap="4">
          {filteredAds.map((ad) => {
            const reputation = mockReputations[ad.creator];
            const isBuy = ad.title.toLowerCase().includes('buy');
            const isOwn = isOwnAdvertisement(ad);
            
            return (
              <Card key={ad.id}>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="start">
                    <Heading size="3">{ad.title}</Heading>
                    <Flex gap="2" align="center">
                      {isOwn && (
                        <Badge color="gray">Your Advertisement</Badge>
                      )}
                      <Badge color={isBuy ? 'green' : 'blue'}>
                        {isBuy ? 'Buy' : 'Sell'}
                      </Badge>
                    </Flex>
                  </Flex>
                  
                  <Text size="2" style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical',
                    minHeight: '40px'
                  }}>
                    {ad.description}
                  </Text>
                  
                  <Flex gap="3" align="center">
                    <Flex gap="1" align="center">
                      <DollarSign size={16} />
                      <Text weight="bold">{formatCurrencyApi(ad.amount)}</Text>
                    </Flex>
                    
                    <Flex gap="1" align="center">
                      <Clock size={16} />
                      <Text size="2">{new Date(ad.createdAt).toLocaleDateString()}</Text>
                    </Flex>
                  </Flex>
                  
                  {reputation && (
                    <Flex direction="column" gap="1">
                      <Flex gap="2" align="center">
                        <Text size="2">Seller:</Text>
                        {renderStars(reputation.rating)}
                      </Flex>
                      
                      <Flex gap="3">
                        <Flex gap="1" align="center">
                          <Users size={14} />
                          <Text size="1">{reputation.totalDeals} deals</Text>
                        </Flex>
                        
                        <Flex gap="1" align="center">
                          <DollarSign size={14} />
                          <Text size="1">${reputation.totalVolume}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  )}
                  
                  <Flex justify="end">
                    <Button 
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
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Grid>
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
    </Flex>
  );
}
