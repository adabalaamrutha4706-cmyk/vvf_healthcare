import { query } from './db';

export const logAudit = async (
  userId: number | null,
  actionType: string,
  entityType: string,
  entityId: number,
  description: string,
  metadata?: any
) => {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      actionType,
      entityType,
      entityId,
      description,
      metadata ? JSON.stringify(metadata) : null
    ]);
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
};
