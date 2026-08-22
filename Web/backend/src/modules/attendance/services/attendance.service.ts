import mongoose, { type HydratedDocument } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { calculateAttendanceCompletion } from '../../completion/services/completion.service.js';
import { SessionScheduleModel } from '../../sessions/models/session-schedule.model.js';
import {
  TrainingSessionModel,
  type TrainingSession,
} from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type { BulkAttendanceInput } from '../dto/attendance.dto.js';
import { AttendanceModel } from '../models/attendance.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

export class AttendanceService {
  async sessionAttendance(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ) {
    passwordReady(principal);
    const session = await this.#session(sessionId);
    const training = await TrainingModel.findById(session.trainingId).exec();
    if (training === null || training.type !== 'IN_PERSON') {
      throw new AppError(
        409,
        'IN_PERSON_SESSION_REQUIRED',
        'Attendance is available only for an in-person Session.',
      );
    }
    const learnerEnrollment = await this.#authorizeReader(principal, session);
    const enrollmentFilter = {
      sessionId: session._id,
      ...(learnerEnrollment === undefined
        ? {}
        : { _id: learnerEnrollment._id }),
    };
    const [schedules, enrollments] = await Promise.all([
      SessionScheduleModel.find({ sessionId: session._id })
        .sort({ startAt: 1, _id: 1 })
        .exec(),
      EnrollmentModel.find(enrollmentFilter)
        .sort({ createdAt: 1, _id: 1 })
        .exec(),
    ]);
    const [attendances, learners] = await Promise.all([
      AttendanceModel.find({
        sessionId: session._id,
        enrollmentId: { $in: enrollments.map(({ _id }) => _id) },
      }).exec(),
      UserModel.find({
        _id: { $in: enrollments.map(({ learnerId }) => learnerId) },
      }).exec(),
    ]);
    const attendanceByKey = new Map(
      attendances.map((entry) => [
        `${String(entry.enrollmentId)}:${String(entry.scheduleId)}`,
        entry,
      ]),
    );
    const learnerById = new Map(
      learners.map((learner) => [String(learner._id), learner]),
    );
    const minimumAttendancePercent = training.minimumAttendancePercent ?? 80;
    const roster = enrollments.map((enrollment) => {
      const learner = learnerById.get(String(enrollment.learnerId));
      if (learner === undefined) {
        throw new Error('Attendance learner reference is inconsistent.');
      }
      const records = schedules.map((schedule) => {
        const attendance = attendanceByKey.get(
          `${String(enrollment._id)}:${String(schedule._id)}`,
        );
        return {
          scheduleId: String(schedule._id),
          status: attendance?.status ?? null,
          ...(attendance === undefined
            ? {}
            : { updatedAt: attendance.updatedAt.toISOString() }),
        };
      });
      const presentCount = records.filter(
        ({ status }) => status === 'PRESENT',
      ).length;
      const recordedCount = records.filter(
        ({ status }) => status !== null,
      ).length;
      const calculated = calculateAttendanceCompletion({
        presentCount,
        recordedCount,
        totalScheduleCount: schedules.length,
        minimumAttendancePercent,
        sessionCompleted: session.status === 'COMPLETED',
      });
      return {
        enrollmentId: String(enrollment._id),
        learner: {
          id: String(learner._id),
          email: learner.email,
          ...learner.profile,
        },
        presentCount,
        recordedCount,
        totalScheduleCount: schedules.length,
        attendancePercentage: calculated.attendancePercentage,
        attendanceCoverageComplete: calculated.attendanceCoverageComplete,
        meetsAttendanceThreshold: calculated.meetsAttendanceThreshold,
        isComplete: calculated.isComplete,
        records,
      };
    });
    return {
      session: {
        id: String(session._id),
        title: session.title,
        status: session.status,
        training: { id: String(training._id), title: training.title },
      },
      minimumAttendancePercent,
      immutable: session.status === 'COMPLETED',
      canRecord:
        principal.role !== 'LEARNER' &&
        (session.status === 'PLANNED' || session.status === 'IN_PROGRESS'),
      schedules: schedules.map((schedule) => ({
        id: String(schedule._id),
        startAt: schedule.startAt.toISOString(),
        endAt: schedule.endAt.toISOString(),
        location: schedule.location ?? session.location,
        ...((schedule.room ?? session.room) === undefined
          ? {}
          : { room: schedule.room ?? session.room }),
      })),
      roster,
    };
  }

  async recordSchedule(
    principal: AuthenticatedPrincipal,
    scheduleId: string,
    input: BulkAttendanceInput,
  ) {
    passwordReady(principal);
    if (principal.role === 'LEARNER') {
      throw new AppError(
        403,
        'ATTENDANCE_RECORDING_FORBIDDEN',
        'Only an Admin or assigned Trainer can record Attendance.',
      );
    }
    const schedule = await SessionScheduleModel.findById(scheduleId).exec();
    if (schedule === null) {
      throw new AppError(
        404,
        'SCHEDULE_NOT_FOUND',
        'The schedule does not exist.',
      );
    }
    const session = await this.#session(String(schedule.sessionId));
    this.#authorizeRecorder(principal, session);
    const enrollmentIds = input.entries.map(
      ({ enrollmentId }) => new mongoose.Types.ObjectId(enrollmentId),
    );
    await mongoose.connection.transaction(async (databaseSession) => {
      const lockedSession = await TrainingSessionModel.findOneAndUpdate(
        {
          _id: session._id,
          status: { $in: ['PLANNED', 'IN_PROGRESS'] },
        },
        { $set: { updatedAt: new Date() } },
        { session: databaseSession, returnDocument: 'after' },
      ).exec();
      if (lockedSession === null) {
        throw new AppError(
          409,
          'ATTENDANCE_IMMUTABLE',
          'Attendance cannot change after Session completion or cancellation.',
        );
      }
      this.#authorizeRecorder(principal, lockedSession);
      const enrollments = await EnrollmentModel.find({
        _id: { $in: enrollmentIds },
        sessionId: lockedSession._id,
        trainingId: lockedSession.trainingId,
      })
        .session(databaseSession)
        .exec();
      if (enrollments.length !== enrollmentIds.length) {
        throw new AppError(
          422,
          'SESSION_ENROLLMENTS_REQUIRED',
          'Every Attendance entry must reference an Enrollment in this Session.',
        );
      }
      const enrollmentById = new Map(
        enrollments.map((enrollment) => [String(enrollment._id), enrollment]),
      );
      const now = new Date();
      await AttendanceModel.bulkWrite(
        input.entries.map((entry) => {
          const enrollment = enrollmentById.get(entry.enrollmentId);
          if (enrollment === undefined) {
            throw new Error('Validated Enrollment reference is inconsistent.');
          }
          return {
            updateOne: {
              filter: {
                enrollmentId: enrollment._id,
                scheduleId: schedule._id,
              },
              update: {
                $set: {
                  status: entry.status,
                  recordedById: new mongoose.Types.ObjectId(principal.userId),
                  updatedAt: now,
                },
                $setOnInsert: {
                  enrollmentId: enrollment._id,
                  learnerId: enrollment.learnerId,
                  trainingId: enrollment.trainingId,
                  sessionId: lockedSession._id,
                  scheduleId: schedule._id,
                  createdAt: now,
                },
              },
              upsert: true,
            },
          };
        }),
        { session: databaseSession },
      );
    });
    return await this.sessionAttendance(principal, String(session._id));
  }

  async #authorizeReader(
    principal: AuthenticatedPrincipal,
    session: HydratedDocument<TrainingSession>,
  ) {
    if (principal.role === 'ADMIN') return undefined;
    if (principal.role === 'TRAINER') {
      if (
        session.assignedTrainerIds.some(
          (trainerId) => String(trainerId) === principal.userId,
        )
      ) {
        return undefined;
      }
      throw new AppError(
        403,
        'ATTENDANCE_ACCESS_FORBIDDEN',
        'The Trainer must be assigned to this Session.',
      );
    }
    const enrollment = await EnrollmentModel.findOne({
      learnerId: principal.userId,
      sessionId: session._id,
    }).exec();
    if (enrollment === null) {
      throw new AppError(
        403,
        'SESSION_ENROLLMENT_REQUIRED',
        'A paid Enrollment in this Session is required.',
      );
    }
    return enrollment;
  }

  #authorizeRecorder(
    principal: AuthenticatedPrincipal,
    session: HydratedDocument<TrainingSession>,
  ): void {
    if (principal.role === 'ADMIN') return;
    if (
      principal.role === 'TRAINER' &&
      session.assignedTrainerIds.some(
        (trainerId) => String(trainerId) === principal.userId,
      )
    ) {
      return;
    }
    throw new AppError(
      403,
      'ATTENDANCE_RECORDING_FORBIDDEN',
      'Only an Admin or assigned Trainer can record Attendance.',
    );
  }

  async #session(
    sessionId: string,
  ): Promise<HydratedDocument<TrainingSession>> {
    const session = await TrainingSessionModel.findById(sessionId).exec();
    if (session === null) {
      throw new AppError(
        404,
        'SESSION_NOT_FOUND',
        'The Session does not exist.',
      );
    }
    return session;
  }
}
