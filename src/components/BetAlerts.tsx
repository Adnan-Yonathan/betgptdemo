import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  BellOff,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  DollarSign,
  Zap
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface BetAlert {
  alert_id: string;
  alert_type: string;
  alert_title: string;
  alert_message: string;
  priority: number;
  game_id: string;
  home_team: string;
  away_team: string;
  current_score: string;
  time_remaining: string;
  alert_data: any;
  created_at: string;
}

export function BetAlerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<BetAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch unread alerts
  const fetchAlerts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_unread_alerts', {
        p_user_id: user.id
      });

      if (error) throw error;

      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: "Error",
        description: "Failed to load alerts",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark alert as read
  const markAsRead = async (alertId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_alert_as_read', {
        p_alert_id: alertId,
        p_user_id: user.id
      });

      if (error) throw error;

      // Remove from local state
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));

      toast({
        title: "Alert dismissed",
        description: "Alert marked as read"
      });
    } catch (error) {
      console.error('Error marking alert as read:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss alert",
        variant: "destructive"
      });
    }
  };

  // Dismiss all alerts
  const dismissAll = async () => {
    if (!user || alerts.length === 0) return;

    try {
      // Mark all as read
      await Promise.all(
        alerts.map(alert =>
          supabase.rpc('mark_alert_as_read', {
            p_alert_id: alert.alert_id,
            p_user_id: user.id
          })
        )
      );

      setAlerts([]);

      toast({
        title: "All alerts dismissed",
        description: `${alerts.length} alerts marked as read`
      });
    } catch (error) {
      console.error('Error dismissing all alerts:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss alerts",
        variant: "destructive"
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchAlerts();

    // Poll every 15 seconds for new alerts
    const interval = setInterval(fetchAlerts, 15000);

    return () => clearInterval(interval);
  }, [user]);

  // Set up Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('bet_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bet_alerts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New alert:', payload);
          fetchAlerts();

          // Show toast notification for high priority alerts
          const newAlert = payload.new as any;
          if (newAlert.priority >= 2) {
            toast({
              title: newAlert.alert_title,
              description: newAlert.alert_message,
              duration: 8000
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'close_finish':
        return <Zap className="w-4 h-4" />;
      case 'momentum_shift':
        return <TrendingUp className="w-4 h-4" />;
      case 'critical_moment':
        return <AlertTriangle className="w-4 h-4" />;
      case 'hedge_opportunity':
        return <DollarSign className="w-4 h-4" />;
      case 'win_prob_change':
        return <Activity className="w-4 h-4" />;
      case 'game_starting':
        return <Clock className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 3) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (priority >= 2) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    if (priority >= 1) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    return 'bg-muted text-muted-foreground';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 3) return 'URGENT';
    if (priority >= 2) return 'HIGH';
    if (priority >= 1) return 'MEDIUM';
    return 'LOW';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5 text-muted-foreground" />
            Alerts
          </CardTitle>
          <CardDescription>
            No new alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You'll be notified here when important moments happen during your games.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alerts
            <Badge variant="destructive" className="ml-2">
              {alerts.length} new
            </Badge>
          </CardTitle>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={dismissAll}
              className="text-xs"
            >
              Dismiss all
            </Button>
          )}
        </div>
        <CardDescription>
          Real-time notifications for your active bets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card
                key={alert.alert_id}
                className={`border-2 ${getPriorityColor(alert.priority)}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="mt-0.5">
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-sm font-semibold">
                            {alert.alert_title}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {getPriorityLabel(alert.priority)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.alert_message}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(alert.alert_id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {alert.home_team} vs {alert.away_team}
                    </span>
                    {alert.current_score && (
                      <span className="font-medium">
                        {alert.current_score} • {alert.time_remaining}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
