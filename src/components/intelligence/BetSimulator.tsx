import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export function BetSimulator() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Bet Simulator
        </CardTitle>
        <CardDescription>Simulate bet outcomes before placing</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Test different betting strategies with our simulator before risking real money.
        </p>
        <Button variant="outline" className="w-full" disabled>
          Coming Soon
        </Button>
      </CardContent>
    </Card>
  );
}
