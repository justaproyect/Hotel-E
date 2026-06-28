import axios from 'axios';
import { config } from '../config';
import { logger } from './logger';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
}

interface OllamaToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface OllamaToolMessage extends OllamaMessage {
  tool_calls?: OllamaToolCall[];
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.url;
    this.model = config.ollama.model;
  }

  async chat(
    messages: OllamaMessage[],
    tools?: unknown[],
    stream?: boolean,
  ): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: stream ?? false,
      };
      if (tools) payload.tools = tools;

      const { data } = await axios.post(`${this.baseUrl}/api/chat`, payload);
      return data.message?.content || '';
    } catch (error) {
      logger.error({ error }, 'Ollama chat error');
      throw error;
    }
  }

  async chatWithTools(
    messages: OllamaMessage[],
    tools: unknown[],
  ): Promise<{ content: string; toolCalls: OllamaToolCall[] }> {
    try {
      const { data } = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages,
        tools,
        stream: false,
      });
      const result = data as OllamaResponse & { message: OllamaToolMessage };
      return {
        content: result.message?.content || '',
        toolCalls: result.message?.tool_calls || [],
      };
    } catch (error) {
      logger.error({ error }, 'Ollama chatWithTools error');
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`);
      return true;
    } catch {
      return false;
    }
  }
}

export const ollama = new OllamaClient();
