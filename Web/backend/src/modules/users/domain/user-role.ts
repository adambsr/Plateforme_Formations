export const USER_ROLES = ['ADMIN', 'TRAINER', 'LEARNER'] as const;

export type UserRole = (typeof USER_ROLES)[number];
