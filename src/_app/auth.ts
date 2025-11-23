import { WorkOS } from '@workos-inc/node';
import { getCookie } from 'hono/cookie';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { buildUserUpsertQuery } from '../utils/sql';

/**
 * JWT/Session verification middleware
 * Supports three authentication methods (in priority order):
 * 1. Custom JWT in auth_token cookie (HS256 signed, created during login)
 * 2. WorkOS access token in Authorization header (RS256 signed, for API calls)
 * 3. WorkOS sealed session in wos-session cookie (for session-based auth)
 */
export const verify = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  const sessionCookie = getCookie(c, 'wos-session');
  const customAuthToken = getCookie(c, 'auth_token');

  // Try custom JWT cookie first (HS256 signed)
  if (customAuthToken) {
    console.log('Found auth_token cookie, attempting verification...');
    try {
      const { verifyJWT } = await import('../utils/jwt');
      const secret = c.env.WORKOS_COOKIE_PASSWORD;
      const payload = await verifyJWT(customAuthToken, secret);

      // Extract user info from custom JWT (sub is the user ID)
      const userId = payload.sub;
      const userEmail = payload.email;
      const userFirstName = payload.firstName;
      const userLastName = payload.lastName;

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
      console.error('Custom JWT verification failed:', error.message || error);
      // Fall through to try other auth methods
    }
  } else {
    console.log('No auth_token cookie found');
  }

  // Try WorkOS access token (RS256 signed)
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
        sqlQuery: buildUserUpsertQuery({
          id: userId,
          email: userEmail,
          firstName: userFirstName,
          lastName: userLastName,
        }),
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

      // Load and verify the sealed session
      const session = workos.userManagement.loadSealedSession({
        sessionData: sessionCookie,
        cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
      });

      const authResult = await session.authenticate();

      if (!authResult.authenticated) {
        throw new Error(`Session authentication failed: ${authResult.reason}`);
      }

      const user = authResult.user;
      if (!user) {
        throw new Error('No user found in authenticated session');
      }

      // Ensure user exists in database (auto-create if not)
      await c.env.SMART_DB.executeQuery({
        sqlQuery: buildUserUpsertQuery({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }),
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
