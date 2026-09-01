import { describe, expect, it, vi } from 'vitest';

import { openApiDocument } from '../src/infrastructure/openapi/document.js';
import { publicConciergeMessageSchema } from '../src/modules/public-concierge/dto/public-concierge.dto.js';
import type { PublicConciergeGenerationGateway } from '../src/modules/public-concierge/infrastructure/gemini-public-concierge.gateway.js';
import type { PublicConciergeContextRetriever } from '../src/modules/public-concierge/services/public-concierge-context.service.js';
import { PublicConciergeService } from '../src/modules/public-concierge/services/public-concierge.service.js';

const input = {
  message: 'Comment créer un compte ?',
  currentPath: '/',
  conversation: [],
};

function dependencies(output: unknown) {
  const retrieve = vi.fn().mockResolvedValue({
    contextChars: 240,
    sources: [
      {
        id: 'page:registration',
        title: 'Créer un compte apprenant',
        href: '/register',
        kind: 'PAGE',
        text: 'Un visiteur peut créer un compte Apprenant.',
      },
      {
        id: 'page:contact',
        title: 'Contact',
        href: '/contact',
        kind: 'PAGE',
        text: 'Utilisez la page Contact pour une question non couverte.',
      },
    ],
  });
  const answer = vi.fn().mockResolvedValue(output);
  const service = new PublicConciergeService(
    { retrieve } satisfies PublicConciergeContextRetriever,
    {
      provider: 'TEST',
      model: 'public-test-model',
      answer,
    } satisfies PublicConciergeGenerationGateway,
  );
  return { answer, retrieve, service };
}

describe('public AI concierge boundaries', () => {
  it('accepts bounded anonymous messages and allowlisted public paths', () => {
    expect(publicConciergeMessageSchema.safeParse(input).success).toBe(true);
    expect(
      publicConciergeMessageSchema.safeParse({
        ...input,
        currentPath: '/app/learner',
      }).success,
    ).toBe(false);
    expect(
      publicConciergeMessageSchema.safeParse({
        ...input,
        conversation: Array.from({ length: 5 }, () => ({
          role: 'USER',
          content: 'Question',
        })),
      }).success,
    ).toBe(false);
  });

  it('resolves citations and actions only from server-owned public sources', async () => {
    const { answer, service } = dependencies({
      canAnswer: true,
      answer: 'Vous pouvez créer un compte apprenant depuis la page dédiée.',
      citationSourceIds: ['page:registration'],
      suggestedQuestions: ['Comment consulter le catalogue ?'],
      actions: [
        { sourceId: 'page:registration', label: 'Créer mon compte' },
      ],
    });

    await expect(service.answer(input)).resolves.toMatchObject({
      grounded: true,
      sources: [{ href: '/register' }],
      actions: [{ label: 'Créer mon compte', href: '/register' }],
    });
    const prompt = String(answer.mock.calls[0]?.[0]);
    expect(prompt).toContain('[PUBLIC SOURCE page:registration]');
    expect(prompt).toContain('VISITOR MESSAGE (untrusted)');
  });

  it('rejects model-created private or non-authorized links', async () => {
    const { service } = dependencies({
      canAnswer: true,
      answer: 'Accédez à cet espace.',
      citationSourceIds: ['page:registration'],
      suggestedQuestions: [],
      actions: [{ sourceId: 'private:admin', label: 'Administration' }],
    });
    await expect(service.answer(input)).rejects.toMatchObject({
      status: 502,
      code: 'AI_CONCIERGE_REFERENCES_INVALID',
    });
  });

  it('uses a deterministic contact fallback when public evidence is insufficient', async () => {
    const { service } = dependencies({
      canAnswer: false,
      answer: 'Model-provided fallback is ignored.',
      citationSourceIds: [],
      suggestedQuestions: [],
      actions: [],
    });
    await expect(service.answer(input)).resolves.toMatchObject({
      grounded: false,
      answer: expect.stringContaining('informations publiques fiables'),
      actions: [{ href: '/contact' }],
    });
  });

  it('documents a separate anonymous endpoint without bearer security', () => {
    const operation =
      openApiDocument.paths['/public/concierge/messages']?.post;
    expect(operation).toBeDefined();
    expect(operation?.security).toBeUndefined();
    expect(
      openApiDocument.paths['/trainings/{id}/tutor/messages']?.post?.security,
    ).toBeDefined();
  });
});
