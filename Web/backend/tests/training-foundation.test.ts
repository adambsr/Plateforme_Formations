import { describe, expect, it } from 'vitest';

import {
  isPositiveTndMinorAmount,
  publicationBlockReason,
  TRAINING_STATUSES,
  TRAINING_TYPES,
} from '../src/modules/trainings/domain/training.js';
import {
  createTrainingSchema,
  updateTrainingSchema,
} from '../src/modules/trainings/dto/training.dto.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';

describe('Training catalogue foundation', () => {
  it('locks the exact Training modalities and lifecycle states', () => {
    expect(TRAINING_TYPES).toEqual(['SELF_PACED_ONLINE', 'IN_PERSON']);
    expect(TRAINING_STATUSES).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
  });

  it('accepts only positive safe integer TND minor amounts', () => {
    expect(isPositiveTndMinorAmount(1)).toBe(true);
    expect(isPositiveTndMinorAmount(1_500)).toBe(true);
    expect(isPositiveTndMinorAmount(0)).toBe(false);
    expect(isPositiveTndMinorAmount(1.5)).toBe(false);
    expect(isPositiveTndMinorAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('blocks self-paced publication without a Module containing a Lesson', () => {
    expect(
      publicationBlockReason({
        type: 'SELF_PACED_ONLINE',
        hasModuleWithLesson: false,
      }),
    ).toContain('requires at least one Module');
    expect(
      publicationBlockReason({
        type: 'SELF_PACED_ONLINE',
        hasModuleWithLesson: true,
      }),
    ).toBeUndefined();
    expect(
      publicationBlockReason({
        type: 'IN_PERSON',
        hasModuleWithLesson: false,
      }),
    ).toBeUndefined();
  });

  it('rejects free prices, unknown types, and immutable fields in updates', () => {
    const base = {
      title: 'TypeScript avancé',
      description: 'Une formation complète.',
      categoryId: '507f1f77bcf86cd799439011',
      level: 'Avancé',
      durationMinutes: 720,
      objectives: ['Maîtriser TypeScript'],
      prerequisites: ['JavaScript'],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 25_000,
    };
    expect(createTrainingSchema.safeParse(base).success).toBe(true);
    expect(
      createTrainingSchema.safeParse({ ...base, priceMinor: 0 }).success,
    ).toBe(false);
    expect(
      createTrainingSchema.safeParse({ ...base, type: 'HYBRID' }).success,
    ).toBe(false);
    expect(updateTrainingSchema.safeParse({ type: 'IN_PERSON' }).success).toBe(
      false,
    );
    expect(
      updateTrainingSchema.safeParse({
        ownerTrainerId: '507f1f77bcf86cd799439012',
      }).success,
    ).toBe(false);
  });

  it('declares catalogue and owner indexes and immutable type/currency fields', () => {
    const categoryIndexes = TrainingCategoryModel.schema.indexes();
    const trainingIndexes = TrainingModel.schema.indexes();
    expect(
      categoryIndexes.some(
        ([, options]) => options.name === 'unique_training_category_name',
      ),
    ).toBe(true);
    expect(
      trainingIndexes.some(
        ([, options]) => options.name === 'training_public_catalogue',
      ),
    ).toBe(true);
    expect(
      trainingIndexes.some(
        ([, options]) => options.name === 'training_owner_dashboard',
      ),
    ).toBe(true);
    expect(TrainingModel.schema.path('type').options.immutable).toBe(true);
    expect(TrainingModel.schema.path('currency').options.immutable).toBe(true);
  });
});
