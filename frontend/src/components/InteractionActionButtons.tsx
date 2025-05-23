import React from 'react';
import { Button, Flex } from '@radix-ui/themes';
import { CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { Advertisement, Interaction, STATE_AVAILABLE, STATE_JOINED, STATE_COMPLETED, STATE_DISPUTED, INTERACTION_JOINED, INTERACTION_SELLER_COMPLETED, INTERACTION_BUYER_APPROVED, INTERACTION_DISPUTED } from '../types';

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
  
  return (
    <Flex gap="2">
      {/* Mark as Completed button for sellers */}
      {showMarkCompletedButton && (
        <Button 
          color="green" 
          size={size}
          onClick={() => onMarkCompleted(interactionUserAddress, interaction.id)}
        >
          <CheckCircle size={size === '1' ? 14 : 16} />
          Mark Completed
        </Button>
      )}
      
      {/* Release Payment button for buyers */}
      {showReleasePaymentButton && (
        <Button 
          color="green" 
          size={size}
          onClick={() => onReleasePayment(interaction.id)}
        >
          <CheckCircle size={size === '1' ? 14 : 16} />
          Release Payment
        </Button>
      )}
      
      {/* Dispute button for sellers */}
      {showSellerDisputeButton && (
        <Button 
          color="red" 
          variant="soft"
          size={size}
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
          <AlertCircle size={size === '1' ? 14 : 16} />
          {isDisputing ? 'Disputing...' : 'Dispute'}
        </Button>
      )}
      
      {/* Dispute button for both buyer and seller in SELLER_COMPLETED state */}
      {showDisputeButton && (
        <Button 
          color="red" 
          variant="soft"
          size={size}
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
          <AlertCircle size={size === '1' ? 14 : 16} />
          {isDisputing ? 'Disputing...' : 'Dispute'}
        </Button>
      )}
      
      {/* Resolve Dispute button for admins */}
      {showResolveDisputeButton && (
        <Button 
          color="blue"
          size={size}
        >
          <ShieldAlert size={size === '1' ? 14 : 16} />
          Resolve Dispute
        </Button>
      )}
      
      {/* Awaiting Resolution button (disabled) */}
      {showAwaitingResolutionButton && (
        <Button 
          color="red" 
          variant="soft"
          size={size}
          disabled
        >
          <ShieldAlert size={size === '1' ? 14 : 16} />
          Awaiting Resolution
        </Button>
      )}
    </Flex>
  );
}
