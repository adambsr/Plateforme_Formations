import { z } from 'zod';
import type { Logger } from 'pino';
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
  readonly #logger: Pick<Logger, 'warn'> | undefined;

  constructor(
    evaluations: EvaluationService,
    context: TrainingAiContextService,
    gateway: QuestionGenerationGateway,
    logger?: Pick<Logger, 'warn'>,
  ) {
    this.#evaluations = evaluations;
    this.#context = context;
    this.#gateway = gateway;
    this.#logger = logger;
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
      'Return JSON only and include no fields outside the response schema.',
      'Each SINGLE_CHOICE question must have one correct option; each TRUE_FALSE question must use TRUE and FALSE options and one correct option.',
      'Use option ids containing only letters, numbers, underscores, or hyphens.',
      'TRUE_FALSE questions must use option ids TRUE and FALSE.',
      'Every question is worth a positive integer number of points.',
      `AUTHORIZED TRAINING CONTEXT (${context.contextChars} characters):`,
      context.text,
    ].join('\n');
    const generatedResult = await this.#gateway.generate({
      prompt,
      questionCount: input.questionCount,
    });
    const generated = generatedResult.content;
    const parsed = generatedSchema.safeParse(generated);
    if (
      !parsed.success ||
      parsed.data.questions.length !== input.questionCount ||
      parsed.data.questions.some(
        ({ type }) => !input.questionTypes.includes(type),
      )
    ) {
      const receivedQuestionCount =
        typeof generated === 'object' &&
        generated !== null &&
        'questions' in generated &&
        Array.isArray(generated.questions)
          ? generated.questions.length
          : undefined;
      this.#logger?.warn(
        {
          evaluationId,
          trainingId: target.trainingId,
          model: generatedResult.model,
          requestedQuestionCount: input.questionCount,
          receivedQuestionCount,
          validationIssues: parsed.success
            ? undefined
            : parsed.error.issues.slice(0, 5).map((issue) => ({
                code: issue.code,
                path: issue.path.join('.'),
              })),
        },
        'Gemini evaluation output did not match the requested question schema',
      );
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
        model: generatedResult.model,
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
