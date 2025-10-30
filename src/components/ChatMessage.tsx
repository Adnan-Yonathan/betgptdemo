import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";
import { MessageFeedback } from "./MessageFeedback";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  messageId?: string;
  conversationId?: string;
}

// Memoized component to prevent unnecessary re-renders
export const ChatMessage = memo(({
  role,
  content,
  timestamp,
  isStreaming = false,
  messageId,
  conversationId
}: ChatMessageProps) => {
  const isUser = role === "user";

  // Memoize formatted content to avoid re-computation
  const formattedContent = useMemo(() => {
    const parts = content.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        const innerText = part.slice(1, -1);
        return <span key={index}>{innerText}</span>;
      }
      return part;
    });
  }, [content]);
  
  return (
    <div className={cn(
      "mb-4 sm:mb-6 animate-fade-in group flex gap-2 sm:gap-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar Badge */}
      <div className={cn(
        "flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold",
        isUser
          ? "bg-[hsl(var(--chat-user-bg))] text-white"
          : "bg-[hsl(var(--chat-ai-bg))] text-foreground"
      )}>
        {isUser ? "You" : "AI"}
      </div>

      {/* Message Bubble */}
      <div className={cn(
        "flex flex-col max-w-[90%] sm:max-w-[85%] md:max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Role Label */}
        <div className="mb-1 px-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? "You" : "Qauntara"}
          </span>
        </div>

        {/* Message Content */}
        <div className={cn(
          "rounded-2xl px-3 py-2 sm:px-4 sm:py-3",
          isUser
            ? "bg-[hsl(var(--chat-user-bg))] text-white rounded-tr-sm"
            : "bg-[hsl(var(--chat-ai-bg))] text-foreground rounded-tl-sm"
        )}>
          <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {formattedContent}
            {isStreaming && (
              <span
                className="inline-block w-[3px] h-5 bg-current ml-1 align-middle"
                style={{
                  animation: "blink 0.8s ease-in-out infinite",
                }}
              />
            )}
          </p>
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1 px-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            {timestamp}
          </span>
        )}

        {/* Feedback Component - Only for assistant messages that are not streaming */}
        {!isUser && !isStreaming && messageId && (
          <MessageFeedback
            messageId={messageId}
            conversationId={conversationId}
            messageContent={content}
            responseType="general"
          />
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if these props actually change
  return (
    prevProps.content === nextProps.content &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.timestamp === nextProps.timestamp &&
    prevProps.role === nextProps.role &&
    prevProps.messageId === nextProps.messageId &&
    prevProps.conversationId === nextProps.conversationId
  );
});