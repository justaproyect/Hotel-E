import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export class InstagramPublisher {
  private accessToken: string;
  private businessAccountId: string;

  constructor() {
    this.accessToken = config.instagram.accessToken;
    this.businessAccountId = config.instagram.businessAccountId;
  }

  async publishVideo(params: {
    videoUrl: string;
    caption: string;
    thumbnailUrl?: string;
  }): Promise<string> {
    try {
      const { data: media } = await axios.post(
        `${GRAPH_API}/${this.businessAccountId}/media`,
        {
          media_type: 'VIDEO',
          video_url: params.videoUrl,
          caption: params.caption,
          thumb_offset: params.thumbnailUrl ? undefined : '0',
        },
        { params: { access_token: this.accessToken } },
      );

      const mediaId = media.id;

      const { data: published } = await axios.post(
        `${GRAPH_API}/${this.businessAccountId}/media_publish`,
        { creation_id: mediaId },
        { params: { access_token: this.accessToken } },
      );

      logger.info({ igMediaId: published.id }, 'Instagram video published');
      return published.id;
    } catch (error) {
      logger.error({ error }, 'Failed to publish Instagram video');
      throw error;
    }
  }

  async publishCarousel(mediaIds: string[], caption: string): Promise<string> {
    try {
      const { data: carousel } = await axios.post(
        `${GRAPH_API}/${this.businessAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: mediaIds,
          caption,
        },
        { params: { access_token: this.accessToken } },
      );

      const { data: published } = await axios.post(
        `${GRAPH_API}/${this.businessAccountId}/media_publish`,
        { creation_id: carousel.id },
        { params: { access_token: this.accessToken } },
      );

      return published.id;
    } catch (error) {
      logger.error({ error }, 'Failed to publish Instagram carousel');
      throw error;
    }
  }

  async getMediaInsights(mediaId: string): Promise<Record<string, unknown>> {
    try {
      const { data } = await axios.get(
        `${GRAPH_API}/${mediaId}/insights`,
        {
          params: {
            metric: 'plays,reach,saved',
            access_token: this.accessToken,
          },
        },
      );
      return data;
    } catch (error) {
      logger.error({ error }, 'Failed to get media insights');
      return {};
    }
  }
}

export const instagram = new InstagramPublisher();
