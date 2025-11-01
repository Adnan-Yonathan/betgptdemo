import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellOff,
  Lightbulb,
  AlertTriangle,
  Target,
  TrendingUp,
  Trophy,
  X,
  Check,
  ExternalLink
} from "lucide-react";

interface SmartAlert {
  id: string;
  alert_type: 'opportunity' | 'warning' | 'goal' | 'strategy' | 'market' | 'achievement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  is_actionable: boolean;
  actions: Array<{
    label: string;
    action: string;
    params?: Record<string, any>;
  }>;
  metadata: Record<string, any>;
  status: 'unread' | 'read' | 'acted' | 'dismissed';
  created_at: string;
  expires_at?: string;
}

export function SmartAlerts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchAlerts();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('smart_alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'smart_alerts',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        setAlerts(prev => [payload.new as SmartAlert, ...prev]);
        toast({
          title: "New Alert",
          description: (payload.new as SmartAlert).title
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('smart_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false})
        .limit(50);

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

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('smart_alerts')
        .update({
          status: 'read',
          viewed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'read' as const } : a
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const markAsActed = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('smart_alerts')
        .update({
          status: 'acted',
          acted_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(a => a.id !== alertId));

      toast({
        title: "Great!",
        description: "Alert marked as acted upon"
      });
    } catch (error) {
      console.error('Error marking alert as acted:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('smart_alerts')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.filter(a => a.id !== alertId));

      toast({
        title: "Alert Dismissed",
        description: "Alert has been removed"
      });
    } catch (error) {
      console.error('Error dismissing alert:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss alert",
        variant: "destructive"
      });
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'goal':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'strategy':
        return <TrendingUp className="w-5 h-5 text-purple-500" />;
      case 'achievement':
        return <Trophy className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'destructive' as const;
      case 'high':
        return 'default' as const;
      case 'medium':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const getAlertBorderColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/5';
      case 'high':
        return 'border-yellow-500/50 bg-yellow-500/5';
      case 'medium':
        return 'border-blue-500/50 bg-blue-500/5';
      default:
        return 'border-border';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.status === filter;
  });

  const unreadCount = alerts.filter(a => a.status === 'unread').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Smart Alerts</CardTitle>
          <CardDescription>Loading alerts...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Smart Alerts
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount} new</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Context-aware notifications to help you make better decisions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <BellOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Alerts</h3>
            <p className="text-sm text-muted-foreground">
              You're all caught up! We'll notify you when there's something important.
            </p>
          </div>
        ) : (
          <>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="all">
                  All ({alerts.length})
                </TabsTrigger>
                <TabsTrigger value="unread">
                  Unread ({unreadCount})
                </TabsTrigger>
                <TabsTrigger value="read">
                  Read ({alerts.filter(a => a.status === 'read').length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {filter} alerts
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={`${getAlertBorderColor(alert.priority)} border-2 relative ${alert.status === 'unread' ? 'shadow-md' : ''
                      }`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>

                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getAlertIcon(alert.alert_type)}</div>
                        <div className="flex-1 pr-6">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant={getPriorityVariant(alert.priority)}>
                              {alert.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {alert.alert_type.toUpperCase()}
                            </Badge>
                            {alert.status === 'unread' && (
                              <Badge variant="default">NEW</Badge>
                            )}
                          </div>
                          <CardTitle className="text-base">{alert.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <p className="text-sm">{alert.message}</p>

                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="bg-muted rounded-lg p-3 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(alert.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                <span className="font-semibold">
                                  {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {alert.status === 'unread' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsRead(alert.id)}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Mark Read
                          </Button>
                        )}
                        {alert.is_actionable && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => markAsActed(alert.id)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Take Action
                          </Button>
                        )}
                      </div>

                      {alert.expires_at && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(alert.expires_at).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
