import mongoose, { type HydratedDocument, type QueryFilter } from 'mongoose';

import type { LocalFileStorage } from '../../../infrastructure/files/local-file-storage.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { UserModel, type User } from '../../users/models/user.model.js';
import { publicationBlockReason, TND_CURRENCY } from '../domain/training.js';
import type {
  CreateCategoryInput,
  CreateTrainingInput,
  TrainingListInput,
  UpdateCategoryInput,
  UpdateTrainingInput,
} from '../dto/training.dto.js';
import {
  TrainingCategoryModel,
  type TrainingCategory,
} from '../models/training-category.model.js';
import { TrainingModel, type Training } from '../models/training.model.js';
import {
  mongooseTrainingLifecycleRepository,
  type TrainingLifecycleRepository,
} from '../repositories/training-lifecycle.repository.js';

export interface PublicTrainingCategory {
  id: string;
  name: string;
  description?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTraining {
  id: string;
  title: string;
  description: string;
  category: Pick<PublicTrainingCategory, 'id' | 'name' | 'isArchived'>;
  level: string;
  durationMinutes: number;
  objectives: string[];
  prerequisites: string[];
  type: Training['type'];
  priceMinor: number;
  currency: typeof TND_CURRENCY;
  ownerTrainer: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  status: Training['status'];
  minimumAttendancePercent?: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTrainings {
  items: PublicTraining[];
  page: number;
  pageSize: number;
  total: number;
}

function normalizeCategoryName(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

function toPublicCategory(
  category: HydratedDocument<TrainingCategory>,
): PublicTrainingCategory {
  return {
    id: String(category._id),
    name: category.name,
    ...(category.description === undefined
      ? {}
      : { description: category.description }),
    isArchived: category.isArchived,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
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

export class TrainingService {
  readonly #lifecycle: TrainingLifecycleRepository;
  readonly #fileStorage: LocalFileStorage | undefined;

  constructor(
    lifecycle: TrainingLifecycleRepository = mongooseTrainingLifecycleRepository,
    fileStorage?: LocalFileStorage,
  ) {
    this.#lifecycle = lifecycle;
    this.#fileStorage = fileStorage;
  }

  async listCategories(
    includeArchived: boolean,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<PublicTrainingCategory[]> {
    if (includeArchived && principal?.role !== 'ADMIN') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only an Admin can list archived categories.',
      );
    }
    const categories = await TrainingCategoryModel.find(
      includeArchived ? {} : { isArchived: false },
    )
      .sort({ name: 1, _id: 1 })
      .exec();
    return categories.map(toPublicCategory);
  }

  async createCategory(
    principal: AuthenticatedPrincipal,
    input: CreateCategoryInput,
  ): Promise<PublicTrainingCategory> {
    this.#requireCategoryAdmin(principal);
    try {
      return toPublicCategory(
        await TrainingCategoryModel.create({
          name: input.name,
          normalizedName: normalizeCategoryName(input.name),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          isArchived: false,
        }),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          'CATEGORY_NAME_ALREADY_EXISTS',
          'A category already uses this name.',
        );
      }
      throw error;
    }
  }

  async updateCategory(
    principal: AuthenticatedPrincipal,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<PublicTrainingCategory> {
    this.#requireCategoryAdmin(principal);
    const update: Record<string, unknown> = { ...input };
    const unset: Record<string, 1> = {};
    if (input.description === null) {
      delete update.description;
      unset.description = 1;
    }
    if (input.name !== undefined) {
      update.normalizedName = normalizeCategoryName(input.name);
    }
    try {
      const category = await TrainingCategoryModel.findByIdAndUpdate(
        categoryId,
        {
          ...(Object.keys(update).length === 0 ? {} : { $set: update }),
          ...(Object.keys(unset).length === 0 ? {} : { $unset: unset }),
        },
        { returnDocument: 'after', runValidators: true },
      ).exec();
      if (category === null) {
        throw new AppError(
          404,
          'CATEGORY_NOT_FOUND',
          'The category does not exist.',
        );
      }
      return toPublicCategory(category);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          'CATEGORY_NAME_ALREADY_EXISTS',
          'A category already uses this name.',
        );
      }
      throw error;
    }
  }

  async listTrainings(
    input: TrainingListInput,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<PaginatedTrainings> {
    const filter: QueryFilter<Training> = {};
    if (input.view === 'PUBLIC') {
      filter.status = 'PUBLISHED';
    } else {
      if (principal === undefined || principal.role === 'LEARNER') {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Training management access is required.',
        );
      }
      passwordReady(principal);
      if (principal.role === 'TRAINER') {
        filter.ownerTrainerId = new mongoose.Types.ObjectId(principal.userId);
      }
    }
    if (input.categoryId !== undefined) {
      filter.categoryId = new mongoose.Types.ObjectId(input.categoryId);
    }
    if (input.type !== undefined) filter.type = input.type;

    const [trainings, total] = await Promise.all([
      TrainingModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      TrainingModel.countDocuments(filter),
    ]);
    return {
      items: await this.#toPublicTrainings(trainings),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async getTraining(
    trainingId: string,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<PublicTraining> {
    const training = await this.#findTraining(trainingId);
    if (training.status !== 'PUBLISHED') {
      if (principal === undefined) throw this.#trainingNotFound();
      passwordReady(principal);
      if (
        principal.role !== 'ADMIN' &&
        !(
          principal.role === 'TRAINER' &&
          String(training.ownerTrainerId) === principal.userId
        )
      ) {
        throw this.#trainingNotFound();
      }
    }
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async createTraining(
    principal: AuthenticatedPrincipal,
    input: CreateTrainingInput,
  ): Promise<PublicTraining> {
    passwordReady(principal);
    if (principal.role !== 'ADMIN' && principal.role !== 'TRAINER') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only an Admin or Trainer can create a Training.',
      );
    }
    const category = await this.#activeCategory(input.categoryId);
    const owner = await this.#creationOwner(principal, input.ownerTrainerId);
    this.#validateModality(input.type, input.minimumAttendancePercent);
    const training = await TrainingModel.create({
      title: input.title,
      description: input.description,
      categoryId: category._id,
      level: input.level,
      durationMinutes: input.durationMinutes,
      objectives: input.objectives,
      prerequisites: input.prerequisites,
      type: input.type,
      priceMinor: input.priceMinor,
      currency: TND_CURRENCY,
      ownerTrainerId: owner._id,
      status: 'DRAFT',
      ...(input.type === 'IN_PERSON'
        ? {
            minimumAttendancePercent: input.minimumAttendancePercent ?? 80,
          }
        : {}),
    });
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async updateTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    input: UpdateTrainingInput,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    if (training.status === 'ARCHIVED') {
      throw new AppError(
        409,
        'ARCHIVED_TRAINING_IMMUTABLE',
        'An archived Training cannot be modified.',
      );
    }
    if (input.categoryId !== undefined) {
      training.categoryId = (await this.#activeCategory(input.categoryId))._id;
    }
    if (input.minimumAttendancePercent !== undefined) {
      this.#validateModality(training.type, input.minimumAttendancePercent);
      training.minimumAttendancePercent = input.minimumAttendancePercent;
    }
    if (input.title !== undefined) training.title = input.title;
    if (input.description !== undefined)
      training.description = input.description;
    if (input.level !== undefined) training.level = input.level;
    if (input.durationMinutes !== undefined)
      training.durationMinutes = input.durationMinutes;
    if (input.objectives !== undefined) training.objectives = input.objectives;
    if (input.prerequisites !== undefined)
      training.prerequisites = input.prerequisites;
    if (input.priceMinor !== undefined) training.priceMinor = input.priceMinor;
    await training.save();
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async publishTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    if (training.status === 'PUBLISHED') {
      return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
    }
    if (training.status === 'ARCHIVED') {
      throw new AppError(
        409,
        'INVALID_TRAINING_STATUS',
        'An archived Training cannot be published.',
      );
    }
    await Promise.all([
      this.#activeCategory(String(training.categoryId)),
      this.#activeTrainer(String(training.ownerTrainerId)),
    ]);
    const blockReason = publicationBlockReason({
      type: training.type,
      hasModuleWithLesson: await this.#lifecycle.hasModuleWithLesson(
        training._id,
      ),
    });
    if (blockReason !== undefined) {
      throw new AppError(409, 'TRAINING_NOT_PUBLISHABLE', blockReason);
    }
    training.status = 'PUBLISHED';
    await training.save();
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async archiveTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    if (training.status === 'ARCHIVED') {
      return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
    }
    if (training.status !== 'PUBLISHED') {
      throw new AppError(
        409,
        'DRAFT_TRAINING_CANNOT_BE_ARCHIVED',
        'Delete an unused draft instead of archiving it.',
      );
    }
    training.status = 'ARCHIVED';
    await training.save();
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async unarchiveTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    if (training.status !== 'ARCHIVED') {
      throw new AppError(
        409,
        'ARCHIVED_TRAINING_REQUIRED',
        'Seule une formation archivée peut être désarchivée.',
      );
    }
    training.status = 'DRAFT';
    await training.save();
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async uploadThumbnail(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    if (file === undefined) {
      throw new AppError(422, 'THUMBNAIL_REQUIRED', 'Sélectionnez une image.');
    }
    if (!file.mimetype.toLowerCase().startsWith('image/')) {
      throw new AppError(
        422,
        'THUMBNAIL_IMAGE_REQUIRED',
        'La miniature doit être une image PNG, JPEG, GIF ou WebP.',
      );
    }
    if (this.#fileStorage === undefined) {
      throw new Error('Training thumbnail storage is not configured.');
    }
    const stored = await this.#fileStorage.store(file, 'training-thumbnails');
    const previousPath = training.thumbnail?.relativePath;
    try {
      training.thumbnail = {
        originalName: stored.originalName,
        relativePath: stored.relativePath,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        uploadedAt: stored.uploadedAt,
      };
      await training.save();
    } catch (error) {
      await this.#fileStorage.remove(stored.relativePath);
      throw error;
    }
    if (previousPath !== undefined)
      await this.#fileStorage.remove(previousPath);
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async removeThumbnail(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<PublicTraining> {
    const training = await this.#managedTraining(principal, trainingId);
    const previousPath = training.thumbnail?.relativePath;
    training.set('thumbnail', undefined);
    await training.save();
    if (previousPath !== undefined && this.#fileStorage !== undefined) {
      await this.#fileStorage.remove(previousPath);
    }
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async thumbnailFile(
    trainingId: string,
    principal: AuthenticatedPrincipal | undefined,
  ): Promise<{ absolutePath: string; mimeType: string }> {
    const training = await this.#findTraining(trainingId);
    if (training.status !== 'PUBLISHED') {
      if (principal === undefined) throw this.#trainingNotFound();
      await this.#managedTraining(principal, trainingId);
    }
    if (training.thumbnail === undefined || this.#fileStorage === undefined) {
      throw new AppError(
        404,
        'TRAINING_THUMBNAIL_NOT_FOUND',
        'Cette formation ne possède pas de miniature.',
      );
    }
    return {
      absolutePath: this.#fileStorage.resolve(training.thumbnail.relativePath),
      mimeType: training.thumbnail.mimeType,
    };
  }

  async deleteTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<void> {
    const training = await this.#managedTraining(principal, trainingId);
    if (training.status !== 'DRAFT') {
      throw new AppError(
        409,
        'TRAINING_MUST_BE_ARCHIVED',
        'Only an unused draft Training can be deleted.',
      );
    }
    if (await this.#lifecycle.hasBusinessHistory(training._id)) {
      throw new AppError(
        409,
        'TRAINING_HAS_HISTORY',
        'A Training with business history cannot be deleted.',
      );
    }
    const deleted = await TrainingModel.deleteOne({
      _id: training._id,
      status: 'DRAFT',
    });
    if (deleted.deletedCount !== 1) {
      throw new AppError(
        409,
        'TRAINING_CHANGED',
        'The Training changed before it could be deleted.',
      );
    }
    if (training.thumbnail !== undefined && this.#fileStorage !== undefined) {
      await this.#fileStorage.remove(training.thumbnail.relativePath);
    }
  }

  async transferOwnership(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    ownerTrainerId: string,
  ): Promise<PublicTraining> {
    passwordReady(principal);
    if (principal.role !== 'ADMIN') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only an Admin can transfer Training ownership.',
      );
    }
    const [training, owner] = await Promise.all([
      this.#findTraining(trainingId),
      this.#activeTrainer(ownerTrainerId),
    ]);
    training.ownerTrainerId = owner._id;
    await training.save();
    return (await this.#toPublicTrainings([training]))[0] as PublicTraining;
  }

  async #creationOwner(
    principal: AuthenticatedPrincipal,
    requestedOwnerId: string | undefined,
  ): Promise<HydratedDocument<User>> {
    if (principal.role === 'TRAINER') {
      if (
        requestedOwnerId !== undefined &&
        requestedOwnerId !== principal.userId
      ) {
        throw new AppError(
          403,
          'OWNER_ASSIGNMENT_FORBIDDEN',
          'A Trainer becomes the owner of Trainings they create.',
        );
      }
      return this.#activeTrainer(principal.userId);
    }
    if (requestedOwnerId === undefined) {
      throw new AppError(
        422,
        'OWNER_TRAINER_REQUIRED',
        'An Admin must select the owner Trainer.',
      );
    }
    return this.#activeTrainer(requestedOwnerId);
  }

  async #activeTrainer(trainerId: string): Promise<HydratedDocument<User>> {
    const trainer = await UserModel.findOne({
      _id: trainerId,
      role: 'TRAINER',
      isActive: true,
    }).exec();
    if (trainer === null) {
      throw new AppError(
        422,
        'ACTIVE_TRAINER_REQUIRED',
        'The owner must be an active Trainer.',
      );
    }
    return trainer;
  }

  async #activeCategory(
    categoryId: string,
  ): Promise<HydratedDocument<TrainingCategory>> {
    const category = await TrainingCategoryModel.findOne({
      _id: categoryId,
      isArchived: false,
    }).exec();
    if (category === null) {
      throw new AppError(
        422,
        'ACTIVE_CATEGORY_REQUIRED',
        'The Training category must be active.',
      );
    }
    return category;
  }

  async #managedTraining(
    principal: AuthenticatedPrincipal,
    trainingId: string,
  ): Promise<HydratedDocument<Training>> {
    passwordReady(principal);
    const training = await this.#findTraining(trainingId);
    if (
      principal.role !== 'ADMIN' &&
      !(
        principal.role === 'TRAINER' &&
        String(training.ownerTrainerId) === principal.userId
      )
    ) {
      throw new AppError(
        403,
        'TRAINING_MANAGEMENT_FORBIDDEN',
        'Only an Admin or the owner Trainer can manage this Training.',
      );
    }
    return training;
  }

  async #findTraining(trainingId: string): Promise<HydratedDocument<Training>> {
    const training = await TrainingModel.findById(trainingId).exec();
    if (training === null) throw this.#trainingNotFound();
    return training;
  }

  #trainingNotFound(): AppError {
    return new AppError(
      404,
      'TRAINING_NOT_FOUND',
      'The Training does not exist.',
    );
  }

  #requireCategoryAdmin(principal: AuthenticatedPrincipal): void {
    passwordReady(principal);
    if (principal.role !== 'ADMIN') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only an Admin can manage Training categories.',
      );
    }
  }

  #validateModality(
    type: Training['type'],
    minimumAttendancePercent: number | undefined,
  ): void {
    if (
      type === 'SELF_PACED_ONLINE' &&
      minimumAttendancePercent !== undefined
    ) {
      throw new AppError(
        422,
        'INVALID_TRAINING_MODALITY_FIELDS',
        'minimumAttendancePercent is available only for in-person Trainings.',
      );
    }
  }

  async #toPublicTrainings(
    trainings: readonly HydratedDocument<Training>[],
  ): Promise<PublicTraining[]> {
    if (trainings.length === 0) return [];
    const categoryIds = [
      ...new Set(trainings.map(({ categoryId }) => String(categoryId))),
    ];
    const ownerIds = [
      ...new Set(trainings.map(({ ownerTrainerId }) => String(ownerTrainerId))),
    ];
    const [categories, owners] = await Promise.all([
      TrainingCategoryModel.find({ _id: { $in: categoryIds } }).exec(),
      UserModel.find({ _id: { $in: ownerIds }, role: 'TRAINER' }).exec(),
    ]);
    const categoriesById = new Map(
      categories.map((category) => [String(category._id), category]),
    );
    const ownersById = new Map(
      owners.map((owner) => [String(owner._id), owner]),
    );

    return trainings.map((training) => {
      const category = categoriesById.get(String(training.categoryId));
      const owner = ownersById.get(String(training.ownerTrainerId));
      if (category === undefined || owner === undefined) {
        throw new Error('Training catalogue references are inconsistent.');
      }
      return {
        id: String(training._id),
        title: training.title,
        description: training.description,
        category: {
          id: String(category._id),
          name: category.name,
          isArchived: category.isArchived,
        },
        level: training.level,
        durationMinutes: training.durationMinutes,
        objectives: [...training.objectives],
        prerequisites: [...training.prerequisites],
        type: training.type,
        priceMinor: training.priceMinor,
        currency: training.currency,
        ownerTrainer: {
          id: String(owner._id),
          ...(owner.profile.firstName === undefined
            ? {}
            : { firstName: owner.profile.firstName }),
          ...(owner.profile.lastName === undefined
            ? {}
            : { lastName: owner.profile.lastName }),
        },
        status: training.status,
        ...(training.thumbnail === undefined
          ? {}
          : {
              thumbnailUrl: `/trainings/${String(training._id)}/thumbnail?v=${training.thumbnail.uploadedAt.getTime()}`,
            }),
        ...(training.minimumAttendancePercent === undefined
          ? {}
          : {
              minimumAttendancePercent: training.minimumAttendancePercent,
            }),
        createdAt: training.createdAt.toISOString(),
        updatedAt: training.updatedAt.toISOString(),
      };
    });
  }
}
