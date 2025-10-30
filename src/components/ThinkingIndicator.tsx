import { cn } from "@/lib/utils";

export const ThinkingIndicator = () => {
  return (
    <div className="mb-6 animate-fade-in flex gap-3">
      {/* Message Bubble */}
      <div className="flex flex-col max-w-[75%] items-start">
        {/* Thinking Animation */}
        <div className="rounded-2xl px-4 py-3 bg-[hsl(var(--chat-ai-bg))] text-foreground rounded-tl-sm">
          <div className="flex gap-1.5 items-center">
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    </div>
  );
};
