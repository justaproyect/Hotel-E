import { ai } from '../utils/ai';
import { logger } from '../utils/logger';
import { db } from '../database/connection';
import { messages } from '../database/schema';
import { eq } from 'drizzle-orm';

interface AgentContext {
  conversationId: string;
  source: 'whatsapp' | 'chat' | 'admin' | 'cron';
  guestName?: string;
  guestPhone?: string;
}

export class HermesOrchestrator {
  private systemPrompt: string;

  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `Eres HERMES, el agente inteligente de ventas y gestión hotelera.

RESPONSABILIDADES PRINCIPALES:
1. Gestionar reservas y ventas de habitaciones
2. Publicar ofertas en Facebook Marketplace automáticamente
3. Publicar videos promocionales en Facebook e Instagram
4. Editar y recortar videos para redes sociales
5. Gestionar promociones y descuentos
6. Atender clientes vía WhatsApp y chat web
7. Reportar al administrador sobre métricas y ventas

INFORMACIÓN DEL HOTEL:
- Nombre: Hermes Hotel
- Plataformas de publicación: Facebook Marketplace, Facebook Feed, Instagram
- Moneda: MXN
- Horario de atención: 24/7

DIRECTRICES DE COMPORTAMIENTO:
- Siempre responde de manera profesional y amigable en español
- Si no puedes hacer algo, explica claramente las opciones disponibles
- Ofrece asistencia proactiva: sugiere mejoras, promociones, etc.
- Confirma acciones importantes antes de ejecutarlas
- Reporta resultados de acciones al administrador`;
  }

  async processMessage(
    userMessage: string,
    context: AgentContext,
  ): Promise<string> {
    try {
      const history = await this.getConversationHistory(context.conversationId);

      const chatMessages = [
        { role: 'system' as const, content: this.systemPrompt },
        { role: 'system' as const, content: this.buildContextPrompt(context) },
        ...history,
        { role: 'user' as const, content: userMessage },
      ];

      const response = await ai.chat(chatMessages, this.getTools());

      await this.saveMessage(context.conversationId, 'user', userMessage, context.source);
      await this.saveMessage(context.conversationId, 'assistant', response, context.source);

      return response;
    } catch (error) {
      logger.error({ error }, 'Agent processing error');
      return 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?';
    }
  }

  private buildContextPrompt(ctx: AgentContext): string {
    return `CONTEXTO ACTUAL:
- Conversación: ${ctx.conversationId}
- Origen: ${ctx.source}
- Cliente: ${ctx.guestName || 'No identificado'}
- Teléfono: ${ctx.guestPhone || 'No disponible'}`;
  }

  private getTools(): unknown[] {
    return [
      {
        type: 'function',
        function: {
          name: 'check_availability',
          description: 'Verificar disponibilidad de habitaciones',
          parameters: {
            type: 'object',
            properties: {
              checkIn: { type: 'string', description: 'Fecha de entrada (YYYY-MM-DD)' },
              checkOut: { type: 'string', description: 'Fecha de salida (YYYY-MM-DD)' },
              guests: { type: 'number', description: 'Número de huéspedes' },
            },
            required: ['checkIn', 'checkOut', 'guests'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_booking',
          description: 'Crear una nueva reserva',
          parameters: {
            type: 'object',
            properties: {
              roomId: { type: 'number' },
              guestName: { type: 'string' },
              guestEmail: { type: 'string' },
              guestPhone: { type: 'string' },
              checkIn: { type: 'string' },
              checkOut: { type: 'string' },
              guests: { type: 'number' },
            },
            required: ['roomId', 'guestName', 'guestEmail', 'checkIn', 'checkOut', 'guests'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_rooms',
          description: 'Listar habitaciones disponibles con sus precios',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'publish_marketplace',
          description: 'Publicar una habitación en Facebook Marketplace',
          parameters: {
            type: 'object',
            properties: {
              roomId: { type: 'number' },
              price: { type: 'number' },
              description: { type: 'string' },
            },
            required: ['roomId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_booking_status',
          description: 'Consultar estado de una reserva',
          parameters: {
            type: 'object',
            properties: {
              bookingId: { type: 'number' },
              email: { type: 'string' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_promotion',
          description: 'Crear una nueva promoción',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              discountPercent: { type: 'number' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              roomIds: { type: 'array', items: { type: 'number' } },
            },
            required: ['title', 'description', 'startDate', 'endDate'],
          },
        },
      },
    ];
  }

  private async getConversationHistory(
    conversationId: string,
    limit = 10,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(limit);

    return result.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  private async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    source: string,
  ): Promise<void> {
    await db.insert(messages).values({ conversationId, role, content, source });
  }
}

export const hermes = new HermesOrchestrator();
