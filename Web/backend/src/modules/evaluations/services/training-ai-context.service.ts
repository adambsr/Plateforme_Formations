import path from 'node:path';
import type { LocalFileStorage } from '../../../infrastructure/files/local-file-storage.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { LessonModel } from '../../content/models/lesson.model.js';
import { TrainingModuleModel } from '../../content/models/training-module.model.js';
import { TrainingResourceModel } from '../../content/models/training-resource.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import {
  DocumentTextExtractor,
  EXTRACTABLE_EXTENSIONS,
} from '../infrastructure/document-text-extractor.js';

type Skipped = {
  id: string;
  name: string;
  reason: 'UNSUPPORTED' | 'NO_TEXT' | 'EXTRACTION_FAILED';
};
export interface TrainingAiContext {
  text: string;
  contextChars: number;
  extractedResources: Array<{ id: string; name: string }>;
  skippedResources: Skipped[];
}

export class TrainingAiContextService {
  readonly #storage: LocalFileStorage;
  readonly #maximumChars: number;
  readonly #extractor: DocumentTextExtractor;

  constructor(
    storage: LocalFileStorage,
    maximumChars: number,
    extractor = new DocumentTextExtractor(),
  ) {
    this.#storage = storage;
    this.#maximumChars = maximumChars;
    this.#extractor = extractor;
  }

  async build(trainingId: string): Promise<TrainingAiContext> {
    const [training, modules, lessons, resources] = await Promise.all([
      TrainingModel.findById(trainingId).exec(),
      TrainingModuleModel.find({ trainingId, isArchived: false })
        .sort({ order: 1 })
        .exec(),
      LessonModel.find({ trainingId, isArchived: false })
        .sort({ order: 1 })
        .exec(),
      TrainingResourceModel.find({
        trainingId,
        isArchived: false,
      })
        .sort({ lessonId: 1, order: 1 })
        .exec(),
    ]);
    if (training === null)
      throw new AppError(
        404,
        'TRAINING_NOT_FOUND',
        'The Training does not exist.',
      );
    const modulePosition = new Map(
      modules.map((item, index) => [String(item._id), index]),
    );
    lessons.sort(
      (left, right) =>
        (modulePosition.get(String(left.moduleId)) ?? 0) -
          (modulePosition.get(String(right.moduleId)) ?? 0) ||
        left.order - right.order,
    );
    const sections = [
      `TRAINING\nTitle: ${training.title}\nDescription: ${training.description}\nObjectives: ${training.objectives.join('; ')}\nPrerequisites: ${training.prerequisites.join('; ')}`,
      ...modules.map(
        (item) => `MODULE ${item.order}: ${item.title}\n${item.description}`,
      ),
      ...lessons.map(
        (item) =>
          `LESSON ${item.order}: ${item.title}\n${item.description}\n${item.textContent}\n${item.instructions}`,
      ),
    ];
    let hasUsableText =
      modules.some(({ description }) => description.trim() !== '') ||
      lessons.some(
        ({ description, textContent, instructions }) =>
          description.trim() !== '' ||
          textContent.trim() !== '' ||
          instructions.trim() !== '',
      );
    const extractedResources: Array<{ id: string; name: string }> = [];
    const skippedResources: Skipped[] = [];
    for (const resource of resources) {
      const file = resource.file;
      if (resource.type !== 'FILE' || file === undefined) {
        skippedResources.push({
          id: String(resource._id),
          name: resource.title,
          reason: 'UNSUPPORTED',
        });
        continue;
      }
      const extension = path.extname(file.originalName).toLowerCase();
      if (!(EXTRACTABLE_EXTENSIONS as readonly string[]).includes(extension)) {
        skippedResources.push({
          id: String(resource._id),
          name: file.originalName,
          reason: 'UNSUPPORTED',
        });
        continue;
      }
      try {
        const value = await this.#extractor.extract(
          this.#storage.resolve(file.relativePath),
          file.originalName,
        );
        if (value === '')
          skippedResources.push({
            id: String(resource._id),
            name: file.originalName,
            reason: 'NO_TEXT',
          });
        else {
          sections.push(
            `RESOURCE: ${resource.title} (${file.originalName})\n${value}`,
          );
          extractedResources.push({
            id: String(resource._id),
            name: file.originalName,
          });
          hasUsableText = true;
        }
      } catch {
        skippedResources.push({
          id: String(resource._id),
          name: file.originalName,
          reason: 'EXTRACTION_FAILED',
        });
      }
    }
    let text = '';
    for (const section of sections
      .map((value) => value.trim())
      .filter(Boolean)) {
      const separator = text === '' ? '' : '\n\n';
      const remaining = this.#maximumChars - text.length - separator.length;
      if (remaining <= 0) break;
      text += separator + section.slice(0, remaining);
    }
    if (!hasUsableText)
      throw new AppError(
        422,
        'NO_EXTRACTABLE_TRAINING_TEXT',
        'This Training has no usable module, lesson, PDF, DOCX, PPTX, or TXT text for AI generation.',
      );
    return {
      text,
      contextChars: text.length,
      extractedResources,
      skippedResources,
    };
  }
}
