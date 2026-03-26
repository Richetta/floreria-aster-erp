import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// JWT AUTHENTICATION HOOK
// ============================================

/**
 * Fastify preHandler hook that verifies JWT token.
 * Attach to routes or register globally.
 * Returns a Promise that resolves if auth succeeds, rejects if it fails.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    // Auth successful, continue
  } catch (err: any) {
    // Auth failed, send 401 and throw to stop execution
    reply.code(401).send({ error: 'Unauthorized', message: err.message });
    throw new Error('Unauthorized');
  }
}

// ============================================
// ROLE-BASED AUTHORIZATION
// ============================================

type UserRole = 'admin' | 'seller' | 'driver' | 'viewer';

/**
 * Returns a preHandler hook that checks if the authenticated user
 * has one of the allowed roles.
 * 
 * Usage:
 *   preHandler: [authenticate, requireRole(['admin', 'seller'])]
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    
    if (!user || !user.role) {
      return reply.code(403).send({ error: 'Forbidden: role not found in token' });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.code(403).send({ 
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }
  };
}
