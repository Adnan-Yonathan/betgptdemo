import { cn } from "@/lib/utils";

export const ThinkingIndicator = () => {
  return (
    <div className="flex gap-4 mb-6 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-foreground">B</span>
      </div>
      <div className="flex-1 max-w-3xl">
        <div className="rounded-2xl px-4 py-3 bg-chat-ai shadow-sm">
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
