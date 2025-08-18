import { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { grpcClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';
import { useOnlineStore } from '../store/online';
import { useTypingStatus } from '../hooks/useTypingStatus';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  sender_username?: string;
  recipient_username?: string;
  created_at: number;
}

interface MessageComposerProps {
  selectedUser: User;
  onSendMessage: (content: string) => void;
  onBack?: () => void;
  loading?: boolean;
}

export function MessageComposer({
  selectedUser,
  onSendMessage,
  onBack,
  loading,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const { user, token } = useAuthStore();
  const { isUserOnline } = useOnlineStore();

  // Get online status from global store
  const otherUserOnline = isUserOnline(selectedUser.id);

  // Get typing status for the selected user
  const otherUserTyping = useTypingStatus(selectedUser.id);

  console.log(
    'MessageComposer render - otherUserTyping:',
    otherUserTyping,
    'selectedUser:',
    selectedUser.id
  );

  // Handle typing notifications
  const sendTypingNotification = async (recipientId: string, typing: boolean) => {
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
          isTyping: typing,
        }),
      });
    } catch (_error) {
      console.error('Failed to send typing notification:', error);
    }
  };

  useEffect(() => {
    loadConversation();
  }, [selectedUser.id]);

  // Listen for new messages in this conversation
  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const { senderId, message } = event.detail;
      // Only add message if it's from/to the current conversation
      if (senderId === selectedUser.id || message.recipient_id === selectedUser.id) {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [
            ...prev,
            {
              ...message,
              created_at: new Date(message.created_at).getTime(),
            },
          ];
        });
      }
    };

    window.addEventListener('new-message' as any, handleNewMessage as any);
    return () => {
      window.removeEventListener('new-message' as any, handleNewMessage as any);
    };
  }, [selectedUser.id]);

  const loadConversation = async () => {
    if (!token) return;

    setLoadingMessages(true);
    try {
      // Use the conversation-specific endpoint instead of loading all messages
      const response = await grpcClient.getConversationMessages(token, selectedUser.id, 50);
      setMessages(response.messages || []);
    } catch (_error) {
      console.error('Failed to load conversation:', _error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Handle typing indicators - simple: text in input = typing
  useEffect(() => {
    const hasText = message.trim().length > 0;

    if (hasText && !isTyping) {
      // Start typing
      setIsTyping(true);
      sendTypingNotification(selectedUser.id, true);
    } else if (!hasText && isTyping) {
      // Stop typing
      setIsTyping(false);
      sendTypingNotification(selectedUser.id, false);
    }
  }, [message, isTyping, selectedUser.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && selectedUser && token) {
      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        sendTypingNotification(selectedUser.id, false);
      }

      try {
        // Actually send the message via API
        const response = await grpcClient.sendMessage({
          content: message.trim(),
          recipient_id: selectedUser.id
        }, token);

        if (response.success) {
          setMessage('');
          // Call the callback to notify parent component
          onSendMessage(message.trim());
          // Reload conversation to show the new message
          await loadConversation();
        } else {
          console.error('Failed to send message:', response.error);
        }
      } catch (_error) {
        console.error('Failed to send message:', _error);
      }
    }
  };

  return (
    <div className="messaging-card flex flex-col h-[600px]">
      {/* Header - WhatsApp style */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-slate-600 hover:text-slate-800 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <div className="relative">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="font-medium text-blue-700">
                {selectedUser.username[0].toUpperCase()}
              </span>
            </div>
            {otherUserOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-800">@{selectedUser.username}</div>
            <div className="text-sm text-slate-500">
              {(() => {
                console.log(
                  'Rendering status - otherUserTyping:',
                  otherUserTyping,
                  'otherUserOnline:',
                  otherUserOnline
                );
                if (otherUserTyping) {
                  return (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-2 py-1 rounded">
                      <div className="flex space-x-1">
                        <div className="w-3 h-3 bg-green-600 rounded-full animate-bounce"></div>
                        <div
                          className="w-3 h-3 bg-green-600 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-3 h-3 bg-green-600 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                      <span className="font-medium">typing...</span>
                    </div>
                  );
                } else if (otherUserOnline) {
                  return 'Online';
                } else {
                  return 'Offline';
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} currentUserId={user?.id} loading={loadingMessages} />
      </div>

      {/* Input area - WhatsApp style */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Message @${selectedUser.username}`}
              className="w-full messaging-input"
              required
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim() || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
