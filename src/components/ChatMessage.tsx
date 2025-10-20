import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export const ChatMessage = ({ role, content, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-4 mb-6", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-gradient-to-br from-primary to-primary/80"
            : "bg-muted"
        )}
      >
        <span className={cn("text-sm font-semibold", isUser ? "text-white" : "text-foreground")}>
          {isUser ? "U" : "B"}
        </span>
      </div>

      {/* Message Content */}
      <div className={cn("flex-1 max-w-3xl", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-chat-user text-white"
              : "bg-chat-ai text-foreground"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        {timestamp && (
          <span className="text-xs text-muted-foreground mt-1">{timestamp}</span>
        )}
      </div>
    </div>
  );
};
