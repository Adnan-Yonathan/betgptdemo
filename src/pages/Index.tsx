import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { BankrollStats } from "@/components/BankrollStats";
import { BetHistorySidebar } from "@/components/BetHistorySidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playAudioFromBase64 } from "@/utils/voiceUtils";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const coachInitialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey! I'm BetGPT 👋\n\nI'm an AI that helps you become a better bettor by learning from your bets and patterns.\n\nThink of me like ChatGPT, but I remember all your bets and give you personalized advice.\n\nTo get started, just tell me about a bet you're considering or one you recently placed.",
    timestamp: "Just now",
  },
];

const managerInitialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey! I'm BetGPT 👋\n\nI'm your AI bankroll manager. I help you track your bets, manage your bankroll, and recommend optimal bet sizes based on proven strategies.\n\nYou can log bets by telling me:\n• The amount you wagered\n• The odds\n• The outcome (win/loss)\n• Any other details\n\nI'll track your performance and give you personalized bankroll management advice.\n\nWhat bet would you like to log?",
    timestamp: "Just now",
  },
];


const Index = () => {
  const [mode, setMode] = useState<"coach" | "manager">("coach");
  const [messages, setMessages] = useState<Message[]>(mode === "coach" ? coachInitialMessages : managerInitialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [initialBankroll, setInitialBankroll] = useState(1000);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("bankroll")
        .eq("id", user.id)
        .single();
      
      if (data?.bankroll) {
        setInitialBankroll(Number(data.bankroll));
      }
    };
    
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  const saveMessageToDb = async (conversationId: string, role: "user" | "assistant", content: string) => {
    if (!user) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role,
      content,
    });

    if (error) {
      console.error("Error saving message:", error);
    }
  };

  const playResponseAudio = async (text: string) => {
    if (!voiceEnabled || isPlayingAudio) return;

    try {
      setIsPlayingAudio(true);
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text }
      });

      if (error) throw error;

      if (data?.audioContent) {
        await playAudioFromBase64(data.audioContent);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const createOrGetConversation = async (firstMessage: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    if (currentConversationId) {
      return currentConversationId;
    }

    // Create new conversation with title from first message
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }

    setCurrentConversationId(data.id);
    return data.id;
  };

  const loadConversation = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: "No messages found",
        description: "This conversation appears to be empty",
        variant: "destructive",
      });
      return;
    }

    const initialMsgs = mode === "coach" ? coachInitialMessages : managerInitialMessages;
    const loadedMessages: Message[] = [
      ...initialMsgs, // Include welcome message
      ...data.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: "Just now",
      }))
    ];

    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
  };

  const handleNewChat = () => {
    const initialMsgs = mode === "coach" ? coachInitialMessages : managerInitialMessages;
    setMessages(initialMsgs);
    setCurrentConversationId(null);
  };

  const handleModeChange = (newMode: "coach" | "manager") => {
    setMode(newMode);
    const initialMsgs = newMode === "coach" ? coachInitialMessages : managerInitialMessages;
    setMessages(initialMsgs);
    setCurrentConversationId(null);
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setStreamingMessageId(null);

    // Save to database if user is logged in
    if (user) {
      try {
        const conversationId = await createOrGetConversation(content);
        await saveMessageToDb(conversationId, "user", content);
      } catch (error) {
        console.error("Error saving user message:", error);
      }
    }

    let assistantContent = "";
    const assistantId = (Date.now() + 1).toString();

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          messages: messages.map(m => ({ 
            role: m.role, 
            content: m.content 
          })).concat([{ role: "user", content }]),
          mode
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
        } else if (resp.status === 402) {
          toast({
            title: "Payment required",
            description: "Please add credits to your workspace.",
            variant: "destructive",
          });
        }
        throw new Error("Failed to get response");
      }

      if (!resp.body) {
        throw new Error("No response body");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              assistantContent += deltaContent;
              setStreamingMessageId(assistantId);
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  );
                }
                return [
                  ...prev,
                  {
                    id: assistantId,
                    role: "assistant",
                    content: assistantContent,
                    timestamp: "Just now",
                  },
                ];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      setIsTyping(false);
      setStreamingMessageId(null);

      // Save assistant message to database if user is logged in
      if (user && currentConversationId && assistantContent) {
        await saveMessageToDb(currentConversationId, "assistant", assistantContent);
      }

      // Play audio response if voice is enabled
      if (assistantContent) {
        await playResponseAudio(assistantContent);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);
      setStreamingMessageId(null);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {mode === "coach" ? (
        <ChatSidebar 
          currentConversationId={currentConversationId}
          onConversationSelect={loadConversation}
          onNewChat={handleNewChat}
        />
      ) : (
        <BetHistorySidebar onNewBet={handleNewChat} />
      )}
      
      <main className="flex-1 flex flex-col">
        {/* Chat Header */}
        <header className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">BetGPT Chat</h2>
              <p className="text-sm text-muted-foreground">
                {mode === "coach" ? "Your AI betting coach" : "Your AI bankroll manager"}
              </p>
            </div>
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Betting Coach</SelectItem>
                <SelectItem value="manager">Bankroll Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={voiceEnabled ? "text-primary" : "text-muted-foreground"}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
            <ProfileDropdown onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </header>

        {/* Bankroll Stats - Only show in manager mode */}
        {mode === "manager" && <BankrollStats initialBankroll={initialBankroll} />}

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-8">
          <div className="max-w-4xl mx-auto" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="text-center py-12 animate-fade-in">
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
                  <ChatMessage 
                    key={message.id} 
                    {...message} 
                    isStreaming={message.id === streamingMessageId}
                  />
                ))}
                {isTyping && streamingMessageId === null && (
                  <ThinkingIndicator />
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </main>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default Index;
