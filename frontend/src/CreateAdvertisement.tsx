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
    <div className="design-flex design-flex-col design-gap-6">
      <Heading size="6" className="design-heading-2">Create Advertisement</Heading>
      
      <Card className="design-card">
        <div className="design-flex design-flex-col design-gap-6">
          <div className="design-form-group">
            <label className="design-form-label">Advertisement Type</label>
            <Select.Root value={type} onValueChange={(value) => setType(value as AdvertisementType)}>
              <Select.Trigger className="design-input" />
              <Select.Content>
                <Select.Item value="sell">Sell</Select.Item>
                {/* <Select.Item value="buy">Buy</Select.Item> */}
              </Select.Content>
            </Select.Root>
          </div>
          
          <div className="design-form-group">
            <label className="design-form-label">Title</label>
            <input 
              className="design-input"
              placeholder={`${type === 'sell' ? 'Sell' : 'Buy'} OpenAI credits for SUI`}            
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="design-form-group">
            <label className="design-form-label">Description</label>
            <textarea 
              className="design-input design-textarea"
              placeholder="Describe your offer, payment methods, etc."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="design-form-group">
            <label className="design-form-label">Amount (in SUI)</label>
            <input 
              className="design-input"
              placeholder="100"
              value={amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              type="number"
            />
            <span className="design-form-hint">This is the amount of SUI that will be locked in escrow</span>
          </div>
          
          {error && (
            <div className="design-form-error">{error}</div>
          )}
          
          <div className="design-flex design-gap-3 design-flex-end">
            <button 
              className="design-button design-button-secondary"
              onClick={() => navigate('/marketplace')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              className={`design-button design-button-primary ${isSubmitting ? 'design-loading' : ''}`}
              onClick={createAdvertisement}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Advertisement'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
