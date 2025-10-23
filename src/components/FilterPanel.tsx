import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

interface FilterPanelProps {
  onFilterChange: (filters: GameFilters) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface GameFilters {
  sport: string;
  dateRange: string;
  betType: string;
  minEdge: number;
  minConfidence: number;
  sortBy: string;
}

export const FilterPanel = ({ onFilterChange, isExpanded, onToggle }: FilterPanelProps) => {
  const [filters, setFilters] = useState<GameFilters>({
    sport: "all",
    dateRange: "today",
    betType: "all",
    minEdge: 0,
    minConfidence: 0,
    sortBy: "edge_desc"
  });

  const handleFilterChange = (key: keyof GameFilters, value: string | number) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters: GameFilters = {
      sport: "all",
      dateRange: "today",
      betType: "all",
      minEdge: 0,
      minConfidence: 0,
      sortBy: "edge_desc"
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        onClick={onToggle}
        className="mb-4"
      >
        <Filter className="w-4 h-4 mr-2" />
        Show Filters
      </Button>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filter Games
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sport Filter */}
          <div className="space-y-2">
            <Label htmlFor="sport-filter">Sport</Label>
            <Select
              value={filters.sport}
              onValueChange={(value) => handleFilterChange("sport", value)}
            >
              <SelectTrigger id="sport-filter">
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="americanfootball_nfl">NFL</SelectItem>
                <SelectItem value="americanfootball_ncaaf">College Football</SelectItem>
                <SelectItem value="icehockey_nhl">NHL</SelectItem>
                <SelectItem value="basketball_nba">NBA</SelectItem>
                <SelectItem value="baseball_mlb">MLB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <Label htmlFor="date-filter">Date Range</Label>
            <Select
              value={filters.dateRange}
              onValueChange={(value) => handleFilterChange("dateRange", value)}
            >
              <SelectTrigger id="date-filter">
                <SelectValue placeholder="Today" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="all">All Upcoming</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bet Type Filter */}
          <div className="space-y-2">
            <Label htmlFor="bet-type-filter">Bet Type</Label>
            <Select
              value={filters.betType}
              onValueChange={(value) => handleFilterChange("betType", value)}
            >
              <SelectTrigger id="bet-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="h2h">Moneyline</SelectItem>
                <SelectItem value="spreads">Spread</SelectItem>
                <SelectItem value="totals">Over/Under</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Minimum Edge Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Minimum Edge</Label>
            <span className="text-sm text-muted-foreground">{filters.minEdge}%</span>
          </div>
          <Slider
            value={[filters.minEdge]}
            onValueChange={(value) => handleFilterChange("minEdge", value[0])}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Minimum Confidence Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Minimum Confidence</Label>
            <span className="text-sm text-muted-foreground">{filters.minConfidence}%</span>
          </div>
          <Slider
            value={[filters.minConfidence]}
            onValueChange={(value) => handleFilterChange("minConfidence", value[0])}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        {/* Sort By */}
        <div className="space-y-2">
          <Label htmlFor="sort-filter">Sort By</Label>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => handleFilterChange("sortBy", value)}
          >
            <SelectTrigger id="sort-filter">
              <SelectValue placeholder="Sort by Edge (High to Low)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edge_desc">Edge (High to Low)</SelectItem>
              <SelectItem value="edge_asc">Edge (Low to High)</SelectItem>
              <SelectItem value="confidence_desc">Confidence (High to Low)</SelectItem>
              <SelectItem value="time_asc">Game Time (Earliest First)</SelectItem>
              <SelectItem value="time_desc">Game Time (Latest First)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
