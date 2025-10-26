/**
 * Player Stats Setup Check Component
 *
 * Detects if player stats are properly synced and displays
 * helpful setup instructions if not.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SetupStatus {
  historyAvailable: boolean;
  recentData: boolean;
  dataCount: number;
  lastSync?: string;
  error?: string;
}

export const PlayerStatsSetupCheck: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const checkSetup = async () => {
    setLoading(true);
    const newStatus: SetupStatus = {
      historyAvailable: false,
      recentData: false,
      dataCount: 0,
    };

    try {
      // Check if player_performance_history has data
      // Note: Using 'as any' temporarily until types are regenerated after migration
      const { count, error: countError } = await supabase
        .from('player_performance_history' as any)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        newStatus.error = 'Failed to check player history table';
      } else if (count !== null) {
        newStatus.dataCount = count;
        newStatus.historyAvailable = count > 0;

        // Check if we have recent data (last 7 days)
        if (count > 0) {
          const { count: recentCount } = await supabase
            .from('player_performance_history' as any)
            .select('*', { count: 'exact', head: true })
            .gte('game_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

          newStatus.recentData = (recentCount || 0) > 0;
        }

        // Get last sync time
        const lastSyncResult = await supabase
          .from('player_performance_history' as any)
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastSyncResult.data && !lastSyncResult.error) {
          newStatus.lastSync = new Date((lastSyncResult.data as any).created_at).toLocaleString();
        }
      }

      setStatus(newStatus);
    } catch (error) {
      console.error('Setup check error:', error);
      setStatus({
        historyAvailable: false,
        recentData: false,
        dataCount: 0,
        error: 'Failed to check setup status',
      });
    } finally {
      setLoading(false);
    }
  };

  const syncData = async () => {
    setSyncing(true);
    toast.info('Starting player stats sync (this may take 20-30 minutes for initial backfill)...');

    try {
      // Trigger backfill
      const { data, error } = await supabase.functions.invoke('sync-balldontlie-daily', {
        body: { backfill_days: 30 }
      });

      if (error) throw error;

      toast.success('Player stats sync initiated. Check back in 20-30 minutes.');
      
      // Recheck status
      setTimeout(() => {
        checkSetup();
      }, 2000);
    } catch (error: any) {
      console.error('Sync failed:', error);
      toast.error(error.message || 'Failed to sync player stats');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    checkSetup();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking player stats...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we have recent data (last 7 days), everything is working
  if (status?.recentData && status?.dataCount > 500) {
    return null;
  }

  return (
    <Alert variant={status?.historyAvailable ? "default" : "destructive"} className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>
        {status?.historyAvailable 
          ? 'Player Stats Need Update' 
          : 'Player Stats Setup Required'}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            {status?.historyAvailable
              ? `Found ${status.dataCount} historical games, but need more recent data for accurate predictions.`
              : 'Player stats database is empty. Historical data is required for accurate predictions.'}
          </p>

          {/* Status checklist */}
          <div className="space-y-2 my-4">
            <div className="flex items-center gap-2 text-sm">
              {status?.historyAvailable ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>
                Historical data available ({status?.dataCount || 0} games)
                {status?.dataCount && status.dataCount < 500 && ' - Need 500+ for accuracy'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {status?.recentData ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Recent data (last 7 days)</span>
            </div>

            {status?.lastSync && (
              <div className="text-xs text-muted-foreground mt-2">
                Last sync: {status.lastSync}
              </div>
            )}
          </div>

          {/* Error message */}
          {status?.error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
              <strong>Error:</strong> {status.error}
            </div>
          )}

          {/* Setup instructions */}
          <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">What this will do:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Backfill last 30 days of player stats from BallDontLie API</li>
              <li>Sync 1000+ games with 20+ stats per player</li>
              <li>Enable accurate player prop predictions</li>
              <li>Set up automatic daily syncing</li>
            </ul>
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-xs">
                ⏱️ <strong>Initial sync takes 20-30 minutes</strong> due to API rate limits.
                After completion, daily syncs are automatic and take less than 5 minutes.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              onClick={syncData}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync Player Stats (30 days)'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={checkSetup}
              disabled={syncing}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recheck
            </Button>
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PlayerStatsSetupCheck;
