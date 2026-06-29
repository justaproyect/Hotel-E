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
app.set('trust proxy', 1);
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
    try {
      const client = await pool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT NOT NULL, type VARCHAR(100) NOT NULL, capacity INTEGER NOT NULL, price_per_night DECIMAL(10,2) NOT NULL, currency VARCHAR(3) DEFAULT 'MXN', amenities TEXT[], images TEXT[], status VARCHAR(50) DEFAULT 'available', marketplace_listing_id VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, room_id INTEGER REFERENCES rooms(id), guest_name VARCHAR(255) NOT NULL, guest_email VARCHAR(255) NOT NULL, guest_phone VARCHAR(50), check_in TIMESTAMP NOT NULL, check_out TIMESTAMP NOT NULL, guests INTEGER NOT NULL, total_amount DECIMAL(10,2) NOT NULL, currency VARCHAR(3) DEFAULT 'MXN', status VARCHAR(50) DEFAULT 'pending', source VARCHAR(100) DEFAULT 'direct', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS videos (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, filename VARCHAR(255) NOT NULL, original_path TEXT NOT NULL, processed_path TEXT, thumbnail_path TEXT, duration INTEGER, trim_start INTEGER DEFAULT 0, trim_end INTEGER, status VARCHAR(50) DEFAULT 'pending', platforms TEXT[], fb_post_id VARCHAR(255), ig_media_id VARCHAR(255), publish_at TIMESTAMP, published_at TIMESTAMP, scheduled BOOLEAN DEFAULT false, metadata JSONB, created_by VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL, content TEXT NOT NULL, source VARCHAR(50) DEFAULT 'chat', metadata JSONB, created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS conversations (id VARCHAR(255) PRIMARY KEY, guest_name VARCHAR(255), guest_phone VARCHAR(50), guest_email VARCHAR(255), source VARCHAR(50) DEFAULT 'whatsapp', context JSONB, status VARCHAR(50) DEFAULT 'active', assigned_to VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS admin_users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(50) DEFAULT 'admin', is_active BOOLEAN DEFAULT true, last_login TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS promotions (id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT NOT NULL, discount_percent DECIMAL(5,2), start_date TIMESTAMP NOT NULL, end_date TIMESTAMP NOT NULL, applicable_rooms INTEGER[], platform VARCHAR(100), fb_post_id VARCHAR(255), ig_media_id VARCHAR(255), status VARCHAR(50) DEFAULT 'draft', created_by INTEGER REFERENCES admin_users(id), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
      `);
      client.release();
      logger.info('Database migration completed');
    } catch (migrateError) {
      logger.error({ error: migrateError }, 'Migration failed');
    }

    try {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      const client = await pool.connect();
      await client.query(`INSERT INTO admin_users (username, email, password_hash, role) VALUES ('admin', 'admin@hotel.com', $1, 'superadmin') ON CONFLICT (username) DO NOTHING`, [hash]);
      client.release();
      logger.info('Admin user seeded (admin / admin123)');
    } catch (seedError) {
      logger.error({ error: seedError }, 'Admin seed failed (non-critical)');
    }

    try {
      const { rooms } = require('./database/schema');
      const { db } = require('./database/connection');
      await db.insert(rooms).values([
        { name: 'Suite Presidencial', description: 'Suite de lujo con vista panorámica', type: 'suite', capacity: 4, pricePerNight: '4500.00', amenities: ['WiFi', 'Jacuzzi', 'Bar', 'Aire acondicionado', 'TV 65"', 'Vista panorámica'] },
        { name: 'Habitación Deluxe', description: 'Habitación amplia con balcón', type: 'deluxe', capacity: 2, pricePerNight: '2800.00', amenities: ['WiFi', 'Balcón', 'Aire acondicionado', 'TV 50"'] },
        { name: 'Habitación Estándar', description: 'Habitación cómoda y funcional', type: 'standard', capacity: 2, pricePerNight: '1500.00', amenities: ['WiFi', 'Aire acondicionado', 'TV 40"'] },
        { name: 'Habitación Familiar', description: 'Espacio ideal para familias', type: 'family', capacity: 5, pricePerNight: '3200.00', amenities: ['WiFi', 'Cocina', 'Aire acondicionado', 'TV 55"', 'Sala de estar'] },
      ]).onConflictDoNothing();
      logger.info('Rooms seeded (4 habitaciones)');
    } catch (seedError) {
      logger.error({ error: seedError }, 'Rooms seed failed (non-critical)');
    }

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
