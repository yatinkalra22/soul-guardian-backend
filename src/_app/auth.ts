/**
 * Simple JWT verification middleware for local development
 * In production, this would use WorkOS or proper JWT verification
 */
export const verify = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized - Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  // For local development: accept any token and extract user ID
  // In production, this would verify the JWT properly
  try {
    // Simple validation - token should not be empty
    if (!token || token.trim() === '') {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Set JWT payload with user ID from token
    // For local dev, we'll use the token as the user ID
    c.set('jwt', {
      payload: {
        sub: token.split('-')[0] || 'local-user'
      }
    });

    await next();
  } catch (error) {
    return c.json({ error: 'Unauthorized - Token verification failed' }, 401);
  }
};

/**
 * Simple authorization middleware
 * Just checks if JWT was set by verify
 */
export const authorize = async (c: any, next: any) => {
  const jwt = c.get('jwt');

  if (!jwt || !jwt.payload || !jwt.payload.sub) {
    return c.json({ error: 'Unauthorized - No valid JWT' }, 401);
  }

  await next();
};
