export type TrainingType = 'SELF_PACED_ONLINE' | 'IN_PERSON';
export type TrainingStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface TrainingCategory {
  id: string;
  name: string;
  description?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  category: Pick<TrainingCategory, 'id' | 'name' | 'isArchived'>;
  level: string;
  durationMinutes: number;
  objectives: string[];
  prerequisites: string[];
  type: TrainingType;
  priceMinor: number;
  currency: 'TND';
  ownerTrainer: { id: string; firstName?: string; lastName?: string };
  status: TrainingStatus;
  minimumAttendancePercent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTrainings {
  items: Training[];
  page: number;
  pageSize: number;
  total: number;
}
