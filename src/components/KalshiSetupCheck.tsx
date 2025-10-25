/**
 * Kalshi Setup Check Component
 *
 * Detects if Kalshi integration is properly configured and displays
 * helpful setup instructions if not.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SetupStatus {
  edgeFunctionsDeployed: boolean;
  marketsAvailable: boolean;
  connectionTested: boolean;
  error?: string;
}

export const KalshiSetupCheck: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const checkSetup = async () => {
    setLoading(true);
    const newStatus: SetupStatus = {
      edgeFunctionsDeployed: false,
      marketsAvailable: false,
      connectionTested: false,
    };

    try {
      // Check 1: Test if edge functions are deployed
      try {
        const { data, error } = await supabase.functions.invoke('test-kalshi-connection');

        if (error) {
          // Check if it's a "not deployed" error
          if (error.message?.includes('Access denied') || error.message?.includes('not found')) {
            newStatus.edgeFunctionsDeployed = false;
            newStatus.error = 'Edge functions not deployed';
          } else {
            // Function is deployed but returned an error (likely credentials issue)
            newStatus.edgeFunctionsDeployed = true;
            newStatus.connectionTested = false;
            newStatus.error = error.message;
          }
        } else if (data?.success) {
          newStatus.edgeFunctionsDeployed = true;
          newStatus.connectionTested = true;
        }
      } catch (err) {
        newStatus.edgeFunctionsDeployed = false;
        newStatus.error = 'Failed to test edge functions';
      }

      // Check 2: Check if markets are available in database
      try {
        const { count, error } = await supabase
          .from('kalshi_markets')
          .select('*', { count: 'exact', head: true });

        if (!error && count !== null && count > 0) {
          newStatus.marketsAvailable = true;
        }
      } catch (err) {
        // Ignore database check errors
      }

      setStatus(newStatus);
    } catch (error) {
      console.error('Setup check error:', error);
      setStatus({
        edgeFunctionsDeployed: false,
        marketsAvailable: false,
        connectionTested: false,
        error: 'Failed to check setup status',
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-kalshi-connection');

      if (error) throw error;

      if (data?.success) {
        setStatus(prev => prev ? { ...prev, connectionTested: true } : prev);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setTesting(false);
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
            <span className="ml-2 text-muted-foreground">Checking Kalshi setup...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If everything is working, don't show anything
  if (status?.edgeFunctionsDeployed && status?.marketsAvailable && status?.connectionTested) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Kalshi Integration Setup Required</AlertTitle>
      <AlertDescription className="mt-2 space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            The Kalshi integration is not fully configured. Please complete the setup:
          </p>

          {/* Status checklist */}
          <div className="space-y-2 my-4">
            <div className="flex items-center gap-2 text-sm">
              {status?.edgeFunctionsDeployed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Edge functions deployed</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {status?.connectionTested ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Kalshi API connection successful</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {status?.marketsAvailable ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Market data synced</span>
            </div>
          </div>

          {/* Error message */}
          {status?.error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
              <strong>Error:</strong> {status.error}
            </div>
          )}

          {/* Setup instructions */}
          <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
            <p className="font-semibold">Setup Steps:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Deploy edge functions to Supabase</li>
              <li>Set Kalshi API credentials (KALSHI_EMAIL, KALSHI_PASSWORD)</li>
              <li>Sync market data from Kalshi API</li>
            </ol>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="font-semibold mb-2">Quick deploy command:</p>
              <code className="block bg-background p-2 rounded text-xs">
                bash scripts/deploy-kalshi.sh
              </code>
            </div>
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="https://github.com/Adnan-Yonathan/betgptdemo/blob/main/KALSHI_ISSUES_AND_FIXES.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  View Setup Guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {status?.edgeFunctionsDeployed && (
              <Button
                size="sm"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={checkSetup}
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

export default KalshiSetupCheck;
