import mongoose, { type Types } from 'mongoose';

export interface TrainingLifecycleRepository {
  hasModuleWithLesson(trainingId: Types.ObjectId): Promise<boolean>;
  hasBusinessHistory(trainingId: Types.ObjectId): Promise<boolean>;
}

export const mongooseTrainingLifecycleRepository: TrainingLifecycleRepository =
  {
    async hasModuleWithLesson(trainingId) {
      const modules = await mongoose.connection
        .collection('training_modules')
        .find({ trainingId, isArchived: { $ne: true } })
        .project<{ _id: Types.ObjectId }>({ _id: 1 })
        .toArray();
      if (modules.length === 0) return false;
      const lesson = await mongoose.connection.collection('lessons').findOne({
        trainingId,
        moduleId: { $in: modules.map((module) => module._id) },
        isArchived: { $ne: true },
      });
      return lesson !== null;
    },

    async hasBusinessHistory(trainingId) {
      const database = mongoose.connection;
      const evaluationIds = await database
        .collection('evaluations')
        .find({ trainingId })
        .project<{ _id: Types.ObjectId }>({ _id: 1 })
        .toArray();
      const checks = await Promise.all([
        database.collection('training_sessions').findOne({ trainingId }),
        database.collection('enrollments').findOne({ trainingId }),
        database.collection('payments').findOne({ trainingId }),
        evaluationIds.length === 0
          ? Promise.resolve(null)
          : database.collection('evaluation_attempts').findOne({
              evaluationId: { $in: evaluationIds.map(({ _id }) => _id) },
            }),
      ]);
      return checks.some((record) => record !== null);
    },
  };
