import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { getAllowlistedKeyServers, SealClient } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, Heading, Badge, Separator, Box, Tabs, Dialog } from '@radix-ui/themes';
import { DisputeConfirmation, ReleasePaymentConfirmation, MarkCompletedConfirmation, JoinAdvertisementConfirmation } from './components/ConfirmationDialogs';
import { useNetworkVariable } from './networkConfig';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, Clock, User, MessageCircle, AlertCircle, CheckCircle, ShieldAlert, History, X } from 'lucide-react';
import { InteractionActionButtons } from './components/InteractionActionButtons';
import { ChatWrapper } from './components/ChatWrapper';
import { Advertisement as AdvertisementType, Interaction, UserProfile, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from './types';
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

// Function to parse user profile from dynamic field object
const parseUserProfile = (content: any): UserProfile => {
  const fields = content.fields.value.fields;
  
  console.log({fields});

  const userProfile: UserProfile = {
    user: fields.user,
    interactions: []
  };
  
  // Parse interactions
  const interactions = fields.interactions || [];
  for (let i = 0; i < interactions.length; i++) {
    const interactionData = interactions[i]?.fields;
    
    console.log({interactionData});
    const interaction: Interaction = {
      id: Number(interactionData.id),
      user: interactionData.user,
      joinedAt: Number(interactionData.joined_at),
      seller: interactionData.seller,
      assignedAdmin: interactionData.assigned_admin,
      state: Number(interactionData.state),
      chatMessages: [],
      chatEphemeralKeyEncrypted: interactionData.chat_ephemeral_key_encrypted
    };
    
    // Parse chat messages if they exist
    if (interactionData.chat_messages) {
      for (const {fields: msgData} of interactionData.chat_messages) {
        const chatMessage = {
          id: msgData.id.id,
          advertisementId: msgData.advertisement_id,
          interactionUser: msgData.interaction_user,
          interactionId: Number(msgData.interaction_id),
          sender: msgData.sender,
          timestamp: Number(msgData.timestamp),
          messageEncryptedText: msgData.message_encrypted_text,
          messageBlobId: msgData.message_blob_id
        };
        
        interaction.chatMessages.push(chatMessage);
      }
    }
    
    userProfile.interactions.push(interaction);
  }
  
  return userProfile;
};
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
  const [nextInteractionId, setNextInteractionId] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Debug state to track chat initialization
  const [chatDebugInfo, setChatDebugInfo] = useState<{
    lastAction: string;
    timestamp: number;
    details: any;
  } | null>(null);
  
  // Helper function to log debug info
  const logChatDebug = (action: string, details: any = {}) => {
    console.log(`[ChatDebug] ${action}:`, details);
    setChatDebugInfo({
      lastAction: action,
      timestamp: Date.now(),
      details
    });
  };
  
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
  
  // Initialize SealClient
  useEffect(() => {
    if (currentAccount && suiClient) {
      // Create a new SealClient instance
      const client = new SealClient({
        suiClient,
        serverObjectIds: getAllowlistedKeyServers('testnet'),
        verifyKeyServers: false,
      });
      setSealClient(client);
    }
  }, [currentAccount, suiClient]);
  
  // Function to fetch user profile and determine interaction ID
  const fetchUserProfileAndDetermineInteractionId = async (
    advertisementId: string,
    userAddress: string
  ): Promise<{ profile: UserProfile | null; nextInteractionId: number }> => {
    try {
      // Get the advertisement object to find the user_profiles table ID
      const advertisementResponse = await suiClient.getObject({
        id: advertisementId,
        options: { showContent: true }
      });
      
      if (!advertisementResponse.data?.content) {
        return { profile: null, nextInteractionId: 0 };
      }
      
      const fields = (advertisementResponse.data.content as { fields: any }).fields;
      const user_profiles_table_id = fields.user_profiles?.fields?.id?.id;
      
      if (!user_profiles_table_id) {
        return { profile: null, nextInteractionId: 0 };
      }
      
      // Try to fetch the user's profile directly
      try {
        const userProfileObj = await suiClient.getDynamicFieldObject({
          parentId: user_profiles_table_id,
          name: { type: 'address', value: userAddress }
        });
        
        console.log('User profile object:', userProfileObj?.data?.content);

        if (userProfileObj.data?.content) {
          const profile = parseUserProfile(userProfileObj.data.content);
          // Next interaction ID is the length of the interactions array
          return { 
            profile, 
            nextInteractionId: profile.interactions.length 
          };
        }
      } catch (err) {
        console.log('User profile not found, this will be the first interaction');
      }
      
      // If we get here, the user has no profile yet
      return { profile: null, nextInteractionId: 0 };
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return { profile: null, nextInteractionId: 0 };
    }
  };

  // Load advertisement and user profile
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch advertisement from the blockchain
        if (id && suiClient && currentAccount) {
          const adData = await fetchAd(suiClient, id, packageId);
          
          if (adData) {
            // Advertisement found, clear any polling interval
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
              setRetryCount(0);
            }
            
            // Store the full advertisement data
            setFullAdvertisement(adData);
            
            // Convert to display format
            const displayAd = convertToDisplayAdvertisement(adData, currentAccount.address);
            setAdvertisement(displayAd);
            
            // Fetch user profile and determine next interaction ID
            const { profile, nextInteractionId: nextId } = await fetchUserProfileAndDetermineInteractionId(
              id,
              currentAccount.address
            );
            
            setUserProfile(profile);
            setNextInteractionId(nextId);
            
            // If user has interactions, select the latest one by default
            if (profile && profile.interactions.length > 0) {
              const latestInteraction = [...profile.interactions].sort((a, b) => b.id - a.id)[0];
              setSelectedInteractionId(latestInteraction.id);
              logChatDebug('Selected latest interaction', { 
                interactionId: latestInteraction.id,
                state: latestInteraction.state,
                joinedAt: new Date(latestInteraction.joinedAt).toISOString()
              });
            }
          } else {
            // Advertisement not found, start polling if not already polling
            if (!pollingInterval && retryCount < 12) { // Retry for up to 1 minute (12 * 5 seconds)
              console.log(`Advertisement not found, will retry in 5 seconds (attempt ${retryCount + 1}/12)`);
              setError(`Advertisement not found. Retrying... (${retryCount + 1}/12)`);
              
              // Increment retry count
              setRetryCount(prev => prev + 1);
              
              // If we're not already polling, start polling
              if (!pollingInterval) {
                console.log(`Starting polling for advertisement ${id} (attempt ${retryCount + 1}/12)`);
                const interval = setInterval(() => {
                  // This will trigger the useEffect again
                  setRetryCount(prev => prev + 1);
                }, 10000); // Poll every 10 seconds (increased from 5 seconds)
                
                setPollingInterval(interval);
              }
            } else if (retryCount >= 12) {
              // Stop polling after 12 attempts (1 minute)
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
              setError('Advertisement not found after multiple attempts. The transaction may still be processing or the advertisement ID may be incorrect.');
            }
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
    
    // Clean up interval on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [id, packageId, suiClient, currentAccount, retryCount]);
  
  // Get state badge
  const getStateBadge = (state: number) => {
    const stateInfo = getStateInfo(state);
    return <Badge color={stateInfo.color as any}>{stateInfo.label}</Badge>;
  };
  
  // Join advertisement
  const joinAdvertisement = async () => {
    if (!advertisement || !currentAccount || !suiClient || !sealClient) return;
    
    setIsJoining(true);
    setError(null);

    try {
      // Generate and encrypt ephemeral key for chat
      const { rawKey, encryptedKey } = await generateAndEncryptEphemeralKey(
        advertisement.id,
        currentAccount.address,
        nextInteractionId,
        sealClient,
        packageId
      );
      
      // Create transaction to join advertisement
      const tx = new Transaction();
      
      // Create a coin with the exact amount
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(advertisement.amount)]);
      
      tx.moveCall({
        target: `${packageId}::marketplace::join_advertisement_entry`,
        arguments: [
          tx.object(advertisement.id),
          coin,
          tx.pure.vector('u8', Array.from(encryptedKey)),
          tx.object('0x6'), // Clock object
        ],
      });
      
      tx.setGasBudget(10000000);
      
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log('Advertisement joined transaction successful:', result);
            setIsJoining(false); // Stop join loading indicator

            if (!currentAccount?.address || !id) {
              setError("Failed to finalize join: missing current account or advertisement ID.");
              return;
            }

            try {
              // Re-fetch advertisement data to get the latest state including the new interaction
              const updatedAdData = await fetchAd(suiClient, id, packageId);
              if (!updatedAdData) {
                setError("Failed to fetch updated advertisement data after joining.");
                return;
              }
              setFullAdvertisement(updatedAdData);
              const displayAd = convertToDisplayAdvertisement(updatedAdData, currentAccount.address);
              setAdvertisement(displayAd);

              // Find the newly created interaction for the current user
              const userProfileForAd = updatedAdData.userProfiles[currentAccount.address];
              const newInteraction = userProfileForAd?.interactions.sort((a, b) => b.id - a.id)[0];

              if (newInteraction && newInteraction.user === currentAccount.address) {
                console.log('Found new interaction:', newInteraction);
                // Store the ephemeral key with the definitive interaction ID and user
                storeEphemeralKey(advertisement.id, newInteraction.user, newInteraction.id, rawKey);
                
                // Update local state to reflect the new interaction for chat
                setSelectedInteractionId(newInteraction.id);
                setUserProfile(userProfileForAd); // Update user profile state
                
                // Update the DisplayAdvertisement's userInteraction field
                setAdvertisement(prev => prev ? {
                  ...prev,
                  state: 1, // Or derive from newInteraction.state
                  joinedBy: newInteraction.user,
                  interactionId: newInteraction.id,
                  userInteraction: newInteraction,
                } : null);

                setShowChat(true);
                logChatDebug('Joined and selected new interaction', { interactionId: newInteraction.id });

              } else {
                console.error("Could not find the newly created interaction for the current user or interaction user mismatch.");
                setError("Failed to identify new interaction details for chat setup.");
              }
            } catch (fetchError) {
              console.error("Error fetching updated advertisement data or processing new interaction:", fetchError);
              setError("Failed to update chat state after joining. Please refresh.");
            }
          },
          onError: (error) => {
            console.error('Error joining advertisement transaction:', error);
            setError('Failed to join advertisement. Please try again.');
            setIsJoining(false);
          },
        },
      );
    } catch (error) {
      console.error('Error preparing join transaction:', error);
      setError('Failed to prepare join transaction. Please try again.');
      setIsJoining(false);
    }
  };
  
  // State for confirmation dialogs
  const [showDisputeConfirmation, setShowDisputeConfirmation] = useState(false);
  const [showReleaseConfirmation, setShowReleaseConfirmation] = useState(false);
  const [showMarkCompletedConfirmation, setShowMarkCompletedConfirmation] = useState(false);
  const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
  const [disputeData, setDisputeData] = useState<{advertisementId: string, userAddress: string, interactionId: number} | null>(null);
  const [releaseData, setReleaseData] = useState<{advertisementId: string, interactionId: number} | null>(null);
  const [markCompletedData, setMarkCompletedData] = useState<{advertisementId: string, joinedBy: string, interactionId: number} | null>(null);
  
  // Show dispute confirmation dialog
  const showDisputeDialog = (userAddress: string, interactionId: number) => {
    console.log(`Showing dispute dialog for user ${userAddress}, interaction ${interactionId}`);
    setDisputeData({ 
      advertisementId: advertisement?.id || '', 
      userAddress, 
      interactionId 
    });
    setShowDisputeConfirmation(true);
  };
  
  // Show release payment confirmation dialog
  const showReleaseDialog = (interactionId: number) => {
    console.log(`Showing release payment dialog for interaction ${interactionId}`);
    setReleaseData({ 
      advertisementId: advertisement?.id || '', 
      interactionId 
    });
    setShowReleaseConfirmation(true);
  };
  
  // Show mark completed confirmation dialog
  const showMarkCompletedDialog = (userAddress: string, interactionId: number) => {
    console.log(`Showing mark completed dialog for user ${userAddress}, interaction ${interactionId}`);
    setMarkCompletedData({ 
      advertisementId: advertisement?.id || '', 
      joinedBy: userAddress, 
      interactionId 
    });
    setShowMarkCompletedConfirmation(true);
  };
  
  // Show join advertisement confirmation dialog
  const showJoinDialog = () => {
    setShowJoinConfirmation(true);
  };
  
  // Dispute advertisement
  const disputeAdvertisement = () => {
    if (!disputeData) return;
    
    const { advertisementId, userAddress, interactionId } = disputeData;
    
    setIsDisputing(true);
    setError(null);
    setShowDisputeConfirmation(false);
    
    console.log('Disputing advertisement with data:', disputeData);
    
    // Use the disputeInteraction function from api.ts
    const tx = disputeInteraction(
      packageId,
      advertisementId,
      userAddress,
      interactionId
    );
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Advertisement disputed:', result);
          
          // Update the advertisement state - using the same pattern as in MyAdvertisements.tsx
          if (advertisement) {
            setAdvertisement({
              ...advertisement,
              state: 3,
              userInteraction: advertisement.userInteraction ? {
                ...advertisement.userInteraction,
                state: INTERACTION_DISPUTED
              } : undefined
            });
          }
          
          setIsDisputing(false);
        },
        onError: (error) => {
          console.error('Error disputing advertisement:', error);
          setError('Failed to dispute advertisement. Please try again.');
          setIsDisputing(false);
        },
      },
    );
  };
  
  // Mark advertisement as completed
  const markCompleted = () => {
    if (!markCompletedData) return;
    
    const { advertisementId, joinedBy, interactionId } = markCompletedData;
    setShowMarkCompletedConfirmation(false);
    
    console.log('Marking advertisement as completed with data:', markCompletedData);
    
    // Use the markInteractionCompleted function from api.ts
    const tx = markInteractionCompleted(
      packageId,
      advertisementId,
      joinedBy,
      interactionId
    );
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Advertisement marked as completed:', result);
          
          // Update the advertisement state - using the same pattern as in MyAdvertisements.tsx
          if (advertisement) {
            setAdvertisement({
              ...advertisement,
              state: 2,
              userInteraction: advertisement.userInteraction ? {
                ...advertisement.userInteraction,
                state: INTERACTION_SELLER_COMPLETED
              } : undefined
            });
          }
        },
        onError: (error) => {
          console.error('Error marking advertisement as completed:', error);
          setError('Failed to mark advertisement as completed. Please try again.');
        },
      },
    );
  };
  
  // Release payment (buyer approves)
  const handleReleasePayment = () => {
    if (!releaseData) return;
    
    const { advertisementId, interactionId } = releaseData;
    setShowReleaseConfirmation(false);
    
    console.log('Releasing payment with data:', releaseData);
    
    // Use the releasePayment function from api.ts
    const tx = releasePayment(
      packageId,
      advertisementId,
      interactionId
    );
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Payment released:', result);
          
          // Update the advertisement state - using the same pattern as in MyAdvertisements.tsx
          if (advertisement) {
            setAdvertisement({
              ...advertisement,
              state: 2,
              userInteraction: advertisement.userInteraction ? {
                ...advertisement.userInteraction,
                state: INTERACTION_BUYER_APPROVED
              } : undefined
            });
          }
        },
        onError: (error) => {
          console.error('Error releasing payment:', error);
          setError('Failed to release payment. Please try again.');
        },
      },
    );
  };
  
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
  
  // Render action buttons based on state and user role
  const renderActionButtons = () => {
    if (!advertisement || !currentAccount) return null;
    
    // If user is neither creator nor joiner and advertisement is available
    if (!isCreator() && !isJoiner() && advertisement.state === 0) {
      return (
        <Button 
          onClick={showJoinDialog}
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join Advertisement'}
        </Button>
      );
    }
    
    // If user is the creator and advertisement is available
    if (isCreator() && advertisement.state === 0) {
      return (
        <Button 
          variant="soft" 
          color="red" 
          onClick={() => alert('Cancel advertisement functionality would be implemented in a real application')}
        >
          Cancel Advertisement
        </Button>
      );
    }
    
    // For interactions in progress, use the InteractionActionButtons component
    if (advertisement.userInteraction) {
      return (
        <InteractionActionButtons
          advertisement={fullAdvertisement || advertisement as any}
          interaction={advertisement.userInteraction}
          interactionUserAddress={advertisement.joinedBy || ''}
          isCreator={isCreator()}
          isAdmin={false}
          isDisputing={isDisputing}
          onMarkCompleted={showMarkCompletedDialog}
          onDispute={showDisputeDialog}
          onReleasePayment={showReleaseDialog}
        />
      );
    }
    
    return null;
  };
  
  return (
    <Flex direction="column" gap="4">
      {/* Shared Confirmation Dialogs */}
      <DisputeConfirmation 
        open={showDisputeConfirmation}
        onOpenChange={setShowDisputeConfirmation}
        onConfirm={disputeAdvertisement}
        isLoading={isDisputing}
      />
      
      <ReleasePaymentConfirmation 
        open={showReleaseConfirmation}
        onOpenChange={setShowReleaseConfirmation}
        onConfirm={handleReleasePayment}
        amount={advertisement?.amount || 0}
      />
      
      <MarkCompletedConfirmation 
        open={showMarkCompletedConfirmation}
        onOpenChange={setShowMarkCompletedConfirmation}
        onConfirm={markCompleted}
      />
      
      <JoinAdvertisementConfirmation 
        open={showJoinConfirmation}
        onOpenChange={setShowJoinConfirmation}
        onConfirm={joinAdvertisement}
        amount={advertisement?.amount || 0}
        isLoading={isJoining}
      />
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
                {renderActionButtons()}
                
                {(advertisement.state === 1 || advertisement.state === 3) && (
                  <Button 
                    variant={showChat ? 'solid' : 'soft'}
                    onClick={() => {
                      // Toggle chat visibility
                      const newShowChat = !showChat;
                      setShowChat(newShowChat);
                      
                      // If showing chat and no interaction is selected, try to select one
                      if (newShowChat && selectedInteractionId === undefined) {
                        // For creator, find the latest interaction from any user
                        if (isCreator() && fullAdvertisement) {
                          // Find all interactions across all user profiles
                          const allInteractions: Interaction[] = [];
                          
                          // Collect all interactions from all user profiles
                          Object.entries(fullAdvertisement.userProfiles).forEach(([address, profile]) => {
                            if (profile.interactions && profile.interactions.length > 0) {
                              allInteractions.push(...profile.interactions);
                            }
                          });
                          
                          // Sort all interactions by join date (newest first)
                          if (allInteractions.length > 0) {
                            const sortedInteractions = [...allInteractions].sort((a, b) => b.joinedAt - a.joinedAt);
                            const newestInteraction = sortedInteractions[0];
                            
                            logChatDebug('Creator selected interaction', { 
                              interactionId: newestInteraction.id,
                              user: newestInteraction.user,
                              joinedAt: new Date(newestInteraction.joinedAt).toISOString()
                            });
                            
                            setSelectedInteractionId(newestInteraction.id);
                          }
                        }
                        // For joiner, find their latest interaction
                        else if (isJoiner() && userProfile && userProfile.interactions.length > 0) {
                          const joinerLatestInteraction = [...userProfile.interactions].sort((a, b) => b.id - a.id)[0];
                          logChatDebug('Joiner selected interaction', { 
                            interactionId: joinerLatestInteraction.id 
                          });
                          setSelectedInteractionId(joinerLatestInteraction.id);
                        }
                      }
                    }}
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
          
          {/* Simple Chat Popup - Appears directly in the page */}
          {showChat && selectedInteractionId !== undefined && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Card style={{
                width: '80vw',
                maxWidth: '90vw',
                maxHeight: '90vh',
                padding: '20px',
                position: 'relative',
                zIndex: 9999,
              }}>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <Heading size="4">
                      Chat with {formatAddress(isCreator() ? 
                        (userProfile?.interactions.find(i => i.id === selectedInteractionId)?.user || '') : 
                        advertisement.creator)}
                    </Heading>
                    <Button variant="ghost" color="gray" onClick={() => setShowChat(false)}>
                      <X size={18} />
                    </Button>
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
                  
                  {/* Show action buttons for creating new interaction or continuing current */}
                  {userProfile && (
                    <Flex gap="3" justify="end">
                      {userProfile.interactions.length > 0 && 
                       getLatestInteraction(fullAdvertisement!, currentAccount!.address)?.state === INTERACTION_BUYER_APPROVED && (
                        <Button 
                          onClick={() => {
                            // Create a new interaction
                            joinAdvertisement();
                          }}
                        >
                          Create New Interaction
                        </Button>
                      )}
                      
                      {userProfile.interactions.length > 0 && 
                       getLatestInteraction(fullAdvertisement!, currentAccount!.address)?.state === INTERACTION_JOINED && (
                        <Button 
                          onClick={() => {
                            // Select the latest interaction
                            const latestInteraction = [...userProfile.interactions].sort((a, b) => b.id - a.id)[0];
                            setSelectedInteractionId(latestInteraction.id);
                          }}
                        >
                          Continue Current Interaction
                        </Button>
                      )}
                    </Flex>
                  )}
                  
                  <Box style={{ height: '60vh' }}>
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
              </Card>
            </div>
          )}
        </>
      ) : (
        <Text>Advertisement not found.</Text>
      )}
    </Flex>
  );
}
