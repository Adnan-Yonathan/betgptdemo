import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BetData {
  id: string;
  type: 'spread' | 'moneyline' | 'total' | 'prop' | 'parlay' | 'unknown';
  amount: number;
  odds: string;
  gameInfo: {
    team?: string;
    opponent?: string;
    league?: string;
    sport?: string;
    line?: string;
  };
  description?: string;
  displayDescription?: string;
  status: 'pending' | 'won' | 'lost' | 'push';
  createdAt: Date;
}

interface BetContextType {
  activeBets: BetData[];
  addBet: (bet: Omit<BetData, 'id' | 'createdAt' | 'status'>) => void;
  removeBet: (id: string) => void;
  updateBetStatus: (id: string, status: BetData['status']) => void;
  clearAllBets: () => void;
}

const BetContext = createContext<BetContextType | undefined>(undefined);

export const BetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeBets, setActiveBets] = useState<BetData[]>([]);

  const addBet = useCallback((bet: Omit<BetData, 'id' | 'createdAt' | 'status'>) => {
    const newBet: BetData = {
      ...bet,
      id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      status: 'pending',
    };

    setActiveBets((prev) => {
      const updated = [...prev, newBet];
      console.log('✅ Bet added to tracker:', newBet);
      console.log('📊 Total active bets:', updated.length);
      return updated;
    });
  }, []);

  const removeBet = useCallback((id: string) => {
    setActiveBets((prev) => {
      const updated = prev.filter((bet) => bet.id !== id);
      console.log('🗑️ Bet removed:', id);
      console.log('📊 Remaining bets:', updated.length);
      return updated;
    });
  }, []);

  const updateBetStatus = useCallback((id: string, status: BetData['status']) => {
    setActiveBets((prev) => {
      const updated = prev.map((bet) =>
        bet.id === id ? { ...bet, status } : bet
      );
      console.log('🔄 Bet status updated:', id, '→', status);
      return updated;
    });
  }, []);

  const clearAllBets = useCallback(() => {
    setActiveBets([]);
    console.log('🧹 All bets cleared');
  }, []);

  const value: BetContextType = {
    activeBets,
    addBet,
    removeBet,
    updateBetStatus,
    clearAllBets,
  };

  return <BetContext.Provider value={value}>{children}</BetContext.Provider>;
};

export const useBets = (): BetContextType => {
  const context = useContext(BetContext);
  if (!context) {
    throw new Error('useBets must be used within a BetProvider');
  }
  return context;
};
