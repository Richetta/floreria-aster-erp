import { FastifyPluginAsync } from 'fastify';
import { google } from 'googleapis';
import { db } from '../db/index.js';
import { sql } from 'kysely';
import { config } from '../config/index.js';

// Use OAuth2 from googleapis to avoid type mismatches
const OAuth2Client = google.auth.OAuth2;

// ============================================
// GOOGLE CALENDAR SERVICE
// ============================================

/**
 * Mapeo de delivery_time_slot → horas de inicio y fin
 */
const TIME_SLOT_MAP: Record<string, { start: string; end: string } | null> = {
  morning:   { start: '09:00', end: '13:00' },
  afternoon: { start: '14:00', end: '18:00' },
  evening:   { start: '18:00', end: '21:00' },
  allday:    null, // Evento de día completo
};

/**
 * Colores de Google Calendar (colorId):
 * 2=Sage(verde), 9=Blueberry(azul), 6=Tangerine(naranja), 11=Tomato(rojo)
 */
const DELIVERY_COLOR_ID = '9';   // azul = delivery a domicilio
const PICKUP_COLOR_ID   = '2';   // verde = retiro en local

/**
 * Crea o actualiza un evento de Google Calendar para un pedido.
 * @returns el google_event_id creado/actualizado, o null si falla (no crítico)
 */
export async function syncOrderToGoogleCalendar(
  orderId: string,
  userId: string
): Promise<string | null> {
  try {
    // 1. Obtener el usuario con sus tokens de Google
    const userRow = await db
      .selectFrom('users')
      .select([
        'id',
        'google_access_token' as any,
        'google_refresh_token' as any,
        'google_calendar_enabled' as any,
      ])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!userRow) {
      console.warn('[GCal] Usuario no encontrado:', userId);
      return null;
    }

    const u = userRow as any;

    // Si el usuario no habilitó la integración o no tiene tokens, salir
    if (!u.google_calendar_enabled || !u.google_refresh_token) {
      return null;
    }

    // 2. Configurar OAuth2 client con los tokens guardados
    const oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
    oauth2Client.setCredentials({
      access_token: u.google_access_token,
      refresh_token: u.google_refresh_token,
    });

    // Actualizar access_token si se refrescó automáticamente
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await db
          .updateTable('users')
          .set({ google_access_token: tokens.access_token } as any)
          .where('id', '=', userId)
          .execute();
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Obtener el pedido con sus datos
    const order = await db
      .selectFrom('orders')
      .selectAll()
      .where('id', '=', orderId)
      .executeTakeFirst();

    if (!order) {
      console.warn('[GCal] Pedido no encontrado:', orderId);
      return null;
    }

    const o = order as any;
    const slot = TIME_SLOT_MAP[o.delivery_time_slot] || null;

    // Formatear la fecha de entrega (YYYY-MM-DD)
    const deliveryDate = o.delivery_date instanceof Date
      ? o.delivery_date.toISOString().split('T')[0]
      : String(o.delivery_date).split('T')[0];

    // Construir la descripción del evento
    const descLines: string[] = [
      `📦 Pedido #${o.order_number}`,
      `📞 Teléfono: ${o.customer_phone || o.contact_phone || 'Sin teléfono'}`,
      `💰 Total: $${Number(o.total_amount).toLocaleString('es-AR')}`,
      o.advance_payment > 0
        ? `✅ Seña: $${Number(o.advance_payment).toLocaleString('es-AR')}`
        : '',
      o.delivery_method === 'delivery'
        ? `📍 Dirección: ${o.delivery_address_street || o.delivery_address?.street || ''} ${o.delivery_address_number || o.delivery_address?.number || ''}`
        : `🏪 Retira en sucursal`,
      o.card_message ? `🌸 Tarjeta: "${o.card_message}"` : '',
      o.internal_notes ? `📋 Notas: ${o.internal_notes}` : '',
      '',
      `Gestionado desde Mi Jardín ERP`,
    ].filter(line => line !== '');

    const eventLocation = o.delivery_method === 'delivery'
      ? [
          o.delivery_address_street || o.delivery_address?.street,
          o.delivery_address_number || o.delivery_address?.number,
          o.delivery_address_city || o.delivery_address?.city || 'Córdoba',
        ].filter(Boolean).join(' ')
      : undefined;

    // Armar el objeto evento de Google Calendar
    const event: any = {
      summary: `🌸 ${o.delivery_method === 'delivery' ? 'Entrega' : 'Retiro'}: ${o.customer_name}`,
      description: descLines.join('\n'),
      location: eventLocation,
      colorId: o.delivery_method === 'delivery' ? DELIVERY_COLOR_ID : PICKUP_COLOR_ID,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email',  minutes: 24 * 60 }, // 24hs antes por email
          { method: 'popup',  minutes: 60 },       // 1hs antes notificación
        ],
      },
      extendedProperties: {
        private: {
          mijardin_order_id: orderId,
          mijardin_order_number: String(o.order_number),
        },
      },
    };

    // Determinar si es evento con horario o todo el día
    if (slot) {
      event.start = {
        dateTime: `${deliveryDate}T${slot.start}:00`,
        timeZone: 'America/Argentina/Cordoba',
      };
      event.end = {
        dateTime: `${deliveryDate}T${slot.end}:00`,
        timeZone: 'America/Argentina/Cordoba',
      };
    } else {
      event.start = { date: deliveryDate };
      event.end   = { date: deliveryDate };
    }

    let googleEventId: string;

    // 4. Crear o actualizar el evento
    if (o.google_event_id) {
      // Actualizar evento existente
      const updated = await calendar.events.update({
        calendarId: 'primary',
        eventId: o.google_event_id,
        requestBody: event,
      });
      googleEventId = updated.data.id!;
      console.log(`[GCal] ✅ Evento actualizado: ${googleEventId} (pedido #${o.order_number})`);
    } else {
      // Crear nuevo evento
      const created = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      googleEventId = created.data.id!;

      // Guardar el google_event_id en el pedido
      await db
        .updateTable('orders')
        .set({
          google_event_id: googleEventId,
          google_synced_at: new Date(),
        } as any)
        .where('id', '=', orderId)
        .execute();

      console.log(`[GCal] ✅ Evento creado: ${googleEventId} (pedido #${o.order_number})`);
    }

    return googleEventId;
  } catch (error: any) {
    // La sync de Google Calendar NUNCA debe romper el flujo principal
    console.error('[GCal] ⚠ Error en sincronización (non-fatal):', error.message);
    return null;
  }
}

/**
 * Elimina el evento de Google Calendar de un pedido cancelado.
 */
export async function deleteOrderFromGoogleCalendar(
  orderId: string,
  userId: string
): Promise<void> {
  try {
    const userRow = await db
      .selectFrom('users')
      .select([
        'google_access_token' as any,
        'google_refresh_token' as any,
        'google_calendar_enabled' as any,
      ])
      .where('id', '=', userId)
      .executeTakeFirst();

    const u = userRow as any;
    if (!u?.google_calendar_enabled || !u?.google_refresh_token) return;

    const order = await db
      .selectFrom('orders')
      .select(['google_event_id' as any])
      .where('id', '=', orderId)
      .executeTakeFirst();

    const googleEventId = (order as any)?.google_event_id;
    if (!googleEventId) return;

    const oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
    oauth2Client.setCredentials({
      access_token: u.google_access_token,
      refresh_token: u.google_refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({ calendarId: 'primary', eventId: googleEventId });

    await db
      .updateTable('orders')
      .set({ google_event_id: null, google_synced_at: null } as any)
      .where('id', '=', orderId)
      .execute();

    console.log(`[GCal] 🗑 Evento eliminado: ${googleEventId}`);
  } catch (error: any) {
    console.error('[GCal] ⚠ Error al eliminar evento (non-fatal):', error.message);
  }
}

// ============================================
// CALENDAR ROUTES
// ============================================

export const calendarRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /calendar/status ──────────────────────────────────────
  // Devuelve si el usuario tiene Google Calendar habilitado
  fastify.get('/status', async (request: any, reply) => {
    const user = request.user;

    const userRow = await db
      .selectFrom('users')
      .select([
        'google_calendar_enabled' as any,
        'google_refresh_token' as any,
      ])
      .where('id', '=', user.sub)
      .executeTakeFirst();

    const u = userRow as any;

    return reply.send({
      connected: !!(u?.google_refresh_token),
      enabled: !!(u?.google_calendar_enabled),
    });
  });

  // ── POST /calendar/connect ────────────────────────────────────
  // Recibe el auth-code de Google (Calendar scope) y guarda los tokens
  fastify.post('/connect', async (request: any, reply) => {
    const user = request.user;
    const { code } = request.body as { code: string };

    if (!code) {
      return reply.status(400).send({ error: 'Se requiere el código de autorización' });
    }

    try {
      const oauth2Client = new OAuth2Client(
        config.googleClientId,
        config.googleClientSecret,
        config.googleRedirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        return reply.status(400).send({
          error: 'No se recibió refresh_token. El usuario debe revocar el acceso en Google y volver a conectar.',
        });
      }

      // Guardar tokens y habilitar la integración
      await db
        .updateTable('users')
        .set({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expiry: tokens.expiry_date,
          google_calendar_enabled: true,
          updated_at: new Date(),
        } as any)
        .where('id', '=', user.sub)
        .execute();

      return reply.send({ success: true, message: 'Google Calendar conectado correctamente' });
    } catch (error: any) {
      console.error('[GCal] Error al conectar Calendar:', error);
      return reply.status(500).send({ error: 'Error al conectar con Google Calendar' });
    }
  });

  // ── POST /calendar/disconnect ─────────────────────────────────
  // Desvincula Google Calendar del usuario
  fastify.post('/disconnect', async (request: any, reply) => {
    const user = request.user;

    await db
      .updateTable('users')
      .set({
        google_calendar_enabled: false,
        updated_at: new Date(),
      } as any)
      .where('id', '=', user.sub)
      .execute();

    return reply.send({ success: true, message: 'Google Calendar desconectado' });
  });

  // ── PUT /calendar/settings ────────────────────────────────────
  // Actualiza configuración granular (qué eventos sincronizar)
  fastify.put('/settings', async (request: any, reply) => {
    const user = request.user;
    const {
      gcal_sync_on_create,
      gcal_sync_on_update,
      gcal_sync_on_cancel,
      gcal_reminder_24h_email,
      gcal_reminder_1h_popup,
    } = request.body as any;

    await db
      .updateTable('users')
      .set({
        gcal_sync_on_create: gcal_sync_on_create ?? true,
        gcal_sync_on_update: gcal_sync_on_update ?? true,
        gcal_sync_on_cancel: gcal_sync_on_cancel ?? false,
        gcal_reminder_24h_email: gcal_reminder_24h_email ?? true,
        gcal_reminder_1h_popup: gcal_reminder_1h_popup ?? true,
        updated_at: new Date(),
      } as any)
      .where('id', '=', user.sub)
      .execute();

    return reply.send({ success: true });
  });

  // ── POST /calendar/sync/:orderId ──────────────────────────────
  // Fuerza la sincronización manual de un pedido específico
  fastify.post('/sync/:orderId', async (request: any, reply) => {
    const user = request.user;
    const { orderId } = request.params as { orderId: string };

    await sql`SELECT set_config('app.current_business_id', ${user.business_id}, true)`.execute(db);

    const googleEventId = await syncOrderToGoogleCalendar(orderId, user.sub);

    if (googleEventId) {
      return reply.send({ success: true, google_event_id: googleEventId });
    } else {
      return reply.status(422).send({
        error: 'No se pudo sincronizar. Verificar que Google Calendar esté conectado.',
      });
    }
  });
};

export default calendarRoutes;
