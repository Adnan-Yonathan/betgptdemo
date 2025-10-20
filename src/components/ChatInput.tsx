import { useState, useRef } from "react";
import { Camera, Mic, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}
export const ChatInput = ({
  onSendMessage,
  disabled
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };
  return <div className="border-t border-border bg-background p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        {/* Attached Files Display */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md text-sm"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => handleRemoveFile(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2">
          {/* Additional Actions */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />
          <Button 
            type="button" 
            size="icon" 
            variant="ghost" 
            className="flex-shrink-0 mb-1" 
            onClick={handlePlusClick}
            disabled={disabled}
          >
            <Plus className="w-5 h-5" />
          </Button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything" className="min-h-[52px] max-h-[200px] pr-24 resize-none bg-chat-input border-border focus:border-primary transition-colors" disabled={disabled} rows={1} />
            
            {/* Input Actions */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled}>
                <Mic className="w-4 h-4" />
              </Button>
              
            </div>
          </div>

          {/* Send Button */}
          <Button type="submit" size="icon" className={cn("flex-shrink-0 mb-1 transition-all", message.trim() ? "bg-primary hover:bg-primary/90" : "bg-muted text-muted-foreground")} disabled={!message.trim() || disabled}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>;
};