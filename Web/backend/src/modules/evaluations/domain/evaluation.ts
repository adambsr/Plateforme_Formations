export const EVALUATION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];
export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'PASSED', 'FAILED'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
