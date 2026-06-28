import { pool } from './connection';
import { logger } from '../utils/logger';

async function migrate() {
  logger.info('Running migrations...');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(100) NOT NULL,
        capacity INTEGER NOT NULL,
        price_per_night DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'MXN',
        amenities TEXT[],
        images TEXT[],
        status VARCHAR(50) DEFAULT 'available',
        marketplace_listing_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id),
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255) NOT NULL,
        guest_phone VARCHAR(50),
        check_in TIMESTAMP NOT NULL,
        check_out TIMESTAMP NOT NULL,
        guests INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'MXN',
        status VARCHAR(50) DEFAULT 'pending',
        source VARCHAR(100) DEFAULT 'direct',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        filename VARCHAR(255) NOT NULL,
        original_path TEXT NOT NULL,
        processed_path TEXT,
        thumbnail_path TEXT,
        duration INTEGER,
        trim_start INTEGER DEFAULT 0,
        trim_end INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        platforms TEXT[],
        fb_post_id VARCHAR(255),
        ig_media_id VARCHAR(255),
        publish_at TIMESTAMP,
        published_at TIMESTAMP,
        scheduled BOOLEAN DEFAULT false,
        metadata JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        source VARCHAR(50) DEFAULT 'chat',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(255) PRIMARY KEY,
        guest_name VARCHAR(255),
        guest_phone VARCHAR(50),
        guest_email VARCHAR(255),
        source VARCHAR(50) DEFAULT 'whatsapp',
        context JSONB,
        status VARCHAR(50) DEFAULT 'active',
        assigned_to VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        discount_percent DECIMAL(5,2),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        applicable_rooms INTEGER[],
        platform VARCHAR(100),
        fb_post_id VARCHAR(255),
        ig_media_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'draft',
        created_by INTEGER REFERENCES admin_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
    `);
    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
