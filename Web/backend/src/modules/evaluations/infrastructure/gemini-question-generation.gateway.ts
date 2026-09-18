import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type { AppConfig } from '../../../config/environment.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface QuestionGenerationGateway {
  readonly provider: string;
  readonly model: string;
  generate(input: {
    prompt: string;
    questionCount: number;
  }): Promise<QuestionGenerationResult>;
}

export interface QuestionGenerationResult {
  content: unknown;
  model: string;
}

const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const option = {
  type: 'object',
  properties: { id: { type: 'string' }, text: { type: 'string' } },
  required: ['id', 'text'],
};
const question = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'],
    },
    prompt: { type: 'string' },
    options: { type: 'array', items: option },
    correctOptionIds: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    points: { type: 'integer' },
  },
  required: ['type', 'prompt', 'options', 'correctOptionIds', 'points'],
};
const responseSchema = {
  type: 'object',
  properties: {
    questions: { type: 'array', items: question },
  },
  required: ['questions'],
};

function providerStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error))
    return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

function isTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed? out|aborted|aborterror/i.test(message);
}

function isFailoverEligible(error: unknown): boolean {
  const status = providerStatus(error);
  return status === 429 || status === 503 || status === 504 || isTimeout(error);
}

function providerErrorSummary(error: unknown): Record<string, unknown> {
  const rawMessage = error instanceof Error ? error.message : String(error);
  let providerStatusText: string | undefined;
  let providerMessage = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { status?: unknown; message?: unknown };
    };
    if (typeof parsed.error?.status === 'string')
      providerStatusText = parsed.error.status;
    if (typeof parsed.error?.message === 'string')
      providerMessage = parsed.error.message;
  } catch {
    // SDK errors are not guaranteed to contain a JSON provider body.
  }
  return {
    status: providerStatus(error),
    providerStatus: providerStatusText,
    message: providerMessage.slice(0, 1_000),
  };
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class GeminiQuestionGenerationGateway implements QuestionGenerationGateway {
  readonly provider = 'GEMINI';
  readonly model: string;
  readonly #client: GoogleGenAI;
  readonly #configured: boolean;
  readonly #logger: Pick<Logger, 'warn'> | undefined;

  constructor(config: AppConfig['ai'], logger?: Pick<Logger, 'warn'>) {
    this.model = config.model;
    this.#logger = logger;
    this.#configured = !/(?:placeholder|replace[_-]?with|replace[_-]?me)/i.test(
      config.apiKey,
    );
    this.#client = new GoogleGenAI({
      apiKey: config.apiKey,
      httpOptions: { timeout: 15_000 },
      ...(config.baseUrl === undefined
        ? {}
        : { httpOptions: { baseUrl: config.baseUrl, timeout: 15_000 } }),
    });
  }

  async generate(input: {
    prompt: string;
    questionCount: number;
  }): Promise<QuestionGenerationResult> {
    if (!this.#configured)
      throw new AppError(
        503,
        'AI_PROVIDER_NOT_CONFIGURED',
        'Gemini question generation is not configured. Set AI_API_KEY on the backend.',
      );

    const candidateModels = [
      this.model,
      ...(this.model === FALLBACK_MODEL ? [] : [FALLBACK_MODEL]),
    ];
    const attemptedModels: string[] = [];
    try {
      let lastError: unknown;
      for (const model of candidateModels) {
        attemptedModels.push(model);
        try {
          const response = await this.#client.models.generateContent({
            model,
            contents: input.prompt,
            config: {
              systemInstruction:
                'Generate objective assessment questions using only the supplied training context. Do not invent facts.',
              responseMimeType: 'application/json',
              responseJsonSchema: responseSchema,
              maxOutputTokens: Math.min(
                4_096,
                Math.max(1_600, input.questionCount * 240),
              ),
            },
          });
          if (response.text === undefined || response.text.trim() === '')
            throw new AppError(
              502,
              'AI_RESPONSE_INVALID',
              'Gemini returned an empty response. No questions were saved.',
            );
          return { content: JSON.parse(response.text) as unknown, model };
        } catch (error) {
          lastError = error;
          if (
            model !== FALLBACK_MODEL &&
            isFailoverEligible(error) &&
            candidateModels.length > 1
          ) {
            this.#logger?.warn(
              {
                model,
                fallbackModel: FALLBACK_MODEL,
                providerError: providerErrorSummary(error),
              },
              'Gemini evaluation question generation will retry with the fallback model',
            );
            await pause(400);
            continue;
          }
          throw error;
        }
      }
      throw lastError ?? new Error('Gemini returned no response.');
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.#logger?.warn(
          {
            model: attemptedModels[attemptedModels.length - 1] ?? this.model,
            attemptedModels,
          },
          'Gemini evaluation question generation returned invalid JSON',
        );
        throw new AppError(
          502,
          'AI_RESPONSE_INVALID',
          'Gemini returned invalid JSON. No questions were saved.',
        );
      }
      if (error instanceof AppError) throw error;
      this.#logger?.warn(
        {
          model: this.model,
          attemptedModels,
          providerError: providerErrorSummary(error),
        },
        'Gemini evaluation question generation failed',
      );
      if (providerStatus(error) === 429)
        throw new AppError(
          429,
          'AI_PROVIDER_RATE_LIMITED',
          'Gemini has temporarily reached its request limit. No questions were saved.',
        );
      if (
        providerStatus(error) === 503 ||
        providerStatus(error) === 504 ||
        isTimeout(error)
      )
        throw new AppError(
          503,
          'AI_PROVIDER_UNAVAILABLE',
          'Gemini is temporarily unavailable or under high demand. Please retry shortly. No questions were saved.',
        );
      if (providerStatus(error) === 401 || providerStatus(error) === 403)
        throw new AppError(
          502,
          'AI_PROVIDER_CONFIGURATION_ERROR',
          'Gemini rejected the configured server credentials. No questions were saved.',
        );
      if (providerStatus(error) === 404)
        throw new AppError(
          502,
          'AI_PROVIDER_MODEL_UNAVAILABLE',
          'The configured Gemini model is unavailable. No questions were saved.',
        );
      throw new AppError(
        502,
        'AI_PROVIDER_FAILED',
        'Gemini could not generate questions. No questions were saved.',
      );
    }
  }
}
