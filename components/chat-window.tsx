"use client";

import * as React from "react";
import { Menu, MoreVertical, Send } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Message, TypingIndicator } from "./message";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { mockStream } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Tell me about the weather",
  "Help me write an email",
  "Explain quantum computing",
  "Plan a weekend trip",
];

const MOCK_RESPONSES = [
  "I'd be happy to help you with that! Let me provide you with some detailed information and insights on this topic.",
  "That's a great question! Here's what I know: This is a complex topic that involves several important considerations.",
  "Based on your question, I can offer you the following perspective and recommendations for your situation.",
  "Let me break this down for you in a clear and understandable way that should help clarify things.",
];

export function ChatWindow() {
  const {
    getActiveConversation,
    addMessage,
    updateLastMessage,
    renameConversation,
    duplicateConversation,
    deleteConversation,
    setSidebarOpen,
    uiSettings,
  } = useChatStore();

  const conversation = getActiveConversation();
  const [input, setInput] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, isStreaming]);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!input.trim() || !conversation || isStreaming) return;

    const userMessage = input.trim();
    setInput("");

    addMessage(conversation.id, {
      role: "user",
      content: userMessage,
    });

    setIsStreaming(true);

    setTimeout(() => {
      const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

      addMessage(conversation.id, {
        role: "assistant",
        content: "",
      });

      mockStream(
        response,
        (chunk) => {
          updateLastMessage(conversation.id, chunk);
        },
        () => {
          setIsStreaming(false);
        }
      );
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">No conversation selected</h2>
          <p className="text-muted-foreground">
            Start a new chat or select one from the sidebar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold">{conversation.title}</h2>
            <span className="text-xs text-muted-foreground">GPT-4</span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const newTitle = prompt("Enter new title:", conversation.title);
              if (newTitle) renameConversation(conversation.id, newTitle);
            }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicateConversation(conversation.id)}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteConversation(conversation.id)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {conversation.messages.length === 0 ? (
            <div className="space-y-6 py-12">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">What can I help you with?</h3>
                <p className="text-muted-foreground">Try one of these prompts to get started</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptClick(prompt)}
                    className="p-4 text-left border rounded-lg hover:bg-accent transition-colors"
                  >
                    <p className="text-sm">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {conversation.messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  density={uiSettings.messageDensity}
                  corners={uiSettings.bubbleCorners}
                />
              ))}
              {isStreaming && <TypingIndicator />}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
