import mongoose, {
  type ClientSession,
  type HydratedDocument,
  type QueryFilter,
  type Types,
} from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { LessonModel } from '../../content/models/lesson.model.js';
import { TrainingModuleModel } from '../../content/models/training-module.model.js';
import { AttendanceModel } from '../../attendance/models/attendance.model.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import {
  TrainingModel,
  type Training,
} from '../../trainings/models/training.model.js';
import { UserModel, type User } from '../../users/models/user.model.js';
import { normalizedRoomKey, type SessionStatus } from '../domain/session.js';
import type {
  CreateScheduleInput,
  CreateSessionInput,
  SessionListInput,
  UpdateScheduleInput,
  UpdateSessionInput,
} from '../dto/session.dto.js';
import {
  SessionScheduleModel,
  type SessionSchedule,
} from '../models/session-schedule.model.js';
import {
  TrainingSessionModel,
  type TrainingSession,
} from '../models/training-session.model.js';

export interface SessionScheduleView {
  id: string;
  startAt: string;
  endAt: string;
  moduleId?: string;
  lessonId?: string;
  trainers: Array<{ id: string; firstName?: string; lastName?: string }>;
  location?: string;
  address?: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSessionView {
  id: string;
  training: { id: string; title: string };
  title: string;
  identifier?: string;
  capacity: number;
  enrolledCount: number;
  availableSeats: number;
  assignedTrainers: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
  }>;
  location: string;
  address: string;
  room?: string;
  additionalInformation: string;
  status: SessionStatus;
  startAt?: string;
  endAt?: string;
  schedules: SessionScheduleView[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSessions {
  items: TrainingSessionView[];
  page: number;
  pageSize: number;
  total: number;
}

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

function uniqueObjectIds(values: readonly string[]): Types.ObjectId[] {
  return [...new Set(values)].map(
    (value) => new mongoose.Types.ObjectId(value),
  );
}

export class SessionService {
  async listAssignableTrainers(principal: AuthenticatedPrincipal) {
    passwordReady(principal);
    if (principal.role === 'LEARNER') {
      throw new AppError(
        403,
        'SESSION_MANAGEMENT_FORBIDDEN',
        'Session management access is required.',
      );
    }
    const trainers = await UserModel.find({ role: 'TRAINER', isActive: true })
      .sort({ 'profile.firstName': 1, 'profile.lastName': 1, _id: 1 })
      .exec();
    return trainers.map((trainer) => this.#trainerView(trainer, trainer._id));
  }

  async listSessions(
    input: SessionListInput,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<PaginatedSessions> {
    const filter: QueryFilter<TrainingSession> = {};
    if (input.view === 'PUBLIC') {
      const publishedTrainingIds = await TrainingModel.find({
        type: 'IN_PERSON',
        status: 'PUBLISHED',
      }).distinct('_id');
      filter.trainingId = { $in: publishedTrainingIds };
      filter.status = 'PLANNED';
      filter.$expr = { $lt: ['$enrolledCount', '$capacity'] };
    } else if (input.view === 'ENROLLED') {
      if (principal === undefined || principal.role !== 'LEARNER') {
        throw new AppError(
          403,
          'LEARNER_SESSION_VIEW_FORBIDDEN',
          'The enrolled Session view is available only to Learners.',
        );
      }
      passwordReady(principal);
      const sessionIds = await EnrollmentModel.find({
        learnerId: principal.userId,
        sessionId: { $type: 'objectId' },
      }).distinct('sessionId');
      filter._id = { $in: sessionIds };
    } else {
      if (principal === undefined || principal.role === 'LEARNER') {
        throw new AppError(
          403,
          'SESSION_MANAGEMENT_FORBIDDEN',
          'Session management access is required.',
        );
      }
      passwordReady(principal);
      if (principal.role === 'TRAINER') {
        const ownedTrainingIds = await TrainingModel.find({
          ownerTrainerId: principal.userId,
          type: 'IN_PERSON',
        }).distinct('_id');
        filter.$or = [
          { trainingId: { $in: ownedTrainingIds } },
          {
            assignedTrainerIds: new mongoose.Types.ObjectId(principal.userId),
          },
        ];
      }
    }
    if (input.trainingId !== undefined) {
      if (
        input.view === 'PUBLIC' &&
        (await TrainingModel.exists({
          _id: input.trainingId,
          type: 'IN_PERSON',
          status: 'PUBLISHED',
        })) === null
      ) {
        return {
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        };
      }
      filter.trainingId = new mongoose.Types.ObjectId(input.trainingId);
    }
    if (input.status !== undefined) {
      if (input.view === 'PUBLIC' && input.status !== 'PLANNED') {
        return {
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        };
      }
      filter.status = input.status;
    }
    const [sessions, total] = await Promise.all([
      TrainingSessionModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      TrainingSessionModel.countDocuments(filter),
    ]);
    return {
      items: await this.#views(sessions),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async getSession(
    sessionId: string,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<TrainingSessionView> {
    const session = await this.#session(sessionId);
    const training = await this.#training(String(session.trainingId));
    const isPublic =
      session.status === 'PLANNED' &&
      training.status === 'PUBLISHED' &&
      session.enrolledCount < session.capacity;
    if (!isPublic) {
      if (principal === undefined) throw this.#sessionNotFound();
      passwordReady(principal);
      if (principal.role === 'LEARNER') {
        if (
          !(await this.#hasLearnerEnrollment(principal.userId, session._id))
        ) {
          throw this.#sessionNotFound();
        }
      } else {
        this.#assertSessionReader(principal, session, training);
      }
    }
    return (await this.#views([session]))[0] as TrainingSessionView;
  }

  async createSession(
    principal: AuthenticatedPrincipal,
    input: CreateSessionInput,
  ): Promise<TrainingSessionView> {
    const training = await this.#managedTraining(principal, input.trainingId);
    if (training.type !== 'IN_PERSON') {
      throw new AppError(
        422,
        'IN_PERSON_TRAINING_REQUIRED',
        'Sessions are available only for in-person Trainings.',
      );
    }
    const assignedTrainerIds =
      input.assignedTrainerIds === undefined
        ? [training.ownerTrainerId]
        : await this.#activeTrainerIds(input.assignedTrainerIds);
    try {
      const session = await TrainingSessionModel.create({
        trainingId: training._id,
        title: input.title,
        ...(input.identifier === undefined
          ? {}
          : { identifier: input.identifier }),
        capacity: input.capacity,
        enrolledCount: 0,
        assignedTrainerIds,
        location: input.location,
        address: input.address,
        ...(input.room === undefined ? {} : { room: input.room }),
        additionalInformation: input.additionalInformation,
        status: 'PLANNED',
      });
      return (await this.#views([session]))[0] as TrainingSessionView;
    } catch (error) {
      this.#duplicateSessionError(error);
    }
  }

  async updateSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    input: UpdateSessionInput,
  ): Promise<TrainingSessionView> {
    const session = await this.#structuralSession(principal, sessionId);
    if (
      input.capacity !== undefined &&
      input.capacity < session.enrolledCount
    ) {
      throw new AppError(
        409,
        'CAPACITY_BELOW_ENROLLMENT_COUNT',
        'Capacity cannot be lower than the current Enrollment count.',
      );
    }
    if (input.title !== undefined) session.title = input.title;
    if (input.capacity !== undefined) session.capacity = input.capacity;
    if (input.location !== undefined) session.location = input.location;
    if (input.address !== undefined) session.address = input.address;
    if (input.additionalInformation !== undefined) {
      session.additionalInformation = input.additionalInformation;
    }
    if (input.identifier === null) session.set('identifier', undefined);
    else if (input.identifier !== undefined)
      session.identifier = input.identifier;
    if (input.room === null) session.set('room', undefined);
    else if (input.room !== undefined) session.room = input.room;

    const schedules = await SessionScheduleModel.find({
      sessionId: session._id,
    })
      .select('+normalizedLocationRoom')
      .exec();
    for (const schedule of schedules) {
      const roomKey = this.#effectiveRoomKey(session, schedule);
      await this.#assertNoConflict(
        schedule.startAt,
        schedule.endAt,
        schedule.trainerIds,
        roomKey,
        schedule._id,
      );
      schedule.set('normalizedLocationRoom', roomKey);
    }
    try {
      await mongoose.connection.transaction(async (databaseSession) => {
        await session.save({ session: databaseSession });
        for (const schedule of schedules) {
          await schedule.save({ session: databaseSession });
        }
      });
    } catch (error) {
      this.#duplicateSessionError(error);
    }
    return (await this.#views([session]))[0] as TrainingSessionView;
  }

  async assignTrainers(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    trainerIds: readonly string[],
  ): Promise<TrainingSessionView> {
    const session = await this.#structuralSession(principal, sessionId);
    const assignedTrainerIds = await this.#activeTrainerIds(trainerIds);
    const schedules = await SessionScheduleModel.find({
      sessionId: session._id,
    }).exec();
    const allowed = new Set(assignedTrainerIds.map(String));
    if (
      schedules.some((schedule) =>
        schedule.trainerIds.some(
          (trainerId) => !allowed.has(String(trainerId)),
        ),
      )
    ) {
      throw new AppError(
        409,
        'TRAINER_USED_BY_SCHEDULE',
        'A Trainer used by an existing schedule cannot be unassigned.',
      );
    }
    session.assignedTrainerIds = assignedTrainerIds;
    await session.save();
    return (await this.#views([session]))[0] as TrainingSessionView;
  }

  async createSchedule(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    input: CreateScheduleInput,
  ): Promise<SessionScheduleView> {
    const session = await this.#structuralSession(principal, sessionId);
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    const trainerIds = this.#scheduleTrainerIds(session, input.trainerIds);
    await this.#validateContentReferences(
      session.trainingId,
      input.moduleId,
      input.lessonId,
    );
    const roomKey = normalizedRoomKey(
      input.location ?? session.location,
      input.room ?? session.room,
    );
    await this.#assertNoConflict(startAt, endAt, trainerIds, roomKey);
    const schedule = await SessionScheduleModel.create({
      sessionId: session._id,
      trainingId: session.trainingId,
      startAt,
      endAt,
      trainerIds,
      ...(input.moduleId === undefined
        ? {}
        : { moduleId: new mongoose.Types.ObjectId(input.moduleId) }),
      ...(input.lessonId === undefined
        ? {}
        : { lessonId: new mongoose.Types.ObjectId(input.lessonId) }),
      ...(input.location === undefined ? {} : { location: input.location }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.room === undefined ? {} : { room: input.room }),
      ...(roomKey === undefined ? {} : { normalizedLocationRoom: roomKey }),
    });
    return await this.#scheduleView(schedule);
  }

  async updateSchedule(
    principal: AuthenticatedPrincipal,
    scheduleId: string,
    input: UpdateScheduleInput,
  ): Promise<SessionScheduleView> {
    const schedule = await this.#schedule(scheduleId);
    const session = await this.#structuralSession(
      principal,
      String(schedule.sessionId),
    );
    if (input.startAt !== undefined) schedule.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) schedule.endAt = new Date(input.endAt);
    if (schedule.startAt >= schedule.endAt) {
      throw new AppError(
        422,
        'INVALID_SCHEDULE_RANGE',
        'endAt must be strictly after startAt.',
      );
    }
    if (input.trainerIds !== undefined) {
      schedule.trainerIds = this.#scheduleTrainerIds(session, input.trainerIds);
    }
    this.#setOptionalScheduleField(schedule, 'moduleId', input.moduleId);
    this.#setOptionalScheduleField(schedule, 'lessonId', input.lessonId);
    this.#setOptionalScheduleField(schedule, 'location', input.location);
    this.#setOptionalScheduleField(schedule, 'address', input.address);
    this.#setOptionalScheduleField(schedule, 'room', input.room);
    await this.#validateContentReferences(
      session.trainingId,
      schedule.moduleId === undefined ? undefined : String(schedule.moduleId),
      schedule.lessonId === undefined ? undefined : String(schedule.lessonId),
    );
    const roomKey = this.#effectiveRoomKey(session, schedule);
    await this.#assertNoConflict(
      schedule.startAt,
      schedule.endAt,
      schedule.trainerIds,
      roomKey,
      schedule._id,
    );
    schedule.set('normalizedLocationRoom', roomKey);
    await schedule.save();
    return await this.#scheduleView(schedule);
  }

  async deleteSchedule(
    principal: AuthenticatedPrincipal,
    scheduleId: string,
  ): Promise<void> {
    const schedule = await this.#schedule(scheduleId);
    await this.#structuralSession(principal, String(schedule.sessionId));
    const attendance = await mongoose.connection
      .collection('attendances')
      .findOne({
        scheduleId: schedule._id,
      });
    if (attendance !== null) {
      throw new AppError(
        409,
        'SCHEDULE_HAS_ATTENDANCE',
        'A schedule with Attendance history cannot be deleted.',
      );
    }
    await SessionScheduleModel.deleteOne({ _id: schedule._id });
  }

  async startSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<TrainingSessionView> {
    const session = await this.#operationalSession(principal, sessionId);
    if (session.status !== 'PLANNED') {
      throw new AppError(
        409,
        'SESSION_NOT_PLANNED',
        'Only a planned Session can be started.',
      );
    }
    if (
      (await SessionScheduleModel.countDocuments({ sessionId: session._id })) <
      1
    ) {
      throw new AppError(
        409,
        'SESSION_SCHEDULE_REQUIRED',
        'At least one schedule is required before starting a Session.',
      );
    }
    session.status = 'IN_PROGRESS';
    await session.save();
    return (await this.#views([session]))[0] as TrainingSessionView;
  }

  async completeSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<TrainingSessionView> {
    const authorized = await this.#operationalSession(principal, sessionId);
    const completed = await mongoose.connection.transaction(
      async (databaseSession) => {
        const session = await TrainingSessionModel.findById(authorized._id)
          .session(databaseSession)
          .exec();
        if (session === null || session.status !== 'IN_PROGRESS') {
          throw new AppError(
            409,
            'SESSION_NOT_IN_PROGRESS',
            'Only an in-progress Session can be completed.',
          );
        }
        if (
          !(await this.#hasAttendanceCoverage(session._id, databaseSession))
        ) {
          throw new AppError(
            409,
            'ATTENDANCE_INCOMPLETE',
            'Attendance must be recorded for every Enrollment and schedule.',
          );
        }
        session.status = 'COMPLETED';
        await session.save({ session: databaseSession });
        return session;
      },
    );
    return (await this.#views([completed]))[0] as TrainingSessionView;
  }

  async cancelSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<TrainingSessionView> {
    const session = await this.#session(sessionId);
    await this.#managedTraining(principal, String(session.trainingId));
    if (session.status === 'CANCELLED') {
      return (await this.#views([session]))[0] as TrainingSessionView;
    }
    if (session.status === 'COMPLETED') {
      throw new AppError(
        409,
        'COMPLETED_SESSION_IMMUTABLE',
        'A completed Session cannot be cancelled.',
      );
    }
    if (await this.#hasEnrollment(session._id)) {
      throw new AppError(
        409,
        'SESSION_HAS_ENROLLMENTS',
        'A Session with Enrollments cannot be cancelled.',
      );
    }
    session.status = 'CANCELLED';
    await session.save();
    return (await this.#views([session]))[0] as TrainingSessionView;
  }

  async deleteSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<void> {
    const session = await this.#session(sessionId);
    await this.#managedTraining(principal, String(session.trainingId));
    const [enrollment, payment] = await Promise.all([
      this.#hasEnrollment(session._id),
      mongoose.connection
        .collection('payments')
        .findOne({ sessionId: session._id }),
    ]);
    if (enrollment || payment !== null) {
      throw new AppError(
        409,
        'SESSION_HAS_HISTORY',
        'A Session with Enrollment or Payment history cannot be deleted.',
      );
    }
    await mongoose.connection.transaction(async (databaseSession) => {
      await SessionScheduleModel.deleteMany(
        { sessionId: session._id },
        { session: databaseSession },
      );
      await TrainingSessionModel.deleteOne(
        { _id: session._id },
        { session: databaseSession },
      );
    });
  }

  async #managedTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<HydratedDocument<Training>> {
    passwordReady(principal);
    const training = await this.#training(trainingId);
    if (
      principal.role !== 'ADMIN' &&
      !(
        principal.role === 'TRAINER' &&
        String(training.ownerTrainerId) === principal.userId
      )
    ) {
      throw new AppError(
        403,
        'SESSION_MANAGEMENT_FORBIDDEN',
        'Only an Admin or the Training owner can manage this Session.',
      );
    }
    if (training.status === 'ARCHIVED') {
      throw new AppError(
        409,
        'ARCHIVED_TRAINING_IMMUTABLE',
        'Sessions of an archived Training cannot be modified.',
      );
    }
    return training;
  }

  async #structuralSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<HydratedDocument<TrainingSession>> {
    const session = await this.#session(sessionId);
    await this.#managedTraining(principal, String(session.trainingId));
    if (session.status !== 'PLANNED') {
      throw new AppError(
        409,
        'SESSION_STRUCTURE_IMMUTABLE',
        'Only a planned Session can change its structure or schedules.',
      );
    }
    return session;
  }

  async #operationalSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
  ): Promise<HydratedDocument<TrainingSession>> {
    passwordReady(principal);
    const session = await this.#session(sessionId);
    const training = await this.#training(String(session.trainingId));
    this.#assertSessionReader(principal, session, training);
    return session;
  }

  #assertSessionReader(
    principal: AuthenticatedPrincipal,
    session: HydratedDocument<TrainingSession>,
    training: HydratedDocument<Training>,
  ): void {
    if (
      principal.role === 'ADMIN' ||
      (principal.role === 'TRAINER' &&
        (String(training.ownerTrainerId) === principal.userId ||
          session.assignedTrainerIds.some(
            (id) => String(id) === principal.userId,
          )))
    ) {
      return;
    }
    throw new AppError(
      403,
      'SESSION_ACCESS_FORBIDDEN',
      'A relevant Session assignment is required.',
    );
  }

  async #activeTrainerIds(
    values: readonly string[],
  ): Promise<Types.ObjectId[]> {
    if (new Set(values).size !== values.length) {
      throw new AppError(
        422,
        'DUPLICATE_SESSION_TRAINER',
        'Assigned Trainers must be unique.',
      );
    }
    const ids = uniqueObjectIds(values);
    const activeCount = await UserModel.countDocuments({
      _id: { $in: ids },
      role: 'TRAINER',
      isActive: true,
    });
    if (activeCount !== ids.length) {
      throw new AppError(
        422,
        'ACTIVE_TRAINERS_REQUIRED',
        'Every assigned user must be an active Trainer.',
      );
    }
    return ids;
  }

  #scheduleTrainerIds(
    session: HydratedDocument<TrainingSession>,
    values: readonly string[],
  ): Types.ObjectId[] {
    if (new Set(values).size !== values.length) {
      throw new AppError(
        422,
        'DUPLICATE_SCHEDULE_TRAINER',
        'Schedule Trainers must be unique.',
      );
    }
    const assigned = new Set(session.assignedTrainerIds.map(String));
    if (values.some((value) => !assigned.has(value))) {
      throw new AppError(
        422,
        'SCHEDULE_TRAINER_NOT_ASSIGNED',
        'Schedule Trainers must be assigned to the parent Session.',
      );
    }
    return uniqueObjectIds(values);
  }

  async #validateContentReferences(
    trainingId: Types.ObjectId,
    moduleId: string | undefined,
    lessonId: string | undefined,
  ): Promise<void> {
    const [module, lesson] = await Promise.all([
      moduleId === undefined
        ? Promise.resolve(null)
        : TrainingModuleModel.findOne({
            _id: moduleId,
            trainingId,
            isArchived: false,
          }).exec(),
      lessonId === undefined
        ? Promise.resolve(null)
        : LessonModel.findOne({
            _id: lessonId,
            trainingId,
            isArchived: false,
          }).exec(),
    ]);
    if (moduleId !== undefined && module === null) {
      throw new AppError(
        422,
        'SCHEDULE_MODULE_MISMATCH',
        'The schedule Module must belong to the parent Training.',
      );
    }
    if (lessonId !== undefined && lesson === null) {
      throw new AppError(
        422,
        'SCHEDULE_LESSON_MISMATCH',
        'The schedule Lesson must belong to the parent Training.',
      );
    }
    if (
      module !== null &&
      lesson !== null &&
      String(lesson.moduleId) !== String(module._id)
    ) {
      throw new AppError(
        422,
        'SCHEDULE_CONTENT_MISMATCH',
        'The schedule Lesson must belong to the selected Module.',
      );
    }
  }

  async #assertNoConflict(
    startAt: Date,
    endAt: Date,
    trainerIds: readonly Types.ObjectId[],
    roomKey: string | undefined,
    excludeScheduleId?: Types.ObjectId,
  ): Promise<void> {
    const overlaps = await SessionScheduleModel.find({
      ...(excludeScheduleId === undefined
        ? {}
        : { _id: { $ne: excludeScheduleId } }),
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
      $or: [
        { trainerIds: { $in: trainerIds } },
        ...(roomKey === undefined ? [] : [{ normalizedLocationRoom: roomKey }]),
      ],
    })
      .select('+normalizedLocationRoom')
      .exec();
    if (overlaps.length === 0) return;
    const activeSessionIds = new Set(
      (
        await TrainingSessionModel.find({
          _id: { $in: overlaps.map(({ sessionId }) => sessionId) },
          status: { $ne: 'CANCELLED' },
        }).distinct('_id')
      ).map(String),
    );
    const requestedTrainers = new Set(trainerIds.map(String));
    for (const overlap of overlaps) {
      if (!activeSessionIds.has(String(overlap.sessionId))) continue;
      if (overlap.trainerIds.some((id) => requestedTrainers.has(String(id)))) {
        throw new AppError(
          409,
          'SCHEDULE_TRAINER_CONFLICT',
          'A Trainer is already assigned during this time range.',
        );
      }
      if (roomKey !== undefined && overlap.normalizedLocationRoom === roomKey) {
        throw new AppError(
          409,
          'SCHEDULE_ROOM_CONFLICT',
          'The same location and room are already in use during this time range.',
        );
      }
    }
  }

  #effectiveRoomKey(
    session: HydratedDocument<TrainingSession>,
    schedule: HydratedDocument<SessionSchedule>,
  ): string | undefined {
    return normalizedRoomKey(
      schedule.location ?? session.location,
      schedule.room ?? session.room,
    );
  }

  #setOptionalScheduleField(
    schedule: HydratedDocument<SessionSchedule>,
    field: 'moduleId' | 'lessonId' | 'location' | 'address' | 'room',
    value: string | null | undefined,
  ): void {
    if (value === null) schedule.set(field, undefined);
    else if (value !== undefined) {
      schedule.set(
        field,
        field === 'moduleId' || field === 'lessonId'
          ? new mongoose.Types.ObjectId(value)
          : value,
      );
    }
  }

  async #hasAttendanceCoverage(
    sessionId: Types.ObjectId,
    databaseSession?: ClientSession,
  ): Promise<boolean> {
    const enrollmentIds = await EnrollmentModel.find({ sessionId })
      .select({ _id: 1 })
      .session(databaseSession ?? null)
      .exec();
    if (enrollmentIds.length === 0) return true;
    const scheduleIds = await SessionScheduleModel.find({ sessionId })
      .session(databaseSession ?? null)
      .distinct('_id');
    if (scheduleIds.length === 0) return false;
    const attendanceCount = await AttendanceModel.countDocuments({
      enrollmentId: { $in: enrollmentIds.map(({ _id }) => _id) },
      scheduleId: { $in: scheduleIds },
    })
      .session(databaseSession ?? null)
      .exec();
    return attendanceCount === enrollmentIds.length * scheduleIds.length;
  }

  async #hasLearnerEnrollment(
    learnerId: string,
    sessionId: Types.ObjectId,
  ): Promise<boolean> {
    return (await EnrollmentModel.exists({ learnerId, sessionId })) !== null;
  }

  async #hasEnrollment(sessionId: Types.ObjectId): Promise<boolean> {
    return (
      (await mongoose.connection
        .collection('enrollments')
        .findOne({ sessionId })) !== null
    );
  }

  async #session(
    sessionId: string,
  ): Promise<HydratedDocument<TrainingSession>> {
    const session = await TrainingSessionModel.findById(sessionId).exec();
    if (session === null) throw this.#sessionNotFound();
    return session;
  }

  async #schedule(
    scheduleId: string,
  ): Promise<HydratedDocument<SessionSchedule>> {
    const schedule = await SessionScheduleModel.findById(scheduleId)
      .select('+normalizedLocationRoom')
      .exec();
    if (schedule === null) {
      throw new AppError(
        404,
        'SCHEDULE_NOT_FOUND',
        'The schedule does not exist.',
      );
    }
    return schedule;
  }

  async #training(trainingId: string): Promise<HydratedDocument<Training>> {
    const training = await TrainingModel.findById(trainingId).exec();
    if (training === null) {
      throw new AppError(
        404,
        'TRAINING_NOT_FOUND',
        'The Training does not exist.',
      );
    }
    return training;
  }

  #sessionNotFound(): AppError {
    return new AppError(
      404,
      'SESSION_NOT_FOUND',
      'The Session does not exist.',
    );
  }

  #duplicateSessionError(error: unknown): never {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        'SESSION_IDENTIFIER_ALREADY_EXISTS',
        'This Training already uses that Session identifier.',
      );
    }
    throw error;
  }

  async #scheduleView(
    schedule: HydratedDocument<SessionSchedule>,
    trainersById?: ReadonlyMap<string, HydratedDocument<User>>,
  ): Promise<SessionScheduleView> {
    const trainers =
      trainersById ??
      new Map(
        (
          await UserModel.find({ _id: { $in: schedule.trainerIds } }).exec()
        ).map((trainer) => [String(trainer._id), trainer]),
      );
    return {
      id: String(schedule._id),
      startAt: schedule.startAt.toISOString(),
      endAt: schedule.endAt.toISOString(),
      ...(schedule.moduleId === undefined
        ? {}
        : { moduleId: String(schedule.moduleId) }),
      ...(schedule.lessonId === undefined
        ? {}
        : { lessonId: String(schedule.lessonId) }),
      trainers: schedule.trainerIds.map((id) =>
        this.#trainerView(trainers.get(String(id)), id),
      ),
      ...(schedule.location === undefined
        ? {}
        : { location: schedule.location }),
      ...(schedule.address === undefined ? {} : { address: schedule.address }),
      ...(schedule.room === undefined ? {} : { room: schedule.room }),
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }

  async #views(
    sessions: readonly HydratedDocument<TrainingSession>[],
  ): Promise<TrainingSessionView[]> {
    if (sessions.length === 0) return [];
    const sessionIds = sessions.map(({ _id }) => _id);
    const schedules = await SessionScheduleModel.find({
      sessionId: { $in: sessionIds },
    })
      .sort({ startAt: 1, _id: 1 })
      .exec();
    const trainingIds = [
      ...new Set(sessions.map(({ trainingId }) => String(trainingId))),
    ];
    const trainerIds = [
      ...new Set(
        sessions
          .flatMap(({ assignedTrainerIds }) => assignedTrainerIds)
          .concat(schedules.flatMap(({ trainerIds: values }) => values))
          .map(String),
      ),
    ];
    const [trainings, trainers] = await Promise.all([
      TrainingModel.find({ _id: { $in: trainingIds } }).exec(),
      UserModel.find({ _id: { $in: trainerIds }, role: 'TRAINER' }).exec(),
    ]);
    const trainingsById = new Map(
      trainings.map((training) => [String(training._id), training]),
    );
    const trainersById = new Map(
      trainers.map((trainer) => [String(trainer._id), trainer]),
    );
    const schedulesBySession = new Map<string, SessionScheduleView[]>();
    for (const schedule of schedules) {
      const id = String(schedule.sessionId);
      const existing = schedulesBySession.get(id) ?? [];
      existing.push(await this.#scheduleView(schedule, trainersById));
      schedulesBySession.set(id, existing);
    }
    return sessions.map((session) => {
      const training = trainingsById.get(String(session.trainingId));
      if (training === undefined) {
        throw new Error('Session Training reference is inconsistent.');
      }
      const sessionSchedules =
        schedulesBySession.get(String(session._id)) ?? [];
      const firstSchedule = sessionSchedules[0];
      const lastSchedule = sessionSchedules.at(-1);
      return {
        id: String(session._id),
        training: { id: String(training._id), title: training.title },
        title: session.title,
        ...(session.identifier === undefined
          ? {}
          : { identifier: session.identifier }),
        capacity: session.capacity,
        enrolledCount: session.enrolledCount,
        availableSeats: Math.max(0, session.capacity - session.enrolledCount),
        assignedTrainers: session.assignedTrainerIds.map((id) =>
          this.#trainerView(trainersById.get(String(id)), id),
        ),
        location: session.location,
        address: session.address,
        ...(session.room === undefined ? {} : { room: session.room }),
        additionalInformation: session.additionalInformation,
        status: session.status,
        ...(firstSchedule === undefined
          ? {}
          : { startAt: firstSchedule.startAt }),
        ...(lastSchedule === undefined ? {} : { endAt: lastSchedule.endAt }),
        schedules: sessionSchedules,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    });
  }

  #trainerView(
    trainer: HydratedDocument<User> | undefined,
    fallbackId: Types.ObjectId,
  ) {
    if (trainer === undefined) return { id: String(fallbackId) };
    return {
      id: String(trainer._id),
      ...(trainer.profile.firstName === undefined
        ? {}
        : { firstName: trainer.profile.firstName }),
      ...(trainer.profile.lastName === undefined
        ? {}
        : { lastName: trainer.profile.lastName }),
    };
  }
}
