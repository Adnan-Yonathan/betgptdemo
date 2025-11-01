# Phase 8: Social Features & Community

## Executive Summary

Phase 8 transforms the betting assistant from a solo tool into a thriving community platform. By implementing social features, leaderboards, public profiles, and collaborative tools, we create network effects that drive engagement, retention, and user success through shared knowledge and friendly competition.

## Motivation

### Why Phase 8?

After implementing:
- **Phase 3**: Enhanced memory and user intelligence
- **Phase 4**: EV analysis, Kelly criterion, CLV tracking
- **Phase 5**: Live bet tracking and alerts
- **Phase 6**: Advanced analytics and performance dashboard
- **Phase 7**: AI intelligence and personalization

Users now have powerful individual tools, but they're isolated. They need:

1. **Social Proof**: See that others are succeeding with the platform
2. **Learning**: Learn strategies from successful bettors
3. **Competition**: Compete on leaderboards for motivation
4. **Community**: Connect with like-minded bettors
5. **Validation**: Get feedback on their betting strategies
6. **Accountability**: Public profiles encourage better decision-making

### Business Value

- **Network Effects**: Each new user adds value for existing users
- **Viral Growth**: Users invite friends to join leaderboards
- **Retention**: Social connections keep users engaged
- **Premium Upsells**: Exclusive social features for premium users
- **Data Insights**: Aggregate anonymized data from community
- **Expert Marketplace**: Monetize successful bettor insights
- **Brand Building**: Community becomes the product

## Goals

### Primary Goals
1. Build public profile system with privacy controls
2. Create global and filtered leaderboards
3. Implement follow/follower system
4. Enable bet sharing and social feeds
5. Launch betting challenges and contests
6. Build achievement and badge system

### Secondary Goals
1. Create verified expert/tipster program
2. Build betting circles (private groups)
3. Implement discussion forums
4. Add bet copying functionality
5. Create social analytics (compare to follows)
6. Build reputation system

## Features

### Feature 1: Public Profiles

**What**: Customizable public profiles showcasing betting performance

**Components**:
- **Profile Information**:
  - Username and display name
  - Profile picture and banner
  - Bio and location
  - Social media links
  - Join date and member badge
  - Verification status (for experts)

- **Performance Stats**:
  - Public ROI and win rate
  - Total profit (optional to hide)
  - Best sport/league
  - Current streak
  - Total bets tracked
  - Member since date

- **Activity Feed**:
  - Recent public bets
  - Shared insights
  - Achievements earned
  - Comments and discussions

- **Privacy Controls**:
  - Public/Private/Friends-only options
  - Selective stat sharing
  - Hide specific bets or leagues
  - Anonymous mode

**Why**: Profiles create identity and social proof

**Technical Approach**:
```typescript
interface PublicProfile {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  location?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
  };

  // Privacy settings
  isPublic: boolean;
  statsVisibility: 'public' | 'friends' | 'private';

  // Public stats
  publicStats: {
    totalBets: number;
    winRate: number;
    roi: number;
    bestSport: string;
    memberSince: Date;
  };

  // Badges and achievements
  badges: string[];
  achievements: Achievement[];

  // Social counts
  followerCount: number;
  followingCount: number;

  // Verification
  isVerified: boolean;
  verifiedAt?: Date;
}
```

---

### Feature 2: Leaderboards

**What**: Competitive rankings across multiple dimensions

**Leaderboard Types**:

1. **Global Leaderboards**:
   - Overall ROI (all-time)
   - Monthly ROI
   - Weekly ROI
   - Highest win rate
   - Longest win streak
   - Most profitable bettor
   - Most accurate (CLV)

2. **Sport-Specific Leaderboards**:
   - NBA leaders
   - NFL leaders
   - MLB leaders
   - NHL leaders
   - Soccer leaders

3. **Bet Type Leaderboards**:
   - Spread betting leaders
   - Total betting leaders
   - Moneyline leaders
   - Parlay leaders

4. **Challenge Leaderboards**:
   - Active contest rankings
   - Historical challenge winners
   - Season champions

**Features**:
- Real-time updates
- Minimum bet requirements (prevents gaming)
- Percentile rankings
- Movement indicators (↑↓)
- Filtering by timeframe
- Click through to profiles
- Top 10/50/100 views

**Why**: Competition drives engagement and provides benchmarks

**Technical Approach**:
```typescript
interface LeaderboardEntry {
  rank: number;
  previousRank?: number;
  userId: string;
  username: string;
  avatar?: string;

  // Stats
  roi: number;
  winRate: number;
  totalBets: number;
  profitLoss: number;

  // Filters
  sport?: string;
  betType?: string;
  timeframe: 'weekly' | 'monthly' | 'all_time';

  // Meta
  updatedAt: Date;
}

// Leaderboard calculation
async function calculateLeaderboard(
  type: LeaderboardType,
  timeframe: Timeframe,
  minBets: number = 20
): Promise<LeaderboardEntry[]> {
  // Query aggregated stats
  // Filter by minimum bet requirement
  // Calculate rankings
  // Track rank changes
  // Return sorted results
}
```

---

### Feature 3: Follow System

**What**: Follow successful bettors and build a network

**Features**:
- **Follow/Unfollow**: One-click follow actions
- **Follower List**: See who follows you
- **Following List**: See who you follow
- **Mutual Follows**: Highlight mutual connections
- **Suggested Follows**: AI-recommended bettors based on:
  - Similar betting patterns
  - High success rates
  - Popular in community
  - Friends of friends

- **Following Feed**: See activity from followed bettors
- **Notifications**: When someone follows you
- **Follow Privacy**: Option to approve followers

**Why**: Building networks increases retention and learning

**Technical Approach**:
```typescript
interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
  notificationsEnabled: boolean;
}

interface FollowStats {
  userId: string;
  followerCount: number;
  followingCount: number;
  mutualFollowCount: number;
}

// Follow actions
async function followUser(followerId: string, followingId: string) {
  // Create follow relationship
  // Increment counters
  // Send notification
  // Add to feed
}

async function getSuggestedFollows(userId: string): Promise<UserProfile[]> {
  // Find users with similar patterns
  // Find high performers in user's sports
  // Find mutual connections
  // Rank by relevance
  // Return top suggestions
}
```

---

### Feature 4: Social Feed

**What**: Activity stream showing community and followed users' activity

**Feed Types**:

1. **Personal Feed** (Following):
   - Bets from followed users
   - Achievements unlocked
   - Comments and discussions
   - Bet results
   - Milestone celebrations

2. **Global Feed** (Discover):
   - Trending bets
   - Popular discussions
   - Top performers this week
   - Community highlights
   - Featured experts

3. **Sport Feed**:
   - Activity filtered by sport
   - Game-specific discussions
   - Line movements
   - Injury updates

**Feed Items**:
```typescript
interface FeedItem {
  id: string;
  type: 'bet' | 'achievement' | 'comment' | 'insight' | 'result';
  userId: string;
  username: string;
  avatar?: string;

  // Content
  content: string;
  metadata: Record<string, any>;

  // Engagement
  likes: number;
  comments: number;
  shares: number;

  // User interaction
  hasLiked: boolean;
  hasCommented: boolean;

  createdAt: Date;
}
```

**Interactions**:
- Like posts
- Comment on bets
- Share to your feed
- Save to favorites
- Report inappropriate content

**Why**: Feeds drive daily engagement and community building

---

### Feature 5: Bet Sharing

**What**: Share bets publicly with reasoning and track social performance

**Sharing Options**:
- **Share to Feed**: Post to social feed
- **Share to Circle**: Post to private group
- **Share Link**: Generate shareable link
- **Share to Twitter**: Direct integration
- **Copy Bet**: Allow others to copy your bet

**Shared Bet Features**:
- Reasoning/analysis text
- Confidence level
- Expected value calculation
- Recommended stake
- Tags (e.g., #ValueBet #NBA)
- Comments enabled/disabled

**Social Bet Stats**:
- Times copied by others
- Agreement/disagreement votes
- Success rate of shared bets
- Social ROI (shared bets only)

**Why**: Sharing creates accountability and helps others learn

**Technical Approach**:
```typescript
interface SharedBet {
  id: string;
  betId: string;
  userId: string;

  // Sharing details
  sharedAt: Date;
  visibility: 'public' | 'followers' | 'circle' | 'link_only';

  // Content
  reasoning: string;
  confidence: number;
  tags: string[];

  // Social stats
  copiedCount: number;
  likesCount: number;
  commentsCount: number;

  // Performance
  result?: 'won' | 'lost' | 'push';
  resultAt?: Date;
}

interface BetCopy {
  id: string;
  originalBetId: string;
  originalUserId: string;
  copiedByUserId: string;
  copiedAt: Date;

  // Modified values
  adjustedAmount?: number;
  notes?: string;
}
```

---

### Feature 6: Betting Challenges

**What**: Competitive contests with prizes and bragging rights

**Challenge Types**:

1. **Weekly Challenges**:
   - Best ROI this week
   - Most wins
   - Highest profit
   - Best underdogs
   - Perfect week (all wins)

2. **Sport Challenges**:
   - NBA playoff challenge
   - March Madness bracket
   - Super Bowl prop contest
   - World Series challenge

3. **Custom Challenges**:
   - User-created contests
   - Private group challenges
   - Friend vs friend
   - Entry fee pools (future)

**Challenge Features**:
- Entry requirements (min bets, sport, etc.)
- Leaderboards
- Prize distribution
- Live standings
- Auto-enrollment options
- Push notifications for ranking changes

**Prizes**:
- Badges and achievements
- Platform credits
- Premium membership
- Recognition/featured profile
- Real prizes (future, regulated)

**Why**: Challenges create urgency and engagement

**Technical Approach**:
```typescript
interface Challenge {
  id: string;
  name: string;
  description: string;

  // Timing
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'completed';

  // Rules
  eligibilityCriteria: {
    minBets?: number;
    sports?: string[];
    betTypes?: string[];
    minStake?: number;
  };

  // Scoring
  scoringMethod: 'roi' | 'profit' | 'win_rate' | 'custom';

  // Participants
  participantCount: number;
  maxParticipants?: number;

  // Prizes
  prizes: {
    rank: number;
    prize: string;
    value?: number;
  }[];

  // Social
  isPublic: boolean;
  createdBy: string;
}

interface ChallengeParticipation {
  challengeId: string;
  userId: string;

  // Stats
  currentRank: number;
  score: number;
  betsCount: number;

  // Status
  isActive: boolean;
  joinedAt: Date;
}
```

---

### Feature 7: Achievement System

**What**: Gamification through badges and achievements

**Achievement Categories**:

1. **Milestone Achievements**:
   - First bet tracked
   - 10, 50, 100, 500, 1000 bets
   - $100, $500, $1000 profit
   - 30-day streak
   - 90-day streak

2. **Performance Achievements**:
   - 5-bet win streak
   - 10-bet win streak
   - 60%+ win rate (min 50 bets)
   - 10%+ ROI (min 100 bets)
   - Positive CLV streak

3. **Social Achievements**:
   - 10, 50, 100 followers
   - Top 10 on leaderboard
   - Challenge winner
   - 100 shared bets
   - Helpful community member

4. **Special Achievements**:
   - Perfect week (all wins)
   - Upset specialist (underdog wins)
   - Value hunter (high CLV)
   - Contrarian (bet against public)
   - All-star (top in all sports)

**Badge Features**:
- Rarity levels (Common, Rare, Epic, Legendary)
- Progress tracking
- Display on profile
- Unlockable rewards
- Limited time badges

**Why**: Achievements drive long-term engagement

**Technical Approach**:
```typescript
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;

  // Rarity
  rarity: 'common' | 'rare' | 'epic' | 'legendary';

  // Requirements
  requirements: {
    type: string;
    value: number;
    timeframe?: string;
  }[];

  // Rewards
  rewardBadge: string;
  rewardCredits?: number;

  // Stats
  unlockedByCount: number;
  unlockedByPercent: number;
}

interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  progress?: number;
  isDisplayed: boolean;
}
```

---

### Feature 8: Betting Circles (Groups)

**What**: Private communities for friends, clubs, or shared interests

**Circle Features**:
- **Private Groups**: Invite-only betting communities
- **Group Feed**: Shared activity stream
- **Group Leaderboards**: Compete within circle
- **Group Challenges**: Circle-specific contests
- **Shared Insights**: Collaborative analysis
- **Group Chat**: Discussion threads

**Circle Types**:
- Friends circle
- College alumni
- Sports team fans
- Strategy groups
- Local betting clubs

**Circle Management**:
- Create/join circles
- Admin controls
- Member roles
- Invitation system
- Public/private visibility
- Member limits

**Why**: Private groups foster deeper engagement

**Technical Approach**:
```typescript
interface BettingCircle {
  id: string;
  name: string;
  description: string;
  avatar?: string;

  // Settings
  isPublic: boolean;
  requireApproval: boolean;
  maxMembers?: number;

  // Stats
  memberCount: number;
  totalBets: number;
  avgROI: number;

  // Ownership
  createdBy: string;
  admins: string[];

  createdAt: Date;
}

interface CircleMembership {
  circleId: string;
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
  isActive: boolean;
}
```

---

### Feature 9: Verified Experts

**What**: Verified tipster program for proven successful bettors

**Verification Requirements**:
- Minimum 200 tracked bets
- 55%+ win rate
- 5%+ ROI
- 6+ months history
- Clean community record
- Application + review

**Expert Benefits**:
- Verified badge
- Featured in discovery
- Higher visibility
- Ability to charge for tips (future)
- Analytics on follower performance

**Expert Analytics**:
- Follower count
- Copy rate (how many copy your bets)
- Follower ROI
- Influence score
- Engagement metrics

**Why**: Experts add credibility and value

---

### Feature 10: Social Analytics

**What**: Compare your performance to followed users and community

**Comparisons**:
- You vs Following average
- You vs Sport-specific leaders
- You vs Similar bettors
- You vs Leaderboard position

**Social Insights**:
- "Your ROI is 12% higher than users you follow"
- "You're in the top 15% of NBA bettors"
- "Your followers have 8% ROI when copying your bets"
- "Similar bettors average 54% win rate"

**Why**: Social benchmarking drives improvement

---

## Database Schema

### New Tables

#### 1. public_profiles

```sql
CREATE TABLE public.public_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile info
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,

  -- Social links
  twitter_handle TEXT,
  instagram_handle TEXT,

  -- Privacy
  is_public BOOLEAN DEFAULT true,
  stats_visibility TEXT DEFAULT 'public' CHECK (stats_visibility IN ('public', 'friends', 'private')),

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verification_tier TEXT CHECK (verification_tier IN ('basic', 'expert', 'pro')),

  -- Stats (denormalized for performance)
  total_bets INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  best_sport TEXT,
  current_streak INTEGER DEFAULT 0,

  -- Social counts
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON public.public_profiles(username);
CREATE INDEX idx_profiles_public ON public.public_profiles(is_public) WHERE is_public = true;
CREATE INDEX idx_profiles_verified ON public.public_profiles(is_verified) WHERE is_verified = true;
```

---

#### 2. follows

```sql
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Settings
  notifications_enabled BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_both ON public.follows(follower_id, following_id);
```

---

#### 3. shared_bets

```sql
CREATE TABLE public.shared_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sharing details
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'circle', 'link_only')),
  reasoning TEXT,
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 100),
  tags TEXT[] DEFAULT '{}',

  -- Social stats
  copied_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,

  -- Metadata
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(bet_id)
);

CREATE INDEX idx_shared_bets_user ON public.shared_bets(user_id, shared_at DESC);
CREATE INDEX idx_shared_bets_visibility ON public.shared_bets(visibility, shared_at DESC);
CREATE INDEX idx_shared_bets_popular ON public.shared_bets(likes_count DESC, shared_at DESC);
```

---

#### 4. bet_copies

```sql
CREATE TABLE public.bet_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  original_bet_id UUID NOT NULL REFERENCES public.bets(id),
  original_user_id UUID NOT NULL REFERENCES auth.users(id),

  copied_bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  copied_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Adjustments
  adjusted_amount NUMERIC,
  notes TEXT,

  -- Metadata
  copied_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(copied_bet_id)
);

CREATE INDEX idx_bet_copies_original ON public.bet_copies(original_bet_id);
CREATE INDEX idx_bet_copies_user ON public.bet_copies(copied_by_user_id);
```

---

#### 5. leaderboards

```sql
CREATE TABLE public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Leaderboard type
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('global', 'sport', 'bet_type', 'challenge')),
  category TEXT, -- 'NBA', 'spread', etc.
  timeframe TEXT NOT NULL CHECK (timeframe IN ('daily', 'weekly', 'monthly', 'all_time')),

  -- Ranking
  rank INTEGER NOT NULL,
  previous_rank INTEGER,

  -- Stats
  roi NUMERIC NOT NULL,
  win_rate NUMERIC NOT NULL,
  total_bets INTEGER NOT NULL,
  profit_loss NUMERIC NOT NULL,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, leaderboard_type, category, timeframe, period_start)
);

CREATE INDEX idx_leaderboards_type_time ON public.leaderboards(leaderboard_type, timeframe, rank);
CREATE INDEX idx_leaderboards_user ON public.leaderboards(user_id, calculated_at DESC);
```

---

#### 6. achievements

```sql
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Achievement details
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,

  -- Rarity
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),

  -- Requirements (JSONB for flexibility)
  requirements JSONB NOT NULL,

  -- Rewards
  reward_badge TEXT,
  reward_credits INTEGER DEFAULT 0,

  -- Stats
  unlocked_by_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_achievements_rarity ON public.achievements(rarity);
```

---

#### 7. user_achievements

```sql
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,

  -- Progress
  progress NUMERIC DEFAULT 0,
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,

  -- Display
  is_displayed BOOLEAN DEFAULT false,
  display_order INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id, is_unlocked DESC);
CREATE INDEX idx_user_achievements_displayed ON public.user_achievements(user_id, is_displayed, display_order);
```

---

#### 8. betting_circles

```sql
CREATE TABLE public.betting_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Circle info
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,

  -- Settings
  is_public BOOLEAN DEFAULT false,
  require_approval BOOLEAN DEFAULT true,
  max_members INTEGER,

  -- Stats (denormalized)
  member_count INTEGER DEFAULT 0,
  total_bets INTEGER DEFAULT 0,
  avg_roi NUMERIC DEFAULT 0,

  -- Ownership
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circles_public ON public.betting_circles(is_public) WHERE is_public = true;
CREATE INDEX idx_circles_creator ON public.betting_circles(created_by);
```

---

#### 9. circle_members

```sql
CREATE TABLE public.circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  circle_id UUID NOT NULL REFERENCES public.betting_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'banned')),

  -- Metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),

  UNIQUE(circle_id, user_id)
);

CREATE INDEX idx_circle_members_circle ON public.circle_members(circle_id, status);
CREATE INDEX idx_circle_members_user ON public.circle_members(user_id, status);
```

---

#### 10. challenges

```sql
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Challenge details
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,

  -- Timing
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),

  -- Rules (JSONB for flexibility)
  eligibility_criteria JSONB,
  scoring_method TEXT NOT NULL CHECK (scoring_method IN ('roi', 'profit', 'win_rate', 'wins', 'custom')),

  -- Participants
  participant_count INTEGER DEFAULT 0,
  max_participants INTEGER,

  -- Prizes (JSONB array)
  prizes JSONB DEFAULT '[]',

  -- Visibility
  is_public BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_status ON public.challenges(status, start_date);
CREATE INDEX idx_challenges_public ON public.challenges(is_public, status);
```

---

#### 11. challenge_participants

```sql
CREATE TABLE public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stats
  current_rank INTEGER,
  score NUMERIC DEFAULT 0,
  bets_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_challenge_participants_challenge ON public.challenge_participants(challenge_id, current_rank);
CREATE INDEX idx_challenge_participants_user ON public.challenge_participants(user_id);
```

---

## Frontend Components

### Component Structure

```
src/
├── pages/
│   ├── Community.tsx              (Main community hub)
│   ├── Profile.tsx                (User profile view)
│   ├── Leaderboard.tsx            (Leaderboards page)
│   └── Challenges.tsx             (Challenges page)
│
├── components/
│   ├── social/
│   │   ├── PublicProfile.tsx          (Profile display)
│   │   ├── ProfileEditor.tsx          (Edit profile)
│   │   ├── FollowButton.tsx           (Follow/unfollow)
│   │   ├── FollowerList.tsx           (Followers/following)
│   │   ├── SocialFeed.tsx             (Activity feed)
│   │   ├── FeedItem.tsx               (Individual feed item)
│   │   ├── SharedBet.tsx              (Shared bet card)
│   │   ├── BetShareDialog.tsx         (Share bet modal)
│   │   └── SocialStats.tsx            (Social analytics)
│   │
│   ├── leaderboard/
│   │   ├── LeaderboardTable.tsx       (Ranking table)
│   │   ├── LeaderboardFilters.tsx     (Sport/type filters)
│   │   ├── RankingCard.tsx            (User rank card)
│   │   └── TrophyDisplay.tsx          (Top 3 podium)
│   │
│   ├── challenges/
│   │   ├── ChallengeCard.tsx          (Challenge preview)
│   │   ├── ChallengeDetails.tsx       (Full challenge view)
│   │   ├── ChallengeLeaderboard.tsx   (Challenge rankings)
│   │   ├── CreateChallenge.tsx        (Create custom challenge)
│   │   └── JoinChallenge.tsx          (Join flow)
│   │
│   ├── achievements/
│   │   ├── AchievementBadge.tsx       (Badge display)
│   │   ├── AchievementGrid.tsx        (All achievements)
│   │   ├── AchievementProgress.tsx    (Progress tracker)
│   │   └── AchievementUnlock.tsx      (Unlock animation)
│   │
│   └── circles/
│       ├── CircleCard.tsx             (Circle preview)
│       ├── CircleList.tsx             (Browse circles)
│       ├── CircleFeed.tsx             (Circle activity)
│       ├── CreateCircle.tsx           (Create circle)
│       └── CircleSettings.tsx         (Manage circle)
```

---

## Implementation Plan

### Phase 8.1: Profiles & Following (Week 1)
- **Day 1-2**: Database schema (profiles, follows tables)
- **Day 3-4**: Public profile component
- **Day 5-6**: Follow system backend + UI
- **Day 7**: Profile privacy controls

### Phase 8.2: Leaderboards & Feed (Week 2)
- **Day 1-2**: Leaderboard calculations
- **Day 3-4**: Leaderboard UI components
- **Day 5-6**: Social feed implementation
- **Day 7**: Feed filtering and search

### Phase 8.3: Sharing & Challenges (Week 3)
- **Day 1-2**: Bet sharing functionality
- **Day 3-4**: Challenge system
- **Day 5-6**: Challenge UI
- **Day 7**: Integration testing

### Phase 8.4: Achievements & Circles (Week 4)
- **Day 1-2**: Achievement system
- **Day 3-4**: Betting circles
- **Day 5-6**: Social analytics
- **Day 7**: Polish and deployment

---

## Success Metrics

### User Metrics
- 40%+ create public profiles
- 30%+ follow at least one user
- 50%+ check leaderboards weekly
- 20%+ share at least one bet
- 15%+ join a challenge
- 10%+ create/join a circle

### Technical Metrics
- Leaderboard load time <500ms
- Feed updates in real-time
- Profile page load <1s
- 99.9% uptime

### Business Metrics
- Increased DAU (Daily Active Users)
- Higher retention (7-day, 30-day)
- Viral coefficient >1.0
- Reduced churn
- More premium conversions

---

## Privacy & Safety

### Privacy Controls
- Granular stat sharing
- Block users
- Report content
- Mute keywords
- Anonymous browsing
- Data export

### Content Moderation
- Automated profanity filter
- User reporting system
- Admin review queue
- Community guidelines
- Strike system
- Appeals process

### Data Protection
- GDPR compliance
- Age verification (18+)
- Terms of service
- Privacy policy
- Data retention policies
- Right to be forgotten

---

## Future Enhancements (Phase 9+)

1. **Expert Marketplace**: Paid tipster subscriptions
2. **Live Chat**: Real-time group chat
3. **Video Content**: Strategy videos and analysis
4. **API Access**: Developer platform
5. **Mobile App**: Native iOS/Android
6. **Tournament Mode**: Structured competitions
7. **Betting Syndicates**: Pro group betting
8. **White Label**: Platform for other brands

---

## Conclusion

Phase 8 transforms the betting assistant into a thriving social platform. By implementing:

- **Public Profiles**: Identity and social proof
- **Leaderboards**: Competition and benchmarking
- **Follow System**: Network building
- **Social Feed**: Community engagement
- **Bet Sharing**: Learning and accountability
- **Challenges**: Gamification and prizes
- **Achievements**: Long-term progression
- **Betting Circles**: Private communities

We create powerful network effects that drive viral growth, increase retention, and help users succeed through community knowledge and friendly competition.

**Phase 8 Status**: 📋 **PLANNED** - Ready for implementation
