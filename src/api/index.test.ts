import { describe, it, expect } from 'vitest';
import { app } from './index';
import { Env } from './raindrop.gen';

describe('Hello API', () => {
  const env = {} as Env;

  it('should return 200 for health check', async () => {
    const req = new Request('http://localhost/health');
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
  });

  it('should return hello message', async () => {
    const req = new Request('http://localhost/api/hello');
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.message).toBe('Hello from Hono!');
  });

  it('should return hello message with name', async () => {
    const req = new Request('http://localhost/api/hello/John');
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.message).toBe('Hello, John!');
  });

  it('should echo post data', async () => {
    const req = new Request('http://localhost/api/echo', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.received).toEqual({ foo: 'bar' });
  });
});