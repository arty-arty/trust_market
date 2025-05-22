import React from 'react';
import { Button, Box, Flex, Text, Dialog } from '@radix-ui/themes';
import { AlertCircle, CheckCircle, DollarSign, ShieldAlert } from 'lucide-react';

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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Flex direction="column" gap="3">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <AlertCircle size={24} color="red" />
              Confirm Dispute
            </Flex>
          </Dialog.Title>
          
          <Box style={{ 
            backgroundColor: 'var(--red-3)', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid var(--red-6)'
          }}>
            <Flex direction="column" gap="2">
              <Text weight="bold" color="red">Warning: This action cannot be undone!</Text>
              <Text>
                Disputing this transaction will escalate it to an admin for review. 
                The funds will remain locked until the dispute is resolved.
              </Text>
              <Text>
                Please only dispute if there is a legitimate issue with the transaction.
              </Text>
            </Flex>
          </Box>
          
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="red" onClick={onConfirm} disabled={isLoading}>
              <AlertCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Dispute'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Flex direction="column" gap="3">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <CheckCircle size={24} color="green" />
              Confirm Payment Release
            </Flex>
          </Dialog.Title>
          
          <Box style={{ 
            backgroundColor: 'var(--green-3)', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid var(--green-6)'
          }}>
            <Flex direction="column" gap="2">
              <Text weight="bold" color="green">This action cannot be undone!</Text>
              <Text>
                By releasing payment, you confirm that the seller has completed the work satisfactorily.
                The funds will be transferred to the seller immediately.
              </Text>
              <Text>
                Amount: {formatCurrency(amount)}
              </Text>
            </Flex>
          </Box>
          
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="green" onClick={onConfirm} disabled={isLoading}>
              <CheckCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Release'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Flex direction="column" gap="3">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <CheckCircle size={24} color="blue" />
              Confirm Work Completion
            </Flex>
          </Dialog.Title>
          
          <Box style={{ 
            backgroundColor: 'var(--blue-3)', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid var(--blue-6)'
          }}>
            <Flex direction="column" gap="2">
              <Text weight="bold" color="blue">This action cannot be undone!</Text>
              <Text>
                By marking this work as completed, you are confirming that you have fulfilled all requirements
                of this transaction as the seller.
              </Text>
              <Text>
                <strong>Important:</strong> Make sure you have provided all necessary proof of work completion
                in the chat before proceeding. If the buyer disputes without sufficient evidence of completion,
                an admin may resolve the dispute in favor of the buyer.
              </Text>
            </Flex>
          </Box>
          
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="blue" onClick={onConfirm} disabled={isLoading}>
              <CheckCircle size={16} />
              {isLoading ? 'Processing...' : 'Confirm Completion'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Flex direction="column" gap="3">
          <Dialog.Title>
            <Flex align="center" gap="2">
              <DollarSign size={24} color="blue" />
              Confirm Join Advertisement
            </Flex>
          </Dialog.Title>
          
          <Box style={{ 
            backgroundColor: 'var(--blue-3)', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px solid var(--blue-6)'
          }}>
            <Flex direction="column" gap="2">
              <Text weight="bold" color="blue">This action will lock your funds in escrow!</Text>
              <Text>
                By joining this advertisement, you are agreeing to lock {formatCurrency(amount)} in an escrow contract.
                These funds will only be released when:
              </Text>
              <ul style={{ paddingLeft: '20px' }}>
                <li>You approve the seller's work and release the payment, or</li>
                <li>An admin resolves a dispute in the seller's favor</li>
              </ul>
              <Text>
                If you dispute the transaction and an admin rules in your favor, the funds will be returned to you.
              </Text>
            </Flex>
          </Box>
          
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button color="blue" onClick={onConfirm} disabled={isLoading}>
              <DollarSign size={16} />
              {isLoading ? 'Processing...' : 'Lock Funds & Join'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
