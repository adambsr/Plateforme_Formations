import { describe, expect, it } from 'vitest';

import { openApiDocument } from '../src/infrastructure/openapi/document.js';
import { ATTENDANCE_STATUSES } from '../src/modules/attendance/domain/attendance.js';
import { bulkAttendanceSchema } from '../src/modules/attendance/dto/attendance.dto.js';
import { AttendanceModel } from '../src/modules/attendance/models/attendance.model.js';
import { updateLessonProgressSchema } from '../src/modules/progress/dto/progress.dto.js';
import { LessonProgressModel } from '../src/modules/progress/models/lesson-progress.model.js';

describe('Phase 6 and 7 persistence and request boundaries', () => {
  it('uses only PRESENT and ABSENT Attendance statuses', () => {
    expect(ATTENDANCE_STATUSES).toEqual(['PRESENT', 'ABSENT']);
    expect(
      bulkAttendanceSchema.safeParse({
        entries: [
          {
            enrollmentId: '507f1f77bcf86cd799439011',
            status: 'LATE',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate Enrollment entries and progress mass assignment', () => {
    expect(
      bulkAttendanceSchema.safeParse({
        entries: [
          {
            enrollmentId: '507f1f77bcf86cd799439011',
            status: 'PRESENT',
          },
          {
            enrollmentId: '507f1f77bcf86cd799439011',
            status: 'ABSENT',
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      updateLessonProgressSchema.safeParse({
        completed: true,
        percentage: 100,
        completedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });

  it('declares the required Enrollment/Lesson and Enrollment/Schedule unique indexes', () => {
    expect(
      LessonProgressModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['enrollmentId'] === 1 &&
            fields['lessonId'] === 1 &&
            options.unique === true,
        ),
    ).toBe(true);
    expect(
      AttendanceModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['enrollmentId'] === 1 &&
            fields['scheduleId'] === 1 &&
            options.unique === true,
        ),
    ).toBe(true);
  });

  it('documents every Phase 6 and 7 operation in OpenAPI', () => {
    expect(openApiDocument.paths['/progress']?.get).toBeDefined();
    expect(
      openApiDocument.paths['/progress/lessons/{lessonId}']?.put,
    ).toBeDefined();
    expect(
      openApiDocument.paths['/sessions/{id}/attendance']?.get,
    ).toBeDefined();
    expect(
      openApiDocument.paths['/schedules/{id}/attendance']?.put,
    ).toBeDefined();
  });
});
