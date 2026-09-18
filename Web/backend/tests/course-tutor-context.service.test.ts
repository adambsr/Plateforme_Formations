import { describe, expect, it, vi } from 'vitest';

import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingResourceModel } from '../src/modules/content/models/training-resource.model.js';
import { CourseTutorContextService } from '../src/modules/tutor/services/course-tutor-context.service.js';

const trainingId = '000000020000000000000001';
const moduleId = '000000030000000000000001';
const lessonId = '000000040000000000000001';

function query(values: unknown[]) {
  return {
    sort: () => ({ exec: async () => values }),
  };
}

describe('CourseTutorContextService document retrieval', () => {
  it('adds a visible supported resource to its matching lesson source', async () => {
    const moduleFind = vi
      .spyOn(TrainingModuleModel, 'find')
      .mockReturnValue(query([{ _id: moduleId, order: 1, title: 'Module' }]) as never);
    const lessonFind = vi.spyOn(LessonModel, 'find').mockReturnValue(
      query([
        {
          _id: lessonId,
          moduleId,
          order: 1,
          title: 'Lecon',
          description: '',
          textContent: 'Le texte de la lecon.',
          instructions: '',
        },
      ]) as never,
    );
    const resourceFind = vi.spyOn(TrainingResourceModel, 'find').mockReturnValue(
      query([
        {
          _id: '000000050000000000000001',
          lessonId,
          type: 'FILE',
          title: 'Guide PDF',
          file: {
            originalName: 'guide.pdf',
            relativePath: 'training-resources/qa/guide.pdf',
          },
        },
      ]) as never,
    );
    const resolve = vi.fn(() => '/qa/guide.pdf');
    const extract = vi.fn(async () => 'QA_PDF_ORION: preuve documentaire.');
    const service = new CourseTutorContextService(
      { resolve } as never,
      10_000,
      { extract } as never,
    );

    const context = await service.retrieve(
      { userId: 'learner', role: 'LEARNER', mustChangePassword: false },
      trainingId,
      { message: 'Quel est le mot Orion ?', mode: 'QUESTION', conversation: [] },
    );

    expect(moduleFind).toHaveBeenCalledWith({ trainingId, isArchived: false });
    expect(lessonFind).toHaveBeenCalledWith({ trainingId, isArchived: false });
    expect(resourceFind).toHaveBeenCalledWith({
      trainingId,
      isArchived: false,
      isVisibleToLearners: true,
    });
    expect(resolve).toHaveBeenCalledWith('training-resources/qa/guide.pdf');
    expect(extract).toHaveBeenCalledWith('/qa/guide.pdf', 'guide.pdf');
    expect(context.sources).toEqual([
      expect.objectContaining({
        lessonId,
        text: expect.stringContaining('QA_PDF_ORION'),
      }),
    ]);
    vi.restoreAllMocks();
  });
});
