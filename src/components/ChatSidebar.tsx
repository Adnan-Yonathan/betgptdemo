import { MessageSquare, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
interface ChatSidebarProps {
  currentConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewChat: () => void;
}
export const ChatSidebar = ({
  currentConversationId,
  onConversationSelect,
  onNewChat
}: ChatSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const fetchConversations = async () => {
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from("conversations").select("*").order("updated_at", {
      ascending: false
    });
    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }
    setConversations(data || []);
  };
  useEffect(() => {
    fetchConversations();
  }, [user]);
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const {
      error
    } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Success",
      description: "Conversation deleted"
    });
    fetchConversations();
    if (currentConversationId === id) {
      onNewChat();
    }
  };
  const filteredConversations = conversations.filter(conv => conv.title.toLowerCase().includes(searchQuery.toLowerCase()));
  return <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <Button onClick={onNewChat} className="w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground">
          <Plus className="w-4 h-4" />
          New chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/50" />
          <Input placeholder="Search chats" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50" />
        </div>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.length === 0 && user && <p className="text-sm text-sidebar-foreground/50 text-center p-4">
              No conversations yet
            </p>}
          {!user && <p className="text-sm text-sidebar-foreground/50 text-center p-4">
              Sign in to view chat history
            </p>}
          {filteredConversations.map(conv => <button key={conv.id} onClick={() => onConversationSelect(conv.id)} className={`group w-full text-left p-3 rounded-lg hover:bg-sidebar-accent transition-colors ${currentConversationId === conv.id ? "bg-sidebar-accent" : ""}`}>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sidebar-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-sidebar-foreground truncate">{conv.title}</p>
                  <p className="text-xs text-sidebar-foreground/50 mt-0.5">
                    {formatDistanceToNow(new Date(conv.updated_at), {
                  addSuffix: true
                })}
                  </p>
                </div>
                <button onClick={e => handleDelete(conv.id, e)} className="p-1 hover:bg-destructive/20 rounded transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" aria-label="Delete conversation">
                  <X className="w-3.5 h-3.5 text-sidebar-foreground/70 hover:text-destructive" />
                </button>
              </div>
            </button>)}
        </div>
      </ScrollArea>
    </aside>;
};