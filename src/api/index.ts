import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import avatarRoutes from './avatar';

// Create Hono app with middleware
const app: any = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', logger());

// Health check endpoint
app.get('/health', (c: any) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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
