import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { pool } from './database/connection';
import adminRoutes from './admin/routes';
import { whatsappCloud } from './whatsapp/whatsappcloud';
import { videoScheduler } from './video/scheduler';
import cron from 'node-cron';
import path from 'path';

const app = express();

// ---- Middleware ----
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});
app.use('/api/', limiter);

// ---- Admin Frontend ----
app.use(express.static(path.join(__dirname, '..', 'web')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

// ---- Health Check ----
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {}
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    agent: 'Hermes Agent Online',
    database: dbStatus,
  });
});

// ---- API Routes ----
app.use('/api/admin', adminRoutes);

// ---- WhatsApp Cloud API Webhook ----
app.get('/api/whatsapp/webhook', (req, res) => {
  const challenge = whatsappCloud.verifyWebhook(req.query as Record<string, string>);
  if (challenge) {
    return void res.status(200).send(challenge);
  }
  return void res.status(403).send('Verification failed');
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    await whatsappCloud.handleIncoming(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error({ error }, 'WhatsApp webhook error');
    res.sendStatus(200);
  }
});

// ---- Chat API ----
app.post('/api/chat', async (req, res) => {
  try {
    const { chatBot } = require('./chat');
    const { sessionId, message, guestName } = req.body;
    if (!sessionId || !message) {
      return void res.status(400).json({ error: 'sessionId y message requeridos' });
    }
    const response = await chatBot.processMessage(sessionId, message, guestName);
    return void res.json(response);
  } catch (error) {
    return void res.status(500).json({ error: 'Error en chat' });
  }
});

// ---- Agent Status ----
app.get('/api/agent/status', async (_req, res) => {
  const { ollama } = require('./utils/ollama');
  const available = await ollama.isAvailable();
  res.json({
    agent: 'Hermes',
    ollama: available ? 'connected' : 'disconnected',
    model: config.ollama.model,
    ollamaUrl: config.ollama.url,
    uptime: process.uptime(),
  });
});

// ---- Error Handler ----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ---- Start ----
async function start() {
  let dbConnected = false;
  try {
    await pool.connect();
    dbConnected = true;
    logger.info('PostgreSQL connected');
  } catch (error) {
    logger.warn({ error }, 'PostgreSQL not available - running in UI-only mode');
  }

  if (dbConnected) {
    videoScheduler.start();

    cron.schedule('0 */6 * * *', async () => {
      const { marketplace } = require('./social/marketplace');
      await marketplace.publishAllAvailableRooms();
      logger.info('Scheduled: Published all available rooms to Marketplace');
    });

    cron.schedule('0 9 * * *', async () => {
      const { hermes } = require('./agent/orchestrator');
      await hermes.processMessage(
        'Genera un reporte de ventas y rendimiento de las últimas 24 horas',
        { conversationId: 'cron_daily', source: 'cron' },
      );
    });
  }

  app.listen(config.port, () => {
    logger.info(`Hermes Agent running on port ${config.port}`);
    logger.info(`Ollama: ${config.ollama.url} | Model: ${config.ollama.model}`);
    logger.info(`Database: ${dbConnected ? 'connected' : 'disconnected (UI mode)'}`);
  });
}

start();
