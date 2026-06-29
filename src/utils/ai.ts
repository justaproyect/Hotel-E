import axios from 'axios';
import { config } from '../config';
import { logger } from './logger';

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiClient {
  private groqApiKey: string;
  private ollamaUrl: string;
  private ollamaModel: string;
  private groqModel: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.ollamaUrl = config.ollama.url;
    this.ollamaModel = config.ollama.model;
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  }

  async chat(messages: AiMessage[], tools?: unknown[]): Promise<string> {
    if (this.groqApiKey) {
      try {
        return await this.groqChat(messages);
      } catch (error) {
        logger.warn({ error }, 'Groq AI failed, trying Ollama');
      }
    }

    try {
      return await this.ollamaChat(messages, tools);
    } catch (error) {
      logger.warn({ error }, 'Ollama failed, no AI available');
      return this.noAiResponse(messages);
    }
  }

  private async groqChat(messages: AiMessage[]): Promise<string> {
    const modelsToTry = [this.groqModel, 'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-8b-8192', 'llama-3.1-8b-instant'];
    let lastError: unknown;

    for (const model of modelsToTry) {
      try {
        const { data } = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          { model, messages, temperature: 0.7, max_tokens: 1024 },
          {
            headers: { Authorization: `Bearer ${this.groqApiKey}`, 'Content-Type': 'application/json' },
            timeout: 15000,
          },
        );
        if (this.groqModel !== model) {
          logger.info(`Groq model fallback: ${this.groqModel} -> ${model}`);
        }
        return data.choices[0]?.message?.content || '';
      } catch (error: any) {
        lastError = error;
        const groqBody = error.response?.data;
        logger.warn({ model, groqBody, status: error.response?.status }, 'Groq model failed, trying next');
        continue;
      }
    }
    throw lastError;
  }

  private async ollamaChat(messages: AiMessage[], tools?: unknown[]): Promise<string> {
    const payload: Record<string, unknown> = {
      model: this.ollamaModel,
      messages,
      stream: false,
    };
    if (tools) payload.tools = tools;

    const { data } = await axios.post(`${this.ollamaUrl}/api/chat`, payload, { timeout: 60000 });
    return data.message?.content || '';
  }

  private noAiResponse(messages: AiMessage[]): string {
    const last = messages[messages.length - 1]?.content?.toLowerCase() || '';
    if (last.includes('hola') || last.includes('buenas')) {
      return '👋 ¡Hola! Soy Hermes, el asistente virtual del hotel. ¿En qué puedo ayudarte?';
    }
    if (last.includes('precio') || last.includes('cuesta')) {
      return '💰 Precios:\n🏨 Suite Presidencial - $4,500/noche\n🛏️ Deluxe - $2,800/noche\n🛏️ Estándar - $1,500/noche\n👨‍👩‍👧‍👧 Familiar - $3,200/noche';
    }
    if (last.includes('habitacion') || last.includes('disponible')) {
      return '🏠 Habitaciones: Suite Presidencial, Deluxe, Estándar, Familiar. ¿Te gustaría reservar?';
    }
    if (last.includes('reserv')) {
      return '📅 Para reservar necesito: fecha entrada, salida, huéspedes y tipo de habitación.';
    }
    return '🤖 Soy Hermes. Consulta habitaciones, precios o haz una reserva. ¿En qué te ayudo?';
  }

  async isAvailable(): Promise<boolean> {
    if (this.groqApiKey) return true;
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const ai = new AiClient();
