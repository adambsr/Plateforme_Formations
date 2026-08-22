import type { OpenAPIV3 } from 'openapi-types';

const json = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => ({
  'application/json': { schema },
});

const errorResponse: OpenAPIV3.ResponseObject = {
  description: 'The request failed.',
  content: json({ $ref: '#/components/schemas/ErrorResponse' }),
};

const secured = [{ bearerAuth: [] }];
const optionallySecured = [{}, ...secured];

const calendarRangeParameters: OpenAPIV3.ParameterObject[] = [
  {
    name: 'from',
    in: 'query',
    required: true,
    schema: { type: 'string', format: 'date' },
  },
  {
    name: 'to',
    in: 'query',
    required: true,
    schema: { type: 'string', format: 'date' },
  },
];

const dashboardOperation = (
  operationId: string,
  summary: string,
): OpenAPIV3.OperationObject => ({
  operationId,
  summary,
  description:
    'Admin-only aggregation over an inclusive Africa/Tunis calendar-date range.',
  tags: ['Dashboard'],
  security: secured,
  parameters: calendarRangeParameters,
  responses: {
    '200': {
      description: 'Server-computed dashboard aggregate.',
      content: json({ type: 'object', additionalProperties: true }),
    },
    default: errorResponse,
  },
});

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Plateforme de Formations API',
    version: '0.1.0',
    description: 'Shared REST API for the Web and Mobile clients.',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'Report service and database readiness',
        tags: ['System'],
        responses: {
          '200': {
            description: 'The service and database are ready.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '503': {
            description: 'A required dependency is unavailable.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        operationId: 'registerLearner',
        summary: 'Register a public Learner account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/RegisterRequest' }),
        },
        responses: {
          '201': {
            description: 'Learner registered.',
            content: json({ $ref: '#/components/schemas/AuthSession' }),
          },
          '409': errorResponse,
          '422': errorResponse,
          '429': errorResponse,
        },
      },
    },
    '/auth/login': {
      post: {
        operationId: 'login',
        summary: 'Authenticate with email and password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/LoginRequest' }),
        },
        responses: {
          '200': {
            description: 'Authenticated.',
            content: json({ $ref: '#/components/schemas/AuthSession' }),
          },
          '401': errorResponse,
          '422': errorResponse,
          '429': errorResponse,
        },
      },
    },
    '/auth/refresh': {
      post: {
        operationId: 'refreshSession',
        summary: 'Rotate a refresh token and issue a new access token',
        tags: ['Authentication'],
        requestBody: {
          content: json({ $ref: '#/components/schemas/RefreshRequest' }),
        },
        responses: {
          '200': {
            description: 'Session rotated.',
            content: json({ $ref: '#/components/schemas/AuthSession' }),
          },
          '401': errorResponse,
          '422': errorResponse,
          '429': errorResponse,
        },
      },
    },
    '/auth/logout': {
      post: {
        operationId: 'logout',
        summary: 'Revoke the current refresh session',
        tags: ['Authentication'],
        requestBody: {
          content: json({ $ref: '#/components/schemas/RefreshRequest' }),
        },
        responses: {
          '204': { description: 'Logged out.' },
          '422': errorResponse,
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        operationId: 'forgotPassword',
        summary: 'Request password-reset instructions',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ForgotPasswordRequest' }),
        },
        responses: {
          '202': { description: 'Request accepted.' },
          '422': errorResponse,
          '429': errorResponse,
        },
      },
    },
    '/auth/reset-password': {
      post: {
        operationId: 'resetPassword',
        summary: 'Reset a password with a single-use token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ResetPasswordRequest' }),
        },
        responses: {
          '204': { description: 'Password reset.' },
          '400': errorResponse,
          '422': errorResponse,
          '429': errorResponse,
        },
      },
    },
    '/auth/change-password': {
      post: {
        operationId: 'changePassword',
        summary: 'Change the authenticated user password',
        tags: ['Authentication'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ChangePasswordRequest' }),
        },
        responses: {
          '200': {
            description:
              'Password changed, prior refresh sessions revoked, and a new session issued.',
            content: json({ $ref: '#/components/schemas/AuthSession' }),
          },
          '400': errorResponse,
          '401': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/auth/me': {
      get: {
        operationId: 'getCurrentUser',
        summary: 'Return the current active user',
        tags: ['Authentication'],
        security: secured,
        responses: {
          '200': {
            description: 'Current user.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
        },
      },
      put: {
        operationId: 'updateCurrentUserProfile',
        summary: 'Update the current user common profile',
        tags: ['Authentication'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ProfileRequest' }),
        },
        responses: {
          '200': {
            description: 'Profile updated.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List users as an Admin',
        tags: ['Users'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated users.',
            content: json({ $ref: '#/components/schemas/PaginatedUsers' }),
          },
          '401': errorResponse,
          '403': errorResponse,
        },
      },
    },
    '/learners': {
      get: {
        operationId: 'listLearners',
        summary: 'List Learners as an Admin',
        tags: ['Users'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated Learners.',
            content: json({ $ref: '#/components/schemas/PaginatedUsers' }),
          },
          '401': errorResponse,
          '403': errorResponse,
        },
      },
    },
    '/learners/{id}': {
      get: {
        operationId: 'getLearner',
        summary: 'Get a Learner as an Admin',
        tags: ['Users'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/UserId' }],
        responses: {
          '200': {
            description: 'Learner.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/trainers': {
      get: {
        operationId: 'listTrainers',
        summary: 'List Trainers as an Admin',
        tags: ['Users'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated Trainers.',
            content: json({ $ref: '#/components/schemas/PaginatedUsers' }),
          },
          '401': errorResponse,
          '403': errorResponse,
        },
      },
      post: {
        operationId: 'createTrainer',
        summary: 'Create a Trainer as an Admin',
        tags: ['Users'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CreateTrainerRequest' }),
        },
        responses: {
          '201': {
            description: 'Trainer created.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '409': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/trainers/{id}': {
      get: {
        operationId: 'getTrainer',
        summary: 'Get an authorized Trainer profile',
        tags: ['Users'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/UserId' }],
        responses: {
          '200': {
            description: 'Trainer.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
        },
      },
      put: {
        operationId: 'updateTrainer',
        summary: 'Update a Trainer profile as Admin or self',
        tags: ['Users'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/UserId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ProfileRequest' }),
        },
        responses: {
          '200': {
            description: 'Trainer updated.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/trainers/{id}/disable': {
      post: {
        operationId: 'disableTrainer',
        summary: 'Deactivate a Trainer and revoke sessions as an Admin',
        tags: ['Users'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/UserId' }],
        responses: {
          '200': {
            description: 'Trainer deactivated.',
            content: json({ $ref: '#/components/schemas/User' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
        },
      },
    },
    '/categories': {
      get: {
        operationId: 'listTrainingCategories',
        summary: 'List active categories or all categories as an Admin',
        tags: ['Training catalogue'],
        security: optionallySecured,
        parameters: [
          {
            name: 'includeArchived',
            in: 'query',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          '200': {
            description: 'Training categories.',
            content: json({
              type: 'array',
              items: { $ref: '#/components/schemas/TrainingCategory' },
            }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '422': errorResponse,
        },
      },
      post: {
        operationId: 'createTrainingCategory',
        summary: 'Create a Training category as an Admin',
        tags: ['Training catalogue'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CategoryRequest' }),
        },
        responses: {
          '201': {
            description: 'Category created.',
            content: json({
              $ref: '#/components/schemas/TrainingCategory',
            }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '409': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/categories/{id}': {
      put: {
        operationId: 'updateTrainingCategory',
        summary: 'Update or archive a Training category as an Admin',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/CategoryId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/UpdateCategoryRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Category updated.',
            content: json({
              $ref: '#/components/schemas/TrainingCategory',
            }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/trainings': {
      get: {
        operationId: 'listTrainings',
        summary: 'List the public catalogue or authorized managed Trainings',
        tags: ['Training catalogue'],
        security: optionallySecured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          {
            name: 'type',
            in: 'query',
            schema: { $ref: '#/components/schemas/TrainingType' },
          },
          {
            name: 'view',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PUBLIC', 'MANAGED'],
              default: 'PUBLIC',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated Trainings.',
            content: json({
              $ref: '#/components/schemas/PaginatedTrainings',
            }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '422': errorResponse,
        },
      },
      post: {
        operationId: 'createTraining',
        summary: 'Create a draft Training as an Admin or Trainer',
        description:
          'A Trainer becomes owner automatically. An Admin must provide ownerTrainerId.',
        tags: ['Training catalogue'],
        security: secured,
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/CreateTrainingRequest',
          }),
        },
        responses: {
          '201': {
            description: 'Draft Training created.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/trainings/{id}': {
      get: {
        operationId: 'getTraining',
        summary: 'Get a published or authorized managed Training',
        tags: ['Training catalogue'],
        security: optionallySecured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        responses: {
          '200': {
            description: 'Training detail.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
        },
      },
      put: {
        operationId: 'updateTraining',
        summary: 'Update a Training as Admin or owner',
        description:
          'The immutable type, currency, status, and owner are excluded from this DTO.',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/UpdateTrainingRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Training updated.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
          '422': errorResponse,
        },
      },
      delete: {
        operationId: 'deleteTraining',
        summary: 'Delete an unused draft Training as Admin or owner',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        responses: {
          '204': { description: 'Unused draft deleted without cascading.' },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
        },
      },
    },
    '/trainings/{id}/publish': {
      post: {
        operationId: 'publishTraining',
        summary: 'Publish a draft Training as Admin or owner',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        responses: {
          '200': {
            description: 'Training published.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
        },
      },
    },
    '/trainings/{id}/archive': {
      post: {
        operationId: 'archiveTraining',
        summary: 'Archive a published Training as Admin or owner',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        responses: {
          '200': {
            description: 'Training archived without deleting history.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '409': errorResponse,
        },
      },
    },
    '/trainings/{id}/owner': {
      put: {
        operationId: 'transferTrainingOwnership',
        summary: 'Transfer Training ownership as an Admin',
        tags: ['Training catalogue'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/TransferTrainingOwnerRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Ownership transferred to an active Trainer.',
            content: json({ $ref: '#/components/schemas/Training' }),
          },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/trainings/{id}/content': {
      get: {
        operationId: 'getTrainingContent',
        summary: 'Read the authorized Module, Lesson, and Resource tree',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        responses: {
          '200': {
            description: 'Role-filtered content tree.',
            content: json({ $ref: '#/components/schemas/TrainingContent' }),
          },
          default: errorResponse,
        },
      },
    },
    '/trainings/{id}/modules': {
      post: {
        operationId: 'createTrainingModule',
        summary: 'Create an ordered Module as Admin or Training owner',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ContentItemRequest' }),
        },
        responses: {
          '201': {
            description: 'Module created.',
            content: json({ $ref: '#/components/schemas/ContentModule' }),
          },
          default: errorResponse,
        },
      },
    },
    '/modules/{id}': {
      put: {
        operationId: 'updateTrainingModule',
        summary: 'Update, archive, or restore a Module',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/UpdateContentItemRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Module updated.',
            content: json({ $ref: '#/components/schemas/ContentModule' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteTrainingModule',
        summary: 'Delete a Module tree only when no progress references it',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Unused Module tree deleted.' },
          default: errorResponse,
        },
      },
    },
    '/modules/{id}/lessons': {
      post: {
        operationId: 'createLesson',
        summary: 'Create an ordered Lesson in an active Module',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/LessonRequest' }),
        },
        responses: {
          '201': {
            description: 'Lesson created.',
            content: json({ $ref: '#/components/schemas/ContentLesson' }),
          },
          default: errorResponse,
        },
      },
    },
    '/lessons/{id}': {
      put: {
        operationId: 'updateLesson',
        summary: 'Update, archive, or restore a Lesson',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/UpdateLessonRequest' }),
        },
        responses: {
          '200': {
            description: 'Lesson updated.',
            content: json({ $ref: '#/components/schemas/ContentLesson' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteLesson',
        summary: 'Delete a Lesson only when no progress references it',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Unused Lesson deleted.' },
          default: errorResponse,
        },
      },
    },
    '/lessons/{id}/resources': {
      post: {
        operationId: 'createResource',
        summary: 'Create a protected file or HTTP(S) Resource',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { $ref: '#/components/schemas/CreateResourceRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Resource created after file validation.',
            content: json({ $ref: '#/components/schemas/ContentResource' }),
          },
          default: errorResponse,
        },
      },
    },
    '/resources/{id}': {
      put: {
        operationId: 'updateResource',
        summary: 'Update, archive, or restore a Resource',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/UpdateResourceRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Resource updated.',
            content: json({ $ref: '#/components/schemas/ContentResource' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteResource',
        summary: 'Delete an unreferenced Resource and unshared local file',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Unused Resource deleted.' },
          default: errorResponse,
        },
      },
    },
    '/resources/{id}/download': {
      get: {
        operationId: 'downloadResource',
        summary: 'Stream a protected file after content authorization',
        tags: ['Content'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Protected binary download.',
            headers: {
              'Content-Disposition': {
                schema: { type: 'string' },
                description: 'Safe attachment filename with UTF-8 support.',
              },
            },
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          default: errorResponse,
        },
      },
    },
    '/sessions': {
      get: {
        operationId: 'listSessions',
        summary:
          'List public available, role-managed, or Learner-enrolled in-person Sessions',
        tags: ['Sessions'],
        security: optionallySecured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          {
            name: 'view',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PUBLIC', 'MANAGED', 'ENROLLED'],
            },
          },
          {
            name: 'trainingId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          {
            name: 'status',
            in: 'query',
            schema: { $ref: '#/components/schemas/SessionStatus' },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated Sessions.',
            content: json({ $ref: '#/components/schemas/PaginatedSessions' }),
          },
          default: errorResponse,
        },
      },
      post: {
        operationId: 'createSession',
        summary: 'Create a planned in-person Session as Admin or owner',
        tags: ['Sessions'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CreateSessionRequest' }),
        },
        responses: {
          '201': {
            description: 'Session created.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
    },
    '/session-trainers': {
      get: {
        operationId: 'listSessionTrainers',
        summary: 'List active Trainers assignable to Sessions',
        tags: ['Sessions'],
        security: secured,
        responses: {
          '200': {
            description: 'Minimal active Trainer directory.',
            content: json({
              type: 'array',
              items: { $ref: '#/components/schemas/SessionTrainer' },
            }),
          },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}': {
      get: {
        operationId: 'getSession',
        summary: 'Get a public or role-authorized Session and all dates',
        tags: ['Sessions'],
        security: optionallySecured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Session detail.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
      put: {
        operationId: 'updateSession',
        summary: 'Update planned Session structure as Admin or owner',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/UpdateSessionRequest' }),
        },
        responses: {
          '200': {
            description: 'Session updated.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteSession',
        summary: 'Delete a Session only when no Enrollment or Payment exists',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Unused Session and its schedules deleted.' },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/trainers': {
      put: {
        operationId: 'assignSessionTrainers',
        summary: 'Assign active Trainers to a planned Session',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            additionalProperties: false,
            required: ['assignedTrainerIds'],
            properties: {
              assignedTrainerIds: {
                type: 'array',
                minItems: 1,
                items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
              },
            },
          }),
        },
        responses: {
          '200': {
            description: 'Trainer assignment updated.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/schedules': {
      post: {
        operationId: 'createSessionSchedule',
        summary:
          'Add a UTC Session date after Trainer and room conflict checks',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ScheduleRequest' }),
        },
        responses: {
          '201': {
            description: 'Session date created.',
            content: json({ $ref: '#/components/schemas/SessionSchedule' }),
          },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/start': {
      post: {
        operationId: 'startSession',
        summary: 'Start a planned Session as Admin, owner, or assigned Trainer',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Session started.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/complete': {
      post: {
        operationId: 'completeSession',
        summary: 'Complete a Session after full Attendance coverage',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Session completed.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/cancel': {
      post: {
        operationId: 'cancelSession',
        summary: 'Cancel a Session only when it has no Enrollment',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Session cancelled.',
            content: json({ $ref: '#/components/schemas/TrainingSession' }),
          },
          default: errorResponse,
        },
      },
    },
    '/schedules/{id}': {
      put: {
        operationId: 'updateSessionSchedule',
        summary: 'Update a planned Session date and recheck conflicts',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/UpdateScheduleRequest' }),
        },
        responses: {
          '200': {
            description: 'Session date updated.',
            content: json({ $ref: '#/components/schemas/SessionSchedule' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteSessionSchedule',
        summary: 'Delete a schedule only when no Attendance references it',
        tags: ['Sessions'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Unused Session date deleted.' },
          default: errorResponse,
        },
      },
    },
    '/sessions/{id}/attendance': {
      get: {
        operationId: 'getSessionAttendance',
        summary:
          'Get the Session roster as Admin/assigned Trainer or own schedule as enrolled Learner',
        tags: ['Attendance'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description:
              'Per-schedule Attendance, missing-entry coverage, percentage, and threshold result.',
            content: json({ $ref: '#/components/schemas/SessionAttendance' }),
          },
          default: errorResponse,
        },
      },
    },
    '/schedules/{id}/attendance': {
      put: {
        operationId: 'recordScheduleAttendance',
        summary:
          'Bulk upsert PRESENT/ABSENT values as Admin or assigned Trainer',
        description:
          'Allowed only while the Session is PLANNED or IN_PROGRESS. Completion makes every Attendance record immutable.',
        tags: ['Attendance'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/BulkAttendanceRequest',
          }),
        },
        responses: {
          '200': {
            description:
              'Attendance sheet updated without treating omissions as ABSENT.',
            content: json({ $ref: '#/components/schemas/SessionAttendance' }),
          },
          default: errorResponse,
        },
      },
    },
    '/payments/checkout': {
      post: {
        operationId: 'createStripeCheckout',
        summary: 'Create a Stripe test hosted Checkout from the server price',
        description:
          'Learner only. Creates a PENDING Payment, never an Enrollment. The webhook is the payment source of truth.',
        tags: ['Payments'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CheckoutRequest' }),
        },
        responses: {
          '201': {
            description: 'Pending Payment and Stripe-hosted redirect URL.',
            content: json({ $ref: '#/components/schemas/CheckoutResponse' }),
          },
          default: errorResponse,
        },
      },
    },
    '/payments': {
      get: {
        operationId: 'listPayments',
        summary: 'List all Payments as Admin or own Payments as Learner',
        tags: ['Payments'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          {
            name: 'status',
            in: 'query',
            schema: { $ref: '#/components/schemas/PaymentStatus' },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated technical Payment history.',
            content: json({ $ref: '#/components/schemas/PaginatedPayments' }),
          },
          default: errorResponse,
        },
      },
    },
    '/payments/{id}': {
      get: {
        operationId: 'getPayment',
        summary: 'Get an Admin-visible or learner-owned Payment',
        tags: ['Payments'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Payment state confirmed by backend data.',
            content: json({ $ref: '#/components/schemas/Payment' }),
          },
          default: errorResponse,
        },
      },
    },
    '/payments/webhook/stripe': {
      post: {
        operationId: 'receiveStripeWebhook',
        summary: 'Verify and idempotently fulfill a Stripe event',
        description:
          'Requires the Stripe-Signature header and an unmodified raw JSON body. Successful fulfillment atomically creates one Enrollment, Invoice, and InvoiceItem.',
        tags: ['Payments'],
        parameters: [
          {
            name: 'Stripe-Signature',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
            },
          },
        },
        responses: {
          '200': {
            description: 'Verified event accepted, including repeat delivery.',
            content: json({
              type: 'object',
              required: ['received'],
              properties: { received: { type: 'boolean', enum: [true] } },
            }),
          },
          '400': errorResponse,
        },
      },
    },
    '/enrollments': {
      get: {
        operationId: 'listEnrollments',
        summary:
          'List all webhook-created Enrollments as Admin or own as Learner',
        tags: ['Enrollments'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          {
            name: 'trainingId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          {
            name: 'sessionId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated permanent paid Enrollments.',
            content: json({
              $ref: '#/components/schemas/PaginatedEnrollments',
            }),
          },
          default: errorResponse,
        },
      },
    },
    '/enrollments/{id}': {
      get: {
        operationId: 'getEnrollment',
        summary: 'Get an Admin-visible or learner-owned Enrollment',
        tags: ['Enrollments'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Permanent Enrollment without payment-state fields.',
            content: json({ $ref: '#/components/schemas/Enrollment' }),
          },
          default: errorResponse,
        },
      },
    },
    '/progress': {
      get: {
        operationId: 'listLearnerProgress',
        summary: 'List server-calculated self-paced progress for the Learner',
        tags: ['Progress'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          {
            name: 'trainingId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          '200': {
            description:
              'Active applicable Lessons, calculated percentage, completion, and Certificate lock state.',
            content: json({ $ref: '#/components/schemas/PaginatedProgress' }),
          },
          default: errorResponse,
        },
      },
    },
    '/progress/lessons/{lessonId}': {
      put: {
        operationId: 'updateLessonProgress',
        summary: 'Mark or unmark one applicable Lesson as the enrolled Learner',
        description:
          'The server resolves the paid self-paced Enrollment and rejects changes after Certificate issuance.',
        tags: ['Progress'],
        security: secured,
        parameters: [
          {
            name: 'lessonId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/UpdateLessonProgressRequest',
          }),
        },
        responses: {
          '200': {
            description: 'Recalculated Training progress.',
            content: json({ $ref: '#/components/schemas/ProgressSummary' }),
          },
          default: errorResponse,
        },
      },
    },
    '/invoices': {
      get: {
        operationId: 'listInvoices',
        summary: 'List all immutable Invoices as Admin or own as Learner',
        tags: ['Invoices'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated Invoices.',
            content: json({ $ref: '#/components/schemas/PaginatedInvoices' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations': {
      get: {
        operationId: 'listEvaluations',
        summary: 'List managed or accessible Evaluations',
        tags: ['Evaluations'],
        security: secured,
        parameters: [
          {
            name: 'view',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['MANAGED', 'ACCESSIBLE'] },
          },
          { name: 'trainingId', in: 'query', schema: { type: 'string' } },
          {
            name: 'status',
            in: 'query',
            schema: { $ref: '#/components/schemas/EvaluationStatus' },
          },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated Evaluations.',
            content: json({
              $ref: '#/components/schemas/PaginatedEvaluations',
            }),
          },
          default: errorResponse,
        },
      },
      post: {
        operationId: 'createEvaluation',
        summary: 'Create a draft Evaluation as Training owner',
        tags: ['Evaluations'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/EvaluationWrite' }),
        },
        responses: {
          '201': {
            description: 'Draft Evaluation.',
            content: json({ $ref: '#/components/schemas/Evaluation' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}': {
      get: {
        operationId: 'getEvaluation',
        summary:
          'Get an authorized Evaluation and role-safe questions/attempts',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Evaluation detail.',
            content: json({ $ref: '#/components/schemas/Evaluation' }),
          },
          default: errorResponse,
        },
      },
      put: {
        operationId: 'updateEvaluation',
        summary: 'Update an owned draft Evaluation',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/EvaluationUpdate' }),
        },
        responses: {
          '200': {
            description: 'Updated Evaluation.',
            content: json({ $ref: '#/components/schemas/Evaluation' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteEvaluation',
        summary: 'Delete an owned draft Evaluation',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Draft deleted.' },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/publish': {
      post: {
        operationId: 'publishEvaluation',
        summary: 'Validate and publish an owned draft Evaluation',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Published Evaluation.',
            content: json({ $ref: '#/components/schemas/Evaluation' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/archive': {
      post: {
        operationId: 'archiveEvaluation',
        summary: 'Archive a non-certifying published Evaluation',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Archived Evaluation.',
            content: json({ $ref: '#/components/schemas/Evaluation' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/questions': {
      post: {
        operationId: 'createEvaluationQuestion',
        summary: 'Add a validated question to an owned draft',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/EvaluationQuestionWrite',
          }),
        },
        responses: {
          '201': {
            description: 'Question created.',
            content: json({ $ref: '#/components/schemas/EvaluationQuestion' }),
          },
          default: errorResponse,
        },
      },
    },
    '/questions/{id}': {
      put: {
        operationId: 'updateEvaluationQuestion',
        summary: 'Update a question in an owned draft',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/EvaluationQuestionUpdate',
          }),
        },
        responses: {
          '200': {
            description: 'Question updated.',
            content: json({ $ref: '#/components/schemas/EvaluationQuestion' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteEvaluationQuestion',
        summary: 'Delete a question from an owned draft',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Question deleted.' },
          default: errorResponse,
        },
      },
    },
    '/trainings/{id}/certifying-evaluation': {
      put: {
        operationId: 'setCertifyingEvaluation',
        summary: 'Set or remove the owned Training certifying Evaluation',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/TrainingId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/CertifyingEvaluationWrite',
          }),
        },
        responses: {
          '200': {
            description: 'Designation updated.',
            content: json({ type: 'object' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/attempts': {
      post: {
        operationId: 'startEvaluationAttempt',
        summary: 'Start or resume a server-timestamped Learner Attempt',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/StartAttemptWrite' }),
        },
        responses: {
          '201': {
            description: 'Attempt with answer-safe question snapshots.',
            content: json({ $ref: '#/components/schemas/EvaluationAttempt' }),
          },
          default: errorResponse,
        },
      },
    },
    '/attempts/{id}': {
      get: {
        operationId: 'getEvaluationAttempt',
        summary: 'Get an own Attempt and enforce expiry',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Own Attempt.',
            content: json({ $ref: '#/components/schemas/EvaluationAttempt' }),
          },
          default: errorResponse,
        },
      },
    },
    '/attempts/{id}/answers': {
      put: {
        operationId: 'saveEvaluationAnswer',
        summary: 'Save an answer while the Attempt remains active',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/SaveAnswerWrite' }),
        },
        responses: {
          '200': {
            description: 'Updated Attempt.',
            content: json({ $ref: '#/components/schemas/EvaluationAttempt' }),
          },
          default: errorResponse,
        },
      },
    },
    '/attempts/{id}/submit': {
      post: {
        operationId: 'submitEvaluationAttempt',
        summary: 'Grade and finalize an own Attempt',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Final graded Attempt with conditional answer reveal.',
            content: json({ $ref: '#/components/schemas/EvaluationAttempt' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/results': {
      get: {
        operationId: 'getEvaluationResults',
        summary: 'Get owner/Admin submitted result summaries',
        tags: ['Evaluations'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Evaluation results.',
            content: json({ $ref: '#/components/schemas/EvaluationResults' }),
          },
          default: errorResponse,
        },
      },
    },
    '/evaluations/{id}/generate-ai': {
      post: {
        operationId: 'generateEvaluationQuestions',
        summary:
          'Generate validated draft questions from bounded selected-Training context',
        description:
          'Owner only. Supports text PDF, DOCX, PPTX, and TXT extraction; never publishes.',
        tags: ['Evaluations', 'AI'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/GenerateQuestionsWrite',
          }),
        },
        responses: {
          '201': {
            description: 'Draft import and explicit extraction report.',
            content: json({ $ref: '#/components/schemas/AiGenerationResult' }),
          },
          default: errorResponse,
        },
      },
    },
    '/invoices/{id}': {
      get: {
        operationId: 'getInvoice',
        summary: 'Get an immutable Invoice snapshot',
        tags: ['Invoices'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Invoice and its single purchase line.',
            content: json({ $ref: '#/components/schemas/Invoice' }),
          },
          default: errorResponse,
        },
      },
    },
    '/invoices/{id}/pdf': {
      get: {
        operationId: 'downloadInvoicePdf',
        summary: 'Materialize and stream an authorized Invoice PDF',
        tags: ['Invoices'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Protected Invoice PDF generated from snapshots.',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          default: errorResponse,
        },
      },
    },
    '/certificates': {
      get: {
        operationId: 'listCertificates',
        summary: 'List role-authorized immutable Certificates',
        tags: ['Certificates'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description:
              'Own, owned-Training, assigned-Session, or all Certificates.',
            content: json({
              $ref: '#/components/schemas/PaginatedCertificates',
            }),
          },
          default: errorResponse,
        },
      },
    },
    '/certificates/generate': {
      post: {
        operationId: 'generateCertificate',
        summary: 'Recalculate eligibility and idempotently issue a Certificate',
        description:
          'No role, including Admin, can override Training completion or a required certifying Evaluation.',
        tags: ['Certificates'],
        security: secured,
        requestBody: {
          required: true,
          content: json({
            $ref: '#/components/schemas/GenerateCertificateWrite',
          }),
        },
        responses: {
          '200': {
            description:
              'Newly issued or existing Certificate with immutable snapshots.',
            content: json({ $ref: '#/components/schemas/Certificate' }),
          },
          default: errorResponse,
        },
      },
    },
    '/certificates/{id}': {
      get: {
        operationId: 'getCertificate',
        summary: 'Get a role-authorized Certificate snapshot',
        tags: ['Certificates'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Immutable Certificate business record.',
            content: json({ $ref: '#/components/schemas/Certificate' }),
          },
          default: errorResponse,
        },
      },
    },
    '/certificates/{id}/pdf': {
      get: {
        operationId: 'downloadCertificatePdf',
        summary: 'Materialize or stream a protected Certificate PDF',
        tags: ['Certificates'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '200': {
            description: 'Protected PDF generated from immutable snapshots.',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          default: errorResponse,
        },
      },
    },
    '/feedback': {
      post: {
        operationId: 'createFeedback',
        summary: 'Create one immutable eligible Learner rating',
        tags: ['Feedback'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/FeedbackWrite' }),
        },
        responses: {
          '201': {
            description: 'Immutable 1-to-5 Feedback.',
            content: json({ $ref: '#/components/schemas/Feedback' }),
          },
          default: errorResponse,
        },
      },
      get: {
        operationId: 'getFeedbackStatistics',
        summary:
          'Get Admin-only global and per-Training satisfaction statistics',
        tags: ['Feedback'],
        security: secured,
        responses: {
          '200': {
            description: 'Count, average, and 1-to-5 distribution.',
            content: json({
              $ref: '#/components/schemas/FeedbackStatistics',
            }),
          },
          default: errorResponse,
        },
      },
    },
    '/costs/trainers': {
      get: {
        operationId: 'listTrainerCosts',
        summary: 'List explicitly entered monthly Trainer costs',
        tags: ['Costs'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': {
            description: 'Paginated monthly costs.',
            content: json({ $ref: '#/components/schemas/PaginationEnvelope' }),
          },
          default: errorResponse,
        },
      },
    },
    '/costs/trainers/{trainerId}/{year}/{month}': {
      put: {
        operationId: 'upsertTrainerCost',
        summary: 'Create or replace one Trainer calendar-month cost',
        tags: ['Costs'],
        security: secured,
        parameters: [
          {
            name: 'trainerId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'year',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 2000, maximum: 2100 },
          },
          {
            name: 'month',
            in: 'path',
            required: true,
            schema: { type: 'integer', minimum: 1, maximum: 12 },
          },
        ],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/TrainerCostWrite' }),
        },
        responses: {
          '200': {
            description: 'Monthly cost upserted.',
            content: json({ type: 'object' }),
          },
          default: errorResponse,
        },
      },
    },
    '/costs/trainings': {
      get: {
        operationId: 'listTrainingCosts',
        summary: 'List explicit Training costs',
        tags: ['Costs'],
        security: secured,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
          ...calendarRangeParameters.map((value) => ({
            ...value,
            required: false,
          })),
        ],
        responses: {
          '200': {
            description: 'Paginated explicit costs.',
            content: json({ $ref: '#/components/schemas/PaginationEnvelope' }),
          },
          default: errorResponse,
        },
      },
      post: {
        operationId: 'createTrainingCost',
        summary: 'Create an explicit Training cost',
        tags: ['Costs'],
        security: secured,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/TrainingCostWrite' }),
        },
        responses: {
          '201': {
            description: 'Training cost created.',
            content: json({ type: 'object' }),
          },
          default: errorResponse,
        },
      },
    },
    '/costs/trainings/{id}': {
      put: {
        operationId: 'updateTrainingCost',
        summary: 'Update an explicit Training cost',
        tags: ['Costs'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/TrainingCostUpdate' }),
        },
        responses: {
          '200': {
            description: 'Training cost updated.',
            content: json({ type: 'object' }),
          },
          default: errorResponse,
        },
      },
      delete: {
        operationId: 'deleteTrainingCost',
        summary: 'Delete an explicit Training cost',
        tags: ['Costs'],
        security: secured,
        parameters: [{ $ref: '#/components/parameters/EntityId' }],
        responses: {
          '204': { description: 'Training cost deleted.' },
          default: errorResponse,
        },
      },
    },
    '/dashboard/overview': {
      get: dashboardOperation('getDashboardOverview', 'Get operational counts'),
    },
    '/dashboard/participation': {
      get: dashboardOperation(
        'getDashboardParticipation',
        'Get schedule-based participation',
      ),
    },
    '/dashboard/progress': {
      get: dashboardOperation(
        'getDashboardProgress',
        'Get self-paced progress and Evaluation results',
      ),
    },
    '/dashboard/satisfaction': {
      get: dashboardOperation(
        'getDashboardSatisfaction',
        'Get global and per-Training satisfaction',
      ),
    },
    '/dashboard/financial': {
      get: dashboardOperation(
        'getDashboardFinancial',
        'Get paid revenue and explicit costs',
      ),
    },
    '/dashboard/profitability': {
      get: dashboardOperation(
        'getDashboardProfitability',
        'Get global profitability and pre-fixed-cost Training results',
      ),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      PageSize: {
        name: 'pageSize',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      UserId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      },
      CategoryId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      },
      TrainingId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      },
      EntityId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
      },
    },
    schemas: {
      TrainerCostWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['amountMinor'],
        properties: {
          amountMinor: {
            type: 'integer',
            minimum: 1,
            description: 'TND millimes; integer only.',
          },
          note: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
      TrainingCostWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['trainingId', 'date', 'amountMinor', 'label'],
        properties: {
          trainingId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          sessionId: {
            type: 'string',
            nullable: true,
            pattern: '^[a-fA-F0-9]{24}$',
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Africa/Tunis calendar date.',
          },
          amountMinor: {
            type: 'integer',
            minimum: 1,
            description: 'TND millimes; integer only.',
          },
          label: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
      TrainingCostUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          trainingId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          sessionId: {
            type: 'string',
            nullable: true,
            pattern: '^[a-fA-F0-9]{24}$',
          },
          date: { type: 'string', format: 'date' },
          amountMinor: { type: 'integer', minimum: 1 },
          label: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
      EvaluationStatus: {
        type: 'string',
        enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      },
      QuestionType: {
        type: 'string',
        enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'],
      },
      EvaluationOption: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' },
          text: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
      EvaluationQuestionWrite: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'prompt',
          'options',
          'correctOptionIds',
          'points',
          'order',
        ],
        properties: {
          type: { $ref: '#/components/schemas/QuestionType' },
          prompt: { type: 'string', minLength: 1, maxLength: 5000 },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 20,
            items: { $ref: '#/components/schemas/EvaluationOption' },
          },
          correctOptionIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          explanation: { type: 'string', maxLength: 5000 },
          points: { type: 'integer', minimum: 1 },
          order: { type: 'integer', minimum: 1 },
        },
      },
      EvaluationQuestionUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          type: { $ref: '#/components/schemas/QuestionType' },
          prompt: { type: 'string', minLength: 1, maxLength: 5000 },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 20,
            items: { $ref: '#/components/schemas/EvaluationOption' },
          },
          correctOptionIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          explanation: { type: 'string', maxLength: 5000, nullable: true },
          points: { type: 'integer', minimum: 1 },
          order: { type: 'integer', minimum: 1 },
        },
      },
      EvaluationQuestion: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'prompt', 'options', 'points', 'order'],
        properties: {
          id: { type: 'string' },
          type: { $ref: '#/components/schemas/QuestionType' },
          prompt: { type: 'string' },
          options: {
            type: 'array',
            items: { $ref: '#/components/schemas/EvaluationOption' },
          },
          correctOptionIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Returned only when answer release is allowed for the requester.',
          },
          explanation: {
            type: 'string',
            description:
              'Returned only when answer release is allowed for the requester.',
          },
          points: { type: 'integer' },
          order: { type: 'integer' },
        },
      },
      EvaluationWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['trainingId', 'title', 'passPercentage'],
        properties: {
          trainingId: { type: 'string' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          instructions: { type: 'string', maxLength: 5000 },
          passPercentage: { type: 'integer', minimum: 1, maximum: 100 },
          maxAttempts: { type: 'integer', minimum: 1, default: 3 },
          durationMinutes: { type: 'integer', minimum: 1 },
        },
      },
      EvaluationUpdate: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          instructions: { type: 'string', maxLength: 5000 },
          passPercentage: { type: 'integer', minimum: 1, maximum: 100 },
          maxAttempts: { type: 'integer', minimum: 1 },
          durationMinutes: { type: 'integer', minimum: 1, nullable: true },
        },
      },
      Evaluation: {
        type: 'object',
        required: [
          'id',
          'training',
          'title',
          'status',
          'passPercentage',
          'maxAttempts',
          'questionCount',
          'isCertifying',
        ],
        properties: {
          id: { type: 'string' },
          training: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          title: { type: 'string' },
          instructions: { type: 'string' },
          status: { $ref: '#/components/schemas/EvaluationStatus' },
          passPercentage: { type: 'integer' },
          maxAttempts: { type: 'integer' },
          durationMinutes: { type: 'integer' },
          questionCount: { type: 'integer' },
          isCertifying: { type: 'boolean' },
          questions: {
            type: 'array',
            items: { $ref: '#/components/schemas/EvaluationQuestion' },
          },
          attempts: {
            type: 'array',
            items: { $ref: '#/components/schemas/EvaluationAttempt' },
          },
        },
      },
      PaginatedEvaluations: {
        type: 'object',
        required: ['items', 'page', 'pageSize', 'total'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Evaluation' },
          },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      CertifyingEvaluationWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['evaluationId'],
        properties: { evaluationId: { type: 'string', nullable: true } },
      },
      StartAttemptWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['enrollmentId'],
        properties: { enrollmentId: { type: 'string' } },
      },
      SaveAnswerWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['questionId', 'selectedOptionIds'],
        properties: {
          questionId: { type: 'string' },
          selectedOptionIds: {
            type: 'array',
            uniqueItems: true,
            items: { type: 'string' },
          },
        },
      },
      GenerateQuestionsWrite: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionCount: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            default: 5,
          },
          questionTypes: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: { $ref: '#/components/schemas/QuestionType' },
          },
        },
      },
      EvaluationAttempt: {
        type: 'object',
        required: [
          'id',
          'evaluationId',
          'enrollmentId',
          'attemptNumber',
          'status',
          'startedAt',
          'answersRevealed',
          'answers',
        ],
        properties: {
          id: { type: 'string' },
          evaluationId: { type: 'string' },
          enrollmentId: { type: 'string' },
          attemptNumber: { type: 'integer' },
          status: { type: 'string', enum: ['IN_PROGRESS', 'PASSED', 'FAILED'] },
          startedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          remainingSeconds: { type: 'integer' },
          submittedAt: { type: 'string', format: 'date-time' },
          scorePoints: { type: 'number' },
          totalPoints: { type: 'number' },
          scorePercentage: { type: 'number' },
          answersRevealed: { type: 'boolean' },
          answers: { type: 'array', items: { type: 'object' } },
        },
      },
      EvaluationResults: {
        type: 'object',
        required: ['evaluationId', 'totalAttempts', 'passedAttempts', 'items'],
        properties: {
          evaluationId: { type: 'string' },
          totalAttempts: { type: 'integer' },
          passedAttempts: { type: 'integer' },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      AiGenerationResult: {
        type: 'object',
        required: ['evaluation', 'extraction'],
        properties: {
          evaluation: { $ref: '#/components/schemas/Evaluation' },
          extraction: {
            type: 'object',
            required: [
              'contextChars',
              'extractedResources',
              'skippedResources',
            ],
            properties: {
              contextChars: { type: 'integer' },
              extractedResources: { type: 'array', items: { type: 'object' } },
              skippedResources: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    reason: {
                      type: 'string',
                      enum: ['UNSUPPORTED', 'NO_TEXT', 'EXTRACTION_FAILED'],
                    },
                  },
                },
              },
            },
          },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'service', 'version', 'timestamp', 'checks'],
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          service: { type: 'string' },
          version: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            required: ['database'],
            properties: { database: { type: 'string', enum: ['up', 'down'] } },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error', 'requestId'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              fieldErrors: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['field', 'message'],
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          requestId: { type: 'string' },
        },
      },
      Profile: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
      ProfileRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['firstName', 'lastName'],
        properties: {
          firstName: { type: 'string', minLength: 1, maxLength: 100 },
          lastName: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      User: {
        type: 'object',
        required: [
          'id',
          'email',
          'role',
          'isActive',
          'mustChangePassword',
          'profile',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'TRAINER', 'LEARNER'] },
          isActive: { type: 'boolean' },
          mustChangePassword: { type: 'boolean' },
          profile: { $ref: '#/components/schemas/Profile' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ClientType: { type: 'string', enum: ['WEB', 'MOBILE'], default: 'WEB' },
      RegisterRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            writeOnly: true,
          },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          client: { $ref: '#/components/schemas/ClientType' },
        },
      },
      LoginRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', writeOnly: true },
          client: { $ref: '#/components/schemas/ClientType' },
        },
      },
      RefreshRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          client: { $ref: '#/components/schemas/ClientType' },
          refreshToken: {
            type: 'string',
            writeOnly: true,
            description: 'Required for Mobile; Web uses the HttpOnly cookie.',
          },
        },
      },
      ForgotPasswordRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      ResetPasswordRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', writeOnly: true },
          newPassword: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            writeOnly: true,
          },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', writeOnly: true },
          newPassword: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            writeOnly: true,
          },
          client: { $ref: '#/components/schemas/ClientType' },
        },
      },
      CreateTrainerRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'temporaryPassword', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          temporaryPassword: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            writeOnly: true,
          },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
      AuthSession: {
        type: 'object',
        required: ['accessToken', 'user'],
        properties: {
          accessToken: { type: 'string', writeOnly: true },
          refreshToken: {
            type: 'string',
            writeOnly: true,
            description: 'Returned only to Mobile clients.',
          },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      PaginatedUsers: {
        type: 'object',
        required: ['items', 'page', 'pageSize', 'total'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
          },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      TrainingCategory: {
        type: 'object',
        required: ['id', 'name', 'isArchived', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          isArchived: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CategoryRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          description: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
      UpdateCategoryRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          description: {
            type: 'string',
            minLength: 1,
            maxLength: 1000,
            nullable: true,
            description: 'Use null to remove the existing description.',
          },
          isArchived: { type: 'boolean' },
        },
      },
      TrainingType: {
        type: 'string',
        enum: ['SELF_PACED_ONLINE', 'IN_PERSON'],
      },
      TrainingStatus: {
        type: 'string',
        enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      },
      TrainingOwner: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
      Training: {
        type: 'object',
        required: [
          'id',
          'title',
          'description',
          'category',
          'level',
          'durationMinutes',
          'objectives',
          'prerequisites',
          'type',
          'priceMinor',
          'currency',
          'ownerTrainer',
          'status',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: {
            type: 'object',
            required: ['id', 'name', 'isArchived'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              isArchived: { type: 'boolean' },
            },
          },
          level: { type: 'string' },
          durationMinutes: { type: 'integer', minimum: 1 },
          objectives: { type: 'array', items: { type: 'string' } },
          prerequisites: { type: 'array', items: { type: 'string' } },
          type: { $ref: '#/components/schemas/TrainingType' },
          priceMinor: {
            type: 'integer',
            minimum: 1,
            description: 'Authoritative TND amount in 0.01 TND minor units.',
          },
          currency: { type: 'string', enum: ['TND'] },
          ownerTrainer: { $ref: '#/components/schemas/TrainingOwner' },
          status: { $ref: '#/components/schemas/TrainingStatus' },
          minimumAttendancePercent: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Present only for IN_PERSON Trainings.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateTrainingRequest: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'description',
          'categoryId',
          'level',
          'durationMinutes',
          'type',
          'priceMinor',
        ],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', minLength: 1, maxLength: 5000 },
          categoryId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          level: { type: 'string', minLength: 1, maxLength: 100 },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            maximum: 52560000,
          },
          objectives: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', minLength: 1, maxLength: 500 },
          },
          prerequisites: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', minLength: 1, maxLength: 500 },
          },
          type: { $ref: '#/components/schemas/TrainingType' },
          priceMinor: { type: 'integer', minimum: 1 },
          ownerTrainerId: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$',
            description: 'Required when an Admin creates a Training.',
          },
          minimumAttendancePercent: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Allowed only for IN_PERSON; defaults to 80.',
          },
        },
      },
      UpdateTrainingRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        description:
          'Training type, currency, lifecycle status, and owner cannot be changed here.',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', minLength: 1, maxLength: 5000 },
          categoryId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          level: { type: 'string', minLength: 1, maxLength: 100 },
          durationMinutes: {
            type: 'integer',
            minimum: 1,
            maximum: 52560000,
          },
          objectives: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', minLength: 1, maxLength: 500 },
          },
          prerequisites: {
            type: 'array',
            maxItems: 30,
            items: { type: 'string', minLength: 1, maxLength: 500 },
          },
          priceMinor: { type: 'integer', minimum: 1 },
          minimumAttendancePercent: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
        },
      },
      TransferTrainingOwnerRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['ownerTrainerId'],
        properties: {
          ownerTrainerId: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$',
          },
        },
      },
      PaginatedTrainings: {
        type: 'object',
        required: ['items', 'page', 'pageSize', 'total'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Training' },
          },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      ContentResource: {
        type: 'object',
        required: [
          'id',
          'title',
          'description',
          'order',
          'type',
          'isVisibleToLearners',
          'isArchived',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          type: { type: 'string', enum: ['FILE', 'EXTERNAL_URL'] },
          isVisibleToLearners: { type: 'boolean' },
          externalUrl: { type: 'string', format: 'uri' },
          file: {
            type: 'object',
            required: [
              'originalName',
              'mimeType',
              'sizeBytes',
              'checksumSha256',
              'uploadedById',
              'uploadedAt',
              'downloadUrl',
            ],
            properties: {
              originalName: { type: 'string' },
              mimeType: { type: 'string' },
              sizeBytes: { type: 'integer' },
              checksumSha256: { type: 'string' },
              uploadedById: { type: 'string' },
              uploadedAt: { type: 'string', format: 'date-time' },
              downloadUrl: { type: 'string' },
            },
          },
          isArchived: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ContentLesson: {
        type: 'object',
        required: [
          'id',
          'title',
          'description',
          'textContent',
          'instructions',
          'order',
          'isArchived',
          'resources',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          textContent: { type: 'string' },
          instructions: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          isArchived: { type: 'boolean' },
          resources: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContentResource' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ContentModule: {
        type: 'object',
        required: [
          'id',
          'title',
          'description',
          'order',
          'isArchived',
          'lessons',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          isArchived: { type: 'boolean' },
          lessons: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContentLesson' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TrainingContent: {
        type: 'object',
        required: ['trainingId', 'access', 'modules'],
        properties: {
          trainingId: { type: 'string' },
          access: {
            type: 'string',
            enum: ['MANAGE', 'STAFF_READ', 'LEARNER_READ'],
          },
          modules: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContentModule' },
          },
        },
      },
      ContentItemRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'order'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          order: { type: 'integer', minimum: 1 },
        },
      },
      UpdateContentItemRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          order: { type: 'integer', minimum: 1 },
          isArchived: { type: 'boolean' },
        },
      },
      LessonRequest: {
        allOf: [
          { $ref: '#/components/schemas/ContentItemRequest' },
          {
            type: 'object',
            properties: {
              textContent: { type: 'string', maxLength: 100000 },
              instructions: { type: 'string', maxLength: 10000 },
            },
          },
        ],
      },
      UpdateLessonRequest: {
        allOf: [
          { $ref: '#/components/schemas/UpdateContentItemRequest' },
          {
            type: 'object',
            properties: {
              textContent: { type: 'string', maxLength: 100000 },
              instructions: { type: 'string', maxLength: 10000 },
            },
          },
        ],
      },
      CreateResourceRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'order', 'type', 'isVisibleToLearners'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          order: { type: 'integer', minimum: 1 },
          type: { type: 'string', enum: ['FILE', 'EXTERNAL_URL'] },
          isVisibleToLearners: { type: 'boolean' },
          externalUrl: { type: 'string', format: 'uri' },
          file: { type: 'string', format: 'binary' },
        },
      },
      UpdateResourceRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          order: { type: 'integer', minimum: 1 },
          isVisibleToLearners: { type: 'boolean' },
          externalUrl: { type: 'string', format: 'uri' },
          isArchived: { type: 'boolean' },
        },
      },
      SessionStatus: {
        type: 'string',
        enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      },
      SessionTrainer: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
      SessionSchedule: {
        type: 'object',
        required: [
          'id',
          'startAt',
          'endAt',
          'trainers',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          startAt: {
            type: 'string',
            format: 'date-time',
            description: 'UTC ISO 8601 instant.',
          },
          endAt: {
            type: 'string',
            format: 'date-time',
            description: 'UTC ISO 8601 instant.',
          },
          moduleId: { type: 'string' },
          lessonId: { type: 'string' },
          trainers: {
            type: 'array',
            items: { $ref: '#/components/schemas/SessionTrainer' },
          },
          location: { type: 'string' },
          address: { type: 'string' },
          room: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TrainingSession: {
        type: 'object',
        required: [
          'id',
          'training',
          'title',
          'capacity',
          'enrolledCount',
          'availableSeats',
          'assignedTrainers',
          'location',
          'address',
          'additionalInformation',
          'status',
          'schedules',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          training: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          title: { type: 'string' },
          identifier: { type: 'string' },
          capacity: { type: 'integer', minimum: 1 },
          enrolledCount: { type: 'integer', minimum: 0 },
          availableSeats: { type: 'integer', minimum: 0 },
          assignedTrainers: {
            type: 'array',
            items: { $ref: '#/components/schemas/SessionTrainer' },
          },
          location: { type: 'string' },
          address: { type: 'string' },
          room: { type: 'string' },
          additionalInformation: { type: 'string' },
          status: { $ref: '#/components/schemas/SessionStatus' },
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          schedules: {
            type: 'array',
            items: { $ref: '#/components/schemas/SessionSchedule' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateSessionRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['trainingId', 'title', 'capacity', 'location'],
        properties: {
          trainingId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          identifier: { type: 'string', minLength: 1, maxLength: 100 },
          capacity: { type: 'integer', minimum: 1 },
          assignedTrainerIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          location: { type: 'string', minLength: 1, maxLength: 200 },
          address: { type: 'string', maxLength: 500 },
          room: { type: 'string', minLength: 1, maxLength: 100 },
          additionalInformation: { type: 'string', maxLength: 2000 },
        },
      },
      UpdateSessionRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          identifier: { type: 'string', nullable: true },
          capacity: { type: 'integer', minimum: 1 },
          location: { type: 'string', minLength: 1, maxLength: 200 },
          address: { type: 'string', maxLength: 500 },
          room: { type: 'string', nullable: true },
          additionalInformation: { type: 'string', maxLength: 2000 },
        },
      },
      ScheduleRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['startAt', 'endAt', 'trainerIds'],
        properties: {
          startAt: {
            type: 'string',
            format: 'date-time',
            description: 'Must include Z or an explicit UTC offset.',
          },
          endAt: {
            type: 'string',
            format: 'date-time',
            description: 'Must include Z or an explicit UTC offset.',
          },
          moduleId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          lessonId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          trainerIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          location: { type: 'string' },
          address: { type: 'string' },
          room: { type: 'string' },
        },
      },
      UpdateScheduleRequest: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        description:
          'Every field is optional; null removes an optional association or override.',
        properties: {
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
          moduleId: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$',
            nullable: true,
          },
          lessonId: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$',
            nullable: true,
          },
          trainerIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          location: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true },
          room: { type: 'string', nullable: true },
        },
      },
      PaginatedSessions: {
        type: 'object',
        required: ['items', 'page', 'pageSize', 'total'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/TrainingSession' },
          },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      AttendanceStatus: {
        type: 'string',
        enum: ['PRESENT', 'ABSENT'],
      },
      BulkAttendanceRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['entries'],
        properties: {
          entries: {
            type: 'array',
            minItems: 1,
            maxItems: 1000,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['enrollmentId', 'status'],
              properties: {
                enrollmentId: {
                  type: 'string',
                  pattern: '^[a-fA-F0-9]{24}$',
                },
                status: { $ref: '#/components/schemas/AttendanceStatus' },
              },
            },
          },
        },
      },
      AttendanceRecord: {
        type: 'object',
        required: ['scheduleId', 'status'],
        properties: {
          scheduleId: { type: 'string' },
          status: {
            allOf: [{ $ref: '#/components/schemas/AttendanceStatus' }],
            nullable: true,
            description:
              'Null means not recorded; it must not be interpreted as ABSENT.',
          },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AttendanceRosterEntry: {
        type: 'object',
        required: [
          'enrollmentId',
          'learner',
          'presentCount',
          'recordedCount',
          'totalScheduleCount',
          'attendancePercentage',
          'attendanceCoverageComplete',
          'meetsAttendanceThreshold',
          'isComplete',
          'records',
        ],
        properties: {
          enrollmentId: { type: 'string' },
          learner: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
          presentCount: { type: 'integer', minimum: 0 },
          recordedCount: { type: 'integer', minimum: 0 },
          totalScheduleCount: { type: 'integer', minimum: 0 },
          attendancePercentage: { type: 'number', minimum: 0, maximum: 100 },
          attendanceCoverageComplete: { type: 'boolean' },
          meetsAttendanceThreshold: { type: 'boolean' },
          isComplete: { type: 'boolean' },
          records: {
            type: 'array',
            items: { $ref: '#/components/schemas/AttendanceRecord' },
          },
        },
      },
      SessionAttendance: {
        type: 'object',
        required: [
          'session',
          'minimumAttendancePercent',
          'immutable',
          'canRecord',
          'schedules',
          'roster',
        ],
        properties: {
          session: {
            type: 'object',
            required: ['id', 'title', 'status', 'training'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { $ref: '#/components/schemas/SessionStatus' },
              training: {
                type: 'object',
                required: ['id', 'title'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
          minimumAttendancePercent: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
          },
          immutable: { type: 'boolean' },
          canRecord: { type: 'boolean' },
          schedules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'startAt', 'endAt', 'location'],
              properties: {
                id: { type: 'string' },
                startAt: { type: 'string', format: 'date-time' },
                endAt: { type: 'string', format: 'date-time' },
                location: { type: 'string' },
                room: { type: 'string' },
              },
            },
          },
          roster: {
            type: 'array',
            items: { $ref: '#/components/schemas/AttendanceRosterEntry' },
          },
        },
      },
      UpdateLessonProgressRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['completed'],
        properties: { completed: { type: 'boolean' } },
      },
      LessonCompletion: {
        type: 'object',
        required: [
          'lessonId',
          'moduleId',
          'moduleTitle',
          'moduleOrder',
          'title',
          'order',
          'completed',
        ],
        properties: {
          lessonId: { type: 'string' },
          moduleId: { type: 'string' },
          moduleTitle: { type: 'string' },
          moduleOrder: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          completed: { type: 'boolean' },
          completedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProgressSummary: {
        type: 'object',
        required: [
          'enrollmentId',
          'training',
          'completedLessonCount',
          'totalLessonCount',
          'percentage',
          'isComplete',
          'lockedByCertificate',
          'lessons',
        ],
        properties: {
          enrollmentId: { type: 'string' },
          training: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          completedLessonCount: { type: 'integer', minimum: 0 },
          totalLessonCount: { type: 'integer', minimum: 0 },
          percentage: { type: 'number', minimum: 0, maximum: 100 },
          isComplete: { type: 'boolean' },
          lockedByCertificate: { type: 'boolean' },
          lessons: {
            type: 'array',
            items: { $ref: '#/components/schemas/LessonCompletion' },
          },
        },
      },
      PaginatedProgress: {
        allOf: [
          { $ref: '#/components/schemas/PaginationEnvelope' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/ProgressSummary' },
              },
            },
          },
        ],
      },
      PaymentStatus: {
        type: 'string',
        enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
      },
      CheckoutRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['trainingId'],
        properties: {
          trainingId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          sessionId: {
            type: 'string',
            pattern: '^[a-fA-F0-9]{24}$',
            description: 'Required only for an IN_PERSON purchase.',
          },
        },
      },
      Payment: {
        type: 'object',
        required: [
          'id',
          'training',
          'purchaseType',
          'status',
          'amountMinor',
          'currency',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          training: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          session: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          purchaseType: { $ref: '#/components/schemas/TrainingType' },
          status: { $ref: '#/components/schemas/PaymentStatus' },
          amountMinor: { type: 'integer', minimum: 1 },
          currency: { type: 'string', enum: ['TND'] },
          failure: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          enrollmentId: { type: 'string' },
          invoiceId: { type: 'string' },
          paidAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CheckoutResponse: {
        type: 'object',
        required: ['payment', 'checkoutUrl'],
        properties: {
          payment: { $ref: '#/components/schemas/Payment' },
          checkoutUrl: {
            type: 'string',
            format: 'uri',
            description: 'Stripe-hosted test Checkout URL.',
          },
        },
      },
      Enrollment: {
        type: 'object',
        description:
          'Permanent paid access record. It deliberately has no status or payment-state field.',
        required: ['id', 'learner', 'training', 'payment', 'createdAt'],
        properties: {
          id: { type: 'string' },
          learner: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
              id: { type: 'string' },
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
          training: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          session: {
            type: 'object',
            required: ['id', 'title'],
            properties: { id: { type: 'string' }, title: { type: 'string' } },
          },
          payment: {
            type: 'object',
            required: ['id', 'amountMinor', 'currency'],
            properties: {
              id: { type: 'string' },
              amountMinor: { type: 'integer', minimum: 1 },
              currency: { type: 'string', enum: ['TND'] },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      InvoiceItem: {
        type: 'object',
        required: [
          'id',
          'description',
          'quantity',
          'unitAmountMinor',
          'totalMinor',
          'currency',
        ],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          quantity: { type: 'integer', enum: [1] },
          unitAmountMinor: { type: 'integer', minimum: 1 },
          totalMinor: { type: 'integer', minimum: 1 },
          currency: { type: 'string', enum: ['TND'] },
        },
      },
      Invoice: {
        type: 'object',
        required: [
          'id',
          'paymentId',
          'enrollmentId',
          'number',
          'issuedAt',
          'learner',
          'issuer',
          'purchaseDescription',
          'subtotalMinor',
          'totalMinor',
          'currency',
          'item',
          'pdfDownloadUrl',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string' },
          paymentId: { type: 'string' },
          enrollmentId: { type: 'string' },
          number: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
          learner: {
            type: 'object',
            required: ['email', 'firstName', 'lastName'],
            properties: {
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
          issuer: {
            type: 'object',
            required: ['name', 'address', 'email'],
            properties: {
              name: { type: 'string' },
              address: { type: 'string' },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' },
              registrationId: { type: 'string' },
            },
          },
          purchaseDescription: { type: 'string' },
          subtotalMinor: { type: 'integer', minimum: 1 },
          totalMinor: { type: 'integer', minimum: 1 },
          currency: { type: 'string', enum: ['TND'] },
          item: { $ref: '#/components/schemas/InvoiceItem' },
          pdfDownloadUrl: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      GenerateCertificateWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['enrollmentId'],
        properties: { enrollmentId: { type: 'string' } },
      },
      Certificate: {
        type: 'object',
        required: [
          'id',
          'enrollmentId',
          'learnerId',
          'trainingId',
          'number',
          'issuedAt',
          'learner',
          'training',
          'eligibility',
          'issuer',
          'pdfDownloadUrl',
          'createdAt',
        ],
        properties: {
          id: { type: 'string' },
          enrollmentId: { type: 'string' },
          learnerId: { type: 'string' },
          trainingId: { type: 'string' },
          sessionId: { type: 'string' },
          number: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
          learner: {
            type: 'object',
            required: ['email', 'firstName', 'lastName'],
            properties: {
              email: { type: 'string', format: 'email' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
          training: {
            type: 'object',
            required: ['title', 'type', 'durationMinutes', 'enrolledAt'],
            properties: {
              title: { type: 'string' },
              type: {
                type: 'string',
                enum: ['SELF_PACED_ONLINE', 'IN_PERSON'],
              },
              durationMinutes: { type: 'integer', minimum: 1 },
              enrolledAt: { type: 'string', format: 'date-time' },
              sessionTitle: { type: 'string' },
              startsAt: { type: 'string', format: 'date-time' },
              endsAt: { type: 'string', format: 'date-time' },
            },
          },
          eligibility: {
            type: 'object',
            required: ['completionPercentage', 'completedAt'],
            properties: {
              completionPercentage: {
                type: 'number',
                minimum: 0,
                maximum: 100,
              },
              completedAt: { type: 'string', format: 'date-time' },
              certifyingEvaluationId: { type: 'string' },
              passedAttemptId: { type: 'string' },
              passedAt: { type: 'string', format: 'date-time' },
            },
          },
          issuer: {
            type: 'object',
            required: ['name', 'address', 'email'],
            properties: {
              name: { type: 'string' },
              address: { type: 'string' },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' },
              registrationId: { type: 'string' },
            },
          },
          pdfDownloadUrl: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      FeedbackWrite: {
        type: 'object',
        additionalProperties: false,
        required: ['enrollmentId', 'rating'],
        properties: {
          enrollmentId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
      Feedback: {
        type: 'object',
        required: ['id', 'enrollmentId', 'trainingId', 'rating', 'createdAt'],
        properties: {
          id: { type: 'string' },
          enrollmentId: { type: 'string' },
          trainingId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      FeedbackSummary: {
        type: 'object',
        required: ['count', 'average', 'distribution'],
        properties: {
          count: { type: 'integer', minimum: 0 },
          average: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            nullable: true,
          },
          distribution: {
            type: 'object',
            required: ['1', '2', '3', '4', '5'],
            properties: {
              '1': { type: 'integer', minimum: 0 },
              '2': { type: 'integer', minimum: 0 },
              '3': { type: 'integer', minimum: 0 },
              '4': { type: 'integer', minimum: 0 },
              '5': { type: 'integer', minimum: 0 },
            },
          },
        },
      },
      FeedbackStatistics: {
        type: 'object',
        required: ['global', 'byTraining'],
        properties: {
          global: { $ref: '#/components/schemas/FeedbackSummary' },
          byTraining: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/FeedbackSummary' },
                {
                  type: 'object',
                  required: ['training'],
                  properties: {
                    training: {
                      type: 'object',
                      required: ['id', 'title'],
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      PaginatedPayments: {
        allOf: [
          { $ref: '#/components/schemas/PaginationEnvelope' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Payment' },
              },
            },
          },
        ],
      },
      PaginatedEnrollments: {
        allOf: [
          { $ref: '#/components/schemas/PaginationEnvelope' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Enrollment' },
              },
            },
          },
        ],
      },
      PaginatedInvoices: {
        allOf: [
          { $ref: '#/components/schemas/PaginationEnvelope' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
        ],
      },
      PaginatedCertificates: {
        allOf: [
          { $ref: '#/components/schemas/PaginationEnvelope' },
          {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: { $ref: '#/components/schemas/Certificate' },
              },
            },
          },
        ],
      },
      PaginationEnvelope: {
        type: 'object',
        required: ['items', 'page', 'pageSize', 'total'],
        properties: {
          items: { type: 'array', items: {} },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
    },
  },
  tags: [
    { name: 'System' },
    { name: 'Authentication' },
    { name: 'Users' },
    { name: 'Training catalogue' },
    { name: 'Content' },
    { name: 'Sessions' },
    { name: 'Payments' },
    { name: 'Enrollments' },
    { name: 'Invoices' },
    { name: 'Progress' },
    { name: 'Attendance' },
    { name: 'Evaluations' },
    { name: 'AI' },
    { name: 'Certificates' },
    { name: 'Feedback' },
    { name: 'Costs' },
    { name: 'Dashboard' },
  ],
};
