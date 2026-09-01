import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { LessonModel } from '../../content/models/lesson.model.js';
import { TrainingModuleModel } from '../../content/models/training-module.model.js';
import type { TutorMessageInput } from '../dto/tutor.dto.js';

export interface TutorSource {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  text: string;
}

export interface TutorContext {
  sources: TutorSource[];
  contextChars: number;
}

export interface TutorContextRetriever {
  retrieve(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    input: TutorMessageInput,
  ): Promise<TutorContext>;
}

const genericTerms = new Set([
  'avec',
  'dans',
  'des',
  'est',
  'les',
  'pour',
  'que',
  'qui',
  'sur',
  'une',
  'vous',
  'the',
  'and',
  'for',
  'this',
  'that',
]);

function terms(value: string): string[] {
  return [
    ...new Set(
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((term) => !genericTerms.has(term)) ?? [],
    ),
  ];
}

export class CourseTutorContextService implements TutorContextRetriever {
  readonly #maximumChars: number;

  constructor(maximumChars: number) {
    this.#maximumChars = maximumChars;
  }

  async retrieve(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    input: TutorMessageInput,
  ): Promise<TutorContext> {
    if (principal.role !== 'LEARNER')
      throw new AppError(
        403,
        'AI_TUTOR_LEARNER_ONLY',
        'The course tutor is available only to Learners.',
      );

    const modules = await TrainingModuleModel.find({
      trainingId,
      isArchived: false,
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    const moduleById = new Map(
      modules.map((module) => [String(module._id), module]),
    );
    const lessons = await LessonModel.find({
      trainingId,
      moduleId: { $in: modules.map(({ _id }) => _id) },
      isArchived: false,
    })
      .sort({ order: 1, _id: 1 })
      .exec();

    if (
      input.currentLessonId !== undefined &&
      !lessons.some(({ _id }) => String(_id) === input.currentLessonId)
    )
      throw new AppError(
        422,
        'AI_TUTOR_LESSON_NOT_AVAILABLE',
        'The selected Lesson is not available in this Training.',
      );

    const queryTerms = terms(
      `${input.message} ${input.conversation
        .filter(({ role }) => role === 'USER')
        .map(({ content }) => content)
        .join(' ')}`,
    );
    const candidates = lessons
      .map((lesson) => {
        const module = moduleById.get(String(lesson.moduleId));
        if (module === undefined) return undefined;
        const sourceText = [
          lesson.title,
          lesson.description,
          lesson.textContent,
          lesson.instructions,
        ]
          .map((value) => value.trim())
          .filter(Boolean)
          .join('\n');
        if (sourceText === '') return undefined;
        const searchable = terms(`${module.title} ${sourceText}`);
        const searchableSet = new Set(searchable);
        const overlap = queryTerms.reduce(
          (score, term) => score + (searchableSet.has(term) ? 1 : 0),
          0,
        );
        const titleTerms = new Set(terms(`${module.title} ${lesson.title}`));
        const titleOverlap = queryTerms.reduce(
          (score, term) => score + (titleTerms.has(term) ? 3 : 0),
          0,
        );
        return {
          score:
            overlap +
            titleOverlap +
            (input.currentLessonId === String(lesson._id) ? 100 : 0),
          moduleOrder: module.order,
          lessonOrder: lesson.order,
          source: {
            lessonId: String(lesson._id),
            lessonTitle: lesson.title,
            moduleId: String(module._id),
            moduleTitle: module.title,
            text: sourceText,
          } satisfies TutorSource,
        };
      })
      .filter((candidate) => candidate !== undefined)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.moduleOrder - right.moduleOrder ||
          left.lessonOrder - right.lessonOrder,
      )
      .slice(0, 5);

    const sources: TutorSource[] = [];
    let contextChars = 0;
    for (const candidate of candidates) {
      const prefix = `[LESSON ${candidate.source.lessonId}]\nModule: ${candidate.source.moduleTitle}\nLesson: ${candidate.source.lessonTitle}\n`;
      const remaining = this.#maximumChars - contextChars - prefix.length;
      if (remaining <= 0) break;
      const text = candidate.source.text.slice(0, remaining);
      sources.push({ ...candidate.source, text });
      contextChars += prefix.length + text.length;
    }
    if (sources.length === 0)
      throw new AppError(
        422,
        'NO_TUTOR_COURSE_TEXT',
        'This Training has no usable Lesson text for the AI tutor.',
      );
    return { sources, contextChars };
  }
}
