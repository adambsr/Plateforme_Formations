export type EvaluationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
export interface Option {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  order: number;
  points: number;
  prompt: string;
  type: QuestionType;
  options: Option[];
  correctOptionIds?: string[];
  explanation?: string;
}
export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds: string[];
  awardedPoints?: number;
  question: Omit<Question, 'id'>;
}
export interface Attempt {
  id: string;
  evaluationId: string;
  enrollmentId: string;
  attemptNumber: number;
  status: 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  startedAt: string;
  expiresAt?: string;
  remainingSeconds?: number;
  submittedAt?: string;
  scorePoints?: number;
  totalPoints?: number;
  scorePercentage?: number;
  answersRevealed: boolean;
  answers: AttemptAnswer[];
}
export interface Evaluation {
  id: string;
  training: { id: string; title: string };
  ownerTrainerId: string;
  title: string;
  instructions: string;
  status: EvaluationStatus;
  passPercentage: number;
  maxAttempts: number;
  durationMinutes?: number;
  questionCount: number;
  completed?: boolean;
  isCertifying: boolean;
  questions?: Question[];
  attempts?: Attempt[];
}
export interface ResultPage {
  evaluationId: string;
  totalAttempts: number;
  passedAttempts: number;
  items: Array<{
    id: string;
    attemptNumber: number;
    status: 'PASSED' | 'FAILED';
    scorePercentage: number;
    submittedAt: string;
    learner: { email: string; firstName?: string; lastName?: string };
  }>;
}
