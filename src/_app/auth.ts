import { WorkOS } from '@workos-inc/node';
import { getCookie } from 'hono/cookie';
import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * JWT/Session verification middleware
 * Supports both:
 * 1. WorkOS access token in Authorization header (for API calls from frontend)
 * 2. WorkOS sealed session in cookie (for session-based auth)
 */
export const verify = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const sessionCookie = getCookie(c, 'wos-session');

  // Try access token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      // Validate token is not empty
      if (!token || token.trim() === '') {
        return c.json({ error: 'Unauthorized - Invalid token' }, 401);
      }

      const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
        apiHostname: 'api.workos.com',
      });

      // Verify the access token as a JWT using WorkOS JWKS
      const jwksUrl = workos.userManagement.getJwksUrl(c.env.WORKOS_CLIENT_ID);
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));

      const { payload } = await jwtVerify(token, JWKS, {
        audience: c.env.WORKOS_CLIENT_ID,
      });

      // Extract user info from JWT payload
      const userId = payload.sub as string;
      const userEmail = payload.email as string;
      const userFirstName = payload.first_name as string | undefined;
      const userLastName = payload.last_name as string | undefined;

      // Ensure user exists in database (auto-create if not)
      await c.env.SMART_DB.executeQuery({
        sqlQuery: `INSERT INTO users (id, email, first_name, last_name)
                   VALUES ('${userId}', '${userEmail}', '${userFirstName || ''}', '${userLastName || ''}')
                   ON CONFLICT(id) DO UPDATE SET
                     email = '${userEmail}',
                     first_name = '${userFirstName || ''}',
                     last_name = '${userLastName || ''}'`,
      });

      // Set user context
      c.set('jwt', {
        payload: {
          sub: userId,
          email: userEmail,
          firstName: userFirstName,
          lastName: userLastName,
        }
      });

      return await next();
    } catch (error: any) {
      console.error('Access token verification failed:', error);
      return c.json({ error: 'Unauthorized - Invalid access token' }, 401);
    }
  }

  // Try session cookie as fallback
  if (sessionCookie) {
    try {
      const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
        apiHostname: 'api.workos.com',
      });

      // Verify and unseal the session
      const result = await workos.userManagement.authenticateWithSessionCookie({
        sessionData: sessionCookie,
        cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
      });

      if (!result.authenticated) {
        throw new Error('Session authentication failed');
      }

      const { user } = result;

      // Ensure user exists in database (auto-create if not)
      await c.env.SMART_DB.executeQuery({
        sqlQuery: `INSERT INTO users (id, email, first_name, last_name)
                   VALUES ('${user.id}', '${user.email}', '${user.firstName || ''}', '${user.lastName || ''}')
                   ON CONFLICT(id) DO UPDATE SET
                     email = '${user.email}',
                     first_name = '${user.firstName || ''}',
                     last_name = '${user.lastName || ''}'`,
      });

      // Set user context
      c.set('jwt', {
        payload: {
          sub: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });

      return await next();
    } catch (error: any) {
      console.error('Session verification failed:', error);
      return c.json({ error: 'Unauthorized - Invalid session' }, 401);
    }
  }

  // No valid auth found
  return c.json({ error: 'Unauthorized - Missing authentication' }, 401);
};

/**
 * Simple authorization middleware
 * Just checks if user was set by verify
 */
export const authorize = async (c: any, next: any) => {
  const jwt = c.get('jwt');

  if (!jwt || !jwt.payload || !jwt.payload.sub) {
    return c.json({ error: 'Unauthorized - No valid user context' }, 401);
  }

  await next();
};
