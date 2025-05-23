
// Interfaces to match the marketplace.move contract structure

export interface UserProfile {
  user: string;
  interactions: Interaction[];
}

export interface Advertisement {
  id: string;
  creator: string;
  title: string;
  description: string;
  amount: number;
  createdAt: number;
  userProfiles: Record<string, UserProfile>;
}

export interface Interaction {
  id: number;
  user: string;
  joinedAt: number;
  seller: string;
  assignedAdmin: string;
  chatMessages: ChatMessage[];
  state: number; // 0: joined, 1: seller_completed, 2: buyer_approved, 3: disputed
  chatEphemeralKeyEncrypted?: Uint8Array; // Encrypted symmetric key for chat
}

export interface ChatMessage {
  id: string;
  advertisementId: string;
  interactionUser: string;
  interactionId: number;
  sender: string;
  timestamp: number;
  messageEncryptedText?: string;
  messageBlobId?: string;
}

export interface UserReputation {
  user: string;
  ratingSum: number;
  ratingCount: number;
  totalVolume: number;
  totalDeals: number;
  peacefulResolutions: number;
  disputedDeals: number;
  createdAt: number;
  lastActive: number;
}

export interface Review {
  id: string;
  transactionId: string;
  reviewer: string;
  reviewed: string;
  rating: number;
  comment: string;
  timestamp: number;
  resolutionType: number;
}

// Constants for advertisement states
export const STATE_AVAILABLE = 0;
export const STATE_JOINED = 1;
export const STATE_COMPLETED = 2;
export const STATE_DISPUTED = 3;

// Constants for interaction states
export const INTERACTION_JOINED = 0;
export const INTERACTION_SELLER_COMPLETED = 1;
export const INTERACTION_BUYER_APPROVED = 2;
export const INTERACTION_DISPUTED = 3;

// Constants for resolution types
export const RESOLUTION_PEACEFUL = 0;
export const RESOLUTION_ADMIN_BUYER = 1;
export const RESOLUTION_ADMIN_SELLER = 2;
export const RESOLUTION_ADMIN_SPLIT = 3;
