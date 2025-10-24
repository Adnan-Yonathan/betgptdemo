"use client";

import { motion } from "framer-motion";
import { Bot, Copy, User } from "lucide-react";
import type { Message as MessageType } from "@/lib/types";
import { formatTimestamp, cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface MessageProps {
  message: MessageType;
  density?: "compact" | "comfortable" | "spacious";
  corners?: "rounded" | "square";
}

export function Message({ message, density = "comfortable", corners = "rounded" }: MessageProps) {
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
  };

  const paddingClass = {
    compact: "py-2 px-3",
    comfortable: "py-3 px-4",
    spacious: "py-4 px-5",
  }[density];

  const radiusClass = corners === "rounded" ? "rounded-2xl" : "rounded-md";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "max-w-[85%] sm:max-w-md md:max-w-lg lg:max-w-xl",
            paddingClass,
            radiusClass,
            "border shadow-sm relative",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground"
          )}
        >
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                    isUser ? "text-primary-foreground hover:bg-primary-foreground/20" : ""
                  )}
                  onClick={handleCopy}
                  aria-label="Copy message"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-muted-foreground px-1">
          {formatTimestamp(message.ts)}
        </span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-3 items-center"
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex gap-1 py-3 px-4 rounded-2xl bg-card border">
        <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" />
      </div>
    </motion.div>
  );
}
