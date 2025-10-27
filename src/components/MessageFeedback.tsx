import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MessageFeedbackProps {
  messageId: string;
  conversationId?: string;
  messageContent: string;
  responseType?: "betting_advice" | "prediction" | "analysis" | "general" | "bankroll_management" | "strategy";
}

/**
 * Simple Message Feedback Component
 * Just thumbs up/down to track if AI responses were helpful
 */
export const MessageFeedback = ({
  messageId,
  conversationId,
  messageContent,
  responseType = "general"
}: MessageFeedbackProps) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      checkExistingFeedback();
    }
  }, [user, messageId]);

  const checkExistingFeedback = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("message_feedback")
        .select("feedback_type")
        .eq("user_id", user.id)
        .eq("message_id", messageId)
        .maybeSingle();

      if (data) {
        setFeedback(data.feedback_type as "thumbs_up" | "thumbs_down");
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitFeedback = async (type: "thumbs_up" | "thumbs_down") => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);
    setFeedback(type);

    try {
      const feedbackData = {
        user_id: user.id,
        message_id: messageId,
        conversation_id: conversationId || null,
        feedback_type: type,
        is_helpful: type === "thumbs_up",
        response_type: responseType,
        message_content_preview: messageContent.substring(0, 200)
      };

      const { data: existing } = await supabase
        .from("message_feedback")
        .select("id")
        .eq("user_id", user.id)
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("message_feedback")
          .update({
            feedback_type: type,
            is_helpful: type === "thumbs_up"
          })
          .eq("user_id", user.id)
          .eq("message_id", messageId);
      } else {
        await supabase
          .from("message_feedback")
          .insert(feedbackData);
      }

      toast.success("Thanks for your feedback!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => submitFeedback("thumbs_up")}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2 hover:bg-green-500/10 hover:text-green-600 transition-colors",
          feedback === "thumbs_up" && "bg-green-500/20 text-green-600"
        )}
        title="Helpful"
      >
        <ThumbsUp className={cn(
          "h-4 w-4",
          feedback === "thumbs_up" && "fill-current"
        )} />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => submitFeedback("thumbs_down")}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2 hover:bg-red-500/10 hover:text-red-600 transition-colors",
          feedback === "thumbs_down" && "bg-red-500/20 text-red-600"
        )}
        title="Not helpful"
      >
        <ThumbsDown className={cn(
          "h-4 w-4",
          feedback === "thumbs_down" && "fill-current"
        )} />
      </Button>
    </div>
  );
};
