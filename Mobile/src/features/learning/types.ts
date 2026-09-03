export type ContentAccess = 'MANAGE' | 'STAFF_READ' | 'LEARNER_READ';
export type ResourceType = 'FILE' | 'EXTERNAL_URL';

export interface ContentResource {
  id: string;
  title: string;
  description: string;
  order: number;
  type: ResourceType;
  isVisibleToLearners: boolean;
  externalUrl?: string;
  file?: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
  };
  isArchived: boolean;
}

export interface ContentLesson {
  id: string;
  title: string;
  description: string;
  textContent: string;
  instructions: string;
  order: number;
  isArchived: boolean;
  resources: ContentResource[];
}

export interface ContentModule {
  id: string;
  title: string;
  description: string;
  order: number;
  isArchived: boolean;
  lessons: ContentLesson[];
}

export interface TrainingContent {
  trainingId: string;
  access: ContentAccess;
  modules: ContentModule[];
}

export type TutorMode =
  'QUESTION' | 'SIMPLIFY' | 'EXAMPLE' | 'PRACTICE' | 'SUMMARY' | 'REVISION';

export interface TutorCitation {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  href: string;
}

export interface TutorResponse {
  answer: string;
  grounded: boolean;
  citations: TutorCitation[];
  followUpQuestions: string[];
  metadata: {
    provider: string;
    model: string;
    retrievedLessonCount: number;
    contextChars: number;
  };
}

export interface LessonCompletion {
  lessonId: string;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  title: string;
  order: number;
  completed: boolean;
  completedAt?: string;
}

export interface ProgressSummary {
  enrollmentId: string;
  training: { id: string; title: string };
  completedLessonCount: number;
  totalLessonCount: number;
  percentage: number;
  isComplete: boolean;
  lockedByCertificate: boolean;
  lessons: LessonCompletion[];
}

export interface PaginatedProgress {
  items: ProgressSummary[];
  page: number;
  pageSize: number;
  total: number;
}
