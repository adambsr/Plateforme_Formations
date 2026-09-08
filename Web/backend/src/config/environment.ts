import { z } from 'zod';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalSenderAddress = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z
    .string()
    .trim()
    .refine((value) => {
      const displayAddress = /^[^<>\r\n]+<([^<>\r\n]+)>$/.exec(value);
      return z.email().safeParse(displayAddress?.[1]?.trim() ?? value).success;
    }, 'must be a valid email address or a name followed by <email@example.com>')
    .optional(),
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
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    TZ: z.literal('UTC').default('UTC'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_MINUTES: positiveInteger.default(15),
    REFRESH_TOKEN_TTL_DAYS: positiveInteger.default(7),
    PASSWORD_RESET_TTL_MINUTES: positiveInteger.default(30),

    EMAIL_PROVIDER: z.enum(['mailpit', 'smtp']).default('mailpit'),
    EMAIL_DELIVERY_ENABLED: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default(true),
    EMAIL_FROM: optionalSenderAddress,
    EMAIL_CONTACT_TO: optionalText.pipe(z.email().optional()),
    EMAIL_SUPPORT_ADDRESS: optionalText.pipe(z.email().optional()),
    EMAIL_TEST_RECIPIENT: optionalText.pipe(z.email().optional()),

    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true'),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM: optionalSenderAddress,
    SMTP_REQUIRE_TLS: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default(false),

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

    FCM_ENABLED: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default(false),
    GOOGLE_APPLICATION_CREDENTIALS: optionalText,

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
    if (
      environment.EMAIL_FROM === undefined &&
      environment.SMTP_FROM === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_FROM'],
        message: 'EMAIL_FROM (or legacy SMTP_FROM) is required',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.EMAIL_DELIVERY_ENABLED &&
      environment.EMAIL_PROVIDER !== 'smtp'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'Production email delivery requires EMAIL_PROVIDER=smtp',
      });
    }
    if (
      environment.EMAIL_PROVIDER === 'smtp' &&
      environment.EMAIL_DELIVERY_ENABLED &&
      (!hasSmtpUser || !hasSmtpPassword)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'Authenticated SMTP requires SMTP_USER and SMTP_PASSWORD',
      });
    }
    if (
      environment.NODE_ENV === 'production' &&
      environment.EMAIL_DELIVERY_ENABLED &&
      environment.EMAIL_PROVIDER === 'smtp' &&
      !environment.SMTP_SECURE &&
      !environment.SMTP_REQUIRE_TLS
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_REQUIRE_TLS'],
        message:
          'Production SMTP must use implicit TLS or require a STARTTLS upgrade',
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
    trustProxyHops: number;
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
    requireTls: boolean;
  };
  email: {
    provider: 'mailpit' | 'smtp';
    deliveryEnabled: boolean;
    from: string;
    contactTo: string;
    supportAddress: string;
    testRecipient: string | undefined;
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
  notifications: {
    enabled: boolean;
    googleApplicationCredentials: string | undefined;
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
      trustProxyHops: value.TRUST_PROXY_HOPS,
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
      requireTls: value.SMTP_REQUIRE_TLS,
    },
    email: {
      provider: value.EMAIL_PROVIDER,
      deliveryEnabled: value.EMAIL_DELIVERY_ENABLED,
      from: value.EMAIL_FROM ?? (value.SMTP_FROM as string),
      contactTo: value.EMAIL_CONTACT_TO ?? value.CENTER_EMAIL,
      supportAddress: value.EMAIL_SUPPORT_ADDRESS ?? value.CENTER_EMAIL,
      testRecipient: value.EMAIL_TEST_RECIPIENT,
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
    notifications: {
      enabled: value.FCM_ENABLED,
      googleApplicationCredentials: value.GOOGLE_APPLICATION_CREDENTIALS,
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
