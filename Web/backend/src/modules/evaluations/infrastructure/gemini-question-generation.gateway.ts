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
  additionalProperties: false,
  properties: { id: { type: 'string' }, text: { type: 'string' } },
  required: ['id', 'text'],
};
const question = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'],
    },
    prompt: { type: 'string' },
    options: { type: 'array', minItems: 2, maxItems: 20, items: option },
    correctOptionIds: { type: 'array', minItems: 1, items: { type: 'string' } },
    explanation: { type: 'string' },
    points: { type: 'integer', minimum: 1 },
  },
  required: ['type', 'prompt', 'options', 'correctOptionIds', 'points'],
};
const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: { type: 'array', minItems: 1, maxItems: 20, items: question },
  },
  required: ['questions'],
};

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
      const response = await this.#client.interactions.create({
        model: this.model,
        input: input.prompt,
        store: false,
        system_instruction:
          'Generate objective assessment questions using only the supplied training context. Do not invent facts.',
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: responseSchema,
        },
        generation_config: { max_output_tokens: 8192 },
      });
      if (
        response.output_text === undefined ||
        response.output_text.trim() === ''
      )
        throw new Error('Gemini returned no text.');
      return JSON.parse(response.output_text) as unknown;
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new AppError(
          502,
          'AI_RESPONSE_INVALID',
          'Gemini returned invalid JSON. No questions were saved.',
        );
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        'AI_PROVIDER_FAILED',
        'Gemini could not generate questions. No questions were saved.',
      );
    }
  }
}
