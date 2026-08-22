import type { SessionStatus, TrainingSession } from '../sessions/types.js';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export interface AttendanceRecord {
  scheduleId: string;
  status: AttendanceStatus | null;
  updatedAt?: string;
}

export interface AttendanceRosterEntry {
  enrollmentId: string;
  learner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  presentCount: number;
  recordedCount: number;
  totalScheduleCount: number;
  attendancePercentage: number;
  attendanceCoverageComplete: boolean;
  meetsAttendanceThreshold: boolean;
  isComplete: boolean;
  records: AttendanceRecord[];
}

export interface SessionAttendance {
  session: {
    id: string;
    title: string;
    status: SessionStatus;
    training: { id: string; title: string };
  };
  minimumAttendancePercent: number;
  immutable: boolean;
  canRecord: boolean;
  schedules: Array<{
    id: string;
    startAt: string;
    endAt: string;
    location: string;
    room?: string;
  }>;
  roster: AttendanceRosterEntry[];
}

export interface AttendanceSessionPage {
  items: TrainingSession[];
  page: number;
  pageSize: number;
  total: number;
}
