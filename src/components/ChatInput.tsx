import { useState, useRef } from "react";
import { Camera, Mic, Plus, Send, X, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "@/utils/voiceUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const { toast } = useToast();
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

  const handleMicClick = async () => {
    if (isRecording) {
      // Stop recording
      try {
        setIsTranscribing(true);
        const base64Audio = await voiceRecorderRef.current?.stopRecording();
        
        if (base64Audio) {
          const { data, error } = await supabase.functions.invoke('speech-to-text', {
            body: { audio: base64Audio }
          });

          if (error) throw error;
          
          if (data?.text) {
            setMessage(data.text);
            toast({
              title: "Transcription complete",
              description: "Your voice has been converted to text",
            });
          }
        }
      } catch (error) {
        console.error('Error transcribing audio:', error);
        toast({
          title: "Transcription failed",
          description: "Failed to convert speech to text",
          variant: "destructive",
        });
      } finally {
        setIsRecording(false);
        setIsTranscribing(false);
        voiceRecorderRef.current = null;
      }
    } else {
      // Start recording
      try {
        voiceRecorderRef.current = new VoiceRecorder();
        await voiceRecorderRef.current.startRecording();
        setIsRecording(true);
        toast({
          title: "Recording started",
          description: "Speak now...",
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Recording failed",
          description: "Failed to access microphone",
          variant: "destructive",
        });
      }
    }
  };
  return <div className="border-t border-border bg-background p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        {/* Attached Files Display */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 sm:mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted px-2 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm"
              >
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{file.name}</span>
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

        <div className="relative flex items-end gap-1.5 sm:gap-2">
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
            className="flex-shrink-0 mb-0.5 sm:mb-1 h-10 w-10 sm:h-9 sm:w-9"
            onClick={handlePlusClick}
            disabled={disabled}
          >
            <Plus className="w-5 h-5" />
          </Button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything" className="min-h-[44px] sm:min-h-[52px] max-h-[200px] pr-20 sm:pr-24 resize-none bg-chat-input border-border focus:border-primary transition-colors text-sm sm:text-base" disabled={disabled} rows={1} />

            {/* Input Actions */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn("h-9 w-9 sm:h-8 sm:w-8", isRecording && "text-destructive animate-pulse")}
                onClick={handleMicClick}
                disabled={disabled || isTranscribing}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Send Button */}
          <Button type="submit" size="icon" className={cn("flex-shrink-0 mb-0.5 sm:mb-1 h-10 w-10 sm:h-9 sm:w-9 transition-all", message.trim() ? "bg-primary hover:bg-primary/90" : "bg-muted text-muted-foreground")} disabled={!message.trim() || disabled}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>;
};