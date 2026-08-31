import { trackAnalyticsEvent } from './firebase.js';

const attributionKey = 'recommendation-attribution';
const attributionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const trackedImpressions = new Set<string>();

interface RecommendationAttribution {
  trainingId: string;
  categoryName: string;
  rank: number;
  clickedAt: number;
}

export interface RecommendationMeasurement {
  trainingId: string;
  categoryName: string;
  rank: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readAttribution(): RecommendationAttribution | undefined {
  if (!isBrowser()) return undefined;
  try {
    const value = window.sessionStorage.getItem(attributionKey);
    if (value === null) return undefined;
    const parsed = JSON.parse(value) as RecommendationAttribution;
    if (
      typeof parsed.trainingId !== 'string' ||
      typeof parsed.categoryName !== 'string' ||
      !Number.isInteger(parsed.rank) ||
      typeof parsed.clickedAt !== 'number' ||
      Date.now() - parsed.clickedAt > attributionLifetimeMs
    ) {
      window.sessionStorage.removeItem(attributionKey);
      return undefined;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(attributionKey);
    return undefined;
  }
}

export function trackRecommendationImpressions(
  recommendations: RecommendationMeasurement[],
): void {
  for (const recommendation of recommendations) {
    const key = `${recommendation.trainingId}:${recommendation.rank}`;
    if (trackedImpressions.has(key)) continue;
    trackedImpressions.add(key);
    trackAnalyticsEvent('recommendation_impression', {
      training_id: recommendation.trainingId,
      training_category: recommendation.categoryName,
      recommendation_rank: recommendation.rank,
    });
  }
}

export function trackRecommendationClick(
  recommendation: RecommendationMeasurement,
): void {
  if (isBrowser()) {
    window.sessionStorage.setItem(
      attributionKey,
      JSON.stringify({ ...recommendation, clickedAt: Date.now() }),
    );
  }
  trackAnalyticsEvent('recommendation_click', {
    training_id: recommendation.trainingId,
    training_category: recommendation.categoryName,
    recommendation_rank: recommendation.rank,
  });
}

/** Emits a conversion only after the backend has confirmed the Enrollment. */
export function trackRecommendationEnrollment(trainingId: string): void {
  const attribution = readAttribution();
  if (attribution === undefined || attribution.trainingId !== trainingId) return;
  trackAnalyticsEvent('recommendation_enrollment', {
    training_id: attribution.trainingId,
    training_category: attribution.categoryName,
    recommendation_rank: attribution.rank,
  });
  if (isBrowser()) window.sessionStorage.removeItem(attributionKey);
}
