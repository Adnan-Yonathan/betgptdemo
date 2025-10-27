import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PredictionFeedbackProps {
  predictionId?: string;
  gameId?: string;
  sport?: string;
  predictionType?: string;
  betId?: string;
  className?: string;
}

/**
 * Simple Prediction Feedback Component
 * Just thumbs up/down to track if predictions were helpful
 */
export const PredictionFeedback = ({
  predictionId,
  gameId,
  sport,
  predictionType,
  betId,
  className
}: PredictionFeedbackProps) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && predictionId) {
      checkExistingFeedback();
    }
  }, [user, predictionId]);

  const checkExistingFeedback = async () => {
    if (!user || !predictionId) return;

    try {
      const { data } = await supabase
        .from("prediction_feedback")
        .select("was_helpful")
        .eq("user_id", user.id)
        .eq("prediction_id", predictionId)
        .maybeSingle();

      if (data) {
        setFeedback(data.was_helpful);
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitFeedback = async (helpful: boolean) => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);
    setFeedback(helpful);

    try {
      const feedbackData = {
        user_id: user.id,
        prediction_id: predictionId || null,
        bet_id: betId || null,
        game_id: gameId || null,
        sport: sport || null,
        prediction_type: predictionType || null,
        was_helpful: helpful,
        user_action: helpful ? "placed_bet" : "skipped"
      };

      const { data: existing } = await supabase
        .from("prediction_feedback")
        .select("id")
        .eq("user_id", user.id)
        .eq("prediction_id", predictionId || "")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("prediction_feedback")
          .update({ was_helpful: helpful })
          .eq("user_id", user.id)
          .eq("prediction_id", predictionId || "");
      } else {
        await supabase
          .from("prediction_feedback")
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
          "h-8 px-2",
          feedback === true && "text-green-600"
        )}
        title="Helpful prediction"
      >
        <ThumbsUp className={cn(
          "h-4 w-4",
          feedback === true && "fill-current"
        )} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => submitFeedback(false)}
        disabled={isSubmitting}
        className={cn(
          "h-8 px-2",
          feedback === false && "text-red-600"
        )}
        title="Not helpful"
      >
        <ThumbsDown className={cn(
          "h-4 w-4",
          feedback === false && "fill-current"
        )} />
      </Button>
    </div>
  );
};
