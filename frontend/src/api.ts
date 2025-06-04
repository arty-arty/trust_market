import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { SealClient } from '@mysten/seal';
import { fromB64, toB64 } from '@mysten/sui/utils';
import { 
  Advertisement, 
  UserProfile, 
  Interaction, 
  ChatMessage,
  INTERACTION_JOINED,
  INTERACTION_SELLER_COMPLETED,
  INTERACTION_BUYER_APPROVED,
  INTERACTION_DISPUTED
} from './types';
import { 
  generateAndEncryptEphemeralKey, 
  storeEphemeralKey,
  encryptMessage
} from './utils';
import { ShowerHead } from 'lucide-react';

/**
 * Fetch all advertisements
 * @param suiClient The SuiClient instance
 * @param packageId The package ID
 * @param registryId The registry ID
 * @returns Array of advertisements
 */
export const fetchAdvertisements = async (
  suiClient: SuiClient,
  packageId: string,
  registryId: string
): Promise<Advertisement[]> => {
  try {
    // First, get the registry object
    const registryResponse = await suiClient.getObject({
      id: registryId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (!registryResponse.data?.content) {
      console.error('Registry not found');
      return [];
    }

    // Get the advertisement IDs from the registry
    const content = registryResponse.data.content;
    if (content?.dataType !== 'moveObject') {
      console.error('Invalid registry content format or not a Move object');
      return [];
    }
    const fields = content.fields as { advertisements: string[] }; // Assuming 'advertisements' is string[]
    const advertisementIds = fields.advertisements;
    
    console.log('Advertisement IDs from registry:', advertisementIds);
    
    const advertisements: Advertisement[] = [];

    // Fetch each advertisement by ID
    for (const adId of advertisementIds) {
      try {
        const advertisement = await fetchAdvertisement(suiClient, adId, packageId);
        if (advertisement) {
          advertisements.push(advertisement);
        }
      } catch (error) {
        console.error(`Error fetching advertisement ${adId}:`, error);
        // Continue with the next advertisement
      }
    }

    return advertisements;
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    throw error;
  }
};

/**
 * Fetch a single advertisement by ID
 * @param suiClient The SuiClient instance
 * @param advertisementId The advertisement ID
 * @param packageId The package ID
 * @returns The advertisement or null if not found
 */
export const fetchAdvertisement = async (
  suiClient: SuiClient,
  advertisementId: string,
  packageId: string
): Promise<Advertisement | null> => {
  try {
    const response = await suiClient.getObject({
      id: advertisementId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (response.data?.content?.dataType !== 'moveObject') {
      console.error('Advertisement content not found or not a Move object');
      return null;
    }

    const fields = response.data.content.fields as any; // Cast to any for easier access, or define specific type
    
    const advertisement: Advertisement = {
      id: advertisementId,
      creator: fields.creator,
      title: fields.title,
      description: fields.description,
      amount: Number(fields.amount),
      createdAt: Number(fields.created_at),
      userProfiles: {}
    };

    // Fetch user profiles for this advertisement
    advertisement.userProfiles = await fetchUserProfiles(suiClient, advertisement.id, packageId);
    
    return advertisement;
  } catch (error) {
    console.error(`Error fetching advertisement ${advertisementId}:`, error);
    return null;
  }
};

/**
 * Fetch user profiles for an advertisement
 * @param suiClient The SuiClient instance
 * @param advertisementId The advertisement ID
 * @param packageId The package ID
 * @returns Record of user profiles
 */
export const fetchUserProfiles = async (
  suiClient: SuiClient,
  advertisementId: string,
  packageId: string
): Promise<Record<string, UserProfile>> => {
  try {

    // Get the user_profiles field from the advertisement
    const advertisementResponse = await suiClient.getObject({
      id: advertisementId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (advertisementResponse?.data?.content?.dataType !== 'moveObject') {
      console.error('Advertisement content for user profiles not found or not a Move object');
      return {};
    }
    const adFields = advertisementResponse.data.content.fields as any;
    const userProfilesTableInfo = adFields.user_profiles as { fields: { id: { id: string } } };
    const user_profiles_table_id = userProfilesTableInfo.fields.id.id;

    console.log({user_profiles_table_id});

    const user_profiles_table = await suiClient.getDynamicFields({
      parentId: user_profiles_table_id!, // Add non-null assertion if confident it exists
    });

    // map user_profiles_table[i].name.value to values of joined user addresses
    const dynamicFields = user_profiles_table.data.map((field) => ({
      objectId: field.objectId,
      name: field.name.value,
    }));

    const userProfiles: Record<string, UserProfile> = {};

    for (const field of dynamicFields) {
      // Get the user profile object
      const profileObj = await suiClient.getObject({
        id: field.objectId,
        options: {
          showContent: true,
          showType: true,

        },
      });

      if (profileObj.data?.content?.dataType !== 'moveObject') {
        console.warn(`Profile object ${field.objectId} content not found or not a Move object`);
        continue;
      }

      const profileFields = profileObj.data.content.fields as any;

      // Assuming the structure is { value: { fields: { user: string, interactions: any[] } } }
      const fields = profileFields.value?.fields || profileFields; 
      
      if (!fields || !fields.user) {
        console.warn(`Profile object ${field.objectId} does not have expected 'value.fields.user' structure`);
        continue;
      }
      
      // Create the user profile
      const userAddress = fields.user;
      const userProfile: UserProfile = {
        user: userAddress,
        interactions: []
      };

      // Get the interactions from the profile
      const interactions = fields.interactions;
      
      // Parse each interaction
      for (let i = 0; i < interactions.length; i++) {
        const interactionData = interactions[i]?.fields;
        
        const interaction: Interaction = {
          id: Number(interactionData.id),
          user: interactionData.user,
          joinedAt: Number(interactionData.joined_at),
          seller: interactionData.seller,
          assignedAdmin: interactionData.assigned_admin,
          state: Number(interactionData.state),
          chatMessages: [],
          chatEphemeralKeyEncrypted: interactionData.chat_ephemeral_key_encrypted
        };

        // Parse chat messages
        if (interactionData.chat_messages) {
          for (const { fields: msgData} of interactionData.chat_messages) {
            console.log({msgData})
            const chatMessage: ChatMessage = {
              id: msgData.id.id,
              advertisementId: msgData.advertisement_id,
              interactionUser: msgData.interaction_user,
              interactionId: Number(msgData.interaction_id),
              sender: msgData.sender,
              timestamp: Number(msgData.timestamp),
              messageEncryptedText: msgData.message_encrypted_text,
              messageBlobId: msgData.message_blob_id
            };
            
            interaction.chatMessages.push(chatMessage);
          }
        }

        userProfile.interactions.push(interaction);
      }

      userProfiles[userAddress] = userProfile;
    }

    return userProfiles;
  } catch (error) {
    console.error(`Error fetching user profiles for advertisement ${advertisementId}:`, error);
    return {};
  }
};

/**
 * Create a new advertisement
 * @param packageId The package ID
 * @param registryId The registry ID
 * @param title The advertisement title
 * @param description The advertisement description
 * @param amount The advertisement amount
 * @returns Transaction to create the advertisement
 */
export const createAdvertisement = (
  packageId: string,
  registryId: string,
  title: string,
  description: string,
  amount: number
): Transaction => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::marketplace::create_advertisement_entry`,
    arguments: [
      tx.object(registryId), // Registry object
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.u64(amount),
      tx.object('0x6'), // Clock object
    ],
  });
  tx.setGasBudget(10000000);
  
  return tx;
};

/**
 * Join an advertisement
 * @param suiClient The SuiClient instance
 * @param sealClient The SealClient instance
 * @param packageId The package ID
 * @param advertisementId The advertisement ID
 * @param userAddress The user's address
 * @param interactionId The interaction ID
 * @param amount The amount to pay
 * @returns Transaction to join the advertisement
 */
export const joinAdvertisement = async (
  suiClient: SuiClient,
  sealClient: SealClient,
  packageId: string,
  advertisementId: string,
  userAddress: string,
  interactionId: number,
  amount: number
): Promise<{ transaction: Transaction; ephemeralKey: Uint8Array }> => {
  // Generate and encrypt ephemeral key for chat
  const { rawKey, encryptedKey } = await generateAndEncryptEphemeralKey(
    advertisementId,
    userAddress,
    interactionId,
    sealClient,
    packageId
  );
  
  // Create transaction to join advertisement
  const tx = new Transaction();
  
  // Create a coin with the exact amount
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  
  tx.moveCall({
    target: `${packageId}::marketplace::join_advertisement_entry`,
    arguments: [
      tx.object(advertisementId),
      coin,
      tx.pure.vector('u8', Array.from(encryptedKey)),
      tx.object('0x6'), // Clock object
      tx.object('0x8'), // Random object
    ],
  });
  
  tx.setGasBudget(10000000);
  
  return { 
    transaction: tx,
    ephemeralKey: rawKey
  };
};

/**
 * Mark an interaction as completed
 * @param packageId The package ID
 * @param advertisementId The advertisement ID
 * @param userAddress The user address
 * @param interactionId The interaction ID
 * @returns Transaction to mark the interaction as completed
 */
export const markInteractionCompleted = (
  packageId: string,
  advertisementId: string,
  userAddress: string,
  interactionId: number
): Transaction => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::marketplace::mark_completed`,
    arguments: [
      tx.object(advertisementId),
      tx.pure.address(userAddress),
      tx.pure.u64(interactionId),
    ],
  });
  tx.setGasBudget(10000000);
  
  return tx;
};

/**
 * Release payment for an interaction (buyer approves)
 * @param packageId The package ID
 * @param advertisementId The advertisement ID
 * @param interactionId The interaction ID
 * @returns Transaction to release payment
 */
export const releasePayment = (
  packageId: string,
  advertisementId: string,
  interactionId: number
): Transaction => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::marketplace::release_payment_entry`,
    arguments: [
      tx.object(advertisementId),
      tx.pure.u64(interactionId),
    ],
  });
  tx.setGasBudget(10000000);
  
  return tx;
};

/**
 * Dispute an interaction
 * @param packageId The package ID
 * @param advertisementId The advertisement ID
 * @param userAddress The user address whose interaction is being disputed
 * @param interactionId The interaction ID
 * @returns Transaction to dispute the interaction
 */
export const disputeInteraction = (
  packageId: string,
  advertisementId: string,
  userAddress: string,
  interactionId: number
): Transaction => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::marketplace::dispute_transaction_entry`,
    arguments: [
      tx.object(advertisementId),
      tx.pure.address(userAddress),
      tx.pure.u64(interactionId),
    ],
  });
  tx.setGasBudget(10000000);
  
  return tx;
};

/**
 * Add a chat message
 * @param packageId The package ID
 * @param advertisementId The advertisement ID
 * @param userAddress The user address
 * @param interactionId The interaction ID
 * @param message The message text
 * @param ephemeralKey The ephemeral key for encryption
 * @returns Transaction to add the chat message
 */
export const addChatMessage = async (
  packageId: string,
  advertisementId: string,
  userAddress: string,
  interactionId: number,
  content: { text?: string; blobId?: string },
  ephemeralKey: Uint8Array
): Promise<Transaction> => {
  let encryptedTextOption: string | null = null;
  let blobIdOption: string | null = null;

  if (content.text) {
    encryptedTextOption = await encryptMessage(content.text, ephemeralKey);
  }
  if (content.blobId) {
    blobIdOption = content.blobId;
  }
  
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::marketplace::add_chat_message`,
    arguments: [
      tx.object(advertisementId),
      tx.pure.address(userAddress),
      tx.pure.u64(interactionId),
      tx.pure.option('string', blobIdOption),
      tx.pure.option('string', encryptedTextOption),
      tx.object('0x6'), // Clock object
    ],
  });
  tx.setGasBudget(10000000);
  
  return tx;
};

/**
 * Get advertisements created by the current user
 * @param advertisements All advertisements
 * @param userAddress The user's address
 * @returns Advertisements created by the user
 */
export const getMyCreatedAdvertisements = (
  advertisements: Advertisement[],
  userAddress: string
): Advertisement[] => {
  return advertisements.filter(ad => ad.creator === userAddress);
};

/**
 * Get advertisements joined by the current user
 * @param advertisements All advertisements
 * @param userAddress The user's address
 * @returns Advertisements joined by the user
 */
export const getMyJoinedAdvertisements = (
  advertisements: Advertisement[],
  userAddress: string
): Advertisement[] => {
  return advertisements.filter(ad => 
    ad.userProfiles[userAddress] !== undefined
  );
};

/**
 * Get the latest interaction for a user in an advertisement
 * @param advertisement The advertisement
 * @param userAddress The user's address
 * @returns The latest interaction or null if none
 */
export const getLatestInteraction = (
  advertisement: Advertisement,
  userAddress: string
): Interaction | null => {
  const userProfile = advertisement.userProfiles[userAddress];
  if (!userProfile || userProfile.interactions.length === 0) {
    return null;
  }
  
  // Sort interactions by ID (descending) and return the first one
  return [...userProfile.interactions]
    .sort((a, b) => b.id - a.id)[0];
};

/**
 * Check if a user can join an advertisement
 * @param advertisement The advertisement
 * @param userAddress The user's address
 * @returns Whether the user can join
 */
export const canJoinAdvertisement = (
  advertisement: Advertisement,
  userAddress: string
): boolean => {
  // Can't join your own advertisement
  if (advertisement.creator === userAddress) {
    return false;
  }
  
  // Check if user has a profile
  const userProfile = advertisement.userProfiles[userAddress];
  if (!userProfile) {
    return true; // No previous interactions, can join
  }
  
  // Check if user has any interactions
  if (userProfile.interactions.length === 0) {
    return true; // No previous interactions, can join
  }
  
  // Get the latest interaction
  const latestInteraction = getLatestInteraction(advertisement, userAddress);
  if (!latestInteraction) {
    return true; // No previous interactions, can join
  }
  
  // Can only join if the latest interaction is completed
  return latestInteraction.state === INTERACTION_BUYER_APPROVED;
};

/**
 * Format currency amount
 * @param amount The amount to format
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SUI',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount/1_000_000_000); // Convert from MIST to SUI
};

/**
 * Format address to a shorter version
 * @param address The address to format
 * @returns Formatted address string
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Get state label and color
 * @param state The state number
 * @returns Object with label and color
 */
export const getStateInfo = (state: number): { label: string; color: string } => {
  switch (state) {
    case 0:
      return { label: 'Available', color: 'green' };
    case 1:
      return { label: 'Joined', color: 'blue' };
    case 2:
      return { label: 'Completed', color: 'green' };
    case 3:
      return { label: 'Disputed', color: 'red' };
    default:
      return { label: 'Unknown', color: 'gray' };
  }
};

/**
 * Interface for display advertisement
 */
export interface DisplayAdvertisement {
  id: string;
  title: string;
  description: string;
  amount: number;
  creator: string;
  state: number; // 0: available, 1: joined, 2: completed, 3: disputed
  createdAt: number;
  joinedBy?: string;
  interactionId?: number;
  userInteraction?: Interaction;
}

/**
 * Convert Advertisement to DisplayAdvertisement
 * @param advertisement The advertisement to convert
 * @param currentUserAddress The current user's address
 * @returns DisplayAdvertisement
 */
export const convertToDisplayAdvertisement = (
  advertisement: Advertisement,
  currentUserAddress?: string
): DisplayAdvertisement => {
  // Find the current user's interaction if any
  let userInteraction: Interaction | undefined;
  let interactionState = 0; // Default to available
  
  if (currentUserAddress) {
    const userProfile = advertisement.userProfiles[currentUserAddress];
    if (userProfile && userProfile.interactions.length > 0) {
      // Get the latest interaction
      userInteraction = [...userProfile.interactions].sort((a, b) => b.id - a.id)[0];
      interactionState = userInteraction.state + 1; // +1 because our UI states are offset by 1
    }
  }
  
  // Convert to display format
  const displayAd: DisplayAdvertisement = {
    id: advertisement.id,
    title: advertisement.title,
    description: advertisement.description,
    amount: advertisement.amount,
    creator: advertisement.creator,
    state: interactionState,
    createdAt: advertisement.createdAt,
    userInteraction: userInteraction
  };
  
  // If there's an interaction, set the joinedBy field
  if (userInteraction) {
    displayAd.joinedBy = userInteraction.user;
    displayAd.interactionId = userInteraction.id;
  }
  
  return displayAd;
};

/**
 * Check if current user is the creator of an advertisement
 * @param advertisement The advertisement
 * @param currentUserAddress The current user's address
 * @returns Whether the user is the creator
 */
export const isCreator = (
  advertisement: DisplayAdvertisement | Advertisement,
  currentUserAddress?: string
): boolean => {
  if (!advertisement || !currentUserAddress) return false;
  return advertisement.creator === currentUserAddress;
};

/**
 * Check if current user is the joiner of an advertisement
 * @param advertisement The advertisement
 * @param currentUserAddress The current user's address
 * @returns Whether the user is the joiner
 */
export const isJoiner = (
  advertisement: DisplayAdvertisement,
  currentUserAddress?: string
): boolean => {
  if (!advertisement || !currentUserAddress || !advertisement.joinedBy) return false;
  return advertisement.joinedBy === currentUserAddress;
};
