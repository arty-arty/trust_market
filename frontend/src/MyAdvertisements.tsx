import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, Heading, Badge, Tabs, Box, Dialog, Separator } from '@radix-ui/themes';
import { DisputeConfirmation, ReleasePaymentConfirmation, MarkCompletedConfirmation } from './components/ConfirmationDialogs';
import { useNetworkVariable } from './networkConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, DollarSign, User, MessageCircle, AlertCircle, CheckCircle, Users, X } from 'lucide-react';
import { Advertisement, Interaction, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from './types';
import { InteractionsList } from './InteractionsList';
import { ChatWrapper } from './components/ChatWrapper';
import { 
  fetchAdvertisements, 
  getMyCreatedAdvertisements, 
  getMyJoinedAdvertisements, 
  markInteractionCompleted,
  releasePayment,
  disputeInteraction,
  formatCurrency,
  formatAddress,
  getStateInfo,
  DisplayAdvertisement,
  convertToDisplayAdvertisement
} from './api';

interface MyAdvertisementsProps {
  routeMode: 'client' | 'seller'; // This prop is now required and set by the router
}

export function MyAdvertisements({ routeMode }: MyAdvertisementsProps) {
  const navigate = useNavigate();
  const packageId = useNetworkVariable('packageId');
  const registryId = useNetworkVariable('registryId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  // State for advertisements - this will hold either created or joined ads based on routeMode
  const [advertisements, setAdvertisements] = useState<DisplayAdvertisement[]>([]);
  const [filteredAds, setFilteredAds] = useState<DisplayAdvertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  // State for interactions dialog and chat dialog
  const [showInteractions, setShowInteractions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedAdvertisement, setSelectedAdvertisement] = useState<Advertisement | null>(null);
  
  // State for confirmation dialogs
  const [showDisputeConfirmation, setShowDisputeConfirmation] = useState(false);
  const [showReleaseConfirmation, setShowReleaseConfirmation] = useState(false);
  const [showMarkCompletedConfirmation, setShowMarkCompletedConfirmation] = useState(false);
  const [disputeData, setDisputeData] = useState<{advertisementId: string, userAddress: string, interactionId: number} | null>(null);
  const [releaseData, setReleaseData] = useState<{advertisementId: string, interactionId: number} | null>(null);
  const [markCompletedData, setMarkCompletedData] = useState<{advertisementId: string, joinedBy: string, interactionId: number} | null>(null);
  const [isDisputing, setIsDisputing] = useState(false);
  
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
  
  // Load advertisements
  useEffect(() => {
    const loadAdvertisements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (suiClient && currentAccount) {
          const allAdsRaw = await fetchAdvertisements(suiClient, packageId, registryId);
          let relevantAdsRaw: Advertisement[] = [];

          if (routeMode === 'seller') { // Freelancer mode ("My Listings")
            relevantAdsRaw = getMyCreatedAdvertisements(allAdsRaw, currentAccount.address);
          } else { // Client mode ("My Deals")
            const joinedAdsRaw = getMyJoinedAdvertisements(allAdsRaw, currentAccount.address);
            // Ensure client doesn't see ads they created, even if they interacted with them
            relevantAdsRaw = joinedAdsRaw.filter(ad => ad.creator !== currentAccount.address);
          }
          
          const displayAds = relevantAdsRaw.map(ad => convertToDisplayAdvertisement(ad, currentAccount.address));
          setAdvertisements(displayAds);
          setFilteredAds(displayAds); 
        } else {
          setAdvertisements([]); 
          setFilteredAds([]);
        }
        setIsLoading(false);
      } catch (err) {
        console.error(`Error fetching data for ${routeMode} mode:`, err);
        setError(`Failed to load your ${routeMode === 'client' ? 'deals' : 'listings'}. Please try again.`);
        setIsLoading(false);
      }
    };
    
    loadAdvertisements();
  }, [currentAccount, packageId, registryId, suiClient, routeMode]);
  
  // Filter advertisements based on active tab
  useEffect(() => {
    let filtered = [...advertisements]; 
    
    if (routeMode === 'seller') {
      switch (activeTab) {
        case 'available':
          // For sellers, 'available' means their listings with no interactions yet.
          // ad.state from convertToDisplayAdvertisement for a created ad with no interactions should be 0.
          filtered = filtered.filter(ad => ad.state === 0 && !ad.userInteraction);
          break;
        case 'all':
          // For sellers, 'all' shows all their created listings. No additional filtering needed here.
          break;
        default:
          // For seller, if any other tab is somehow selected, show all (or could be an empty list)
          // This case should ideally not be reached if tabs are correctly hidden.
          break;
      }
    } else { // client mode
      switch (activeTab) {
        case 'inProgress':
          filtered = filtered.filter(ad => ad.userInteraction?.state === INTERACTION_JOINED);
          break;
        case 'waitingApproval': 
          filtered = filtered.filter(ad => ad.userInteraction?.state === INTERACTION_SELLER_COMPLETED);
          break;
        case 'finished': 
          filtered = filtered.filter(ad => ad.userInteraction?.state === INTERACTION_BUYER_APPROVED);
          break;
        case 'disputed':
          filtered = filtered.filter(ad => ad.userInteraction?.state === INTERACTION_DISPUTED);
          break;
        case 'all':
          // For clients, 'all' shows all their interacted deals. No additional state filtering needed here
          // as the initial `advertisements` list for clients already contains only their deals.
          break;
        default:
          break;
      }
    }
    
    setFilteredAds(filtered);
  }, [advertisements, activeTab, routeMode, isLoading]);
  
  // Get state badge
  const getStateBadge = (state: number, userInteractionState?: number) => {
    // For state 2 (completed), we need to check the interaction state to determine if it's "Waiting Approval" or "Finished"
    if (state === 2 && userInteractionState === INTERACTION_SELLER_COMPLETED) {
      return <Badge color="yellow">Waiting Approval</Badge>;
    } else if (state === 2 && userInteractionState === INTERACTION_BUYER_APPROVED) {
      return <Badge color="green">Finished</Badge>;
    }
    
    const stateInfo = getStateInfo(state);
    return <Badge color={stateInfo.color as any}>{stateInfo.label}</Badge>;
  };
  
  // Show mark completed confirmation dialog
  const showMarkCompletedDialog = (advertisementId: string, joinedBy: string, interactionId: number) => {
    setMarkCompletedData({ advertisementId, joinedBy, interactionId });
    setShowMarkCompletedConfirmation(true);
  };
  
  // Show dispute confirmation dialog
  const showDisputeDialog = (advertisementId: string, userAddress: string, interactionId: number) => {
    setDisputeData({ advertisementId, userAddress, interactionId });
    setShowDisputeConfirmation(true);
  };
  
  // Show release payment confirmation dialog
  const showReleaseDialog = (advertisementId: string, interactionId: number) => {
    setReleaseData({ advertisementId, interactionId });
    setShowReleaseConfirmation(true);
  };
  
  // Mark advertisement as completed
  const markCompleted = () => {
    if (!markCompletedData) return;
    
    const { advertisementId, joinedBy, interactionId } = markCompletedData;
    setShowMarkCompletedConfirmation(false);
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
          // Update the advertisement state
          setAdvertisements(prev => 
            prev.map(ad => 
              ad.id === advertisementId 
                ? { ...ad, state: 2, userInteraction: ad.userInteraction ? { ...ad.userInteraction, state: INTERACTION_SELLER_COMPLETED } : undefined } 
                : ad
            )
          );
        },
        onError: (error) => {
          console.error('Error marking advertisement as completed:', error);
          setError('Failed to mark advertisement as completed. Please try again.');
        },
      },
    );
  };
  
  // Cancel advertisement (not implemented in the contract yet)
  const cancelAdvertisement = (advertisementId: string) => {
    // This would be implemented in a real application
    alert('Cancel advertisement functionality would be implemented in a real application');
  };
  
  // View interactions for an advertisement
  const viewInteractions = async (advertisementId: string) => {
    try {
      if (suiClient) {
        // Fetch the full advertisement data
        const adData = await fetchAdvertisements(suiClient, packageId, registryId);
        const ad = adData.find(a => a.id === advertisementId);
        
        if (ad) {
          setSelectedAdvertisement(ad);
          setShowInteractions(true);
        } else {
          setError('Advertisement not found.');
        }
      }
    } catch (err) {
      console.error('Error fetching advertisement details:', err);
      setError('Failed to load advertisement details. Please try again.');
    }
  };
  
  // Handle mark completed from interactions list
  const handleMarkCompletedFromList = (userAddress: string, interactionId: number) => {
    if (!selectedAdvertisement) return;
    // This function is called from InteractionsList, selectedAdvertisement is the one whose interactions are shown
    showMarkCompletedDialog(selectedAdvertisement.id, userAddress, interactionId);
  };
  
  // Handle release payment (buyer approves completion)
  const handleReleasePayment = () => {
    if (!releaseData) return;
    
    const { advertisementId, interactionId } = releaseData;
    setShowReleaseConfirmation(false);
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
          // Update the advertisement state
          setAdvertisements(prev => 
            prev.map(ad => 
              ad.id === advertisementId 
                ? { ...ad, state: 2, userInteraction: ad.userInteraction ? { ...ad.userInteraction, state: INTERACTION_BUYER_APPROVED } : undefined } 
                : ad
            )
          );
        },
        onError: (error) => {
          console.error('Error releasing payment:', error);
          setError('Failed to release payment. Please try again.');
        },
      },
    );
  };
  
  // Handle dispute (either buyer or seller can dispute)
  const handleDispute = () => {
    if (!disputeData) return;
    
    const { advertisementId, userAddress, interactionId } = disputeData;
    setShowDisputeConfirmation(false);
    setIsDisputing(true);
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
          // Update the advertisement state
          setAdvertisements(prev => 
            prev.map(ad => 
              ad.id === advertisementId 
                ? { ...ad, state: 3, userInteraction: ad.userInteraction ? { ...ad.userInteraction, state: INTERACTION_DISPUTED } : undefined } 
                : ad
            )
          );
        },
        onError: (error) => {
          console.error('Error disputing advertisement:', error);
          setError('Failed to dispute advertisement. Please try again.');
        },
      },
    );
  };
  
  return (
    <Flex direction="column" gap="4">
      <Flex justify="between" align="center">
        <Heading size="5">
          {routeMode === 'client' ? 'My Deals' : 'My Listings'}
        </Heading>
        {routeMode === 'seller' && (
          <Link to="/marketplace/create">
            <Button>Create New Listing</Button>
          </Link>
        )}
         {/* This button is part of the empty state now, so removed from here */}
      </Flex>
      
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="all">All</Tabs.Trigger>
          {routeMode === 'seller' ? (
            <Tabs.Trigger value="available">Available</Tabs.Trigger>
            // Other tabs like "In Progress", "Disputed" for seller's listings 
            // will show ads that have interactions. User clicks "View Interactions" for details.
          ) : ( // Client mode tabs
            <>
              <Tabs.Trigger value="inProgress">In Progress</Tabs.Trigger>
              <Tabs.Trigger value="waitingApproval">Waiting Approval</Tabs.Trigger>
              <Tabs.Trigger value="finished">Finished</Tabs.Trigger>
              <Tabs.Trigger value="disputed">Disputed</Tabs.Trigger>
            </>
          )}
        </Tabs.List>
      </Tabs.Root>
      
      {isLoading ? (
        <Text>Loading {routeMode === 'client' ? 'your deals' : 'your listings'}...</Text>
      ) : error ? (
        <Text color="red">{error}</Text>
      ) : filteredAds.length === 0 ? (
        <Card>
          <Flex direction="column" gap="3" align="center" justify="center" style={{ padding: '32px' }}>
            <Text>
              {routeMode === 'client' 
                ? "You haven't joined any advertisements yet." 
                : "You haven't created any listings yet."}
            </Text>
            {routeMode === 'seller' ? (
              <Link to="/marketplace/create">
                <Button>Create Your First Listing</Button>
              </Link>
            ) : (
              <Link to="/marketplace/browse">
                <Button>Browse Advertisements</Button>
              </Link>
            )}
          </Flex>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {filteredAds.map((ad) => (
            <Card key={ad.id}>
              <Flex direction="column" gap="3">
                <Flex justify="between" align="start">
                  <Heading size="3">{ad.title}</Heading>
                  {getStateBadge(ad.state, ad.userInteraction?.state)}
                </Flex>
                
                <Text size="2">{ad.description}</Text>
                
                <Flex gap="3" align="center">
                  <Flex gap="1" align="center">
                    <DollarSign size={16} />
                    <Text weight="bold">{formatCurrency(ad.amount)}</Text>
                  </Flex>
                  
                  <Flex gap="1" align="center">
                    <Clock size={16} />
                    <Text size="2">{new Date(ad.createdAt).toLocaleDateString()}</Text>
                  </Flex>
                </Flex>
                
                {ad.joinedBy && (
                  <Flex gap="1" align="center">
                    <User size={16} />
                    <Text size="2">
                      {/* Seller view: show who they are interacting with (joinedBy) */}
                      {/* Client view: show who the seller is (creator) */}
                      {routeMode === 'seller' && ad.joinedBy ? 'Interacting with: ' : 'Seller: '}
                      {routeMode === 'seller' && ad.joinedBy ? formatAddress(ad.joinedBy) : formatAddress(ad.creator)}
                    </Text>
                  </Flex>
                )}
                
                <Flex gap="3" justify="end">
                  {/* Seller (Freelancer) specific actions on their listings */}
                  {routeMode === 'seller' && ad.creator === currentAccount?.address && (
                    <>
                      {ad.state === 0 && ( // Available listing (no interaction yet)
                        <Button 
                          variant="soft" 
                          color="red" 
                          onClick={() => cancelAdvertisement(ad.id)}
                        >
                          Cancel Listing
                        </Button>
                      )}
                      
                      {/* Actions for listings with interactions */}
                      {ad.userInteraction && ad.userInteraction.state === INTERACTION_JOINED && (
                        <>
                          <Button 
                            color="green" 
                            onClick={() => showMarkCompletedDialog(ad.id, ad.userInteraction!.user, ad.userInteraction!.id)}
                          >
                            <CheckCircle size={16} /> Mark Completed
                          </Button>
                          <Button 
                            color="red" variant="soft"
                            onClick={() => showDisputeDialog(ad.id, ad.userInteraction!.user, ad.userInteraction!.id)}
                          >
                            <AlertCircle size={16} /> Dispute
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Client (Buyer) specific actions on ads they've joined */}
                  {routeMode === 'client' && ad.userInteraction && (
                    <>
                      {ad.userInteraction.state === INTERACTION_JOINED && (
                        <Button 
                          color="red" variant="soft"
                          onClick={() => showDisputeDialog(ad.id, currentAccount!.address, ad.userInteraction!.id)}
                        >
                          <AlertCircle size={16} /> Dispute
                        </Button>
                      )}
                      
                      {ad.userInteraction.state === INTERACTION_SELLER_COMPLETED && (
                        <Flex gap="2">
                          <Button 
                            color="green" 
                            onClick={() => showReleaseDialog(ad.id, ad.userInteraction!.id)}
                          >
                            <CheckCircle size={16} /> Release Payment
                          </Button>
                          <Button 
                            color="red" variant="soft"
                            onClick={() => showDisputeDialog(ad.id, currentAccount!.address, ad.userInteraction!.id)}
                          >
                            <AlertCircle size={16} /> Dispute
                          </Button>
                        </Flex>
                      )}
                    </>
                  )}
                  
                  {/* Common: Awaiting Resolution for disputed interactions */}
                  {ad.userInteraction?.state === INTERACTION_DISPUTED && (
                    <Button color="red" variant="soft" disabled>
                      <AlertCircle size={16} /> Awaiting Resolution
                    </Button>
                  )}
                  
                  {/* View Interactions: For sellers to see all interactions on their ad */}
                  {routeMode === 'seller' && ad.creator === currentAccount?.address && (
                    <Button onClick={() => viewInteractions(ad.id)}>
                      <Users size={16} /> View Interactions
                    </Button>
                  )}
                  
                  {/* Chat button: if there's an interaction */}
                  {ad.userInteraction && ( // Simpler check, as userInteraction implies an interaction for both roles on this page
                    <Button 
                      onClick={async (e) => {
                        // Instead of navigating to a new URL, fetch the full advertisement
                        // and open the chat dialog directly on this page
                        e.preventDefault();
                        
                        try {
                          // Fetch the full advertisement data which includes userProfiles
                          const adData = await fetchAdvertisements(suiClient, packageId, registryId);
                          const fullAd = adData.find(a => a.id === ad.id);
                          
                          if (fullAd) {
                            setSelectedAdvertisement(fullAd);
                            setShowChat(true);
                          } else {
                            setError('Could not find advertisement details.');
                          }
                        } catch (err) {
                          console.error('Error fetching advertisement for chat:', err);
                          setError('Failed to load chat details.');
                        }
                      }} 
                    >
                      <MessageCircle size={16} />
                      Chat
                    </Button>
                  )}
                  
                  {/* View Details button disabled as requested
                  <Button 
                    variant="soft" 
                    onClick={() => navigate(`/marketplace/advertisement/${ad.id}`)}
                  >
                    View Details
                  </Button>
                  */}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
      
      {/* Confirmation Dialogs */}
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
        amount={releaseData?.advertisementId ? advertisements.find(ad => ad.id === releaseData.advertisementId)?.amount || 0 : 0}
      />
      
      <MarkCompletedConfirmation 
        open={showMarkCompletedConfirmation}
        onOpenChange={setShowMarkCompletedConfirmation}
        onConfirm={markCompleted}
      />
      
      {/* Interactions Dialog */}
      <Dialog.Root open={showInteractions} onOpenChange={setShowInteractions}>
        <Dialog.Content style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Dialog.Title>
                {selectedAdvertisement ? `Interactions for ${selectedAdvertisement.title}` : 'Interactions'}
              </Dialog.Title>
              <Dialog.Close>
                <Button variant="ghost" color="gray">
                  <X size={18} />
                </Button>
              </Dialog.Close>
            </Flex>
            
            <Separator />
            
            <Box style={{ maxHeight: '70vh', overflow: 'auto' }}>
              {selectedAdvertisement && currentAccount && (
                <InteractionsList 
                  advertisement={selectedAdvertisement}
                  userAddress={currentAccount.address}
                  isCreator={selectedAdvertisement.creator === currentAccount.address}
                  onMarkCompleted={handleMarkCompletedFromList}
                />
              )}
            </Box>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      
      {/* Chat Dialog */}
      {showChat && selectedAdvertisement && (
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
                  Chat with {formatAddress(selectedAdvertisement.creator === currentAccount?.address 
                    ? (selectedAdvertisement.userProfiles[currentAccount.address]?.interactions.find(i => i.id === selectedAdvertisement.userProfiles[currentAccount.address]?.interactions[0].id)?.user || '') 
                    : selectedAdvertisement.creator)}
                </Heading>
                <Button variant="ghost" color="gray" onClick={() => setShowChat(false)}>
                  <X size={18} />
                </Button>
              </Flex>
              
              <Separator />
              
              <Box style={{ height: '70vh' }}>
                <ChatWrapper 
                  advertisement={selectedAdvertisement}
                  userAddress={currentAccount?.address || ''}
                  interactionId={selectedAdvertisement.userProfiles[currentAccount?.address || '']?.interactions[0]?.id}
                  isCreator={selectedAdvertisement.creator === currentAccount?.address}
                  isAdmin={false}
                  debugMode={false}
                  onMarkCompleted={(userAddress, interactionId) => {
                    if (selectedAdvertisement) {
                      showMarkCompletedDialog(selectedAdvertisement.id, userAddress, interactionId);
                    }
                  }}
                  onDispute={(userAddress, interactionId) => {
                    if (selectedAdvertisement) {
                      showDisputeDialog(selectedAdvertisement.id, userAddress, interactionId);
                    }
                  }}
                  onReleasePayment={(interactionId) => {
                    if (selectedAdvertisement) {
                      showReleaseDialog(selectedAdvertisement.id, interactionId);
                    }
                  }}
                />
              </Box>
            </Flex>
          </Card>
        </div>
      )}
    </Flex>
  );
}
