import { z } from 'zod';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const positiveInteger = z.coerce.number().int().positive();

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    MONGODB_URI: z.string().trim().min(1),
    WEB_APP_URL: z.url(),
    MOBILE_APP_SCHEME: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9+.-]*$/i)
      .default('plateforme-formations'),
    CORS_ORIGINS: z
      .string()
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
    TZ: z.literal('UTC').default('UTC'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_MINUTES: positiveInteger.default(15),
    REFRESH_TOKEN_TTL_DAYS: positiveInteger.default(7),
    PASSWORD_RESET_TTL_MINUTES: positiveInteger.default(30),

    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true'),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM: z.string().trim().min(1),

    STRIPE_SECRET_KEY: z.string().startsWith('sk_test_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    STRIPE_SUCCESS_URL: z.url(),
    STRIPE_CANCEL_URL: z.url(),

    UPLOAD_DIR: z.string().trim().min(1),
    MAX_UPLOAD_SIZE_MB: positiveInteger.default(20),

    AI_API_KEY: z.string().trim().min(1),
    AI_MODEL: z.string().trim().min(1),
    AI_BASE_URL: optionalText.pipe(z.url().optional()),
    AI_MAX_CONTEXT_CHARS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(1_000_000)
      .default(100_000),

    CENTER_NAME: z.string().trim().min(1),
    CENTER_ADDRESS: z.string().trim().min(1),
    CENTER_EMAIL: z.email(),
    CENTER_PHONE: optionalText,
    CENTER_REGISTRATION_ID: optionalText,
    CENTER_LOGO_PATH: optionalText,
  })
  .superRefine((environment, context) => {
    const hasSmtpUser = environment.SMTP_USER !== undefined;
    const hasSmtpPassword = environment.SMTP_PASSWORD !== undefined;

    if (hasSmtpUser !== hasSmtpPassword) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message:
          'SMTP_USER and SMTP_PASSWORD must either both be set or both be empty',
      });
    }
  });

const initialAdminSchema = z.object({
  INITIAL_ADMIN_EMAIL: z.email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(12),
});

const adminSeedSchema = initialAdminSchema.extend({
  MONGODB_URI: z.string().trim().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export interface AppConfig {
  application: {
    nodeEnv: 'development' | 'test' | 'production';
    port: number;
    webAppUrl: string;
    mobileAppScheme: string;
    corsOrigins: string[];
    timezone: 'UTC';
    logLevel:
      'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  };
  database: { uri: string };
  authentication: {
    jwtAccessSecret: string;
    jwtAccessTtlMinutes: number;
    refreshTokenTtlDays: number;
    passwordResetTtlMinutes: number;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string | undefined;
    password: string | undefined;
    from: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    successUrl: string;
    cancelUrl: string;
  };
  uploads: { directory: string; maxSizeMb: number };
  ai: {
    apiKey: string;
    model: string;
    baseUrl: string | undefined;
    maxContextChars: number;
  };
  center: {
    name: string;
    address: string;
    email: string;
    phone: string | undefined;
    registrationId: string | undefined;
    logoPath: string | undefined;
  };
}

export interface InitialAdminConfig {
  email: string;
  password: string;
}

export interface AdminSeedConfig {
  databaseUri: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  initialAdmin: InitialAdminConfig;
}

export class ConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`,
    );
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

function parseEnvironment<T>(
  schema: z.ZodType<T>,
  environment: NodeJS.ProcessEnv,
): T {
  const result = schema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || 'environment';
      return `${path}: ${issue.message}`;
    });
    throw new ConfigurationError(issues);
  }

  return result.data;
}

export function loadAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const value = parseEnvironment(environmentSchema, environment);

  return {
    application: {
      nodeEnv: value.NODE_ENV,
      port: value.PORT,
      webAppUrl: value.WEB_APP_URL,
      mobileAppScheme: value.MOBILE_APP_SCHEME,
      corsOrigins: value.CORS_ORIGINS,
      timezone: value.TZ,
      logLevel: value.LOG_LEVEL,
    },
    database: { uri: value.MONGODB_URI },
    authentication: {
      jwtAccessSecret: value.JWT_ACCESS_SECRET,
      jwtAccessTtlMinutes: value.JWT_ACCESS_TTL_MINUTES,
      refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
      passwordResetTtlMinutes: value.PASSWORD_RESET_TTL_MINUTES,
    },
    smtp: {
      host: value.SMTP_HOST,
      port: value.SMTP_PORT,
      secure: value.SMTP_SECURE,
      user: value.SMTP_USER,
      password: value.SMTP_PASSWORD,
      from: value.SMTP_FROM,
    },
    stripe: {
      secretKey: value.STRIPE_SECRET_KEY,
      webhookSecret: value.STRIPE_WEBHOOK_SECRET,
      successUrl: value.STRIPE_SUCCESS_URL,
      cancelUrl: value.STRIPE_CANCEL_URL,
    },
    uploads: {
      directory: value.UPLOAD_DIR,
      maxSizeMb: value.MAX_UPLOAD_SIZE_MB,
    },
    ai: {
      apiKey: value.AI_API_KEY,
      model: value.AI_MODEL,
      baseUrl: value.AI_BASE_URL,
      maxContextChars: value.AI_MAX_CONTEXT_CHARS,
    },
    center: {
      name: value.CENTER_NAME,
      address: value.CENTER_ADDRESS,
      email: value.CENTER_EMAIL,
      phone: value.CENTER_PHONE,
      registrationId: value.CENTER_REGISTRATION_ID,
      logoPath: value.CENTER_LOGO_PATH,
    },
  };
}

export function loadInitialAdminConfig(
  environment: NodeJS.ProcessEnv = process.env,
): InitialAdminConfig {
  const value = parseEnvironment(initialAdminSchema, environment);
  return {
    email: value.INITIAL_ADMIN_EMAIL,
    password: value.INITIAL_ADMIN_PASSWORD,
  };
}

export function loadAdminSeedConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AdminSeedConfig {
  const value = parseEnvironment(adminSeedSchema, environment);
  return {
    databaseUri: value.MONGODB_URI,
    logLevel: value.LOG_LEVEL,
    initialAdmin: {
      email: value.INITIAL_ADMIN_EMAIL,
      password: value.INITIAL_ADMIN_PASSWORD,
    },
  };
}
