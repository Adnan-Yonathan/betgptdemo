import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey! I'm BetGPT 👋\n\nI'm an AI that helps you become a better bettor by learning from your bets and patterns.\n\nThink of me like ChatGPT, but I remember all your bets and give you personalized advice.\n\nTo get started, just tell me about a bet you placed recently. You can type it, say it out loud, or show me a screenshot.\n\nTry something like: \"I bet the Lakers -5 yesterday for $100\"",
    timestamp: "Just now",
  },
];

const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes("lakers") || lowerMessage.includes("chiefs") || lowerMessage.includes("bet")) {
    return "Interesting! Let me think about this...\n\nLooking at what I know about your betting:\n- This looks like a solid play\n- Your timing seems good\n\nWhat's making you like this bet? Is it a gut feeling or did you see something specific?";
  }

  if (lowerMessage.includes("won") || lowerMessage.includes("win")) {
    return "Nice hit! 🎉\n\nQuick question - are you feeling pretty confident right now? Like maybe you want to bet another game tonight?\n\nJust checking in because I want to make sure we're making smart decisions, not emotional ones.";
  }

  if (lowerMessage.includes("lost") || lowerMessage.includes("loss")) {
    return "Ugh, that sucks. I'm sorry.\n\nHow are you feeling right now? Frustrated? Angry? Want to win it back?\n\nRemember - one loss doesn't define you. Let's talk through this before making any moves.";
  }

  if (lowerMessage.includes("how am i") || lowerMessage.includes("performance") || lowerMessage.includes("stats")) {
    return "Let me check...\n\n📊 Your Performance:\n- 18-12 record (60% win rate)\n- Up $840 this month\n- +9.8% ROI\n\nYou're having a really solid month! Your best stretch of the year actually.\n\nWant to know what you're doing right? Or should I tell you where you're still leaking money?";
  }

  return "I hear you! Let me help you think through this.\n\nBased on what you've told me, I want to make sure we're making smart decisions here. What's your reasoning behind this bet?";
};

const Index = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(content),
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar />
      
      <main className="flex-1 flex flex-col">
        {/* Chat Header */}
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">BetGPT Chat</h2>
          <p className="text-sm text-muted-foreground">Your AI betting coach</p>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  What's on the agenda today?
                </h3>
                <p className="text-muted-foreground">
                  Start a conversation about your bets
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} {...message} />
                ))}
                {isTyping && (
                  <div className="flex gap-4 mb-6">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-foreground">B</span>
                    </div>
                    <div className="flex-1 max-w-3xl">
                      <div className="rounded-2xl px-4 py-3 bg-chat-ai">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </main>
    </div>
  );
};

export default Index;
