import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useBets } from "@/contexts/BetContext";
import { isBetTrackingIntent, extractBetData, isValidBetData } from "@/utils/betUtils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const TRACKING_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tracking-chat`;

const initialMessages: Message[] = [{
  id: "welcome-1",
  role: "assistant",
  content: "👋 Welcome to Live Tracking Chat!\n\nI can help you:\n• Check on your active bets\n• Get live game updates\n• Analyze bet performance\n• Track scores in real-time\n\nAsk me anything about your bets!",
  timestamp: "Just now"
}];

export function LiveTrackingChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addBet } = useBets();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim() || isTyping || !user) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const assistantMessageId = `assistant-${Date.now()}`;
    setStreamingMessageId(assistantMessageId);

    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const authHeader = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(TRACKING_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authHeader}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.token) {
                  accumulatedContent += parsed.token;

                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }

      // Check if this is a bet tracking message and add to tracker
      if (isBetTrackingIntent(userMessage.content)) {
        const betData = extractBetData(userMessage.content, accumulatedContent);

        if (isValidBetData(betData)) {
          addBet(betData);
          console.log('✅ Bet tracked from LiveTrackingChat:', betData);

          toast({
            title: "Bet Tracked",
            description: betData.displayDescription || "Your bet has been added to the tracker",
          });
        } else {
          console.log('⚠️ Bet tracking detected but data insufficient:', betData);
        }
      }

    } catch (error) {
      console.error('Error in tracking chat:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });

      // Remove the failed assistant message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsTyping(false);
      setStreamingMessageId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[400px] text-center p-6">
        <p className="text-sm text-muted-foreground">
          Please sign in to use Live Tracking Chat
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border border-border rounded-lg bg-background">
      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              isStreaming={msg.id === streamingMessageId}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border p-3 bg-muted/30">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your bets..."
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            disabled={isTyping}
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            className={cn(
              "flex-shrink-0 h-11 w-11",
              input.trim() && !isTyping ? "bg-primary" : "bg-muted text-muted-foreground"
            )}
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
