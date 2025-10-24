"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, Search, Settings, Trash2, X } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { cn, formatTimestamp } from "@/lib/utils";

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    sidebarOpen,
    setSidebarOpen,
    newConversation,
    setActiveConversation,
    deleteConversation,
    uiSettings,
    updateUISettings,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredConversations = React.useMemo(() => {
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  const handleNewChat = () => {
    newConversation();
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setSidebarOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "fixed left-0 top-0 z-50 h-full w-80 bg-background border-r flex flex-col",
                "lg:static lg:z-0"
              )}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold text-lg">Conversations</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
                <Button onClick={handleNewChat} className="w-full" size="sm">
                  <MessageSquarePlus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-1" role="list">
                    {filteredConversations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {searchQuery ? "No conversations found" : "No conversations yet"}
                      </p>
                    ) : (
                      filteredConversations.map((conv) => (
                        <div
                          key={conv.id}
                          role="listitem"
                          className={cn(
                            "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                            "hover:bg-accent",
                            activeConversationId === conv.id && "bg-accent"
                          )}
                          onClick={() => handleSelectConversation(conv.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{conv.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(conv.updatedAt)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Settings</DialogTitle>
                      <DialogDescription>
                        Customize your chat experience
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Message Density</label>
                        <div className="flex gap-2">
                          {(["compact", "comfortable", "spacious"] as const).map((density) => (
                            <Button
                              key={density}
                              variant={uiSettings.messageDensity === density ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateUISettings({ messageDensity: density })}
                              className="flex-1 capitalize"
                            >
                              {density}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Bubble Corners</label>
                        <div className="flex gap-2">
                          {(["rounded", "square"] as const).map((corner) => (
                            <Button
                              key={corner}
                              variant={uiSettings.bubbleCorners === corner ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateUISettings({ bubbleCorners: corner })}
                              className="flex-1 capitalize"
                            >
                              {corner}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Persistence</label>
                        <Button
                          variant={uiSettings.persistConversations ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateUISettings({ persistConversations: !uiSettings.persistConversations })}
                          className="w-full"
                        >
                          {uiSettings.persistConversations ? "Enabled" : "Disabled"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
