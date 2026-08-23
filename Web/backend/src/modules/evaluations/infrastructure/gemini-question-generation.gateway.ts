import { GoogleGenAI } from '@google/genai';
import type { AppConfig } from '../../../config/environment.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface QuestionGenerationGateway {
  readonly provider: string;
  readonly model: string;
  generate(input: { prompt: string; questionCount: number }): Promise<unknown>;
}

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

export class GeminiQuestionGenerationGateway implements QuestionGenerationGateway {
  readonly provider = 'GEMINI';
  readonly model: string;
  readonly #client: GoogleGenAI;
  readonly #configured: boolean;

  constructor(config: AppConfig['ai']) {
    this.model = config.model;
    this.#configured = !/(?:placeholder|replace[_-]?with|replace[_-]?me)/i.test(
      config.apiKey,
    );
    this.#client = new GoogleGenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl === undefined
        ? {}
        : { httpOptions: { baseUrl: config.baseUrl } }),
    });
  }

  async generate(input: {
    prompt: string;
    questionCount: number;
  }): Promise<unknown> {
    if (!this.#configured)
      throw new AppError(
        503,
        'AI_PROVIDER_NOT_CONFIGURED',
        'Gemini question generation is not configured. Set AI_API_KEY on the backend.',
      );

    try {
      let response: Awaited<
        ReturnType<GoogleGenAI['models']['generateContent']>
      > | null = null;
      for (let attempt = 0; attempt < 2 && response === null; attempt += 1) {
        try {
          response = await this.#client.models.generateContent({
            model: this.model,
            contents: input.prompt,
            config: {
              systemInstruction:
                'Generate objective assessment questions using only the supplied training context. Do not invent facts.',
              responseMimeType: 'application/json',
              responseJsonSchema: responseSchema,
              maxOutputTokens: 8192,
            },
          });
        } catch (error) {
          if (attempt === 0 && providerStatus(error) === 503) continue;
          throw error;
        }
      }
      if (response === null) throw new Error('Gemini returned no response.');
      if (response.text === undefined || response.text.trim() === '')
        throw new Error('Gemini returned no text.');
      return JSON.parse(response.text) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new AppError(
          502,
          'AI_RESPONSE_INVALID',
          'Gemini returned invalid JSON. No questions were saved.',
        );
      if (error instanceof AppError) throw error;
      if (providerStatus(error) === 503)
        throw new AppError(
          503,
          'AI_PROVIDER_BUSY',
          'Gemini is temporarily busy. Please retry in a moment. No questions were saved.',
        );
      throw new AppError(
        502,
        'AI_PROVIDER_FAILED',
        'Gemini could not generate questions. No questions were saved.',
      );
    }
  }
}
