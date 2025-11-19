/**
 * Local Development Server
 * Run with: npm run dev
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Env } from './api/raindrop.gen';

const port = 3000;

console.log(`🚀 Starting local dev server on http://localhost:${port}`);
console.log(`📝 Note: This is running with MOCKED database and storage`);
console.log(`   For full testing with real SmartSQL/SmartBucket, use: npm run dev:remote\n`);

// Create a simple app for local dev
const devApp = new Hono<{ Bindings: Env }>();

// Mock environment
const mockEnv: Env = {
  SMART_DB: {
    executeQuery: async (options: any) => {
      console.log('📊 [MOCK DB] Query:', options.sqlQuery || options.textQuery);

      if (options.sqlQuery?.includes('SELECT * FROM avatars')) {
        return {
          message: 'Success',
          results: JSON.stringify([
            { id: 1, name: 'Test Avatar', relationship: 'Friend', photo_url: null, user_id: 'user-123' }
          ]),
          status: 200,
          queryExecuted: options.sqlQuery
        };
      }

      if (options.sqlQuery?.includes('INSERT INTO avatars')) {
        return {
          message: 'Success',
          results: JSON.stringify([
            { id: Date.now(), name: 'New Avatar', relationship: 'Friend', photo_url: null, user_id: 'user-123' }
          ]),
          status: 200,
          queryExecuted: options.sqlQuery
        };
      }

      if (options.sqlQuery?.includes('DELETE FROM avatars')) {
        return {
          message: 'Success',
          status: 200,
          queryExecuted: options.sqlQuery
        };
      }

      return {
        message: 'Success',
        results: JSON.stringify([]),
        status: 200,
        queryExecuted: options.sqlQuery
      };
    }
  } as any,

  AVATAR_BUCKET: {
    put: async (key: string, value: any, options?: any) => {
      console.log('📦 [MOCK BUCKET] PUT:', key);
      return { key, size: value?.length || 0, etag: 'mock-etag' } as any;
    },
    get: async (key: string) => {
      console.log('📦 [MOCK BUCKET] GET:', key);
      return null;
    },
    delete: async (key: string) => {
      console.log('📦 [MOCK BUCKET] DELETE:', key);
      return;
    }
  } as any,

  WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID || 'mock-client-id',
  WORKOS_CLIENT_SECRET: process.env.WORKOS_CLIENT_SECRET || 'mock-secret',
  WORKOS_COOKIE_PASSWORD: process.env.WORKOS_COOKIE_PASSWORD || 'mock-password',

  logger: console as any,
  mem: {} as any,
  AI: {} as any,
  annotation: {} as any,
  tracer: {} as any,
  _raindrop: {} as any
};

// Health check
devApp.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'local-dev' });
});

// Mock auth middleware for local development
const mockAuth = async (c: any, next: any) => {
  c.set('jwt', { payload: { sub: 'local-user-123' } });
  await next();
};

// Avatar routes
devApp.post('/api/avatars', mockAuth, async (c) => {
  const formData = await c.req.formData();
  const name = formData.get('name') as string;
  const relationship = formData.get('relationship') as string || 'Friend';
  const photo = formData.get('photo') as File;

  let photoUrl: string | null = null;
  if (photo) {
    const photoKey = `local-user-123/${Date.now()}-${photo.name}`;
    await mockEnv.AVATAR_BUCKET.put(photoKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
    });
    photoUrl = `/api/avatars/photo/${photoKey}`;
  }

  const result = await mockEnv.SMART_DB.executeQuery({
    sqlQuery: `INSERT INTO avatars (user_id, name, relationship, photo_url)
               VALUES ('local-user-123', '${name}', '${relationship}', ${photoUrl ? `'${photoUrl}'` : 'NULL'})
               RETURNING *`,
    format: 'json'
  });

  const avatar = result.results ? JSON.parse(result.results)[0] : null;
  return c.json(avatar);
});

devApp.get('/api/avatars', mockAuth, async (c) => {
  const result = await mockEnv.SMART_DB.executeQuery({
    sqlQuery: `SELECT * FROM avatars WHERE user_id = 'local-user-123'`,
    format: 'json'
  });

  const avatars = result.results ? JSON.parse(result.results) : [];
  return c.json(avatars);
});

devApp.get('/api/avatars/photo/:key(*)', async (c) => {
  const key = c.req.param('key') || '';
  return c.text('Mock image data - not implemented in local dev', 404);
});

devApp.delete('/api/avatars/:id', mockAuth, async (c) => {
  const id = c.req.param('id');

  const avatarResult = await mockEnv.SMART_DB.executeQuery({
    sqlQuery: `SELECT * FROM avatars WHERE id = ${parseInt(id)} AND user_id = 'local-user-123'`,
    format: 'json'
  });

  const avatars = avatarResult.results ? JSON.parse(avatarResult.results) : [];
  if (avatars.length === 0) {
    return c.json({ error: 'Avatar not found' }, 404);
  }

  await mockEnv.SMART_DB.executeQuery({
    sqlQuery: `DELETE FROM avatars WHERE id = ${parseInt(id)}`
  });

  return c.json({ success: true });
});

// Other API routes
devApp.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from local dev!' });
});

devApp.get('/api/hello/:name', (c) => {
  const name = c.req.param('name');
  return c.json({ message: `Hello, ${name}!` });
});

// Start server
serve({
  fetch: devApp.fetch,
  port
});

console.log(`✅ Server running at http://localhost:${port}`);
console.log(`   Health check: http://localhost:${port}/health`);
console.log(`   Avatars API: http://localhost:${port}/api/avatars`);
console.log(`\n💡 Tips:`);
console.log(`   - No authentication required in local mode`);
console.log(`   - Database is mocked (returns fake data)`);
console.log(`   - File uploads are logged but not stored`);
console.log(`   - Use npm run dev:remote for real database/storage\n`);
