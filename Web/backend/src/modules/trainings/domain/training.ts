export const TRAINING_TYPES = ['SELF_PACED_ONLINE', 'IN_PERSON'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const TRAINING_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];

export const TND_CURRENCY = 'TND' as const;

export interface PublicationFacts {
  type: TrainingType;
  hasModuleWithLesson: boolean;
}

export function publicationBlockReason(
  facts: PublicationFacts,
): string | undefined {
  if (facts.type === 'SELF_PACED_ONLINE' && !facts.hasModuleWithLesson) {
    return 'A self-paced Training requires at least one Module containing a Lesson before publication.';
  }
  return undefined;
}

export function isPositiveTndMinorAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
