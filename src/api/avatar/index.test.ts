import { app } from '../index';
import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Env } from '../raindrop.gen';
import { Kysely, Selectable } from 'kysely';
import { Avatar, User } from '../db';

vi.mock('../../_app/auth', () => ({
  verify: vi.fn(async (c: any, next: any) => {
    if (c.req.header('Authorization') === 'Bearer valid-token') {
      c.set('jwt', { payload: { sub: 'user-123' } });
      await next();
    } else {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }),
  authorize: vi.fn(async (c: any, next: any) => {
    await next();
  }),
}));



// In-memory storage for mocks
let db: { avatars: Selectable<Avatar>[], users: Selectable<User>[] };
let bucket: Map<string, ArrayBuffer>;

// Mock SmartSql and Bucket
const mockSmartDb = {
  insertInto: vi.fn((table: 'avatars' | 'users') => {
    return {
      values: vi.fn((values: any) => {
        if (table === 'users') {
          if (!db.users.find(u => u.id === values.id)) {
            db.users.push({ ...values });
          }
        } else if (table === 'avatars') {
          const newAvatar = { ...values, id: db.avatars.length + 1 };
          db.avatars.push(newAvatar);
        }
        
        const queryBuilder = {
          onConflict: vi.fn((callback) => {
            const onConflictBuilder = {
              doNothing: vi.fn(() => {
                return {
                  execute: vi.fn(async () => {
                    // The user insert is already done above.
                  }),
                };
              }),
            };
            return callback(onConflictBuilder);
          }),
          returningAll: vi.fn(() => ({
            executeTakeFirstOrThrow: vi.fn(async () => {
              return db.avatars[db.avatars.length - 1];
            }),
          })),
        };
        return queryBuilder;
      }),
    };
  }),
  selectFrom: vi.fn((table: 'avatars') => {
    return {
      selectAll: vi.fn(() => {
        return {
          where: vi.fn((field: 'user_id' | 'id', op: '=', value: string | number) => {
            const filtered = db[table].filter(row => row[field] === value);
            return {
              where: vi.fn((field2: 'user_id' | 'id', op2: '=', value2: string | number) => {
                const filtered2 = filtered.filter(row => row[field2] === value2);
                return {
                  execute: vi.fn(async () => filtered2),
                  executeTakeFirst: vi.fn(async () => filtered2[0]),
                };
              }),
              execute: vi.fn(async () => filtered),
              executeTakeFirst: vi.fn(async () => filtered[0]),
            };
          }),
        };
      }),
    };
  }),
  deleteFrom: vi.fn((table: 'avatars') => {
    return {
      where: vi.fn((field: 'id', op: '=', value: number) => {
        return {
          execute: vi.fn(async () => {
            db.avatars = db.avatars.filter(row => row.id !== value);
          }),
        };
      }),
    };
  }),
} as unknown as Kysely<any>;

const mockAvatarBucket = {
  put: vi.fn(async (key: string, value: ArrayBuffer) => {
    bucket.set(key, value);
    return { key, size: value.byteLength, etag: 'etag', httpMetadata: {} };
  }),
  get: vi.fn(async (key: string) => {
    const value = bucket.get(key);
    if (!value) return null;
    return { body: value, httpMetadata: { contentType: 'image/png' } };
  }),
  delete: vi.fn(async (key: string) => {
    bucket.delete(key);
  }),
};

let env: Env;

describe('Avatar API', () => {
  beforeEach(() => {
    db = { avatars: [], users: [] };
    bucket = new Map();
    env = {
      SMART_DB: mockSmartDb,
      AVATAR_BUCKET: mockAvatarBucket,
    } as unknown as Env;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('unauthorized', () => {
    it('should return 401 for all routes', async () => {
      const req = new Request('http://localhost/api/avatars');
      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);
    });
  });

  describe('authorized', () => {
    it('should create an avatar', async () => {
      const formData = new FormData();
      formData.append('name', 'test');
      formData.append('relationship', 'test');

      const req = new Request('http://localhost/api/avatars', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer valid-token',
        }
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.name).toBe('test');
      expect(json.relationship).toBe('test');
    });

    it('should get avatars', async () => {
      db.avatars.push({ id: 1, name: 'Avatar 1', user_id: 'user-123', relationship: 'Friend', photo_url: null });
      const req = new Request('http://localhost/api/avatars', {
        headers: {
          Authorization: 'Bearer valid-token',
        }
      });
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json).toBeInstanceOf(Array);
      expect(json.length).toBe(1);
    });

    it('should delete an avatar', async () => {
      const avatar = { id: 1, name: 'test-delete', user_id: 'user-123', relationship: 'Friend', photo_url: null };
      db.avatars.push(avatar);

      const req = new Request(`http://localhost/api/avatars/${avatar.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        }
      });
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(db.avatars.length).toBe(0);
    });
  });
});
