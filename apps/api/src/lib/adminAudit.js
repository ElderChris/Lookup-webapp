// =============================================================================
// src/lib/adminAudit.js — Helper per audit log admin
// =============================================================================
// Ogni operazione critica eseguita da un admin viene registrata nella
// tabella `admin_audit_log`. In caso di errore del log, l'operazione
// principale continua (best-effort logging): non vogliamo che un problema
// di persistenza log bloccchi il lavoro dell'admin.
//
// Uso:
//   import { logAdminAction } from '../lib/adminAudit.js';
//   await logAdminAction(fastify, request, {
//     adminId,
//     action: 'user.delete',
//     targetType: 'user',
//     targetId: id,
//     payload: { reason: 'spam' },
//   });
// =============================================================================

/**
 * Registra un'azione admin nel log audit.
 * Best-effort: se INSERT fallisce, log warning e continua.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {object} entry
 * @param {string} entry.adminId
 * @param {string} entry.action - convenzione dot-separated (es. 'user.delete', 'post.clear_reports')
 * @param {string} [entry.targetType]
 * @param {string} [entry.targetId] - stringificato per unificare int/cuid
 * @param {object} [entry.payload] - dettagli aggiuntivi (sanitizzati, no password/tokens)
 */
export async function logAdminAction(fastify, request, entry) {
  try {
    const ipAddress =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.ip || null;
    const userAgent = (request.headers['user-agent'] || '').slice(0, 500) || null;
    await fastify.prisma.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        targetType: entry.targetType || null,
        targetId: entry.targetId ? String(entry.targetId) : null,
        payload: entry.payload ? sanitizePayload(entry.payload) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    request.log?.warn({ err: err.message, action: entry.action }, '[admin-audit] log failed');
    // Non rilanciare: log e' best-effort
  }
}

/**
 * Rimuove campi sensibili dal payload prima di persisterlo.
 * Non vogliamo password/tokens nel log.
 */
function sanitizePayload(payload) {
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (lower.includes('password') || lower.includes('token') || lower.includes('secret')) {
      clean[key] = '[REDACTED]';
    } else if (value === undefined) {
      // salta undefined per non rompere JSON.stringify
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
