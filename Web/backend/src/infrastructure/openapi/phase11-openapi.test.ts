import { describe, expect, it } from 'vitest';

import { openApiDocument } from './document.js';

describe('Phase 11 OpenAPI contract', () => {
  it('documents every cost and dashboard route', () => {
    for (const path of [
      '/costs/trainers',
      '/costs/trainers/{trainerId}/{year}/{month}',
      '/costs/trainings',
      '/costs/trainings/{id}',
      '/dashboard/overview',
      '/dashboard/participation',
      '/dashboard/progress',
      '/dashboard/satisfaction',
      '/dashboard/financial',
      '/dashboard/profitability',
    ])
      expect(openApiDocument.paths[path]).toBeDefined();
  });

  it('documents integer EUR minor units and null zero-revenue semantics', () => {
    expect(openApiDocument.components?.schemas?.TrainerCostWrite).toBeDefined();
    expect(JSON.stringify(openApiDocument)).toContain(
      'EUR centimes; integer only.',
    );
    expect(JSON.stringify(openApiDocument)).toContain(
      'pre-fixed-cost Training results',
    );
  });
});
