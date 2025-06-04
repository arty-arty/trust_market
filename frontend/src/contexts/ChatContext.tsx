import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useSuiClient, useCurrentAccount, useSignPersonalMessage, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SealClient, getAllowlistedKeyServers, SessionKey } from '@mysten/seal';
import { Transaction } from '@mysten/sui/transactions';
import { useNetworkVariable } from '../networkConfig';
import { Advertisement, ChatMessage as ChatMessageType, Interaction } from '../types';
import { fetchAdvertisement, addChatMessage } from '../api';
import { 
  decryptMessage, 
  encryptMessage, 
  storeEphemeralKey, 
  retrieveEphemeralKey,
  clearEphemeralKey,
  decryptEphemeralKey,
  encryptFileData,
  uploadToWalrus,
  downloadFromWalrus,
  decryptFileData,
  FileMetadata
} from '../utils';
import { fromHex, toHex } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';

// Extended ChatMessage type for UI with decrypted text
interface ChatMessage extends ChatMessageType {
  text: string;
  type?: 'text' | 'image' | 'file';
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  imageUrl?: string;
  fileUrl?: string;
  fileMetadata?: FileMetadata;
}

interface ChatContextType {
  // Chat state
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  error: string | null;
  
  // Key initialization state
  isInitializingKey: boolean;
  keyInitializationError: string | null;
  
  // Chat functions
  sendMessage: (text: string) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  loadMessages: (advertisementId: string, interactionId: number) => Promise<void>;
  retryKeyInitialization: () => void;
  
  // Seal client
  sealClient: SealClient | null;
  
  // Current chat info
  currentAdvertisementId: string | null;
  currentInteractionId: number | null;
  setCurrentChat: (advertisementId: string | null, interactionId: number | null) => void;
  
  // User info
  currentAccount: ReturnType<typeof useCurrentAccount>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Global session key cache REMOVED for simplification

export function ChatProvider({ children }: { children: ReactNode }) {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const packageId = useNetworkVariable('packageId');
  
  // State
  const [sealClient, setSealClient] = useState<SealClient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAdvertisementId, setCurrentAdvertisementId] = useState<string | null>(null);
  const [currentInteractionId, setCurrentInteractionId] = useState<number | null>(null);
  
  // Key initialization state
  const [isInitializingKey, setIsInitializingKey] = useState(false);
  const [keyInitializationError, setKeyInitializationError] = useState<string | null>(null);
  
  // Session key management - bulletproof approach
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const { 
    mutate: signPersonalMessage, 
    reset: resetSignPersonalMessage, 
    isPending: isSignPersonalMessagePending 
  } = useSignPersonalMessage();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Polling management
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadingFileIds, setUploadingFileIds] = useState<string[]>([]);
  
  // Track if we've attempted to fetch ephemeral key for current chat
  const [ephemeralKeyFetched, setEphemeralKeyFetched] = useState<string | null>(null);
  // const signPromiseRef = useRef<Promise<SessionKey | null> | null>(null); // REMOVED
  
  // Initialize SealClient
  useEffect(() => {
    if (currentAccount && suiClient) {
      const client = new SealClient({
        suiClient,
        serverConfigs: getAllowlistedKeyServers('testnet').map((id) => ({
        objectId: id,
        weight: 1,
      })),
        verifyKeyServers: false,
      });
      setSealClient(client);
    }
  }, [currentAccount, suiClient]);

  // Bulletproof session key initialization
  const initializeSessionKey = useCallback(async (): Promise<SessionKey | null> => {
    const userAddress = currentAccount?.address;
    console.log(`[ChatContext::SessionKey] Attempting to initialize. User: ${userAddress}, Package: ${packageId}`);

    if (!currentAccount || !suiClient || !userAddress) {
      const errorMsg = `[ChatContext::SessionKey] Pre-requisites not met. Account: ${!!currentAccount}, SuiClient: ${!!suiClient}, UserAddress: ${userAddress}`;
      console.error(errorMsg);
      setIsInitializingKey(false);
      setKeyInitializationError('User account or Sui client not available.');
      return null;
    }
    
    // Global cache removed. If a session key exists in state, use it.
    if (sessionKey) {
      console.log(`[ChatContext::SessionKey] Using existing session key from state for user ${userAddress}.`);
      setIsInitializingKey(false); // No longer initializing if we already have one
      setKeyInitializationError(null);
      return sessionKey;
    }

    // If a signature request is already pending from this hook, don't start another.
    // This is the primary guard against double prompts.
    if (isSignPersonalMessagePending) {
      console.warn(`[ChatContext::SessionKey] signPersonalMessage is already pending for user ${userAddress}. Aborting new attempt to prevent double prompt.`);
      setIsInitializingKey(true); // Still indicate we are in an initializing phase for UI
      return null;
    }
    
    // Secondary guard: if isInitializingKey is true (set by a previous call that hasn't completed but
    // isSignPersonalMessagePending might be false if the actual signPersonalMessage call hasn't been made yet
    // or if there's a slight delay in its state update), also abort.
    if (isInitializingKey) {
        console.warn(`[ChatContext::SessionKey] isInitializingKey is true (but signPersonalMessage not pending) for user ${userAddress}. Aborting new attempt.`);
        return null; 
    }
    
    console.log(`[ChatContext::SessionKey] No session key in state, not currently initializing, and signPersonalMessage not pending. Starting new initialization for user ${userAddress}.`);
    setIsInitializingKey(true);
    setKeyInitializationError(null);
    
    try {
      console.log(`[ChatContext::SessionKey] Creating new SessionKey instance for user ${userAddress}.`);
      const newSessionKey = new SessionKey({
        address: userAddress,
        packageId,
        ttlMin: 10, // 10 minutes TTL
        suiClient
      });
      
      console.log(`[ChatContext::SessionKey] Getting personal message bytes for user ${userAddress}.`);
      const messageBytes = newSessionKey.getPersonalMessage();
      
      console.log(`[ChatContext::SessionKey] Prompting user for signature. Current isSignPersonalMessagePending: ${isSignPersonalMessagePending} for user ${userAddress}.`);
      
      // Directly await the signature result
      const signatureResult = await new Promise<{ signature: string } | null>((resolve, reject) => {
        signPersonalMessage(
          { message: messageBytes },
          {
            onSuccess: (sigResult) => {
              console.log(`[ChatContext::SessionKey] signPersonalMessage onSuccess: Signature received for user ${userAddress}.`);
              resolve(sigResult);
            },
            onError: (error) => {
              console.error(`[ChatContext::SessionKey] signPersonalMessage onError for user ${userAddress}:`, error);
              reject(new Error(error.message || 'Wallet signature required or user cancelled.'));
            }
          }
        );
      });

      if (!signatureResult) {
        throw new Error('Signature process did not return a result.');
      }

      console.log(`[ChatContext::SessionKey] Setting personal message signature on SessionKey instance for user ${userAddress}.`);
      await newSessionKey.setPersonalMessageSignature(signatureResult.signature);
      
      console.log(`[ChatContext::SessionKey] SessionKey successfully initialized for user ${userAddress}.`);
      setSessionKey(newSessionKey);
      setIsInitializingKey(false);
      setKeyInitializationError(null);
      return newSessionKey;

    } catch (err: any) {
      console.error(`[ChatContext::SessionKey] Error during session key initialization for user ${userAddress}:`, err);
      setIsInitializingKey(false);
      setKeyInitializationError(err.message || 'Failed to initialize session key.');
      setSessionKey(null); // Ensure sessionKey is null on failure
      return null; // Return null on error, rather than re-throwing, to match original simpler structure
    }
  }, [currentAccount, suiClient, packageId, signPersonalMessage, sessionKey, isInitializingKey, keyInitializationError, isSignPersonalMessagePending, resetSignPersonalMessage]);

  // Retry key initialization
  const retryKeyInitialization = useCallback(() => {
    console.log('[ChatContext::SessionKey] RetryKeyInitialization called.');
    console.log(`[ChatContext::SessionKey] Before reset - isSignPersonalMessagePending: ${isSignPersonalMessagePending}`);
    resetSignPersonalMessage();
    console.log('[ChatContext::SessionKey] Called resetSignPersonalMessage().');

    // Clear local session key state to force re-initialization
    setSessionKey(null);
    setIsInitializingKey(false); // Reset initialization lock
    setKeyInitializationError(null);
    setEphemeralKeyFetched(null); // Reset ephemeral key fetch status
    console.log('[ChatContext::SessionKey] Triggering initializeSessionKey from retry.');
    initializeSessionKey(); // This will now attempt a fresh initialization
  }, [initializeSessionKey, resetSignPersonalMessage, isSignPersonalMessagePending]);

  // Helper function to find interaction
  const findInteraction = useCallback((advertisement: Advertisement, interactionId: number): { interaction: Interaction; userAddress: string } | null => {
    for (const [address, profile] of Object.entries(advertisement.userProfiles)) {
      const interaction = profile.interactions.find(i => i.id === interactionId);
      if (interaction) {
        return { interaction, userAddress: address };
      }
    }
    return null;
  }, []);

  // Get or fetch ephemeral key for a chat
  const getEphemeralKey = useCallback(async (
    advertisementId: string, 
    interactionId: number
  ): Promise<Uint8Array | null> => {
    const logPrefix = `[ChatContext::EphemeralGet Ad: ${advertisementId}, Int: ${interactionId}]`;
    console.log(`${logPrefix} Attempting to get key.`);
    let ephemeralKey: Uint8Array | null = null; // Re-declare ephemeralKey here

    if (!sessionKey) {
      console.error(`${logPrefix} SessionKey not available. Cannot proceed.`);
      setError('Session key not initialized. Cannot fetch chat key.'); // User-facing error
      return null;
    }
    if (!sealClient) {
      console.error(`${logPrefix} SealClient not available. Cannot proceed.`);
      setError('Seal client not initialized. Cannot fetch chat key.'); // User-facing error
      return null;
    }
    
    // We need to get the client address first to check storage properly
    // Fetch the advertisement to get the interaction details
    console.log(`${logPrefix} Fetching advertisement to find interaction and client address.`);
    const advertisement = await fetchAdvertisement(suiClient, advertisementId, packageId);
    if (!advertisement) {
      console.error(`${logPrefix} Advertisement not found.`);
      throw new Error('Advertisement not found');
    }
    
    // Find the interaction to get the client address
    const result = findInteraction(advertisement, interactionId);
    if (!result) {
      console.error(`${logPrefix} Interaction not found in advertisement.`);
      throw new Error('Interaction not found');
    }
    
    const { interaction, userAddress: clientAddress } = result;
    console.log(`${logPrefix} Found interaction. Client address for key: ${clientAddress}`);
    
    // retrieveEphemeralKey will now always return null due to utils.ts changes.
    console.log(`${logPrefix} Ephemeral key storage disabled. Proceeding to fetch and decrypt for client ${clientAddress}.`);

    console.log(`${logPrefix} State before decryption attempt: sessionKey valid: ${!!sessionKey}, sealClient valid: ${!!sealClient}`);

    // Explicitly check sessionKey and sealClient again before Seal operations
    if (!sessionKey) {
      console.error(`${logPrefix} CRITICAL: sessionKey is null before Seal operations. This should not happen if signing succeeded.`);
      setError('Session key was lost before decryption. Please retry.');
      return null;
    }
    if (!sealClient) {
      console.error(`${logPrefix} CRITICAL: sealClient is null before Seal operations.`);
      setError('Seal client is not available for decryption. Please retry.');
      return null;
    }
    
    try {
      console.log(`${logPrefix} Stage 1: Validating encrypted key from interaction object.`);
      if (!interaction.chatEphemeralKeyEncrypted || interaction.chatEphemeralKeyEncrypted.length === 0) {
        console.error(`${logPrefix} Stage 1 FAILED: Encrypted key MISSING or empty in interaction object for client ${clientAddress}.`);
        throw new Error('Encrypted key not found for this interaction. Cannot decrypt messages.');
      }
      const encryptedKeyBytes = new Uint8Array(interaction.chatEphemeralKeyEncrypted);
      console.log(`${logPrefix} Stage 1 SUCCESS: Encrypted key found (length: ${encryptedKeyBytes.length}).`);
      
      console.log(`${logPrefix} Stage 2: Building seal_approve transaction for client ${clientAddress}.`);
      const tx = new Transaction();
      // Create the ID for decryption (same as in contract)
      const idForDecryption = new Uint8Array([
        ...fromHex(advertisementId),
        ...fromHex(clientAddress),
        ...bcs.u64().serialize(interactionId).toBytes()
      ]);
      
      tx.moveCall({
        target: `${packageId}::marketplace::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(idForDecryption)),
          tx.object(advertisementId),
          tx.pure.address(clientAddress),
          tx.pure.u64(interactionId), 
        ],
      });
      
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      console.log(`${logPrefix} Stage 2 SUCCESS: seal_approve transaction built.`);
      
      console.log(`${logPrefix} Stage 3: Calling utils.decryptEphemeralKey for client ${clientAddress}.`);
      ephemeralKey = await decryptEphemeralKey(
        encryptedKeyBytes,
        sealClient, // Already confirmed not null
        txBytes,
        sessionKey, // Already confirmed not null
        `${logPrefix} [UtilCall]`
      );
      console.log(`${logPrefix} Stage 3 ${ephemeralKey ? 'SUCCESS' : 'FAILURE (returned null)'}: utils.decryptEphemeralKey result: ${!!ephemeralKey}`);
          
      if (ephemeralKey) {
        console.log(`${logPrefix} Ephemeral key decryption successful. Storing (no-op) and returning key.`);
        storeEphemeralKey(advertisementId, clientAddress, interactionId, ephemeralKey); // This is now a no-op but kept for logical flow
        return ephemeralKey;
      } else {
        // This path should ideally not be reached if decryptEphemeralKey throws on failure.
        // If it returns null, it's an unexpected state from decryptEphemeralKey.
        console.error(`${logPrefix} CRITICAL: decryptEphemeralKey returned null instead of throwing an error on failure.`);
        throw new Error('Failed to decrypt chat key (unexpected null result from decryption utility).');
      }
    } catch (err: any) {
      console.error(`${logPrefix} CRITICAL: Error during ephemeral key processing (Stages 1-3) for client ${clientAddress}:`, err);
      if (err.message && err.message.toLowerCase().includes('noaccesserror')) {
        setError('No access to decrypt this chat key, or key server unavailable. Please check permissions or try again later.');
      } else if (err.message && err.message.includes('Encrypted key not found')) {
        setError(err.message); // Use the specific error message
      } else {
        setError(err.message || 'Failed to process chat key. Please ensure your session is active and try again.');
      }
      throw err; // Re-throw to be caught by calling function (e.g., attemptEphemeralKeyFetch)
    }
  }, [sealClient, sessionKey, suiClient, packageId, findInteraction, setError]);

  // Load messages for a chat - memoized to prevent excessive calls
  const loadMessages = useCallback(async (advertisementId: string, interactionId: number) => {
    if (!suiClient || !currentAccount) {
      setError('Client not initialized');
      return;
    }
    
    setIsLoadingMessages(true);
    setError(null);
    
    try {
      // Get the ephemeral key
      const ephemeralKey = await getEphemeralKey(advertisementId, interactionId);
      if (!ephemeralKey) {
        throw new Error('No ephemeral key available for decryption');
      }
      
      // Fetch advertisement and interaction
      const advertisement = await fetchAdvertisement(suiClient, advertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      const result = findInteraction(advertisement, interactionId);
      if (!result) {
        throw new Error('Interaction not found');
      }
      
      const { interaction } = result;
      
      // Get and decrypt messages
      const chatMessages = interaction.chatMessages || [];
      const decryptedMessages: ChatMessage[] = [];
      
      for (const message of chatMessages) {
        try {
          if (message.messageBlobId) {
            // Handle file/image messages
            const encryptedFileData = await downloadFromWalrus(message.messageBlobId);
            if (encryptedFileData) {
              const { data: decryptedFileData, metadata } = await decryptFileData(encryptedFileData, ephemeralKey);
              const isImage = metadata?.type?.startsWith('image/') || !metadata;
              const mimeType = metadata?.type || 'image/png';
              const blob = new Blob([decryptedFileData], { type: mimeType });

              if (isImage) {
                const imageUrl = URL.createObjectURL(blob);
                decryptedMessages.push({
                  ...message,
                  text: '[Image]',
                  imageUrl,
                  type: 'image',
                });
              } else {
                const fileUrl = URL.createObjectURL(blob);
                const displayName = metadata ? `${metadata.filename}.${metadata.extension}` : 'file';
                decryptedMessages.push({
                  ...message,
                  text: `[File: ${displayName}]`,
                  fileUrl,
                  fileMetadata: metadata,
                  type: 'file',
                });
              }
            } else {
              decryptedMessages.push({
                ...message,
                text: '[File - failed to load]',
                type: 'file',
              });
            }
          } else if (message.messageEncryptedText) {
            // Handle text messages
            const decryptedText = await decryptMessage(message.messageEncryptedText, ephemeralKey);
            decryptedMessages.push({
              ...message,
              text: decryptedText || 'Failed to decrypt message',
              type: 'text',
            });
          } else {
            decryptedMessages.push({
              ...message,
              text: '[Unknown message format]',
              type: 'text',
            });
          }
        } catch (err) {
          console.error(`Error processing message ${message.id}:`, err);
          decryptedMessages.push({
            ...message,
            text: message.messageBlobId ? '[File - decryption failed]' : 'Failed to decrypt message',
            type: message.messageBlobId ? 'image' : 'text',
          });
        }
      }
      
      // Sort by timestamp and update state
      decryptedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Preserve uploading messages
      if (uploadingFileIds.length > 0) {
        const uploadingMessages = messages.filter(m => 
          uploadingFileIds.includes(m.id) && m.status === 'sending'
        );
        setMessages([...decryptedMessages, ...uploadingMessages]);
      } else {
        setMessages(decryptedMessages);
      }
      
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [suiClient, currentAccount, packageId, getEphemeralKey, findInteraction, uploadingFileIds]);

  // BULLETPROOF FIX: Auto-fetch ephemeral key after session key is ready
  useEffect(() => {
    const attemptEphemeralKeyFetch = async () => {
      // Only proceed if we have all required components and haven't already fetched for this chat
      if (!sessionKey || !currentAdvertisementId || currentInteractionId === null || !sealClient) {
        return;
      }
      
      const chatKey = `${currentAdvertisementId}_${currentInteractionId}`;
      
      // Skip if we've already attempted to fetch for this chat
      if (ephemeralKeyFetched === chatKey) {
        return;
      }
      
      console.log('Auto-fetching ephemeral key after session key initialization...');
      setEphemeralKeyFetched(chatKey);
      
      try {
        // Force a fresh fetch of the ephemeral key
        const ephemeralKey = await getEphemeralKey(currentAdvertisementId, currentInteractionId);
        
        if (ephemeralKey) {
          console.log('Ephemeral key auto-fetch successful');
          // Now load messages since we have the key
          await loadMessages(currentAdvertisementId, currentInteractionId);
        } else {
          console.error('Ephemeral key auto-fetch returned null');
          // Force a retry of the key initialization
          setTimeout(() => {
            setEphemeralKeyFetched(null);
          }, 1000);
        }
      } catch (err) {
        console.error('Auto-fetch ephemeral key failed:', err);
        // Reset the fetch status after a delay to allow for retry
        setTimeout(() => {
          setEphemeralKeyFetched(null);
        }, 1000);
      }
    };
    
    attemptEphemeralKeyFetch();
  }, [sessionKey, currentAdvertisementId, currentInteractionId, sealClient, ephemeralKeyFetched, getEphemeralKey, loadMessages]);

  // Set up polling for message updates - fixed to prevent spam
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Only set up polling if we have a valid chat and session key
    if (!currentAdvertisementId || currentInteractionId === null) {
      return;
    }
    
    // Load messages immediately if we have a session key
    if (sessionKey) {
      const chatKey = `${currentAdvertisementId}_${currentInteractionId}`;
      if (ephemeralKeyFetched !== chatKey) {
        console.log('Immediate message load triggered by polling setup');
        loadMessages(currentAdvertisementId, currentInteractionId).catch(err => {
          console.error('Error in immediate message load:', err);
        });
      }
    }
    
    // Set up polling every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      // Only poll if we have a session key, not uploading files, and we still have the same chat
      if (sessionKey && !isFileUploading && uploadingFileIds.length === 0 && 
          currentAdvertisementId && currentInteractionId !== null) {
        console.log(`Polling messages for ${currentAdvertisementId}:${currentInteractionId}`);
        loadMessages(currentAdvertisementId, currentInteractionId).catch(err => {
          console.error('Error in polling message load:', err);
        });
      }
    }, 3000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentAdvertisementId, currentInteractionId, sessionKey, isFileUploading, uploadingFileIds, ephemeralKeyFetched, loadMessages]);

  // Set current chat
  const setCurrentChat = useCallback((advertisementId: string | null, interactionId: number | null) => {
    if (advertisementId !== currentAdvertisementId || interactionId !== currentInteractionId) {
      setMessages([]);
      setError(null);
      setEphemeralKeyFetched(null); // Reset ephemeral key fetch status for new chat
    }
    setCurrentAdvertisementId(advertisementId);
    setCurrentInteractionId(interactionId);
  }, [currentAdvertisementId, currentInteractionId]);

  // Initialize session key when account changes or when chat changes - bulletproof approach
  useEffect(() => {
    if (currentAccount && suiClient && !sessionKey && !isInitializingKey) {
      console.log('Auto-initializing session key...');
      initializeSessionKey().catch(err => {
        console.error('Error in auto-initializing session key:', err);
      });
    }
  }, [currentAccount, suiClient, sessionKey, isInitializingKey, initializeSessionKey, currentAdvertisementId, currentInteractionId]);

  // Clean up cache when account changes - Global cache removed, so this is no longer needed.
  // useEffect(() => {
  //   return () => {
  //     // Clean up when component unmounts or account changes
  //     if (currentAccount) {
  //       const cacheKey = `${currentAccount.address}_${packageId}`;
  //       // const cached = globalSessionKeyCache.get(cacheKey);
  //       // if (cached && !cached.isInitializing) {
  //       //   // Keep successful session keys, only clean up failed ones
  //       //   if (!cached.sessionKey) {
  //       //     globalSessionKeyCache.delete(cacheKey);
  //       //   }
  //       // }
  //     }
  //   };
  // }, [currentAccount?.address, packageId]);

  // Send text message
  const sendMessage = useCallback(async (text: string) => {
    if (!suiClient || !currentAccount || !currentAdvertisementId || currentInteractionId === null) {
      setError('Chat not properly initialized');
      return;
    }
    
    setError(null);
    
    try {
      // Get ephemeral key
      const ephemeralKey = await getEphemeralKey(currentAdvertisementId, currentInteractionId);
      if (!ephemeralKey) {
        throw new Error('No ephemeral key available for encryption');
      }
      
      // Create temporary message for UI
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        advertisementId: currentAdvertisementId,
        interactionId: currentInteractionId,
        interactionUser: currentAccount.address,
        sender: currentAccount.address,
        timestamp: Date.now(),
        messageEncryptedText: '',
        messageBlobId: '',
        text: text,
        status: 'sending',
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      // Get the correct interaction user address
      const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      let interactionUser = currentAccount.address;
      const isCreator = advertisement.creator === currentAccount.address;
      
      if (isCreator) {
        // Find the client's address for this interaction
        const result = findInteraction(advertisement, currentInteractionId);
        if (result) {
          interactionUser = result.userAddress;
        }
      }
      
      // Create and execute transaction
      const tx = await addChatMessage(
        packageId,
        currentAdvertisementId,
        interactionUser,
        currentInteractionId,
        { text },
        ephemeralKey
      );
      
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('Message sent successfully:', result);
            setMessages(prev => 
              prev.map(msg => 
                msg.id === tempMessage.id 
                  ? { ...msg, id: result.digest, status: 'sent' } 
                  : msg
              )
            );
          },
          onError: (error) => {
            console.error('Error sending message:', error);
            setError('Failed to send message');
            setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          }
        }
      );
    } catch (err: any) {
      console.error('Error preparing message:', err);
      setError(err.message || 'Failed to prepare message');
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
    }
  }, [suiClient, currentAccount, currentAdvertisementId, currentInteractionId, packageId, getEphemeralKey, signAndExecute, findInteraction]);

  // Send file message
  const sendFileMessage = useCallback(async (file: File) => {
    if (!suiClient || !currentAccount || !currentAdvertisementId || currentInteractionId === null) {
      setError('Chat not properly initialized');
      return;
    }

    setIsFileUploading(true);
    setError(null);
    
    const tempId = `temp-file-${Date.now()}`;
    const isImage = file.type.startsWith('image/');

    const tempMessage: ChatMessage = {
      id: tempId,
      advertisementId: currentAdvertisementId,
      interactionId: currentInteractionId,
      interactionUser: currentAccount.address,
      sender: currentAccount.address,
      timestamp: Date.now(),
      messageEncryptedText: '',
      messageBlobId: '',
      text: `[Uploading ${file.name}]`,
      type: isImage ? 'image' : 'file',
      status: 'sending',
    };

    setUploadingFileIds(prev => [...prev, tempId]);
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Get ephemeral key
      const ephemeralKey = await getEphemeralKey(currentAdvertisementId, currentInteractionId);
      if (!ephemeralKey) {
        throw new Error('No ephemeral key available for file encryption');
      }

      // Prepare file data
      const fileData = new Uint8Array(await file.arrayBuffer());
      let metadata: FileMetadata | undefined;
      
      if (!isImage) {
        const filenameParts = file.name.split('.');
        const extension = filenameParts.length > 1 ? filenameParts.pop() || '' : '';
        const filename = filenameParts.join('.');
        metadata = {
          filename,
          extension,
          type: file.type || 'application/octet-stream',
          size: file.size
        };
      }

      // Encrypt and upload
      const encryptedFileData = await encryptFileData(fileData, ephemeralKey, metadata);
      const blobId = await uploadToWalrus(encryptedFileData);

      if (!blobId) {
        throw new Error('Failed to upload file to Walrus');
      }

      // Get interaction user address
      const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      let interactionUser = currentAccount.address;
      const isCreator = advertisement.creator === currentAccount.address;
      
      if (isCreator) {
        const result = findInteraction(advertisement, currentInteractionId);
        if (result) {
          interactionUser = result.userAddress;
        }
      }
      
      // Create transaction
      const tx = await addChatMessage(
        packageId,
        currentAdvertisementId,
        interactionUser,
        currentInteractionId,
        { blobId },
        ephemeralKey
      );

      // Update message to show wallet prompt
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? { ...msg, text: isImage ? '[Image - waiting for wallet...]' : `[File: ${file.name} - waiting for wallet...]` }
            : msg
        )
      );

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log('File message sent successfully:', result);
            const displayText = isImage ? '[Image]' : `[File: ${file.name}]`;
            
            setIsFileUploading(false);
            setUploadingFileIds(prev => prev.filter(id => id !== tempId));
            
            setMessages(prev =>
              prev.map(msg =>
                msg.id === tempId
                  ? { ...msg, id: result.digest, status: 'sent', text: displayText }
                  : msg
              )
            );
            
            // Reload messages to get proper URLs
            if (currentAdvertisementId && currentInteractionId !== null) {
              loadMessages(currentAdvertisementId, currentInteractionId);
            }
          },
          onError: (error) => {
            console.error('Error sending file message:', error);
            setError('Failed to send file');
            
            setIsFileUploading(false);
            setUploadingFileIds(prev => prev.filter(id => id !== tempId));
            
            setMessages(prev =>
              prev.map(msg => 
                msg.id === tempId ? { ...msg, status: 'failed', text: '[File - send failed]' } : msg
              )
            );
          },
        }
      );
    } catch (err: any) {
      console.error('Error preparing file message:', err);
      setError(err.message || 'Failed to prepare file message');
      
      setIsFileUploading(false);
      setUploadingFileIds(prev => prev.filter(id => id !== tempId));
      
      setMessages(prev =>
        prev.map(msg => 
          msg.id === tempId ? { ...msg, status: 'failed', text: '[File - send failed]' } : msg
        )
      );
    }
  }, [suiClient, currentAccount, currentAdvertisementId, currentInteractionId, packageId, getEphemeralKey, signAndExecute, findInteraction, loadMessages]);

  const value = {
    messages,
    isLoadingMessages,
    error,
    isInitializingKey,
    keyInitializationError,
    sendMessage,
    sendFileMessage,
    loadMessages,
    retryKeyInitialization,
    sealClient,
    currentAdvertisementId,
    currentInteractionId,
    setCurrentChat,
    currentAccount,
  };
  
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
