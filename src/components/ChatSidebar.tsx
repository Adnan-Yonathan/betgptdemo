import { MessageSquare, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatHistory {
  id: string;
  title: string;
  timestamp: string;
}

const mockChatHistory: ChatHistory[] = [
  { id: "1", title: "Lakers -5.5 Analysis", timestamp: "2 hours ago" },
  { id: "2", title: "October Performance Review", timestamp: "Yesterday" },
  { id: "3", title: "NFL Totals Strategy", timestamp: "2 days ago" },
  { id: "4", title: "Parlay Discussion", timestamp: "3 days ago" },
  { id: "5", title: "Chiefs Win Review", timestamp: "4 days ago" },
];

export const ChatSidebar = () => {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <h1 className="text-sidebar-foreground font-semibold text-lg">BetGPT</h1>
        </div>
        <Button className="w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground">
          <Plus className="w-4 h-4" />
          New chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/50" />
          <Input
            placeholder="Search chats"
            className="pl-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
          />
        </div>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {mockChatHistory.map((chat) => (
            <button
              key={chat.id}
              className="w-full text-left p-3 rounded-lg hover:bg-sidebar-accent transition-colors group"
            >
              <div className="flex items-start gap-3">
                <MessageSquare className="w-4 h-4 text-sidebar-foreground/50 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-sidebar-foreground truncate">{chat.title}</p>
                  <p className="text-xs text-sidebar-foreground/50 mt-0.5">{chat.timestamp}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
};
