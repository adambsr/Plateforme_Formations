import { z } from 'zod';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  generatedQuestionSchema,
  type GenerateQuestionsInput,
  type QuestionInput,
} from '../dto/evaluation.dto.js';
import type { QuestionGenerationGateway } from '../infrastructure/gemini-question-generation.gateway.js';
import type { EvaluationService } from './evaluation.service.js';
import type { TrainingAiContextService } from './training-ai-context.service.js';

const generatedSchema = z
  .object({
    questions: z.array(generatedQuestionSchema).min(1).max(20),
  })
  .strict();

export class AiEvaluationService {
  readonly #evaluations: EvaluationService;
  readonly #context: TrainingAiContextService;
  readonly #gateway: QuestionGenerationGateway;

  constructor(
    evaluations: EvaluationService,
    context: TrainingAiContextService,
    gateway: QuestionGenerationGateway,
  ) {
    this.#evaluations = evaluations;
    this.#context = context;
    this.#gateway = gateway;
  }

  async generate(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
    input: GenerateQuestionsInput,
  ) {
    const target = await this.#evaluations.ownedDraftForGeneration(
      principal,
      evaluationId,
    );
    const context = await this.#context.build(target.trainingId);
    const prompt = [
      `Create exactly ${input.questionCount} questions.`,
      `Allowed types: ${input.questionTypes.join(', ')}.`,
      'Use option ids containing only letters, numbers, underscores, or hyphens.',
      'TRUE_FALSE questions must use option ids TRUE and FALSE.',
      'Every question is worth a positive integer number of points.',
      `AUTHORIZED TRAINING CONTEXT (${context.contextChars} characters):`,
      context.text,
    ].join('\n');
    const parsed = generatedSchema.safeParse(
      await this.#gateway.generate({
        prompt,
        questionCount: input.questionCount,
      }),
    );
    if (
      !parsed.success ||
      parsed.data.questions.length !== input.questionCount ||
      parsed.data.questions.some(
        ({ type }) => !input.questionTypes.includes(type),
      )
    ) {
      throw new AppError(
        502,
        'AI_RESPONSE_SCHEMA_INVALID',
        'Gemini output did not match the requested question schema. No questions were saved.',
      );
    }
    const questions: QuestionInput[] = parsed.data.questions.map(
      (question, index) => ({ ...question, order: index + 1 }),
    );
    const evaluation = await this.#evaluations.importGeneratedQuestions(
      principal,
      evaluationId,
      questions,
      {
        provider: this.#gateway.provider,
        model: this.#gateway.model,
        contextChars: context.contextChars,
        resourceCount: context.extractedResources.length,
        skippedResourceCount: context.skippedResources.length,
      },
    );
    return {
      evaluation,
      extraction: {
        contextChars: context.contextChars,
        extractedResources: context.extractedResources,
        skippedResources: context.skippedResources,
      },
    };
  }
}
