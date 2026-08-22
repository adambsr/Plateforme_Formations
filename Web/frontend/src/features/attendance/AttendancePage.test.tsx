import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendancePage } from './AttendancePage.js';

const request = vi.fn();
let currentUser: {
  id: string;
  role: 'ADMIN' | 'TRAINER' | 'LEARNER';
} | null = null;

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ user: currentUser, request }),
}));

beforeEach(() => {
  request.mockReset();
  currentUser = { id: 'learner-1', role: 'LEARNER' };
});

describe('Phase 7 attendance and learner schedule UI', () => {
  it('shows missing Attendance distinctly from ABSENT', async () => {
    request.mockImplementation((path: string) => {
      if (path.startsWith('/sessions?')) {
        return Promise.resolve({
          items: [
            {
              id: 'session-1',
              training: { id: 'training-1', title: 'Atelier' },
              title: 'Groupe Tunis',
              assignedTrainers: [],
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      }
      return Promise.resolve({
        session: {
          id: 'session-1',
          title: 'Groupe Tunis',
          status: 'IN_PROGRESS',
          training: { id: 'training-1', title: 'Atelier' },
        },
        minimumAttendancePercent: 80,
        immutable: false,
        canRecord: true,
        schedules: [
          {
            id: 'schedule-1',
            startAt: '2026-08-22T08:00:00.000Z',
            endAt: '2026-08-22T10:00:00.000Z',
            location: 'Centre Tunis',
          },
        ],
        roster: [
          {
            enrollmentId: 'enrollment-1',
            learner: { id: 'learner-1', email: 'learner@example.com' },
            presentCount: 0,
            recordedCount: 0,
            totalScheduleCount: 1,
            attendancePercentage: 0,
            attendanceCoverageComplete: false,
            meetsAttendanceThreshold: false,
            isComplete: false,
            records: [{ scheduleId: 'schedule-1', status: null }],
          },
        ],
      });
    });

    render(
      <MemoryRouter>
        <AttendancePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Non saisie')).toBeVisible();
    expect(screen.getByText(/n’ont pas encore été saisies/i)).toBeVisible();
    expect(request).toHaveBeenCalledWith(
      '/sessions?view=ENROLLED&page=1&pageSize=12',
    );
  });

  it('renders the role-appropriate empty state', async () => {
    currentUser = { id: 'trainer-1', role: 'TRAINER' };
    request.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    render(
      <MemoryRouter>
        <AttendancePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Aucune session concernée/i)).toBeVisible();
    expect(screen.getByText(/auxquelles vous êtes affecté/i)).toBeVisible();
  });
});
