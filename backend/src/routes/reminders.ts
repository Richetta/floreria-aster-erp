import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../db';

export const remindersRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // GET UPCOMING BIRTHDAYS/ANNIVERSARIES
  // ============================================

  fastify.get('/birthdays', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { days_ahead = '30' } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const today = new Date();
    const ahead = parseInt(days_ahead);

    // Get customers with birthdays/anniversaries
    const customers = await db
      .selectFrom('customers')
      .select([
        'id',
        'name',
        'phone',
        'email',
        'birthday',
        'anniversary',
        'important_date_name',
        'important_date'
      ])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', true)
      .execute();

    const reminders: any[] = [];

    customers.forEach(c => {
      // Check birthday
      if (c.birthday) {
        const birthday = new Date(c.birthday);
        const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        
        if (nextBirthday < today) {
          nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= ahead) {
          reminders.push({
            type: 'birthday',
            customer_id: c.id,
            customer_name: c.name,
            phone: c.phone,
            email: c.email,
            date: nextBirthday.toISOString(),
            days_until: daysUntil,
            message: `🎂 Cumpleaños de ${c.name}`,
            is_today: daysUntil === 0,
            is_soon: daysUntil <= 7
          });
        }
      }

      // Check anniversary
      if (c.anniversary) {
        const anniversary = new Date(c.anniversary);
        const nextAnniversary = new Date(today.getFullYear(), anniversary.getMonth(), anniversary.getDate());
        
        if (nextAnniversary < today) {
          nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= ahead) {
          reminders.push({
            type: 'anniversary',
            customer_id: c.id,
            customer_name: c.name,
            phone: c.phone,
            email: c.email,
            date: nextAnniversary.toISOString(),
            days_until: daysUntil,
            message: `💍 Aniversario de ${c.name}`,
            is_today: daysUntil === 0,
            is_soon: daysUntil <= 7
          });
        }
      }

      // Check important date
      if (c.important_date && c.important_date_name) {
        const importantDate = new Date(c.important_date);
        const nextImportantDate = new Date(today.getFullYear(), importantDate.getMonth(), importantDate.getDate());
        
        if (nextImportantDate < today) {
          nextImportantDate.setFullYear(nextImportantDate.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((nextImportantDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= ahead) {
          reminders.push({
            type: 'important_date',
            customer_id: c.id,
            customer_name: c.name,
            phone: c.phone,
            email: c.email,
            date: nextImportantDate.toISOString(),
            days_until: daysUntil,
            message: `📅 ${c.important_date_name} de ${c.name}`,
            is_today: daysUntil === 0,
            is_soon: daysUntil <= 7
          });
        }
      }
    });

    // Sort by days until
    reminders.sort((a, b) => a.days_until - b.days_until);

    return reply.send({
      total: reminders.length,
      today: reminders.filter(r => r.is_today).length,
      this_week: reminders.filter(r => r.is_soon).length,
      reminders
    });
  });

  // ============================================
  // GET DEBT REMINDERS
  // ============================================

  fastify.get('/debts', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { min_amount = '0' } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const customers = await db
      .selectFrom('customers')
      .select([
        'id',
        'name',
        'phone',
        'email',
        'debt_balance',
        'last_order_date',
        'total_orders'
      ])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', true)
      .where('debt_balance', '>', 0)
      .where('debt_balance', '>=', parseFloat(min_amount))
      .orderBy('debt_balance', 'desc')
      .execute();

    const reminders = customers.map(c => ({
      type: 'debt',
      customer_id: c.id,
      customer_name: c.name,
      phone: c.phone,
      email: c.email,
      debt_amount: Number(c.debt_balance),
      last_order_date: c.last_order_date,
      total_orders: Number(c.total_orders),
      message: `💰 ${c.name} debe $${Number(c.debt_balance).toLocaleString()}`,
      urgency: Number(c.debt_balance) > 50000 ? 'high' : Number(c.debt_balance) > 10000 ? 'medium' : 'low'
    }));

    return reply.send({
      total: reminders.length,
      total_amount: reminders.reduce((sum, r) => sum + r.debt_amount, 0),
      by_urgency: {
        high: reminders.filter(r => r.urgency === 'high').length,
        medium: reminders.filter(r => r.urgency === 'medium').length,
        low: reminders.filter(r => r.urgency === 'low').length
      },
      reminders
    });
  });

  // ============================================
  // SEND WHATSAPP REMINDER
  // ============================================

  fastify.post('/send-whatsapp', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      phone: z.string(),
      message: z.string(),
      type: z.enum(['birthday', 'anniversary', 'important_date', 'debt', 'custom'])
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      // Log the reminder
      const reminder = await db
        .insertInto('audit_logs')
        .values({
          id: crypto.randomUUID(),
          business_id: user.business_id,
          user_id: user.sub,
          action: 'whatsapp_reminder_sent',
          entity_type: 'reminder',
          details: {
            phone: body.phone,
            message: body.message,
            type: body.type
          },
          created_at: new Date()
        })
        .returningAll()
        .executeTakeFirst();

      // Generate WhatsApp click-to-chat URL
      const whatsappUrl = `https://wa.me/${body.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(body.message)}`;

      return reply.send({
        success: true,
        reminder_id: reminder?.id,
        whatsapp_url: whatsappUrl,
        message: 'WhatsApp URL generated.'
      });
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error sending reminder' });
    }
  });

  // ============================================
  // SEND EMAIL REMINDER
  // ============================================

  fastify.post('/send-email', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      email: z.string().email(),
      subject: z.string(),
      message: z.string(),
      type: z.enum(['birthday', 'anniversary', 'important_date', 'debt', 'custom'])
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      const reminder = await db
        .insertInto('audit_logs')
        .values({
          id: crypto.randomUUID(),
          business_id: user.business_id,
          user_id: user.sub,
          action: 'email_reminder_sent',
          entity_type: 'reminder',
          details: {
            email: body.email,
            subject: body.subject,
            message: body.message,
            type: body.type
          },
          created_at: new Date()
        })
        .returningAll()
        .executeTakeFirst();

      return reply.send({
        success: true,
        reminder_id: reminder?.id,
        message: 'Email logged.'
      });
    } catch (error: any) {
      console.error('Error sending email:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error sending reminder' });
    }
  });

  // ============================================
  // SEND BULK REMINDERS
  // ============================================

  fastify.post('/send-bulk', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role !== 'admin') {
          return reply.code(403).send({ error: 'Only admins can send bulk reminders' });
        }
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;

    const schema = z.object({
      customer_ids: z.array(z.string().uuid()),
      message_template: z.string(),
      method: z.enum(['whatsapp', 'email', 'both'])
    });

    try {
      const body = schema.parse(request.body);

      await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

      // Get customer details
      const customers = await db
        .selectFrom('customers')
        .select(['id', 'name', 'phone', 'email'])
        .where('id', 'in', body.customer_ids)
        .where('deleted_at', 'is', null)
        .execute();

      const results = {
        total: customers.length,
        sent: 0,
        failed: 0,
        reminders: [] as any[]
      };

      for (const customer of customers) {
        try {
          const message = body.message_template.replace('{{name}}', customer.name);

          // Log reminder
          await db
            .insertInto('audit_logs')
            .values({
              id: crypto.randomUUID(),
              business_id: user.business_id,
              user_id: user.sub,
              action: `${body.method}_bulk_reminder_sent`,
              entity_type: 'reminder',
              details: {
                customer_id: customer.id,
                customer_name: customer.name,
                message
              },
              created_at: new Date()
            })
            .execute();

          results.sent++;
          results.reminders.push({
            customer_id: customer.id,
            customer_name: customer.name,
            status: 'sent',
            method: body.method
          });
        } catch (error) {
          results.failed++;
          results.reminders.push({
            customer_id: customer.id,
            customer_name: customer.name,
            status: 'failed',
            method: body.method,
            error: error
          });
        }
      }

      return reply.send(results);
    } catch (error: any) {
      console.error('Error sending bulk reminders:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation error', details: error.errors });
      }
      return reply.status(500).send({ error: 'Error sending bulk reminders' });
    }
  });

  // ============================================
  // GET REMINDER HISTORY
  // ============================================

  fastify.get('/history', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
      }
    }]
  }, async (request, reply) => {
    const user = request.user as any;
    const { limit = '50' } = request.query as any;

    await sql`SET LOCAL app.current_business_id = ${user.business_id}`.execute(db);

    const logs = await db
      .selectFrom('audit_logs')
      .selectAll()
      .where('business_id', '=', user.business_id)
      .where('action', 'like', '%reminder%')
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .execute();

    return reply.send(logs.map(log => ({
      id: log.id,
      action: log.action,
      customer_name: (log.details as any)?.customer_name || (log.details as any)?.name || 'N/A',
      method: log.action.includes('whatsapp') ? 'WhatsApp' : log.action.includes('email') ? 'Email' : 'Unknown',
      message: (log.details as any)?.message || 'N/A',
      created_at: log.created_at
    })));
  });
};

export default remindersRoutes;
