import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import { LocalFileStorage } from '../src/infrastructure/files/local-file-storage.js';
import {
  createResourceSchema,
  updateLessonSchema,
} from '../src/modules/content/dto/content.dto.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { TrainingResourceModel } from '../src/modules/content/models/training-resource.model.js';
import {
  normalizePlace,
  normalizedRoomKey,
  schedulesOverlap,
  SESSION_STATUSES,
} from '../src/modules/sessions/domain/session.js';
import {
  createScheduleSchema,
  updateSessionSchema,
} from '../src/modules/sessions/dto/session.dto.js';
import { SessionScheduleModel } from '../src/modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';

describe('Phase 3 content foundation', () => {
  it('accepts only HTTP(S) external resources and immutable resource types', () => {
    const base = {
      title: 'Documentation',
      description: '',
      order: 1,
      type: 'EXTERNAL_URL',
      isVisibleToLearners: true,
    };
    expect(
      createResourceSchema.safeParse({
        ...base,
        externalUrl: 'https://example.test/guide',
      }).success,
    ).toBe(true);
    expect(
      createResourceSchema.safeParse({
        ...base,
        externalUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(updateLessonSchema.safeParse({ moduleId: 'x' }).success).toBe(false);
  });

  it('declares deterministic parent-order and file-reference indexes', () => {
    expect(
      TrainingModuleModel.schema
        .indexes()
        .some(
          ([, options]) => options.name === 'unique_module_order_per_training',
        ),
    ).toBe(true);
    expect(
      LessonModel.schema
        .indexes()
        .some(
          ([, options]) => options.name === 'unique_lesson_order_per_module',
        ),
    ).toBe(true);
    expect(
      TrainingResourceModel.schema
        .indexes()
        .some(
          ([, options]) =>
            options.name === 'unique_training_resource_file_path',
        ),
    ).toBe(true);
  });

  it('rejects traversal when resolving protected storage paths', () => {
    const storage = new LocalFileStorage('./uploads-test', 20);
    expect(() => storage.resolve('../outside.txt')).toThrow(
      'stored file path is invalid',
    );
    expect(storage.resolve('training-resources/ab/file.txt')).toContain(
      'training-resources',
    );
  });

  it('validates text file content and configured size before storage', async () => {
    const storage = new LocalFileStorage('./uploads-test', 1);
    const invalidText = {
      originalname: 'binary.txt',
      mimetype: 'text/plain',
      size: 3,
      buffer: Buffer.from([0, 1, 2]),
    } as Express.Multer.File;
    await expect(storage.store(invalidText)).rejects.toMatchObject({
      code: 'FILE_SIGNATURE_MISMATCH',
    });
  });
});

describe('Phase 4 Session and schedule foundation', () => {
  it('locks Session states and overlap boundary behavior', () => {
    expect(SESSION_STATUSES).toEqual([
      'PLANNED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ]);
    const first = {
      startAt: new Date('2026-04-01T08:00:00.000Z'),
      endAt: new Date('2026-04-01T09:00:00.000Z'),
    };
    expect(
      schedulesOverlap(first, {
        startAt: new Date('2026-04-01T08:30:00.000Z'),
        endAt: new Date('2026-04-01T09:30:00.000Z'),
      }),
    ).toBe(true);
    expect(
      schedulesOverlap(first, {
        startAt: new Date('2026-04-01T09:00:00.000Z'),
        endAt: new Date('2026-04-01T10:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('normalizes room conflicts and skips room checks without a room', () => {
    expect(normalizePlace('  Centre   Tunis  ')).toBe('centre tunis');
    expect(normalizedRoomKey('Centre Tunis', ' Salle A ')).toBe(
      'centre tunis\u0000salle a',
    );
    expect(normalizedRoomKey('Centre Tunis', undefined)).toBeUndefined();
  });

  it('requires explicit API offsets and a strictly positive range', () => {
    const base = {
      startAt: '2026-04-01T09:00:00+01:00',
      endAt: '2026-04-01T10:00:00+01:00',
      trainerIds: ['507f1f77bcf86cd799439011'],
    };
    expect(createScheduleSchema.safeParse(base).success).toBe(true);
    expect(
      createScheduleSchema.safeParse({
        ...base,
        startAt: '2026-04-01T09:00:00',
      }).success,
    ).toBe(false);
    expect(
      createScheduleSchema.safeParse({
        ...base,
        endAt: '2026-04-01T08:00:00+01:00',
      }).success,
    ).toBe(false);
  });

  it('excludes lifecycle, Enrollment count, and parent Training from updates', () => {
    expect(updateSessionSchema.safeParse({ status: 'COMPLETED' }).success).toBe(
      false,
    );
    expect(updateSessionSchema.safeParse({ enrolledCount: 3 }).success).toBe(
      false,
    );
    expect(
      updateSessionSchema.safeParse({
        trainingId: '507f1f77bcf86cd799439011',
      }).success,
    ).toBe(false);
  });

  it('declares schedule conflict and assignment indexes', () => {
    expect(
      TrainingSessionModel.schema
        .indexes()
        .some(([, options]) => options.name === 'assigned_trainer_sessions'),
    ).toBe(true);
    expect(
      SessionScheduleModel.schema
        .indexes()
        .some(([, options]) => options.name === 'schedule_trainer_conflicts'),
    ).toBe(true);
    expect(
      SessionScheduleModel.schema
        .indexes()
        .some(([, options]) => options.name === 'schedule_room_conflicts'),
    ).toBe(true);
  });
});
