import {
  formatDuration,
  formatEur,
  trainingTypeLabel,
} from '../src/features/trainings/format';
import { trainingListPath } from '../src/features/trainings/training-api';

describe('Mobile Training catalogue contract', () => {
  it('builds the same public catalogue filters as Web', () => {
    expect(
      trainingListPath({
        page: 2,
        pageSize: 9,
        categoryId: '64b64c25f08c4d8f780a1234',
        type: 'SELF_PACED_ONLINE',
      }),
    ).toBe(
      '/trainings?page=2&pageSize=9&categoryId=64b64c25f08c4d8f780a1234&type=SELF_PACED_ONLINE',
    );
  });

  it('omits inactive filters instead of inventing API values', () => {
    expect(trainingListPath({ page: 1 })).toBe('/trainings?page=1&pageSize=9');
  });

  it('uses the Web terminology and display rules', () => {
    expect(trainingTypeLabel('SELF_PACED_ONLINE')).toBe('En ligne autonome');
    expect(trainingTypeLabel('IN_PERSON')).toBe('Présentiel');
    expect(formatDuration(135)).toBe('2 h 15 min');
    expect(formatEur(12500)).toContain('125,00');
  });
});
