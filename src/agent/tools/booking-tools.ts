import { db } from '../../database/connection';
import { rooms, bookings } from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

export async function checkAvailability(
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<string> {
  try {
    const availableRooms = await db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.status, 'available'),
          sql`${rooms.capacity} >= ${guests}`,
          sql`${rooms.id} NOT IN (
            SELECT room_id FROM bookings
            WHERE status = 'confirmed'
            AND check_in < ${checkOut}::timestamp
            AND check_out > ${checkIn}::timestamp
          )`,
        ),
      );

    if (availableRooms.length === 0) {
      return 'No hay habitaciones disponibles para esas fechas.';
    }

    return availableRooms
      .map(
        (r) =>
          `${r.name}: $${r.pricePerNight} MXN/noche - ${r.description} (Capacidad: ${r.capacity} personas)`,
      )
      .join('\n');
  } catch (error) {
    logger.error({ error }, 'Error checking availability');
    return 'Error al verificar disponibilidad.';
  }
}

export async function createBooking(params: {
  roomId: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}): Promise<string> {
  try {
    const room = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, params.roomId))
      .then((r) => r[0]);

    if (!room) return 'Habitación no encontrada.';

    const checkInDate = new Date(params.checkIn);
    const checkOutDate = new Date(params.checkOut);
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const total = parseFloat(room.pricePerNight.toString()) * nights;

    const [booking] = await db
      .insert(bookings)
      .values({
        roomId: params.roomId,
        guestName: params.guestName,
        guestEmail: params.guestEmail,
        guestPhone: params.guestPhone,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: params.guests,
        totalAmount: total.toString(),
        status: 'confirmed',
      })
      .returning();

    return `✅ Reserva confirmada #${booking.id}
Habitación: ${room.name}
Fecha: ${params.checkIn} al ${params.checkOut}
Total: $${total} MXN
Estado: Confirmada`;
  } catch (error) {
    logger.error({ error }, 'Error creating booking');
    return 'Error al crear la reserva. Intenta de nuevo.';
  }
}

export async function listRooms(): Promise<string> {
  try {
    const allRooms = await db.select().from(rooms);
    return allRooms
      .map(
        (r) =>
          `🏠 ${r.name} (${r.type})\n💰 $${r.pricePerNight} MXN/noche\n👥 Capacidad: ${r.capacity} personas\n📝 ${r.description}\n`,
      )
      .join('\n---\n');
  } catch (error) {
    logger.error({ error }, 'Error listing rooms');
    return 'Error al obtener habitaciones.';
  }
}

export async function getBookingStatus(
  bookingId?: number,
  email?: string,
): Promise<string> {
  try {
    const conditions = [];
    if (bookingId) conditions.push(eq(bookings.id, bookingId));
    if (email) conditions.push(eq(bookings.guestEmail, email));

    const result = await db
      .select()
      .from(bookings)
      .where(and(...conditions));

    if (result.length === 0) return 'No se encontraron reservas.';

    return result
      .map(
        (b) =>
          `📋 Reserva #${b.id}
Estado: ${b.status}
Check-in: ${b.checkIn.toISOString().split('T')[0]}
Check-out: ${b.checkOut.toISOString().split('T')[0]}
Total: $${b.totalAmount} MXN`,
      )
      .join('\n\n');
  } catch (error) {
    logger.error({ error }, 'Error getting booking status');
    return 'Error al consultar reserva.';
  }
}
