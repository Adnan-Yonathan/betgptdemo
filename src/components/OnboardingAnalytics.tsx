import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export const OnboardingAnalytics = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Onboarding Analytics</h2>
        <p className="text-muted-foreground">
          Track user onboarding performance and identify drop-off points
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Onboarding analytics will be available once the analytics functions are configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Analytics data will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
