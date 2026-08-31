export interface Period {
  from: string;
  to: string;
  timeZone: 'Africa/Tunis';
}

export interface Overview {
  period: Period;
  counts: Record<
    'trainings' | 'sessions' | 'learners' | 'trainers' | 'enrollments',
    number
  >;
}

export interface Participation {
  period: Period;
  overall: {
    expected: number;
    recorded: number;
    present: number;
    participationPercent: number | null;
  };
  byTraining: Array<{
    training: { id: string; title: string };
    expected: number;
    recorded: number;
    present: number;
    participationPercent: number | null;
  }>;
}

export interface ProgressDashboard {
  period: Period;
  selfPaced: {
    enrollmentCount: number;
    completedEnrollments: number;
    averagePercentage: number | null;
  };
  evaluations: {
    totalAttempts: number;
    passedAttempts: number;
    failedAttempts: number;
    passPercent: number | null;
  };
}

export interface LearningInsights {
  period: Period;
  completionTrend: Array<{ month: string; completed: number }>;
  inactivity: {
    thresholdDays: number;
    total: number;
    learners: Array<{
      learner: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
      };
      lastActivityAt: string;
      inactiveDays: number;
      activeTrainingCount: number;
      trainingTitles: string[];
    }>;
  };
}

export interface Satisfaction {
  period: Period;
  global: {
    count: number;
    average: number | null;
    distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
  byTraining: Array<{
    training: { id: string; title: string };
    count: number;
    average: number | null;
  }>;
}

export interface Profitability {
  period: Period;
  currency: 'EUR';
  includedTrainerMonths: Array<{ year: number; month: number }>;
  revenueMinor: number;
  trainerCostsMinor: number;
  trainingCostsMinor: number;
  totalCostsMinor: number;
  resultMinor: number;
  profitabilityPercent: number | null;
  byTraining: Array<{
    training: { id: string; title: string };
    revenueMinor: number;
    trainingCostsMinor: number;
    resultBeforeFixedTrainerCostsMinor: number;
  }>;
}

export interface TrainerCost {
  id: string;
  trainer: { id: string; email: string; firstName?: string; lastName?: string };
  year: number;
  month: number;
  amountMinor: number;
  currency: 'EUR';
  note?: string;
}

export interface TrainingCost {
  id: string;
  training: { id: string; title: string };
  session?: { id: string; title: string };
  date: string;
  amountMinor: number;
  currency: 'EUR';
  label: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
