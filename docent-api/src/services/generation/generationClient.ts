import OpenAI from 'openai';
import { config } from '../../config.js';
import type { ChatMessage } from './promptBuilder.js';

export interface ChatResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Generation model abstraction — the retrieval/generation pipeline talks to a
 * `ChatProvider`, not to a specific vendor, so the model is swappable behind
 * this interface (OpenAI, Gemini, or any OpenAI-compatible API via baseURL).
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

/**
 * Google Gemini provider using the native generativelanguage REST API
 * (generateContent), so no extra SDK or OpenAI-compat endpoint is required.
 * The system prompt is mapped to `systemInstruction`; user turns to `contents`.
 */
export class GeminiProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts: { apiKey: string; model: string; baseURL: string }) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = opts.baseURL;
  }

  async complete(messages: ChatMessage[]): Promise<ChatResult> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const contents = messages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user', parts: [{ text: m.content }] }));

    const url = `${this.baseUrl}/models/${this.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Generation request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const content =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return {
      content: content.trim(),
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}

export function createChatProvider(): ChatProvider {
  if (config.generationProvider === 'gemini') {
    return new GeminiProvider({
      apiKey: config.generationApiKey,
      model: config.generationModel,
      baseURL: config.generationBaseUrl ?? 'https://generativelanguage.googleapis.com/v1beta',
    });
  }
  return new OpenAiCompatibleProvider({
    apiKey: config.generationApiKey,
    model: config.generationModel,
    baseURL: config.generationBaseUrl || undefined,
  });
}