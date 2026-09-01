import { describe, expect, it, vi } from 'vitest';

import { openApiDocument } from '../src/infrastructure/openapi/document.js';
import { tutorMessageSchema } from '../src/modules/tutor/dto/tutor.dto.js';
import { AiTutorService } from '../src/modules/tutor/services/ai-tutor.service.js';
import type { TutorContextRetriever } from '../src/modules/tutor/services/course-tutor-context.service.js';
import type { TutorGenerationGateway } from '../src/modules/tutor/infrastructure/gemini-tutor.gateway.js';

const principal = {
  userId: '000000010000000000000001',
  role: 'LEARNER' as const,
  mustChangePassword: false,
};
const trainingId = '000000020000000000000001';
const lessonId = '000000040000000000000001';

function dependencies(output: unknown) {
  const assertTrainingAccess = vi.fn().mockResolvedValue(undefined);
  const retrieve = vi.fn().mockResolvedValue({
    contextChars: 120,
    sources: [
      {
        lessonId,
        lessonTitle: 'Les composants',
        moduleId: '000000030000000000000001',
        moduleTitle: 'Fondamentaux',
        text: 'Un composant encapsule une partie de l’interface.',
      },
    ],
  });
  const answer = vi.fn().mockResolvedValue(output);
  const service = new AiTutorService(
    { assertTrainingAccess } as never,
    { retrieve } satisfies TutorContextRetriever,
    {
      provider: 'TEST',
      model: 'grounded-test-model',
      answer,
    } satisfies TutorGenerationGateway,
  );
  return { answer, assertTrainingAccess, retrieve, service };
}

describe('AI tutor grounding boundaries', () => {
  it('validates bounded learner messages and conversation history', () => {
    expect(
      tutorMessageSchema.safeParse({
        message: 'Explique les composants.',
        mode: 'SIMPLIFY',
        conversation: [],
      }).success,
    ).toBe(true);
    expect(
      tutorMessageSchema.safeParse({
        message: 'x',
        mode: 'GENERAL_CHAT',
        conversation: [],
      }).success,
    ).toBe(false);
  });

  it('returns only a citation resolved from the retrieved Lesson set', async () => {
    const { answer, assertTrainingAccess, service } = dependencies({
      canAnswer: true,
      answer: 'Un composant regroupe une partie réutilisable de l’interface.',
      citationLessonIds: [lessonId],
      followUpQuestions: ['Veux-tu un exemple ?'],
    });

    await expect(
      service.answer(principal, trainingId, {
        message: 'Explique les composants simplement.',
        mode: 'SIMPLIFY',
        conversation: [],
      }),
    ).resolves.toMatchObject({
      grounded: true,
      citations: [
        {
          lessonId,
          lessonTitle: 'Les composants',
          href: `/app/content/${trainingId}#lesson-${lessonId}`,
        },
      ],
    });
    expect(assertTrainingAccess).toHaveBeenCalledWith(
      principal.userId,
      trainingId,
    );
    expect(answer).toHaveBeenCalledOnce();
    expect(String(answer.mock.calls[0]?.[0])).toContain(
      `[LESSON ${lessonId}]`,
    );
  });

  it('rejects a Gemini citation that was not retrieved for the Learner', async () => {
    const { service } = dependencies({
      canAnswer: true,
      answer: 'Réponse non autorisée.',
      citationLessonIds: ['000000040000000000000099'],
      followUpQuestions: [],
    });

    await expect(
      service.answer(principal, trainingId, {
        message: 'Question',
        mode: 'QUESTION',
        conversation: [],
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: 'AI_TUTOR_CITATIONS_INVALID',
    });
  });

  it('documents the learner-only tutor endpoint', () => {
    expect(
      openApiDocument.paths['/trainings/{id}/tutor/messages']?.post,
    ).toBeDefined();
  });
});
