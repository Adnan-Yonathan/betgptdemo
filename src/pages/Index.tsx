import { useState, useRef, useEffect, useCallback } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { ProfileSettings } from "@/components/ProfileSettings";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { LiveBetTracker } from "@/components/LiveBetTracker";
import { LiveTrackingChat } from "@/components/LiveTrackingChat";
import { BetAlerts } from "@/components/BetAlerts";
import { AlertSettings } from "@/components/AlertSettingsCard";
import { LiveScoreTicker } from "@/components/LiveScoreTicker";
import { LiveEventsTicker } from "@/components/LiveEventsTicker";
import { SmartAlerts } from "@/components/intelligence/SmartAlerts";
import { AIStrategyAdvisor } from "@/components/intelligence/AIStrategyAdvisor";
import { PatternInsights } from "@/components/intelligence/PatternInsights";
import { BetSimulator } from "@/components/intelligence/BetSimulator";
import { PredictiveAnalytics } from "@/components/intelligence/PredictiveAnalytics";
import { OnboardingChat } from "@/components/OnboardingChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { playAudioFromBase64 } from "@/utils/voiceUtils";
import { BookOpen, Menu, Activity, Bell, Settings, Brain, TrendingUp, Target, Zap, LineChart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserGuide } from "@/components/UserGuide";
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const isMobile = useIsMobile();
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Check if user needs onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking onboarding status:', error);
          setCheckingOnboarding(false);
          return;
        }

        // Onboarding check removed - profiles table doesn't have onboarding_completed column
        setShowOnboarding(false);
      } catch (error) {
        console.error('Error in onboarding check:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

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
        const chunkText = decoder.decode(value, {
          stream: true
        });
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
  // Show loading state while checking onboarding
  if (checkingOnboarding) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if user needs it
  if (user && showOnboarding) {
    return <OnboardingChat onComplete={() => setShowOnboarding(false)} />;
  }

  return <div className="flex h-screen bg-background flex-col">
      {/* Live Events Ticker - Always visible at the top */}
      <LiveEventsTicker />

      <div className="flex flex-1 overflow-hidden">
      {/* Desktop Sidebar - Hidden on mobile */}
      {!isMobile && <ChatSidebar currentConversationId={currentConversationId} onConversationSelect={loadConversation} onNewChat={handleNewChat} />}

      {/* Mobile Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <ChatSidebar currentConversationId={currentConversationId} onConversationSelect={id => {
          loadConversation(id);
          setSidebarOpen(false);
        }} onNewChat={() => {
          handleNewChat();
          setSidebarOpen(false);
        }} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col">
        {/* Chat Header */}
        <header className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hamburger menu for mobile */}
            {isMobile && <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="h-9 w-9 p-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>}
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground">Delta</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Premium Sports Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)} className="flex items-center gap-2 h-9 px-2 sm:px-3">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Guide</span>
            </Button>

            {/* Live Tracking Toggle - Mobile only */}
            {isMobile && user && <Button variant="ghost" size="sm" onClick={() => setRightSidebarOpen(true)} className="h-9 w-9 p-0">
                <Activity className="w-4 h-4" />
                <span className="sr-only">Live tracking</span>
              </Button>}

            <ProfileDropdown onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </header>

        {/* Live Score Ticker */}
        {user && <div className="border-b border-border">
            <LiveScoreTicker />
          </div>}

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

      {/* Right Sidebar - Desktop only, shown when user is logged in */}
      {!isMobile && user && <aside className="w-[380px] border-l border-border bg-background flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-lg">Live Tracking & Intelligence</h3>
            <p className="text-xs text-muted-foreground">Real-time updates and AI insights</p>
          </div>
          <ScrollArea className="flex-1">
            <Tabs defaultValue="bets" className="w-full">
              <TabsList className="w-full grid grid-cols-5 border-b rounded-none h-auto p-0">
                <TabsTrigger value="bets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Activity className="w-4 h-4 mr-1" />
                  Bets
                </TabsTrigger>
                <TabsTrigger value="chat" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="alerts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Bell className="w-4 h-4 mr-1" />
                  Alerts
                </TabsTrigger>
                <TabsTrigger value="smart-alerts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Zap className="w-4 h-4 mr-1" />
                  Smart
                </TabsTrigger>
                <TabsTrigger value="ai-strategy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Brain className="w-4 h-4 mr-1" />
                  AI
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-4 border-b rounded-none h-auto p-0">
                <TabsTrigger value="patterns" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Patterns
                </TabsTrigger>
                <TabsTrigger value="simulator" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Target className="w-4 h-4 mr-1" />
                  Simulator
                </TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <LineChart className="w-4 h-4 mr-1" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                  <Settings className="w-4 h-4 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>
              <div className="p-4">
                <TabsContent value="bets" className="mt-0">
                  <LiveBetTracker />
                </TabsContent>
                <TabsContent value="chat" className="mt-0">
                  <LiveTrackingChat />
                </TabsContent>
                <TabsContent value="alerts" className="mt-0">
                  <BetAlerts />
                </TabsContent>
                <TabsContent value="smart-alerts" className="mt-0">
                  <SmartAlerts />
                </TabsContent>
                <TabsContent value="ai-strategy" className="mt-0">
                  <AIStrategyAdvisor />
                </TabsContent>
                <TabsContent value="patterns" className="mt-0">
                  <PatternInsights />
                </TabsContent>
                <TabsContent value="simulator" className="mt-0">
                  <BetSimulator />
                </TabsContent>
                <TabsContent value="analytics" className="mt-0">
                  <PredictiveAnalytics />
                </TabsContent>
                <TabsContent value="settings" className="mt-0">
                  <AlertSettings />
                </TabsContent>
              </div>
            </Tabs>
          </ScrollArea>
        </aside>}

      {/* Mobile Live Tracking Sheet */}
      <Sheet open={rightSidebarOpen} onOpenChange={setRightSidebarOpen}>
        <SheetContent side="right" className="p-0 w-[90vw] sm:w-[380px]">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-lg">Live Tracking & Intelligence</h3>
            <p className="text-xs text-muted-foreground">Real-time updates and AI insights</p>
          </div>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <Tabs defaultValue="bets" className="w-full">
              <div className="overflow-x-auto">
                <TabsList className="w-full inline-flex min-w-full border-b rounded-none h-auto p-0">
                  <TabsTrigger value="bets" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Activity className="w-4 h-4 mr-1" />
                    Bets
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="alerts" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Bell className="w-4 h-4 mr-1" />
                    Alerts
                  </TabsTrigger>
                  <TabsTrigger value="smart-alerts" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Zap className="w-4 h-4 mr-1" />
                    Smart
                  </TabsTrigger>
                  <TabsTrigger value="ai-strategy" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Brain className="w-4 h-4 mr-1" />
                    AI
                  </TabsTrigger>
                </TabsList>
                <TabsList className="w-full inline-flex min-w-full border-b rounded-none h-auto p-0">
                  <TabsTrigger value="patterns" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Patterns
                  </TabsTrigger>
                  <TabsTrigger value="simulator" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Target className="w-4 h-4 mr-1" />
                    Simulator
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <LineChart className="w-4 h-4 mr-1" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-2">
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="p-4">
                <TabsContent value="bets" className="mt-0">
                  <LiveBetTracker />
                </TabsContent>
                <TabsContent value="chat" className="mt-0">
                  <LiveTrackingChat />
                </TabsContent>
                <TabsContent value="alerts" className="mt-0">
                  <BetAlerts />
                </TabsContent>
                <TabsContent value="smart-alerts" className="mt-0">
                  <SmartAlerts />
                </TabsContent>
                <TabsContent value="ai-strategy" className="mt-0">
                  <AIStrategyAdvisor />
                </TabsContent>
                <TabsContent value="patterns" className="mt-0">
                  <PatternInsights />
                </TabsContent>
                <TabsContent value="simulator" className="mt-0">
                  <BetSimulator />
                </TabsContent>
                <TabsContent value="analytics" className="mt-0">
                  <PredictiveAnalytics />
                </TabsContent>
                <TabsContent value="settings" className="mt-0">
                  <AlertSettings />
                </TabsContent>
              </div>
            </Tabs>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
      <UserGuide open={guideOpen} onOpenChange={setGuideOpen} />
      </div>
    </div>;
};
export default Index;