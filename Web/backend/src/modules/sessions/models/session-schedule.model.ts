import mongoose, { type Model, type Types } from 'mongoose';

export interface SessionSchedule {
  sessionId: Types.ObjectId;
  trainingId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  moduleId?: Types.ObjectId;
  lessonId?: Types.ObjectId;
  trainerIds: Types.ObjectId[];
  location?: string;
  address?: string;
  room?: string;
  normalizedLocationRoom?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionScheduleSchema = new mongoose.Schema<SessionSchedule>(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'TrainingSession',
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingModule' },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    trainerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
    },
    location: { type: String, trim: true, minlength: 1, maxlength: 200 },
    address: { type: String, trim: true, maxlength: 500 },
    room: { type: String, trim: true, minlength: 1, maxlength: 100 },
    normalizedLocationRoom: { type: String, select: false },
  },
  {
    collection: 'session_schedules',
    strict: 'throw',
    timestamps: true,
  },
);

sessionScheduleSchema.index(
  { startAt: 1, endAt: 1, trainerIds: 1 },
  { name: 'schedule_trainer_conflicts' },
);
sessionScheduleSchema.index(
  { normalizedLocationRoom: 1, startAt: 1, endAt: 1 },
  { name: 'schedule_room_conflicts' },
);
sessionScheduleSchema.index(
  { sessionId: 1, startAt: 1, _id: 1 },
  { name: 'session_schedule_listing' },
);

export const SessionScheduleModel =
  (mongoose.models.SessionSchedule as Model<SessionSchedule> | undefined) ??
  mongoose.model<SessionSchedule>('SessionSchedule', sessionScheduleSchema);
