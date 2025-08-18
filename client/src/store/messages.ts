import { create } from 'zustand';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: number;
}

interface MessagesState {
  messages: Message[];
  loading: boolean;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
}

export const useMessagesStore = create<MessagesState>(set => ({
  messages: [],
  loading: false,

  setMessages: messages => set({ messages }),

  addMessage: message =>
    set(state => ({
      messages: [message, ...state.messages],
    })),

  setLoading: loading => set({ loading }),
}));
