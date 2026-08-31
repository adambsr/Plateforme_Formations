import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  trackRecommendationClick,
  trackRecommendationEnrollment,
  trackRecommendationImpressions,
} from './recommendation-analytics.js';
import { trackAnalyticsEvent } from './firebase.js';

vi.mock('./firebase.js', () => ({
  trackAnalyticsEvent: vi.fn(),
}));

beforeEach(() => {
  window.sessionStorage.clear();
  vi.mocked(trackAnalyticsEvent).mockReset();
});

describe('recommendation analytics', () => {
  it('records display and click events, then converts only the matching backend-confirmed Training', () => {
    const recommendation = {
      trainingId: 'training-analytics-1',
      categoryName: 'Development',
      rank: 1,
    };

    trackRecommendationImpressions([recommendation, recommendation]);
    trackRecommendationClick(recommendation);
    trackRecommendationEnrollment('another-training');
    trackRecommendationEnrollment(recommendation.trainingId);

    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(3);
    expect(trackAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      'recommendation_impression',
      {
        training_id: recommendation.trainingId,
        training_category: recommendation.categoryName,
        recommendation_rank: 1,
      },
    );
    expect(trackAnalyticsEvent).toHaveBeenLastCalledWith(
      'recommendation_enrollment',
      {
        training_id: recommendation.trainingId,
        training_category: recommendation.categoryName,
        recommendation_rank: 1,
      },
    );
  });
});
