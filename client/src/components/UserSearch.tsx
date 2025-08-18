import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useOnlineStore } from '../store/online';

interface User {
  id: string;
  username: string;
  email: string;
}

interface UserSearchProps {
  onUserSelect: (user: { id: string; username: string }) => void;
}

export function UserSearch({ onUserSelect }: UserSearchProps) {
  const { token } = useAuthStore();
  const { isUserOnline } = useOnlineStore();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const fetchUsers = async (searchQuery: string = '', currentOffset: number = 0, append: boolean = false) => {
    if (!token) return;
    
    const isSearch = searchQuery.trim().length > 0;
    setIsLoading(!append);
    setIsLoadingMore(append);
    
    try {
      const params = new URLSearchParams({
        limit: '5',
        offset: currentOffset.toString(),
      });
      
      if (isSearch) {
        params.append('q', searchQuery);
      }
      
      const response = await fetch(`http://localhost:8080/api/auth/users/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        const newUsers = data.data.users || [];
        setUsers(prev => append ? [...prev, ...newUsers] : newUsers);
        setHasMore(newUsers.length === 5); // If we got less than 5, no more to load
        setOffset(append ? currentOffset + 5 : 5);
      } else {
        setUsers(append ? users : []);
        setHasMore(false);
      }
      setHasSearched(true);
      setIsSearchMode(isSearch);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers(append ? users : []);
      setHasMore(false);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchUsers(query.trim(), 0, false);
  };

  const handleLoadMore = () => {
    if (isSearchMode) {
      fetchUsers(query, offset, true);
    } else {
      fetchUsers('', offset, true);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setOffset(0);
    setIsSearchMode(false);
    fetchUsers('', 0, false);
  };

  // Load initial random users on mount
  useEffect(() => {
    fetchUsers('', 0, false);
  }, [token]);

  const handleUserClick = (user: User) => {
    onUserSelect({ id: user.id, username: user.username });
  };

  return (
    <div className="h-full">
      <div className="p-3 border-b border-gray-200">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : '→'}
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 text-sm">Searching...</div>
          </div>
        )}

        {!isLoading && hasSearched && users.length === 0 && (
          <div className="text-center py-8 px-4">
            <div className="text-sm text-gray-500">No users found for "{query}"</div>
          </div>
        )}

        {!isLoading && users.length > 0 && (
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="text-xs text-gray-500">
                {isSearchMode ? `${users.length} user${users.length !== 1 ? 's' : ''} found` : `${users.length} users`}
              </div>
              {isSearchMode && (
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {users.map((user) => {
                const isOnline = isUserOnline(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleUserClick(user)}
                    className="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
                  >
                    <div className="relative mr-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      {isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm truncate">@{user.username}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="mt-3 px-2">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-2 text-sm text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}

        {!hasSearched && (
          <div className="text-center py-8 px-4">
            <div className="text-sm text-gray-500">Loading users...</div>
          </div>
        )}
      </div>
    </div>
  );
}