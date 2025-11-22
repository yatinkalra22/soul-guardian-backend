import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT Configuration
 */
const JWT_EXPIRY = '24h'; // 24 hours

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  sub: string;         // User ID
  email?: string;      // User email
  firstName?: string;  // User first name
  lastName?: string;   // User last name
  iat?: number;        // Issued at
  exp?: number;        // Expiration
}

/**
 * Create a JWT token with user information
 * @param userData - User data to include in JWT
 * @param secret - JWT secret key (must be at least 32 characters)
 * @returns Signed JWT token
 */
export async function createJWT(
  userData: {
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  },
  secret: string
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  // Convert secret to Uint8Array for jose
  const secretKey = new TextEncoder().encode(secret);

  // Build JWT payload
  const payload: Record<string, any> = {
    sub: userData.userId,
  };

  // Add optional fields if provided
  if (userData.email) payload.email = userData.email;
  if (userData.firstName) payload.firstName = userData.firstName;
  if (userData.lastName) payload.lastName = userData.lastName;

  // Create and sign JWT
  const jwt = await new SignJWT(payload)
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
 * @returns Decoded JWT payload with user information
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
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
      email: payload.email as string | undefined,
      firstName: payload.firstName as string | undefined,
      lastName: payload.lastName as string | undefined,
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
export function getUserIdFromPayload(payload: JWTPayload): string {
  return payload.sub;
}
