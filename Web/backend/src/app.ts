import cors from 'cors';
import express, { type Express } from 'express';
import type { Logger } from 'pino';
import swaggerUi from 'swagger-ui-express';

import type { AppConfig } from './config/environment.js';
import {
  errorHandler,
  notFoundHandler,
} from './infrastructure/http/error-middleware.js';
import { requestLogging } from './infrastructure/http/request-logging.js';
import { openApiDocument } from './infrastructure/openapi/document.js';
import { createPasswordResetMailService } from './infrastructure/mail/password-reset-mail.js';
import type { PasswordResetMailService } from './infrastructure/mail/password-reset-mail.js';
import { createAuthRouter } from './modules/auth/routes/auth.routes.js';
import { AuthService } from './modules/auth/services/auth.service.js';
import { TokenService } from './modules/auth/services/token.service.js';
import { createUserRouter } from './modules/users/routes/user.routes.js';
import { UserService } from './modules/users/services/user.service.js';
import { createTrainingRouter } from './modules/trainings/routes/training.routes.js';
import { TrainingService } from './modules/trainings/services/training.service.js';
import { LocalFileStorage } from './infrastructure/files/local-file-storage.js';
import { createContentRouter } from './modules/content/routes/content.routes.js';
import { ContentService } from './modules/content/services/content.service.js';
import { createSessionRouter } from './modules/sessions/routes/session.routes.js';
import { SessionService } from './modules/sessions/services/session.service.js';
import {
  StripeSdkCheckoutGateway,
  type StripeCheckoutGateway,
} from './infrastructure/stripe/stripe-checkout-gateway.js';
import { PaymentService } from './modules/payments/services/payment.service.js';
import {
  createPaymentRouter,
  createStripeWebhookHandler,
  stripeWebhookMiddleware,
} from './modules/payments/routes/payment.routes.js';
import { EnrollmentAccessService } from './modules/enrollments/services/enrollment-access.service.js';
import { EnrollmentService } from './modules/enrollments/services/enrollment.service.js';
import { createEnrollmentRouter } from './modules/enrollments/routes/enrollment.routes.js';
import { ProtectedDocumentStorage } from './infrastructure/files/protected-document-storage.js';
import { InvoiceService } from './modules/invoices/services/invoice.service.js';
import { createInvoiceRouter } from './modules/invoices/routes/invoice.routes.js';
import { CompletionService } from './modules/completion/services/completion.service.js';
import { ProgressService } from './modules/progress/services/progress.service.js';
import { createProgressRouter } from './modules/progress/routes/progress.routes.js';
import { AttendanceService } from './modules/attendance/services/attendance.service.js';
import { createAttendanceRouter } from './modules/attendance/routes/attendance.routes.js';
import { createEvaluationRouter } from './modules/evaluations/routes/evaluation.routes.js';
import { EvaluationService } from './modules/evaluations/services/evaluation.service.js';
import { TrainingAiContextService } from './modules/evaluations/services/training-ai-context.service.js';
import { AiEvaluationService } from './modules/evaluations/services/ai-evaluation.service.js';
import {
  GeminiQuestionGenerationGateway,
  type QuestionGenerationGateway,
} from './modules/evaluations/infrastructure/gemini-question-generation.gateway.js';
import { EligibilityService } from './modules/completion/services/eligibility.service.js';
import { CertificateService } from './modules/certificates/services/certificate.service.js';
import { createCertificateRouter } from './modules/certificates/routes/certificate.routes.js';
import { FeedbackService } from './modules/feedback/services/feedback.service.js';
import { createFeedbackRouter } from './modules/feedback/routes/feedback.routes.js';
import { CostService } from './modules/costs/services/cost.service.js';
import { createCostRouter } from './modules/costs/routes/cost.routes.js';
import { DashboardService } from './modules/dashboard/services/dashboard.service.js';
import { createDashboardRouter } from './modules/dashboard/routes/dashboard.routes.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  databaseReady: () => boolean;
  passwordResetMailService?: PasswordResetMailService;
  stripeCheckoutGateway?: StripeCheckoutGateway;
  questionGenerationGateway?: QuestionGenerationGateway;
}

export function createApp({
  config,
  logger,
  databaseReady,
  passwordResetMailService,
  stripeCheckoutGateway,
  questionGenerationGateway,
}: AppDependencies): Express {
  const app = express();

  const tokenService = new TokenService(config.authentication);
  const userService = new UserService();
  const trainingService = new TrainingService();
  const fileStorage = new LocalFileStorage(
    config.uploads.directory,
    config.uploads.maxSizeMb,
  );
  const enrollmentAccess = new EnrollmentAccessService();
  const contentService = new ContentService(fileStorage, enrollmentAccess);
  const sessionService = new SessionService();
  const paymentService = new PaymentService(
    stripeCheckoutGateway ?? new StripeSdkCheckoutGateway(config.stripe),
    config.center,
  );
  const enrollmentService = new EnrollmentService();
  const invoiceService = new InvoiceService(
    new ProtectedDocumentStorage(config.uploads.directory),
  );
  const completionService = new CompletionService();
  const eligibilityService = new EligibilityService(completionService);
  const progressService = new ProgressService(completionService);
  const attendanceService = new AttendanceService();
  const evaluationService = new EvaluationService();
  const aiEvaluationService = new AiEvaluationService(
    evaluationService,
    new TrainingAiContextService(fileStorage, config.ai.maxContextChars),
    questionGenerationGateway ?? new GeminiQuestionGenerationGateway(config.ai),
  );
  const certificateService = new CertificateService(
    eligibilityService,
    new ProtectedDocumentStorage(config.uploads.directory),
    config.center,
  );
  const feedbackService = new FeedbackService(eligibilityService);
  const costService = new CostService();
  const dashboardService = new DashboardService();
  const authService = new AuthService(
    config,
    tokenService,
    passwordResetMailService ?? createPasswordResetMailService(config),
  );

  app.disable('x-powered-by');
  app.use(requestLogging(logger));
  app.use(cors({ origin: config.application.corsOrigins, credentials: true }));
  app.post(
    '/api/payments/webhook/stripe',
    stripeWebhookMiddleware(),
    createStripeWebhookHandler(paymentService),
  );
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    const ready = databaseReady();
    response.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      service: 'plateforme-formations-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      checks: { database: ready ? 'up' : 'down' },
    });
  });
  app.get('/api/openapi.json', (_request, response) =>
    response.json(openApiDocument),
  );
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    '/api/auth',
    createAuthRouter(config, authService, userService, tokenService),
  );
  app.use('/api', createUserRouter(userService, tokenService));
  app.use('/api', createTrainingRouter(trainingService, tokenService));
  app.use(
    '/api',
    createContentRouter(
      contentService,
      tokenService,
      fileStorage.maximumBytes,
      enrollmentAccess,
    ),
  );
  app.use('/api', createSessionRouter(sessionService, tokenService));
  app.use('/api', createPaymentRouter(paymentService, tokenService));
  app.use('/api', createEnrollmentRouter(enrollmentService, tokenService));
  app.use('/api', createInvoiceRouter(invoiceService, tokenService));
  app.use('/api', createProgressRouter(progressService, tokenService));
  app.use('/api', createAttendanceRouter(attendanceService, tokenService));
  app.use(
    '/api',
    createEvaluationRouter(
      evaluationService,
      tokenService,
      aiEvaluationService,
    ),
  );
  app.use('/api', createCertificateRouter(certificateService, tokenService));
  app.use('/api', createFeedbackRouter(feedbackService, tokenService));
  app.use('/api', createCostRouter(costService, tokenService));
  app.use('/api', createDashboardRouter(dashboardService, tokenService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
