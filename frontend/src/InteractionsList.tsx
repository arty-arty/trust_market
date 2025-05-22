import React, { useState, useEffect, useMemo } from 'react';
import { useSuiClient, useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { useNetworkVariable } from './networkConfig';
import { Button, Card, Flex, Text, Heading, Badge, Box, Dialog, Separator, Tabs } from '@radix-ui/themes';
import { DisputeConfirmation, ReleasePaymentConfirmation, MarkCompletedConfirmation } from './components/ConfirmationDialogs';
import { Clock, User, MessageCircle, AlertCircle, CheckCircle, X, ShieldAlert } from 'lucide-react';
import { InteractionActionButtons } from './components/InteractionActionButtons';
import { Link, useNavigate } from 'react-router-dom';
import { Advertisement, Interaction, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from './types';
import { formatAddress, formatCurrency, fetchAdvertisement as fetchAd, disputeInteraction, releasePayment } from './api';
import { ChatWrapper } from './components/ChatWrapper';

interface InteractionsListProps {
  advertisement: Advertisement;
  userAddress: string;
  isCreator: boolean;
  onMarkCompleted: (userAddress: string, interactionId: number) => void;
}

export function InteractionsList({ 
  advertisement: initialAdvertisement, 
  userAddress, 
  isCreator,
  onMarkCompleted
}: InteractionsListProps) {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const packageId = useNetworkVariable('packageId');
  const [advertisement, setAdvertisement] = useState<Advertisement>(initialAdvertisement);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastPoll, setLastPoll] = useState(0);
  const [isDisputing, setIsDisputing] = useState(false);
  const [showDisputeConfirmation, setShowDisputeConfirmation] = useState(false);
  const [showReleaseConfirmation, setShowReleaseConfirmation] = useState(false);
  const [disputeInteractionData, setDisputeInteractionData] = useState<{userAddress: string, interactionId: number} | null>(null);
  const [releaseInteractionData, setReleaseInteractionData] = useState<{interactionId: number} | null>(null);
  const currentAccount = useCurrentAccount();
  
  // State for filtering interactions
  const [activeTab, setActiveTab] = useState('all');
  const [filteredInteractions, setFilteredInteractions] = useState<{ interaction: Interaction; userAddress: string }[]>([]);
  
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
  
  // Get all interactions from all user profiles, memoized to prevent unnecessary re-calculations
  const allInteractions = useMemo(() => {
    console.log('Recalculating allInteractions with useMemo');
    const interactionsArr: { interaction: Interaction; userAddress: string }[] = [];
    
    Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
      profile.interactions.forEach(interaction => {
        interactionsArr.push({
          interaction,
          userAddress: address
        });
      });
    });
    
    // Sort by joined_at (newest first)
    return interactionsArr.sort((a, b) => b.interaction.joinedAt - a.interaction.joinedAt);
  }, [advertisement.userProfiles]); // Dependency: only recalculate if userProfiles change
  
  // Filter interactions based on active tab
  useEffect(() => {
    console.log("Filtering interactions by tab:", activeTab);
    
    let filtered = [...allInteractions];
    
    switch (activeTab) {
      case 'inProgress':
        filtered = filtered.filter(item => item.interaction.state === INTERACTION_JOINED);
        break;
      case 'waitingApproval':
        filtered = filtered.filter(item => item.interaction.state === INTERACTION_SELLER_COMPLETED);
        break;
      case 'finished':
        filtered = filtered.filter(item => item.interaction.state === INTERACTION_BUYER_APPROVED);
        break;
      case 'disputed':
        filtered = filtered.filter(item => item.interaction.state === INTERACTION_DISPUTED);
        break;
      default:
        // 'all' tab, no filtering needed
        break;
    }
    
    console.log("Filtered interactions:", filtered.length);
    setFilteredInteractions(filtered);
  }, [allInteractions, activeTab]);
  
  // Use filtered interactions for rendering
  const interactions = activeTab === 'all' ? allInteractions : filteredInteractions;
  
  // Get state badge
  const getStateBadge = (state: number) => {
    switch (state) {
      case INTERACTION_JOINED:
        return <Badge color="blue">In Progress</Badge>;
      case INTERACTION_SELLER_COMPLETED:
        return <Badge color="yellow">Waiting Approval</Badge>;
      case INTERACTION_BUYER_APPROVED:
        return <Badge color="green">Completed</Badge>;
      case INTERACTION_DISPUTED:
        return <Badge color="red">Disputed</Badge>;
      default:
        return <Badge color="gray">Unknown</Badge>;
    }
  };
  
  // Set up polling for new messages
  useEffect(() => {
    // Only set up polling if we have a selected interaction and the chat is shown
    if (!selectedInteraction || !showChat || !suiClient || pollingInterval) {
      return;
    }
    
    console.log('Setting up message polling in InteractionsList');
    
    // Function to poll for updated advertisement data
    const pollForUpdates = async () => {
      try {
        // Only poll if it's been at least 30 seconds since the last poll
        const now = Date.now();
        if (now - lastPoll < 30000) {
          return;
        }
        
        console.log(`Polling for updated messages in InteractionsList at ${new Date().toLocaleTimeString()}...`);
        setLastPoll(now);
        
        // Store the last poll time in session storage to coordinate with other components
        sessionStorage.setItem(`last_poll_${advertisement.id}_${selectedInteraction.id}`, now.toString());
        
        // Fetch the full advertisement to get the latest data
        const adData = await fetchAd(suiClient, advertisement.id, packageId);
        if (adData) {
          // Check if the advertisement has changed
          const hasChanged = JSON.stringify(adData) !== JSON.stringify(advertisement);
          
          if (hasChanged) {
            console.log('Advertisement data has changed, updating in InteractionsList');
            setAdvertisement(adData);
            
            // Find the selected interaction in the updated data
            let updatedInteraction: Interaction | null = null;
            let interactionUserAddress = '';
            
            // Search through all user profiles to find the selected interaction
            Object.entries(adData.userProfiles).forEach(([address, profile]) => {
              const interaction = profile.interactions.find(i => 
                i.id === selectedInteraction.id && i.user === selectedInteraction.user
              );
              if (interaction) {
                updatedInteraction = interaction;
                interactionUserAddress = address;
              }
            });
            
            // Update the selected interaction if found
            if (updatedInteraction) {
              console.log('Found updated interaction in InteractionsList');
              setSelectedInteraction(updatedInteraction);
            }
          } else {
            console.log('No changes detected in advertisement data');
          }
        }
      } catch (err) {
        console.error('Error polling for updates in InteractionsList:', err);
      }
    };
    
    // Poll immediately
    pollForUpdates();
    
    // Set up interval to poll every 30 seconds (increased from 5 seconds)
    const interval = setInterval(pollForUpdates, 30000);
    setPollingInterval(interval);
    
    // Clean up interval on unmount or when chat is closed
    return () => {
      if (pollingInterval) {
        console.log('Cleaning up polling interval in InteractionsList');
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [advertisement.id, packageId, selectedInteraction, showChat, suiClient, lastPoll]);
  
  // Clean up polling when chat is closed
  useEffect(() => {
    if (!showChat && pollingInterval) {
      console.log('Cleaning up polling interval (chat closed) in InteractionsList');
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [showChat, pollingInterval]);
  
  // Handle view chat
  const handleViewChat = (interaction: Interaction, userAddress: string) => {
    // Prevent default behavior that might cause navigation
    console.log(`Opening chat for interaction #${interaction.id} with user ${userAddress}`);
    
    // Set the selected interaction and show chat dialog
    setSelectedInteraction(interaction);
    setShowChat(true);
  };
  
  // Show dispute confirmation dialog
  const showDisputeDialog = (userAddress: string, interactionId: number) => {
    try {
      console.log('InteractionsList: showDisputeDialog called', { userAddress, interactionId });
      setDisputeInteractionData({ userAddress, interactionId });
      setShowDisputeConfirmation(true);
      console.log('InteractionsList: showDisputeDialog completed successfully');
    } catch (e) {
      console.error('InteractionsList: Error in showDisputeDialog:', e);
      // Optionally, set an error state here to display a message to the user
      // For now, just logging, as the main symptom is UI disappearing.
    }
  };
  
  // Show release payment confirmation dialog
  const showReleaseDialog = (interactionId: number) => {
    setReleaseInteractionData({ interactionId });
    setShowReleaseConfirmation(true);
  };
  
  // Handle dispute
  const handleDispute = () => {
    if (!disputeInteractionData || !currentAccount) return;
    
    setIsDisputing(true);
    setShowDisputeConfirmation(false);
    
    // Use the disputeInteraction function from api.ts
    const tx = disputeInteraction(
      packageId,
      advertisement.id,
      disputeInteractionData.userAddress,
      disputeInteractionData.interactionId
    );
    
    try {
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log('Advertisement disputed successfully (InteractionsList):', result);
            
            const currentDisputeData = disputeInteractionData;

            setAdvertisement(prev => {
              if (!currentDisputeData) {
                console.error("Dispute data was null during state update in InteractionsList, aborting update.");
                return prev;
              }

              const updatedProfiles = { ...prev.userProfiles };
              let interactionFoundAndUpdated = false;
              
              Object.entries(updatedProfiles).forEach(([address, profile]) => {
                profile.interactions = profile.interactions.map(interaction => {
                  if (interaction.id === currentDisputeData.interactionId && 
                      address === currentDisputeData.userAddress) {
                    interactionFoundAndUpdated = true;
                    return { ...interaction, state: INTERACTION_DISPUTED };
                  }
                  return interaction;
                });
              });
              
              if (!interactionFoundAndUpdated) {
                console.warn(`Disputed interaction (ID: ${currentDisputeData.interactionId}, User: ${currentDisputeData.userAddress}) not found in local state for update (InteractionsList).`);
              }
              
              return { ...prev, userProfiles: updatedProfiles };
            });
            
            setIsDisputing(false);
            setDisputeInteractionData(null);
          },
          onError: (error) => {
            console.error('Error disputing advertisement via signAndExecute onError (InteractionsList):', error);
            // TODO: Consider adding a user-facing error message here if the component had a generic error display state
            setIsDisputing(false);
            setDisputeInteractionData(null);
          },
        },
      );
    } catch (e) {
      console.error('Synchronous error during dispute transaction execution (InteractionsList):', e);
      // TODO: Consider adding a user-facing error message here
      setIsDisputing(false);
      setDisputeInteractionData(null);
    }
  };
  
  // Handle release payment
  const handleReleasePayment = () => {
    if (!releaseInteractionData || !currentAccount) return;
    
    setShowReleaseConfirmation(false);
    
    // Use the releasePayment function from api.ts
    const tx = releasePayment(
      packageId,
      advertisement.id,
      releaseInteractionData.interactionId
    );
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Payment released:', result);
          
          // Update the advertisement state in the local state
          setAdvertisement(prev => {
            const updatedProfiles = { ...prev.userProfiles };
            
            // Find and update the interaction
            Object.entries(updatedProfiles).forEach(([address, profile]) => {
              profile.interactions = profile.interactions.map(interaction => {
                if (interaction.id === releaseInteractionData?.interactionId) {
                  return { ...interaction, state: INTERACTION_BUYER_APPROVED };
                }
                return interaction;
              });
            });
            
            return { ...prev, userProfiles: updatedProfiles };
          });
          
          setReleaseInteractionData(null);
        },
        onError: (error) => {
          console.error('Error releasing payment:', error);
          setReleaseInteractionData(null);
        },
      },
    );
  };
  
  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="4">Interactions ({interactions.length})</Heading>
      </Flex>
      
      {/* Filtering tabs for seller view */}
      {isCreator && (
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Trigger value="all">All</Tabs.Trigger>
            <Tabs.Trigger value="inProgress">In Progress</Tabs.Trigger>
            <Tabs.Trigger value="waitingApproval">Waiting Approval</Tabs.Trigger>
            <Tabs.Trigger value="finished">Finished</Tabs.Trigger>
            <Tabs.Trigger value="disputed">Disputed</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      )}
      
      {interactions.length === 0 ? (
        <Card>
          <Text>No interactions yet.</Text>
        </Card>
      ) : (
        interactions.map(({ interaction, userAddress: interactionUserAddress }) => (
          <Card key={`${interactionUserAddress}-${interaction.id}`}>
            <Flex direction="column" gap="2">
              <Flex justify="between" align="center">
                <Flex gap="2" align="center">
                  <User size={16} />
                  <Text>
                    User: {formatAddress(interactionUserAddress)}
                  </Text>
                </Flex>
                {getStateBadge(interaction.state)}
              </Flex>
              
              <Flex gap="3" align="center">
                <Flex gap="1" align="center">
                  <Clock size={16} />
                  <Text size="2">Joined: {new Date(interaction.joinedAt).toLocaleDateString()}</Text>
                </Flex>
                
                <Flex gap="1" align="center">
                  <Text size="2">Interaction #{interaction.id}</Text>
                </Flex>
              </Flex>
              
              <Flex gap="2" justify="end">
                {/* Use the reusable InteractionActionButtons component */}
                <InteractionActionButtons
                  advertisement={advertisement}
                  interaction={interaction}
                  interactionUserAddress={interactionUserAddress}
                  isCreator={isCreator}
                  isAdmin={false}
                  isDisputing={isDisputing}
                  onMarkCompleted={onMarkCompleted}
                  onDispute={showDisputeDialog}
                  onReleasePayment={showReleaseDialog}
                />
                
                <Button 
                  onClick={(e) => {
                    // Prevent event bubbling that might trigger navigation
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChat(interaction, interactionUserAddress);
                  }}
                >
                  <MessageCircle size={16} />
                  View Chat
                </Button>
              </Flex>
            </Flex>
          </Card>
        ))
      )}
      
      {/* Shared Confirmation Dialogs */}
      <DisputeConfirmation 
        open={showDisputeConfirmation}
        onOpenChange={setShowDisputeConfirmation}
        onConfirm={handleDispute}
        isLoading={isDisputing}
      />
      
      <ReleasePaymentConfirmation 
        open={showReleaseConfirmation}
        onOpenChange={setShowReleaseConfirmation}
        onConfirm={handleReleasePayment}
        amount={advertisement.amount}
      />
      
      {/* Simple Chat Popup - Appears directly in the page */}
      {showChat && selectedInteraction && (
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
                  Chat with {formatAddress(isCreator ? selectedInteraction.user : advertisement.creator)}
                </Heading>
                <Button variant="ghost" color="gray" onClick={() => setShowChat(false)}>
                  <X size={18} />
                </Button>
              </Flex>
              
              <Separator />
              
              <Box style={{ height: '70vh' }}>
                <ChatWrapper 
                  advertisement={advertisement}
                  userAddress={isCreator ? selectedInteraction.user : currentAccount?.address || ''}
                  interactionId={selectedInteraction.id}
                  isCreator={isCreator}
                  isAdmin={false}
                  debugMode={true}
                  onMarkCompleted={onMarkCompleted}
                  onDispute={showDisputeDialog}
                  onReleasePayment={showReleaseDialog}
                />
              </Box>
            </Flex>
          </Card>
        </div>
      )}
    </Flex>
  );
}
