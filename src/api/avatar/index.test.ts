import { app } from '../index';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import { Env } from '../raindrop.gen';
import { RemoteSmartSqlClient, RemoteSmartBucketClient } from '../../remote-clients';

// Mock auth to bypass WorkOS
vi.mock('../../_app/auth', () => ({
  verify: vi.fn(async (c: any, next: any) => {
    if (c.req.header('Authorization') === 'Bearer valid-token') {
      c.set('jwt', { payload: { sub: 'test-user-' + Date.now() } });
      await next();
    } else {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }),
  authorize: vi.fn(async (c: any, next: any) => {
    await next();
  }),
}));

// Remote Raindrop service configuration
const RAINDROP_ORG_ID = 'org_01K9CJ2G9WZ9XQ7RAVQ5XKYJE0';
const SMARTSQL_MODULE_ID = '01ka6te8ktjwpjj4x0z0kdezfw';
const SMARTBUCKET_MODULE_ID = '01kaes49jvmt8grebzmz4y14mg';

let env: Env;

describe('Avatar API - Integration Tests (Remote Raindrop)', () => {
  beforeAll(() => {
    // Create remote service clients
    const SMART_DB = new RemoteSmartSqlClient(SMARTSQL_MODULE_ID, RAINDROP_ORG_ID);
    const AVATAR_BUCKET = new RemoteSmartBucketClient(SMARTBUCKET_MODULE_ID, RAINDROP_ORG_ID);

    env = {
      SMART_DB: SMART_DB as any,
      AVATAR_BUCKET: AVATAR_BUCKET as any,
      WORKOS_CLIENT_ID: '',
      WORKOS_CLIENT_SECRET: '',
      WORKOS_COOKIE_PASSWORD: '',
      logger: console as any,
      mem: {} as any,
      AI: {} as any,
      annotation: {} as any,
      tracer: {} as any,
      _raindrop: {} as any,
    };
  });

  describe('unauthorized', () => {
    it('should return 401 without auth token', async () => {
      const req = new Request('http://localhost/api/avatars');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);
    });
  });

  describe('authorized - remote database operations', () => {
    it('should create an avatar in remote database', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Avatar');
      formData.append('relationship', 'Friend');

      const req = new Request('http://localhost/api/avatars', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = (await res.json()) as any;
      expect(json.name).toBe('Test Avatar');
      expect(json.relationship).toBe('Friend');
      expect(json.id).toBeDefined();
    });

    it('should get avatars from remote database', async () => {
      const req = new Request('http://localhost/api/avatars', {
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = (await res.json()) as any;
      expect(json).toBeInstanceOf(Array);
    });

    it('should handle avatar creation with photo upload', async () => {
      const formData = new FormData();
      formData.append('name', 'Avatar with Photo');
      formData.append('relationship', 'Family');

      // Create a small test image blob
      const blob = new Blob(['fake-image-data'], { type: 'image/png' });
      formData.append('photo', blob, 'test-photo.png');

      const req = new Request('http://localhost/api/avatars', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const json = (await res.json()) as any;
      expect(json.name).toBe('Avatar with Photo');
      expect(json.photo_url).toBeDefined();
      expect(json.photo_url).toContain('/api/avatars/photo/');
    });
  });
});
