import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Bet {
  id: string;
  amount: number;
  odds: number;
  description: string;
  outcome: string;
}

interface BetEditDialogProps {
  bet: Bet;
  onUpdate: () => void;
}

interface BetDeleteDialogProps {
  bet: Bet;
  onDelete: () => void;
}

/**
 * Bet Edit Dialog Component
 * Allows editing pending bets
 * Implements PRD Section 3.4: Bet Detail View (Edit)
 */
export const BetEditDialog = ({ bet, onUpdate }: BetEditDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState(bet.amount.toString());
  const [odds, setOdds] = useState(bet.odds.toString());
  const [description, setDescription] = useState(bet.description);

  const handleUpdate = async () => {
    const amountNum = Number(amount);
    const oddsNum = Number(odds);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid bet amount",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(oddsNum)) {
      toast({
        title: "Invalid odds",
        description: "Please enter valid odds (e.g., -110, +150)",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a bet description",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Recalculate potential return
      let potentialReturn = 0;
      if (oddsNum > 0) {
        potentialReturn = amountNum + (amountNum * oddsNum / 100);
      } else {
        potentialReturn = amountNum + (amountNum * 100 / Math.abs(oddsNum));
      }

      const { error } = await supabase
        .from("bets")
        .update({
          amount: amountNum,
          odds: oddsNum,
          description: description.trim(),
          potential_return: potentialReturn,
        })
        .eq("id", bet.id);

      if (error) throw error;

      toast({
        title: "Bet updated",
        description: "Your bet has been updated successfully",
      });

      setOpen(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating bet:", error);
      toast({
        title: "Error",
        description: "Failed to update bet",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Only allow editing if bet is pending
  if (bet.outcome !== "pending") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Bet</DialogTitle>
          <DialogDescription className="text-sm">
            Update bet details. Only pending bets can be edited.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Titans +14.5 vs Colts"
              rows={3}
              className="text-sm sm:text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount" className="text-sm">Amount ($)</Label>
              <Input
                id="edit-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="h-10 sm:h-9 text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-odds" className="text-sm">Odds</Label>
              <Input
                id="edit-odds"
                type="number"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="-110"
                className="h-10 sm:h-9 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={() => setOpen(false)} variant="outline" className="h-10 sm:h-9">
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading} className="h-10 sm:h-9">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Bet Delete Dialog Component
 * Allows deleting bets with confirmation
 * Implements PRD Section 3.4: Bet Detail View (Delete)
 */
export const BetDeleteDialog = ({ bet, onDelete }: BetDeleteDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("bets")
        .delete()
        .eq("id", bet.id);

      if (error) throw error;

      toast({
        title: "Bet deleted",
        description: "Your bet has been removed",
      });

      onDelete();
    } catch (error) {
      console.error("Error deleting bet:", error);
      toast({
        title: "Error",
        description: "Failed to delete bet",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[95vw] sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg sm:text-xl">Delete Bet?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            This action cannot be undone. This will permanently delete your bet:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="p-3 sm:p-4 rounded-lg bg-muted">
          <p className="font-medium text-sm sm:text-base">{bet.description}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            ${bet.amount.toFixed(2)} at {bet.odds > 0 ? "+" : ""}{bet.odds}
          </p>
        </div>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="h-10 sm:h-9">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 sm:h-9"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Bet"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * Combined Bet Actions Component
 * Provides both edit and delete actions in a single component
 */
interface BetActionsProps {
  bet: Bet;
  onUpdate: () => void;
}

export const BetActions = ({ bet, onUpdate }: BetActionsProps) => {
  return (
    <div className="flex items-center gap-2">
      <BetEditDialog bet={bet} onUpdate={onUpdate} />
      <BetDeleteDialog bet={bet} onDelete={onUpdate} />
    </div>
  );
};
