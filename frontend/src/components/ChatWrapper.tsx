import React, { useRef, useState, useEffect } from 'react';
import { Dialog } from '@radix-ui/themes';
import { Send, Image, Paperclip, X, CheckCircle, AlertCircle, User, History } from 'lucide-react';
import { ChatProvider, useChat } from '../contexts/ChatContext';
import { Advertisement } from '../types';

// Message type for UI rendering
interface Message {
  id: string;
  sender: string;
  timestamp: number;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  imageUrl?: string;
  fileUrl?: string;
  fileMetadata?: {
    filename: string;
    extension: string;
    type: string;
    size: number;
  };
}

interface ChatWrapperProps {
  advertisement: Advertisement;
  userAddress: string;
  interactionId?: number;
  isCreator: boolean;
  isAdmin: boolean;
  debugMode?: boolean;
  onMarkCompleted? : any;
  onDispute? : any;
  onReleasePayment? : any;
}

// Inner component that uses the context
const ChatUI: React.FC<ChatWrapperProps> = ({ 
  advertisement, 
  userAddress, 
  interactionId, 
  isCreator, 
  isAdmin, 
  debugMode 
}) => {
  const { 
    messages, 
    isLoadingMessages: isLoading, 
    error, 
    sendMessage,
    sendFileMessage,
    currentAdvertisementId,
    currentInteractionId,
    setCurrentChat,
    currentAccount
  } = useChat();
  
  // Initialize chat when component mounts
  useEffect(() => {
    if (advertisement && advertisement.id) {
      // If interactionId is provided, use it
      // Otherwise, find the latest interaction for this user
      let chatInteractionId = interactionId;
      
      if (chatInteractionId === undefined && advertisement.userProfiles[userAddress]) {
        // Find the latest interaction for this user
        const userInteractions = advertisement.userProfiles[userAddress].interactions;
        if (userInteractions && userInteractions.length > 0) {
          // Sort by ID (descending) and get the latest
          chatInteractionId = userInteractions.sort((a, b) => b.id - a.id)[0].id;
        }
      }
      
      if (chatInteractionId !== undefined) {
        console.log(`Initializing chat for advertisement ${advertisement.id}, interaction ${chatInteractionId}`);
        setCurrentChat(advertisement.id, chatInteractionId);
      } else {
        console.warn('No valid interaction ID found for chat initialization');
      }
    }
  }, [advertisement, userAddress, interactionId, setCurrentChat]);
  
  // Local state for UI
  const [isSending, setIsSending] = useState(false);
  const [decryptedFileUrls, setDecryptedFileUrls] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Keep track of previous message count to determine if we should scroll
  const prevMessageCountRef = useRef(0);
  
  // Scroll to bottom of messages
  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current) {
      // Get the parent container with overflow: auto
      const messageContainer = messagesEndRef.current.parentElement;
      if (messageContainer) {
        // Only use smooth scrolling for new messages, not for initial load
        const behavior = force ? 'auto' : 'smooth';
        // Scroll the container instead of using scrollIntoView
        messageContainer.scrollTo({
          top: messageContainer.scrollHeight,
          behavior
        });
      }
    }
  };

  // Scroll to bottom when messages change, but only if:
  // 1. We're at the bottom already, or
  // 2. New messages were added (not just updated)
  useEffect(() => {
    const messageContainer = messagesEndRef.current?.parentElement;
    if (!messageContainer) return;
    
    const isAtBottom = 
      messageContainer.scrollHeight - messageContainer.scrollTop <= 
      messageContainer.clientHeight + 50; // 50px tolerance
    
    const messageCountIncreased = messages.length > prevMessageCountRef.current;
    
    // Update the previous count
    prevMessageCountRef.current = messages.length;
    
    // Scroll if we're at the bottom or if new messages were added
    if (isAtBottom || messageCountIncreased) {
      // Use force=true for initial load to avoid animation
      scrollToBottom(messages.length <= 3);
    }
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      return;
    }
    
    setIsSending(true);
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (err: any) {
      console.error("Failed to send message:", err);
      
      // Display a more user-friendly error message
      if (err.message && err.message.includes('ephemeral key')) {
        setLocalError("Unable to encrypt message. Please try refreshing the page to restore the encryption key.");
      } else {
        setLocalError("Failed to send message. Please try again later.");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
    
    // Use sendFileMessage from context
    sendFileMessage(file);
  };

  // Render message bubble
  const renderMessage = (chatMessage: any) => {
    // Using currentAccount from component level, not from within function
    
    // Convert ChatMessage to Message format for rendering
    const message: Message = {
      id: chatMessage.id,
      sender: chatMessage.sender,
      timestamp: chatMessage.timestamp,
      content: chatMessage.text || '[No content]',
      type: chatMessage.type || (chatMessage.messageBlobId ? 'image' : 'text'),
      status: chatMessage.status || 'read',
      imageUrl: chatMessage.imageUrl,
      fileUrl: chatMessage.fileUrl,
      fileMetadata: chatMessage.fileMetadata
    };
    
    const isCurrentUser = message.sender === currentAccount?.address;
    
    return (
      <div
        key={message.id}
        className="design-flex design-flex-col design-gap-1"
        style={{
          alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '70%',
          marginBottom: 'var(--space-3)'
        }}
      >
        {!isCurrentUser && (
          <span style={{ 
            marginLeft: 'var(--space-2)', 
            color: 'var(--gray-10)',
            fontWeight: 500,
            fontSize: '12px'
          }}>
            {message.sender.slice(0, 6)}...{message.sender.slice(-4)}
          </span>
        )}
        
        <div
          style={{
            backgroundColor: isCurrentUser ? 'var(--accent-9)' : 'var(--gray-4)',
            color: isCurrentUser ? 'white' : 'var(--gray-12)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            wordBreak: 'break-word',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)',
            position: 'relative'
          }}
        >
          {message.type === 'text' ? (
            <p style={{ lineHeight: 1.4, margin: 0 }}>{message.content}</p>
          ) : message.type === 'image' && (message.status === 'sending' || message.content.includes('Uploading')) ? (
            // Uploading animation for images
            <div className="design-loading" style={{ padding: 'var(--space-3)', width: '100%' }}>
              <p style={{ fontWeight: 500, fontSize: '14px', margin: 0 }}>
                {message.content}
              </p>
              <div style={{ 
                marginTop: 'var(--space-2)',
                display: 'flex',
                gap: 'var(--space-1)',
                alignItems: 'center'
              }}>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
              </div>
            </div>
          ) : message.type === 'image' ? (
            <div style={{ position: 'relative' }}>
              <img 
                src={message.imageUrl || message.content} 
                alt="Shared image" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '200px', 
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', 
                  objectFit: 'contain',
                  transition: 'transform var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onClick={() => {
                  // Open image in dialog
                  setDecryptedFileUrls([message.imageUrl || message.content]);
                  setIsDialogOpen(true);
                }}
              />
            </div>
          ) : message.type === 'file' && message.status === 'sending' ? (
            // Uploading animation for files
            <div className="design-loading" style={{ padding: 'var(--space-3)', width: '100%' }}>
              <p style={{ fontWeight: 500, fontSize: '14px', margin: 0 }}>
                {message.content}
              </p>
              <div style={{ 
                marginTop: 'var(--space-2)',
                display: 'flex',
                gap: 'var(--space-1)',
                alignItems: 'center'
              }}>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
                <div className="design-skeleton" style={{ width: '4px', height: '4px', borderRadius: '50%' }}></div>
              </div>
            </div>
          ) : message.type === 'file' && message.fileUrl ? (
            <div className="design-flex design-flex-col design-gap-2">
              <p style={{ margin: 0 }}>{message.content}</p>
              <a 
                href={message.fileUrl} 
                download={message.fileMetadata?.filename}
                className="design-button design-button-secondary"
                style={{ 
                  textDecoration: 'none',
                  fontSize: '12px',
                  padding: 'var(--space-1) var(--space-2)',
                  alignSelf: 'flex-start'
                }}
              >
                Download File
              </a>
            </div>
          ) : (
            <p style={{ lineHeight: 1.4, margin: 0 }}>{message.content}</p>
          )}
        </div>
        
        <div className="design-flex design-gap-1" style={{ 
          justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          marginTop: 'var(--space-1)'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--gray-9)' }}>
            {formatTime(message.timestamp)}
          </span>
          
          {isCurrentUser && (
            <div style={{ color: 'var(--gray-9)' }}>
              {message.status === 'sending' ? (
                <span style={{ fontSize: '10px' }}>Sending...</span>
              ) : message.status === 'sent' ? (
                <CheckCircle size={10} />
              ) : message.status === 'delivered' ? (
                <CheckCircle size={10} />
              ) : (
                <CheckCircle size={10} style={{ color: 'var(--accent-9)' }} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="design-card" style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* Messages area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: 'var(--space-4)', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: 'var(--gray-1)'
      }}>
        {/* Always render messages if we have them, even during loading */}
        {messages.length === 0 ? (
          <div className="design-empty-state">
            <div className="design-empty-state-icon">
              <History size={48} />
            </div>
            <h4 className="design-heading-4" style={{ marginBottom: 'var(--space-2)' }}>
              {isLoading ? 'Loading Messages' : 'No Messages Yet'}
            </h4>
            <p style={{ fontSize: '14px', color: 'var(--gray-10)' }}>
              {isLoading ? 'Decrypting your conversation...' : 'Start the conversation by sending a message'}
            </p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        
        {/* Loading overlay - only show when we have messages */}
        {isLoading && messages.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'var(--space-2)',
            right: 'var(--space-2)',
            background: 'var(--gray-4)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            opacity: 0.9,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span style={{ fontSize: '12px' }}>Refreshing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="design-flex design-gap-3" style={{ 
        borderTop: '1px solid var(--gray-6)', 
        padding: 'var(--space-4)',
        backgroundColor: 'var(--gray-2)',
        alignItems: 'flex-end'
      }}>
        <button 
          className="design-button design-button-ghost design-focus-visible"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          style={{
            padding: 'var(--space-2)',
            minWidth: 'auto',
            height: '40px',
            width: '40px'
          }}
        >
          <Paperclip size={18} />
        </button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload}
          accept="*/*" // Accept all file types
        />
        
        <div style={{ flex: 1 }}>
          <input 
            className="design-input design-focus-visible"
            placeholder="Type a message..." 
            value={newMessage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isSending}
            style={{ 
              minHeight: '40px',
              resize: 'none'
            }}
          />
        </div>
        
        <button 
          className={`design-button design-button-primary design-focus-visible ${isSending ? 'design-loading' : ''}`}
          onClick={handleSendMessage}
          disabled={isSending || !newMessage.trim()}
          style={{
            minWidth: 'auto',
            height: '40px',
            width: '40px',
            padding: 'var(--space-2)'
          }}
        >
          <Send size={18} />
        </button>
      </div>
      
      {/* Image preview dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Content className="design-modal-content" style={{ maxWidth: '80vw', maxHeight: '80vh' }}>
          <Dialog.Title>Image Preview</Dialog.Title>
          
          <div className="design-flex design-flex-col design-gap-4">
            {decryptedFileUrls.map((url, index) => (
              <img 
                key={index} 
                src={url} 
                alt={`Preview ${index + 1}`} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '60vh',
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'contain'
                }}
              />
            ))}
          </div>
          
          <div className="design-flex design-flex-end design-gap-3" style={{ marginTop: 'var(--space-4)' }}>
            <Dialog.Close>
              <button className="design-button design-button-secondary">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Root>
      
      {/* Error dialog */}
      <Dialog.Root open={!!localError || !!error} onOpenChange={() => setLocalError(null)}>
        <Dialog.Content className="design-modal-content">
          <Dialog.Title className="design-flex design-gap-2" style={{ alignItems: 'center' }}>
            <AlertCircle size={20} color="var(--red-9)" />
            Error
          </Dialog.Title>
          <p style={{ marginTop: 'var(--space-2)' }}>{localError || error}</p>
          <div className="design-flex design-flex-end design-gap-3" style={{ marginTop: 'var(--space-4)' }}>
            <Dialog.Close>
              <button 
                className="design-button design-button-secondary"
                onClick={() => setLocalError(null)}
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
};

// Wrapper component that provides the context
export const ChatWrapper: React.FC<ChatWrapperProps> = (props) => {
  return (
    <ChatProvider {...props}>
      <ChatUI {...props} />
    </ChatProvider>
  );
};
