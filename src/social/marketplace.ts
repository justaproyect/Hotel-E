import { db } from '../database/connection';
import { rooms } from '../database/schema';
import { eq } from 'drizzle-orm';
import { facebook } from './facebook';
import { logger } from '../utils/logger';

export class MarketplaceManager {
  async publishRoom(roomId: number): Promise<string> {
    try {
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId));

      if (!room) throw new Error(`Room ${roomId} not found`);

      const listingId = await facebook.publishMarketplaceListing({
        name: `🏨 ${room.name} - ${room.type}`,
        description: `${room.description}\n\nCapacidad: ${room.capacity} personas\nServicios: ${(room.amenities || []).join(', ')}\n\n📍 ${configHotel()}`,
        price: parseFloat(room.pricePerNight.toString()),
        images: room.images || [],
      });

      await db
        .update(rooms)
        .set({ marketplaceListingId: listingId, updatedAt: new Date() })
        .where(eq(rooms.id, roomId));

      logger.info({ roomId, listingId }, 'Room published to Marketplace');
      return listingId;
    } catch (error) {
      logger.error({ error }, 'Failed to publish room to Marketplace');
      throw error;
    }
  }

  async updateRoomListing(roomId: number): Promise<void> {
    try {
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId));

      if (!room?.marketplaceListingId) {
        await this.publishRoom(roomId);
        return;
      }

      await facebook.deletePost(room.marketplaceListingId);
      await this.publishRoom(roomId);
    } catch (error) {
      logger.error({ error }, 'Failed to update marketplace listing');
    }
  }

  async publishAllAvailableRooms(): Promise<void> {
    try {
      const availableRooms = await db
        .select()
        .from(rooms)
        .where(eq(rooms.status, 'available'));

      for (const room of availableRooms) {
        await this.publishRoom(room.id);
      }
      logger.info(`Published ${availableRooms.length} rooms to Marketplace`);
    } catch (error) {
      logger.error({ error }, 'Failed to publish all rooms');
    }
  }
}

function configHotel(): string {
  const { hotel } = require('../../config').config;
  return `${hotel.name} - ${hotel.address} | Tel: ${hotel.phone}`;
}

export const marketplace = new MarketplaceManager();
