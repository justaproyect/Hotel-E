import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const GRAPH_API = 'https://graph.facebook.com/v19.0';

export class FacebookPublisher {
  private accessToken: string;
  private pageId: string;

  constructor() {
    this.accessToken = config.facebook.accessToken;
    this.pageId = config.facebook.pageId;
  }

  async publishMarketplaceListing(params: {
    name: string;
    description: string;
    price: number;
    images: string[];
    categoryId?: string;
  }): Promise<string> {
    try {
      const { data } = await axios.post(
        `${GRAPH_API}/${this.pageId}/marketplace_listings`,
        {
          name: params.name,
          description: params.description,
          price: params.price,
          currency: config.hotel.currency,
          images: params.images,
          category_id: params.categoryId || config.facebook.marketplaceCategoryId,
        },
        { params: { access_token: this.accessToken } },
      );
      logger.info({ listingId: data.id }, 'Marketplace listing published');
      return data.id;
    } catch (error) {
      logger.error({ error }, 'Failed to publish marketplace listing');
      throw error;
    }
  }

  async publishFeedPost(params: {
    message: string;
    images?: string[];
    videoUrl?: string;
  }): Promise<string> {
    try {
      let postId: string;

      if (params.videoUrl) {
        const { data } = await axios.post(
          `${GRAPH_API}/${this.pageId}/videos`,
          {
            file_url: params.videoUrl,
            description: params.message,
          },
          { params: { access_token: this.accessToken } },
        );
        postId = data.id;
      } else if (params.images && params.images.length > 0) {
        const { data } = await axios.post(
          `${GRAPH_API}/${this.pageId}/photos`,
          {
            url: params.images[0],
            caption: params.message,
            published: true,
          },
          { params: { access_token: this.accessToken } },
        );
        postId = data.id;
      } else {
        const { data } = await axios.post(
          `${GRAPH_API}/${this.pageId}/feed`,
          { message: params.message },
          { params: { access_token: this.accessToken } },
        );
        postId = data.id;
      }

      logger.info({ postId }, 'Facebook post published');
      return postId;
    } catch (error) {
      logger.error({ error }, 'Failed to publish Facebook post');
      throw error;
    }
  }

  async deletePost(postId: string): Promise<void> {
    try {
      await axios.delete(`${GRAPH_API}/${postId}`, {
        params: { access_token: this.accessToken },
      });
      logger.info({ postId }, 'Facebook post deleted');
    } catch (error) {
      logger.error({ error }, 'Failed to delete Facebook post');
    }
  }
}

export const facebook = new FacebookPublisher();
