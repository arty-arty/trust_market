import React from 'react';
import { AlertCircle, CheckCircle, DollarSign, ShieldAlert } from 'lucide-react';
import { ScaledModalOverlay } from './ScaledPortal';

interface DisputeConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DisputeConfirmation({ 
  open, 
  onOpenChange, 
  onConfirm,
  isLoading = false
}: DisputeConfirmationProps) {
  if (!open) return null;

  return (
    <ScaledModalOverlay onClose={() => onOpenChange(false)}>
      <div className="design-card design-modal-content" style={{
        maxWidth: '500px',
        width: '90vw',
        padding: 'var(--space-6)'
      }}>
        <div className="design-flex design-flex-col design-gap-3">
          <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
            <AlertCircle size={24} color="var(--red-9)" />
            <h3 className="design-heading-3">Confirm Dispute</h3>
          </div>
          
          <div style={{ 
            backgroundColor: 'var(--red-3)', 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--red-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-2">
              <p style={{ fontWeight: 'bold', color: 'var(--red-9)', margin: 0 }}>Warning: This action cannot be undone!</p>
              <p style={{ margin: 0 }}>
                Disputing this transaction will escalate it to an admin for review. 
                The funds will remain locked until the dispute is resolved.
              </p>
              <p style={{ margin: 0 }}>
                Please only dispute if there is a legitimate issue with the transaction.
              </p>
            </div>
          </div>
          
          <div className="design-flex design-gap-3 design-flex-end">
            <button 
              className="design-button design-button-secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button 
              className="design-button design-button-error"
              onClick={onConfirm} 
              disabled={isLoading}
            >
              <AlertCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Dispute'}
            </button>
          </div>
        </div>
      </div>
    </ScaledModalOverlay>
  );
}

interface ReleasePaymentConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  amount: number;
  isLoading?: boolean;
}

export function ReleasePaymentConfirmation({ 
  open, 
  onOpenChange, 
  onConfirm,
  amount,
  isLoading = false
}: ReleasePaymentConfirmationProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return `${(amount / 1_000_000_000).toFixed(2)} SUI`;
  };

  if (!open) return null;

  return (
    <ScaledModalOverlay onClose={() => onOpenChange(false)}>
      <div className="design-card design-modal-content" style={{
        maxWidth: '500px',
        width: '90vw',
        padding: 'var(--space-6)'
      }}>
        <div className="design-flex design-flex-col design-gap-3">
          <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
            <CheckCircle size={24} color="var(--green-9)" />
            <h3 className="design-heading-3">Confirm Payment Release</h3>
          </div>
          
          <div style={{ 
            backgroundColor: 'var(--green-3)', 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--green-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-2">
              <p style={{ fontWeight: 'bold', color: 'var(--green-9)', margin: 0 }}>This action cannot be undone!</p>
              <p style={{ margin: 0 }}>
                By releasing payment, you confirm that the seller has completed the work satisfactorily.
                The funds will be transferred to the seller immediately.
              </p>
              <p style={{ margin: 0 }}>
                Amount: {formatCurrency(amount)}
              </p>
            </div>
          </div>
          
          <div className="design-flex design-gap-3 design-flex-end">
            <button 
              className="design-button design-button-secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button 
              className="design-button design-button-success"
              onClick={onConfirm} 
              disabled={isLoading}
            >
              <CheckCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Release'}
            </button>
          </div>
        </div>
      </div>
    </ScaledModalOverlay>
  );
}

interface MarkCompletedConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function MarkCompletedConfirmation({ 
  open, 
  onOpenChange, 
  onConfirm,
  isLoading = false
}: MarkCompletedConfirmationProps) {
  if (!open) return null;

  return (
    <ScaledModalOverlay onClose={() => onOpenChange(false)}>
      <div className="design-card design-modal-content" style={{
        maxWidth: '500px',
        width: '90vw',
        padding: 'var(--space-6)'
      }}>
        <div className="design-flex design-flex-col design-gap-3">
          <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
            <CheckCircle size={24} color="var(--blue-9)" />
            <h3 className="design-heading-3">Confirm Work Completion</h3>
          </div>
          
          <div style={{ 
            backgroundColor: 'var(--blue-3)', 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--blue-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-2">
              <p style={{ fontWeight: 'bold', color: 'var(--blue-9)', margin: 0 }}>This action cannot be undone!</p>
              <p style={{ margin: 0 }}>
                By marking this work as completed, you are confirming that you have fulfilled all requirements
                of this transaction as the seller.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Important:</strong> Make sure you have provided all necessary proof of work completion
                in the chat before proceeding. If the buyer disputes without sufficient evidence of completion,
                an admin may resolve the dispute in favor of the buyer.
              </p>
            </div>
          </div>
          
          <div className="design-flex design-gap-3 design-flex-end">
            <button 
              className="design-button design-button-secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button 
              className="design-button design-button-primary"
              onClick={onConfirm} 
              disabled={isLoading}
            >
              <CheckCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Completion'}
            </button>
          </div>
        </div>
      </div>
    </ScaledModalOverlay>
  );
}

interface JoinAdvertisementConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  amount: number;
  isLoading?: boolean;
}

export function JoinAdvertisementConfirmation({ 
  open, 
  onOpenChange, 
  onConfirm,
  amount,
  isLoading = false
}: JoinAdvertisementConfirmationProps) {
  // Format currency
  const formatCurrency = (amount: number) => {
    return `${(amount / 1_000_000_000).toFixed(2)} SUI`;
  };

  if (!open) return null;

  return (
    <ScaledModalOverlay onClose={() => onOpenChange(false)}>
      <div className="design-card design-modal-content" style={{
        maxWidth: '500px',
        width: '90vw',
        padding: 'var(--space-6)'
      }}>
        <div className="design-flex design-flex-col design-gap-3">
          <div className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
            <DollarSign size={24} color="var(--blue-9)" />
            <h3 className="design-heading-3">Confirm Join Advertisement</h3>
          </div>
          
          <div style={{ 
            backgroundColor: 'var(--blue-3)', 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--blue-6)'
          }}>
            <div className="design-flex design-flex-col design-gap-2">
              <p style={{ fontWeight: 'bold', color: 'var(--blue-9)', margin: 0 }}>This action will lock your funds in escrow!</p>
              <p style={{ margin: 0 }}>
                By joining this advertisement, you are agreeing to lock {formatCurrency(amount)} in an escrow contract.
                These funds will only be released when:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 'var(--space-2) 0' }}>
                <li>You approve the seller's work and release the payment, or</li>
                <li>An admin resolves a dispute in the seller's favor</li>
              </ul>
              <p style={{ margin: 0 }}>
                If you dispute the transaction and an admin rules in your favor, the funds will be returned to you.
              </p>
            </div>
          </div>
          
          <div className="design-flex design-gap-3 design-flex-end">
            <button 
              className="design-button design-button-secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button 
              className="design-button design-button-primary"
              onClick={onConfirm} 
              disabled={isLoading}
            >
              <DollarSign size={16} />
              {isLoading ? 'Processing...' : 'Lock Funds & Join'}
            </button>
          </div>
        </div>
      </div>
    </ScaledModalOverlay>
  );
}
