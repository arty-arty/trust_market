import React, { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Button, Card, Flex, Text, TextField, Select, Heading } from '@radix-ui/themes';
import { useNetworkVariable } from './networkConfig';
import { useNavigate } from 'react-router-dom';
import { createAdvertisement as createAd } from './api';

type AdvertisementType = 'buy' | 'sell';

export function CreateAdvertisement() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<AdvertisementType>('sell');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const packageId = useNetworkVariable('packageId');
  const registryId = useNetworkVariable('registryId');
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  
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

  const validateForm = () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return false;
    }
    
    if (!description.trim()) {
      setError('Please enter a description');
      return false;
    }
    
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    
    return true;
  };

  const createAdvertisement = () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    // Create the transaction using the API function
    const tx = createAd(
      packageId,
      registryId,
      title,
      description,
      Number(amount)*1_000_000_000 //SUI to MIST conversion
    );
    
    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          console.log('Advertisement created:', result);
          
          // Extract the created advertisement object ID from the transaction result
          const advertisementObject = result.effects?.created?.find(
            (item) => item.owner && typeof item.owner === 'object' && 'Shared' in item.owner,
          );
          
          const createdObjectId = advertisementObject?.reference?.objectId;
          
          if (createdObjectId) {
            // Navigate to the advertisement detail page
            navigate(`/marketplace/advertisement/${createdObjectId}`);
          } else {
            // Navigate to My Advertisements page
            navigate('/marketplace/my-advertisements');
          }
          
          setIsSubmitting(false);
        },
        onError: (error) => {
          console.error('Error creating advertisement:', error);
          setError('Failed to create advertisement. Please try again.');
          setIsSubmitting(false);
        },
      },
    );
  };

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Heading size="5">Create Advertisement</Heading>
        
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">Advertisement Type</Text>
          <Select.Root value={type} onValueChange={(value) => setType(value as AdvertisementType)}>
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="sell">Sell</Select.Item>
              {/* <Select.Item value="buy">Buy</Select.Item> */}
            </Select.Content>
          </Select.Root>
        </Flex>
        
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">Title</Text>
          <input 
            placeholder={`${type === 'sell' ? 'Sell' : 'Buy'} OpenAI credits for SUI`}            
            // placeholder={`${type === 'sell' ? 'Sell' : 'Buy'} Sell OpenAI credits for SUI`}
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid var(--gray-5)' 
            }}
          />
        </Flex>
        
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">Description</Text>
          <textarea 
            placeholder="Describe your offer, payment methods, etc."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
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
        
        <Flex direction="column" gap="2">
          <Text size="2" weight="bold">Amount (in SUI)</Text>
          <input 
            placeholder="100"
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            type="number"
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid var(--gray-5)' 
            }}
          />
          <Text size="1" color="gray">This is the amount of SUI that will be locked in escrow</Text>
        </Flex>
        
        {error && (
          <Text color="red" size="2">{error}</Text>
        )}
        
        <Flex gap="3" justify="end">
          <Button 
            variant="soft" 
            onClick={() => navigate('/marketplace')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={createAdvertisement}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Advertisement'}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
