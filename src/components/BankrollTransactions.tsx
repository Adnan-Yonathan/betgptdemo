import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Loader2, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Transaction {
  id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "bet" | "win" | "loss" | "refund";
  amount: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

/**
 * Bankroll Transactions Component
 * Allows users to log deposits and withdrawals
 * Displays transaction history
 * Implements PRD Section 4.2: Bankroll Management (Deposits & Withdrawals)
 */
export const BankrollTransactions = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentBankroll, setCurrentBankroll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load current bankroll
      const { data: bankrollData } = await supabase
        .from("user_bankroll")
        .select("current_amount")
        .eq("user_id", user.id)
        .single();

      if (bankrollData) {
        setCurrentBankroll(bankrollData.current_amount);
      }

      // Load transactions
      const { data: transactionsData, error } = await supabase
        .from("bankroll_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setTransactions((transactionsData || []) as Transaction[]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load transaction history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitTransaction = async () => {
    if (!user || !amount) return;

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Check if withdrawal exceeds current bankroll
    if (transactionType === "withdrawal" && amountNum > currentBankroll) {
      toast({
        title: "Insufficient funds",
        description: "Withdrawal amount exceeds current bankroll",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      // Calculate new bankroll
      const newBankroll =
        transactionType === "deposit"
          ? currentBankroll + amountNum
          : currentBankroll - amountNum;

      // Insert transaction
      const { error: txError } = await supabase
        .from("bankroll_transactions")
        .insert({
          user_id: user.id,
          type: transactionType,
          amount: amountNum,
          balance_after: newBankroll,
          notes: notes || null,
        });

      if (txError) throw txError;

      // Update user_bankroll
      const { error: bankrollError } = await supabase
        .from("user_bankroll")
        .upsert({
          user_id: user.id,
          current_amount: newBankroll,
          updated_at: new Date().toISOString(),
        });

      if (bankrollError) throw bankrollError;

      toast({
        title: "Success",
        description: `${transactionType === "deposit" ? "Deposit" : "Withdrawal"} of $${amountNum.toFixed(2)} recorded`,
      });

      // Reset form
      setAmount("");
      setNotes("");
      setDialogOpen(false);

      // Reload data
      loadData();
    } catch (error) {
      console.error("Error submitting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to record transaction",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const deposits = transactions.filter((t) => t.type === "deposit");
  const withdrawals = transactions.filter((t) => t.type === "withdrawal");
  const totalDeposited = deposits.reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawn = withdrawals.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Bankroll Transactions</h2>
            <p className="text-sm text-muted-foreground">
              Track deposits and withdrawals
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
              <DialogDescription>
                Log a deposit or withdrawal to update your bankroll
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type</Label>
                <Select
                  value={transactionType}
                  onValueChange={(value: "deposit" | "withdrawal") =>
                    setTransactionType(value)
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Monthly deposit, Won parlay, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {transactionType === "withdrawal" && amount && Number(amount) > currentBankroll && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Warning: Withdrawal amount exceeds current bankroll (${currentBankroll.toFixed(2)})
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => setDialogOpen(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={submitTransaction} disabled={submitting || !amount}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Add {transactionType}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Deposited</p>
                <p className="text-2xl font-bold">${totalDeposited.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {deposits.length} deposit{deposits.length !== 1 ? "s" : ""}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Withdrawn</p>
                <p className="text-2xl font-bold">${totalWithdrawn.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {withdrawals.length} withdrawal{withdrawals.length !== 1 ? "s" : ""}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Net Flow</p>
                <p className={`text-2xl font-bold ${totalDeposited - totalWithdrawn >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {totalDeposited - totalWithdrawn >= 0 ? "+" : ""}${(totalDeposited - totalWithdrawn).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {transactions.length} total transaction{transactions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            All deposits and withdrawals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({transactions.length})</TabsTrigger>
              <TabsTrigger value="deposits">Deposits ({deposits.length})</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ScrollArea className="h-[400px] pr-4">
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {tx.type === "deposit" ? (
                            <div className="p-2 rounded-full bg-blue-500/10">
                              <TrendingUp className="w-4 h-4 text-blue-500" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-full bg-orange-500/10">
                              <TrendingDown className="w-4 h-4 text-orange-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium capitalize">{tx.type}</p>
                            {tx.notes && (
                              <p className="text-sm text-muted-foreground">{tx.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${tx.type === "deposit" ? "text-blue-500" : "text-orange-500"}`}>
                            {tx.type === "deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: ${tx.balance_after.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="deposits">
              <ScrollArea className="h-[400px] pr-4">
                {deposits.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No deposits yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deposits.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-500/10">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium">Deposit</p>
                            {tx.notes && (
                              <p className="text-sm text-muted-foreground">{tx.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-500">
                            +${tx.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: ${tx.balance_after.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="withdrawals">
              <ScrollArea className="h-[400px] pr-4">
                {withdrawals.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No withdrawals yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-orange-500/10">
                            <TrendingDown className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium">Withdrawal</p>
                            {tx.notes && (
                              <p className="text-sm text-muted-foreground">{tx.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-500">
                            -${tx.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: ${tx.balance_after.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
