import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Lightbulb, Info } from "lucide-react";

interface UserGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserGuide = ({ open, onOpenChange }: UserGuideProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Before You Start</DialogTitle>
          <DialogDescription>
            Essential information for using BetGPT effectively and responsibly
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mindset" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="mindset">Mindset</TabsTrigger>
            <TabsTrigger value="limitations">Limitations</TabsTrigger>
            <TabsTrigger value="howto">How To Use</TabsTrigger>
            <TabsTrigger value="practices">Best Practices</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="responsible">Responsible Betting</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4 pr-4">
            {/* Section 1: Essential Mindset */}
            <TabsContent value="mindset" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Read this section carefully before placing your first bet
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Core Principles
                  </h3>
                  <div className="space-y-3 ml-7">
                    <div>
                      <h4 className="font-medium">BetGPT is a tool, not a crystal ball</h4>
                      <p className="text-sm text-muted-foreground">
                        Provides data-driven analysis to inform YOUR decisions. You maintain full control and responsibility.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Long-term thinking required</h4>
                      <p className="text-sm text-muted-foreground">
                        Sports betting is a marathon, not a sprint. Short-term losses are normal even with +EV bets. Need 100+ bets to see statistical patterns emerge.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Bankroll management is non-negotiable</h4>
                      <p className="text-sm text-muted-foreground">
                        Only use money you can afford to lose completely. Never bet rent, bills, or emergency fund money. Set a betting bankroll separate from living expenses.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Prerequisites for Success
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Basic understanding of sports betting (odds, spreads, totals)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Dedicated bankroll (recommended: start with amount you could lose without stress)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Patience and discipline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Willingness to track and analyze your results</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Realistic expectations (no one wins every bet)</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">What Makes BetGPT Different</h3>
                  <ul className="space-y-2 ml-4 text-sm list-disc">
                    <li>Goes beyond simple picks - shows the math (EV, Kelly sizing)</li>
                    <li>Multi-sportsbook odds comparison</li>
                    <li>Transparent reasoning for every recommendation</li>
                    <li>Professional-grade tools (Kelly Criterion, CLV tracking)</li>
                    <li>Focus on education, not just picks</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Set Yourself Up for Success
                  </h3>
                  <ol className="space-y-2 ml-7 text-sm list-decimal">
                    <li>Read ALL sections of this guide (especially Limitations)</li>
                    <li>Set your risk tolerance in Settings honestly</li>
                    <li>Start with small bets while learning the system</li>
                    <li>Use the Kelly Calculator for every bet</li>
                    <li>Track your performance and adjust your approach</li>
                  </ol>
                </div>
              </div>
            </TabsContent>

            {/* Section 2: Understanding Limitations */}
            <TabsContent value="limitations" className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Critical: Understanding these limitations is essential before using BetGPT
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    AI Prediction Limitations
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>AI recommendations are probabilistic, not guarantees</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>Accuracy depends on data quality and availability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>Sports outcomes are inherently unpredictable</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>Past performance doesn't guarantee future results</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>Model predictions can be wrong - sports have surprises</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Data Limitations</h3>
                  <ul className="space-y-2 ml-4 text-sm list-disc">
                    <li>Injury reports may not be real-time</li>
                    <li>Weather forecasts can change</li>
                    <li>Line movements happen after analysis</li>
                    <li>Not all factors can be quantified (team chemistry, motivation, etc.)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Expected Value (EV) Caveats</h3>
                  <ul className="space-y-2 ml-4 text-sm list-disc">
                    <li>EV calculations assume accurate win probabilities</li>
                    <li>Overestimating your edge leads to losses</li>
                    <li>Small edges (&lt;2%) require high confidence in data</li>
                    <li>Short-term variance can deviate significantly from EV</li>
                    <li>Need large sample size to realize expected value</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    What BetGPT CANNOT Do
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Guarantee winning bets</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Predict injuries or last-minute lineup changes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Account for fixing/corruption/ref bias</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Replace your own research and judgment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Make you a professional bettor automatically</span>
                    </li>
                  </ul>
                </div>

                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-semibold">Responsible Betting Disclaimer</p>
                    <ul className="space-y-1 text-sm">
                      <li>⚠️ Betting involves real financial risk</li>
                      <li>⚠️ Only bet what you can afford to lose</li>
                      <li>⚠️ Gambling addiction is serious - resources provided in Responsible Betting tab</li>
                      <li>⚠️ This is entertainment, not an investment strategy</li>
                      <li>⚠️ Check your local laws - betting may be restricted/illegal</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* Section 3: How to Use BetGPT */}
            <TabsContent value="howto" className="space-y-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Chat Interface</h3>
                  <ul className="space-y-2 ml-4 text-sm list-disc">
                    <li>Ask questions about specific games or teams</li>
                    <li>Request comparisons ("Who should I bet on: Lakers or Celtics?")</li>
                    <li>Get explanations of betting concepts</li>
                    <li>Review your betting history</li>
                  </ul>
                  <Alert className="mt-3">
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Tips for asking good questions:</strong> Be specific, include context, mention the league/sport
                    </AlertDescription>
                  </Alert>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Games Dashboard</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <h4 className="font-medium">Reading Game Cards</h4>
                      <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                        <li><span className="font-medium text-green-600">Strong +EV (≥5%)</span>: Green badge - highest confidence</li>
                        <li><span className="font-medium text-green-600">+EV (≥2%)</span>: Green badge - good opportunity</li>
                        <li><span className="font-medium text-yellow-600">Slight Edge (≥0%)</span>: Secondary badge - marginal</li>
                        <li><span className="font-medium text-muted-foreground">No Edge</span>: Outline badge - avoid</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium">Filtering & Sorting</h4>
                      <p className="text-muted-foreground">Filter by sport (NFL, NBA, MLB, NHL, College Football) and date range. Sort by EV or game time to prioritize opportunities.</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Injury & Weather Reports</h4>
                      <p className="text-muted-foreground">Check situational factors displayed on each game card. Injuries and weather can significantly impact outcomes.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Odds Comparison</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    View odds from multiple sportsbooks side-by-side. Best odds and best EV opportunities are highlighted.
                  </p>
                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      Shopping for the best odds can increase your EV by 1-3%. Always compare before placing bets.
                    </AlertDescription>
                  </Alert>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Kelly Criterion Calculator</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>What is Kelly Criterion?</strong> A mathematical formula for optimal bet sizing based on your edge and bankroll.</p>
                    <div>
                      <p className="font-medium">How to use:</p>
                      <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                        <li>Enter your total bankroll</li>
                        <li>Input the odds (American format)</li>
                        <li>Set your estimated win probability</li>
                        <li>Use recommended fractional Kelly (0.25x default)</li>
                      </ol>
                    </div>
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Never use full Kelly - too aggressive. Start with 0.25x fractional Kelly for safety.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Performance Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor your betting history with key metrics:
                  </p>
                  <ul className="ml-4 text-sm list-disc space-y-1 mt-2">
                    <li><strong>Win Rate:</strong> Percentage of bets won</li>
                    <li><strong>ROI:</strong> Return on Investment (total return / total wagered)</li>
                    <li><strong>CLV:</strong> Closing Line Value (did you beat the closing line?)</li>
                    <li><strong>Sharpe Ratio:</strong> Risk-adjusted returns</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Section 4: Best Practices */}
            <TabsContent value="practices" className="space-y-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Getting the Best Results
                  </h3>
                  <ol className="space-y-3 ml-7 text-sm list-decimal">
                    <li><strong>Cross-reference multiple sources</strong> - Don't rely solely on BetGPT</li>
                    <li><strong>Check timing</strong> - Verify injury reports and lineups before bet placement</li>
                    <li><strong>Use appropriate Kelly fraction</strong> - Start with 0.25x, never full Kelly</li>
                    <li><strong>Focus on +EV opportunities</strong> - Avoid negative or zero EV bets</li>
                    <li><strong>Track your performance</strong> - Use analytics to learn from results</li>
                    <li><strong>Set bankroll limits</strong> - Never exceed your preset betting budget</li>
                    <li><strong>Update probabilities</strong> - As new information emerges, reassess</li>
                  </ol>
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Optimal Timing:</strong> Responses are most accurate near game time. For best results, ask for analysis approximately 60 minutes before game time when line shifts, late injuries, and EV values have stabilized.
                    </AlertDescription>
                  </Alert>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    When to Trust Recommendations More
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Higher EV (≥5%) indicates stronger edge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Multiple factors align (injuries, rest, weather)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Significant odds discrepancy across books</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>AI reasoning is detailed and specific</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    When to Be Cautious
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>Small edges (&lt;2%) - variance can overwhelm edge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>Late-breaking news not reflected in data</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>Unusual line movements (may indicate insider info)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>Your own analysis contradicts AI recommendation</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Common Mistakes to Avoid
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Chasing losses with bigger bets</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Ignoring bankroll management</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Betting on every game (be selective)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Overestimating your edge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Emotional betting (favorites, homer bias)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>Ignoring closing line value (CLV)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Section 5: Features Explained */}
            <TabsContent value="features" className="space-y-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Expected Value (EV)</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Definition:</strong> Average expected return per dollar wagered over the long term.</p>
                    <p><strong>Formula:</strong> (Win Probability × Decimal Odds) - 1</p>
                    <p><strong>Interpretation:</strong> Positive EV = profitable long-term, Negative EV = losing long-term</p>
                    <div className="bg-muted p-3 rounded-md mt-2">
                      <p className="font-medium mb-1">Example:</p>
                      <p className="text-muted-foreground">
                        You estimate 55% win probability on +100 odds (2.0 decimal).<br/>
                        EV = (0.55 × 2.0) - 1 = 0.10 = <span className="text-green-600 font-semibold">+10% EV</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Kelly Criterion</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Definition:</strong> Mathematical formula for optimal bet sizing based on edge and bankroll.</p>
                    <p><strong>Formula:</strong> (bp - q) / b where b=decimal odds-1, p=win probability, q=loss probability</p>
                    <p><strong>Why fractional Kelly?</strong> Full Kelly is too aggressive. Fractional (0.25x-0.5x) reduces volatility.</p>
                    <div className="bg-muted p-3 rounded-md mt-2">
                      <p className="font-medium mb-1">Example:</p>
                      <p className="text-muted-foreground">
                        Bankroll: $1,000 | Odds: +100 | Win Prob: 55%<br/>
                        Full Kelly: 10% ($100 bet)<br/>
                        0.25 Fractional Kelly: 2.5% ($25 bet) ← <span className="text-green-600 font-semibold">Recommended</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Closing Line Value (CLV)</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>What it is:</strong> Difference between odds when you placed the bet vs. closing odds.</p>
                    <p><strong>Why it matters:</strong> Beating the closing line consistently indicates sharp betting and correlates with long-term profitability.</p>
                    <p><strong>Good CLV:</strong> Consistently positive CLV (1-3%+) shows you're betting at better odds than the market settles on.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Sharpe Ratio</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Definition:</strong> Risk-adjusted return metric. Measures return per unit of volatility.</p>
                    <p><strong>Formula:</strong> (Average Return - Risk-Free Rate) / Standard Deviation of Returns</p>
                    <p><strong>Interpretation:</strong> Higher is better. Sharpe &gt; 1.0 is good, &gt; 2.0 is excellent.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Key Metrics Glossary</h3>
                  <div className="space-y-2 text-sm">
                    <ul className="space-y-2 ml-4 list-disc">
                      <li><strong>ROI (Return on Investment):</strong> Total profit / Total wagered × 100%</li>
                      <li><strong>Vig/Juice:</strong> Bookmaker commission built into odds</li>
                      <li><strong>Implied Probability:</strong> Probability suggested by betting odds</li>
                      <li><strong>American Odds:</strong> +150 (bet $100 to win $150) or -150 (bet $150 to win $100)</li>
                      <li><strong>Decimal Odds:</strong> Total payout including stake (2.5 = win $2.50 per $1 wagered)</li>
                      <li><strong>Moneyline:</strong> Straight bet on who wins</li>
                      <li><strong>Spread:</strong> Point handicap (Lakers -5.5 means they must win by 6+)</li>
                      <li><strong>Totals (Over/Under):</strong> Combined score of both teams</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Section 6: Responsible Betting */}
            <TabsContent value="responsible" className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  If you or someone you know has a gambling problem, help is available. Please read this section carefully.
                </AlertDescription>
              </Alert>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Warning Signs of Problem Gambling
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Betting more than you can afford to lose</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Chasing losses repeatedly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Hiding betting activity from family/friends</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Neglecting work, school, or personal responsibilities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Borrowing money to bet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠</span>
                      <span>Feeling anxious, irritable, or depressed about betting</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Responsible Betting Tips
                  </h3>
                  <ul className="space-y-2 ml-7 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Set strict budget and time limits BEFORE you start</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Never bet under the influence of alcohol or drugs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Take regular breaks - don't bet every day</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Keep betting separate from income/savings accounts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Don't bet to solve financial problems - it makes them worse</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>Treat betting as entertainment, not income</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-muted p-4 rounded-md">
                  <h3 className="text-lg font-semibold mb-3">Resources & Help</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium">National Council on Problem Gambling</p>
                      <p className="text-muted-foreground">24/7 Helpline: <a href="tel:1-800-522-4700" className="text-blue-600 hover:underline">1-800-522-4700</a></p>
                      <p className="text-muted-foreground">Text: <span className="font-mono">800GAM</span></p>
                    </div>
                    <div>
                      <p className="font-medium">Gamblers Anonymous</p>
                      <p className="text-muted-foreground">Website: <a href="https://www.gamblersanonymous.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.gamblersanonymous.org</a></p>
                      <p className="text-muted-foreground">Find local meetings and support groups</p>
                    </div>
                    <div>
                      <p className="font-medium">Self-Exclusion Programs</p>
                      <p className="text-muted-foreground">Most states offer voluntary self-exclusion from gambling sites. Contact your state gaming authority.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Legal Disclaimer</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Users are responsible for knowing and complying with their local gambling laws and regulations.</p>
                    <p>Online sports betting may be restricted or illegal in some jurisdictions. Age restrictions apply (21+ in most US states).</p>
                    <p>BetGPT provides analysis tools only and is not liable for any betting losses, legal issues, or addiction-related problems.</p>
                    <p>This platform is for informational and entertainment purposes only - not professional financial advice.</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
