import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Button, Card, Flex, Text, Heading, Badge, Tabs, Box, Avatar, Grid, Separator } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { useParams } from 'react-router-dom';
import { Star, DollarSign, Users, CheckCircle, AlertCircle, Clock, ThumbsUp, ThumbsDown } from 'lucide-react';

// User profile interface
interface UserProfile {
  address: string;
  rating: number;
  totalDeals: number;
  totalVolume: number;
  peacefulResolutions: number;
  disputedDeals: number;
  joinDate: number;
}

// Transaction interface
interface Transaction {
  id: string;
  advertisementId: string;
  advertisementTitle: string;
  amount: number;
  counterparty: string;
  type: 'buy' | 'sell';
  state: 'completed' | 'disputed';
  completedAt: number;
}

// Review interface
interface Review {
  id: string;
  advertisementId: string;
  advertisementTitle: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: number;
}

// Mock data for user profile (will be replaced with real data from blockchain)
const mockUserProfile: UserProfile = {
  address: '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
  rating: 4.8,
  totalDeals: 42,
  totalVolume: 23750,
  peacefulResolutions: 40,
  disputedDeals: 2,
  joinDate: Date.now() - 3600000 * 24 * 180 // 180 days ago
};

// Mock data for transactions (will be replaced with real data from blockchain)
const mockTransactions: Transaction[] = [
  {
    id: '0x123456789abcdef1',
    advertisementId: '0x123456789abcdef1',
    advertisementTitle: 'Sell 500 USDT for cash',
    amount: 490,
    counterparty: '0x7890abcdef123456',
    type: 'sell',
    state: 'completed',
    completedAt: Date.now() - 3600000 * 24 * 5 // 5 days ago
  },
  {
    id: '0x123456789abcdef2',
    advertisementId: '0x123456789abcdef2',
    advertisementTitle: 'Sell 200 USDT for cash',
    amount: 198,
    counterparty: '0x7890abcdef123457',
    type: 'sell',
    state: 'completed',
    completedAt: Date.now() - 3600000 * 24 * 10 // 10 days ago
  },
  {
    id: '0x123456789abcdef3',
    advertisementId: '0x123456789abcdef3',
    advertisementTitle: 'Buy 750 USDT',
    amount: 735,
    counterparty: '0x7890abcdef123458',
    type: 'buy',
    state: 'completed',
    completedAt: Date.now() - 3600000 * 24 * 15 // 15 days ago
  },
  {
    id: '0x123456789abcdef4',
    advertisementId: '0x123456789abcdef4',
    advertisementTitle: 'Sell 300 USDT for cash',
    amount: 295,
    counterparty: '0x7890abcdef123459',
    type: 'sell',
    state: 'disputed',
    completedAt: Date.now() - 3600000 * 24 * 20 // 20 days ago
  }
];

// Mock data for reviews (will be replaced with real data from blockchain)
const mockReviews: Review[] = [
  {
    id: '0x123456789abcdef1',
    advertisementId: '0x123456789abcdef1',
    advertisementTitle: 'Sell 500 USDT for cash',
    reviewer: '0x7890abcdef123456',
    rating: 5,
    comment: 'Great seller, very fast and reliable. Would trade again!',
    createdAt: Date.now() - 3600000 * 24 * 5 // 5 days ago
  },
  {
    id: '0x123456789abcdef2',
    advertisementId: '0x123456789abcdef2',
    advertisementTitle: 'Sell 200 USDT for cash',
    reviewer: '0x7890abcdef123457',
    rating: 5,
    comment: 'Smooth transaction, no issues at all.',
    createdAt: Date.now() - 3600000 * 24 * 10 // 10 days ago
  },
  {
    id: '0x123456789abcdef3',
    advertisementId: '0x123456789abcdef3',
    advertisementTitle: 'Buy 750 USDT',
    reviewer: '0x7890abcdef123458',
    rating: 4,
    comment: 'Good buyer, but took a bit longer than expected to complete the transaction.',
    createdAt: Date.now() - 3600000 * 24 * 15 // 15 days ago
  },
  {
    id: '0x123456789abcdef4',
    advertisementId: '0x123456789abcdef4',
    advertisementTitle: 'Sell 300 USDT for cash',
    reviewer: '0x7890abcdef123459',
    rating: 2,
    comment: 'Had some issues with the payment, but eventually resolved.',
    createdAt: Date.now() - 3600000 * 24 * 20 // 20 days ago
  }
];

export function UserProfile() {
  const { address } = useParams<{ address: string }>();
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  // State for user profile
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Load user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // In a real implementation, we would fetch user profile from the blockchain
        // For now, we'll use mock data
        if (address) {
          setProfile({
            ...mockUserProfile,
            address
          });
          setTransactions(mockTransactions);
          setReviews(mockReviews);
        } else if (currentAccount) {
          setProfile({
            ...mockUserProfile,
            address: currentAccount.address
          });
          setTransactions(mockTransactions);
          setReviews(mockReviews);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to load user profile. Please try again.');
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [address, currentAccount, packageId, suiClient]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Render stars for rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <Flex gap="1" align="center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} size={16} fill="var(--amber-9)" color="var(--amber-9)" />
        ))}
        {hasHalfStar && (
          <div style={{ position: 'relative' }}>
            <Star size={16} color="var(--amber-9)" style={{ opacity: 0.3 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
              <Star size={16} fill="var(--amber-9)" color="var(--amber-9)" />
            </div>
          </div>
        )}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <Star key={i + fullStars + (hasHalfStar ? 1 : 0)} size={16} color="var(--amber-9)" style={{ opacity: 0.3 }} />
        ))}
        <Text size="2" style={{ marginLeft: '4px' }}>{rating.toFixed(1)}</Text>
      </Flex>
    );
  };
  
  // Format address
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  // Render overview tab
  const renderOverview = () => {
    if (!profile) return null;
    
    return (
      <Flex direction="column" gap="4">
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Reputation</Heading>
            
            <Grid columns="3" gap="3">
              <Card>
                <Flex direction="column" gap="1" align="center" justify="center" style={{ padding: '16px' }}>
                  <Flex gap="1" align="center">
                    <Star size={20} fill="var(--amber-9)" color="var(--amber-9)" />
                    <Heading size="4">{profile.rating.toFixed(1)}</Heading>
                  </Flex>
                  <Text size="2">Rating</Text>
                </Flex>
              </Card>
              
              <Card>
                <Flex direction="column" gap="1" align="center" justify="center" style={{ padding: '16px' }}>
                  <Flex gap="1" align="center">
                    <Users size={20} />
                    <Heading size="4">{profile.totalDeals}</Heading>
                  </Flex>
                  <Text size="2">Completed Deals</Text>
                </Flex>
              </Card>
              
              <Card>
                <Flex direction="column" gap="1" align="center" justify="center" style={{ padding: '16px' }}>
                  <Flex gap="1" align="center">
                    <DollarSign size={20} />
                    <Heading size="4">${profile.totalVolume.toLocaleString()}</Heading>
                  </Flex>
                  <Text size="2">Total Volume</Text>
                </Flex>
              </Card>
            </Grid>
            
            <Flex gap="3">
              <Card style={{ flex: 1 }}>
                <Flex direction="column" gap="1" align="center" justify="center" style={{ padding: '16px' }}>
                  <Flex gap="1" align="center">
                    <CheckCircle size={20} color="var(--green-9)" />
                    <Heading size="4">{profile.peacefulResolutions}</Heading>
                  </Flex>
                  <Text size="2">Peaceful Resolutions</Text>
                </Flex>
              </Card>
              
              <Card style={{ flex: 1 }}>
                <Flex direction="column" gap="1" align="center" justify="center" style={{ padding: '16px' }}>
                  <Flex gap="1" align="center">
                    <AlertCircle size={20} color="var(--red-9)" />
                    <Heading size="4">{profile.disputedDeals}</Heading>
                  </Flex>
                  <Text size="2">Disputed Deals</Text>
                </Flex>
              </Card>
            </Flex>
          </Flex>
        </Card>
        
        <Card>
          <Flex direction="column" gap="3">
            <Heading size="4">Recent Reviews</Heading>
            
            {reviews.length === 0 ? (
              <Text>No reviews yet.</Text>
            ) : (
              <Flex direction="column" gap="3">
                {reviews.slice(0, 3).map((review) => (
                  <Card key={review.id}>
                    <Flex direction="column" gap="2">
                      <Flex justify="between" align="start">
                        <Text weight="bold">{review.advertisementTitle}</Text>
                        {renderStars(review.rating)}
                      </Flex>
                      
                      <Text size="2">{review.comment}</Text>
                      
                      <Flex justify="between" align="center">
                        <Text size="1" color="gray">
                          From: {formatAddress(review.reviewer)}
                        </Text>
                        <Text size="1" color="gray">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>
                ))}
                
                {reviews.length > 3 && (
                  <Button variant="soft" onClick={() => setActiveTab('reviews')}>
                    View All Reviews
                  </Button>
                )}
              </Flex>
            )}
          </Flex>
        </Card>
      </Flex>
    );
  };
  
  // Render transactions tab
  const renderTransactions = () => {
    if (!profile) return null;
    
    return (
      <Card>
        <Flex direction="column" gap="3">
          <Heading size="4">Transaction History</Heading>
          
          {transactions.length === 0 ? (
            <Text>No transactions yet.</Text>
          ) : (
            <Flex direction="column" gap="3">
              {transactions.map((transaction) => (
                <Card key={transaction.id}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="start">
                      <Heading size="3">{transaction.advertisementTitle}</Heading>
                      <Badge color={transaction.state === 'completed' ? 'green' : 'red'}>
                        {transaction.state === 'completed' ? 'Completed' : 'Disputed'}
                      </Badge>
                    </Flex>
                    
                    <Flex gap="3" align="center">
                      <Flex gap="1" align="center">
                        <DollarSign size={16} />
                        <Text weight="bold">{formatCurrency(transaction.amount)}</Text>
                      </Flex>
                      
                      <Badge color={transaction.type === 'buy' ? 'green' : 'blue'}>
                        {transaction.type === 'buy' ? 'Buy' : 'Sell'}
                      </Badge>
                      
                      <Flex gap="1" align="center">
                        <Clock size={16} />
                        <Text size="2">{new Date(transaction.completedAt).toLocaleDateString()}</Text>
                      </Flex>
                    </Flex>
                    
                    <Flex gap="1" align="center">
                      <Text size="2">Counterparty:</Text>
                      <Text size="2">{formatAddress(transaction.counterparty)}</Text>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Flex>
      </Card>
    );
  };
  
  // Render reviews tab
  const renderReviews = () => {
    if (!profile) return null;
    
    return (
      <Card>
        <Flex direction="column" gap="3">
          <Heading size="4">Reviews</Heading>
          
          {reviews.length === 0 ? (
            <Text>No reviews yet.</Text>
          ) : (
            <Flex direction="column" gap="3">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="start">
                      <Text weight="bold">{review.advertisementTitle}</Text>
                      {renderStars(review.rating)}
                    </Flex>
                    
                    <Text size="2">{review.comment}</Text>
                    
                    <Flex justify="between" align="center">
                      <Flex gap="1" align="center">
                        <Users size={14} />
                        <Text size="1" color="gray">
                          From: {formatAddress(review.reviewer)}
                        </Text>
                      </Flex>
                      
                      <Flex gap="1" align="center">
                        <Clock size={14} />
                        <Text size="1" color="gray">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Flex>
      </Card>
    );
  };
  
  return (
    <Flex direction="column" gap="4">
      {isLoading ? (
        <Text>Loading user profile...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : profile ? (
        <>
          <Card>
            <Flex gap="4" align="center">
              <Avatar size="5" fallback={profile.address.slice(0, 2)} />
              
              <Flex direction="column" gap="1">
                <Heading size="5">User Profile</Heading>
                <Text size="2">{profile.address}</Text>
                <Flex gap="2" align="center">
                  {renderStars(profile.rating)}
                  <Text size="2">({profile.totalDeals} deals)</Text>
                </Flex>
              </Flex>
            </Flex>
          </Card>
          
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="transactions">Transactions</Tabs.Trigger>
              <Tabs.Trigger value="reviews">Reviews</Tabs.Trigger>
            </Tabs.List>
            
            <Box pt="3">
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'transactions' && renderTransactions()}
              {activeTab === 'reviews' && renderReviews()}
            </Box>
          </Tabs.Root>
        </>
      ) : (
        <Text>User profile not found.</Text>
      )}
    </Flex>
  );
}
