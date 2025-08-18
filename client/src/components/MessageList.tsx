import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  sender_username?: string;
  recipient_username?: string;
  created_at: number;
}

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  loading?: boolean;
}

export function MessageList({ messages, currentUserId, loading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-slate-300/30 border-t-slate-400 rounded-full animate-spin"></div>
          <span className="text-slate-500">Loading messages...</span>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <div className="w-8 h-8 bg-slate-300 rounded opacity-50"></div>
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-2">No messages yet</h3>
        <p className="text-slate-500 text-sm">Start a conversation by sending your first message</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(message => {
        const isOwn = message.sender_id === currentUserId;

        return (
          <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-sm ${isOwn ? 'ml-12' : 'mr-12'}`}>
              <div
                className={`px-4 py-3 rounded-xl ${
                  isOwn
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                }`}
              >
                <div className="text-sm leading-relaxed">{message.content}</div>
                <div className={`text-xs mt-2 ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>

              {!isOwn && message.sender_username && (
                <div className="text-xs text-slate-400 mt-1 ml-2">
                  From: @
                  {message.sender_username.length > 15
                    ? message.sender_username.slice(0, 15) + '...'
                    : message.sender_username}
                </div>
              )}

              {isOwn && message.recipient_username && (
                <div className="text-xs text-slate-400 mt-1 mr-2 text-right">
                  To: @
                  {message.recipient_username.length > 15
                    ? message.recipient_username.slice(0, 15) + '...'
                    : message.recipient_username}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
