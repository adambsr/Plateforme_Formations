export type SessionStatus =
  'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface SessionTrainer {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface SessionSchedule {
  id: string;
  startAt: string;
  endAt: string;
  moduleId?: string;
  lessonId?: string;
  trainers: SessionTrainer[];
  location?: string;
  address?: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSession {
  id: string;
  training: { id: string; title: string };
  title: string;
  identifier?: string;
  capacity: number;
  enrolledCount: number;
  availableSeats: number;
  assignedTrainers: SessionTrainer[];
  location: string;
  address: string;
  room?: string;
  additionalInformation: string;
  status: SessionStatus;
  startAt?: string;
  endAt?: string;
  schedules: SessionSchedule[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSessions {
  items: TrainingSession[];
  page: number;
  pageSize: number;
  total: number;
}
