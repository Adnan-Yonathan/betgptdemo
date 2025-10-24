import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calculator, TrendingUp } from 'lucide-react';

export function KellyCalculator() {
  const [bankroll, setBankroll] = useState<number>(1000);
  const [winProbability, setWinProbability] = useState<number>(55);
  const [odds, setOdds] = useState<number>(-110);
  const [kellyMultiplier, setKellyMultiplier] = useState<number>(0.25);

  // Calculate Kelly Criterion
  function calculateKelly(): {
    kellyPercentage: number;
    recommendedStake: number;
    fullKellyStake: number;
    expectedValue: number;
    impliedProbability: number;
    edge: number;
  } {
    // Convert American odds to decimal
    const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;

    // Implied probability from odds (removing vig approximately)
    const impliedProbability = 1 / decimalOdds;

    // Win probability as decimal
    const p = winProbability / 100;

    // Calculate edge
    const edge = p - impliedProbability;

    // Kelly formula: (bp - q) / b
    // where b = decimal_odds - 1, p = win_prob, q = 1 - p
    const b = decimalOdds - 1;
    const q = 1 - p;
    const kellyPercentage = ((b * p) - q) / b;

    // Apply fractional Kelly
    const fractionalKellyPercentage = Math.max(0, kellyPercentage * kellyMultiplier);

    // Calculate stakes
    const fullKellyStake = Math.max(0, bankroll * kellyPercentage);
    const recommendedStake = Math.max(0, bankroll * fractionalKellyPercentage);

    // Calculate EV
    const profitIfWin = recommendedStake * b;
    const expectedValue = (p * profitIfWin) - (q * recommendedStake);

    return {
      kellyPercentage: kellyPercentage * 100,
      recommendedStake,
      fullKellyStake,
      expectedValue,
      impliedProbability: impliedProbability * 100,
      edge: edge * 100,
    };
  }

  const results = calculateKelly();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Kelly Criterion Calculator
        </CardTitle>
        <CardDescription>
          Calculate optimal bet sizing based on your edge and bankroll management strategy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bankroll">Bankroll ($)</Label>
            <Input
              id="bankroll"
              type="number"
              value={bankroll}
              onChange={(e) => setBankroll(Number(e.target.value))}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odds">Odds (American)</Label>
            <Input
              id="odds"
              type="number"
              value={odds}
              onChange={(e) => setOdds(Number(e.target.value))}
              placeholder="-110"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="winProb">
            Win Probability: {winProbability}%
          </Label>
          <Slider
            id="winProb"
            min={0}
            max={100}
            step={1}
            value={[winProbability]}
            onValueChange={(value) => setWinProbability(value[0])}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kellyFrac">
            Kelly Fraction: {kellyMultiplier}x
          </Label>
          <Slider
            id="kellyFrac"
            min={0}
            max={1}
            step={0.05}
            value={[kellyMultiplier]}
            onValueChange={(value) => setKellyMultiplier(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            0.25x (Quarter Kelly) is recommended for risk management
          </p>
        </div>

        {/* Results */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recommended Bet Size
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Recommended Stake</p>
              <p className="text-2xl font-bold text-green-600">
                ${results.recommendedStake.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {((results.recommendedStake / bankroll) * 100).toFixed(2)}% of bankroll
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Expected Value</p>
              <p className={`text-2xl font-bold ${results.expectedValue > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${results.expectedValue.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {((results.expectedValue / results.recommendedStake) * 100).toFixed(2)}% EV
              </p>
            </div>
          </div>

          {/* Statistical Analysis */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium text-sm">Statistical Analysis</h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Your Win Probability</p>
                <p className="font-medium">{winProbability.toFixed(1)}%</p>
              </div>

              <div>
                <p className="text-muted-foreground">Market Implied Prob</p>
                <p className="font-medium">{results.impliedProbability.toFixed(1)}%</p>
              </div>

              <div>
                <p className="text-muted-foreground">Your Edge</p>
                <p className={`font-medium ${results.edge > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {results.edge > 0 ? '+' : ''}{results.edge.toFixed(2)}%
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Full Kelly</p>
                <p className="font-medium">${results.fullKellyStake.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {results.edge <= 0 && (
            <div className="flex gap-2 p-3 border border-red-200 bg-red-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-900">No Edge Detected</p>
                <p className="text-red-700">
                  This bet has negative expected value. Kelly Criterion recommends not betting.
                </p>
              </div>
            </div>
          )}

          {results.recommendedStake > bankroll * 0.05 && (
            <div className="flex gap-2 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-900">High Stake Warning</p>
                <p className="text-yellow-700">
                  Recommended stake is {((results.recommendedStake / bankroll) * 100).toFixed(1)}% of bankroll.
                  Consider reducing Kelly multiplier for more conservative betting.
                </p>
              </div>
            </div>
          )}

          {results.edge > 0 && results.edge < 2 && (
            <div className="flex gap-2 p-3 border border-blue-200 bg-blue-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">Small Edge</p>
                <p className="text-blue-700">
                  Your edge is only {results.edge.toFixed(2)}%. Make sure your probability estimate is accurate.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-2">About Kelly Criterion:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Optimal bet sizing formula for long-term bankroll growth</li>
            <li>Full Kelly can be aggressive - fractional Kelly (0.25x-0.5x) reduces variance</li>
            <li>Only bet when you have a positive edge (your probability {'>'} implied probability)</li>
            <li>Assumes accurate probability estimates - overestimating leads to overbetting</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
