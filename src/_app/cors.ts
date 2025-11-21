import { corsDisabled } from '@liquidmetal-ai/raindrop-framework/core/cors';

/**
 * cors is the application-wide CORS (Cross-Origin Resource Sharing) handler.
 *
 * NOTE: CORS is currently handled by Hono middleware in src/api/index.ts
 * This file is kept for Raindrop framework compatibility.
 *
 * CORS is configured in src/api/index.ts with:
 * - Dynamic origin validation (localhost in dev, allowlist in production)
 * - Credentials support for cookies
 * - Proper HTTP methods and headers
 */
export const cors = corsDisabled;
