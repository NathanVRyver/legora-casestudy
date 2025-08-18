import { useEffect } from 'react';
import { useRealTimeMessaging } from '../hooks/useRealTimeMessaging';
import { useOnlineStore } from '../store/online';
import { useMessagesStore } from '../store/messages';
import { useAuthStore } from '../store/auth';

let _isProviderMounted = false;

export function RealTimeProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  const { setUserOnline, setUserOffline, setOnlineUsers } = useOnlineStore();
  const { addMessage } = useMessagesStore();

  useEffect(() => {
    _isProviderMounted = true;
    return () => {
      _isProviderMounted = false;
    };
  }, []);

  // Initialize real-time connection
  const { isConnected } = useRealTimeMessaging({
    onTyping: (senderId, isTyping) => {
      console.log('Dispatching typing event:', { senderId, isTyping });
      // Dispatch typing event for components to listen to
      window.dispatchEvent(
        new CustomEvent('user-typing', {
          detail: { senderId, isTyping },
        })
      );
    },
    onNewMessage: (senderId, message) => {
      // Add to global messages store
      addMessage({
        ...message,
        created_at: new Date(message.created_at).getTime(),
      });

      // Dispatch event for components to listen to
      window.dispatchEvent(
        new CustomEvent('new-message', {
          detail: { senderId, message },
        })
      );

      // Show browser notification if page is not focused
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`New message from @${message.sender_username || 'Unknown'}`, {
          body: message.content,
          icon: '/favicon.ico',
        });
      }
    },
    onUserStatusChange: (userId, isOnline) => {
      if (isOnline) {
        setUserOnline(userId);
      } else {
        setUserOffline(userId);
      }
    },
    onConnected: () => {
      console.log('Real-time connection established');
      // Fetch initial online users
      if (token) {
        fetch('http://localhost:8080/api/sse/online', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              setOnlineUsers(data.data.onlineUsers);
            }
          })
          .catch(console.error);
      }
    },
  });

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for online users updates
  useEffect(() => {
    const handleOnlineUsersUpdate = (event: CustomEvent) => {
      const { users } = event.detail;
      console.log('Updating online users:', users);
      setOnlineUsers(users);
    };

    window.addEventListener('online-users-update' as any, handleOnlineUsersUpdate as any);
    return () => {
      window.removeEventListener('online-users-update' as any, handleOnlineUsersUpdate as any);
    };
  }, [setOnlineUsers]);

  // Show connection status in console
  useEffect(() => {
    if (isConnected) {
      console.log('Real-time messaging: Connected');
    } else if (user && token) {
      console.log('Real-time messaging: Connecting...');
    }
  }, [isConnected, user, token]);

  return <>{children}</>;
}
