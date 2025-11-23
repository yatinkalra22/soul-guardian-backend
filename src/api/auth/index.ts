import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { WorkOS } from '@workos-inc/node';
import { Env } from '../raindrop.gen';
import { createJWT } from '../../utils/jwt';
import { buildUserUpsertQuery } from '../../utils/sql';

/**
 * Authentication Routes with WorkOS Session Management
 *
 * AUTHENTICATION FLOW OVERVIEW:
 *
 * 1. LOGIN (POST /auth/exchange):
 *    - Receives OAuth code from frontend after user authenticates with Google/SSO
 *    - Exchanges code with WorkOS for user data and sealed session
 *    - Creates JWT token for application auth
 *    - Sets TWO cookies:
 *      a) auth_token: JWT for application authorization (24 hours)
 *      b) wos-session: Encrypted WorkOS session for SSO logout (7 days)
 *
 * 2. LOGOUT (POST /auth/logout):
 *    - Verifies user is authenticated via JWT
 *    - Clears both auth_token and wos-session cookies
 *    - Loads the sealed WorkOS session to extract session ID
 *    - Generates WorkOS logout URL to invalidate SSO session
 *    - Returns logout URL for frontend to redirect user
 *
 * WHY WE USE BOTH JWT AND WORKOS SESSION:
 * - JWT (auth_token): Fast, stateless auth for API requests
 * - WorkOS Session (wos-session): Required for proper SSO logout
 * - Without WorkOS session, users auto-login after logout (bad UX)
 *
 * KEY CHANGES MADE (2025):
 * - Added sealedSession request in authenticateWithCode()
 * - Store wos-session cookie during login
 * - Use loadSealedSession() in logout to generate proper logout URL
 * - Frontend must redirect to workosLogoutUrl to complete SSO logout
 */

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * JWT-based auth exchange endpoint - receives code from frontend, exchanges it for JWT cookie
 * This is the PRIMARY auth endpoint following your requirements
 * POST /auth/exchange
 *
 * This endpoint now properly integrates with WorkOS session management:
 * - Sets auth_token cookie (JWT) for application auth
 * - Sets wos-session cookie (sealed WorkOS session) for WorkOS logout functionality
 */
authRoutes.post('/exchange', async (c) => {
  const body = await c.req.json();
  const code = body.code;

  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  try {
    // Initialize WorkOS client
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Exchange code for WorkOS user profile and session
    // IMPORTANT: We now request a sealed session from WorkOS to enable proper logout functionality
    // The sealedSession contains the WorkOS session ID needed to generate logout URLs
    // This ensures users are properly logged out of their SSO provider (Google, etc.)
    const { user, sealedSession } = await workos.userManagement.authenticateWithCode({
      clientId: c.env.WORKOS_CLIENT_ID,
      code,
      session: {
        sealSession: true, // Request WorkOS to seal/encrypt the session for secure cookie storage
        cookiePassword: c.env.WORKOS_COOKIE_PASSWORD,
      },
    });

    // Ensure user exists in database (upsert)
    await c.env.SMART_DB.executeQuery({
      sqlQuery: buildUserUpsertQuery({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }),
    });

    // Create JWT with user information
    const jwtSecret = c.env.WORKOS_COOKIE_PASSWORD;
    const token = await createJWT(
      {
        userId: user.id,
        email: user.email ?? undefined,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      },
      jwtSecret
    );

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

    // Set WorkOS session cookie for proper session management
    // WHY: This cookie is essential for logout functionality
    // - Contains encrypted WorkOS session data needed to invalidate SSO sessions
    // - Without this, users would auto-login after logout (bad UX)
    // - The sealedSession is encrypted by WorkOS and can only be decrypted with WORKOS_COOKIE_PASSWORD
    if (sealedSession) {
      setCookie(c, 'wos-session', sealedSession, {
        httpOnly: true, // Prevent JavaScript access for security
        secure: isProduction, // HTTPS only in production
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days (longer than JWT for session refresh)
      });
    }

    console.log('Set auth_token cookie:', {
      tokenLength: token.length,
      isProduction,
      url: c.req.url,
      hasWorkOSSession: !!sealedSession,
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
      sqlQuery: buildUserUpsertQuery({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }),
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
      sqlQuery: buildUserUpsertQuery({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }),
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
 * Logout - clear authentication cookies and return WorkOS logout URL
 * POST /auth/logout
 * Requires authentication (must be logged in to logout)
 *
 * This endpoint:
 * 1. Verifies the user is authenticated via JWT
 * 2. Clears both auth_token and wos-session cookies
 * 3. Uses the sealed WorkOS session to generate a proper logout URL
 * 4. Returns the WorkOS logout URL so the frontend can redirect the user
 *
 * Response includes:
 * - success: true
 * - workosLogoutUrl: URL to redirect user to clear WorkOS SSO session (if available)
 */
authRoutes.post('/logout', async (c) => {
  // Get and verify JWT token before allowing logout
  const token = getCookie(c, 'auth_token');

  if (!token) {
    return c.json({ error: 'Not authenticated - already logged out' }, 401);
  }

  // Verify the JWT is valid before logging out
  const { verifyJWT } = await import('../../utils/jwt');
  const secret = c.env.WORKOS_COOKIE_PASSWORD;

  try {
    // Verify the JWT is valid (we don't need the payload, just verification)
    await verifyJWT(token, secret);

    // Note: JWT-based auth doesn't have server-side session invalidation
    // The token will remain valid until expiration (24 hours)
    // For immediate invalidation, you would need:
    // 1. A token blacklist in database/cache
    // 2. Or shorter token expiration times
    // 3. Or switch to session-based auth

  } catch (verifyError) {
    // Token is invalid/expired - reject logout
    console.log('Logout rejected: invalid/expired token');
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Clear JWT cookie (our application session)
  setCookie(c, 'auth_token', '', {
    path: '/',
    httpOnly: true,
    secure: c.req.url.startsWith('https://'),
    sameSite: 'Lax',
    maxAge: 0,
  });

  // Also clear legacy session cookie if present
  setCookie(c, 'wos-session', '', {
    path: '/',
    maxAge: 0,
  });

  try {
    // Generate WorkOS logout URL using the sealed session
    // WHY THIS CHANGE: Previously we tried to use sessionId directly, but WorkOS sessions
    // are stored as encrypted "sealed sessions" that must be loaded first
    const workos = new WorkOS(c.env.WORKOS_CLIENT_SECRET, {
      apiHostname: 'api.workos.com',
    });

    // Get the sealed session from cookie
    const sealedSession = getCookie(c, 'wos-session');

    // Generate the logout URL if we have a valid sealed session
    let workosLogoutUrl;
    if (sealedSession) {
      try {
        // Use the loadSealedSession helper to decrypt and load the session
        // This extracts the session ID needed for logout
        const session = workos.userManagement.loadSealedSession({
          sessionData: sealedSession,
          cookiePassword: c.env.WORKOS_COOKIE_PASSWORD, // Must match login password
        });

        // Get the WorkOS logout URL
        // This URL will:
        // 1. Invalidate the WorkOS session server-side
        // 2. Clear the SSO provider session (Google, etc.)
        // 3. Redirect back to your app
        // Frontend MUST redirect user to this URL to complete logout
        workosLogoutUrl = await session.getLogoutUrl();
      } catch (sessionError) {
        console.error('Failed to load sealed session:', sessionError);
        // Continue with logout even if session loading fails
        // Local cookies are still cleared, but SSO session may persist
      }
    }

    return c.json({
      success: true,
      message: 'Logged out successfully',
      ...(workosLogoutUrl && { workosLogoutUrl }),
    });
  } catch (error: any) {
    console.error('WorkOS logout URL generation failed:', error);

    // Even if WorkOS fails, we cleared our cookies successfully
    return c.json({
      success: true,
      message: 'Logged out successfully',
      note: 'WorkOS logout unavailable, but local session cleared',
    });
  }
});

export default authRoutes;
