import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT Configuration
 */
const JWT_EXPIRY = '24h'; // 24 hours

/**
 * Create a JWT token with the user's database ID
 * @param dbUserId - The internal database ID of the user
 * @param secret - JWT secret key (must be at least 32 characters)
 * @returns Signed JWT token
 */
export async function createJWT(dbUserId: string, secret: string): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  // Convert secret to Uint8Array for jose
  const secretKey = new TextEncoder().encode(secret);

  // Create and sign JWT
  const jwt = await new SignJWT({ sub: dbUserId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode a JWT token
 * @param token - The JWT token to verify
 * @param secret - JWT secret key
 * @returns Decoded JWT payload with user ID
 */
export async function verifyJWT(token: string, secret: string): Promise<{ sub: string; iat: number; exp: number }> {
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  try {
    // Convert secret to Uint8Array for jose
    const secretKey = new TextEncoder().encode(secret);

    // Verify and decode JWT
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    return {
      sub: payload.sub as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('Token has expired');
    }
    throw new Error('Invalid token');
  }
}

/**
 * Extract user ID from JWT payload
 * @param payload - Decoded JWT payload
 * @returns User ID
 */
export function getUserIdFromPayload(payload: { sub: string }): string {
  return payload.sub;
}
