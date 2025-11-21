import { getCookie } from 'hono/cookie';
import { verifyJWT, getUserIdFromPayload } from '../utils/jwt';

/**
 * Authentication middleware
 * Verifies the JWT from the auth_token cookie and attaches the userId to the request context
 */
export async function authMiddleware(c: any, next: any) {
  // Get the auth_token cookie
  const token = getCookie(c, 'auth_token');

  if (!token) {
    return c.json({ error: 'Unauthorized - Missing authentication token' }, 401);
  }

  try {
    // Get JWT secret from environment
    const secret = c.env.WORKOS_COOKIE_PASSWORD;

    // Verify the JWT
    const payload = await verifyJWT(token, secret);

    // Extract user ID from payload
    const userId = getUserIdFromPayload(payload);

    // Attach user ID to request context
    c.set('userId', userId);
    c.set('user', { id: userId });

    // Continue to next middleware/handler
    return await next();
  } catch (error: any) {
    console.error('JWT verification failed:', error.message);
    return c.json({ error: 'Unauthorized - Invalid or expired token' }, 401);
  }
}

/**
 * Optional authentication middleware
 * Verifies the JWT if present, but allows the request to continue even if not authenticated
 * Useful for routes that have different behavior for authenticated vs unauthenticated users
 */
export async function optionalAuthMiddleware(c: any, next: any) {
  // Get the auth_token cookie
  const token = getCookie(c, 'auth_token');

  if (token) {
    try {
      // Get JWT secret from environment
      const secret = c.env.WORKOS_COOKIE_PASSWORD;

      // Verify the JWT
      const payload = await verifyJWT(token, secret);

      // Extract user ID from payload
      const userId = getUserIdFromPayload(payload);

      // Attach user ID to request context
      c.set('userId', userId);
      c.set('user', { id: userId });
    } catch (error: any) {
      // Don't fail the request, just log the error
      console.warn('Optional auth JWT verification failed:', error.message);
    }
  }

  // Continue to next middleware/handler regardless of auth status
  return await next();
}
