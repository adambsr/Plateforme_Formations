import mongoose, { type Model, type Types } from 'mongoose';

import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from '../domain/attendance.js';

export interface Attendance {
  enrollmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  sessionId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  status: AttendanceStatus;
  recordedById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new mongoose.Schema<Attendance>(
  {
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Enrollment',
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'TrainingSession',
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'SessionSchedule',
    },
    status: { type: String, required: true, enum: ATTENDANCE_STATUSES },
    recordedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  {
    collection: 'attendances',
    strict: 'throw',
    timestamps: true,
  },
);

attendanceSchema.index(
  { enrollmentId: 1, scheduleId: 1 },
  { unique: true, name: 'unique_enrollment_schedule_attendance' },
);
attendanceSchema.index(
  { sessionId: 1, scheduleId: 1, learnerId: 1 },
  { name: 'session_attendance_roster' },
);
attendanceSchema.index(
  { learnerId: 1, sessionId: 1 },
  { name: 'learner_session_attendance' },
);

export const AttendanceModel =
  (mongoose.models.Attendance as Model<Attendance> | undefined) ??
  mongoose.model<Attendance>('Attendance', attendanceSchema);
