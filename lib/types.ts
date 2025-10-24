export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

export type UISettings = {
  messageDensity: 'compact' | 'comfortable' | 'spacious';
  bubbleCorners: 'rounded' | 'square';
  persistConversations: boolean;
};
