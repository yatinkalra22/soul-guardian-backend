# Soul Guardian Backend

Avatar management backend built with Raindrop Framework, SmartSQL, and SmartBucket.

## Features

- ✅ Avatar CRUD operations with image upload
- ✅ WorkOS authentication
- ✅ SmartSQL database (D1)
- ✅ SmartBucket storage (R2)
- ✅ Local development server
- ✅ Type-safe TypeScript

## Prerequisites

- Node.js 18+
- Raindrop CLI (`npm install -g @liquidmetal-ai/raindrop`)
- WorkOS account (for authentication)

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the Raindrop env template
   cp .env.raindrop.example .env.raindrop
   # Edit .env.raindrop with your WorkOS credentials

   # Also copy for local development
   cp .env.example .env
   # Edit .env with your WorkOS credentials
   ```

   **Note:** Environment variables are automatically set when you run `npm run start` or `npm run deploy`

## Development

### Local Development

Run the development server with hot-reload:

```bash
npm run dev
```

Or run without watch mode:

```bash
npm start
```

The server runs at `http://localhost:4000` (or set `PORT` in `.env`) with:
- ✅ Remote SmartSQL database (Raindrop hosted)
- ✅ Remote SmartBucket storage (Raindrop hosted)
- ✅ Simple token-based authentication for local dev
- ✅ Production API code running locally

**Testing locally:**
```bash
# The local server uses mock database and storage
curl http://localhost:4000/health
curl http://localhost:4000/auth/exchange -X POST -H "Content-Type: application/json" -d '{"code":"test"}'
```

## Deployment to Raindrop

### First-Time Deployment
```bash
npm run deploy:start
```

### Update Existing Deployment
```bash
npm run deploy
```

### Other Deployment Commands
```bash
# Stop deployment
npm run deploy:stop

# Check deployment status
npm run deploy:status

# View logs
npm run deploy:logs

# Get deployment URL
npm run deploy:url
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Authentication

**Callback (called by WorkOS after login/signup):**
```bash
GET /api/auth/callback?code={authorization_code}
```
Returns user info and access token. Sets HTTP-only session cookie.

**Get Current User:**
```bash
GET /api/auth/me
```
Uses session cookie or Authorization header.

**Logout:**
```bash
POST /api/auth/logout
```
Clears session cookie.

### Avatars

All avatar endpoints require authentication via:
- **Authorization header:** `Authorization: Bearer {workos_access_token}`, OR
- **Session cookie:** Automatically set after `/api/auth/callback`

**Create Avatar:**
```bash
POST /api/avatars
Content-Type: multipart/form-data
Authorization: Bearer {workos_access_token}

Fields:
- name: string (required)
- relationship: string (optional, default: "Friend")
- photo: file (optional)
```

**Get User's Avatars:**
```bash
GET /api/avatars
Authorization: Bearer {workos_access_token}
```
Returns only the authenticated user's avatars.

**Delete Avatar:**
```bash
DELETE /api/avatars/{id}
Authorization: Bearer {workos_access_token}
```
Can only delete avatars owned by the authenticated user.

**Get Avatar Image:**
```bash
GET /api/avatars/photo/{key}
Authorization: Bearer {workos_access_token}
```
Can only access photos owned by the authenticated user.

## Project Structure

```
.
├── src/
│   ├── api/
│   │   ├── avatar/         # Avatar routes
│   │   ├── index.ts        # Main API setup
│   │   ├── db.ts           # Database types
│   │   └── raindrop.gen.ts # Generated types
│   ├── _app/
│   │   └── auth.ts         # WorkOS auth middleware
│   └── dev-server.ts       # Local dev server
├── db/
│   └── smart_db/           # Database migrations
├── raindrop.manifest       # Raindrop configuration
└── package.json
```

## Database Schema

**Users Table:**
- `id` (TEXT PRIMARY KEY) - WorkOS user ID
- `email` (TEXT) - User email from WorkOS
- `first_name` (TEXT) - User first name
- `last_name` (TEXT) - User last name

**Avatars Table:**
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `name` (TEXT NOT NULL)
- `relationship` (TEXT NOT NULL DEFAULT 'Friend')
- `photo_url` (TEXT)
- `user_id` (TEXT NOT NULL, FOREIGN KEY → users.id)

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Local server connected to remote Raindrop services |
| `npm run dev:watch` | Local with auto-restart |
| `npm run build` | Validate Raindrop manifest and build |
| `npm start` | Deploy and start on Raindrop |
| `npm run deploy` | Deploy to Raindrop |
| `npm run status` | Check deployment status |
| `npm run logs` | View live logs |
| `npm run url` | Get API URL |
| `npm run stop` | Stop deployment |
| `npm test` | Run tests |

## Security Notes

⚠️ **Never commit:**
- `.env` (local secrets)
- `.dev.vars` (Wrangler secrets)
- `wrangler.toml` (contains secrets)

✅ **Always use:**
- `.env.example` (template)
- `wrangler.toml.example` (template)

## Troubleshooting

**Deployment stuck/failing:**
```bash
npm run stop
sleep 10
npm run dev:remote
```

**Check logs for errors:**
```bash
npm run logs
```

**Validate configuration:**
```bash
raindrop build validate
```

## License

Private - Hackathon Project
