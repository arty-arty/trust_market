import React from 'react';
import { CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { Advertisement, Interaction, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from '../types';

interface InteractionActionButtonsProps {
  advertisement: Advertisement;
  interaction: Interaction;
  interactionUserAddress: string;
  isCreator: boolean;
  isAdmin?: boolean;
  isDisputing?: boolean;
  size?: '1' | '2' | '3' | '4';
  onMarkCompleted: (userAddress: string, interactionId: number) => void;
  onDispute: (userAddress: string, interactionId: number) => void;
  onReleasePayment: (interactionId: number) => void;
}

export function InteractionActionButtons({
  advertisement,
  interaction,
  interactionUserAddress,
  isCreator,
  isAdmin = false,
  isDisputing = false,
  size = '2',
  onMarkCompleted,
  onDispute,
  onReleasePayment
}: InteractionActionButtonsProps) {
  // Determine which buttons to show based on interaction state and user role
  
  // Only show Mark as Completed button for sellers (creators) when interaction is in JOINED state
  const showMarkCompletedButton = isCreator && interaction.state === INTERACTION_JOINED;
  
  // Show Release Payment button for buyers when seller has marked as completed
  const showReleasePaymentButton = !isCreator && interaction.state === INTERACTION_SELLER_COMPLETED;
  
  // Show Dispute button for sellers in JOINED state
  const showSellerDisputeButton = isCreator && interaction.state === INTERACTION_JOINED;
  
  // Show Dispute button for both buyer and seller in SELLER_COMPLETED state
  const showDisputeButton = interaction.state === INTERACTION_SELLER_COMPLETED;
  
  // Show Resolve Dispute button for admins in DISPUTED state
  const showResolveDisputeButton = isAdmin && interaction.state === INTERACTION_DISPUTED;
  
  // Show Awaiting Resolution button for disputed interactions (disabled)
  const showAwaitingResolutionButton = interaction.state === INTERACTION_DISPUTED && !isAdmin;
  
  // Helper to determine icon size based on button size
  const getIconSize = () => {
    return size === '1' ? 14 : 16;
  };
  
  return (
    <div className="design-flex design-gap-2">
      {/* Mark as Completed button for sellers */}
      {showMarkCompletedButton && (
        <button 
          className="design-button design-button-primary"
          onClick={() => onMarkCompleted(interactionUserAddress, interaction.id)}
        >
          <CheckCircle size={getIconSize()} />
          Mark Completed
        </button>
      )}
      
      {/* Release Payment button for buyers */}
      {showReleasePaymentButton && (
        <button 
          className="design-button design-button-primary"
          onClick={() => onReleasePayment(interaction.id)}
        >
          <CheckCircle size={getIconSize()} />
          Release Payment
        </button>
      )}
      
      {/* Dispute button for sellers */}
      {showSellerDisputeButton && (
        <button 
          className="design-button design-button-secondary"
          onClick={() => {
            try {
              console.log('InteractionActionButtons: Calling onDispute (seller context)', { interactionUserAddress, interactionId: interaction.id });
              if (typeof onDispute === 'function') {
                onDispute(interactionUserAddress, interaction.id);
              } else {
                console.error('InteractionActionButtons: onDispute is not a function (seller context)');
              }
            } catch (e) {
              console.error('InteractionActionButtons: Error in onDispute call (seller context):', e);
              // Consider setting a local error state or re-throwing if an error boundary is expected to catch this
            }
          }}
          disabled={isDisputing}
        >
          <AlertCircle size={getIconSize()} />
          {isDisputing ? 'Disputing...' : 'Dispute'}
        </button>
      )}
      
      {/* Dispute button for both buyer and seller in SELLER_COMPLETED state */}
      {showDisputeButton && (
        <button 
          className="design-button design-button-secondary"
          onClick={() => {
            try {
              console.log('InteractionActionButtons: Calling onDispute (general context)', { interactionUserAddress, interactionId: interaction.id });
              if (typeof onDispute === 'function') {
                onDispute(interactionUserAddress, interaction.id);
              } else {
                console.error('InteractionActionButtons: onDispute is not a function (general context)');
              }
            } catch (e) {
              console.error('InteractionActionButtons: Error in onDispute call (general context):', e);
              // Consider setting a local error state or re-throwing
            }
          }}
          disabled={isDisputing}
        >
          <AlertCircle size={getIconSize()} />
          {isDisputing ? 'Disputing...' : 'Dispute'}
        </button>
      )}
      
      {/* Resolve Dispute button for admins */}
      {showResolveDisputeButton && (
        <button 
          className="design-button design-button-primary"
        >
          <ShieldAlert size={getIconSize()} />
          Resolve Dispute
        </button>
      )}
      
      {/* Awaiting Resolution button (disabled) */}
      {showAwaitingResolutionButton && (
        <button 
          className="design-button design-button-secondary"
          disabled
        >
          <ShieldAlert size={getIconSize()} />
          Awaiting Resolution
        </button>
      )}
    </div>
  );
}
