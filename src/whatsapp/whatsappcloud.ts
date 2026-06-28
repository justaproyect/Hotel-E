import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { hermes } from '../agent/orchestrator';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export class WhatsAppCloudService {
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.accessToken = config.whatsapp.accessToken;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
  }

  async handleIncoming(payload: Record<string, unknown>): Promise<void> {
    try {
      const entry = (payload as any).entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) return;

      const from = message.from;
      const text = message.text?.body || '';
      const convId = `wa_${from}`;

      await this.markAsRead(message.id);

      const response = await hermes.processMessage(text, {
        conversationId: convId,
        source: 'whatsapp',
        guestPhone: from,
      });

      await this.sendMessage(from, response);
    } catch (error) {
      logger.error({ error }, 'WhatsApp Cloud incoming error');
    }
  }

  async sendMessage(to: string, body: string): Promise<string> {
    try {
      const { data } = await axios.post(
        `${GRAPH_API}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return data.messages?.[0]?.id || '';
    } catch (error) {
      logger.error({ error }, 'WhatsApp Cloud send failed');
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await axios.post(
        `${GRAPH_API}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch {
      // non-critical
    }
  }

  async setWebhook(url: string, verifyToken: string): Promise<void> {
    try {
      const appId = config.whatsapp.appId;
      await axios.post(
        `${GRAPH_API}/${appId}/subscriptions`,
        {
          object: 'whatsapp_business_account',
          callback_url: url,
          verify_token: verifyToken,
          fields: 'messages',
          include_values: true,
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      logger.info('WhatsApp webhook subscribed');
    } catch (error) {
      logger.error({ error }, 'Failed to set WhatsApp webhook');
    }
  }

  verifyWebhook(query: Record<string, string>): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.webhookToken) {
      logger.info('WhatsApp webhook verified');
      return challenge;
    }
    return null;
  }
}

export const whatsappCloud = new WhatsAppCloudService();
