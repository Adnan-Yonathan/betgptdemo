import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface PredictionFeedbackProps {
  predictionId?: string;
  gameId?: string;
  sport?: string;
  predictionType?: string;
  betId?: string;
  className?: string;
}

type UserAction = "placed_bet" | "skipped" | "saved_for_later" | "shared" | "ignored";

/**
 * PredictionFeedback Component
 * Allows users to provide detailed feedback on betting predictions
 * Tracks helpfulness, accuracy, confidence, and value ratings
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingFeedback, setHasExistingFeedback] = useState(false);

  // Form state
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [wasAccurate, setWasAccurate] = useState<boolean | null>(null);
  const [confidenceRating, setConfidenceRating] = useState<number>(3);
  const [valueRating, setValueRating] = useState<number>(3);
  const [userAction, setUserAction] = useState<UserAction>("skipped");
  const [feedbackText, setFeedbackText] = useState("");

  // Check if user has already provided feedback
  useEffect(() => {
    if (user && predictionId) {
      checkExistingFeedback();
    }
  }, [user, predictionId]);

  const checkExistingFeedback = async () => {
    if (!user || !predictionId) return;

    try {
      const { data, error } = await supabase
        .from("prediction_feedback")
        .select("*")
        .eq("user_id", user.id)
        .eq("prediction_id", predictionId)
        .maybeSingle();

      if (error) {
        console.error("Error checking existing feedback:", error);
        return;
      }

      if (data) {
        setHasExistingFeedback(true);
        // Pre-populate form with existing data
        setWasHelpful(data.was_helpful);
        setWasAccurate(data.was_accurate);
        setConfidenceRating(data.confidence_rating || 3);
        setValueRating(data.value_rating || 3);
        setUserAction(data.user_action as UserAction);
        setFeedbackText(data.feedback_text || "");
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitFeedback = async () => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    if (!predictionId && !gameId) {
      toast.error("Missing prediction or game ID");
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        user_id: user.id,
        prediction_id: predictionId || null,
        bet_id: betId || null,
        game_id: gameId || null,
        sport: sport || null,
        prediction_type: predictionType || null,
        was_helpful: wasHelpful,
        was_accurate: wasAccurate,
        confidence_rating: confidenceRating,
        value_rating: valueRating,
        user_action: userAction,
        feedback_text: feedbackText || null,
        prediction_result: null, // Will be updated when outcome is known
        user_profit_loss: null
      };

      if (hasExistingFeedback) {
        // Update existing feedback
        const { error } = await supabase
          .from("prediction_feedback")
          .update({
            ...feedbackData,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id)
          .eq("prediction_id", predictionId || "");

        if (error) throw error;

        toast.success("Feedback updated!");
      } else {
        // Insert new feedback
        const { error } = await supabase
          .from("prediction_feedback")
          .insert(feedbackData);

        if (error) throw error;

        toast.success("Thank you for your feedback!");
        setHasExistingFeedback(true);
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (val: number) => void; label: string }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={cn(
              "transition-colors",
              star <= value ? "text-yellow-500" : "text-gray-300"
            )}
          >
            <Star className="h-6 w-6 fill-current" />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === 1 && "Very low"}
        {value === 2 && "Low"}
        {value === 3 && "Moderate"}
        {value === 4 && "High"}
        {value === 5 && "Very high"}
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          {hasExistingFeedback ? (
            <>
              <Star className="h-4 w-4 fill-current text-yellow-500" />
              Edit Feedback
            </>
          ) : (
            <>
              <Star className="h-4 w-4" />
              Rate Prediction
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate This Prediction</DialogTitle>
          <DialogDescription>
            Your feedback helps us improve prediction accuracy and provide better recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Helpful/Not Helpful */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Was this prediction helpful?</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={wasHelpful === true ? "default" : "outline"}
                onClick={() => setWasHelpful(true)}
                className="flex-1 gap-2"
              >
                <ThumbsUp className={cn("h-4 w-4", wasHelpful === true && "fill-current")} />
                Helpful
              </Button>
              <Button
                type="button"
                variant={wasHelpful === false ? "default" : "outline"}
                onClick={() => setWasHelpful(false)}
                className="flex-1 gap-2"
              >
                <ThumbsDown className={cn("h-4 w-4", wasHelpful === false && "fill-current")} />
                Not Helpful
              </Button>
            </div>
          </div>

          {/* Accuracy (if outcome is known) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Was this prediction accurate?</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={wasAccurate === true ? "default" : "outline"}
                onClick={() => setWasAccurate(true)}
                className="flex-1"
              >
                Yes, it was correct
              </Button>
              <Button
                type="button"
                variant={wasAccurate === false ? "default" : "outline"}
                onClick={() => setWasAccurate(false)}
                className="flex-1"
              >
                No, it was wrong
              </Button>
              <Button
                type="button"
                variant={wasAccurate === null ? "default" : "outline"}
                onClick={() => setWasAccurate(null)}
                className="flex-1"
              >
                Not sure yet
              </Button>
            </div>
          </div>

          {/* Confidence Rating */}
          <StarRating
            value={confidenceRating}
            onChange={setConfidenceRating}
            label="How confident were you in this prediction?"
          />

          {/* Value Rating */}
          <StarRating
            value={valueRating}
            onChange={setValueRating}
            label="How valuable was this prediction to your betting decision?"
          />

          {/* User Action */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">What did you do with this prediction?</Label>
            <RadioGroup value={userAction} onValueChange={(val) => setUserAction(val as UserAction)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="placed_bet" id="placed_bet" />
                <Label htmlFor="placed_bet" className="font-normal cursor-pointer">
                  Placed a bet based on it
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="saved_for_later" id="saved_for_later" />
                <Label htmlFor="saved_for_later" className="font-normal cursor-pointer">
                  Saved it for later consideration
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="skipped" id="skipped" />
                <Label htmlFor="skipped" className="font-normal cursor-pointer">
                  Skipped/Passed on it
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shared" id="shared" />
                <Label htmlFor="shared" className="font-normal cursor-pointer">
                  Shared it with others
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ignored" id="ignored" />
                <Label htmlFor="ignored" className="font-normal cursor-pointer">
                  Didn't pay attention to it
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Additional Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback" className="text-sm font-medium">
              Additional thoughts or suggestions (optional)
            </Label>
            <Textarea
              id="feedback"
              placeholder="What could make this prediction better? Any specific issues or concerns?"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[100px]"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submitFeedback}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : hasExistingFeedback ? "Update Feedback" : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
