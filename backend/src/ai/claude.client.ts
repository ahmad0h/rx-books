import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiEffort, AppEnv } from '../config/env.js';
import type { TokenUsage } from './ai-request.js';

export interface ClassifyRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}

export interface ClassifyResult {
  /** The JSON answer, or null when the model declined. */
  text: string | null;
  /** The model that answered (differs from the configured one after a fallback). */
  model: string;
  usage: TokenUsage;
}

/**
 * The only place that talks to Claude. Tests replace this class with a fake,
 * so no test ever calls the API or spends money.
 */
@Injectable()
export class ClaudeClient {
  private readonly client: Anthropic | null;
  readonly model: string;
  private readonly effort: AiEffort;

  constructor(config: ConfigService<AppEnv, true>) {
    const apiKey = config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = config.get('AI_MODEL', { infer: true });
    this.effort = config.get('AI_EFFORT', { infer: true });
    // The key stays on the server: it is read here and never sent to the browser.
    this.client = apiKey
      ? new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 })
      : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async classify(request: ClassifyRequest): Promise<ClassifyResult> {
    if (!this.client) throw new Error('AI is not set up.');
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      // If the model declines, the API retries on Anthropic's recommended
      // fallback model. Haiku has no server-side fallback.
      ...(this.model.startsWith('claude-haiku')
        ? {}
        : {
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default' as const,
          }),
      // The instructions and chart of accounts are the same for every request: cache them.
      system: [
        {
          type: 'text',
          text: request.system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: request.user }],
      output_config: {
        effort: this.effort,
        format: { type: 'json_schema', schema: request.schema },
      },
    });

    const usage: TokenUsage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
    };
    if (response.stop_reason === 'refusal') {
      return { text: null, model: response.model, usage };
    }
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    return { text, model: response.model, usage };
  }
}

/** A short, safe message for an AI call that failed. */
export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The AI key was rejected. Check ANTHROPIC_API_KEY in the backend .env file.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'The AI key is not allowed to use this model.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'AI is busy right now (rate limit). Try again in a minute.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `AI rejected the request: ${error.message}`.slice(0, 300);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return 'AI took too long to answer. Try again.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the AI service. Check the internet connection.';
  }
  if (error instanceof Anthropic.APIError) {
    return `AI service error (${error.status ?? 'unknown'}). Try again.`;
  }
  return 'AI request failed. Try again.';
}
