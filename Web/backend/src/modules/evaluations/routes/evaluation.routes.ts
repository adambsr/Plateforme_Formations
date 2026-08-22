import { Router } from 'express';
import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  createEvaluationSchema,
  designationSchema,
  evaluationIdSchema,
  evaluationListSchema,
  generateQuestionsSchema,
  questionInputSchema,
  saveAnswerSchema,
  startAttemptSchema,
  updateEvaluationSchema,
  updateQuestionSchema,
} from '../dto/evaluation.dto.js';
import type { AiEvaluationService } from '../services/ai-evaluation.service.js';
import type { EvaluationService } from '../services/evaluation.service.js';

export function createEvaluationRouter(
  service: EvaluationService,
  tokenService: TokenService,
  aiService?: AiEvaluationService,
): Router {
  const router = Router();
  const auth = [authenticate(tokenService), requirePasswordChanged] as const;
  router.get('/evaluations', ...auth, async (req, res) =>
    res.json(
      await service.list(
        authenticatedPrincipal(req),
        evaluationListSchema.parse(req.query),
      ),
    ),
  );
  router.get('/evaluations/:id', ...auth, async (req, res) =>
    res.json(
      await service.detail(
        authenticatedPrincipal(req),
        evaluationIdSchema.parse(req.params.id),
      ),
    ),
  );
  router.post(
    '/evaluations',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) =>
      res
        .status(201)
        .json(
          await service.create(
            authenticatedPrincipal(req),
            createEvaluationSchema.parse(req.body),
          ),
        ),
  );
  router.put(
    '/evaluations/:id',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) =>
      res.json(
        await service.update(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
          updateEvaluationSchema.parse(req.body),
        ),
      ),
  );
  router.delete(
    '/evaluations/:id',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) => {
      await service.remove(
        authenticatedPrincipal(req),
        evaluationIdSchema.parse(req.params.id),
      );
      res.status(204).send();
    },
  );
  router.post(
    '/evaluations/:id/publish',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) =>
      res.json(
        await service.publish(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
        ),
      ),
  );
  router.post(
    '/evaluations/:id/archive',
    ...auth,
    requireRoles('ADMIN', 'TRAINER'),
    async (req, res) =>
      res.json(
        await service.archive(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
        ),
      ),
  );
  router.post(
    '/evaluations/:id/questions',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) =>
      res
        .status(201)
        .json(
          await service.addQuestion(
            authenticatedPrincipal(req),
            evaluationIdSchema.parse(req.params.id),
            questionInputSchema.parse(req.body),
          ),
        ),
  );
  router.put(
    '/questions/:id',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) =>
      res.json(
        await service.updateQuestion(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
          updateQuestionSchema.parse(req.body),
        ),
      ),
  );
  router.delete(
    '/questions/:id',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) => {
      await service.removeQuestion(
        authenticatedPrincipal(req),
        evaluationIdSchema.parse(req.params.id),
      );
      res.status(204).send();
    },
  );
  router.put(
    '/trainings/:id/certifying-evaluation',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) => {
      const input = designationSchema.parse(req.body);
      res.json(
        await service.designate(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
          input.evaluationId,
        ),
      );
    },
  );
  router.post(
    '/evaluations/:id/attempts',
    ...auth,
    requireRoles('LEARNER'),
    async (req, res) => {
      const input = startAttemptSchema.parse(req.body);
      res
        .status(201)
        .json(
          await service.startAttempt(
            authenticatedPrincipal(req),
            evaluationIdSchema.parse(req.params.id),
            input.enrollmentId,
          ),
        );
    },
  );
  router.get(
    '/attempts/:id',
    ...auth,
    requireRoles('LEARNER'),
    async (req, res) =>
      res.json(
        await service.getAttempt(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
        ),
      ),
  );
  router.put(
    '/attempts/:id/answers',
    ...auth,
    requireRoles('LEARNER'),
    async (req, res) =>
      res.json(
        await service.saveAnswer(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
          saveAnswerSchema.parse(req.body),
        ),
      ),
  );
  router.post(
    '/attempts/:id/submit',
    ...auth,
    requireRoles('LEARNER'),
    async (req, res) =>
      res.json(
        await service.submit(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
        ),
      ),
  );
  router.get(
    '/evaluations/:id/results',
    ...auth,
    requireRoles('ADMIN', 'TRAINER'),
    async (req, res) =>
      res.json(
        await service.results(
          authenticatedPrincipal(req),
          evaluationIdSchema.parse(req.params.id),
        ),
      ),
  );
  router.post(
    '/evaluations/:id/generate-ai',
    ...auth,
    requireRoles('TRAINER'),
    async (req, res) => {
      if (aiService === undefined)
        throw new Error('AI Evaluation service is not configured.');
      res
        .status(201)
        .json(
          await aiService.generate(
            authenticatedPrincipal(req),
            evaluationIdSchema.parse(req.params.id),
            generateQuestionsSchema.parse(req.body),
          ),
        );
    },
  );
  return router;
}
