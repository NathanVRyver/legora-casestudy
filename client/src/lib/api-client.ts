interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
  error?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: number;
}

class ApiClient {
  private baseUrl = 'http://localhost:8080';

  async validateToken(token: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          user: data.data.user,
          token: data.data.token,
        };
      }
      return data;
    } catch (_error) {
      return { success: false, error: 'Network error' };
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          user: data.data.user,
          token: data.data.token,
        };
      }
      return data;
    } catch (_error) {
      return { success: false, error: 'Network error' };
    }
  }

  async sendMessage(messageData: { content: string; recipient_id: string }, token?: string): Promise<any> {
    if (!token) {
      return { success: false, error: 'Authentication token required' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
      });
      const data = await response.json();

      if (data.success && data.data) {
        return { success: true, data: data.data };
      }
      return data;
    } catch (_error) {
      return { success: false, error: 'Network error' };
    }
  }

  async searchUsers(
    token: string,
    query?: string,
    limit = 5,
    offset = 0
  ): Promise<{
    users: Array<{ id: string; username: string; email: string }>;
    hasMore: boolean;
  }> {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      const response = await fetch(`${this.baseUrl}/api/auth/users/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.data) {
        return {
          users: data.data.users,
          hasMore: data.data.hasMore,
        };
      }
      return { users: [], hasMore: false };
    } catch (_error) {
      return { users: [], hasMore: false };
    }
  }

  async getMessages(token: string): Promise<{ messages: Message[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.data) {
        return { messages: data.data.messages };
      }
      return { messages: [] };
    } catch (_error) {
      return { messages: [] };
    }
  }

  async getConversationMessages(token: string, userId: string, limit: number = 50, cursor?: string): Promise<{ messages: Message[] }> {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (cursor) params.append('cursor', cursor);

      const response = await fetch(`${this.baseUrl}/api/messages/conversation/${userId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success && data.data) {
        return { messages: data.data.messages };
      }
      return { messages: [] };
    } catch (_error) {
      return { messages: [] };
    }
  }
}

export const grpcClient = new ApiClient();
