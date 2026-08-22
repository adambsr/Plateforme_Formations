import { z } from 'zod';
import { EVALUATION_STATUSES, QUESTION_TYPES } from '../domain/evaluation.js';
export const evaluationIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const objectId = evaluationIdSchema;
export const evaluationListSchema = z
  .object({
    view: z.enum(['MANAGED', 'ACCESSIBLE']),
    trainingId: objectId.optional(),
    status: z.enum(EVALUATION_STATUSES).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const createEvaluationSchema = z
  .object({
    trainingId: objectId,
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().max(5_000).default(''),
    passPercentage: z.number().int().min(1).max(100),
    maxAttempts: z.number().int().positive().max(100).default(3),
    durationMinutes: z.number().int().positive().max(10_080).optional(),
  })
  .strict();
export const updateEvaluationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    instructions: z.string().trim().max(5_000).optional(),
    passPercentage: z.number().int().min(1).max(100).optional(),
    maxAttempts: z.number().int().positive().max(100).optional(),
    durationMinutes: z
      .number()
      .int()
      .positive()
      .max(10_080)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );
const answerOptionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[A-Za-z0-9_-]+$/),
    text: z.string().trim().min(1).max(1_000),
  })
  .strict();
const questionFields = {
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(1).max(5_000),
  options: z.array(answerOptionSchema).min(2).max(20),
  correctOptionIds: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  explanation: z.string().trim().max(5_000).optional(),
  points: z.number().int().positive().max(10_000),
};
function validateQuestion(
  question: z.infer<ReturnType<typeof z.object<typeof questionFields>>>,
  context: z.core.$RefinementCtx,
) {
  const optionIds = question.options.map(({ id }) => id);
  if (new Set(optionIds).size !== optionIds.length)
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Option identifiers must be unique.',
    });
  if (
    new Set(question.correctOptionIds).size !== question.correctOptionIds.length
  )
    context.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message: 'Correct answers must be unique.',
    });
  if (question.correctOptionIds.some((id) => !optionIds.includes(id)))
    context.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message: 'Every correct answer must reference an option.',
    });
  if (
    question.type === 'SINGLE_CHOICE' &&
    question.correctOptionIds.length !== 1
  )
    context.addIssue({
      code: 'custom',
      path: ['correctOptionIds'],
      message: 'Single choice requires exactly one correct answer.',
    });
  if (
    question.type === 'TRUE_FALSE' &&
    (optionIds.length !== 2 ||
      !optionIds.includes('TRUE') ||
      !optionIds.includes('FALSE') ||
      question.correctOptionIds.length !== 1)
  )
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message:
        'True/false questions require TRUE and FALSE options and one correct answer.',
    });
}
export const generatedQuestionSchema = z
  .object(questionFields)
  .strict()
  .superRefine(validateQuestion);
export const questionInputSchema = z
  .object({
    ...questionFields,
    order: z.number().int().positive().max(100_000),
  })
  .strict()
  .superRefine(validateQuestion);
export const updateQuestionSchema = z
  .object({
    ...questionFields,
    order: z.number().int().positive().max(100_000),
  })
  .partial()
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );
export const designationSchema = z
  .object({ evaluationId: objectId.nullable() })
  .strict();
export const startAttemptSchema = z.object({ enrollmentId: objectId }).strict();
export const saveAnswerSchema = z
  .object({
    questionId: objectId,
    selectedOptionIds: z.array(z.string().trim().min(1).max(60)).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.selectedOptionIds).size !== value.selectedOptionIds.length
    )
      context.addIssue({
        code: 'custom',
        path: ['selectedOptionIds'],
        message: 'Selected answers must be unique.',
      });
  });
export const generateQuestionsSchema = z
  .object({
    questionCount: z.number().int().min(1).max(20).default(5),
    questionTypes: z
      .array(z.enum(QUESTION_TYPES))
      .min(1)
      .max(3)
      .default([...QUESTION_TYPES]),
  })
  .strict();
export type EvaluationListInput = z.infer<typeof evaluationListSchema>;
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
