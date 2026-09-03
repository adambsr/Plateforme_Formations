import * as SecureStore from 'expo-secure-store';

import { trackAnalyticsEvent } from './firebase';

const attributionKey = 'recommendation-attribution';
const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
const impressions = new Set<string>();

export interface RecommendationMeasurement {
  trainingId: string;
  categoryName: string;
  rank: number;
}
interface Attribution extends RecommendationMeasurement {
  clickedAt: number;
}

export function trackRecommendationImpressions(
  items: RecommendationMeasurement[],
): void {
  for (const item of items) {
    const key = `${item.trainingId}:${item.rank}`;
    if (impressions.has(key)) continue;
    impressions.add(key);
    void trackAnalyticsEvent('recommendation_impression', {
      training_id: item.trainingId,
      training_category: item.categoryName,
      recommendation_rank: item.rank,
    });
  }
}

export async function trackRecommendationClick(
  item: RecommendationMeasurement,
): Promise<void> {
  await SecureStore.setItemAsync(
    attributionKey,
    JSON.stringify({ ...item, clickedAt: Date.now() }),
  );
  await trackAnalyticsEvent('recommendation_click', {
    training_id: item.trainingId,
    training_category: item.categoryName,
    recommendation_rank: item.rank,
  });
}

export async function trackRecommendationEnrollment(
  trainingId: string,
): Promise<void> {
  const stored = await SecureStore.getItemAsync(attributionKey);
  if (stored === null) return;
  try {
    const item = JSON.parse(stored) as Attribution;
    if (
      item.trainingId !== trainingId ||
      Date.now() - item.clickedAt > lifetimeMs
    ) {
      if (Date.now() - item.clickedAt > lifetimeMs)
        await SecureStore.deleteItemAsync(attributionKey);
      return;
    }
    await trackAnalyticsEvent('recommendation_enrollment', {
      training_id: item.trainingId,
      training_category: item.categoryName,
      recommendation_rank: item.rank,
    });
    await SecureStore.deleteItemAsync(attributionKey);
  } catch {
    await SecureStore.deleteItemAsync(attributionKey);
  }
}
