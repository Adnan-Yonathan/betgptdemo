import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface MessageFeedbackProps {
  messageId: string;
  conversationId?: string;
  messageContent: string;
  responseType?: "betting_advice" | "prediction" | "analysis" | "general" | "bankroll_management" | "strategy";
}

type FeedbackType = "thumbs_up" | "thumbs_down";

/**
 * MessageFeedback Component
 * Allows users to provide feedback on AI messages with thumbs up/down and optional text
 * Integrates with the message_feedback table for continuous improvement tracking
 */
export const MessageFeedback = ({
  messageId,
  conversationId,
  messageContent,
  responseType = "general"
}: MessageFeedbackProps) => {
  const { user } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingFeedback, setHasExistingFeedback] = useState(false);

  // Check if user has already provided feedback
  useEffect(() => {
    if (user) {
      checkExistingFeedback();
    }
  }, [user, messageId]);

  const checkExistingFeedback = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("message_feedback")
        .select("feedback_type")
        .eq("user_id", user.id)
        .eq("message_id", messageId)
        .maybeSingle();

      if (error) {
        console.error("Error checking existing feedback:", error);
        return;
      }

      if (data) {
        setHasExistingFeedback(true);
        setFeedbackType(data.feedback_type as FeedbackType);
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitFeedback = async (type: FeedbackType, text?: string) => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        user_id: user.id,
        message_id: messageId,
        conversation_id: conversationId || null,
        feedback_type: type,
        is_helpful: type === "thumbs_up",
        response_type: responseType,
        message_content_preview: messageContent.substring(0, 200),
        feedback_text: text || null,
        feedback_category: null,
        rating: null
      };

      // Check if feedback already exists
      if (hasExistingFeedback) {
        // Update existing feedback
        const { error } = await supabase
          .from("message_feedback")
          .update({
            feedback_type: type,
            is_helpful: type === "thumbs_up",
            feedback_text: text || null,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id)
          .eq("message_id", messageId);

        if (error) throw error;

        toast.success("Feedback updated!");
      } else {
        // Insert new feedback
        const { error } = await supabase
          .from("message_feedback")
          .insert(feedbackData);

        if (error) throw error;

        toast.success("Thank you for your feedback!");
        setHasExistingFeedback(true);
      }

      setFeedbackType(type);
      setShowFeedbackForm(false);
      setFeedbackText("");

    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsUp = () => {
    if (feedbackType === "thumbs_up") {
      // Already thumbs up, show form to add details
      setShowFeedbackForm(true);
    } else {
      submitFeedback("thumbs_up");
    }
  };

  const handleThumbsDown = () => {
    if (feedbackType === "thumbs_down") {
      // Already thumbs down, show form to edit
      setShowFeedbackForm(true);
    } else {
      // New thumbs down, show form immediately
      setShowFeedbackForm(true);
      setFeedbackType("thumbs_down");
    }
  };

  const handleSubmitDetailedFeedback = async () => {
    if (!feedbackType) {
      setFeedbackType("thumbs_down");
    }
    await submitFeedback(feedbackType || "thumbs_down", feedbackText);
  };

  return (
    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Thumbs Up Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleThumbsUp}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2 hover:bg-green-500/10 hover:text-green-600 transition-colors",
          feedbackType === "thumbs_up" && "bg-green-500/20 text-green-600"
        )}
        title="Helpful"
      >
        <ThumbsUp className={cn(
          "h-4 w-4",
          feedbackType === "thumbs_up" && "fill-current"
        )} />
      </Button>

      {/* Thumbs Down Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleThumbsDown}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2 hover:bg-red-500/10 hover:text-red-600 transition-colors",
          feedbackType === "thumbs_down" && "bg-red-500/20 text-red-600"
        )}
        title="Not helpful"
      >
        <ThumbsDown className={cn(
          "h-4 w-4",
          feedbackType === "thumbs_down" && "fill-current"
        )} />
      </Button>

      {/* Detailed Feedback Popover */}
      <Popover open={showFeedbackForm} onOpenChange={setShowFeedbackForm}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
            title="Provide detailed feedback"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">
                {feedbackType === "thumbs_up" ? "What did you like?" : "What could be improved?"}
              </h4>
              <p className="text-xs text-muted-foreground">
                Your feedback helps us improve the AI responses
              </p>
            </div>

            <Textarea
              placeholder={
                feedbackType === "thumbs_up"
                  ? "This response was helpful because..."
                  : "This could be improved by..."
              }
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[100px] text-sm"
              disabled={isSubmitting}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmitDetailedFeedback}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowFeedbackForm(false);
                  setFeedbackText("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Feedback status indicator */}
      {hasExistingFeedback && (
        <span className="text-xs text-muted-foreground ml-1">
          (feedback recorded)
        </span>
      )}
    </div>
  );
};
