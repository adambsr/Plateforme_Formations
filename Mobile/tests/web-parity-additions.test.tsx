import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import { AdminDashboardScreen } from '../src/features/admin/AdminDashboardScreen';
import { TutorChat } from '../src/features/learning/TutorChat';
import type { TrainingContent } from '../src/features/learning/types';

jest.mock('../src/core/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const mockedUseAuth = jest.mocked(useAuth);

function context(
  role: 'ADMIN' | 'LEARNER',
  request: jest.Mock,
): AuthContextValue {
  return {
    status: 'authenticated',
    user: {
      id: 'u1',
      email: 'learner@example.test',
      role,
      isActive: true,
      mustChangePassword: false,
      profile: { firstName: 'Leila' },
      createdAt: '',
      updatedAt: '',
    },
    request,
    download: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    updateProfile: jest.fn(),
  } as AuthContextValue;
}

describe('current Web parity additions', () => {
  afterEach(() => jest.clearAllMocks());

  it('sends grounded learner tutor messages through the shared backend', async () => {
    const request = jest.fn().mockResolvedValue({
      answer: 'Réponse du cours',
      grounded: true,
      citations: [
        {
          lessonId: 'l1',
          lessonTitle: 'Introduction',
          moduleTitle: 'Module 1',
          href: '/app/content/t1#lesson-l1',
        },
      ],
      followUpQuestions: ['Continuer ?'],
      metadata: {
        provider: 'gemini',
        model: 'test',
        retrievedLessonCount: 1,
        contextChars: 20,
      },
    });
    mockedUseAuth.mockReturnValue(context('LEARNER', request));
    const content: TrainingContent = {
      trainingId: 't1',
      access: 'LEARNER_READ',
      modules: [
        {
          id: 'm1',
          title: 'Module 1',
          description: '',
          order: 1,
          isArchived: false,
          lessons: [
            {
              id: 'l1',
              title: 'Introduction',
              description: '',
              textContent: '',
              instructions: '',
              order: 1,
              isArchived: false,
              resources: [],
            },
          ],
        },
      ],
    };
    const screen = await render(
      <TutorChat content={content} onOpenLesson={jest.fn()} />,
    );
    await fireEvent.changeText(
      screen.getByLabelText('Votre question'),
      'Explique cette leçon',
    );
    await fireEvent.press(screen.getByText('Envoyer'));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/trainings/t1/tutor/messages',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Réponse du cours')).toBeTruthy();
    expect(
      screen.getAllByText('Module 1 · Introduction').length,
    ).toBeGreaterThan(0);
  });

  it('loads the Web learning-insights endpoint with every Admin KPI', async () => {
    const request = jest.fn((path: string) => {
      if (path.includes('/overview'))
        return Promise.resolve({
          counts: {
            trainings: 0,
            sessions: 0,
            learners: 0,
            trainers: 0,
            enrollments: 0,
          },
        });
      if (path.includes('/participation'))
        return Promise.resolve({
          overall: {
            expected: 0,
            recorded: 0,
            present: 0,
            participationPercent: null,
          },
        });
      if (path.includes('/progress'))
        return Promise.resolve({
          selfPaced: {
            enrollmentCount: 0,
            completedEnrollments: 0,
            averagePercentage: null,
          },
          evaluations: {
            totalAttempts: 0,
            passedAttempts: 0,
            failedAttempts: 0,
            passPercent: null,
          },
        });
      if (path.includes('/satisfaction'))
        return Promise.resolve({
          global: {
            count: 0,
            average: null,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          },
        });
      if (path.includes('/profitability'))
        return Promise.resolve({
          revenueMinor: 0,
          trainerCostsMinor: 0,
          trainingCostsMinor: 0,
          resultMinor: 0,
          profitabilityPercent: null,
          byTraining: [],
        });
      return Promise.resolve({
        completionTrend: [],
        inactivity: { thresholdDays: 30, total: 0, learners: [] },
      });
    });
    mockedUseAuth.mockReturnValue(context('ADMIN', request));
    const screen = await render(<AdminDashboardScreen />);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/learning-insights?'),
      ),
    );
    expect(
      await screen.findByText('Complétions self-paced par mois'),
    ).toBeTruthy();
    expect(screen.getByText('Apprenants devenus inactifs')).toBeTruthy();
  });
});
