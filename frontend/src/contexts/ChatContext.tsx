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

// Global session key cache to prevent multiple initializations across components
const globalSessionKeyCache = new Map<string, {
  sessionKey: SessionKey | null;
  isInitializing: boolean;
  initPromise: Promise<SessionKey | null> | null;
}>();

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
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Polling management
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadingFileIds, setUploadingFileIds] = useState<string[]>([]);
  
  // Initialize SealClient
  useEffect(() => {
    if (currentAccount && suiClient) {
      const client = new SealClient({
        suiClient,
        serverObjectIds: getAllowlistedKeyServers('testnet'),
        verifyKeyServers: false,
      });
      setSealClient(client);
    }
  }, [currentAccount, suiClient]);

  // Bulletproof session key initialization
  const initializeSessionKey = useCallback(async (): Promise<SessionKey | null> => {
    if (!currentAccount || !suiClient) {
      return null;
    }
    
    const userAddress = currentAccount.address;
    const cacheKey = `${userAddress}_${packageId}`;
    
    // Check global cache first
    const cached = globalSessionKeyCache.get(cacheKey);
    if (cached) {
      if (cached.sessionKey) {
        console.log('Using cached session key');
        setSessionKey(cached.sessionKey);
        setIsInitializingKey(false);
        setKeyInitializationError(null);
        return cached.sessionKey;
      }
      
      if (cached.isInitializing && cached.initPromise) {
        console.log('Session key initialization already in progress, waiting...');
        setIsInitializingKey(true);
        try {
          const result = await cached.initPromise;
          setSessionKey(result);
          setIsInitializingKey(false);
          setKeyInitializationError(result ? null : 'Failed to initialize session key');
          return result;
        } catch (err) {
          setIsInitializingKey(false);
          setKeyInitializationError('Failed to initialize session key');
          return null;
        }
      }
    }
    
    // Start new initialization
    console.log('Starting new session key initialization...');
    setIsInitializingKey(true);
    setKeyInitializationError(null);
    
    const initPromise = new Promise<SessionKey | null>((resolve, reject) => {
      try {
        // Create a fresh session key
        const newSessionKey = new SessionKey({
          address: userAddress,
          packageId,
          ttlMin: 10, // 10 minutes TTL
        });
        
        // Get the personal message to sign
        const messageBytes = newSessionKey.getPersonalMessage();
        
        // Sign the message using the user's wallet
        signPersonalMessage(
          { message: messageBytes },
          {
            onSuccess: async (result) => {
              try {
                await newSessionKey.setPersonalMessageSignature(result.signature);
                
                // Update global cache
                globalSessionKeyCache.set(cacheKey, {
                  sessionKey: newSessionKey,
                  isInitializing: false,
                  initPromise: null
                });
                
                console.log('Session key initialized successfully');
                resolve(newSessionKey);
              } catch (err) {
                console.error('Error setting signature:', err);
                globalSessionKeyCache.delete(cacheKey);
                reject(new Error('Failed to complete key initialization'));
              }
            },
            onError: (error) => {
              console.error('User cancelled or error signing:', error);
              globalSessionKeyCache.delete(cacheKey);
              reject(new Error('Wallet signature required for secure chat'));
            }
          }
        );
      } catch (err) {
        console.error('Error creating session key:', err);
        globalSessionKeyCache.delete(cacheKey);
        reject(new Error('Failed to initialize encryption key'));
      }
    });
    
    // Update global cache with initialization promise
    globalSessionKeyCache.set(cacheKey, {
      sessionKey: null,
      isInitializing: true,
      initPromise
    });
    
    try {
      const result = await initPromise;
      setSessionKey(result);
      setIsInitializingKey(false);
      setKeyInitializationError(null);
      return result;
    } catch (err: any) {
      setIsInitializingKey(false);
      setKeyInitializationError(err.message || 'Failed to initialize session key');
      return null;
    }
  }, [currentAccount, suiClient, packageId, signPersonalMessage]);

  // Retry key initialization
  const retryKeyInitialization = useCallback(() => {
    if (currentAccount) {
      const cacheKey = `${currentAccount.address}_${packageId}`;
      globalSessionKeyCache.delete(cacheKey);
    }
    setKeyInitializationError(null);
    initializeSessionKey();
  }, [initializeSessionKey, currentAccount, packageId]);

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
    // First check if we have it in storage
    let ephemeralKey = retrieveEphemeralKey(advertisementId, interactionId);
    if (ephemeralKey) {
      return ephemeralKey;
    }
    
    // If not, we need to fetch and decrypt it
    if (!sealClient || !sessionKey) {
      console.error('SealClient or SessionKey not available for key fetching');
      return null;
    }
    
    try {
      console.log(`Fetching ephemeral key for chat ${advertisementId}:${interactionId}`);
      
      // Fetch the advertisement to get the interaction
      const advertisement = await fetchAdvertisement(suiClient, advertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      // Find the interaction with the encrypted key
      const result = findInteraction(advertisement, interactionId);
      if (!result) {
        throw new Error('Interaction not found');
      }
      
      const { interaction, userAddress: interactionUser } = result;
      
      if (!interaction.chatEphemeralKeyEncrypted) {
        throw new Error('Encrypted key not found for this interaction');
      }
      
      // Create transaction for access control
      const tx = new Transaction();
      const encryptedKeyBytes = new Uint8Array(interaction.chatEphemeralKeyEncrypted);
      
      // Create the ID for decryption (same as in contract)
      const id = new Uint8Array([
        ...fromHex(advertisementId),
        ...fromHex(interactionUser),
        ...bcs.u64().serialize(interactionId).toBytes()
      ]);
      
      tx.moveCall({
        target: `${packageId}::marketplace::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(id)),
          tx.object(advertisementId),
          tx.pure.address(interactionUser),
          tx.pure.u64(interactionId), 
        ],
      });
      
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      
      // Decrypt the key
      ephemeralKey = await decryptEphemeralKey(
        encryptedKeyBytes,
        sealClient,
        txBytes,
        sessionKey
      );
      
      // Store for future use
      storeEphemeralKey(advertisementId, interactionId, ephemeralKey);
      return ephemeralKey;
      
    } catch (err) {
      console.error('Error fetching ephemeral key:', err);
      throw new Error('Failed to decrypt chat key. You may not have access to this chat.');
    }
  }, [sealClient, sessionKey, suiClient, packageId, findInteraction]);

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

  // Set up polling for message updates - fixed to prevent spam
  useEffect(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Only set up polling if we have a valid chat and session key
    if (!currentAdvertisementId || currentInteractionId === null || !sessionKey) {
      return;
    }
    
    // Load messages immediately
    loadMessages(currentAdvertisementId, currentInteractionId);
    
    // Set up polling every 3 seconds
    pollingIntervalRef.current = setInterval(() => {
      // Only poll if not uploading files and we still have the same chat
      if (!isFileUploading && uploadingFileIds.length === 0 && 
          currentAdvertisementId && currentInteractionId !== null) {
        console.log(`Polling messages for ${currentAdvertisementId}:${currentInteractionId}`);
        loadMessages(currentAdvertisementId, currentInteractionId);
      }
    }, 3000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentAdvertisementId, currentInteractionId, sessionKey, isFileUploading, uploadingFileIds]);

  // Set current chat
  const setCurrentChat = useCallback((advertisementId: string | null, interactionId: number | null) => {
    if (advertisementId !== currentAdvertisementId || interactionId !== currentInteractionId) {
      setMessages([]);
      setError(null);
    }
    setCurrentAdvertisementId(advertisementId);
    setCurrentInteractionId(interactionId);
  }, [currentAdvertisementId, currentInteractionId]);

  // Initialize session key when account changes - bulletproof approach
  useEffect(() => {
    if (currentAccount && suiClient && !sessionKey && !isInitializingKey) {
      initializeSessionKey();
    }
  }, [currentAccount, suiClient, sessionKey, isInitializingKey, initializeSessionKey]);

  // Clean up cache when account changes
  useEffect(() => {
    return () => {
      // Clean up when component unmounts or account changes
      if (currentAccount) {
        const cacheKey = `${currentAccount.address}_${packageId}`;
        const cached = globalSessionKeyCache.get(cacheKey);
        if (cached && !cached.isInitializing) {
          // Keep successful session keys, only clean up failed ones
          if (!cached.sessionKey) {
            globalSessionKeyCache.delete(cacheKey);
          }
        }
      }
    };
  }, [currentAccount?.address, packageId]);

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
