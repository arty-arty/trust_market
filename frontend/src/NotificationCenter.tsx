import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Button, Card, Flex, Text, Badge, Box, IconButton } from '@radix-ui/themes';
import { Bell, X, MessageCircle, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Notification type
export type NotificationType = 'message' | 'transaction' | 'dispute' | 'review' | 'system';

// Notification interface
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
  advertisementId?: string;
}

// Mock data for notifications (will be replaced with real data)
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'message',
    title: 'New Message',
    message: 'You have a new message from 0x7890...3456',
    timestamp: Date.now() - 3600000 * 2,
    read: false,
    link: '/marketplace/advertisement/0x123456789abcdef1',
    advertisementId: '0x123456789abcdef1'
  },
  {
    id: '2',
    type: 'transaction',
    title: 'Transaction Completed',
    message: 'Your transaction for "Sell 500 USDT for cash" has been completed',
    timestamp: Date.now() - 3600000 * 5,
    read: false,
    link: '/marketplace/advertisement/0x123456789abcdef2',
    advertisementId: '0x123456789abcdef2'
  },
  {
    id: '3',
    type: 'dispute',
    title: 'Dispute Resolved',
    message: 'The dispute for "Buy 750 USDT" has been resolved in your favor',
    timestamp: Date.now() - 3600000 * 24,
    read: true,
    link: '/marketplace/advertisement/0x123456789abcdef3',
    advertisementId: '0x123456789abcdef3'
  },
  {
    id: '4',
    type: 'review',
    title: 'New Review',
    message: 'You received a 5-star review from 0x7890...3459',
    timestamp: Date.now() - 3600000 * 48,
    read: true,
    link: '/marketplace/profile/0x123',
  },
  {
    id: '5',
    type: 'system',
    title: 'Welcome to P2P Marketplace',
    message: 'Get started by creating your first advertisement or browsing existing ones',
    timestamp: Date.now() - 3600000 * 72,
    read: true,
    link: '/marketplace',
  }
];

// NotificationCenter props
interface NotificationCenterProps {
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({ onNotificationClick }: NotificationCenterProps) {
  const currentAccount = useCurrentAccount();
  
  // State for notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Load notifications
  useEffect(() => {
    // In a real implementation, we would fetch notifications from a backend or blockchain
    // For now, we'll use mock data
    setNotifications(mockNotifications);
    
    // Set up polling to check for new notifications
    const intervalId = setInterval(() => {
      // In a real implementation, we would fetch new notifications
      // For now, we'll just simulate a new notification every 30 seconds
      if (Math.random() > 0.7) {
        const newNotification: Notification = {
          id: Date.now().toString(),
          type: 'message',
          title: 'New Message',
          message: `You have a new message from 0x${Math.floor(Math.random() * 10000).toString(16)}...`,
          timestamp: Date.now(),
          read: false,
          link: '/marketplace/advertisement/0x123456789abcdef1',
          advertisementId: '0x123456789abcdef1'
        };
        setNotifications(prev => [newNotification, ...prev]);
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [currentAccount]);
  
  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };
  
  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };
  
  // Remove notification
  const removeNotification = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };
  
  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    setIsOpen(false);
  };
  
  // Format time
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return `${Math.floor(diff / 86400000)}d ago`;
    }
  };
  
  // Get notification icon
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'message':
        return <MessageCircle size={16} />;
      case 'transaction':
        return <DollarSign size={16} />;
      case 'dispute':
        return <AlertCircle size={16} />;
      case 'review':
        return <CheckCircle size={16} />;
      case 'system':
        return <Bell size={16} />;
      default:
        return <Bell size={16} />;
    }
  };
  
  // Get notification color
  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'message':
        return 'var(--blue-9)';
      case 'transaction':
        return 'var(--green-9)';
      case 'dispute':
        return 'var(--red-9)';
      case 'review':
        return 'var(--amber-9)';
      case 'system':
        return 'var(--gray-9)';
      default:
        return 'var(--gray-9)';
    }
  };
  
  // Count unread notifications
  const unreadCount = notifications.filter(notification => !notification.read).length;
  
  return (
    <Box style={{ position: 'relative' }}>
      <Button 
        variant="ghost" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <Badge
            color="red"
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              borderRadius: '50%',
              padding: '2px 6px',
              fontSize: '10px'
            }}
          >
            {unreadCount}
          </Badge>
        )}
      </Button>
      
      {isOpen && (
        <Card style={{ 
          position: 'absolute', 
          top: '40px', 
          right: '0', 
          width: '350px', 
          maxHeight: '500px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center">
              <Text weight="bold">Notifications</Text>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="1"
                  onClick={markAllAsRead}
                >
                  Mark all as read
                </Button>
              )}
            </Flex>
            
            {notifications.length === 0 ? (
              <Text size="2" color="gray" style={{ padding: '16px 0', textAlign: 'center' }}>
                No notifications
              </Text>
            ) : (
              <Box style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                padding: '4px 0'
              }}>
                {notifications.map((notification) => (
                  <Link 
                    key={notification.id} 
                    to={notification.link || '#'}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <Box style={{ 
                      padding: '8px', 
                      borderRadius: '4px',
                      backgroundColor: notification.read ? 'transparent' : 'var(--accent-2)',
                      marginBottom: '4px',
                      position: 'relative'
                    }}>
                      <Flex gap="2" align="start">
                        <Box style={{ 
                          color: getNotificationColor(notification.type),
                          marginTop: '2px'
                        }}>
                          {getNotificationIcon(notification.type)}
                        </Box>
                        <Box style={{ flex: 1 }}>
                          <Flex justify="between" align="start">
                            <Text weight="bold" size="2">{notification.title}</Text>
                            <Text size="1" color="gray">{formatTime(notification.timestamp)}</Text>
                          </Flex>
                          <Text size="2">{notification.message}</Text>
                        </Box>
                        <IconButton 
                          variant="ghost" 
                          size="1"
                          onClick={(e) => removeNotification(notification.id, e)}
                          style={{ marginLeft: 'auto' }}
                        >
                          <X size={14} />
                        </IconButton>
                      </Flex>
                    </Box>
                  </Link>
                ))}
              </Box>
            )}
          </Flex>
        </Card>
      )}
    </Box>
  );
}
