import { hermes } from '../agent/orchestrator';
import { logger } from '../utils/logger';

interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class ChatBotService {
  private activeSessions: Map<string, { conversationId: string; lastActivity: Date }>;

  constructor() {
    this.activeSessions = new Map();
  }

  async processMessage(
    sessionId: string,
    message: string,
    guestName?: string,
  ): Promise<ChatMessage> {
    try {
      const session =
        this.activeSessions.get(sessionId) ||
        this.createSession(sessionId, guestName);

      session.lastActivity = new Date();
      this.activeSessions.set(sessionId, session);

      const response = await hermes.processMessage(message, {
        conversationId: session.conversationId,
        source: 'chat',
        guestName,
      });

      return {
        id: `${session.conversationId}_${Date.now()}`,
        conversationId: session.conversationId,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ error }, 'Chat processing error');
      return {
        id: `err_${Date.now()}`,
        conversationId: sessionId,
        role: 'assistant',
        content: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
        timestamp: new Date(),
      };
    }
  }

  private createSession(sessionId: string, _guestName?: string) {
    const conversationId = `chat_${sessionId}`;
    const session = { conversationId, lastActivity: new Date() };
    this.activeSessions.set(sessionId, session);
    return session;
  }

  cleanupInactiveSessions(maxAgeMinutes = 30): void {
    const now = new Date();
    for (const [id, session] of this.activeSessions) {
      const age = (now.getTime() - session.lastActivity.getTime()) / 60000;
      if (age > maxAgeMinutes) {
        this.activeSessions.delete(id);
      }
    }
  }
}

export const chatBot = new ChatBotService();
