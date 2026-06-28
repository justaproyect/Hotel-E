import { config } from '../config';
import { logger } from '../utils/logger';
import { hermes } from '../agent/orchestrator';
import axios from 'axios';

export class WhatsAppService {
  private baseUrl: string;
  private accountSid: string;
  private authToken: string;

  constructor() {
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}`;
    this.accountSid = config.twilio.accountSid;
    this.authToken = config.twilio.authToken;
  }

  async handleIncomingMessage(params: {
    From: string;
    Body: string;
    MessageSid: string;
  }): Promise<void> {
    try {
      const phoneNumber = params.From.replace('whatsapp:', '');
      const conversationId = `wa_${phoneNumber}`;

      const response = await hermes.processMessage(params.Body, {
        conversationId,
        source: 'whatsapp',
        guestPhone: phoneNumber,
      });

      await this.sendMessage(params.From, response);
    } catch (error) {
      logger.error({ error }, 'WhatsApp message handling failed');
      await this.sendMessage(
        params.From,
        'Lo siento, tuve un problema procesando tu mensaje. Por favor intenta de nuevo.',
      );
    }
  }

  async sendMessage(to: string, body: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/Messages.json`,
        new URLSearchParams({
          To: to,
          From: config.twilio.whatsappNumber,
          Body: body,
        }),
        {
          auth: {
            username: this.accountSid,
            password: this.authToken,
          },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send WhatsApp message');
    }
  }

  verifyWebhook(params: Record<string, string>): string {
    const challenge = params['hub.challenge'];
    const verifyToken = params['hub.verify_token'];
    if (verifyToken === 'hermes_webhook_2024') {
      return challenge;
    }
    throw new Error('Invalid verification token');
  }
}

export const whatsapp = new WhatsAppService();
