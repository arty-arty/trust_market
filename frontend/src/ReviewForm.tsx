import React, { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, Heading, Box } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { Star } from 'lucide-react';

interface ReviewFormProps {
  advertisementId: string;
  advertisementTitle: string;
  counterpartyAddress: string;
  isForSeller: boolean;
  onReviewSubmitted: () => void;
  debugMode?: boolean;
}

export function ReviewForm({
  advertisementId,
  advertisementTitle,
  counterpartyAddress,
  isForSeller,
  onReviewSubmitted,
  debugMode = false
}: ReviewFormProps) {
  const packageId = useNetworkVariable('packageId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const submitReview = () => {
    if (!comment.trim()) {
      setError('Please enter a comment');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    if (debugMode) {
      setTimeout(() => {
        setIsSubmitting(false);
        onReviewSubmitted();
      }, 1000);
      return;
    }
    
    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::marketplace::add_review`,
      arguments: [
        tx.object(advertisementId),
        tx.pure.address(counterpartyAddress),
        tx.pure.u8(rating),
        tx.pure.string(comment),
        tx.pure.bool(isForSeller),
      ],
    });
    tx.setGasBudget(10000000);
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Review submitted:', result);
          setIsSubmitting(false);
          onReviewSubmitted();
        },
        onError: (error) => {
          console.error('Error submitting review:', error);
          setError('Failed to submit review. Please try again.');
          setIsSubmitting(false);
        },
      },
    );
  };
  
  return (
    <Card>
      <Flex direction="column" gap="3">
        <Heading size="4">
          Leave a Review for {isForSeller ? 'Seller' : 'Buyer'}
        </Heading>
        
        <Text size="2">
          Your review helps build trust in the marketplace. Please be honest and constructive.
        </Text>
        
        <Flex direction="column" gap="2">
          <Text weight="bold">Rating</Text>
          <Flex gap="1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Button 
                key={star} 
                variant="ghost" 
                onClick={() => setRating(star)}
                style={{ 
                  color: star <= rating ? 'var(--amber-9)' : 'var(--gray-5)',
                  padding: '4px'
                }}
              >
                <Star size={24} fill={star <= rating ? 'var(--amber-9)' : 'none'} />
              </Button>
            ))}
          </Flex>
        </Flex>
        
        <Flex direction="column" gap="2">
          <Text weight="bold">Comment</Text>
          <textarea 
            placeholder="Share your experience..."
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid var(--gray-5)',
              minHeight: '100px',
              resize: 'vertical'
            }}
          />
        </Flex>
        
        {error && (
          <Text color="red" size="2">{error}</Text>
        )}
        
        <Flex gap="3" justify="end">
          <Button 
            variant="soft" 
            onClick={() => onReviewSubmitted()}
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button 
            onClick={submitReview}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
