import { PersonalizedFeed } from "@/components/PersonalizedFeed";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ProfileSettings } from "@/components/ProfileSettings";

/**
 * AI Feed Page
 * Displays personalized AI-suggested bets
 * Accessible from main navigation
 */
const AIFeed = () => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <h1 className="text-xl font-bold">AI Picks</h1>
              </div>
            </div>
            <ProfileDropdown onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Smart picks tailored to your betting profile and historical performance.
            These suggestions are powered by advanced statistical models.
          </p>
        </div>

        <PersonalizedFeed />
      </main>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default AIFeed;
