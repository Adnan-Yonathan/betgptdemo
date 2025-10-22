import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

// Memoized component to prevent unnecessary re-renders
export const ChatMessage = memo(({
  role,
  content,
  timestamp,
  isStreaming = false
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
  
  return <div className="mb-8 animate-fade-in group">
      {/* Role Label */}
      <div className="mb-2">
        
      </div>

      {/* Message Content */}
      <div className="text-foreground">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {formattedContent}
          {isStreaming && <span className="inline-block w-[2px] h-5 bg-foreground ml-0.5 animate-pulse align-middle" />}
        </p>
        {timestamp && <span className="text-xs text-muted-foreground mt-2 block transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            {timestamp}
          </span>}
      </div>
    </div>;
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if these props actually change
  return (
    prevProps.content === nextProps.content &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.timestamp === nextProps.timestamp &&
    prevProps.role === nextProps.role
  );
});