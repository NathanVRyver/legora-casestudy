import { useState } from 'react';
import { MessageComposer } from '../components/MessageComposer';
import { UserSearch } from '../components/UserSearch';
import { useAuthStore } from '../store/auth';

interface User {
  id: string;
  username: string;
  email: string;
}

export function MessagesPage() {
  const { user } = useAuthStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleUserSelect = (selectedUser: User) => {
    setSelectedUser(selectedUser);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedUser || !user) {
      console.error('Cannot send message: no selected user or not authenticated');
      return;
    }
    
    // The MessageComposer handles the actual sending internally
    // This is just a placeholder callback
    console.log('Sending message:', content, 'to:', selectedUser.username);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Not Authenticated</h2>
          <p className="text-gray-600">Please log in to access messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Messages</h2>
          <p className="text-sm text-gray-600">Welcome, {user.username}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <UserSearch onUserSelect={handleUserSelect} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <MessageComposer 
            selectedUser={selectedUser}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a user from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}