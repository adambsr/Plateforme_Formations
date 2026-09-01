import { z } from 'zod';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { EnrollmentAccessService } from '../../enrollments/services/enrollment-access.service.js';
import type { TutorMessageInput } from '../dto/tutor.dto.js';
import type { TutorGenerationGateway } from '../infrastructure/gemini-tutor.gateway.js';
import type { TutorContextRetriever } from './course-tutor-context.service.js';

const generatedTutorResponseSchema = z
  .object({
    canAnswer: z.boolean(),
    answer: z.string().trim().min(1).max(8_000),
    citationLessonIds: z.array(z.string()).max(5),
    followUpQuestions: z.array(z.string().trim().min(1).max(300)).max(3),
  })
  .strict();

const modeInstruction: Record<TutorMessageInput['mode'], string> = {
  QUESTION: 'Answer the learner question clearly and pedagogically.',
  SIMPLIFY: 'Explain the relevant concept in simpler language.',
  EXAMPLE: 'Give a concrete example grounded in the lesson material.',
  PRACTICE:
    'Create short practice questions. Do not reveal answers unless the learner asks.',
  SUMMARY: 'Summarize the relevant lesson or module material concisely.',
  REVISION:
    'Create a revision aid and point out concepts the learner should review based only on this conversation.',
};

export class AiTutorService {
  readonly #enrollmentAccess: EnrollmentAccessService;
  readonly #context: TutorContextRetriever;
  readonly #gateway: TutorGenerationGateway;

  constructor(
    enrollmentAccess: EnrollmentAccessService,
    context: TutorContextRetriever,
    gateway: TutorGenerationGateway,
  ) {
    this.#enrollmentAccess = enrollmentAccess;
    this.#context = context;
    this.#gateway = gateway;
  }

  async answer(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    input: TutorMessageInput,
  ) {
    if (principal.role !== 'LEARNER')
      throw new AppError(
        403,
        'AI_TUTOR_LEARNER_ONLY',
        'The course tutor is available only to Learners.',
      );
    await this.#enrollmentAccess.assertTrainingAccess(
      principal.userId,
      trainingId,
    );
    const context = await this.#context.retrieve(principal, trainingId, input);
    const authorizedIds = new Set(
      context.sources.map(({ lessonId }) => lessonId),
    );
    const prompt = [
      `TUTOR TASK: ${modeInstruction[input.mode]}`,
      `LEARNER MESSAGE (untrusted): ${input.message}`,
      input.conversation.length === 0
        ? 'RECENT CONVERSATION: none'
        : `RECENT CONVERSATION (untrusted):\n${input.conversation
            .map(({ role, content }) => `${role}: ${content}`)
            .join('\n')}`,
      'AUTHORIZED COURSE SOURCES:',
      ...context.sources.map(
        (source) =>
          `[LESSON ${source.lessonId}]\nModule: ${source.moduleTitle}\nLesson: ${source.lessonTitle}\n${source.text}`,
      ),
      'Return citationLessonIds only from the bracketed authorized LESSON identifiers. A supported answer requires at least one citation. If support is insufficient, set canAnswer=false and citationLessonIds=[].',
    ].join('\n\n');
    const parsed = generatedTutorResponseSchema.safeParse(
      await this.#gateway.answer(prompt),
    );
    if (!parsed.success)
      throw new AppError(
        502,
        'AI_TUTOR_RESPONSE_SCHEMA_INVALID',
        'Gemini output did not match the grounded tutor response schema.',
      );
    const citationIds = [...new Set(parsed.data.citationLessonIds)];
    const citationsAreValid = citationIds.every((id) => authorizedIds.has(id));
    if (
      !citationsAreValid ||
      (parsed.data.canAnswer && citationIds.length === 0) ||
      (!parsed.data.canAnswer && citationIds.length > 0)
    )
      throw new AppError(
        502,
        'AI_TUTOR_CITATIONS_INVALID',
        'Gemini returned citations outside the authorized course context.',
      );
    return {
      answer: parsed.data.answer,
      grounded: parsed.data.canAnswer,
      citations: citationIds.map((lessonId) => {
        const source = context.sources.find(
          (candidate) => candidate.lessonId === lessonId,
        )!;
        return {
          lessonId,
          lessonTitle: source.lessonTitle,
          moduleTitle: source.moduleTitle,
          href: `/app/content/${trainingId}#lesson-${lessonId}`,
        };
      }),
      followUpQuestions: parsed.data.followUpQuestions,
      metadata: {
        provider: this.#gateway.provider,
        model: this.#gateway.model,
        retrievedLessonCount: context.sources.length,
        contextChars: context.contextChars,
      },
    };
  }
}
