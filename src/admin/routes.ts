import { Router, Request, Response } from 'express';
import { db } from '../database/connection';
import { adminUsers, rooms, bookings, videos, promotions, conversations } from '../database/schema';
import { eq, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authMiddleware } from './auth';
import multer from 'multer';
import path from 'path';
import { videoEditor } from '../video/editor';
import { marketplace } from '../social/marketplace';
import { facebook } from '../social/facebook';
import { instagram } from '../social/instagram';

const router = Router();
const upload = multer({
  dest: path.join(process.cwd(), '.video_uploads'),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username));

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return void res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions,
    );

    await db
      .update(adminUsers)
      .set({ lastLogin: new Date() })
      .where(eq(adminUsers.id, user.id));

    return void res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    return void res.status(500).json({ error: 'Error de autenticación' });
  }
});

router.get('/dashboard', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [roomCount] = await db.select({ count: sql<number>`count(*)` }).from(rooms);
    const [bookingCount] = await db.select({ count: sql<number>`count(*)` }).from(bookings);
    const [revenue] = await db
      .select({ total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)` })
      .from(bookings)
      .where(eq(bookings.status, 'confirmed'));
    const [videoCount] = await db.select({ count: sql<number>`count(*)` }).from(videos);
    const [activeConversations] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.status, 'active'));

    return void res.json({
      rooms: Number(roomCount.count),
      bookings: Number(bookingCount.count),
      revenue: Number(revenue.total),
      videos: Number(videoCount.count),
      activeConversations: Number(activeConversations.count),
    });
  } catch (error) {
    return void res.status(500).json({ error: 'Error al obtener dashboard' });
  }
});

router.get('/rooms', authMiddleware, async (_req: Request, res: Response) => {
  const allRooms = await db.select().from(rooms).orderBy(rooms.id);
  return void res.json(allRooms);
});

router.post('/rooms', authMiddleware, async (req: Request, res: Response) => {
  const [room] = await db.insert(rooms).values(req.body).returning();
  return void res.json(room);
});

router.put('/rooms/:id', authMiddleware, async (req: Request, res: Response) => {
  const [room] = await db
    .update(rooms)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(rooms.id, parseInt(req.params.id)))
    .returning();
  return void res.json(room);
});

router.delete('/rooms/:id', authMiddleware, async (req: Request, res: Response) => {
  const [room] = await db
    .delete(rooms)
    .where(eq(rooms.id, parseInt(req.params.id)))
    .returning();
  return void res.json(room);
});

router.post('/rooms/:id/publish-marketplace', authMiddleware, async (req: Request, res: Response) => {
  try {
    const listingId = await marketplace.publishRoom(parseInt(req.params.id));
    return void res.json({ listingId, message: 'Publicado en Marketplace' });
  } catch (error) {
    return void res.status(500).json({ error: 'Error al publicar en Marketplace' });
  }
});

router.get('/bookings', authMiddleware, async (_req: Request, res: Response) => {
  const allBookings = await db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.createdAt));
  return void res.json(allBookings);
});

router.put('/bookings/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const [booking] = await db
    .update(bookings)
    .set({ status: req.body.status, updatedAt: new Date() })
    .where(eq(bookings.id, parseInt(req.params.id)))
    .returning();
  return void res.json(booking);
});

router.get('/videos', authMiddleware, async (_req: Request, res: Response) => {
  const allVideos = await db.select().from(videos).orderBy(desc(videos.createdAt));
  return void res.json(allVideos);
});

router.post('/videos/upload', authMiddleware, upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return void res.status(400).json({ error: 'No video file' });

    const metadata = await videoEditor.getMetadata(req.file.path);
    const [video] = await db
      .insert(videos)
      .values({
        title: req.body.title || req.file.originalname,
        description: req.body.description || '',
        filename: req.file.originalname,
        originalPath: req.file.path,
        duration: Math.floor(metadata.duration),
        status: 'uploaded',
        platforms: req.body.platforms ? req.body.platforms.split(',') : ['facebook'],
        scheduled: req.body.scheduled === 'true',
        publishAt: req.body.publishAt ? new Date(req.body.publishAt) : undefined,
        createdBy: (req as any).user?.username || 'admin',
      })
      .returning();

    return void res.json(video);
  } catch (error) {
    return void res.status(500).json({ error: 'Error al subir video' });
  }
});

router.post('/videos/:id/trim', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [video] = await db.select().from(videos).where(eq(videos.id, parseInt(req.params.id)));
    if (!video) return void res.status(404).json({ error: 'Video no encontrado' });

    const outputPath = await videoEditor.trimVideo(
      video.originalPath,
      `trimmed_${video.id}`,
      { start: req.body.start || 0, end: req.body.end },
    );

    const [updated] = await db
      .update(videos)
      .set({
        processedPath: outputPath,
        trimStart: req.body.start || 0,
        trimEnd: req.body.end || undefined,
        status: 'processed',
        updatedAt: new Date(),
      })
      .where(eq(videos.id, video.id))
      .returning();

    return void res.json(updated);
  } catch (error) {
    return void res.status(500).json({ error: 'Error al recortar video' });
  }
});

router.post('/videos/:id/publish', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [video] = await db.select().from(videos).where(eq(videos.id, parseInt(req.params.id)));
    if (!video) return void res.status(404).json({ error: 'Video no encontrado' });

    const videoUrl = video.processedPath || video.originalPath;

    let fbPostId: string | undefined;
    let igMediaId: string | undefined;

    const platforms = video.platforms || ['facebook'];
    for (const platform of platforms) {
      if (platform === 'facebook') {
        fbPostId = await facebook.publishFeedPost({
          message: `${video.title}\n\n${video.description || ''}`,
          videoUrl,
        });
      }
      if (platform === 'instagram') {
        igMediaId = await instagram.publishVideo({
          videoUrl,
          caption: `${video.title}\n\n${video.description || ''}`,
        });
      }
    }

    await db
      .update(videos)
      .set({
        fbPostId,
        igMediaId,
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, video.id));

    return void res.json({ fbPostId, igMediaId, message: 'Video publicado' });
  } catch (error) {
    return void res.status(500).json({ error: 'Error al publicar video' });
  }
});

router.get('/promotions', authMiddleware, async (_req: Request, res: Response) => {
  const all = await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  return void res.json(all);
});

router.post('/promotions', authMiddleware, async (req: Request, res: Response) => {
  const [promo] = await db.insert(promotions).values({
    ...req.body,
    createdBy: (req as any).user?.id,
  }).returning();
  return void res.json(promo);
});

router.get('/conversations', authMiddleware, async (_req: Request, res: Response) => {
  const all = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt));
  return void res.json(all);
});

router.post('/agent/chat', authMiddleware, async (req: Request, res: Response) => {
  const { hermes } = require('../agent/orchestrator');
  const response = await hermes.processMessage(req.body.message, {
    conversationId: `admin_${(req as any).user?.id}`,
    source: 'admin',
    guestName: (req as any).user?.username,
  });
  return void res.json({ response });
});

export default router;
