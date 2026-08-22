import type { Types } from 'mongoose';

import { LessonModel } from '../../content/models/lesson.model.js';
import { TrainingModuleModel } from '../../content/models/training-module.model.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { LessonProgressModel } from '../../progress/models/lesson-progress.model.js';
import { SessionScheduleModel } from '../../sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { AttendanceModel } from '../../attendance/models/attendance.model.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface SelfPacedLessonCompletion {
  lessonId: string;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  title: string;
  order: number;
  completed: boolean;
  completedAt?: string;
}

export interface SelfPacedCompletion {
  enrollmentId: string;
  training: { id: string; title: string };
  completedLessonCount: number;
  totalLessonCount: number;
  percentage: number;
  isComplete: boolean;
  lockedByCertificate: boolean;
  lessons: SelfPacedLessonCompletion[];
}

export interface InPersonCompletion {
  enrollmentId: string;
  sessionId: string;
  trainingId: string;
  presentCount: number;
  recordedCount: number;
  totalScheduleCount: number;
  attendancePercentage: number;
  minimumAttendancePercent: number;
  attendanceCoverageComplete: boolean;
  meetsAttendanceThreshold: boolean;
  isComplete: boolean;
}

export interface AttendanceCompletionInput {
  presentCount: number;
  recordedCount: number;
  totalScheduleCount: number;
  minimumAttendancePercent: number;
  sessionCompleted: boolean;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function calculateAttendanceCompletion({
  presentCount,
  recordedCount,
  totalScheduleCount,
  minimumAttendancePercent,
  sessionCompleted,
}: AttendanceCompletionInput) {
  const calculatedPercentage = percentage(presentCount, totalScheduleCount);
  const attendanceCoverageComplete =
    totalScheduleCount > 0 && recordedCount === totalScheduleCount;
  const meetsAttendanceThreshold =
    attendanceCoverageComplete &&
    calculatedPercentage >= minimumAttendancePercent;
  return {
    attendancePercentage: calculatedPercentage,
    attendanceCoverageComplete,
    meetsAttendanceThreshold,
    isComplete: sessionCompleted && meetsAttendanceThreshold,
  };
}

export class CompletionService {
  async selfPaced(
    enrollmentId: string | Types.ObjectId,
  ): Promise<SelfPacedCompletion> {
    const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
    if (enrollment === null || enrollment.sessionId != null) {
      throw new AppError(
        404,
        'SELF_PACED_ENROLLMENT_NOT_FOUND',
        'The self-paced Enrollment does not exist.',
      );
    }
    const training = await TrainingModel.findById(enrollment.trainingId).exec();
    if (training === null || training.type !== 'SELF_PACED_ONLINE') {
      throw new AppError(
        409,
        'SELF_PACED_TRAINING_REQUIRED',
        'Progress is available only for self-paced Trainings.',
      );
    }
    const certificate = await TrainingModel.db
      .collection<{
        enrollmentId: Types.ObjectId;
        issuedAt?: Date;
        createdAt?: Date;
      }>('certificates')
      .findOne(
        { enrollmentId: enrollment._id },
        { projection: { issuedAt: 1, createdAt: 1 } },
      );
    const certificateCutoff = certificate?.issuedAt ?? certificate?.createdAt;
    const modules = await TrainingModuleModel.find({
      trainingId: training._id,
      isArchived: false,
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    const moduleIds = modules.map(({ _id }) => _id);
    const lessons = await LessonModel.find({
      trainingId: training._id,
      moduleId: { $in: moduleIds },
      isArchived: false,
      ...(certificateCutoff === undefined
        ? {}
        : { createdAt: { $lte: certificateCutoff } }),
    })
      .sort({ moduleId: 1, order: 1, _id: 1 })
      .exec();
    const progress = await LessonProgressModel.find({
      enrollmentId: enrollment._id,
      lessonId: { $in: lessons.map(({ _id }) => _id) },
    }).exec();
    const progressByLesson = new Map(
      progress.map((entry) => [String(entry.lessonId), entry]),
    );
    const modulesById = new Map(
      modules.map((module) => [String(module._id), module]),
    );
    const lessonViews = lessons
      .map((lesson): SelfPacedLessonCompletion => {
        const module = modulesById.get(String(lesson.moduleId));
        if (module === undefined) {
          throw new Error('Lesson Module reference is inconsistent.');
        }
        const entry = progressByLesson.get(String(lesson._id));
        return {
          lessonId: String(lesson._id),
          moduleId: String(module._id),
          moduleTitle: module.title,
          moduleOrder: module.order,
          title: lesson.title,
          order: lesson.order,
          completed: entry?.completed ?? false,
          ...(entry?.completedAt === null || entry?.completedAt === undefined
            ? {}
            : { completedAt: entry.completedAt.toISOString() }),
        };
      })
      .sort(
        (left, right) =>
          left.moduleOrder - right.moduleOrder ||
          left.order - right.order ||
          left.lessonId.localeCompare(right.lessonId),
      );
    const completedLessonCount = lessonViews.filter(
      ({ completed }) => completed,
    ).length;
    const totalLessonCount = lessonViews.length;
    const lockedByCertificate = certificate !== null;
    return {
      enrollmentId: String(enrollment._id),
      training: { id: String(training._id), title: training.title },
      completedLessonCount,
      totalLessonCount,
      percentage:
        lockedByCertificate && totalLessonCount === 0
          ? 100
          : percentage(completedLessonCount, totalLessonCount),
      isComplete:
        lockedByCertificate ||
        (totalLessonCount > 0 && completedLessonCount === totalLessonCount),
      lockedByCertificate,
      lessons: lessonViews,
    };
  }

  async inPerson(
    enrollmentId: string | Types.ObjectId,
  ): Promise<InPersonCompletion> {
    const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
    const sessionId = enrollment?.sessionId;
    if (enrollment === null || sessionId == null) {
      throw new AppError(
        404,
        'IN_PERSON_ENROLLMENT_NOT_FOUND',
        'The in-person Enrollment does not exist.',
      );
    }
    const [training, session, scheduleIds] = await Promise.all([
      TrainingModel.findById(enrollment.trainingId).exec(),
      TrainingSessionModel.findById(sessionId).exec(),
      SessionScheduleModel.find({ sessionId }).distinct('_id'),
    ]);
    if (
      training === null ||
      training.type !== 'IN_PERSON' ||
      session === null
    ) {
      throw new AppError(
        409,
        'IN_PERSON_TRAINING_REQUIRED',
        'Attendance completion requires an in-person Training and Session.',
      );
    }
    const attendance = await AttendanceModel.find({
      enrollmentId: enrollment._id,
      scheduleId: { $in: scheduleIds },
    }).exec();
    const presentCount = attendance.filter(
      ({ status }) => status === 'PRESENT',
    ).length;
    const totalScheduleCount = scheduleIds.length;
    const minimumAttendancePercent = training.minimumAttendancePercent ?? 80;
    const calculated = calculateAttendanceCompletion({
      presentCount,
      recordedCount: attendance.length,
      totalScheduleCount,
      minimumAttendancePercent,
      sessionCompleted: session.status === 'COMPLETED',
    });
    return {
      enrollmentId: String(enrollment._id),
      sessionId: String(session._id),
      trainingId: String(training._id),
      presentCount,
      recordedCount: attendance.length,
      totalScheduleCount,
      attendancePercentage: calculated.attendancePercentage,
      minimumAttendancePercent,
      attendanceCoverageComplete: calculated.attendanceCoverageComplete,
      meetsAttendanceThreshold: calculated.meetsAttendanceThreshold,
      isComplete: calculated.isComplete,
    };
  }
}
