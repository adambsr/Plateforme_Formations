import { apiClient, type ApiClient } from '../../core/api/client';
import type {
  PaginatedTrainings,
  Training,
  TrainingCategory,
  TrainingType,
} from './types';

export interface TrainingFilters {
  page: number;
  pageSize?: number;
  categoryId?: string;
  type?: TrainingType;
}

export function trainingListPath({
  page,
  pageSize = 9,
  categoryId,
  type,
}: TrainingFilters): string {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (categoryId !== undefined) query.set('categoryId', categoryId);
  if (type !== undefined) query.set('type', type);
  return `/trainings?${query.toString()}`;
}

export function createTrainingApi(client: ApiClient = apiClient) {
  return {
    listCategories: () => client.request<TrainingCategory[]>('/categories'),
    listTrainings: (filters: TrainingFilters) =>
      client.request<PaginatedTrainings>(trainingListPath(filters)),
    getTraining: (trainingId: string) =>
      client.request<Training>(`/trainings/${trainingId}`),
  };
}

export const trainingApi = createTrainingApi();
