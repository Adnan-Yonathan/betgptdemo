import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AlertFeedbackProps {
  notificationId: string;
  alertType?: string;
  priorityLevel?: string;
  className?: string;
}

/**
 * Simple Alert Feedback Component
 * Just thumbs up/down to track if alerts were useful
 */
export const AlertFeedback = ({
  notificationId,
  alertType,
  priorityLevel,
  className
}: AlertFeedbackProps) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && notificationId) {
      checkExistingFeedback();
    }
  }, [user, notificationId]);

  const checkExistingFeedback = async () => {
    if (!user || !notificationId) return;

    try {
      const { data } = await supabase
        .from("alert_feedback")
        .select("was_useful")
        .eq("user_id", user.id)
        .eq("notification_id", notificationId)
        .maybeSingle();

      if (data) {
        setFeedback(data.was_useful);
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitFeedback = async (useful: boolean) => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);
    setFeedback(useful);

    try {
      const feedbackData = {
        user_id: user.id,
        notification_id: notificationId,
        alert_id: notificationId,
        alert_type: alertType || null,
        priority_level: priorityLevel || null,
        was_useful: useful,
        user_action: useful ? "investigated" : "dismissed"
      };
      const { data: existing } = await supabase
        .from("alert_feedback")
        .select("id")
        .eq("user_id", user.id)
        .eq("notification_id", notificationId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("alert_feedback")
          .update({ was_useful: useful })
          .eq("user_id", user.id)
          .eq("notification_id", notificationId);
      } else {
        await supabase
          .from("alert_feedback")
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
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => submitFeedback(true)}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2",
          feedback === true && "text-green-600"
        )}
        title="Useful alert"
      >
        <ThumbsUp className={cn(
          "h-3.5 w-3.5",
          feedback === true && "fill-current"
        )} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => submitFeedback(false)}
        disabled={isSubmitting}
        className={cn(
          "h-7 px-2",
          feedback === false && "text-red-600"
        )}
        title="Not useful"
      >
        <ThumbsDown className={cn(
          "h-3.5 w-3.5",
          feedback === false && "fill-current"
        )} />
      </Button>
    </div>
  );
};
