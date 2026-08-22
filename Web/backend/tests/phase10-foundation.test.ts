import { describe, expect, it } from 'vitest';

import { openApiDocument } from '../src/infrastructure/openapi/document.js';
import { CertificateModel } from '../src/modules/certificates/models/certificate.model.js';
import { createFeedbackSchema } from '../src/modules/feedback/dto/feedback.dto.js';
import { FeedbackModel } from '../src/modules/feedback/models/feedback.model.js';

describe('Phase 10 persistence and API boundaries', () => {
  it('enforces one Certificate per Enrollment and unique numbers', () => {
    const indexes = CertificateModel.schema.indexes();
    expect(
      indexes.some(
        ([fields, options]) =>
          fields['enrollmentId'] === 1 && options.unique === true,
      ),
    ).toBe(true);
    expect(
      indexes.some(
        ([fields, options]) =>
          fields['number'] === 1 && options.unique === true,
      ),
    ).toBe(true);
  });

  it('accepts only a strict integer 1-to-5 Feedback and indexes it immutably', () => {
    const enrollmentId = '507f1f77bcf86cd799439011';
    expect(
      createFeedbackSchema.safeParse({ enrollmentId, rating: 5 }).success,
    ).toBe(true);
    expect(
      createFeedbackSchema.safeParse({ enrollmentId, rating: 3.5 }).success,
    ).toBe(false);
    expect(
      createFeedbackSchema.safeParse({
        enrollmentId,
        rating: 4,
        comment: 'Out of scope',
      }).success,
    ).toBe(false);
    expect(
      FeedbackModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['enrollmentId'] === 1 && options.unique === true,
        ),
    ).toBe(true);
  });

  it('documents every Certificate and Feedback endpoint', () => {
    const paths = openApiDocument.paths;
    expect(paths['/certificates']?.get).toBeDefined();
    expect(paths['/certificates/generate']?.post).toBeDefined();
    expect(paths['/certificates/{id}']?.get).toBeDefined();
    expect(paths['/certificates/{id}/pdf']?.get).toBeDefined();
    expect(paths['/feedback']?.post).toBeDefined();
    expect(paths['/feedback']?.get).toBeDefined();
  });
});
