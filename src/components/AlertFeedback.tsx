import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThumbsUp, ThumbsDown, Clock, Target, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface AlertFeedbackProps {
  notificationId: string;
  alertType?: string;
  priorityLevel?: string;
  compact?: boolean;
}

type UserAction = "acted_on" | "investigated" | "dismissed" | "snoozed" | "disabled_alert_type" | "ignored";

/**
 * AlertFeedback Component
 * Allows users to provide feedback on alerts/notifications
 * Tracks usefulness, timeliness, accuracy, and user actions
 */
export const AlertFeedback = ({
  notificationId,
  alertType,
  priorityLevel,
  compact = false
}: AlertFeedbackProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasExistingFeedback, setHasExistingFeedback] = useState(false);

  // Quick feedback state
  const [quickFeedback, setQuickFeedback] = useState<boolean | null>(null);

  // Detailed feedback form state
  const [wasUseful, setWasUseful] = useState<boolean | null>(null);
  const [wasTimely, setWasTimely] = useState<boolean | null>(null);
  const [wasAccurate, setWasAccurate] = useState<boolean | null>(null);
  const [relevanceRating, setRelevanceRating] = useState<number>(3);
  const [userAction, setUserAction] = useState<UserAction>("investigated");
  const [falsePositive, setFalsePositive] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  // Check if user has already provided feedback
  useEffect(() => {
    if (user && notificationId) {
      checkExistingFeedback();
    }
  }, [user, notificationId]);

  const checkExistingFeedback = async () => {
    if (!user || !notificationId) return;

    try {
      const { data, error } = await supabase
        .from("alert_feedback")
        .select("*")
        .eq("user_id", user.id)
        .eq("notification_id", notificationId)
        .maybeSingle();

      if (error) {
        console.error("Error checking existing feedback:", error);
        return;
      }

      if (data) {
        setHasExistingFeedback(true);
        setQuickFeedback(data.was_useful);
        setWasUseful(data.was_useful);
        setWasTimely(data.was_timely);
        setWasAccurate(data.was_accurate);
        setRelevanceRating(data.relevance_rating || 3);
        setUserAction(data.user_action as UserAction);
        setFalsePositive(data.false_positive || false);
        setFeedbackText(data.feedback_text || "");
      }
    } catch (error) {
      console.error("Error checking feedback:", error);
    }
  };

  const submitQuickFeedback = async (useful: boolean) => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);
    setQuickFeedback(useful);

    try {
      const feedbackData = {
        user_id: user.id,
        notification_id: notificationId,
        alert_type: alertType || null,
        priority_level: priorityLevel || null,
        was_useful: useful,
        was_timely: null,
        was_accurate: null,
        relevance_rating: null,
        user_action: useful ? "investigated" : "dismissed",
        false_positive: !useful,
        feedback_text: null,
        led_to_bet: false,
        bet_id: null,
        was_profitable: null,
        time_to_action_seconds: null
      };

      if (hasExistingFeedback) {
        const { error } = await supabase
          .from("alert_feedback")
          .update({
            was_useful: useful,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id)
          .eq("notification_id", notificationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("alert_feedback")
          .insert(feedbackData);

        if (error) throw error;
        setHasExistingFeedback(true);
      }

      toast.success("Thanks for your feedback!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDetailedFeedback = async () => {
    if (!user) {
      toast.error("Please sign in to provide feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData = {
        user_id: user.id,
        notification_id: notificationId,
        alert_type: alertType || null,
        priority_level: priorityLevel || null,
        was_useful: wasUseful,
        was_timely: wasTimely,
        was_accurate: wasAccurate,
        relevance_rating: relevanceRating,
        user_action: userAction,
        false_positive: falsePositive,
        feedback_text: feedbackText || null,
        led_to_bet: userAction === "acted_on",
        bet_id: null,
        was_profitable: null,
        time_to_action_seconds: null
      };

      if (hasExistingFeedback) {
        const { error } = await supabase
          .from("alert_feedback")
          .update({
            ...feedbackData,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id)
          .eq("notification_id", notificationId);

        if (error) throw error;
        toast.success("Feedback updated!");
      } else {
        const { error } = await supabase
          .from("alert_feedback")
          .insert(feedbackData);

        if (error) throw error;
        toast.success("Thank you for your detailed feedback!");
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

  if (compact) {
    // Compact mode: Just thumbs up/down
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => submitQuickFeedback(true)}
          disabled={isSubmitting}
          className={cn(
            "h-6 w-6 p-0",
            quickFeedback === true && "text-green-600"
          )}
          title="Useful alert"
        >
          <ThumbsUp className={cn(
            "h-3 w-3",
            quickFeedback === true && "fill-current"
          )} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => submitQuickFeedback(false)}
          disabled={isSubmitting}
          className={cn(
            "h-6 w-6 p-0",
            quickFeedback === false && "text-red-600"
          )}
          title="Not useful"
        >
          <ThumbsDown className={cn(
            "h-3 w-3",
            quickFeedback === false && "fill-current"
          )} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Quick Feedback Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => submitQuickFeedback(true)}
          disabled={isSubmitting}
          className={cn(
            "h-8 px-3 gap-2",
            quickFeedback === true && "bg-green-500/20 text-green-600"
          )}
        >
          <ThumbsUp className={cn(
            "h-4 w-4",
            quickFeedback === true && "fill-current"
          )} />
          Useful
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => submitQuickFeedback(false)}
          disabled={isSubmitting}
          className={cn(
            "h-8 px-3 gap-2",
            quickFeedback === false && "bg-red-500/20 text-red-600"
          )}
        >
          <ThumbsDown className={cn(
            "h-4 w-4",
            quickFeedback === false && "fill-current"
          )} />
          Not Useful
        </Button>
      </div>

      {/* Detailed Feedback Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            More Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-1">Alert Feedback</h4>
              <p className="text-xs text-muted-foreground">
                Help us improve alert quality and relevance
              </p>
            </div>

            {/* Useful */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Was this alert useful?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={wasUseful === true ? "default" : "outline"}
                  onClick={() => setWasUseful(true)}
                >
                  <ThumbsUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={wasUseful === false ? "default" : "outline"}
                  onClick={() => setWasUseful(false)}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Timely */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Was it timely?
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={wasTimely === true ? "default" : "outline"}
                  onClick={() => setWasTimely(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={wasTimely === false ? "default" : "outline"}
                  onClick={() => setWasTimely(false)}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Accurate */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                Was it accurate?
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={wasAccurate === true ? "default" : "outline"}
                  onClick={() => setWasAccurate(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={wasAccurate === false ? "default" : "outline"}
                  onClick={() => setWasAccurate(false)}
                >
                  No
                </Button>
              </div>
            </div>

            {/* Relevance Rating */}
            <div className="space-y-2">
              <Label className="text-sm">Relevance (1-5)</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    size="sm"
                    variant={relevanceRating === rating ? "default" : "outline"}
                    onClick={() => setRelevanceRating(rating)}
                    className="w-8"
                  >
                    {rating}
                  </Button>
                ))}
              </div>
            </div>

            {/* User Action */}
            <div className="space-y-2">
              <Label className="text-sm">What did you do?</Label>
              <RadioGroup value={userAction} onValueChange={(val) => setUserAction(val as UserAction)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="acted_on" id="acted_on" />
                  <Label htmlFor="acted_on" className="text-xs font-normal cursor-pointer">
                    Acted on it (placed bet)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="investigated" id="investigated" />
                  <Label htmlFor="investigated" className="text-xs font-normal cursor-pointer">
                    Investigated further
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dismissed" id="dismissed" />
                  <Label htmlFor="dismissed" className="text-xs font-normal cursor-pointer">
                    Dismissed it
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ignored" id="ignored" />
                  <Label htmlFor="ignored" className="text-xs font-normal cursor-pointer">
                    Ignored it
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* False Positive */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="false_positive"
                checked={falsePositive}
                onCheckedChange={(checked) => setFalsePositive(checked as boolean)}
              />
              <Label htmlFor="false_positive" className="text-xs font-normal cursor-pointer flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                This was a false alert
              </Label>
            </div>

            {/* Additional Feedback */}
            <Textarea
              placeholder="Additional comments..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="min-h-[60px] text-sm"
              disabled={isSubmitting}
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={submitDetailedFeedback}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
