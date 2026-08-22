import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../src/infrastructure/openapi/document.js';
import { QUESTION_TYPES } from '../src/modules/evaluations/domain/evaluation.js';
import { questionInputSchema } from '../src/modules/evaluations/dto/evaluation.dto.js';
import { EvaluationAnswerModel } from '../src/modules/evaluations/models/evaluation-answer.model.js';
import { EvaluationAttemptModel } from '../src/modules/evaluations/models/evaluation-attempt.model.js';
import { GeminiQuestionGenerationGateway } from '../src/modules/evaluations/infrastructure/gemini-question-generation.gateway.js';

describe('Phase 8 and 9 persistence and API boundaries', () => {
  it('accepts only the three objective question types and validates correct options', () => {
    expect(QUESTION_TYPES).toEqual([
      'SINGLE_CHOICE',
      'MULTIPLE_CHOICE',
      'TRUE_FALSE',
    ]);
    expect(
      questionInputSchema.safeParse({
        type: 'ESSAY',
        prompt: 'Why?',
        options: [
          { id: 'A', text: 'A' },
          { id: 'B', text: 'B' },
        ],
        correctOptionIds: ['A'],
        points: 1,
        order: 1,
      }).success,
    ).toBe(false);
    expect(
      questionInputSchema.safeParse({
        type: 'TRUE_FALSE',
        prompt: 'Fact?',
        options: [
          { id: 'YES', text: 'Yes' },
          { id: 'NO', text: 'No' },
        ],
        correctOptionIds: ['YES'],
        points: 1,
        order: 1,
      }).success,
    ).toBe(false);
  });

  it('declares durable attempt numbering, one-active-attempt, and answer indexes', () => {
    const attempts = EvaluationAttemptModel.schema.indexes();
    expect(
      attempts.some(
        ([fields, options]) =>
          fields['enrollmentId'] === 1 &&
          fields['evaluationId'] === 1 &&
          fields['attemptNumber'] === 1 &&
          options.unique === true,
      ),
    ).toBe(true);
    expect(
      attempts.some(
        ([, options]) =>
          options.name === 'one_active_evaluation_attempt' &&
          options.unique === true,
      ),
    ).toBe(true);
    expect(
      EvaluationAnswerModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['attemptId'] === 1 &&
            fields['questionId'] === 1 &&
            options.unique === true,
        ),
    ).toBe(true);
  });

  it('documents every Phase 8 and 9 operation in OpenAPI', () => {
    const paths = openApiDocument.paths;
    expect(paths['/evaluations']?.get).toBeDefined();
    expect(paths['/evaluations']?.post).toBeDefined();
    expect(paths['/evaluations/{id}']?.put).toBeDefined();
    expect(paths['/evaluations/{id}/questions']?.post).toBeDefined();
    expect(paths['/questions/{id}']?.put).toBeDefined();
    expect(paths['/evaluations/{id}/attempts']?.post).toBeDefined();
    expect(paths['/attempts/{id}/answers']?.put).toBeDefined();
    expect(paths['/attempts/{id}/submit']?.post).toBeDefined();
    expect(paths['/evaluations/{id}/results']?.get).toBeDefined();
    expect(paths['/evaluations/{id}/generate-ai']?.post).toBeDefined();
    expect(paths['/trainings/{id}/certifying-evaluation']?.put).toBeDefined();
  });

  it('rejects an unchanged Gemini placeholder before making a provider call', async () => {
    const gateway = new GeminiQuestionGenerationGateway({
      apiKey: 'replace_with_your_gemini_api_key',
      model: 'gemini-3.7-flash',
      baseUrl: undefined,
      maxContextChars: 120_000,
    });

    await expect(
      gateway.generate({ prompt: 'Training context', questionCount: 1 }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });
  });
});
