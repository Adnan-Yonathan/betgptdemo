"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

export function FloatingChat() {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    console.log("Quick message:", message);
    setMessage("");
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      setIsExpanded(false);
    }
  };

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isExpanded]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-background border rounded-2xl shadow-2xl p-4 w-80"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Quick Message</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1"
                autoFocus
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!message.trim()}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Esc to close
            </p>
          </motion.div>
        ) : (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
              "flex items-center justify-center",
              "hover:shadow-xl transition-shadow"
            )}
            aria-label="Open quick chat"
          >
            <MessageSquare className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
