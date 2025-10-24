"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { ChatWindow } from "@/components/chat-window";
import { FloatingChat } from "@/components/floating-chat";

export default function ChatPage() {
  const { newConversation, conversations, activeConversationId } = useChatStore();

  React.useEffect(() => {
    if (conversations.length === 0) {
      newConversation();
    } else if (!activeConversationId) {
      // If there are conversations but none is active, activate the first one
      const firstConv = conversations[0];
      if (firstConv) {
        useChatStore.getState().setActiveConversation(firstConv.id);
      }
    }
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        useChatStore.getState().toggleSidebar();
      }

      // / or Cmd/Ctrl + K to focus composer
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        const textarea = document.querySelector("textarea");
        textarea?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="h-screen flex overflow-hidden"
    >
      <Sidebar />
      <ChatWindow />
      <FloatingChat />
    </motion.div>
  );
}
