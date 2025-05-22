import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { DisputeConfirmation, ReleasePaymentConfirmation, MarkCompletedConfirmation } from './components/ConfirmationDialogs';
import { useNetworkVariable } from './networkConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, DollarSign, User, MessageCircle, AlertCircle, CheckCircle, Users, X } from 'lucide-react';
import { Advertisement, Interaction, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from './types';
import { InteractionsList } from './InteractionsList';
import { ChatWrapper } from './components/ChatWrapper';
import { ScaledModalOverlay } from './components/ScaledPortal';
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
  routeMode: 'client' | 'seller';
}

export function MyAdvertisements({ routeMode }: MyAdvertisementsProps) {
  const navigate = useNavigate();
  const packageId = useNetworkVariable('packageId');
  const registryId = useNetworkVariable('registryId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  const [advertisements, setAdvertisements] = useState<DisplayAdvertisement[]>([]);
  const [filteredAds, setFilteredAds] = useState<DisplayAdvertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const [showInteractions, setShowInteractions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedAdvertisement, setSelectedAdvertisement] = useState<Advertisement | null>(null);
  
  const [showDisputeConfirmation, setShowDisputeConfirmation] = useState(false);
  const [showReleaseConfirmation, setShowReleaseConfirmation] = useState(false);
  const [showMarkCompletedConfirmation, setShowMarkCompletedConfirmation] = useState(false);
  const [disputeData, setDisputeData] = useState<{advertisementId: string, userAddress: string, interactionId: number} | null>(null);
  const [releaseData, setReleaseData] = useState<{advertisementId: string, interactionId: number} | null>(null);
  const [markCompletedData, setMarkCompletedData] = useState<{advertisementId: string, joinedBy: string, interactionId: number} | null>(null);
  const [isDisputing, setIsDisputing] = useState(false);
  
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
  
  useEffect(() => {
    const loadAdvertisements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (suiClient && currentAccount) {
          const allAdsRaw = await fetchAdvertisements(suiClient, packageId, registryId);
          let relevantAdsRaw: Advertisement[] = [];

          if (routeMode === 'seller') {
            relevantAdsRaw = getMyCreatedAdvertisements(allAdsRaw, currentAccount.address);
          } else {
            const joinedAdsRaw = getMyJoinedAdvertisements(allAdsRaw, currentAccount.address);
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
  
  useEffect(() => {
    let filtered = [...advertisements]; 
    
    if (routeMode === 'seller') {
      switch (activeTab) {
        case 'available':
          filtered = filtered.filter(ad => ad.state === 0 && !ad.userInteraction);
          break;
        case 'all':
          break;
        default:
          break;
      }
    } else {
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
          break;
        default:
          break;
      }
    }
    
    setFilteredAds(filtered);
  }, [advertisements, activeTab, routeMode, isLoading]);
  
  const getStateBadge = (state: number, userInteractionState?: number) => {
    if (state === 2 && userInteractionState === INTERACTION_SELLER_COMPLETED) {
      return <span className="design-badge design-badge-warning">Waiting Approval</span>;
    } else if (state === 2 && userInteractionState === INTERACTION_BUYER_APPROVED) {
      return <span className="design-badge design-badge-success">Finished</span>;
    }
    
    const stateInfo = getStateInfo(state);
    const colorClass = stateInfo.color === 'blue' ? 'design-badge-info' : 
                       stateInfo.color === 'green' ? 'design-badge-success' :
                       stateInfo.color === 'red' ? 'design-badge-error' :
                       stateInfo.color === 'yellow' ? 'design-badge-warning' : 'design-badge-info';
    
    return <span className={`design-badge ${colorClass}`}>{stateInfo.label}</span>;
  };
  
  const showMarkCompletedDialog = (advertisementId: string, joinedBy: string, interactionId: number) => {
    setMarkCompletedData({ advertisementId, joinedBy, interactionId });
    setShowMarkCompletedConfirmation(true);
  };
  
  const showDisputeDialog = (advertisementId: string, userAddress: string, interactionId: number) => {
    setDisputeData({ advertisementId, userAddress, interactionId });
    setShowDisputeConfirmation(true);
  };
  
  const showReleaseDialog = (advertisementId: string, interactionId: number) => {
    setReleaseData({ advertisementId, interactionId });
    setShowReleaseConfirmation(true);
  };
  
  const markCompleted = () => {
    if (!markCompletedData) return;
    
    const { advertisementId, joinedBy, interactionId } = markCompletedData;
    setShowMarkCompletedConfirmation(false);
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
  
  const cancelAdvertisement = (advertisementId: string) => {
    alert('Cancel advertisement functionality would be implemented in a real application');
  };
  
  const viewInteractions = async (advertisementId: string) => {
    try {
      if (suiClient) {
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
  
  const handleMarkCompletedFromList = (userAddress: string, interactionId: number) => {
    if (!selectedAdvertisement) return;
    showMarkCompletedDialog(selectedAdvertisement.id, userAddress, interactionId);
  };
  
  const handleReleasePayment = () => {
    if (!releaseData) return;
    
    const { advertisementId, interactionId } = releaseData;
    setShowReleaseConfirmation(false);
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
  
  const handleDispute = () => {
    if (!disputeData) return;
    
    const { advertisementId, userAddress, interactionId } = disputeData;
    setShowDisputeConfirmation(false);
    setIsDisputing(true);
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
    <div className="design-flex design-flex-col design-gap-6">
      <div className="design-flex design-flex-between" style={{ alignItems: 'center' }}>
        <h2 className="design-heading-2">
          {routeMode === 'client' ? 'My Deals' : 'My Listings'}
        </h2>
        {routeMode === 'seller' && (
          <Link to="/marketplace/create">
            <button className="design-button design-button-primary">Create New Listing</button>
          </Link>
        )}
      </div>
      
      <div className="design-card" style={{ padding: 'var(--space-4)' }}>
        <div className="design-flex design-gap-4" style={{ borderBottom: '1px solid var(--gray-5)', paddingBottom: 'var(--space-2)' }}>
          <button 
            className={`design-button ${activeTab === 'all' ? 'design-button-primary' : 'design-button-ghost'}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          
          {routeMode === 'seller' ? (
            <button 
              className={`design-button ${activeTab === 'available' ? 'design-button-primary' : 'design-button-ghost'}`}
              onClick={() => setActiveTab('available')}
            >
              Available
            </button>
          ) : (
            <>
              <button 
                className={`design-button ${activeTab === 'inProgress' ? 'design-button-primary' : 'design-button-ghost'}`}
                onClick={() => setActiveTab('inProgress')}
              >
                In Progress
              </button>
              <button 
                className={`design-button ${activeTab === 'waitingApproval' ? 'design-button-primary' : 'design-button-ghost'}`}
                onClick={() => setActiveTab('waitingApproval')}
              >
                Waiting Approval
              </button>
              <button 
                className={`design-button ${activeTab === 'finished' ? 'design-button-primary' : 'design-button-ghost'}`}
                onClick={() => setActiveTab('finished')}
              >
                Finished
              </button>
              <button 
                className={`design-button ${activeTab === 'disputed' ? 'design-button-primary' : 'design-button-ghost'}`}
                onClick={() => setActiveTab('disputed')}
              >
                Disputed
              </button>
            </>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="design-grid design-grid-responsive">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="design-card">
              <div className="design-flex design-flex-col design-gap-3">
                <div className="design-flex design-flex-between" style={{ alignItems: 'flex-start' }}>
                  <div className="design-skeleton" style={{ width: '60%', height: '24px' }}></div>
                  <div className="design-skeleton" style={{ width: '60px', height: '20px', borderRadius: 'var(--radius-sm)' }}></div>
                </div>
                <div className="design-skeleton" style={{ width: '100%', height: '16px' }}></div>
                <div className="design-skeleton" style={{ width: '90%', height: '16px' }}></div>
                <div className="design-flex design-gap-4" style={{ alignItems: 'center' }}>
                  <div className="design-skeleton" style={{ width: '80px', height: '20px' }}></div>
                  <div className="design-skeleton" style={{ width: '100px', height: '20px' }}></div>
                </div>
                <div className="design-flex design-flex-end design-gap-2">
                  <div className="design-skeleton" style={{ width: '80px', height: '32px' }}></div>
                  <div className="design-skeleton" style={{ width: '100px', height: '32px' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="design-card" style={{ padding: 'var(--space-6)', color: 'var(--red-9)' }}>
          {error}
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="design-card">
          <div className="design-empty-state">
            <div className="design-empty-state-icon">
              {routeMode === 'client' ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
                  <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                  <path d="M18 12c-1.1 0-2 .9-2 2s.9 2 2 2h4v-4h-4z" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              )}
            </div>
            <h3 className="design-heading-3" style={{ marginBottom: 'var(--space-2)' }}>
              {routeMode === 'client' 
                ? "You haven't joined any advertisements yet." 
                : "You haven't created any listings yet."}
            </h3>
            {routeMode === 'seller' ? (
              <Link to="/marketplace/create">
                <button className="design-button design-button-primary">Create Your First Listing</button>
              </Link>
            ) : (
              <Link to="/marketplace/browse">
                <button className="design-button design-button-primary">Browse Advertisements</button>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="design-flex design-flex-col design-gap-4">
          {filteredAds.map((ad) => (
            <div key={ad.id} className="design-card design-card-interactive">
              <div className="design-flex design-flex-col design-gap-4">
                <div className="design-flex design-flex-between" style={{ alignItems: 'flex-start' }}>
                  <h3 className="design-heading-3">{ad.title}</h3>
                  {getStateBadge(ad.state, ad.userInteraction?.state)}
                </div>
                
                <p style={{ 
                  color: 'var(--gray-11)', 
                  fontSize: '14px',
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  display: '-webkit-box', 
                  WebkitLineClamp: 2, 
                  WebkitBoxOrient: 'vertical',
                  minHeight: '40px',
                  lineHeight: 1.4
                }}>
                  {ad.description}
                </p>
                
                <div className="design-flex design-gap-4" style={{ alignItems: 'center' }}>
                  <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                    <DollarSign size={16} />
                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(ad.amount)}</span>
                  </div>
                  
                  <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                    <Clock size={16} />
                    <span style={{ fontSize: '14px' }}>{new Date(ad.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                {ad.joinedBy && (
                  <div className="design-flex design-gap-1" style={{ alignItems: 'center' }}>
                    <User size={16} />
                    <span style={{ fontSize: '14px' }}>
                      {routeMode === 'seller' && ad.joinedBy ? 'Interacting with: ' : 'Seller: '}
                      {routeMode === 'seller' && ad.joinedBy ? formatAddress(ad.joinedBy) : formatAddress(ad.creator)}
                    </span>
                  </div>
                )}
                
                <div className="design-flex design-gap-3 design-flex-end">
                  {routeMode === 'seller' && ad.creator === currentAccount?.address && (
                    <>
                      {ad.state === 0 && (
                        <button 
                          className="design-button design-button-secondary"
                          onClick={() => cancelAdvertisement(ad.id)}
                        >
                          Cancel Listing
                        </button>
                      )}
                      
                      {ad.userInteraction && ad.userInteraction.state === INTERACTION_JOINED && (
                        <>
                          <button 
                            className="design-button design-button-primary"
                            onClick={() => showMarkCompletedDialog(ad.id, ad.userInteraction!.user, ad.userInteraction!.id)}
                          >
                            <CheckCircle size={16} /> Mark Completed
                          </button>
                          <button 
                            className="design-button design-button-secondary"
                            onClick={() => showDisputeDialog(ad.id, ad.userInteraction!.user, ad.userInteraction!.id)}
                          >
                            <AlertCircle size={16} /> Dispute
                          </button>
                        </>
                      )}
                    </>
                  )}
                  
                  {routeMode === 'client' && ad.userInteraction && (
                    <>
                      {ad.userInteraction.state === INTERACTION_JOINED && (
                        <button 
                          className="design-button design-button-secondary"
                          onClick={() => showDisputeDialog(ad.id, currentAccount!.address, ad.userInteraction!.id)}
                        >
                          <AlertCircle size={16} /> Dispute
                        </button>
                      )}
                      
                      {ad.userInteraction.state === INTERACTION_SELLER_COMPLETED && (
                        <div className="design-flex design-gap-2">
                          <button 
                            className="design-button design-button-primary"
                            onClick={() => showReleaseDialog(ad.id, ad.userInteraction!.id)}
                          >
                            <CheckCircle size={16} /> Release Payment
                          </button>
                          <button 
                            className="design-button design-button-secondary"
                            onClick={() => showDisputeDialog(ad.id, currentAccount!.address, ad.userInteraction!.id)}
                          >
                            <AlertCircle size={16} /> Dispute
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  
                  {ad.userInteraction?.state === INTERACTION_DISPUTED && (
                    <button className="design-button design-button-secondary" disabled>
                      <AlertCircle size={16} /> Awaiting Resolution
                    </button>
                  )}
                  
                  {routeMode === 'seller' && ad.creator === currentAccount?.address && (
                    <button 
                      className="design-button design-button-secondary"
                      onClick={() => viewInteractions(ad.id)}
                    >
                      <Users size={16} /> View Interactions
                    </button>
                  )}
                  
                  {ad.userInteraction && (
                    <button 
                      className="design-button design-button-primary"
                      onClick={async (e: React.MouseEvent) => {
                        e.preventDefault();
                        
                        try {
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
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
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
      
      {/* Interactions Modal */}
      {showInteractions && selectedAdvertisement && (
        <ScaledModalOverlay onClose={() => setShowInteractions(false)}>
          <div className="design-card design-modal-content" style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: '90vw',
            padding: 'var(--space-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-3">
              <div className="design-flex design-flex-between" style={{ alignItems: 'center' }}>
                <h3 className="design-heading-3">
                  {selectedAdvertisement ? `Interactions for ${selectedAdvertisement.title}` : 'Interactions'}
                </h3>
                <button 
                  className="design-button design-button-ghost"
                  onClick={() => setShowInteractions(false)}
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="design-separator" style={{ margin: 'var(--space-2) 0' }}></div>
              
              <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                {selectedAdvertisement && currentAccount && (
                  <InteractionsList 
                    advertisement={selectedAdvertisement}
                    userAddress={currentAccount.address}
                    isCreator={selectedAdvertisement.creator === currentAccount.address}
                    onMarkCompleted={handleMarkCompletedFromList}
                  />
                )}
              </div>
            </div>
          </div>
        </ScaledModalOverlay>
      )}
      
      {/* Chat Modal */}
      {showChat && selectedAdvertisement && (
        <ScaledModalOverlay onClose={() => setShowChat(false)}>
          <div className="design-card design-modal-content" style={{
            width: '90vw',
            maxWidth: '1000px',
            maxHeight: '90vh',
            padding: 'var(--space-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-3">
              <div className="design-flex design-flex-between" style={{ alignItems: 'center' }}>
                <h4 className="design-heading-3">
                  Chat with {formatAddress(selectedAdvertisement.creator === currentAccount?.address 
                    ? (selectedAdvertisement.userProfiles[currentAccount.address]?.interactions.find(i => 
                        i.id === selectedAdvertisement.userProfiles[currentAccount.address]?.interactions[0].id)?.user || '') 
                    : selectedAdvertisement.creator)}
                </h4>
                <button className="design-button design-button-ghost" onClick={() => setShowChat(false)}>
                  <X size={18} />
                </button>
              </div>
              
              <div className="design-separator" style={{ margin: 'var(--space-2) 0' }}></div>
              
              <div style={{ height: '70vh' }}>
                <ChatWrapper 
                  advertisement={selectedAdvertisement}
                  userAddress={currentAccount?.address || ''}
                  interactionId={selectedAdvertisement.userProfiles[currentAccount?.address || '']?.interactions[0]?.id}
                  isCreator={selectedAdvertisement.creator === currentAccount?.address}
                  isAdmin={false}
                  debugMode={false}
                  onMarkCompleted={(userAddress: string, interactionId: number) => {
                    if (selectedAdvertisement) {
                      showMarkCompletedDialog(selectedAdvertisement.id, userAddress, interactionId);
                    }
                  }}
                  onDispute={(userAddress: string, interactionId: number) => {
                    if (selectedAdvertisement) {
                      showDisputeDialog(selectedAdvertisement.id, userAddress, interactionId);
                    }
                  }}
                  onReleasePayment={(interactionId: number) => {
                    if (selectedAdvertisement) {
                      showReleaseDialog(selectedAdvertisement.id, interactionId);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </ScaledModalOverlay>
      )}
    </div>
  );
}
