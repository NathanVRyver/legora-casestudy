import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  isInitialized: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  initializeAuth: () => void;
  setAuthFromStorage: (user: User, token: string) => void;
  setInitialized: () => void;
}

const AUTH_STORAGE_KEY = 'messaging_auth';

function saveAuthToStorage(user: User, token: string) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
  } catch (_error) {
    console.error('Failed to save auth to localStorage:', _error);
  }
}

function loadAuthFromStorage(): { user: User; token: string } | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.user && parsed.token) {
        return { user: parsed.user, token: parsed.token };
      }
    }
  } catch (_error) {
    console.error('Failed to load auth from localStorage:', _error);
  }
  return null;
}

function clearAuthFromStorage() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (_error) {
    console.error('Failed to clear auth from localStorage:', _error);
  }
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  token: null,
  isLoggedIn: false,
  isInitialized: false,

  login: (user, token) => {
    saveAuthToStorage(user, token);
    set({
      user,
      token,
      isLoggedIn: true,
      isInitialized: true,
    });
  },

  logout: () => {
    clearAuthFromStorage();
    set({
      user: null,
      token: null,
      isLoggedIn: false,
      isInitialized: true,
    });
  },

  setInitialized: () => {
    set({ isInitialized: true });
  },

  setAuthFromStorage: (user, token) => {
    set({
      user,
      token,
      isLoggedIn: true,
      isInitialized: true,
    });
  },

  initializeAuth: () => {
    const stored = loadAuthFromStorage();
    if (stored) {
      set({
        user: stored.user,
        token: stored.token,
        isLoggedIn: false,
        isInitialized: false, // Will be set to true after validation
      });
    } else {
      set({
        isInitialized: true,
        isLoggedIn: false,
      });
    }
  },
}));
