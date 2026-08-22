import mongoose, { type HydratedDocument, type Types } from 'mongoose';

import { LocalFileStorage } from '../../../infrastructure/files/local-file-storage.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentAccessService } from '../../enrollments/services/enrollment-access.service.js';
import {
  TrainingModel,
  type Training,
} from '../../trainings/models/training.model.js';
import type {
  CreateLessonInput,
  CreateModuleInput,
  CreateResourceInput,
  UpdateLessonInput,
  UpdateModuleInput,
  UpdateResourceInput,
} from '../dto/content.dto.js';
import { LessonModel, type Lesson } from '../models/lesson.model.js';
import {
  TrainingModuleModel,
  type TrainingModule,
} from '../models/training-module.model.js';
import {
  TrainingResourceModel,
  type TrainingResource,
} from '../models/training-resource.model.js';

type ContentAccess = 'MANAGE' | 'STAFF_READ' | 'LEARNER_READ';

export interface ContentResourceView {
  id: string;
  title: string;
  description: string;
  order: number;
  type: TrainingResource['type'];
  isVisibleToLearners: boolean;
  externalUrl?: string;
  file?: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    uploadedById: string;
    uploadedAt: string;
    downloadUrl: string;
  };
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentLessonView {
  id: string;
  title: string;
  description: string;
  textContent: string;
  instructions: string;
  order: number;
  isArchived: boolean;
  resources: ContentResourceView[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentModuleView {
  id: string;
  title: string;
  description: string;
  order: number;
  isArchived: boolean;
  lessons: ContentLessonView[];
  createdAt: string;
  updatedAt: string;
}

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

function duplicateOrderError(error: unknown): never {
  if (isDuplicateKeyError(error)) {
    throw new AppError(
      409,
      'CONTENT_ORDER_ALREADY_USED',
      'Another item in this parent already uses that order.',
    );
  }
  throw error;
}

export class ContentService {
  readonly #storage: LocalFileStorage;
  readonly #enrollmentAccess: EnrollmentAccessService;

  constructor(
    storage: LocalFileStorage,
    enrollmentAccess: EnrollmentAccessService,
  ) {
    this.#storage = storage;
    this.#enrollmentAccess = enrollmentAccess;
  }

  async getTrainingContent(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<{
    trainingId: string;
    access: ContentAccess;
    modules: ContentModuleView[];
  }> {
    passwordReady(principal);
    const training = await this.#training(trainingId);
    const access = await this.#contentAccess(principal, training);
    const includeArchived = access === 'MANAGE';
    const modules = await TrainingModuleModel.find({
      trainingId: training._id,
      ...(includeArchived ? {} : { isArchived: false }),
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    const moduleIds = modules.map(({ _id }) => _id);
    const lessons = await LessonModel.find({
      moduleId: { $in: moduleIds },
      ...(includeArchived ? {} : { isArchived: false }),
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    const lessonIds = lessons.map(({ _id }) => _id);
    const resources = await TrainingResourceModel.find({
      lessonId: { $in: lessonIds },
      ...(includeArchived ? {} : { isArchived: false }),
      ...(access === 'LEARNER_READ' ? { isVisibleToLearners: true } : {}),
    })
      .sort({ order: 1, _id: 1 })
      .exec();

    const resourcesByLesson = new Map<string, ContentResourceView[]>();
    for (const resource of resources) {
      const lessonId = String(resource.lessonId);
      const existing = resourcesByLesson.get(lessonId) ?? [];
      existing.push(this.#resourceView(resource));
      resourcesByLesson.set(lessonId, existing);
    }
    const lessonsByModule = new Map<string, ContentLessonView[]>();
    for (const lesson of lessons) {
      const moduleId = String(lesson.moduleId);
      const existing = lessonsByModule.get(moduleId) ?? [];
      existing.push({
        ...this.#lessonView(lesson),
        resources: resourcesByLesson.get(String(lesson._id)) ?? [],
      });
      lessonsByModule.set(moduleId, existing);
    }
    return {
      trainingId,
      access,
      modules: modules.map((module) => ({
        ...this.#moduleView(module),
        lessons: lessonsByModule.get(String(module._id)) ?? [],
      })),
    };
  }

  async createModule(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    input: CreateModuleInput,
  ): Promise<ContentModuleView> {
    const training = await this.#managedTraining(principal, trainingId);
    try {
      return {
        ...this.#moduleView(
          await TrainingModuleModel.create({
            trainingId: training._id,
            ...input,
            isArchived: false,
          }),
        ),
        lessons: [],
      };
    } catch (error) {
      duplicateOrderError(error);
    }
  }

  async updateModule(
    principal: AuthenticatedPrincipal,
    moduleId: string,
    input: UpdateModuleInput,
  ): Promise<ContentModuleView> {
    const module = await this.#module(moduleId);
    await this.#managedTraining(principal, String(module.trainingId));
    this.#assertArchivedUpdate(module.isArchived, input);
    Object.assign(module, input);
    try {
      await module.save();
    } catch (error) {
      duplicateOrderError(error);
    }
    return {
      ...this.#moduleView(module),
      lessons: await this.#lessonViewsForModule(module._id, true),
    };
  }

  async deleteModule(
    principal: AuthenticatedPrincipal,
    moduleId: string,
  ): Promise<void> {
    const module = await this.#module(moduleId);
    await this.#managedTraining(principal, String(module.trainingId));
    const lessons = await LessonModel.find({ moduleId: module._id }).exec();
    const lessonIds = lessons.map(({ _id }) => _id);
    const resources = await TrainingResourceModel.find({
      lessonId: { $in: lessonIds },
    }).exec();
    await this.#assertNoProgress(
      lessonIds,
      resources.map(({ _id }) => _id),
    );
    await mongoose.connection.transaction(async (session) => {
      await TrainingResourceModel.deleteMany(
        { lessonId: { $in: lessonIds } },
        { session },
      );
      await LessonModel.deleteMany({ moduleId: module._id }, { session });
      await TrainingModuleModel.deleteOne({ _id: module._id }, { session });
    });
    await this.#removeUnreferencedFiles(resources);
  }

  async createLesson(
    principal: AuthenticatedPrincipal,
    moduleId: string,
    input: CreateLessonInput,
  ): Promise<ContentLessonView> {
    const module = await this.#module(moduleId);
    await this.#managedTraining(principal, String(module.trainingId));
    if (module.isArchived) {
      throw new AppError(
        409,
        'MODULE_ARCHIVED',
        'A Lesson cannot be added to an archived Module.',
      );
    }
    try {
      return {
        ...this.#lessonView(
          await LessonModel.create({
            trainingId: module.trainingId,
            moduleId: module._id,
            ...input,
            isArchived: false,
          }),
        ),
        resources: [],
      };
    } catch (error) {
      duplicateOrderError(error);
    }
  }

  async updateLesson(
    principal: AuthenticatedPrincipal,
    lessonId: string,
    input: UpdateLessonInput,
  ): Promise<ContentLessonView> {
    const lesson = await this.#lesson(lessonId);
    await this.#managedTraining(principal, String(lesson.trainingId));
    this.#assertArchivedUpdate(lesson.isArchived, input);
    Object.assign(lesson, input);
    try {
      await lesson.save();
    } catch (error) {
      duplicateOrderError(error);
    }
    const resources = await TrainingResourceModel.find({
      lessonId: lesson._id,
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    return {
      ...this.#lessonView(lesson),
      resources: resources.map((resource) => this.#resourceView(resource)),
    };
  }

  async deleteLesson(
    principal: AuthenticatedPrincipal,
    lessonId: string,
  ): Promise<void> {
    const lesson = await this.#lesson(lessonId);
    await this.#managedTraining(principal, String(lesson.trainingId));
    const resources = await TrainingResourceModel.find({
      lessonId: lesson._id,
    }).exec();
    await this.#assertNoProgress(
      [lesson._id],
      resources.map(({ _id }) => _id),
    );
    await mongoose.connection.transaction(async (session) => {
      await TrainingResourceModel.deleteMany(
        { lessonId: lesson._id },
        { session },
      );
      await LessonModel.deleteOne({ _id: lesson._id }, { session });
    });
    await this.#removeUnreferencedFiles(resources);
  }

  async createResource(
    principal: AuthenticatedPrincipal,
    lessonId: string,
    input: CreateResourceInput,
    upload: Express.Multer.File | undefined,
  ): Promise<ContentResourceView> {
    const lesson = await this.#lesson(lessonId);
    await this.#managedTraining(principal, String(lesson.trainingId));
    if (lesson.isArchived) {
      throw new AppError(
        409,
        'LESSON_ARCHIVED',
        'A Resource cannot be added to an archived Lesson.',
      );
    }
    if (input.type === 'FILE' && upload === undefined) {
      throw new AppError(
        422,
        'RESOURCE_FILE_REQUIRED',
        'A file upload is required for a FILE Resource.',
      );
    }
    if (input.type === 'EXTERNAL_URL' && upload !== undefined) {
      throw new AppError(
        422,
        'UNEXPECTED_RESOURCE_FILE',
        'An external URL Resource cannot include a file upload.',
      );
    }
    if (input.type === 'EXTERNAL_URL' && input.externalUrl === undefined) {
      throw new AppError(
        422,
        'RESOURCE_URL_REQUIRED',
        'An external URL is required for this Resource.',
      );
    }
    const stored =
      upload === undefined ? undefined : await this.#storage.store(upload);
    try {
      const resource = await TrainingResourceModel.create({
        trainingId: lesson.trainingId,
        lessonId: lesson._id,
        title: input.title,
        description: input.description,
        order: input.order,
        type: input.type,
        isVisibleToLearners: input.isVisibleToLearners,
        isArchived: false,
        ...(input.type === 'EXTERNAL_URL'
          ? { externalUrl: input.externalUrl as string }
          : {
              file: {
                ...stored,
                uploadedById: new mongoose.Types.ObjectId(principal.userId),
              },
            }),
      });
      return this.#resourceView(resource);
    } catch (error) {
      if (stored !== undefined) await this.#storage.remove(stored.relativePath);
      duplicateOrderError(error);
    }
  }

  async updateResource(
    principal: AuthenticatedPrincipal,
    resourceId: string,
    input: UpdateResourceInput,
  ): Promise<ContentResourceView> {
    const resource = await this.#resource(resourceId);
    await this.#managedTraining(principal, String(resource.trainingId));
    this.#assertArchivedUpdate(resource.isArchived, input);
    if (input.externalUrl !== undefined && resource.type !== 'EXTERNAL_URL') {
      throw new AppError(
        422,
        'RESOURCE_TYPE_IMMUTABLE',
        'Only an external URL Resource can update its URL.',
      );
    }
    Object.assign(resource, input);
    try {
      await resource.save();
    } catch (error) {
      duplicateOrderError(error);
    }
    return this.#resourceView(resource);
  }

  async deleteResource(
    principal: AuthenticatedPrincipal,
    resourceId: string,
  ): Promise<void> {
    const resource = await this.#resource(resourceId);
    await this.#managedTraining(principal, String(resource.trainingId));
    await this.#assertNoProgress([], [resource._id]);
    await TrainingResourceModel.deleteOne({ _id: resource._id });
    await this.#removeUnreferencedFiles([resource]);
  }

  async downloadableFile(
    principal: AuthenticatedPrincipal,
    resourceId: string,
  ): Promise<{ absolutePath: string; originalName: string; mimeType: string }> {
    passwordReady(principal);
    const resource = await this.#resource(resourceId);
    const training = await this.#training(String(resource.trainingId));
    const access = await this.#contentAccess(principal, training);
    if (resource.type !== 'FILE' || resource.file === undefined) {
      throw new AppError(
        409,
        'RESOURCE_NOT_DOWNLOADABLE',
        'This Resource does not contain a local file.',
      );
    }
    if (access !== 'MANAGE') {
      const lesson = await this.#lesson(String(resource.lessonId));
      const module = await this.#module(String(lesson.moduleId));
      if (
        module.isArchived ||
        lesson.isArchived ||
        resource.isArchived ||
        (access === 'LEARNER_READ' && !resource.isVisibleToLearners)
      ) {
        throw new AppError(
          404,
          'RESOURCE_NOT_FOUND',
          'The Resource does not exist.',
        );
      }
    }
    return {
      absolutePath: this.#storage.resolve(resource.file.relativePath),
      originalName: resource.file.originalName,
      mimeType: resource.file.mimeType,
    };
  }

  async #managedTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<HydratedDocument<Training>> {
    passwordReady(principal);
    const training = await this.#training(trainingId);
    if (
      principal.role !== 'ADMIN' &&
      !(
        principal.role === 'TRAINER' &&
        String(training.ownerTrainerId) === principal.userId
      )
    ) {
      throw new AppError(
        403,
        'CONTENT_MANAGEMENT_FORBIDDEN',
        'Only an Admin or the owner Trainer can manage this content.',
      );
    }
    if (training.status === 'ARCHIVED') {
      throw new AppError(
        409,
        'ARCHIVED_TRAINING_IMMUTABLE',
        'Content of an archived Training cannot be modified.',
      );
    }
    return training;
  }

  async #contentAccess(
    principal: AuthenticatedPrincipal,
    training: HydratedDocument<Training>,
  ): Promise<ContentAccess> {
    if (
      principal.role === 'ADMIN' ||
      (principal.role === 'TRAINER' &&
        String(training.ownerTrainerId) === principal.userId)
    ) {
      return 'MANAGE';
    }
    if (principal.role === 'TRAINER') {
      const assigned = await mongoose.connection
        .collection('training_sessions')
        .findOne({
          trainingId: training._id,
          assignedTrainerIds: new mongoose.Types.ObjectId(principal.userId),
          status: { $ne: 'CANCELLED' },
        });
      if (assigned !== null) return 'STAFF_READ';
    }
    if (principal.role === 'LEARNER') {
      if (
        await this.#enrollmentAccess.hasTrainingAccess(
          principal.userId,
          String(training._id),
        )
      ) {
        return 'LEARNER_READ';
      }
    }
    throw new AppError(
      403,
      'CONTENT_ACCESS_FORBIDDEN',
      'An active Enrollment or relevant Training assignment is required.',
    );
  }

  async #training(trainingId: string): Promise<HydratedDocument<Training>> {
    const training = await TrainingModel.findById(trainingId).exec();
    if (training === null) {
      throw new AppError(
        404,
        'TRAINING_NOT_FOUND',
        'The Training does not exist.',
      );
    }
    return training;
  }

  async #module(moduleId: string): Promise<HydratedDocument<TrainingModule>> {
    const module = await TrainingModuleModel.findById(moduleId).exec();
    if (module === null) {
      throw new AppError(404, 'MODULE_NOT_FOUND', 'The Module does not exist.');
    }
    return module;
  }

  async #lesson(lessonId: string): Promise<HydratedDocument<Lesson>> {
    const lesson = await LessonModel.findById(lessonId).exec();
    if (lesson === null) {
      throw new AppError(404, 'LESSON_NOT_FOUND', 'The Lesson does not exist.');
    }
    return lesson;
  }

  async #resource(
    resourceId: string,
  ): Promise<HydratedDocument<TrainingResource>> {
    const resource = await TrainingResourceModel.findById(resourceId).exec();
    if (resource === null) {
      throw new AppError(
        404,
        'RESOURCE_NOT_FOUND',
        'The Resource does not exist.',
      );
    }
    return resource;
  }

  #assertArchivedUpdate(archived: boolean, input: object): void {
    if (!archived) return;
    const fields = input as Record<string, unknown>;
    if (
      fields['isArchived'] !== false ||
      Object.keys(fields).some((key) => key !== 'isArchived')
    ) {
      throw new AppError(
        409,
        'ARCHIVED_CONTENT_IMMUTABLE',
        'Restore archived content before modifying it.',
      );
    }
  }

  async #assertNoProgress(
    lessonIds: readonly Types.ObjectId[],
    resourceIds: readonly Types.ObjectId[],
  ): Promise<void> {
    const [lessonProgress, resourceProgress] = await Promise.all([
      lessonIds.length === 0
        ? Promise.resolve(null)
        : mongoose.connection.collection('lesson_progress').findOne({
            lessonId: { $in: lessonIds },
          }),
      resourceIds.length === 0
        ? Promise.resolve(null)
        : mongoose.connection.collection('resource_progress').findOne({
            resourceId: { $in: resourceIds },
          }),
    ]);
    if (lessonProgress !== null || resourceProgress !== null) {
      throw new AppError(
        409,
        'CONTENT_HAS_PROGRESS',
        'Content referenced by Learner progress must be archived instead of deleted.',
      );
    }
  }

  async #removeUnreferencedFiles(
    resources: readonly HydratedDocument<TrainingResource>[],
  ): Promise<void> {
    for (const resource of resources) {
      const relativePath = resource.file?.relativePath;
      if (relativePath === undefined) continue;
      const remaining = await TrainingResourceModel.exists({
        'file.relativePath': relativePath,
      });
      if (remaining === null) await this.#storage.remove(relativePath);
    }
  }

  #moduleView(module: HydratedDocument<TrainingModule>) {
    return {
      id: String(module._id),
      title: module.title,
      description: module.description,
      order: module.order,
      isArchived: module.isArchived,
      createdAt: module.createdAt.toISOString(),
      updatedAt: module.updatedAt.toISOString(),
    };
  }

  #lessonView(lesson: HydratedDocument<Lesson>) {
    return {
      id: String(lesson._id),
      title: lesson.title,
      description: lesson.description,
      textContent: lesson.textContent,
      instructions: lesson.instructions,
      order: lesson.order,
      isArchived: lesson.isArchived,
      createdAt: lesson.createdAt.toISOString(),
      updatedAt: lesson.updatedAt.toISOString(),
    };
  }

  #resourceView(
    resource: HydratedDocument<TrainingResource>,
  ): ContentResourceView {
    return {
      id: String(resource._id),
      title: resource.title,
      description: resource.description,
      order: resource.order,
      type: resource.type,
      isVisibleToLearners: resource.isVisibleToLearners,
      ...(resource.externalUrl === undefined
        ? {}
        : { externalUrl: resource.externalUrl }),
      ...(resource.file === undefined
        ? {}
        : {
            file: {
              originalName: resource.file.originalName,
              mimeType: resource.file.mimeType,
              sizeBytes: resource.file.sizeBytes,
              checksumSha256: resource.file.checksumSha256,
              uploadedById: String(resource.file.uploadedById),
              uploadedAt: resource.file.uploadedAt.toISOString(),
              downloadUrl: `/api/resources/${String(resource._id)}/download`,
            },
          }),
      isArchived: resource.isArchived,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
    };
  }

  async #lessonViewsForModule(
    moduleId: Types.ObjectId,
    includeArchived: boolean,
  ): Promise<ContentLessonView[]> {
    const lessons = await LessonModel.find({
      moduleId,
      ...(includeArchived ? {} : { isArchived: false }),
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    const resources = await TrainingResourceModel.find({
      lessonId: { $in: lessons.map(({ _id }) => _id) },
      ...(includeArchived ? {} : { isArchived: false }),
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    return lessons.map((lesson) => ({
      ...this.#lessonView(lesson),
      resources: resources
        .filter(({ lessonId }) => String(lessonId) === String(lesson._id))
        .map((resource) => this.#resourceView(resource)),
    }));
  }
}
