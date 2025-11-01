import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { LiveBetTracker } from "@/components/LiveBetTracker";
import { BetAlerts } from "@/components/BetAlerts";
import { AlertSettings } from "@/components/AlertSettingsCard";
import { LiveScoreTicker } from "@/components/LiveScoreTicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { playAudioFromBase64 } from "@/utils/voiceUtils";
import { BookOpen, Menu, Activity, Bell, Settings, Lightbulb, Target, Eye, TrendingUp, PlayCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserGuide } from "@/components/UserGuide";
import { AIStrategyAdvisor } from "@/components/intelligence/AIStrategyAdvisor";
import { PatternInsights } from "@/components/intelligence/PatternInsights";
import { SmartAlerts } from "@/components/intelligence/SmartAlerts";
import { BetSimulator } from "@/components/intelligence/BetSimulator";
import { PredictiveAnalytics } from "@/components/intelligence/PredictiveAnalytics";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const initialMessages: Message[] = [{
  id: "1",
  role: "assistant",
  content: "Welcome to DeltaEdge. I can:\n\n- give you up to date betting lines\n- find you inefficiencies in the market\n- help you manage your bankroll\n\nHow can I help you today?",
  timestamp: "Just now"
}];
const Index = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll with different behavior for streaming vs complete messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const isStreaming = streamingMessageId !== null;
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        // Use instant scroll during streaming for better responsiveness
        // Use smooth scroll for complete messages
        behavior: isStreaming ? 'auto' : 'smooth'
      });
    }
  }, [messages, isTyping, streamingMessageId]);
  const saveMessageToDb = async (conversationId: string, role: "user" | "assistant", content: string) => {
    if (!user) return;
    const {
      error
    } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role,
      content
    });
    if (error) {
      console.error("Error saving message:", error);
    }
  };
  const playResponseAudio = async (text: string) => {
    if (!voiceEnabled || isPlayingAudio) return;
    try {
      setIsPlayingAudio(true);
      const {
        data,
        error
      } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text
        }
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
    const {
      data,
      error
    } = await supabase.from("conversations").insert({
      user_id: user.id,
      title
    }).select().single();
    if (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
    setCurrentConversationId(data.id);
    return data.id;
  };
  const loadConversation = async (conversationId: string) => {
    const {
      data,
      error
    } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
      ascending: true
    });
    if (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
      return;
    }
    if (!data || data.length === 0) {
      toast({
        title: "No messages found",
        description: "This conversation appears to be empty",
        variant: "destructive"
      });
      return;
    }
    const loadedMessages: Message[] = [...initialMessages,
    // Include welcome message
    ...data.map(msg => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      timestamp: "Just now"
    }))];
    setMessages(loadedMessages);
    setCurrentConversationId(conversationId);
  };
  const handleNewChat = () => {
    setMessages(initialMessages);
    setCurrentConversationId(null);
  };
  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: "Just now"
    };
    setMessages(prev => [...prev, userMessage]);
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
    let rafId: number | null = null;
    let pendingUpdate = false;

    // RAF-based batching for smooth streaming updates
    const scheduleUpdate = () => {
      if (pendingUpdate) return;
      pendingUpdate = true;
      rafId = requestAnimationFrame(() => {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map(m => m.id === assistantId ? {
              ...m,
              content: assistantContent
            } : m);
          }
          return [...prev, {
            id: assistantId,
            role: "assistant",
            content: assistantContent,
            timestamp: "Just now"
          }];
        });
        pendingUpdate = false;
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })).concat([{
            role: "user",
            content
          }]),
          conversationId: currentConversationId,
          userId: user?.id
        })
      });
      if (!resp.ok) {
        if (resp.status === 429) {
          toast({
            title: "Rate limit exceeded",
            description: "Please try again in a moment.",
            variant: "destructive"
          });
        } else if (resp.status === 402) {
          toast({
            title: "Payment required",
            description: "Please add credits to your workspace.",
            variant: "destructive"
          });
        }
        throw new Error("Failed to get response");
      }
      if (!resp.body) {
        throw new Error("No response body");
      }

      console.log("[STREAMING] Starting stream processing...");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let chunkCount = 0;
      let tokenCount = 0;

      while (!streamDone) {
        const {
          done,
          value
        } = await reader.read();
        if (done) {
          console.log("[STREAMING] Stream complete. Total chunks:", chunkCount, "Total tokens:", tokenCount);
          break;
        }

        chunkCount++;
        const chunkText = decoder.decode(value, { stream: true });
        textBuffer += chunkText;
        console.log(`[STREAMING] Chunk ${chunkCount} received (${value.byteLength} bytes)`);

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) {
            console.warn("[STREAMING] Unexpected line format:", line.substring(0, 50));
            continue;
          }

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            console.log("[STREAMING] Received [DONE] signal");
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (deltaContent) {
              tokenCount++;
              assistantContent += deltaContent;
              console.log(`[STREAMING] Token ${tokenCount}: "${deltaContent}" (Total length: ${assistantContent.length})`);
              setStreamingMessageId(assistantId);
              // Use RAF-based batching for smooth updates
              scheduleUpdate();
            }
          } catch (error) {
            console.error("[STREAMING] JSON parse error:", error, "Line:", line.substring(0, 100));
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Cancel any pending RAF and do final update
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      // Final update with complete content
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId) {
          return prev.map(m => m.id === assistantId ? {
            ...m,
            content: assistantContent
          } : m);
        }
        return [...prev, {
          id: assistantId,
          role: "assistant",
          content: assistantContent,
          timestamp: "Just now"
        }];
      });

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
        variant: "destructive"
      });
    }
  };
  return <div className="flex h-screen bg-background">
      {/* Desktop Sidebar - Hidden on mobile */}
      {!isMobile && (
        <ChatSidebar
          currentConversationId={currentConversationId}
          onConversationSelect={loadConversation}
          onNewChat={handleNewChat}
        />
      )}

      {/* Mobile Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <ChatSidebar
            currentConversationId={currentConversationId}
            onConversationSelect={(id) => {
              loadConversation(id);
              setSidebarOpen(false);
            }}
            onNewChat={() => {
              handleNewChat();
              setSidebarOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col">
        {/* Chat Header */}
        <header className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hamburger menu for mobile */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="h-9 w-9 p-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">DeltaEdge</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Premium Sports Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)} className="flex items-center gap-2 h-9 px-2 sm:px-3">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Guide</span>
            </Button>

            {/* Intelligence & Tracking Menu Toggle */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isMobile) {
                    setRightSidebarOpen(true);
                  } else {
                    setRightSidebarCollapsed(!rightSidebarCollapsed);
                  }
                }}
                className="h-9 px-2 sm:px-3 flex items-center gap-2"
              >
                {isMobile ? (
                  <Activity className="w-4 h-4" />
                ) : rightSidebarCollapsed ? (
                  <>
                    <PanelRightOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Show Menu</span>
                  </>
                ) : (
                  <>
                    <PanelRightClose className="w-4 h-4" />
                    <span className="hidden sm:inline">Hide Menu</span>
                  </>
                )}
                <span className="sr-only">Toggle menu</span>
              </Button>
            )}

            <ProfileDropdown onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </header>

        {/* Live Score Ticker */}
        {user && (
          <div className="border-b border-border">
            <LiveScoreTicker />
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
          <div className="max-w-4xl mx-auto" ref={scrollAreaRef}>
            {messages.length === 0 ? <div className="text-center py-12 animate-fade-in">
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  What's on the agenda today?
                </h3>
                <p className="text-muted-foreground">
                  Start a conversation about your bets
                </p>
              </div> : <>
                {messages.map(message => <ChatMessage key={message.id} {...message} messageId={message.id} conversationId={currentConversationId || undefined} isStreaming={message.id === streamingMessageId} />)}
                {isTyping && streamingMessageId === null && <ThinkingIndicator />}
              </>}
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </main>

      {/* Right Sidebar - Desktop only, shown when user is logged in and not collapsed */}
      {!isMobile && user && !rightSidebarCollapsed && (
        <aside className="w-[400px] border-l border-border bg-background flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Intelligence Hub</h3>
              <p className="text-xs text-muted-foreground">Tracking & AI insights</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightSidebarCollapsed(true)}
              className="h-8 w-8"
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="w-full grid grid-cols-3 border-b rounded-none h-auto p-0">
                <TabsTrigger
                  value="insights"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  AI
                </TabsTrigger>
                <TabsTrigger
                  value="tracking"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Live
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Tools
                </TabsTrigger>
              </TabsList>
              <div className="p-3">
                <TabsContent value="insights" className="mt-0 space-y-4">
                  <SmartAlerts />
                  <AIStrategyAdvisor />
                  <PatternInsights />
                </TabsContent>
                <TabsContent value="tracking" className="mt-0 space-y-4">
                  <LiveBetTracker />
                  <BetAlerts />
                  <AlertSettings />
                </TabsContent>
                <TabsContent value="tools" className="mt-0 space-y-4">
                  <BetSimulator />
                  <PredictiveAnalytics />
                </TabsContent>
              </div>
            </Tabs>
          </ScrollArea>
        </aside>
      )}

      {/* Mobile Intelligence Hub Sheet */}
      <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
        <SheetContent side="right" className="p-0 w-[95vw] max-w-[400px]">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-lg">Intelligence Hub</h3>
            <p className="text-xs text-muted-foreground">Tracking & AI insights</p>
          </div>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="w-full grid grid-cols-3 border-b rounded-none h-auto p-0">
                <TabsTrigger
                  value="insights"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs py-3"
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  AI
                </TabsTrigger>
                <TabsTrigger
                  value="tracking"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs py-3"
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Live
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs py-3"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Tools
                </TabsTrigger>
              </TabsList>
              <div className="p-3">
                <TabsContent value="insights" className="mt-0 space-y-4">
                  <SmartAlerts />
                  <AIStrategyAdvisor />
                  <PatternInsights />
                </TabsContent>
                <TabsContent value="tracking" className="mt-0 space-y-4">
                  <LiveBetTracker />
                  <BetAlerts />
                  <AlertSettings />
                </TabsContent>
                <TabsContent value="tools" className="mt-0 space-y-4">
                  <BetSimulator />
                  <PredictiveAnalytics />
                </TabsContent>
              </div>
            </Tabs>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
      <UserGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </div>;
};
export default Index;