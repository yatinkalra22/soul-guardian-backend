import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../raindrop.gen';
import { authorize, verify } from '../../_app/auth';

interface JWTPayload {
  sub: string;
  [key: string]: any;
}

interface Variables {
  jwt: {
    payload: JWTPayload;
  };
}

const avatarRoutes: Hono<{ Bindings: Env; Variables: Variables }> = new Hono<{ Bindings: Env; Variables: Variables }>();

avatarRoutes.use('*', verify as any, authorize as any);

const createAvatarSchema = z.object({
  name: z.string(),
  relationship: z.string().optional().default('Friend'),
});
avatarRoutes.post('/', async (c) => {
  const formData = await c.req.formData();
  const validated = createAvatarSchema.safeParse(Object.fromEntries(formData));
  if (!validated.success) {
    return c.json({ error: 'Invalid input', issues: validated.error.issues }, 400);
  }

  const { name, relationship } = validated.data;
  const photo = formData.get('photo') as File;

  let photoUrl: string | null = null;
  if (photo) {
    const photoKey = `${c.get('jwt').payload.sub}/${Date.now()}-${photo.name}`;
    await c.env.AVATAR_BUCKET.put(photoKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
    });
    photoUrl = `/api/avatars/photo/${photoKey}`;
  }

  const userId = c.get('jwt')?.payload.sub;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // User is automatically created/updated by auth middleware
  // Insert avatar and return the created record
  const insertResult = await c.env.SMART_DB.executeQuery({
    sqlQuery: `INSERT INTO avatars (user_id, name, relationship, photo_url)
               VALUES ('${userId}', '${name.replace(/'/g, "''")}', '${relationship.replace(/'/g, "''")}', ${photoUrl ? `'${photoUrl}'` : 'NULL'})
               RETURNING *`,
    format: 'json'
  });

  const newAvatar = insertResult.results ? JSON.parse(insertResult.results)[0] : null;
  return c.json(newAvatar);
});

avatarRoutes.get('/', async (c) => {
  const userId = c.get('jwt')?.payload.sub;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await c.env.SMART_DB.executeQuery({
    sqlQuery: `SELECT * FROM avatars WHERE user_id = '${userId}'`,
    format: 'json'
  });

  const avatars = result.results ? JSON.parse(result.results) : [];
  return c.json(avatars);
});

avatarRoutes.get('/photo/:key(*)', async (c) => {
  const userId = c.get('jwt')?.payload.sub;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const key = c.req.param('key') || '';

  // Validate that the photo belongs to the authenticated user
  // Photo keys are in format: userId/timestamp-filename.ext
  const keyUserId = key.split('/')[0];
  if (keyUserId !== userId) {
    return c.json({ error: 'Forbidden - You can only access your own photos' }, 403);
  }

  const file = await c.env.AVATAR_BUCKET.get(key);
  if (!file) {
    return c.notFound();
  }

  return new Response(file.body, {
    headers: {
      'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
    },
  });
});

avatarRoutes.delete('/:id', async (c) => {
  const userId = c.get('jwt')?.payload.sub;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const id = c.req.param('id');

  // Get avatar to check ownership and get photo_url
  const avatarResult = await c.env.SMART_DB.executeQuery({
    sqlQuery: `SELECT * FROM avatars WHERE id = ${parseInt(id)} AND user_id = '${userId}'`,
    format: 'json'
  });

  const avatars = avatarResult.results ? JSON.parse(avatarResult.results) : [];
  const avatar = avatars[0];

  if (!avatar) {
    return c.json({ error: 'Avatar not found' }, 404);
  }

  // Delete photo from bucket if exists
  if (avatar.photo_url) {
    const photoKey = avatar.photo_url.substring('/api/avatars/photo/'.length);
    await c.env.AVATAR_BUCKET.delete(photoKey);
  }

  // Delete avatar from database
  await c.env.SMART_DB.executeQuery({
    sqlQuery: `DELETE FROM avatars WHERE id = ${parseInt(id)}`
  });

  return c.json({ success: true });
});

export default avatarRoutes;
