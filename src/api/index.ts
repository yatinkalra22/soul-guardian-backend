import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Env } from './raindrop.gen';
import avatarRoutes from './avatar';
import authRoutes from './auth';
import { authMiddleware } from '../middleware/auth';

// Create Hono app with middleware
const app: any = new Hono<{ Bindings: Env }>();

// Add CORS middleware
// Default allowed origins (used as fallback)
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:4000'];

app.use('*', cors({
  origin: (origin, c) => {
    // Get allowed origins from environment (supports both local dev and Raindrop)
    // In Raindrop: use c.env.ALLOWED_ORIGINS
    // In local dev: use process.env.ALLOWED_ORIGINS
    const allowedOriginsEnv = c?.env?.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS;
    const allowedOrigins = allowedOriginsEnv
      ? allowedOriginsEnv.split(',').map((o: string) => o.trim())
      : DEFAULT_ALLOWED_ORIGINS;

    // Development: allow localhost origins automatically
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return origin;
    }

    // Production: check against allowlist
    return allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0];
  },
  credentials: true, // Allow cookies
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c: any) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// === Auth Routes ===
app.route('/api/auth', authRoutes);
// Also mount at /auth for backward compatibility with frontend
app.route('/auth', authRoutes);

// === Protected Profile Route (Example) ===
app.get('/api/profile', authMiddleware, async (c: any) => {
  // Get userId from context (set by authMiddleware)
  const userId = c.get('userId');

  // Optionally fetch user details from database
  try {
    const result = await c.env.SMART_DB.executeQuery({
      sqlQuery: `SELECT id, email, first_name, last_name FROM users WHERE id = '${userId}'`,
    });

    const users = JSON.parse(result.results);
    const user = users[0];

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return c.json({ error: 'Failed to fetch user profile' }, 500);
  }
});

// === Avatar Routes ===
app.route('/api/avatars', avatarRoutes);


// === Basic API Routes ===
app.get('/api/hello', (c: any) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.get('/api/hello/:name', (c: any) => {
  const name = c.req.param('name');
  return c.json({ message: `Hello, ${name}!` });
});

// Example POST endpoint
app.post('/api/echo', async (c: any) => {
  const body = await c.req.json();
  return c.json({ received: body });
});

// === Environment Variable Examples ===
app.get('/api/config', (c: any) => {
  return c.json({
    hasEnv: !!c.env,
    availableBindings: {
      SMART_DB: !!c.env.SMART_DB,
      AVATAR_BUCKET: !!c.env.AVATAR_BUCKET,
    }
  });
});

export { app };

// Export default for Raindrop/Cloudflare Workers
export default app;
