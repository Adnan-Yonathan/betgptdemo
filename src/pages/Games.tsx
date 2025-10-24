import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GameCard } from "@/components/GameCard";
import { FilterPanel, GameFilters } from "@/components/FilterPanel";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Home, BarChart3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GameData {
  event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_status: string;
  home_score?: number;
  away_score?: number;
  odds: any[];
  injuries?: any[];
  weather?: any;
  ai_recommendation?: {
    pick: string;
    confidence: number;
    edge: number;
    reasoning: string[];
  };
  schedule_factors?: {
    home_rest_days: number;
    away_rest_days: number;
  };
}

const Games = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameData[]>([]);
  const [filteredGames, setFilteredGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [filters, setFilters] = useState<GameFilters>({
    sport: "all",
    dateRange: "today",
    betType: "all",
    minEdge: 0,
    minConfidence: 0,
    sortBy: "edge_desc"
  });

  useEffect(() => {
    if (user) {
      fetchGames();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [games, filters]);

  const fetchGames = async () => {
    try {
      setIsLoading(true);

      // Call the fetch-all-games edge function
      const { data, error } = await supabase.functions.invoke('fetch-all-games', {
        body: {
          dateRange: filters.dateRange,
          sport: filters.sport !== 'all' ? filters.sport : undefined
        }
      });

      if (error) throw error;

      if (data && data.games) {
        setGames(data.games);
        toast({
          title: "Games loaded",
          description: `Found ${data.games.length} upcoming games`
        });
      }
    } catch (error) {
      console.error("Error fetching games:", error);
      toast({
        title: "Error loading games",
        description: error instanceof Error ? error.message : "Failed to load games",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchGames();
    setIsRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...games];

    // Sport filter
    if (filters.sport !== "all") {
      filtered = filtered.filter(game => game.sport === filters.sport);
    }

    // Date range filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (filters.dateRange === "today") {
      filtered = filtered.filter(game => {
        const gameDate = new Date(game.game_date);
        return gameDate >= today && gameDate < tomorrow;
      });
    } else if (filters.dateRange === "tomorrow") {
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);
      filtered = filtered.filter(game => {
        const gameDate = new Date(game.game_date);
        return gameDate >= tomorrow && gameDate < dayAfter;
      });
    } else if (filters.dateRange === "week") {
      filtered = filtered.filter(game => {
        const gameDate = new Date(game.game_date);
        return gameDate >= today && gameDate < weekEnd;
      });
    }

    // Edge filter
    if (filters.minEdge > 0) {
      filtered = filtered.filter(game =>
        game.ai_recommendation && game.ai_recommendation.edge >= filters.minEdge
      );
    }

    // Confidence filter
    if (filters.minConfidence > 0) {
      filtered = filtered.filter(game =>
        game.ai_recommendation && game.ai_recommendation.confidence >= filters.minConfidence
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "edge_desc":
          return (b.ai_recommendation?.edge || 0) - (a.ai_recommendation?.edge || 0);
        case "edge_asc":
          return (a.ai_recommendation?.edge || 0) - (b.ai_recommendation?.edge || 0);
        case "confidence_desc":
          return (b.ai_recommendation?.confidence || 0) - (a.ai_recommendation?.confidence || 0);
        case "time_asc":
          return new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        case "time_desc":
          return new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
        default:
          return 0;
      }
    });

    setFilteredGames(filtered);
  };

  const handleFilterChange = (newFilters: GameFilters) => {
    setFilters(newFilters);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to view games</h2>
          <Button onClick={() => navigate('/auth')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Game Dashboard</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <FilterPanel
          onFilterChange={handleFilterChange}
          isExpanded={isFilterExpanded}
          onToggle={() => setIsFilterExpanded(!isFilterExpanded)}
        />

        {/* Stats Summary */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Games</p>
              <p className="text-2xl font-bold">{filteredGames.length}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">+EV Opportunities</p>
              <p className="text-2xl font-bold text-green-600">
                {filteredGames.filter(g => g.ai_recommendation && g.ai_recommendation.edge >= 2).length}
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">High Confidence</p>
              <p className="text-2xl font-bold">
                {filteredGames.filter(g => g.ai_recommendation && g.ai_recommendation.confidence >= 75).length}
              </p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Sports Covered</p>
              <p className="text-2xl font-bold">
                {new Set(filteredGames.map(g => g.league)).size}
              </p>
            </div>
          </div>
        )}

        {/* Games Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground mb-4">No games found matching your filters</p>
            <Button variant="outline" onClick={() => {
              setFilters({
                sport: "all",
                dateRange: "week",
                betType: "all",
                minEdge: 0,
                minConfidence: 0,
                sortBy: "edge_desc"
              });
            }}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredGames.map(game => (
              <GameCard key={game.event_id} game={game} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Games;
