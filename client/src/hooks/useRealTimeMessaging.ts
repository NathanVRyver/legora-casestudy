import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/auth';

interface RealtimeMessage {
  type: 'new-message' | 'message-sent' | 'typing' | 'connected' | 'user-status';
  senderId?: string;
  message?: any;
  isTyping?: boolean;
  userId?: string;
  isOnline?: boolean;
  timestamp: string;
}

interface UseRealTimeMessagingOptions {
  onNewMessage?: (senderId: string, message: any) => void;
  onTyping?: (senderId: string, isTyping: boolean) => void;
  onConnected?: () => void;
  onUserStatusChange?: (userId: string, isOnline: boolean) => void;
}

export function useRealTimeMessaging({
  onNewMessage,
  onTyping,
  onConnected,
  onUserStatusChange,
}: UseRealTimeMessagingOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const { token, user } = useAuthStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false); // Synchronous flag to prevent double connections

  // Send typing notification to server
  const sendTypingNotification = useCallback(
    async (recipientId: string, isTyping: boolean) => {
      if (!token) return;

      try {
        await fetch('http://localhost:8080/api/sse/typing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientId,
            isTyping,
          }),
        });
      } catch (_error) {
        console.error('Failed to send typing notification:', _error);
      }
    },
    [token]
  );

  const connectRef = useRef<() => Promise<void>>();

  connectRef.current = async () => {
    console.log('connectRef.current called', { token: !!token, user: !!user, existing: !!eventSourceRef.current, isConnecting: isConnectingRef.current });
    if (!token || !user || eventSourceRef.current || isConnectingRef.current) {
      console.log('connectRef.current early return:', { token: !!token, user: !!user, existing: !!eventSourceRef.current, isConnecting: isConnectingRef.current });
      return;
    }
    
    // Set flag immediately to prevent race condition
    isConnectingRef.current = true;

    console.log('Creating SSE session for user:', user.id, 'timestamp:', Date.now());

    try {
      // Create a temporary SSE session token for security
      const sessionResponse = await fetch('http://localhost:8080/api/sse/session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create SSE session');
      }

      const sessionData = await sessionResponse.json();
      if (!sessionData.success || !sessionData.data?.sessionToken) {
        throw new Error('Invalid session response');
      }

      // Use session token in URL instead of main auth token
      console.log('Creating EventSource with session:', sessionData.data.sessionToken.substring(0, 10) + '...', 'timestamp:', Date.now());
      const eventSourceWithAuth = new EventSource(
        `http://localhost:8080/api/sse/events?session=${encodeURIComponent(sessionData.data.sessionToken)}`
      );

      eventSourceWithAuth.onopen = () => {
      console.log('Real-time messaging connected');
      setIsConnected(true);
      setReconnectAttempts(0);
      isConnectingRef.current = false;
    };

    eventSourceWithAuth.addEventListener('message', event => {
      console.log('Raw SSE message received:', event);
      try {
        const data: RealtimeMessage = JSON.parse(event.data);
        console.log('Parsed real-time event:', data);

        switch (data.type) {
          case 'connected':
            onConnected?.();
            break;
          case 'new-message':
            if (data.senderId && data.message) {
              onNewMessage?.(data.senderId, data.message);
              // Show browser notification if supported and page is not focused
              if (
                'Notification' in window &&
                Notification.permission === 'granted' &&
                document.hidden
              ) {
                new Notification(`New message from @${data.message.sender_username || 'Unknown'}`, {
                  body: data.message.content,
                  icon: '/favicon.ico',
                });
              }
            }
            break;
          case 'typing':
            if (data.senderId !== undefined && data.isTyping !== undefined) {
              onTyping?.(data.senderId, data.isTyping);
            }
            break;
          case 'message-sent':
            // Handle confirmation of sent message if needed
            break;
          case 'user-status':
            if (data.userId !== undefined && data.isOnline !== undefined) {
              onUserStatusChange?.(data.userId, data.isOnline);
            }
            break;
        }
      } catch (_error) {
        console.error('Failed to parse real-time message:', _error);
      }
    });

    // Also listen for specific event types
    eventSourceWithAuth.addEventListener('connected', event => {
      console.log('Connected event:', event.data);
      onConnected?.();
    });

    eventSourceWithAuth.addEventListener('online-users', event => {
      console.log('Online users event:', event.data);
      const data = JSON.parse(event.data);
      if (data.users && Array.isArray(data.users)) {
        // This will be handled by RealTimeProvider
        window.dispatchEvent(
          new CustomEvent('online-users-update', {
            detail: { users: data.users },
          })
        );
      }
    });

    eventSourceWithAuth.addEventListener('user-status', event => {
      console.log('User status event:', event.data);
      const data = JSON.parse(event.data);
      if (data.userId !== undefined && data.isOnline !== undefined) {
        onUserStatusChange?.(data.userId, data.isOnline);
      }
    });

    eventSourceWithAuth.addEventListener('new-message', event => {
      console.log('New message event:', event.data);
      const data = JSON.parse(event.data);
      if (data.senderId && data.message) {
        onNewMessage?.(data.senderId, data.message);
      }
    });

    eventSourceWithAuth.addEventListener('typing', event => {
      console.log('Typing event:', event.data);
      const data = JSON.parse(event.data);
      if (data.senderId !== undefined && data.isTyping !== undefined) {
        onTyping?.(data.senderId, data.isTyping);
      }
    });

    eventSourceWithAuth.onerror = error => {
      console.error('Real-time messaging error:', error);
      console.error('EventSource readyState:', eventSourceWithAuth.readyState);
      console.error('EventSource url:', eventSourceWithAuth.url);
      setIsConnected(false);
      isConnectingRef.current = false;
      eventSourceWithAuth.close();

      // Only reconnect if we have token and user
      if (token && user) {
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          if (token && user && connectRef.current) {
            connectRef.current().catch(console.error);
          }
        }, delay);
      }
    };

      eventSourceRef.current = eventSourceWithAuth;
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
      
      // Retry with exponential backoff
      if (token && user) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Retrying SSE connection in ${delay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          if (token && user && connectRef.current) {
            connectRef.current().catch(console.error);
          }
        }, delay);
      }
    }
  };

  const connect = useCallback(() => {
    connectRef.current?.().catch(console.error);
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('Disconnecting from real-time messaging');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setIsConnected(false);
    setReconnectAttempts(0);
    isConnectingRef.current = false;
  }, []);

  // Auto-connect when token and user are available
  useEffect(() => {
    console.log('useEffect running', { token: !!token, userId: user?.id, existing: !!eventSourceRef.current, timestamp: Date.now() });
    
    if (!token || !user) {
      console.log('No token or user, disconnecting');
      // Disconnect if we lose auth
      if (eventSourceRef.current) {
        disconnect();
      }
      return;
    }

    // Only connect if not already connected or connecting
    if (!eventSourceRef.current && !isConnectingRef.current) {
      console.log('Setting up SSE connection for user:', user.id, 'timestamp:', Date.now());
      connect();
    } else {
      console.log('Connection already exists or connecting for user:', user.id, 'existing:', !!eventSourceRef.current, 'isConnecting:', isConnectingRef.current);
    }

    // Don't disconnect on cleanup - let the connection persist
    // Only disconnect if token/user actually changes
  }, [token, user?.id]);

  // Request notification permission on first use
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  return {
    isConnected,
    reconnectAttempts,
    sendTypingNotification,
    connect,
    disconnect,
  };
}
