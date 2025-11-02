// Onboarding conversation schema for Delta
// Based on PRD v1.1 - Smart Onboarding Flow (Edge Profile Setup)

export type OnboardingInputType =
  | 'number'
  | 'multi_select'
  | 'choice'
  | 'text'
  | 'none';

export interface OnboardingStep {
  id: number;
  message: string;
  input_type: OnboardingInputType;
  field?: string;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    required?: boolean;
  };
  skip_allowed?: boolean;
}

export interface OnboardingData {
  bankroll_size?: number;
  avg_unit?: number;
  risk_tolerance?: number;
  league_preferences?: string[];
  bet_type_profile?: string[];
  tilt_prevention?: boolean;
  volatility_preference?: 'steady' | 'aggressive';
  bet_frequency?: number;
}

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  data: OnboardingData;
  startedAt?: string;
  completedAt?: string;
}

// The complete onboarding conversation flow
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    message: "Welcome to Delta! 🎯 I'm your AI betting coach. Let's build your edge profile so I can help you manage your bankroll intelligently and maximize your ROI.",
    input_type: 'none',
    skip_allowed: false
  },
  {
    id: 1,
    message: "First, what's your typical bankroll size? This is the total amount you've set aside for betting.",
    input_type: 'number',
    field: 'bankroll_size',
    validation: {
      min: 10,
      max: 1000000,
      required: true
    },
    skip_allowed: false
  },
  {
    id: 2,
    message: "Great! How much do you usually risk per bet? (Your average unit size)",
    input_type: 'number',
    field: 'avg_unit',
    validation: {
      min: 1,
      max: 100000,
      required: true
    },
    skip_allowed: false
  },
  {
    id: 3,
    message: "Which sports do you mainly bet on? Select all that apply.",
    input_type: 'multi_select',
    field: 'league_preferences',
    options: ['NBA', 'NFL', 'NCAAF', 'MLB', 'NHL', 'Soccer', 'Tennis', 'MMA'],
    validation: {
      required: true
    },
    skip_allowed: false
  },
  {
    id: 4,
    message: "What types of bets do you prefer? Select all that apply.",
    input_type: 'multi_select',
    field: 'bet_type_profile',
    options: ['Spreads', 'Totals (Over/Under)', 'Moneyline', 'Player Props', 'Parlays', 'Live Betting'],
    validation: {
      required: true
    },
    skip_allowed: false
  },
  {
    id: 5,
    message: "When you're on a losing streak, do you usually slow down or find yourself chasing losses?",
    input_type: 'choice',
    field: 'tilt_prevention',
    options: ['I slow down and stick to my plan', 'I sometimes chase losses'],
    skip_allowed: false
  },
  {
    id: 6,
    message: "What's your betting style preference?",
    input_type: 'choice',
    field: 'volatility_preference',
    options: ['Steady returns with lower risk', 'Aggressive plays with higher variance'],
    skip_allowed: false
  },
  {
    id: 7,
    message: "On average, how many bets do you usually make per day?",
    input_type: 'number',
    field: 'bet_frequency',
    validation: {
      min: 0,
      max: 100,
      required: true
    },
    skip_allowed: false
  },
  {
    id: 8,
    message: "Perfect! Let me summarize your profile...",
    input_type: 'none',
    skip_allowed: false
  }
];

// Helper function to get step by ID
export const getStepById = (stepId: number): OnboardingStep | undefined => {
  return ONBOARDING_STEPS.find(step => step.id === stepId);
};

// Helper function to get next step
export const getNextStep = (currentStepId: number): OnboardingStep | undefined => {
  return ONBOARDING_STEPS.find(step => step.id === currentStepId + 1);
};

// Helper function to validate user input
export const validateInput = (
  step: OnboardingStep,
  input: any
): { valid: boolean; error?: string } => {
  if (!step.validation?.required && (input === undefined || input === null || input === '')) {
    return { valid: true };
  }

  if (step.validation?.required && (input === undefined || input === null || input === '')) {
    return { valid: false, error: 'This field is required' };
  }

  if (step.input_type === 'number') {
    const num = Number(input);
    if (isNaN(num)) {
      return { valid: false, error: 'Please enter a valid number' };
    }
    if (step.validation?.min !== undefined && num < step.validation.min) {
      return { valid: false, error: `Minimum value is ${step.validation.min}` };
    }
    if (step.validation?.max !== undefined && num > step.validation.max) {
      return { valid: false, error: `Maximum value is ${step.validation.max}` };
    }
  }

  if (step.input_type === 'multi_select') {
    if (!Array.isArray(input) || input.length === 0) {
      return { valid: false, error: 'Please select at least one option' };
    }
  }

  if (step.input_type === 'choice') {
    if (!step.options?.includes(input)) {
      return { valid: false, error: 'Please select a valid option' };
    }
  }

  return { valid: true };
};

// Helper function to generate personalized welcome message
export const generateWelcomeMessage = (data: OnboardingData): string => {
  const leagues = data.league_preferences?.join(', ') || 'various sports';
  const betTypes = data.bet_type_profile?.[0] || 'bets';
  const style = data.volatility_preference === 'steady' ? 'balanced' : 'aggressive';

  let message = `You're all set! 🎉\n\n`;
  message += `**Your Profile:**\n`;
  message += `• Bankroll: $${data.bankroll_size?.toLocaleString()}\n`;
  message += `• Unit Size: $${data.avg_unit?.toLocaleString()}\n`;
  message += `• Focus: ${leagues}\n`;
  message += `• Style: ${style.charAt(0).toUpperCase()}${style.slice(1)}\n`;
  message += `• Bet Types: ${data.bet_type_profile?.join(', ')}\n\n`;

  if (data.tilt_prevention) {
    message += `I'll help you stay disciplined during losing streaks and optimize your staking plan. `;
  } else {
    message += `I'll help you manage risk and keep your betting in check. `;
  }

  message += `Let's build your edge together!\n\n`;
  message += `You can ask me things like:\n`;
  message += `• "Show me tonight's ${leagues.split(',')[0]} games"\n`;
  message += `• "What's the edge on Lakers vs Warriors?"\n`;
  message += `• "Log a $${data.avg_unit} bet on the Lakers spread"\n`;
  message += `• "Show my bankroll performance"`;

  return message;
};

// Helper to parse user responses
export const parseUserResponse = (
  step: OnboardingStep,
  userInput: string
): any => {
  switch (step.input_type) {
    case 'number':
      // Extract numbers from text (e.g., "$500" -> 500, "about 50" -> 50)
      const numMatch = userInput.match(/\d+\.?\d*/);
      return numMatch ? parseFloat(numMatch[0]) : null;

    case 'multi_select':
      // Match selected options from the user input
      const selected: string[] = [];
      step.options?.forEach(option => {
        if (userInput.toLowerCase().includes(option.toLowerCase())) {
          selected.push(option);
        }
      });
      return selected.length > 0 ? selected : null;

    case 'choice':
      // Match the closest option
      const lowerInput = userInput.toLowerCase();
      if (step.field === 'tilt_prevention') {
        if (lowerInput.includes('slow') || lowerInput.includes('stick') || lowerInput.includes('disciplined')) {
          return true;
        } else if (lowerInput.includes('chase') || lowerInput.includes('aggressive')) {
          return false;
        }
      }
      if (step.field === 'volatility_preference') {
        if (lowerInput.includes('steady') || lowerInput.includes('lower') || lowerInput.includes('conservative')) {
          return 'steady';
        } else if (lowerInput.includes('aggressive') || lowerInput.includes('variance') || lowerInput.includes('high')) {
          return 'aggressive';
        }
      }
      // Default: find matching option
      return step.options?.find(opt =>
        lowerInput.includes(opt.toLowerCase())
      ) || null;

    case 'text':
      return userInput.trim();

    default:
      return null;
  }
};
