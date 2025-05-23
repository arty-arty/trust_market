import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { getAllowlistedKeyServers, SealClient } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, Heading, Badge, Separator, Box, Dialog } from '@radix-ui/themes';
import { DisputeConfirmation, ReleasePaymentConfirmation, MarkCompletedConfirmation, JoinAdvertisementConfirmation } from './components/ConfirmationDialogs';
import { useNetworkVariable } from './networkConfig';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, Clock, User, MessageCircle, AlertCircle, CheckCircle, X } from 'lucide-react';
import { InteractionActionButtons } from './components/InteractionActionButtons';
import { ChatWrapper } from './components/ChatWrapper';
import { Advertisement as AdvertisementType, Interaction, UserProfile, STATE_AVAILABLE, STATE_JOINED, STATE_COMPLETED, STATE_DISPUTED, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from './types';
import { generateAndEncryptEphemeralKey, storeEphemeralKey } from './utils';
import { 
  fetchAdvertisement as fetchAd, 
  joinAdvertisement as joinAd, 
  disputeInteraction, 
  markInteractionCompleted,
  releasePayment,
  formatCurrency,
  formatAddress,
  getStateInfo,
  DisplayAdvertisement,
  convertToDisplayAdvertisement,
  isCreator as checkIsCreator,
  isJoiner as checkIsJoiner,
  getLatestInteraction
} from './api';

// Component to display interaction history
const InteractionHistory = ({ 
  interactions, 
  onSelectInteraction,
  selectedInteractionId
}: { 
  interactions: Interaction[], 
  onSelectInteraction: (id: number) => void,
  selectedInteractionId?: number
}) => {
  const stateLabels = ['Joined', 'Completed', 'Disputed'];
  
  return (
    <Box>
      <Heading size="3">Interaction History</Heading>
      <Flex direction="column" gap="2" style={{ marginTop: '8px' }}>
        {interactions.map(interaction => (
          <Card 
            key={interaction.id} 
            onClick={() => onSelectInteraction(interaction.id)}
            style={{ 
              cursor: 'pointer',
              border: selectedInteractionId === interaction.id ? '2px solid var(--blue-9)' : undefined
            }}
          >
            <Flex justify="between" align="center">
              <Text>Interaction #{interaction.id}</Text>
              <Badge color={interaction.state === 0 ? 'blue' : interaction.state === 1 ? 'green' : 'red'}>
                {stateLabels[interaction.state]}
              </Badge>
            </Flex>
            <Text size="2">Joined: {new Date(interaction.joinedAt).toLocaleString()}</Text>
          </Card>
        ))}
      </Flex>
    </Box>
  );
};

export function AdvertisementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [sealClient, setSealClient] = useState<SealClient | null>(null);
  
  // Check if we're on the chat route or if showChat is passed in location state
  const isChatRoute = location.pathname.includes('/marketplace/chat/');
  const showChatFromState = location.state?.showChat === true;
  
  // Get interaction from location state if available (passed from InteractionsList)
  const interactionFromState = location.state?.interaction;
  const userAddressFromState = location.state?.userAddress;
  const isCreatorFromState = location.state?.isCreator;
  
  // State for advertisement
  const [advertisement, setAdvertisement] = useState<DisplayAdvertisement | null>(null);
  const [fullAdvertisement, setFullAdvertisement] = useState<AdvertisementType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [showChat, setShowChat] = useState(isChatRoute || showChatFromState || !!interactionFromState);
  const [selectedInteractionId, setSelectedInteractionId] = useState<number | undefined>(
    interactionFromState ? interactionFromState.id : undefined
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Load advertisement data (simplified for brevity)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (id && suiClient && currentAccount) {
          const adData = await fetchAd(suiClient, id, packageId);
          
          if (adData) {
            setFullAdvertisement(adData);
            const displayAd = convertToDisplayAdvertisement(adData, currentAccount.address);
            setAdvertisement(displayAd);
          } else {
            setError('Advertisement not found.');
          }
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching advertisement:', err);
        setError('Failed to load advertisement. Please try again.');
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [id, packageId, suiClient, currentAccount]);
  
  // Check if current user is the creator
  const isCreator = () => {
    if (!advertisement || !currentAccount) return false;
    return checkIsCreator(advertisement, currentAccount.address);
  };
  
  // Check if current user is the joiner
  const isJoiner = () => {
    if (!advertisement || !currentAccount) return false;
    return checkIsJoiner(advertisement, currentAccount.address);
  };
  
  // Get state badge
  const getStateBadge = (state: number) => {
    const stateInfo = getStateInfo(state);
    return <Badge color={stateInfo.color as any}>{stateInfo.label}</Badge>;
  };
  
  // Show dispute confirmation dialog
  const showDisputeDialog = (userAddress: string, interactionId: number) => {
    console.log(`Showing dispute dialog for user ${userAddress}, interaction ${interactionId}`);
  };
  
  // Show release payment confirmation dialog
  const showReleaseDialog = (interactionId: number) => {
    console.log(`Showing release payment dialog for interaction ${interactionId}`);
  };
  
  // Show mark completed confirmation dialog
  const showMarkCompletedDialog = (userAddress: string, interactionId: number) => {
    console.log(`Showing mark completed dialog for user ${userAddress}, interaction ${interactionId}`);
  };
  
  return (
    <Flex direction="column" gap="4">
      {isLoading ? (
        <Text>Loading advertisement...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : advertisement ? (
        <>
          <Card>
            <Flex direction="column" gap="3">
              <Flex justify="between" align="start">
                <Heading size="5">{advertisement.title}</Heading>
                {getStateBadge(advertisement.state)}
              </Flex>
              
              <Text>{advertisement.description}</Text>
              
              <Flex gap="3" align="center">
                <Flex gap="1" align="center">
                  <DollarSign size={16} />
                  <Text weight="bold">{formatCurrency(advertisement.amount)}</Text>
                </Flex>
                
                <Flex gap="1" align="center">
                  <Clock size={16} />
                  <Text size="2">{new Date(advertisement.createdAt).toLocaleDateString()}</Text>
                </Flex>
              </Flex>
              
              <Flex gap="1" align="center">
                <User size={16} />
                <Text size="2">
                  Created by: 
                  <Link to={`/marketplace/profile/${advertisement.creator}`} style={{ marginLeft: '4px' }}>
                    {formatAddress(advertisement.creator)}
                  </Link>
                </Text>
              </Flex>
              
              {advertisement.joinedBy && (
                <Flex gap="1" align="center">
                  <User size={16} />
                  <Text size="2">
                    Joined by: 
                    <Link to={`/marketplace/profile/${advertisement.joinedBy}`} style={{ marginLeft: '4px' }}>
                      {formatAddress(advertisement.joinedBy)}
                    </Link>
                  </Text>
                </Flex>
              )}
              
              <Flex gap="3" justify="end">
                {(advertisement.state === 1 || advertisement.state === 3) && (
                  <Button 
                    variant={showChat ? 'solid' : 'soft'}
                    onClick={() => setShowChat(!showChat)}
                  >
                    <MessageCircle size={16} />
                    {showChat ? 'Hide Chat' : 'Show Chat'}
                  </Button>
                )}
                
                <Button 
                  variant="soft" 
                  onClick={() => navigate('/marketplace')}
                >
                  Back to Marketplace
                </Button>
              </Flex>
            </Flex>
          </Card>
          
          {/* Chat Dialog */}
          <Dialog.Root open={showChat && selectedInteractionId !== undefined} onOpenChange={setShowChat}>
            <Dialog.Content style={{ 
              maxWidth: '90vw', 
              width: '90vw',
              maxHeight: '90vh',
              height: '90vh',
              padding: '24px'
            }}>
              <Flex direction="column" gap="3" style={{ height: '100%' }}>
                <Flex justify="between" align="center">
                  <Dialog.Title>
                    Chat with {formatAddress(isCreator() ? 
                      (userProfile?.interactions.find(i => i.id === selectedInteractionId)?.user || '') : 
                      advertisement.creator)}
                  </Dialog.Title>
                  <Dialog.Close>
                    <Button variant="ghost" color="gray">
                      <X size={18} />
                    </Button>
                  </Dialog.Close>
                </Flex>
                
                <Separator />
                
                {/* Show interaction history if user has multiple interactions */}
                {userProfile && userProfile.interactions.length > 1 && (
                  <Flex direction="column" gap="3">
                    <InteractionHistory 
                      interactions={userProfile.interactions}
                      onSelectInteraction={setSelectedInteractionId}
                      selectedInteractionId={selectedInteractionId}
                    />
                    <Separator size="4" />
                  </Flex>
                )}
                
                <Box style={{ flex: 1, minHeight: 0 }}>
                  <ChatWrapper 
                    advertisement={fullAdvertisement || {
                      id: advertisement.id,
                      title: advertisement.title,
                      description: advertisement.description,
                      amount: advertisement.amount,
                      creator: advertisement.creator,
                      createdAt: advertisement.createdAt,
                      userProfiles: advertisement.joinedBy && advertisement.userInteraction ? {
                        [advertisement.joinedBy]: {
                          user: advertisement.joinedBy,
                          interactions: [advertisement.userInteraction]
                        }
                      } : {}
                    } as AdvertisementType}
                    userAddress={userAddressFromState || currentAccount?.address || ''}
                    interactionId={selectedInteractionId}
                    isCreator={isCreatorFromState !== undefined ? isCreatorFromState : isCreator()}
                    isAdmin={false}
                    debugMode={true}
                    onMarkCompleted={showMarkCompletedDialog}
                    onDispute={showDisputeDialog}
                    onReleasePayment={showReleaseDialog}
                  />
                </Box>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </>
      ) : (
        <Text>Advertisement not found.</Text>
      )}
    </Flex>
  );
}
