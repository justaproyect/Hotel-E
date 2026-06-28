import { pool } from './connection';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

async function seed() {
  logger.info('Seeding database...');
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('admin123', 12);

    await client.query(`
      INSERT INTO admin_users (username, email, password_hash, role)
      VALUES ('admin', 'admin@hotelhermes.com', $1, 'superadmin')
      ON CONFLICT (username) DO NOTHING;
    `, [hash]);

    await client.query(`
      INSERT INTO rooms (name, description, type, capacity, price_per_night, amenities)
      VALUES
        ('Suite Presidencial', 'Suite de lujo con vista panorámica', 'suite', 4, 4500.00, ARRAY['WiFi', 'Jacuzzi', 'Bar', 'Aire acondicionado', 'TV 65"']),
        ('Habitación Deluxe', 'Habitación amplia con balcón', 'deluxe', 2, 2800.00, ARRAY['WiFi', 'Balcón', 'Aire acondicionado', 'TV 50"']),
        ('Habitación Estándar', 'Habitación cómoda y funcional', 'standard', 2, 1500.00, ARRAY['WiFi', 'Aire acondicionado', 'TV 40"']),
        ('Habitación Familiar', 'Espacio ideal para familias', 'family', 5, 3200.00, ARRAY['WiFi', 'Cocina', 'Aire acondicionado', 'TV 55"', 'Sala de estar'])
      ON CONFLICT DO NOTHING;
    `);

    logger.info('Seed completed successfully');
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
