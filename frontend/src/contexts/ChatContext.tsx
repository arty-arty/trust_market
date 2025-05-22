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
  
  // Chat functions
  sendMessage: (text: string) => Promise<void>;
  sendFileMessage: (file: File) => Promise<void>;
  loadMessages: (advertisementId: string, interactionId: number) => Promise<void>;
  
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
  
  // Use a ref for the polling interval to avoid dependency issues in useEffect
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize SealClient
  useEffect(() => {
    if (currentAccount && suiClient) {
      // Create a new SealClient instance
      const client = new SealClient({
        suiClient,
        serverObjectIds: getAllowlistedKeyServers('testnet'),
        verifyKeyServers: false,
      });
      setSealClient(client);
    }
  }, [currentAccount, suiClient]);

  // Session key management
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [sessionKeyInitialized, setSessionKeyInitialized] = useState(false);
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  // Track if session key initialization is in progress
  const sessionKeyInitInProgress = useRef(false);

  // Fetch and decrypt the ephemeral key
  const fetchEphemeralKey = useCallback(async (advertisementId: string, interactionId: number, interaction: Interaction) => {
    if (!sealClient || !sessionKey) {
      console.error('SealClient or SessionKey not initialized for fetchEphemeralKey');
      // Try to initialize sessionKey if not already done
      if (!sessionKey && !sessionKeyInitialized && !sessionKeyInitInProgress.current) {
        // This part is tricky as initializeSessionKey is async and sets state
        // For now, just log and return null, relying on other effects to init sessionKey
        console.warn('SessionKey not available for fetchEphemeralKey, initialization might be pending.');
      }
      return null;
    }
    
    try {
      console.log('Fetching ephemeral key for interaction:', interactionId);
      
      // Check if the interaction has an encrypted key
      if (!interaction.chatEphemeralKeyEncrypted) {
        console.warn('No encrypted key found for this interaction');
        return null;
      }
      
      // Create a transaction to check access using the correct seal_approve signature
      const tx = new Transaction();
      
      // Convert the encrypted key to Uint8Array
      const encryptedKeyBytes = new Uint8Array(interaction.chatEphemeralKeyEncrypted);
      
      // The interaction user is always the one who joined the advertisement
      // This is the address that was used when encrypting the ephemeral key
      const interactionUser = interaction.user;
      
      // ID is constructed the same way as in the marketplace.move contract
      // This is critical for the decryption to work correctly
      const id = new Uint8Array([
        ...fromHex(advertisementId),
        ...fromHex(interactionUser),
        ...bcs.u64().serialize(interactionId).toBytes()
      ]);
      
      // Create the transaction with the correct arguments
      tx.moveCall({
        target: `${packageId}::marketplace::seal_approve`,
        arguments: [
          tx.pure.vector('u8', Array.from(id)),
          tx.object(advertisementId),
          tx.pure.address(interactionUser),
          tx.pure.u64(interactionId), 
        ],
      });
      
      // Build the transaction bytes (only transaction kind, no execution)
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      
      // Decrypt the key using the session key and transaction bytes
      const decryptedKey = await decryptEphemeralKey(
        encryptedKeyBytes,
        sealClient,
        txBytes,
        sessionKey
      );
      
  // Store the key in session storage for future use
  storeEphemeralKey(advertisementId, interactionUser, interactionId, decryptedKey);
      return decryptedKey;
    } catch (err) {
      console.error('Error fetching ephemeral key:', err);
      setError('Failed to decrypt chat key. You may not have access to this chat.');
      return null;
    }
  }, [sealClient, sessionKey, packageId, suiClient, setError, storeEphemeralKey, fromHex, bcs, sessionKeyInitialized]); // Added sessionKeyInitialized

  // Track if a file upload is in progress - we'll use this to disable polling
  const [isFileUploading, setIsFileUploading] = useState(false);
  // Keep track of file messages that are being uploaded - these shouldn't be removed during polling
  const [uploadingFileIds, setUploadingFileIds] = useState<string[]>([]);

  // Refs for polling check to ensure latest state is used in interval
  const isFileUploadingRef = useRef(isFileUploading);
  useEffect(() => { isFileUploadingRef.current = isFileUploading; }, [isFileUploading]);

  const uploadingFileIdsRef = useRef(uploadingFileIds);
  useEffect(() => { uploadingFileIdsRef.current = uploadingFileIds; }, [uploadingFileIds]);
  
  // Load messages (defined before polling useEffect)
  const loadMessages = useCallback(async (advertisementId: string, interactionId: number) => {
    if (!suiClient || !currentAccount || !sealClient) {
      setError('Client not initialized for loadMessages');
      return;
    }
    
    // Don't clear existing messages while loading - just set loading state
    setIsLoadingMessages(true);
    setError(null);
    
    try {
      // Fetch advertisement
      const advertisement = await fetchAdvertisement(suiClient, advertisementId, packageId);
      
      if (!advertisement) {
        setError('Advertisement not found');
        setIsLoadingMessages(false);
        return;
      }
      
      // Find the interaction
      let interaction: Interaction | undefined;
      let userAddress = '';
      
      // Search through all user profiles to find the interaction
      Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
        const found = profile.interactions.find(i => i.id === interactionId);
        if (found) {
          interaction = found;
          userAddress = address;
        }
      });
      
      if (!interaction) {
        console.warn(`Interaction ${interactionId} not found for advertisement ${advertisementId}`);
        setError('Interaction not found');
        setIsLoadingMessages(false);
        return;
      }
      
      // Check if we have the ephemeral key in session storage
      let ephemeralKey = retrieveEphemeralKey(advertisementId, userAddress, interactionId);
      
      // If not, try to fetch and decrypt it
      if (!ephemeralKey && sessionKey && interaction.chatEphemeralKeyEncrypted) {
        console.log(`No ephemeral key in storage, fetching for interaction ${interactionId}`);
        // Ensure fetchEphemeralKey is called with a valid interaction object
        const castedInteraction = interaction as Interaction; // Ensure type compatibility
        ephemeralKey = await fetchEphemeralKey(advertisementId, interactionId, castedInteraction);
        
        if (!ephemeralKey) {
          setError('Failed to decrypt chat key. You may not have access to this chat.');
          setIsLoadingMessages(false);
          return;
        }
      }
      
      if (!ephemeralKey) {
        setError('No ephemeral key available for decryption');
        setIsLoadingMessages(false);
        return;
      }
      
      // Get chat messages
      const chatMessages = interaction.chatMessages || [];
      
      // If we have uploading files, we need to be careful not to remove them when refreshing messages
      if (uploadingFileIds.length > 0) {
        // Keep any temporary upload messages in the list
        const uploadingMessages = messages.filter(m => 
          uploadingFileIds.includes(m.id) && m.status === 'sending'
        );
        
        // Check if we already have the same messages from the server (to avoid unnecessary updates)
        if (messages.length === chatMessages.length + uploadingMessages.length && 
            messages.filter(m => !uploadingFileIds.includes(m.id))
                   .every(m => chatMessages.some(cm => cm.id === m.id))) {
          // Messages haven't changed, no need to update
          setIsLoadingMessages(false);
          return;
        }
      } else {
        // Normal check if we don't have uploading files
        if (messages.length === chatMessages.length && 
            messages.every(m => chatMessages.some(cm => cm.id === m.id))) {
          // Messages haven't changed, no need to update
          setIsLoadingMessages(false);
          return;
        }
      }
      
      // Decrypt messages
      const decryptedMessages: ChatMessage[] = [];
      
      for (const message of chatMessages) {
        try {
          // If there's a blob ID, it's a file or image
          if (message.messageBlobId) {
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
          } 
          // If there's encrypted text, decrypt it
          else if (message.messageEncryptedText) {
            const decryptedText = await decryptMessage(
              message.messageEncryptedText,
              ephemeralKey
            );
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
            text: message.messageBlobId ? '[Image - decryption failed]' : 'Failed to decrypt message',
            type: message.messageBlobId ? 'image' : 'text',
          });
        }
      }
      
      // Sort messages by timestamp
      decryptedMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // If we have uploading messages, we need to preserve them
      if (uploadingFileIds.length > 0) {
        // Keep any temporary upload messages
        const uploadingMessages = messages.filter(m => 
          uploadingFileIds.includes(m.id) && m.status === 'sending'
        );
        
        // Combine decrypted messages with uploading messages
        if (decryptedMessages.length > 0 || uploadingMessages.length > 0) {
          setMessages([...decryptedMessages, ...uploadingMessages]);
        }
      } else {
        // Normal update if we don't have uploading files
        if (decryptedMessages.length > 0) {
          setMessages(decryptedMessages);
        }
      }
      
      setIsLoadingMessages(false);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
      setIsLoadingMessages(false);
    }
  }, [
    suiClient, currentAccount, sealClient, packageId, sessionKey, 
    fetchEphemeralKey, setError, setIsLoadingMessages, setMessages, 
    messages, 
    uploadingFileIds 
  ]);

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);
  
  // Set up polling when chat changes
  useEffect(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Only set up polling if we have a valid chat
    if (!currentAdvertisementId || currentInteractionId === null) {
      return;
    }
    
    // Load messages immediately
    loadMessages(currentAdvertisementId, currentInteractionId);
    
    // Set up polling every 5 seconds for a more responsive chat experience
    const pollFn = () => {
      // Use refs for the check to ensure latest values are used
      if (isFileUploadingRef.current || uploadingFileIdsRef.current.length > 0) {
        console.log("Skipping polling because a file is being uploaded (using refs)");
        return;
      }
      
      if (currentAdvertisementId && currentInteractionId !== null) {
        // Add timestamp to avoid multiple components polling at the same time
        const now = Date.now();
        const lastPollTime = parseInt(sessionStorage.getItem(`last_poll_${currentAdvertisementId}_${currentInteractionId}`) || '0');
        
        // Only poll if it's been at least 4 seconds since the last poll from any component
        if (now - lastPollTime > 4000) {
          sessionStorage.setItem(`last_poll_${currentAdvertisementId}_${currentInteractionId}`, now.toString());
          console.log(`Polling for messages at ${new Date().toLocaleTimeString()} (using refs)`);
          loadMessages(currentAdvertisementId, currentInteractionId);
        } else {
          console.log(`Skipping poll, last poll was ${(now - lastPollTime)/1000}s ago (using refs)`);
        }
      }
    };

    pollingIntervalRef.current = setInterval(pollFn, 5000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentAdvertisementId, currentInteractionId, loadMessages]); // Added loadMessages
  
  // Set current chat
  const setCurrentChat = (advertisementId: string | null, interactionId: number | null) => {
    // Clear messages when changing chats
    if (advertisementId !== currentAdvertisementId || interactionId !== currentInteractionId) {
      setMessages([]);
    }
    
    setCurrentAdvertisementId(advertisementId);
    setCurrentInteractionId(interactionId);
  };
  
  // Initialize the session key for Seal encryption
  useEffect(() => {
    // Use a ref to track if initialization is in progress to prevent multiple sign requests
    if (sessionKeyInitInProgress.current || sessionKeyInitialized || !currentAccount || !suiClient) {
      return;
    }
    
    const initializeSessionKey = async () => {
      // Set flag to prevent multiple initializations
      sessionKeyInitInProgress.current = true;
      
      try {
        console.log('Starting session key initialization');
        
        // Check if we already have a session key in localStorage
        const storedSessionKey = localStorage.getItem(`seal_session_key_${currentAccount.address}`);
        if (storedSessionKey) {
          try {
            // Try to parse and use the stored session key
            const parsedKey = JSON.parse(storedSessionKey);
            if (parsedKey && parsedKey.expiry > Date.now()) {
              console.log('Using cached session key');
              const restoredKey = new SessionKey({
                address: currentAccount.address,
                packageId,
                ttlMin: 5,
              });
              
              // Restore the signature
              await restoredKey.setPersonalMessageSignature(parsedKey.signature);
              
              setSessionKey(restoredKey);
              setSessionKeyInitialized(true);
              sessionKeyInitInProgress.current = false;
              return;
            } else {
              console.log('Cached session key expired, creating new one');
              localStorage.removeItem(`seal_session_key_${currentAccount.address}`);
            }
          } catch (err) {
            console.error('Error restoring session key:', err);
            localStorage.removeItem(`seal_session_key_${currentAccount.address}`);
          }
        }
        
        // Create a new session key
        const newSessionKey = new SessionKey({
          address: currentAccount.address,
          packageId,
          ttlMin: 5, // TTL of 5 minutes
        });
        
        // Get the personal message to sign
        const messageBytes = newSessionKey.getPersonalMessage();
        
        // Sign the message using the user's wallet
        signPersonalMessage(
          {
            message: messageBytes,
          },
          {
            onSuccess: async (result) => {
              try {
                // Set the signature to complete initialization
                await newSessionKey.setPersonalMessageSignature(result.signature);
                console.log('Session key initialized successfully');
                
                // Store the session key
                setSessionKey(newSessionKey);
                setSessionKeyInitialized(true);
                
                // Cache the session key in localStorage
                localStorage.setItem(`seal_session_key_${currentAccount.address}`, JSON.stringify({
                  signature: result.signature,
                  expiry: Date.now() + (4 * 60 * 1000) // 4 minutes (slightly less than TTL)
                }));
              } catch (err) {
                console.error('Error setting personal message signature:', err);
                setError('Failed to initialize session key. Please try again.');
              } finally {
                sessionKeyInitInProgress.current = false;
              }
            },
            onError: (error) => {
              console.error('Error signing personal message:', error);
              setError('Failed to sign message for encryption. Please try again.');
              sessionKeyInitInProgress.current = false;
            }
          }
        );
      } catch (err) {
        console.error('Error initializing session key:', err);
        setError('Failed to initialize encryption. Some features may not work properly.');
        sessionKeyInitInProgress.current = false;
      }
    };
    
    initializeSessionKey();
  }, [currentAccount, suiClient, packageId, signPersonalMessage, sessionKeyInitialized]);

  // Send message
  const sendMessage = async (text: string) => {
    if (!suiClient || !currentAccount || !sealClient || !currentAdvertisementId || currentInteractionId === null) {
      setError('Client not initialized or chat not selected');
      return;
    }
    
    setError(null);
    
    try {
      // First try to get the ephemeral key from the user's address in the interaction
      let ephemeralKey = retrieveEphemeralKey(currentAdvertisementId, currentAccount.address, currentInteractionId);
      
      // If that fails, try to get it from the interaction.
      // This can happen if the user is the creator of the advertisement
      // In that case, we need to check advertisement user profiles to find the right interaction user
      if (!ephemeralKey) {
        console.log("Attempting to retrieve ephemeral key from alternative sources...");
        
        try {
          // Fetch advertisement to get user profiles and interactions
          const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
          
          if (advertisement) {
            let interactionUser = '';
            let interaction;
            
            // Look through all user profiles to find the current interaction
            Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
              const found = profile.interactions.find(i => i.id === currentInteractionId);
              if (found) {
                interaction = found;
                interactionUser = address;
              }
            });
            
            // If we found the interaction and its user, try to get the ephemeral key using that
            if (interaction && interactionUser) {
              console.log(`Found interaction. Trying with user: ${interactionUser}`);
              ephemeralKey = retrieveEphemeralKey(currentAdvertisementId, interactionUser, currentInteractionId);
              
  // If still not found, try to fetch and decrypt it - cast interaction as any to access chatEphemeralKeyEncrypted
  const activeInteraction = interaction as any;
  if (!ephemeralKey && activeInteraction && typeof activeInteraction === 'object' && 
      activeInteraction.chatEphemeralKeyEncrypted && 
      sessionKey) {
    console.log("Attempting to fetch and decrypt ephemeral key...");
    ephemeralKey = await fetchEphemeralKey(currentAdvertisementId, currentInteractionId, activeInteraction);
  }
            }
          }
        } catch (err) {
          console.error("Error while trying to find ephemeral key:", err);
        }
      }
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key available for encryption. Please try refreshing the page.');
      }
      
      // Create a temporary message to show in the UI
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
      };
      
      // Add to UI immediately
      setMessages(prev => [...prev, tempMessage]);
      
      // Get the advertisement to determine the correct user address
      const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      // Find the interaction to get the correct interaction user
      let interactionUser = currentAccount.address;
      let isCreator = advertisement.creator === currentAccount.address;
      
      // If current user is the creator (freelancer), we need to use the other party's address
      if (isCreator) {
        // Find the interaction and its user
        Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
          const found = profile.interactions.find(i => i.id === currentInteractionId);
          if (found) {
            // Use the client's address for the interaction_user, not the creator's
            interactionUser = address;
          }
        });
      }
      
      console.log(`Sending message as ${currentAccount.address}, interaction user: ${interactionUser}`);
      
      // Create transaction to add the message
      const tx = await addChatMessage(
        packageId,
        currentAdvertisementId,
        interactionUser,
        currentInteractionId,
        { text },
        ephemeralKey
      );
      
      // Execute the transaction
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log('Message sent successfully:', result);
            // Update the temporary message to sent status
            setMessages(prev => 
              prev.map(msg => 
                msg.id === tempMessage.id 
                  ? { ...msg, id: result.digest } 
                  : msg
              )
            );
          },
          onError: (error) => {
            console.error('Error sending message:', error);
            setError('Failed to send message. Please try again.');
            // Remove the temporary message
            setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          }
        }
      );
    } catch (err) {
      console.error('Error preparing message transaction:', err);
      setError('Failed to prepare message transaction. Please try again.');
      // Remove any temporary messages
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
    }
  };
  
  // Send file message
  const sendFileMessage = async (file: File) => {
    // Set flag to disable polling during upload
    setIsFileUploading(true);
    if (!suiClient || !currentAccount || !sealClient || !currentAdvertisementId || currentInteractionId === null) {
      setError('Client not initialized or chat not selected for file sending.');
      return;
    }

    setError(null);
    const tempId = `temp-file-${Date.now()}`;
    const isImage = file.type.startsWith('image/');

    // Create a temporary message to show in the UI
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

    // Register this message as being uploaded so it doesn't get removed during polling
    setUploadingFileIds(prev => [...prev, tempId]);
    
    // Add to UI immediately to show the upload animation
    setMessages(prev => [...prev, tempMessage]);

    // We won't update the message until it's ready for wallet signing
    let uploadedBlodId: string | null = null;

    try {
      // Use the same ephemeral key retrieval logic that works for regular messages
      // First try to get the ephemeral key from the user's address in the interaction
      let ephemeralKey = retrieveEphemeralKey(currentAdvertisementId, currentAccount.address, currentInteractionId);
      
      // If that fails, try to get it from the interaction.
      // This can happen if the user is the creator of the advertisement
      if (!ephemeralKey) {
        console.log("Attempting to retrieve ephemeral key from alternative sources for file upload...");
        
        try {
          // Fetch advertisement to get user profiles and interactions
          const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
          
          if (advertisement) {
            let interactionUser = '';
            let interaction;
            
            // Look through all user profiles to find the current interaction
            Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
              const found = profile.interactions.find(i => i.id === currentInteractionId);
              if (found) {
                interaction = found;
                interactionUser = address;
              }
            });
            
            // If we found the interaction and its user, try to get the ephemeral key using that
            if (interaction && interactionUser) {
              console.log(`Found interaction. Trying with user: ${interactionUser}`);
              ephemeralKey = retrieveEphemeralKey(currentAdvertisementId, interactionUser, currentInteractionId);
              
              // If still not found, try to fetch and decrypt it - cast to any to access chatEphemeralKeyEncrypted
              const activeInteraction = interaction as any;
              if (!ephemeralKey && activeInteraction && typeof activeInteraction === 'object' && 
                  activeInteraction.chatEphemeralKeyEncrypted && 
                  sessionKey) {
                console.log("Attempting to fetch and decrypt ephemeral key for file upload...");
                ephemeralKey = await fetchEphemeralKey(currentAdvertisementId, currentInteractionId, activeInteraction);
              }
            }
          }
        } catch (err) {
          console.error("Error while trying to find ephemeral key for file upload:", err);
        }
      }
      
      if (!ephemeralKey) {
        throw new Error('No ephemeral key available for file encryption. Please try refreshing the page.');
      }

      // Read the file data
      const fileData = new Uint8Array(await file.arrayBuffer());

      // Create metadata for non-image files
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

      // Encrypt the file data
      const encryptedFileData = await encryptFileData(fileData, ephemeralKey, metadata);
      
      // Upload to Walrus - keep the animation showing
      console.log("Uploading encrypted file to Walrus...");
      const blobId = await uploadToWalrus(encryptedFileData);

      if (!blobId) {
        setError('Failed to upload file to Walrus.');
        setMessages(prev => prev.map(msg => 
          msg.id === tempId ? { ...msg, status: 'failed', text: '[File - send failed]' } : msg
        ));
        // Ensure isFileUploading is reset and tempId is removed on Walrus upload failure
        setIsFileUploading(false);
        setUploadingFileIds(prev => prev.filter(id => id !== tempId));
        return;
      }
      
      // Save the successful blobId for transaction preparation
      uploadedBlodId = blobId;

      // Get the advertisement to determine the correct user address
      // We're still preparing for the wallet signing, so keep the animation
      console.log("File uploaded to Walrus successfully, preparing transaction...");
      const advertisement = await fetchAdvertisement(suiClient, currentAdvertisementId, packageId);
      if (!advertisement) {
        throw new Error('Advertisement not found');
      }
      
      // Find the interaction to get the correct interaction user
      let interactionUser = currentAccount.address;
      let isCreator = advertisement.creator === currentAccount.address;
      
      // If current user is the creator (freelancer), we need to use the other party's address
      if (isCreator) {
        // Find the interaction and its user
        Object.entries(advertisement.userProfiles).forEach(([address, profile]) => {
          const found = profile.interactions.find(i => i.id === currentInteractionId);
          if (found) {
            // Use the client's address for the interaction_user, not the creator's
            interactionUser = address;
          }
        });
      }
      
      console.log(`Sending file message as ${currentAccount.address}, interaction user: ${interactionUser}`);
      
      // Create transaction to add the message with the blob ID
      const tx = await addChatMessage(
        packageId,
        currentAdvertisementId,
        interactionUser,
        currentInteractionId,
        { blobId: blobId },
        ephemeralKey
      );

      // Update the message to show it's ready for signing
      // We're doing this just before signing to ensure the animation shows during the upload
      const displayText = isImage ? '[Image - waiting for wallet...]' : `[File: ${file.name} - waiting for wallet...]`;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? { ...msg, text: displayText }
            : msg
        )
      );

      // Keep the upload animation visible until the wallet opens
      // The actual wallet prompt happens when signAndExecute is called
            
      // Execute the transaction - wallet will show after this call
      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            console.log("Transaction successful with digest:", result.digest);
            const displayText = isImage ? '[Image]' : `[File: ${file.name}]`;
            
            // Mark upload complete
            setIsFileUploading(false);
            
            // Remove this ID from the uploading list
            setUploadingFileIds(prev => prev.filter(id => id !== tempId));
            
            setMessages(prev =>
              prev.map(msg =>
                msg.id === tempId
                  ? { ...msg, id: result.digest, status: 'sent', text: displayText }
                  : msg
              )
            );
            
            // Reload messages to get the proper URL
            loadMessages(currentAdvertisementId, currentInteractionId);
          },
          onError: (error) => {
            console.error('Error sending file message:', error);
            setError('Failed to send file. Please try again.');
            
            // Mark upload complete even on error
            setIsFileUploading(false);
            
            // Remove this ID from the uploading list on error too
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
      setError(err.message || 'Failed to prepare file message. Please try again.');
      
      // Mark upload complete on error
      setIsFileUploading(false);
      
      // Remove from uploading files list
      setUploadingFileIds(prev => prev.filter(id => id !== tempId));
      
      setMessages(prev =>
        prev.map(msg => 
          msg.id === tempId ? { ...msg, status: 'failed', text: '[File - send failed]' } : msg
        )
      );
    }
  };

  const value = {
    messages,
    isLoadingMessages,
    error,
    sendMessage,
    sendFileMessage,
    loadMessages,
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
