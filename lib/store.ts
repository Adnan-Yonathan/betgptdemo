import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message, UISettings } from './types';
import { generateId, truncate } from './utils';

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  uiSettings: UISettings;
  sidebarOpen: boolean;

  // Conversation actions
  newConversation: () => string;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'ts'>) => void;
  updateLastMessage: (conversationId: string, content: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  deleteConversation: (conversationId: string) => void;
  duplicateConversation: (conversationId: string) => void;
  setActiveConversation: (conversationId: string | null) => void;

  // UI actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;

  // Helpers
  getActiveConversation: () => Conversation | null;
}

const defaultSettings: UISettings = {
  messageDensity: 'comfortable',
  bubbleCorners: 'rounded',
  persistConversations: true,
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      uiSettings: defaultSettings,
      sidebarOpen: false,

      newConversation: () => {
        const id = generateId();
        const conversation: Conversation = {
          id,
          title: 'New Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };

        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));

        return id;
      },

      addMessage: (conversationId, message) => {
        const fullMessage: Message = {
          ...message,
          id: generateId(),
          ts: Date.now(),
        };

        set((state) => {
          const conversations = state.conversations.map((conv) => {
            if (conv.id !== conversationId) return conv;

            const messages = [...conv.messages, fullMessage];
            let title = conv.title;

            // Update title from first user message
            if (title === 'New Chat' && message.role === 'user') {
              title = truncate(message.content, 40);
            }

            return {
              ...conv,
              messages,
              title,
              updatedAt: Date.now(),
            };
          });

          return { conversations };
        });
      },

      updateLastMessage: (conversationId, content) => {
        set((state) => {
          const conversations = state.conversations.map((conv) => {
            if (conv.id !== conversationId) return conv;

            const messages = [...conv.messages];
            if (messages.length > 0) {
              messages[messages.length - 1] = {
                ...messages[messages.length - 1],
                content: messages[messages.length - 1].content + content,
              };
            }

            return {
              ...conv,
              messages,
              updatedAt: Date.now(),
            };
          });

          return { conversations };
        });
      },

      renameConversation: (conversationId, title) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? { ...conv, title, updatedAt: Date.now() }
              : conv
          ),
        }));
      },

      deleteConversation: (conversationId) => {
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== conversationId);
          const activeConversationId =
            state.activeConversationId === conversationId
              ? conversations[0]?.id || null
              : state.activeConversationId;

          return { conversations, activeConversationId };
        });
      },

      duplicateConversation: (conversationId) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) return;

        const duplicate: Conversation = {
          ...conversation,
          id: generateId(),
          title: `${conversation.title} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          conversations: [duplicate, ...state.conversations],
        }));
      },

      setActiveConversation: (conversationId) => {
        set({ activeConversationId: conversationId });
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      updateUISettings: (settings) => {
        set((state) => ({
          uiSettings: { ...state.uiSettings, ...settings },
        }));
      },

      getActiveConversation: () => {
        const state = get();
        return (
          state.conversations.find((c) => c.id === state.activeConversationId) || null
        );
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        conversations: state.uiSettings.persistConversations ? state.conversations : [],
        activeConversationId: state.uiSettings.persistConversations ? state.activeConversationId : null,
        uiSettings: state.uiSettings,
      }),
    }
  )
);
