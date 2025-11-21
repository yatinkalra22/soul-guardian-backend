import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { WorkOS } from '@workos-inc/node';
import { Env } from '../raindrop.gen';
import { createJWT } from '../../utils/jwt';

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * JWT-based auth exchange endpoint - receives code from frontend, exchanges it for JWT cookie
 * This is the PRIMARY auth endpoint following your requirements
 * POST /auth/exchange
 */
authRoutes.post('/exchange', async (c) => {
  const body = await c.req.json();
  console.log('Received body:', body)
  const code = body.code;

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  try {
    // Initialize WorkOS client
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Exchange code for WorkOS user profile
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: c.env.WORKOS_CLIENT_ID,
      code,
    });

    // Ensure user exists in database (upsert)
    await c.env.SMART_DB.executeQuery({
      sqlQuery: `INSERT INTO users (id, email, first_name, last_name)
                 VALUES ('${user.id}', '${user.email}', '${user.firstName || ''}', '${user.lastName || ''}')
                 ON CONFLICT(id) DO UPDATE SET
                   email = '${user.email}',
                   first_name = '${user.firstName || ''}',
                   last_name = '${user.lastName || ''}'`,
    });

    // Create JWT with the WorkOS user ID (which is our database user ID)
    const dbUserId = user.id;
    const jwtSecret = c.env.WORKOS_COOKIE_PASSWORD;
    const token = await createJWT(dbUserId, jwtSecret);

    // Set JWT as secure HttpOnly cookie
    // Note: secure should be true in production (HTTPS), false in local dev (HTTP)
    const isProduction = c.req.url.startsWith('https://');

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: isProduction, // Only secure on HTTPS
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours (matching JWT expiry)
    });

    console.log('Set auth_token cookie:', {
      tokenLength: token.length,
      isProduction,
      url: c.req.url
    });

    // Return success response
    return c.json({
      success: true,
      message: 'Authentication successful',
    });
  } catch (error: any) {
    console.error('Auth exchange error:', error);
    return c.json({ error: 'Authentication failed', details: error.message }, 500);
  }
});

/**
 * LEGACY: Callback endpoint - receives code from frontend, exchanges it for access token
 * This returns the access token to the frontend (less secure than JWT cookie approach)
 * Kept for backward compatibility
 */
authRoutes.post('/callback', async (c) => {
  const body = await c.req.json();
  const code = body.code;

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  try {
    // Initialize WorkOS client with API key
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Exchange code for user and access token
    const { user, accessToken, refreshToken } = await workos.userManagement.authenticateWithCode({
      clientId: c.env.WORKOS_CLIENT_ID,
      code,
    });

    // Store user in database (INSERT OR REPLACE to update if exists)
    await c.env.SMART_DB.executeQuery({
      sqlQuery: `INSERT INTO users (id, email, first_name, last_name)
                 VALUES ('${user.id}', '${user.email}', '${user.firstName || ''}', '${user.lastName || ''}')
                 ON CONFLICT(id) DO UPDATE SET
                   email = '${user.email}',
                   first_name = '${user.firstName || ''}',
                   last_name = '${user.lastName || ''}'`,
    });

    // Return user info and access token to frontend
    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Auth callback error:', error);
    return c.json({ error: 'Authentication failed', details: error.message }, 500);
  }
});

/**
 * DEPRECATED: GET callback - use POST /callback instead
 */
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  try {
    // Initialize WorkOS client with API key
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Exchange code for user and session
    const { user, accessToken, refreshToken, sealedSession } = await workos.userManagement.authenticateWithCode({
      clientId: c.env.WORKOS_CLIENT_ID,
      code,
      session: {
        sealSession: true,
        cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
      },
    });

    // Store user in database if not exists
    await c.env.SMART_DB.executeQuery({
      sqlQuery: `INSERT OR IGNORE INTO users (id, email, first_name, last_name)
                 VALUES ('${user.id}', '${user.email}', '${user.firstName || ''}', '${user.lastName || ''}')`,
    });

    // Set secure HTTP-only cookie with sealed session (if present)
    if (sealedSession) {
      setCookie(c, 'wos-session', sealedSession, {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    // Return user info and access token to frontend
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      accessToken, // Frontend can use this for API calls
    });
  } catch (error: any) {
    console.error('Auth callback error:', error);
    return c.json({ error: 'Authentication failed', details: error.message }, 500);
  }
});

/**
 * Get current user info
 */
authRoutes.get('/me', async (c) => {
  const session = getCookie(c, 'wos-session');

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Verify and unseal the session
    const result = await workos.userManagement.authenticateWithSessionCookie({
      sessionData: session,
      cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
    });

    if (!result.authenticated) {
      return c.json({ error: 'Invalid session' }, 401);
    }

    const { user } = result;

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: any) {
    console.error('Session verification error:', error);
    return c.json({ error: 'Invalid session' }, 401);
  }
});

/**
 * Logout - clear authentication cookies
 */
authRoutes.post('/logout', async (c) => {
  // Clear JWT cookie
  setCookie(c, 'auth_token', '', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 0,
  });

  // Also clear legacy session cookie if present
  setCookie(c, 'wos-session', '', {
    path: '/',
    maxAge: 0,
  });

  return c.json({ success: true, message: 'Logged out successfully' });
});

export default authRoutes;
