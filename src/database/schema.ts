import { pgTable, serial, varchar, text, integer, decimal, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  capacity: integer('capacity').notNull(),
  pricePerNight: decimal('price_per_night', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('MXN'),
  amenities: text('amenities').array(),
  images: text('images').array(),
  status: varchar('status', { length: 50 }).default('available'),
  marketplaceListingId: varchar('marketplace_listing_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').references(() => rooms.id),
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  guestEmail: varchar('guest_email', { length: 255 }).notNull(),
  guestPhone: varchar('guest_phone', { length: 50 }),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  guests: integer('guests').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('MXN'),
  status: varchar('status', { length: 50 }).default('pending'),
  source: varchar('source', { length: 100 }).default('direct'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalPath: text('original_path').notNull(),
  processedPath: text('processed_path'),
  thumbnailPath: text('thumbnail_path'),
  duration: integer('duration'),
  trimStart: integer('trim_start').default(0),
  trimEnd: integer('trim_end'),
  status: varchar('status', { length: 50 }).default('pending'),
  platforms: text('platforms').array(),
  fbPostId: varchar('fb_post_id', { length: 255 }),
  igMediaId: varchar('ig_media_id', { length: 255 }),
  publishAt: timestamp('publish_at'),
  publishedAt: timestamp('published_at'),
  scheduled: boolean('scheduled').default(false),
  metadata: jsonb('metadata'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: varchar('conversation_id', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  content: text('content').notNull(),
  source: varchar('source', { length: 50 }).default('chat'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  guestName: varchar('guest_name', { length: 255 }),
  guestPhone: varchar('guest_phone', { length: 50 }),
  guestEmail: varchar('guest_email', { length: 255 }),
  source: varchar('source', { length: 50 }).default('whatsapp'),
  context: jsonb('context'),
  status: varchar('status', { length: 50 }).default('active'),
  assignedTo: varchar('assigned_to', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).default('admin'),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  applicableRooms: integer('applicable_rooms').array(),
  platform: varchar('platform', { length: 100 }),
  fbPostId: varchar('fb_post_id', { length: 255 }),
  igMediaId: varchar('ig_media_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('draft'),
  createdBy: integer('created_by').references(() => adminUsers.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
