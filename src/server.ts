/**
 * Local Development Server
 * Runs the production API code locally with MOCKED services
 * For real testing, deploy to Raindrop with: npm run start
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './api/index';
import type { Env } from './api/raindrop.gen';

const port = parseInt(process.env.PORT || '4000', 10);

console.log(`🚀 Starting local dev server on http://localhost:${port}`);
console.log(`⚠️  Using MOCKED database and storage`);
console.log(`💡 For real testing, deploy to Raindrop: npm run start\n`);

// In-memory storage
const avatarsDb = new Map<number, any>();
let nextId = 1;

// Mock SmartSQL
const mockSmartDb = {
  executeQuery: async (options: any) => {
    console.log('📊 [MOCK DB] Query:', options.sqlQuery);

    const sql = options.sqlQuery || '';

    // INSERT
    if (sql.includes('INSERT INTO avatars')) {
      const match = sql.match(/VALUES \('([^']+)', '([^']+)', '([^']+)', (.+)\)/);
      if (match) {
        const avatar = {
          id: nextId++,
          user_id: match[1],
          name: match[2],
          relationship: match[3],
          photo_url: match[4] === 'NULL' ? null : match[4].replace(/'/g, '')
        };
        avatarsDb.set(avatar.id, avatar);
        return {
          message: 'Success',
          results: JSON.stringify([avatar]),
          status: 200,
          queryExecuted: sql
        };
      }
    }

    // SELECT
    if (sql.includes('SELECT * FROM avatars')) {
      const avatars = Array.from(avatarsDb.values());
      return {
        message: 'Success',
        results: JSON.stringify(avatars),
        status: 200,
        queryExecuted: sql
      };
    }

    // DELETE
    if (sql.includes('DELETE FROM avatars')) {
      const match = sql.match(/WHERE id = (\d+)/);
      if (match) {
        avatarsDb.delete(parseInt(match[1]));
      }
      return {
        message: 'Success',
        status: 200,
        queryExecuted: sql
      };
    }

    // INSERT OR IGNORE INTO users
    if (sql.includes('INSERT OR IGNORE INTO users')) {
      return {
        message: 'Success',
        status: 200,
        queryExecuted: sql
      };
    }

    return {
      message: 'Success',
      results: JSON.stringify([]),
      status: 200,
      queryExecuted: sql
    };
  }
} as any;

// Mock SmartBucket
const bucketStorage = new Map<string, ArrayBuffer>();

const mockAvatarBucket = {
  put: async (key: string, value: any) => {
    console.log('📦 [MOCK BUCKET] PUT:', key);
    bucketStorage.set(key, value);
    return { key, size: value.byteLength || 0, etag: 'mock-etag' };
  },
  get: async (key: string) => {
    console.log('📦 [MOCK BUCKET] GET:', key);
    const data = bucketStorage.get(key);
    if (!data) return null;
    return {
      body: data,
      httpMetadata: { contentType: 'image/jpeg' },
      size: data.byteLength,
      etag: 'mock-etag',
      uploaded: new Date()
    };
  },
  delete: async (key: string) => {
    console.log('📦 [MOCK BUCKET] DELETE:', key);
    bucketStorage.delete(key);
  }
} as any;

// Create environment with mocked services
const env: Env = {
  SMART_DB: mockSmartDb,
  AVATAR_BUCKET: mockAvatarBucket,
  WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID || '',
  WORKOS_CLIENT_SECRET: process.env.WORKOS_API_KEY || process.env.WORKOS_CLIENT_SECRET || '',
  WORKOS_COOKIE_PASSWORD: process.env.WORKOS_COOKIE_PASSWORD || '',
  logger: console as any,
  mem: {} as any,
  AI: {} as any,
  annotation: {} as any,
  tracer: {} as any,
  _raindrop: {} as any,
};

// Validate WorkOS environment variables
if (!env.WORKOS_CLIENT_ID || !env.WORKOS_CLIENT_SECRET || !env.WORKOS_COOKIE_PASSWORD) {
  console.error('❌ Missing WorkOS environment variables!');
  console.error('   Required in .env file:');
  console.error('   - WORKOS_CLIENT_ID');
  console.error('   - WORKOS_API_KEY (or WORKOS_CLIENT_SECRET)');
  console.error('   - WORKOS_COOKIE_PASSWORD');
  process.exit(1);
}

// Start server
serve({
  fetch: (request: Request) => app.fetch(request, env),
  port,
});

console.log(`✅ Server running at http://localhost:${port}`);
console.log(`   Health: http://localhost:${port}/health`);
console.log(`   Avatars: http://localhost:${port}/api/avatars`);
console.log(`\n📝 Test with:`);
console.log(`   curl http://localhost:${port}/api/avatars -H "Authorization: Bearer user123"\n`);
