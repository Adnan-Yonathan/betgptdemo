import { createContext, useContext, useState, ReactNode } from 'react';

export interface TrackedBet {
  team: string;
  homeTeam: string;
  awayTeam: string;
  timestamp: number;
}

interface BetTrackingContextType {
  trackedBets: TrackedBet[];
  addTrackedBet: (bet: TrackedBet) => void;
  removeTrackedBet: (team: string) => void;
  clearTrackedBets: () => void;
}

const BetTrackingContext = createContext<BetTrackingContextType | undefined>(undefined);

export function BetTrackingProvider({ children }: { children: ReactNode }) {
  const [trackedBets, setTrackedBets] = useState<TrackedBet[]>([]);

  const addTrackedBet = (bet: TrackedBet) => {
    setTrackedBets(prev => {
      // Don't add duplicates
      const exists = prev.some(b =>
        b.homeTeam === bet.homeTeam && b.awayTeam === bet.awayTeam
      );
      if (exists) return prev;
      return [...prev, bet];
    });
  };

  const removeTrackedBet = (team: string) => {
    setTrackedBets(prev => prev.filter(b => b.team !== team));
  };

  const clearTrackedBets = () => {
    setTrackedBets([]);
  };

  return (
    <BetTrackingContext.Provider value={{ trackedBets, addTrackedBet, removeTrackedBet, clearTrackedBets }}>
      {children}
    </BetTrackingContext.Provider>
  );
}

export function useBetTracking() {
  const context = useContext(BetTrackingContext);
  if (context === undefined) {
    throw new Error('useBetTracking must be used within a BetTrackingProvider');
  }
  return context;
}
