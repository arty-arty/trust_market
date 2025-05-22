import { SealClient, SessionKey, NoAccessError, EncryptedObject } from '@mysten/seal';
import { bcs } from '@mysten/sui/bcs';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, toHex } from '@mysten/sui/utils';
import React from 'react';

export type MoveCallConstructor = (tx: Transaction, id: string) => void;

// Cryptography functions for chat

/**
 * Generate a random symmetric encryption key and encrypt it with Seal
 * @param advertisementId The advertisement ID to use as context
 * @param client The SealClient instance
 * @param packageId The package ID
 * @returns The raw key and encrypted key
 */
export const generateAndEncryptEphemeralKey = async (
  advertisementId: string,
  userAddress: string,
  currentInteractionId: number,
  client: SealClient,
  packageId: string
): Promise<{ rawKey: Uint8Array; encryptedKey: Uint8Array }> => {
  // Generate random symmetric key (32 bytes for AES-256)
  const ephemeralKey = crypto.getRandomValues(new Uint8Array(32));
  
  // We could create a unique ID by adding a random nonce to the advertisement ID
  // But now we would just need determinism
  // const nonce = crypto.getRandomValues(new Uint8Array(5));
  const advertisementBytes = fromHex(advertisementId);
  const id = toHex(new Uint8Array([...advertisementBytes, ...fromHex(userAddress), ...bcs.u64().serialize(currentInteractionId).toBytes()]));
  
  // Encrypt with Seal
  const { encryptedObject } = await client.encrypt({
    threshold: 2,
    packageId,
    id,
    data: ephemeralKey,
  });
  
  return {
    rawKey: ephemeralKey,
    encryptedKey: encryptedObject
  };
};

/**
 * Decrypt an ephemeral key using Seal
 * @param encryptedKey The encrypted key
 * @param client The SealClient instance
 * @param txBytes The transaction bytes for access control
 * @param sessionKey The session key
 * @returns The decrypted key
 */
export const decryptEphemeralKey = async (
  encryptedKey: Uint8Array,
  client: SealClient,
  txBytes: Uint8Array,
  sessionKey: SessionKey
): Promise<Uint8Array> => {

  const decryptedKey = await client.decrypt({
    data: encryptedKey,
    sessionKey,
    txBytes,
  }).catch((err) => {
    console.error('Error decrypting key:', err);
    throw new Error('Failed to decrypt key');
  }
  );

  return decryptedKey;
};

/**
 * Encrypt a message using AES-GCM
 * @param message The message to encrypt
 * @param key The encryption key
 * @returns The encrypted message as a base64 string
 */
export const encryptMessage = async (
  message: string,
  key: Uint8Array
): Promise<string> => {
  // Convert message to bytes
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  
  // Generate a random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Encrypt the message
  const encryptedBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    messageBytes
  );
  
  // Combine IV and encrypted bytes
  const result = new Uint8Array(iv.length + encryptedBytes.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedBytes), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...result));
};

/**
 * Decrypt a message using AES-GCM
 * @param encryptedMessage The encrypted message as a base64 string
 * @param key The decryption key
 * @returns The decrypted message
 */
export const decryptMessage = async (
  encryptedMessage: string,
  key: Uint8Array
): Promise<string> => {
  // Convert from base64
  const encryptedBytes = Uint8Array.from(
    atob(encryptedMessage),
    c => c.charCodeAt(0)
  );

  // Extract IV (first 12 bytes)
  const iv = encryptedBytes.slice(0, 12);
  const ciphertext = encryptedBytes.slice(12);
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  // Decrypt the message
  const decryptedBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    ciphertext
  );
  
  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
};

// File metadata interface
export interface FileMetadata {
  filename: string;
  extension: string;
  type: string;
  size: number;
}

/**
 * Encrypt file data using AES-GCM, with optional metadata
 * @param data The data to encrypt
 * @param key The encryption key
 * @param metadata Optional file metadata
 * @returns The encrypted data as Uint8Array (IV + ciphertext)
 */
export const encryptFileData = async (
  data: Uint8Array,
  key: Uint8Array,
  metadata?: FileMetadata
): Promise<Uint8Array> => {
  // Generate a random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // If metadata is provided, prepend it to the data
  let dataToEncrypt = data;
  if (metadata) {
    // Convert metadata to JSON string and then to bytes
    const metadataJson = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);
    
    // Create a 4-byte header with metadata length
    const metadataLength = new Uint32Array([metadataBytes.length]);
    const metadataLengthBytes = new Uint8Array(metadataLength.buffer);
    
    // Combine: [metadata length (4 bytes)][metadata bytes][file content bytes]
    dataToEncrypt = new Uint8Array(4 + metadataBytes.length + data.length);
    dataToEncrypt.set(metadataLengthBytes, 0);
    dataToEncrypt.set(metadataBytes, 4);
    dataToEncrypt.set(data, 4 + metadataBytes.length);
  }
  
  // Encrypt the data
  const encryptedBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    dataToEncrypt
  );
  
  // Combine IV and encrypted bytes
  const result = new Uint8Array(iv.length + encryptedBytes.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedBytes), iv.length);
  
  return result;
};

/**
 * Decrypt file data using AES-GCM
 * @param encryptedData The encrypted data (IV + ciphertext)
 * @param key The decryption key
 * @returns An object containing the decrypted data and optional metadata
 */
export const decryptFileData = async (
  encryptedData: Uint8Array,
  key: Uint8Array
): Promise<{ data: Uint8Array; metadata?: FileMetadata }> => {
  // Extract IV (first 12 bytes)
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);
  
  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  // Decrypt the data
  const decryptedBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    ciphertext
  );
  
  const decryptedData = new Uint8Array(decryptedBytes);
  
  // Check if the decrypted data contains metadata
  // We do this by checking if the first 4 bytes contain a valid length
  try {
    // Read the first 4 bytes as a Uint32Array to get metadata length
    const metadataLengthView = new DataView(decryptedData.buffer, 0, 4);
    const metadataLength = metadataLengthView.getUint32(0, true); // true for little-endian
    
    // Sanity check: metadata length should be reasonable (less than 10KB)
    if (metadataLength > 0 && metadataLength < 10240 && metadataLength < decryptedData.length - 4) {
      // Extract metadata bytes
      const metadataBytes = decryptedData.slice(4, 4 + metadataLength);
      const metadataJson = new TextDecoder().decode(metadataBytes);
      
      try {
        // Parse metadata JSON
        const metadata = JSON.parse(metadataJson) as FileMetadata;
        
        // Extract file content (everything after metadata)
        const fileData = decryptedData.slice(4 + metadataLength);
        
        return { data: fileData, metadata };
      } catch (e) {
        // If JSON parsing fails, assume no valid metadata
        console.warn('Failed to parse file metadata JSON:', e);
        return { data: decryptedData };
      }
    }
  } catch (e) {
    // If any error occurs during metadata extraction, return the full data
    console.warn('Error extracting file metadata:', e);
  }
  
  // If we get here, either there's no metadata or we couldn't parse it
  return { data: decryptedData };
};

/**
 * Store an ephemeral key in session storage
 * @param advertisementId The advertisement ID
 * @param interactionUserAddress The address of the user in the interaction (buyer)
 * @param interactionId The unique ID of the interaction
 * @param key The key to store
 */
export const storeEphemeralKey = (
  advertisementId: string,
  interactionUserAddress: string,
  interactionId: number,
  key: Uint8Array
): void => {
  const keyId = `ephemeral_key_${advertisementId}_${interactionUserAddress}_${interactionId}`;
  const keyBase64 = btoa(String.fromCharCode(...key));
  sessionStorage.setItem(keyId, keyBase64);
};

/**
 * Retrieve an ephemeral key from session storage
 * @param advertisementId The advertisement ID
 * @param interactionUserAddress The address of the user in the interaction (buyer)
 * @param interactionId The unique ID of the interaction
 * @returns The key or null if not found
 */
export const retrieveEphemeralKey = (
  advertisementId: string,
  interactionUserAddress: string,
  interactionId: number
): Uint8Array | null => {
  const keyId = `ephemeral_key_${advertisementId}_${interactionUserAddress}_${interactionId}`;
  const keyBase64 = sessionStorage.getItem(keyId);
  
  if (!keyBase64) return null;
  
  return Uint8Array.from(
    atob(keyBase64),
    c => c.charCodeAt(0)
  );
};

// Disclaimer Some Functions are inspired by Mysten's Seal Example :)
export const downloadAndDecrypt = async (
  blobIds: string[],
  sessionKey: SessionKey,
  suiClient: SuiClient,
  sealClient: SealClient,
  moveCallConstructor: (tx: Transaction, id: string) => void,
  setError: (error: string | null) => void,
  setDecryptedFileUrls: (urls: string[]) => void,
  setIsDialogOpen: (open: boolean) => void,
  setReloadKey: (updater: (prev: number) => number) => void,
) => {
  // First, download all files in parallel using downloadFromWalrus helper
  // which now prioritizes aggregator1 for best uptime
  const downloadResults = await Promise.all(
    blobIds.map(async (blobId) => {
      return downloadFromWalrus(blobId);
    }),
  );

  // Filter out failed downloads
  const validDownloads = downloadResults.filter((result): result is Uint8Array => result !== null);
  console.log('validDownloads count', validDownloads.length);

  if (validDownloads.length === 0) {
    const errorMsg =
      'Cannot retrieve files from any Walrus aggregator. Files uploaded more than 1 epoch ago may have been deleted from Walrus.';
    console.error(errorMsg);
    setError(errorMsg);
    return;
  }

  // Fetch keys in batches of <=10
  for (let i = 0; i < validDownloads.length; i += 10) {
    const batch = validDownloads.slice(i, i + 10);
    const ids = batch.map((encByteArray) => EncryptedObject.parse(encByteArray).id); // enc is now Uint8Array
    const tx = new Transaction();
    ids.forEach((id) => moveCallConstructor(tx, id));
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
    try {
      await sealClient.fetchKeys({ ids, txBytes, sessionKey, threshold: 2 });
    } catch (err) {
      console.log(err);
      const errorMsg =
        err instanceof NoAccessError
          ? 'No access to decryption keys'
          : 'Unable to decrypt files, try again';
      console.error(errorMsg, err);
      setError(errorMsg);
      return;
    }
  }

  // Then, decrypt files sequentially
  const decryptedFileUrls: string[] = [];
  for (const encryptedData of validDownloads) {
    const fullId = EncryptedObject.parse(encryptedData).id; // encryptedData is already Uint8Array
    const tx = new Transaction();
    moveCallConstructor(tx, fullId);
    const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
    try {
      // Note that all keys are fetched above, so this only local decryption is done
      const decryptedFile = await sealClient.decrypt({
        data: encryptedData, // Pass Uint8Array directly
        sessionKey,
        txBytes,
      });
      const blob = new Blob([decryptedFile], { type: 'image/jpg' });
      decryptedFileUrls.push(URL.createObjectURL(blob));
    } catch (err) {
      console.log(err);
      const errorMsg =
        err instanceof NoAccessError
          ? 'No access to decryption keys'
          : 'Unable to decrypt files, try again';
      console.error(errorMsg, err);
      setError(errorMsg);
      return;
    }
  }

  if (decryptedFileUrls.length > 0) {
    setDecryptedFileUrls(decryptedFileUrls);
    setIsDialogOpen(true);
    setReloadKey((prev) => prev + 1);
  }
};

// Walrus interaction helpers
const WALRUS_AGGREGATORS = ['aggregator1', 'aggregator2', 'aggregator3', 'aggregator4', 'aggregator5', 'aggregator6'];
// As per EncryptAndUpload.tsx, uploads go to "publisher" services.
// These correspond to the publisher proxies in vite.config.ts.
const WALRUS_PUBLISHERS = ['publisher1', 'publisher2', 'publisher3', 'publisher4', 'publisher5', 'publisher6'];
const WALRUS_TIMEOUT = 10000; // 10 seconds
const WALRUS_UPLOAD_EPOCHS = 1; // Number of epochs to store the blob, as seen in EncryptAndUpload.tsx

/**
 * Uploads encrypted data to a Walrus publisher service.
 * @param encryptedData The encrypted data as Uint8Array.
 * @returns The blob_id if successful, otherwise null.
 */
export const uploadToWalrus = async (encryptedData: Uint8Array): Promise<string | null> => {
  // Always try publisher1 first as it has the best uptime, consistent with our download approach
  const prioritizedPublishers = ['publisher1', ...WALRUS_PUBLISHERS.filter(pub => pub !== 'publisher1')];
  
  for (const publisher of prioritizedPublishers) {
    // Construct the URL based on EncryptAndUpload.tsx: /<publisher_proxy_path>/v1/blobs?epochs=<num_epochs>
    const publisherUrl = `/${publisher}/v1/blobs?epochs=${WALRUS_UPLOAD_EPOCHS}`;
    console.log(`Attempting to upload to Walrus via ${publisherUrl}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WALRUS_TIMEOUT);

      const response = await fetch(publisherUrl, {
        method: 'PUT', // Method is PUT as per EncryptAndUpload.tsx
        headers: {
          // Content-Type might not be strictly needed by Walrus for PUT /blobs if it expects raw octet-stream
          // but it's good practice for binary data.
          // 'Content-Type': 'application/octet-stream', // EncryptAndUpload.tsx doesn't specify, often optional for PUT
        },
        body: encryptedData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const responseData = await response.json();
        // Extract blobId based on the logged response structure
        let blobId: string | undefined;
        if (responseData.alreadyCertified) { // Check directly on responseData
          blobId = responseData.alreadyCertified.blobId;
        } else if (responseData.newlyCreated) { // Check directly on responseData
          blobId = responseData.newlyCreated.blobObject?.blobId;
        }
        
        if (typeof blobId === 'string') {
          console.log(`Successfully uploaded to ${publisherUrl}, blob_id: ${blobId}`);
          return blobId;
        } else {
          console.error(`Walrus upload response from ${publisherUrl} did not contain a valid blob_id structure:`, responseData);
        }
      } else {
        console.warn(`Failed to upload to ${publisherUrl}. Status: ${response.status}`, await response.text());
      }
    } catch (err) {
      console.warn(`Error uploading to ${publisherUrl}:`, err);
    }
  }

  console.error('Failed to upload to any Walrus publisher after trying all options.');
  return null;
};


/**
 * Downloads data from Walrus using a blob_id.
 * @param blobId The ID of the blob to download.
 * @returns The data as Uint8Array if successful, otherwise null.
 */
export const downloadFromWalrus = async (blobId: string): Promise<Uint8Array | null> => {
  // Always try aggregator1 first as it has the best uptime
  const prioritizedAggregators = ['aggregator1', ...WALRUS_AGGREGATORS.filter(agg => agg !== 'aggregator1')];
  
  // Try each aggregator in order until one succeeds
  for (const aggregator of prioritizedAggregators) {
    const aggregatorUrl = `/${aggregator}/v1/blobs/${blobId}`;
    console.log(`Attempting to download from Walrus via ${aggregatorUrl}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WALRUS_TIMEOUT);

      const response = await fetch(aggregatorUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`Successfully downloaded from ${aggregatorUrl}`);
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } else {
        console.warn(`Failed to download from ${aggregatorUrl}. Status: ${response.status}`);
      }
    } catch (err) {
      console.warn(`Error downloading from ${aggregatorUrl}:`, err);
    }
  }
  
  console.error(`Blob ${blobId} cannot be retrieved from any Walrus aggregator.`);
  return null;
};


export const getObjectExplorerLink = (id: string): React.ReactElement => {
  return React.createElement(
    'a',
    {
      href: `https://testnet.suivision.xyz/object/${id}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: { textDecoration: 'underline' },
    },
    id.slice(0, 10) + '...',
  );
};
