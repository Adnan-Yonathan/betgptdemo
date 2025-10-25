import { useEffect, useState, useRef } from 'react';
import { getTodaysGames } from '@/utils/balldontlieApi';
import type { BallDontLieGame } from '@/types/balldontlie';
import { useBetTracking } from '@/contexts/BetTrackingContext';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GameScore {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  period: number;
  time: string;
  isTracked: boolean;
}

export function LiveScoresTerminal() {
  const [games, setGames] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { trackedBets } = useBetTracking();

  // Fetch live games
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const todaysGames = await getTodaysGames();
        const formattedGames: GameScore[] = todaysGames.map((game: BallDontLieGame) => {
          const isTracked = trackedBets.some(
            bet =>
              bet.homeTeam.toLowerCase().includes(game.home_team.abbreviation.toLowerCase()) ||
              bet.awayTeam.toLowerCase().includes(game.visitor_team.abbreviation.toLowerCase()) ||
              game.home_team.full_name.toLowerCase().includes(bet.team.toLowerCase()) ||
              game.visitor_team.full_name.toLowerCase().includes(bet.team.toLowerCase())
          );

          return {
            id: game.id,
            homeTeam: game.home_team.abbreviation,
            awayTeam: game.visitor_team.abbreviation,
            homeScore: game.home_team_score || 0,
            awayScore: game.visitor_team_score || 0,
            status: game.status,
            period: game.period || 0,
            time: game.time || '',
            isTracked,
          };
        });

        setGames(formattedGames);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching games:', error);
        setLoading(false);
      }
    };

    fetchGames();
    // Refresh every 30 seconds
    const interval = setInterval(fetchGames, 30000);

    return () => clearInterval(interval);
  }, [trackedBets]);

  // Auto-scroll effect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || games.length === 0) return;

    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    if (scrollWidth <= clientWidth) return; // No need to scroll if content fits

    const scrollInterval = setInterval(() => {
      setScrollPosition(prev => {
        const next = prev + 1;
        // Reset to start when we've scrolled past the original content
        if (next >= scrollWidth / 2) {
          return 0;
        }
        return next;
      });
    }, 50); // Adjust speed here (lower = faster)

    return () => clearInterval(scrollInterval);
  }, [games]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollLeft = scrollPosition;
    }
  }, [scrollPosition]);

  const getScoreIndicator = (homeScore: number, awayScore: number, isHome: boolean) => {
    if (homeScore === 0 && awayScore === 0) return <Minus className="w-3 h-3 text-muted-foreground" />;
    if (isHome) {
      if (homeScore > awayScore) return <TrendingUp className="w-3 h-3 text-green-500" />;
      if (homeScore < awayScore) return <TrendingDown className="w-3 h-3 text-red-500" />;
    } else {
      if (awayScore > homeScore) return <TrendingUp className="w-3 h-3 text-green-500" />;
      if (awayScore < homeScore) return <TrendingDown className="w-3 h-3 text-red-500" />;
    }
    return <Minus className="w-3 h-3 text-yellow-500" />;
  };

  const getStatusDisplay = (status: string, period: number, time: string) => {
    if (status === 'Final') return 'FINAL';
    if (status === 'In Progress') return `Q${period} ${time}`;
    if (status === 'Scheduled') return 'UPCOMING';
    return status.toUpperCase();
  };

  if (loading) {
    return (
      <div className="bg-black/95 border-b border-green-500/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-500 text-xs font-mono">LOADING LIVE SCORES...</span>
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-black/95 border-b border-green-500/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-yellow-500 text-xs font-mono">NO GAMES TODAY</span>
        </div>
      </div>
    );
  }

  // Duplicate games for seamless scrolling
  const displayGames = [...games, ...games];

  return (
    <div className="bg-black/95 border-b border-green-500/30 overflow-hidden">
      <div className="px-4 py-1.5 flex items-center gap-3 border-b border-green-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-500 text-xs font-mono font-bold">LIVE SCORES</span>
        </div>
        <div className="text-green-500/60 text-xs font-mono">|</div>
        <div className="text-green-500/60 text-xs font-mono">
          {games.filter(g => g.status === 'In Progress').length} LIVE
        </div>
        {trackedBets.length > 0 && (
          <>
            <div className="text-green-500/60 text-xs font-mono">|</div>
            <div className="text-yellow-500 text-xs font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
              {trackedBets.length} TRACKED
            </div>
          </>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="overflow-hidden whitespace-nowrap py-2"
        style={{ scrollBehavior: 'auto' }}
      >
        <div className="inline-flex gap-6 px-4">
          {displayGames.map((game, index) => (
            <div
              key={`${game.id}-${index}`}
              className={cn(
                "inline-flex items-center gap-3 px-4 py-1.5 rounded border font-mono text-xs transition-all",
                game.isTracked
                  ? "bg-yellow-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/20"
                  : "bg-green-500/5 border-green-500/20"
              )}
            >
              {/* Away Team */}
              <div className="flex items-center gap-2 min-w-[80px]">
                <span className={cn(
                  "font-bold",
                  game.awayScore > game.homeScore ? "text-green-400" : "text-green-500/70"
                )}>
                  {game.awayTeam}
                </span>
                <span className={cn(
                  "tabular-nums font-bold",
                  game.awayScore > game.homeScore ? "text-green-400" : "text-green-500/70"
                )}>
                  {game.awayScore}
                </span>
                {getScoreIndicator(game.homeScore, game.awayScore, false)}
              </div>

              <div className="text-green-500/50">@</div>

              {/* Home Team */}
              <div className="flex items-center gap-2 min-w-[80px]">
                <span className={cn(
                  "font-bold",
                  game.homeScore > game.awayScore ? "text-green-400" : "text-green-500/70"
                )}>
                  {game.homeTeam}
                </span>
                <span className={cn(
                  "tabular-nums font-bold",
                  game.homeScore > game.awayScore ? "text-green-400" : "text-green-500/70"
                )}>
                  {game.homeScore}
                </span>
                {getScoreIndicator(game.homeScore, game.awayScore, true)}
              </div>

              {/* Status */}
              <div className={cn(
                "text-xs px-2 py-0.5 rounded font-bold",
                game.status === 'In Progress' && "bg-red-500/20 text-red-400 animate-pulse",
                game.status === 'Final' && "bg-green-500/20 text-green-400",
                game.status === 'Scheduled' && "bg-blue-500/20 text-blue-400"
              )}>
                {getStatusDisplay(game.status, game.period, game.time)}
              </div>

              {game.isTracked && (
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
