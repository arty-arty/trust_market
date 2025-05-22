import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, Heading, Badge, Tabs, Box, Grid, Avatar } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { Link } from 'react-router-dom';
import { DollarSign, Clock, User, MessageCircle, AlertCircle, CheckCircle, ShieldAlert, Search } from 'lucide-react';

// Dispute interface
interface Dispute {
  id: string;
  advertisementId: string;
  advertisementTitle: string;
  amount: number;
  seller: string;
  buyer: string;
  createdAt: number;
  status: 'pending' | 'resolved';
  resolution?: 'buyer' | 'seller' | 'split';
}

// Mock data for disputes (will be replaced with real data from blockchain)
const mockDisputes: Dispute[] = [
  {
    id: '0x123456789abcdef1',
    advertisementId: '0x123456789abcdef1',
    advertisementTitle: 'Sell 500 USDT for cash',
    amount: 490,
    seller: '0x7890abcdef123456',
    buyer: '0x7890abcdef123457',
    createdAt: Date.now() - 3600000 * 24 * 2,
    status: 'pending'
  },
  {
    id: '0x123456789abcdef2',
    advertisementId: '0x123456789abcdef2',
    advertisementTitle: 'Sell 200 USDT for cash',
    amount: 198,
    seller: '0x7890abcdef123458',
    buyer: '0x7890abcdef123459',
    createdAt: Date.now() - 3600000 * 24 * 5,
    status: 'resolved',
    resolution: 'buyer'
  },
  {
    id: '0x123456789abcdef3',
    advertisementId: '0x123456789abcdef3',
    advertisementTitle: 'Buy 750 USDT',
    amount: 735,
    seller: '0x7890abcdef123460',
    buyer: '0x7890abcdef123461',
    createdAt: Date.now() - 3600000 * 24 * 7,
    status: 'resolved',
    resolution: 'seller'
  },
  {
    id: '0x123456789abcdef4',
    advertisementId: '0x123456789abcdef4',
    advertisementTitle: 'Sell 300 USDT for cash',
    amount: 295,
    seller: '0x7890abcdef123462',
    buyer: '0x7890abcdef123463',
    createdAt: Date.now() - 3600000 * 24 * 10,
    status: 'resolved',
    resolution: 'split'
  }
];

export function AdminPanel() {
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  // State for disputes
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [filteredDisputes, setFilteredDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  
  // Transaction signing and execution
  const { mutate: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showRawEffects: true,
          showEffects: true,
        },
      }),
  });
  
  // Load disputes
  useEffect(() => {
    const fetchDisputes = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Soon we would fetch disputes from the blockchain
        // For now, we'll use mock data
        setDisputes(mockDisputes);
        setFilteredDisputes(mockDisputes.filter(dispute => 
          activeTab === 'all' || 
          (activeTab === 'pending' && dispute.status === 'pending') ||
          (activeTab === 'resolved' && dispute.status === 'resolved')
        ));
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching disputes:', err);
        setError('Failed to load disputes. Please try again.');
        setIsLoading(false);
      }
    };
    
    fetchDisputes();
  }, [packageId, suiClient, activeTab]);
  
  // Apply search filter
  useEffect(() => {
    if (disputes.length === 0) return;
    
    const filtered = disputes.filter(dispute => 
      (activeTab === 'all' || 
       (activeTab === 'pending' && dispute.status === 'pending') ||
       (activeTab === 'resolved' && dispute.status === 'resolved')) &&
      (searchQuery === '' || 
       dispute.advertisementTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
       dispute.seller.toLowerCase().includes(searchQuery.toLowerCase()) ||
       dispute.buyer.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    
    setFilteredDisputes(filtered);
  }, [disputes, activeTab, searchQuery]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Format address
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  // Resolve dispute
  const resolveDispute = (disputeId: string, resolution: 'buyer' | 'seller' | 'split') => {
    setIsResolving(true);
    setError(null);
    
    // In a real implementation, we would call the contract
    // For now, we'll just update the local state
    setTimeout(() => {
      setDisputes(prev => 
        prev.map(dispute => 
          dispute.id === disputeId 
            ? { ...dispute, status: 'resolved', resolution } 
            : dispute
        )
      );
      setSelectedDispute(null);
      setIsResolving(false);
    }, 1000);
    
    // A useful example of how to call the contract in a real implementation to do later:
    /*
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::marketplace::resolve_dispute`,
      arguments: [
        tx.object(disputeId),
        tx.pure.u8(resolution === 'buyer' ? 1 : resolution === 'seller' ? 2 : 3),
        tx.object('0x123'), // Admin cap
      ],
    });
    tx.setGasBudget(10000000);
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Dispute resolved:', result);
          setDisputes(prev => 
            prev.map(dispute => 
              dispute.id === disputeId 
                ? { ...dispute, status: 'resolved', resolution } 
                : dispute
            )
          );
          setSelectedDispute(null);
          setIsResolving(false);
        },
        onError: (error) => {
          console.error('Error resolving dispute:', error);
          setError('Failed to resolve dispute. Please try again.');
          setIsResolving(false);
        },
      },
    );
    */
  };
  
  // Get resolution badge
  const getResolutionBadge = (resolution?: 'buyer' | 'seller' | 'split') => {
    switch (resolution) {
      case 'buyer':
        return <Badge color="green">Resolved for Buyer</Badge>;
      case 'seller':
        return <Badge color="blue">Resolved for Seller</Badge>;
      case 'split':
        return <Badge color="orange">Split 50/50</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center">
        <Heading size="5">Admin Panel - Dispute Resolution</Heading>
      </Flex>
      
      <Card>
        <Flex direction="column" gap="3">
          <Flex gap="3" align="center">
            <Flex style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-9)' }} />
              <input
                placeholder="Search disputes..."
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
          </Flex>
          
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Trigger value="all">All Disputes</Tabs.Trigger>
              <Tabs.Trigger value="pending">Pending</Tabs.Trigger>
              <Tabs.Trigger value="resolved">Resolved</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </Flex>
      </Card>
      
      {/* Results count */}
      <Text>Results: {filteredDisputes.length} disputes found</Text>
      
      {/* Disputes list */}
      {isLoading ? (
        <Text>Loading disputes...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : filteredDisputes.length === 0 ? (
        <Text>No disputes found matching your filters.</Text>
      ) : (
        <Flex direction="column" gap="3">
          {filteredDisputes.map((dispute) => (
            <Card key={dispute.id}>
              <Flex direction="column" gap="3">
                <Flex justify="between" align="start">
                  <Heading size="3">{dispute.advertisementTitle}</Heading>
                  <Badge color={dispute.status === 'pending' ? 'red' : 'green'}>
                    {dispute.status === 'pending' ? 'Pending' : 'Resolved'}
                  </Badge>
                </Flex>
                
                <Flex gap="3" align="center">
                  <Flex gap="1" align="center">
                    <DollarSign size={16} />
                    <Text weight="bold">{formatCurrency(dispute.amount)}</Text>
                  </Flex>
                  
                  <Flex gap="1" align="center">
                    <Clock size={16} />
                    <Text size="2">{new Date(dispute.createdAt).toLocaleDateString()}</Text>
                  </Flex>
                  
                  {dispute.resolution && getResolutionBadge(dispute.resolution)}
                </Flex>
                
                <Grid columns="2" gap="3">
                  <Flex gap="2" align="center">
                    <Avatar size="2" fallback="S" />
                    <Flex direction="column">
                      <Text size="2" weight="bold">Seller</Text>
                      <Link to={`/marketplace/profile/${dispute.seller}`}>
                        <Text size="2">{formatAddress(dispute.seller)}</Text>
                      </Link>
                    </Flex>
                  </Flex>
                  
                  <Flex gap="2" align="center">
                    <Avatar size="2" fallback="B" />
                    <Flex direction="column">
                      <Text size="2" weight="bold">Buyer</Text>
                      <Link to={`/marketplace/profile/${dispute.buyer}`}>
                        <Text size="2">{formatAddress(dispute.buyer)}</Text>
                      </Link>
                    </Flex>
                  </Flex>
                </Grid>
                
                <Flex gap="3" justify="end">
                  <Link to={`/marketplace/advertisement/${dispute.advertisementId}`}>
                    <Button variant="soft">
                      <MessageCircle size={16} />
                      View Details
                    </Button>
                  </Link>
                  
                  {dispute.status === 'pending' && (
                    <Button 
                      onClick={() => setSelectedDispute(dispute)}
                    >
                      <ShieldAlert size={16} />
                      Resolve Dispute
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
      
      {/* Resolution dialog */}
      {selectedDispute && (
        <Card style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '500px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <Flex direction="column" gap="3">
            <Heading size="4">Resolve Dispute</Heading>
            
            <Text>Advertisement: {selectedDispute.advertisementTitle}</Text>
            <Text>Amount: {formatCurrency(selectedDispute.amount)}</Text>
            <Text>Seller: {formatAddress(selectedDispute.seller)}</Text>
            <Text>Buyer: {formatAddress(selectedDispute.buyer)}</Text>
            
            <Flex direction="column" gap="2">
              <Text weight="bold">Resolution:</Text>
              <Flex gap="2">
                <Button 
                  color="green" 
                  onClick={() => resolveDispute(selectedDispute.id, 'buyer')}
                  disabled={isResolving}
                >
                  Resolve for Buyer
                </Button>
                <Button 
                  color="blue" 
                  onClick={() => resolveDispute(selectedDispute.id, 'seller')}
                  disabled={isResolving}
                >
                  Resolve for Seller
                </Button>
                <Button 
                  color="orange" 
                  onClick={() => resolveDispute(selectedDispute.id, 'split')}
                  disabled={isResolving}
                >
                  Split 50/50
                </Button>
              </Flex>
            </Flex>
            
            <Flex justify="end">
              <Button 
                variant="soft" 
                onClick={() => setSelectedDispute(null)}
                disabled={isResolving}
              >
                Cancel
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}
    </Flex>
  );
}
