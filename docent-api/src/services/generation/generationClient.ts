import OpenAI from 'openai';
import { config } from '../../config.js';
import type { ChatMessage } from './promptBuilder.js';

export interface ChatResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Generation model abstraction — the retrieval/generation pipeline talks to a
 * `ChatProvider`, not to OpenAI directly, so the model is swappable behind this
 * interface (OpenAI, DeepSeek, or any OpenAI-compatible API via baseURL).
 * Results carry real token usage so the caller can log per-query cost.
 */
export interface ChatProvider {
  complete(messages: ChatMessage[]): Promise<ChatResult>;
}

export class OpenAiCompatibleProvider implements ChatProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model: string; baseURL?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
    this.model = opts.model;
  }

  async complete(messages: ChatMessage[]): Promise<ChatResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0,
    });
    const usage = response.usage;
    return {
      content: (response.choices[0]?.message?.content ?? '').trim(),
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
    };
  }
}

export function createChatProvider(): ChatProvider {
  return new OpenAiCompatibleProvider({
    apiKey: config.generationApiKey,
    model: config.generationModel,
    baseURL: config.generationBaseUrl,
  });
}