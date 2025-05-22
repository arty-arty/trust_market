import React, { useRef, useState, useEffect } from 'react';
import { Card, Flex, Text, Box, TextField, Avatar, Badge, Dialog, IconButton, Button } from '@radix-ui/themes';
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
      // Only use smooth scrolling for new messages, not for initial load
      const behavior = force ? 'auto' : 'smooth';
      messagesEndRef.current.scrollIntoView({ behavior });
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
      <Box
        key={message.id}
        style={{
          alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
          maxWidth: '70%',
          marginBottom: '8px'
        }}
      >
        <Flex direction="column" gap="1">
          {!isCurrentUser && (
            <Text size="1" style={{ marginLeft: '8px' }}>
              {message.sender.slice(0, 6)}...{message.sender.slice(-4)}
            </Text>
          )}
          
          <Box
            style={{
              backgroundColor: isCurrentUser ? 'var(--blue-9)' : 'var(--gray-3)',
              color: isCurrentUser ? 'white' : 'var(--gray-12)',
              borderRadius: '12px',
              padding: '8px 12px',
              wordBreak: 'break-word'
            }}
          >
            {message.type === 'text' ? (
              <Text>{message.content}</Text>
            ) : message.type === 'image' && (message.status === 'sending' || message.content.includes('Uploading')) ? (
              // Uploading animation for images
              <Box className="telegram-upload-container" style={{ margin: '0', padding: '12px', width: '100%' }}>
                <Text weight="medium" size="2">
                  {message.content}
                </Text>
                <Box className="telegram-upload-dots" style={{ marginTop: '4px' }}>
                  <Box className="telegram-dot" />
                  <Box className="telegram-dot" />
                  <Box className="telegram-dot" />
                </Box>
                <Box className="telegram-upload-progress" style={{ marginTop: '8px' }}>
                  <Box className="telegram-progress-bar" />
                </Box>
              </Box>
            ) : message.type === 'image' ? (
              <Box style={{ position: 'relative' }}>
                <img 
                  src={message.imageUrl || message.content} 
                  alt="Shared image" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '200px', 
                    borderRadius: '8px',
                    cursor: 'pointer', 
                    objectFit: 'contain'
                  }}
                  onClick={() => {
                    // Open image in dialog
                    setDecryptedFileUrls([message.imageUrl || message.content]);
                    setIsDialogOpen(true);
                  }}
                />
              </Box>
            ) : message.type === 'file' && message.status === 'sending' ? (
              // Uploading animation for files
              <Box className="telegram-upload-container" style={{ margin: '0', padding: '12px', width: '100%' }}>
                <Text weight="medium" size="2">
                  {message.content}
                </Text>
                <Box className="telegram-upload-dots" style={{ marginTop: '4px' }}>
                  <Box className="telegram-dot" />
                  <Box className="telegram-dot" />
                  <Box className="telegram-dot" />
                </Box>
                <Box className="telegram-upload-progress" style={{ marginTop: '8px' }}>
                  <Box className="telegram-progress-bar" />
                </Box>
              </Box>
            ) : message.type === 'file' && message.fileUrl ? (
              <Flex direction="column" gap="1">
                <Text>{message.content}</Text>
                <Button size="1" variant="soft" asChild>
                  <a 
                    href={message.fileUrl} 
                    download={message.fileMetadata?.filename}
                    style={{ textDecoration: 'none' }}
                  >
                    Download File
                  </a>
                </Button>
              </Flex>
            ) : (
              <Text>{message.content}</Text>
            )}
          </Box>
          
          <Flex justify={isCurrentUser ? 'end' : 'start'} gap="1" align="center">
            <Text size="1" style={{ color: 'var(--gray-9)' }}>
              {formatTime(message.timestamp)}
            </Text>
            
            {isCurrentUser && (
              <Box style={{ color: 'var(--gray-9)' }}>
                {message.status === 'sending' ? (
                  <span style={{ fontSize: '12px' }}>Sending...</span>
                ) : message.status === 'sent' ? (
                  <CheckCircle size={12} />
                ) : message.status === 'delivered' ? (
                  <CheckCircle size={12} />
                ) : (
                  <CheckCircle size={12} style={{ color: 'var(--blue-9)' }} />
                )}
              </Box>
            )}
          </Flex>
        </Flex>
      </Box>
    );
  };

  return (
    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Messages area */}
      <Box style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative' // For loading overlay
      }}>
        {/* Always render messages if we have them, even during loading */}
        {messages.length === 0 ? (
          <Flex 
            direction="column" 
            align="center" 
            justify="center" 
            style={{ height: '100%', color: 'var(--gray-9)' }}
          >
            <History size={48} />
            <Text size="2" style={{ marginTop: '8px' }}>
              {isLoading ? 'Loading messages...' : 'No messages yet'}
            </Text>
          </Flex>
        ) : (
          messages.map(renderMessage)
        )}
        
        {/* Loading overlay - only show when we have messages */}
        {isLoading && messages.length > 0 && (
          <Box style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'var(--gray-3)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            opacity: 0.8
          }}>
            <Text size="1">Refreshing...</Text>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Input area */}
      <Flex 
        align="center" 
        gap="2" 
        style={{ 
          borderTop: '1px solid var(--gray-5)', 
          padding: '12px 16px',
          backgroundColor: 'var(--gray-1)'
        }}
      >
        <IconButton 
          variant="ghost" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
        >
          <Paperclip size={20} />
        </IconButton>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileUpload}
          accept="*/*" // Accept all file types
        />
        
        <Box style={{ flex: 1 }}>
          <input 
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
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid var(--gray-5)' 
            }}
          />
        </Box>
        
        <Button 
          variant="solid" 
          onClick={handleSendMessage}
          disabled={isSending || !newMessage.trim()}
        >
          <Send size={18} />
        </Button>
      </Flex>
      
      {/* Image preview dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Content style={{ maxWidth: '80vw' }}>
          <Dialog.Title>Walrus Decrypted Image</Dialog.Title>
          
          <Flex direction="column" gap="3">
            {decryptedFileUrls.map((url, index) => (
              <img 
                key={index} 
                src={url} 
                alt={`Preview ${index + 1}`} 
                style={{ maxWidth: '100%', borderRadius: '8px' }}
              />
            ))}
          </Flex>
          
          <Flex justify="end" gap="3" mt="4">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      
      {/* Error dialog */}
      <Dialog.Root open={!!localError || !!error} onOpenChange={() => setLocalError(null)}>
        <Dialog.Content>
          <Dialog.Title>Error</Dialog.Title>
          <Text>{localError || error}</Text>
          <Flex justify="end" gap="3" mt="4">
            <Dialog.Close>
              <Button variant="soft" onClick={() => setLocalError(null)}>
                Close
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Card>
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
