import { create } from 'zustand';

interface OnlineStore {
  onlineUsers: Set<string>;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  isUserOnline: (userId: string) => boolean;
  setOnlineUsers: (userIds: string[]) => void;
  clearOnlineUsers: () => void;
}

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  onlineUsers: new Set(),

  setUserOnline: (userId: string) => {
    set(state => {
      const newSet = new Set(state.onlineUsers);
      newSet.add(userId);
      return { onlineUsers: newSet };
    });
  },

  setUserOffline: (userId: string) => {
    set(state => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  isUserOnline: (userId: string) => {
    return get().onlineUsers.has(userId);
  },

  setOnlineUsers: (userIds: string[]) => {
    set({ onlineUsers: new Set(userIds) });
  },

  clearOnlineUsers: () => {
    set({ onlineUsers: new Set() });
  },
}));
