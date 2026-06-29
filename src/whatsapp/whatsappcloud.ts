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

      let response: string;
      try {
        response = await hermes.processMessage(text, {
          conversationId: convId,
          source: 'whatsapp',
          guestPhone: from,
        });
      } catch {
        response = await this.fallbackResponse(text);
      }

      await this.sendMessage(from, response);
    } catch (error) {
      logger.error({ error }, 'WhatsApp Cloud incoming error');
      try {
        const from = (payload as any)?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
        if (from) await this.sendMessage(from, '👋 Hola, soy Hermes. Estoy teniendo problemas con mi conexión, intenta de nuevo en un momento.');
      } catch {}
    }
  }

  private async fallbackResponse(text: string): Promise<string> {
    const lower = text.toLowerCase();

    if (lower.includes('hola') || lower.includes('buenas') || lower.includes('hello')) {
      return '👋 ¡Hola! Soy Hermes, el asistente virtual del hotel. ¿En qué puedo ayudarte?\n\nPuedes consultarme sobre:\n🏠 Habitaciones disponibles\n💰 Precios\n📅 Reservaciones\n📍 Ubicación';
    }
    if (lower.includes('precio') || lower.includes('cuesta') || lower.includes('cuanto')) {
      return '💰 Estos son nuestros precios:\n🏨 Suite Presidencial - $4,500 MXN/noche\n🛏️ Deluxe - $2,800 MXN/noche\n🛏️ Estándar - $1,500 MXN/noche\n👨‍👩‍👧‍👧 Familiar - $3,200 MXN/noche';
    }
    if (lower.includes('habitacion') || lower.includes('disponible') || lower.includes('cuarto')) {
      return '🏠 Tenemos estas habitaciones disponibles:\n• Suite Presidencial (4 pers)\n• Deluxe (2 pers)\n• Estándar (2 pers)\n• Familiar (5 pers)\n\n¿Te gustaría reservar alguna?';
    }
    if (lower.includes('gracias') || lower.includes('thanks')) {
      return '😊 ¡De nada! Si necesitas algo más, aquí estoy para ayudarte. ¡Buen día!';
    }
    if (lower.includes('ubicacion') || lower.includes('direccion') || lower.includes('donde')) {
      return '📍 Estamos ubicados en el centro de la ciudad. ¿Te gustaría recibir la dirección exacta o indicaciones para llegar?';
    }
    if (lower.includes('reserv') || lower.includes('booking') || lower.includes('apart')) {
      return '📅 Para hacer una reserva necesito:\n1️⃣ Fecha de entrada\n2️⃣ Fecha de salida\n3️⃣ Número de huéspedes\n4️⃣ Tipo de habitación\n\n¿Me puedes dar esos datos?';
    }

    return '🤖 Soy Hermes, el asistente del hotel. Puedo ayudarte con:\n🏠 Ver habitaciones\n💰 Consultar precios\n📅 Reservaciones\n📍 Ubicación\n\n¿Sobre qué te gustaría saber?';
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
