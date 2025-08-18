import { useState, useEffect, useRef } from 'react';
import { grpcClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';
import { useOnlineStore } from '../store/online';

interface User {
  id: string;
  username: string;
  email: string;
}

interface UserPickerProps {
  onSelectUser: (user: User) => void;
  selectedUser?: User;
}

export function UserPicker({ onSelectUser, selectedUser }: UserPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [randomUsers, setRandomUsers] = useState<User[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { token } = useAuthStore();
  const { isUserOnline } = useOnlineStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial users and random users on component mount
  useEffect(() => {
    loadUsers();
    loadRandomUsers();
  }, []);

  // Search users when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        loadUsers(searchQuery, true);
      }, 300); // Debounce search
      return () => clearTimeout(timeoutId);
    } else {
      loadUsers('', true);
    }
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUsers = async (query = '', reset = false) => {
    if (!token) return;

    setLoading(true);
    try {
      const offset = reset ? 0 : users.length;
      const result = await grpcClient.searchUsers(token, query, 5, offset);

      if (reset) {
        setUsers(result.users);
      } else {
        setUsers(prev => [...prev, ...result.users]);
      }
      setHasMore(result.hasMore);
    } catch (_error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    onSelectUser(user);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const loadRandomUsers = async () => {
    if (!token) return;

    try {
      const result = await grpcClient.searchUsers(token, '', 5, 0);
      setRandomUsers(result.users);
    } catch (_error) {
      console.error('Failed to load random users:', error);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadUsers(searchQuery);
    }
  };

  return (
    <div className="messaging-card p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Start a Conversation</h2>

      {selectedUser ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900">@{selectedUser.username}</div>
              <div className="text-sm text-blue-700">{selectedUser.email}</div>
            </div>
            <button
              onClick={() => onSelectUser(null!)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search users by username..."
              className="w-full messaging-input pr-10"
            />
            <div className="absolute right-3 top-1/2 transform -y-1/2 text-slate-400">
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-300/30 border-t-slate-400 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
            </div>
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
              {users.length > 0 ? (
                <>
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">@{user.username}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                        {isUserOnline(user.id) && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  ))}

                  {hasMore && (
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="w-full px-4 py-3 text-center text-blue-600 hover:bg-blue-50 font-medium disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Show More'}
                    </button>
                  )}
                </>
              ) : (
                <div className="px-4 py-6 text-center text-slate-500">
                  {searchQuery ? 'No users found' : 'Start typing to search users'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!showDropdown && !searchQuery && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Suggested Users</h3>
          <div className="grid grid-cols-1 gap-2">
            {randomUsers.map(user => (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
              >
                <div className="relative">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="font-medium text-blue-700 text-sm">
                      {user.username[0].toUpperCase()}
                    </span>
                  </div>
                  {isUserOnline(user.id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    @
                    {user.username.length > 15 ? user.username.slice(0, 15) + '...' : user.username}
                  </div>
                  <div className="text-sm text-slate-500 truncate">{user.email}</div>
                </div>
              </button>
            ))}
          </div>

          {randomUsers.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">No users available</div>
          )}
        </div>
      )}
    </div>
  );
}
