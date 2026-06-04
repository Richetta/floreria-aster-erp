import { randomUUID } from 'crypto';

export async function logAudit(
  trx: any,
  data: {
    business_id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    details: Record<string, any>;
    ip_address?: string | null;
    user_agent?: string | null;
  }
) {
  await trx
    .insertInto('audit_logs')
    .values({
      id: randomUUID(),
      business_id: data.business_id,
      user_id: data.user_id,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      details: data.details, // Kysely automatically serializes this object to JSON for jsonb
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      created_at: new Date()
    } as any)
    .execute();
}
