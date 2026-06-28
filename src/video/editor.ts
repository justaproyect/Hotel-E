import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

interface TrimOptions {
  start: number;
  end?: number;
  duration?: number;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
}

export class VideoEditor {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), '.video_uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async getMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          size: metadata.format.size || 0,
        });
      });
    });
  }

  async trimVideo(
    inputPath: string,
    outputFilename: string,
    options: TrimOptions,
  ): Promise<string> {
    const outputPath = path.join(this.uploadsDir, `${outputFilename}.mp4`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);

      command.setStartTime(options.start);

      if (options.end) {
        const duration = options.end - options.start;
        command.setDuration(duration);
      } else if (options.duration) {
        command.setDuration(options.duration);
      }

      command
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 22',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart',
        ])
        .save(outputPath)
        .on('end', () => {
          logger.info({ outputPath }, 'Video trimmed successfully');
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error({ err }, 'Video trim failed');
          reject(err);
        });
    });
  }

  async generateThumbnail(
    inputPath: string,
    atSeconds: number,
  ): Promise<string> {
    const thumbPath = inputPath.replace(/\.\w+$/, '_thumb.jpg');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [atSeconds],
          filename: path.basename(thumbPath),
          folder: path.dirname(thumbPath),
          size: '1280x720',
        })
        .on('end', () => {
          logger.info({ thumbPath }, 'Thumbnail generated');
          resolve(thumbPath);
        })
        .on('error', (err) => {
          logger.error({ err }, 'Thumbnail generation failed');
          reject(err);
        });
    });
  }

  async resizeForInstagram(inputPath: string, outputFilename: string): Promise<string> {
    const outputPath = path.join(this.uploadsDir, `${outputFilename}_ig.mp4`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .size('1080x1080')
        .aspect('1:1')
        .autopad(true, 'black')
        .outputOptions(['-c:v libx264', '-crf 23', '-c:a aac', '-movflags +faststart'])
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info({ filePath }, 'Cleaned up video file');
      }
    } catch (error) {
      logger.error({ error }, 'Cleanup failed');
    }
  }
}

export const videoEditor = new VideoEditor();
