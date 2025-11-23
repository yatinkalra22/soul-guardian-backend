import { Hono } from 'hono';
import { z } from 'zod';
import { Env } from '../raindrop.gen';
import { authorize, verify } from '../../_app/auth';
import type { Avatar } from '../db';

interface JWTPayload {
  sub: string;
  [key: string]: any;
}

interface Variables {
  jwt: {
    payload: JWTPayload;
  };
}

type AppContext = { Bindings: Env; Variables: Variables };

const avatarRoutes = new Hono<AppContext>();

// Constants
const PHOTO_URL_PREFIX = '/api/avatars/photo/';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Validation schemas
const createAvatarSchema = z.object({
  name: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50).optional().default('Friend'),
});

const avatarIdSchema = z.string().regex(/^\d+$/).transform(Number);

// Utility functions
function getUserId(c: any): string {
  const userId = c.get('jwt')?.payload.sub;
  if (!userId) {
    throw new Error('User ID not found in JWT payload');
  }
  return userId;
}

function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

async function uploadPhoto(
  bucket: any,
  userId: string,
  photo: File
): Promise<string> {
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (photo.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  const timestamp = Date.now();
  const sanitizedFileName = photo.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const photoKey = `${userId}/${timestamp}-${sanitizedFileName}`;

  await bucket.put(photoKey, await photo.arrayBuffer(), {
    httpMetadata: { contentType: photo.type },
  });

  return `${PHOTO_URL_PREFIX}${photoKey}`;
}

async function deletePhoto(bucket: any, photoUrl: string): Promise<void> {
  if (photoUrl.startsWith(PHOTO_URL_PREFIX)) {
    const photoKey = photoUrl.substring(PHOTO_URL_PREFIX.length);
    await bucket.delete(photoKey);
  }
}

function parseQueryResult<T>(results: string | null | undefined): T[] {
  if (!results) return [];
  try {
    const parsed = JSON.parse(results);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Middleware
avatarRoutes.use('*', verify as any, authorize as any);

// Routes
avatarRoutes.post('/', async (c) => {
  try {
    const userId = getUserId(c);
    const contentType = c.req.header('Content-Type') || '';

    let validatedData: z.infer<typeof createAvatarSchema>;
    let photo: File | null = null;

    // Parse request based on content type
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      const result = createAvatarSchema.safeParse(body);
      if (!result.success) {
        return c.json(
          { error: 'Invalid input', issues: result.error.issues },
          400
        );
      }
      validatedData = result.data;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const formObject = Object.fromEntries(formData);
      const result = createAvatarSchema.safeParse(formObject);
      if (!result.success) {
        return c.json(
          { error: 'Invalid input', issues: result.error.issues },
          400
        );
      }
      validatedData = result.data;
      const photoFile = formData.get('photo');
      if (photoFile instanceof File) {
        photo = photoFile;
      }
    } else {
      return c.json(
        {
          error: 'Invalid Content-Type',
          message: 'Content-Type must be application/json or multipart/form-data',
        },
        400
      );
    }

    // Upload photo if provided
    let photoUrl: string | null = null;
    if (photo) {
      try {
        photoUrl = await uploadPhoto(c.env.AVATAR_BUCKET, userId, photo);
      } catch (error) {
        return c.json(
          {
            error: 'Photo upload failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          400
        );
      }
    }

    // Insert avatar into database
    const insertResult = await c.env.SMART_DB.executeQuery({
      sqlQuery: `INSERT INTO avatars (user_id, name, relationship, photo_url)
                 VALUES ('${escapeSQL(userId)}', '${escapeSQL(validatedData.name)}', '${escapeSQL(validatedData.relationship)}', ${photoUrl ? `'${escapeSQL(photoUrl)}'` : 'NULL'})
                 RETURNING *`,
      format: 'json',
    });

    const avatars = parseQueryResult<Avatar>(insertResult.results);
    const newAvatar = avatars[0];

    if (!newAvatar) {
      return c.json({ error: 'Failed to create avatar' }, 500);
    }

    return c.json(newAvatar, 201);
  } catch (error) {
    console.error('Error creating avatar:', error);
    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

avatarRoutes.get('/', async (c) => {
  try {
    const userId = getUserId(c);

    const result = await c.env.SMART_DB.executeQuery({
      sqlQuery: `SELECT * FROM avatars WHERE user_id = '${escapeSQL(userId)}' ORDER BY id DESC`,
      format: 'json',
    });

    const avatars = parseQueryResult<Avatar>(result.results);
    return c.json(avatars);
  } catch (error) {
    console.error('Error fetching avatars:', error);
    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

avatarRoutes.get('/photo/:key(*)', async (c) => {
  try {
    const userId = getUserId(c);
    const key = c.req.param('key');

    if (!key) {
      return c.json({ error: 'Photo key is required' }, 400);
    }

    // Validate that the photo belongs to the authenticated user
    const keyUserId = key.split('/')[0];
    if (keyUserId !== userId) {
      return c.json(
        { error: 'Forbidden - You can only access your own photos' },
        403
      );
    }

    const file = await c.env.AVATAR_BUCKET.get(key);
    if (!file) {
      return c.notFound();
    }

    return new Response(file.body, {
      headers: {
        'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error fetching photo:', error);
    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

avatarRoutes.delete('/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const idParam = c.req.param('id');

    const idValidation = avatarIdSchema.safeParse(idParam);
    if (!idValidation.success) {
      return c.json({ error: 'Invalid avatar ID' }, 400);
    }
    const id = idValidation.data;

    // Get avatar to check ownership and get photo_url
    const avatarResult = await c.env.SMART_DB.executeQuery({
      sqlQuery: `SELECT * FROM avatars WHERE id = ${id} AND user_id = '${escapeSQL(userId)}'`,
      format: 'json',
    });

    const avatars = parseQueryResult<Avatar>(avatarResult.results);
    const avatar = avatars[0];

    if (!avatar) {
      return c.json({ error: 'Avatar not found or unauthorized' }, 404);
    }

    // Delete photo from bucket if exists
    if (avatar.photo_url) {
      try {
        await deletePhoto(c.env.AVATAR_BUCKET, avatar.photo_url);
      } catch (error) {
        console.error('Error deleting photo from bucket:', error);
        // Continue with avatar deletion even if photo deletion fails
      }
    }

    // Delete avatar from database
    await c.env.SMART_DB.executeQuery({
      sqlQuery: `DELETE FROM avatars WHERE id = ${id}`,
    });

    return c.json({ success: true, message: 'Avatar deleted successfully' });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return c.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default avatarRoutes;
