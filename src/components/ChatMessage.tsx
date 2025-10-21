import { cn } from "@/lib/utils";
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}
export const ChatMessage = ({
  role,
  content,
  timestamp,
  isStreaming = false
}: ChatMessageProps) => {
  const isUser = role === "user";
  
  // Convert asterisk emphasis to regular text
  const formatContent = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        const innerText = part.slice(1, -1);
        return <span key={index}>{innerText}</span>;
      }
      return part;
    });
  };
  
  return <div className="mb-8 animate-fade-in group">
      {/* Role Label */}
      <div className="mb-2">
        
      </div>

      {/* Message Content */}
      <div className="text-foreground">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {formatContent(content)}
          {isStreaming && <span className="inline-block w-[2px] h-5 bg-foreground ml-0.5 animate-pulse align-middle" />}
        </p>
        {timestamp && <span className="text-xs text-muted-foreground mt-2 block transition-opacity duration-200 opacity-0 group-hover:opacity-100">
            {timestamp}
          </span>}
      </div>
    </div>;
};