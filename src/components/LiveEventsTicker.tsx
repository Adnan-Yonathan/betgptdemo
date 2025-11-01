import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveGame {
  id: string;
  game_id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  period: string;
  time_remaining: string;
  game_status: string;
}

export function LiveEventsTicker() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const fetchLiveGames = async () => {
    try {
      const { data, error } = await supabase
        .from('live_score_cache')
        .select('*')
        .eq('game_status', 'in_progress')
        .order('league', { ascending: true })
        .order('last_updated', { ascending: false });

      if (error) throw error;

      setLiveGames(data || []);
    } catch (error) {
      console.error('Error fetching live games:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGames();
    const interval = setInterval(fetchLiveGames, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Create ticker text
  const createTickerText = () => {
    if (liveGames.length === 0) {
      return "No live games at the moment • Check back soon for live sporting events";
    }

    return liveGames.map((game) => {
      const timeInfo = game.time_remaining ? ` ${game.time_remaining}` : '';
      const periodInfo = game.period ? ` ${game.period}` : '';
      return `${game.league}: ${game.away_team} ${game.away_score} @ ${game.home_team} ${game.home_score}${periodInfo}${timeInfo}`;
    }).join(' • ');
  };

  const tickerText = createTickerText();

  // Duplicate content for seamless loop
  const duplicatedText = `${tickerText} • ${tickerText}`;

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 py-2 px-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Loading live events...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 relative overflow-hidden">
      <div className="flex items-center">
        {/* Live indicator badge */}
        <div className="flex-shrink-0 bg-red-600 text-white px-3 py-2 flex items-center gap-2 z-10 border-r border-slate-700">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {liveGames.length > 0 ? `${liveGames.length} Live` : 'Live Events'}
          </span>
        </div>

        {/* Auto-scrolling ticker */}
        <div className="flex-1 overflow-hidden relative py-2">
          <div
            className={`ticker-content whitespace-nowrap ${isPaused ? 'paused' : ''}`}
            style={{
              display: 'inline-block',
              paddingLeft: '100%',
              animation: isPaused ? 'none' : `scroll ${Math.max(30, liveGames.length * 5)}s linear infinite`,
            }}
          >
            <span className="text-white text-sm font-medium">
              {duplicatedText}
            </span>
          </div>
        </div>

        {/* Pause/Play control */}
        <div className="flex-shrink-0 px-2 z-10 border-l border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
            title={isPaused ? "Resume ticker" : "Pause ticker"}
          >
            {isPaused ? (
              <Play className="w-4 h-4" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-50%, 0);
          }
        }

        .ticker-content.paused {
          animation-play-state: paused !important;
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
