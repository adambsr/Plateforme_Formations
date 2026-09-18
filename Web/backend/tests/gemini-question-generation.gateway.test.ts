import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    readonly models = { generateContent };
  },
}));

import { GeminiQuestionGenerationGateway } from '../src/modules/evaluations/infrastructure/gemini-question-generation.gateway.js';

const config = {
  apiKey: 'configured-test-key',
  model: 'gemini-test-model',
  baseUrl: undefined,
  maxContextChars: 120_000,
};

describe('GeminiQuestionGenerationGateway provider failures', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('distinguishes a Gemini rate limit from service unavailability', async () => {
    generateContent.mockRejectedValue({
      status: 429,
      message:
        '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded"}}',
    });
    const gateway = new GeminiQuestionGenerationGateway(config);

    await expect(
      gateway.generate({ prompt: 'Training context', questionCount: 1 }),
    ).rejects.toMatchObject({
      status: 429,
      code: 'AI_PROVIDER_RATE_LIMITED',
    });
  });

  it('maps Gemini UNAVAILABLE to a retryable provider-unavailable error', async () => {
    generateContent.mockRejectedValue({
      status: 503,
      message:
        '{"error":{"code":503,"status":"UNAVAILABLE","message":"High demand"}}',
    });
    const gateway = new GeminiQuestionGenerationGateway(config);

    await expect(
      gateway.generate({ prompt: 'Training context', questionCount: 1 }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'AI_PROVIDER_UNAVAILABLE',
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('uses the established lightweight model after temporary primary-model unavailability', async () => {
    generateContent
      .mockRejectedValueOnce({
        status: 503,
        message:
          '{"error":{"code":503,"status":"UNAVAILABLE","message":"High demand"}}',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ questions: [] }),
      });
    const gateway = new GeminiQuestionGenerationGateway(config);

    await expect(
      gateway.generate({ prompt: 'Training context', questionCount: 1 }),
    ).resolves.toEqual({
      content: { questions: [] },
      model: 'gemini-3.1-flash-lite',
    });
    expect(generateContent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'gemini-3.1-flash-lite' }),
    );
  });

  it('uses the established lightweight model when the configured model reaches its quota', async () => {
    generateContent
      .mockRejectedValueOnce({
        status: 429,
        message:
          '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded for model"}}',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ questions: [] }),
      });
    const gateway = new GeminiQuestionGenerationGateway(config);

    await expect(
      gateway.generate({ prompt: 'Training context', questionCount: 1 }),
    ).resolves.toMatchObject({ model: 'gemini-3.1-flash-lite' });
  });
});
