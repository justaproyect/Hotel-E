import cron from 'node-cron';
import { db } from '../database/connection';
import { videos } from '../database/schema';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { facebook } from '../social/facebook';
import { instagram } from '../social/instagram';
import { logger } from '../utils/logger';

export class VideoScheduler {
  start(): void {
    cron.schedule('* * * * *', async () => {
      await this.processPendingVideos();
    });
    logger.info('Video scheduler started');
  }

  private async processPendingVideos(): Promise<void> {
    try {
      const pending = await db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.scheduled, true),
            lte(videos.publishAt, new Date()),
            isNull(videos.publishedAt),
          ),
        );

      for (const video of pending) {
        await this.publishVideo(video);
      }
    } catch (error) {
      logger.error({ error }, 'Error processing pending videos');
    }
  }

  private async publishVideo(video: typeof videos.$inferSelect): Promise<void> {
    try {
      const platforms = video.platforms || ['facebook'];

      for (const platform of platforms) {
        const videoUrl = video.processedPath || video.originalPath;

        if (platform === 'facebook' && videoUrl) {
          const fbId = await facebook.publishFeedPost({
            message: `${video.title}\n\n${video.description || ''}`,
            videoUrl,
          });
          await db.update(videos).set({ fbPostId: fbId }).where(eq(videos.id, video.id));
        }

        if (platform === 'instagram' && videoUrl) {
          const igId = await instagram.publishVideo({
            videoUrl,
            caption: `${video.title}\n\n${video.description || ''}`,
          });
          await db.update(videos).set({ igMediaId: igId }).where(eq(videos.id, video.id));
        }
      }

      await db
        .update(videos)
        .set({ status: 'published', publishedAt: new Date() })
        .where(eq(videos.id, video.id));

      logger.info({ videoId: video.id }, 'Video published successfully');
    } catch (error) {
      logger.error({ error, videoId: video.id }, 'Failed to publish video');
      await db
        .update(videos)
        .set({ status: 'failed' })
        .where(eq(videos.id, video.id));
    }
  }
}

export const videoScheduler = new VideoScheduler();
