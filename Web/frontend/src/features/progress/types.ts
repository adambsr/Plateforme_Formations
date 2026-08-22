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
