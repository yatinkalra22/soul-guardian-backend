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

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your WorkOS credentials
   ```

3. **Set up Raindrop environment:**
   ```bash
   # Set environment variables in Raindrop
   raindrop build env set api:env:WORKOS_CLIENT_ID "your_client_id"
   raindrop build env set api:env:WORKOS_CLIENT_SECRET "your_api_key"
   raindrop build env set api:env:WORKOS_COOKIE_PASSWORD "your_password"
   ```

## Development

### Local Development (Mocked Services)

Run a local dev server with mocked database and storage:

```bash
npm run dev
```

The server runs at `http://localhost:3000` with:
- ✅ No authentication required
- ✅ Mocked database responses
- ✅ Logged (not stored) file uploads

### Remote Development (Real Services)

Deploy to Raindrop sandbox with real database and storage:

```bash
npm run dev:remote
```

### Watch Mode

Auto-restart on file changes:

```bash
npm run dev:watch
```

## Deployment

```bash
# Deploy to Raindrop
npm run deploy

# Deploy and start
npm start

# Check status
npm run status

# View logs
npm run logs

# Get API URL
npm run url
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Avatars

**Create Avatar:**
```bash
POST /api/avatars
Content-Type: multipart/form-data
Authorization: Bearer {workos_token}

Fields:
- name: string (required)
- relationship: string (optional, default: "Friend")
- photo: file (optional)
```

**Get All Avatars:**
```bash
GET /api/avatars
Authorization: Bearer {workos_token}
```

**Delete Avatar:**
```bash
DELETE /api/avatars/{id}
Authorization: Bearer {workos_token}
```

**Get Avatar Image:**
```bash
GET /api/avatars/photo/{key}
```

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
- `id` (TEXT PRIMARY KEY)

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
| `npm run dev` | Local development (mocked) |
| `npm run dev:watch` | Local with auto-restart |
| `npm run dev:remote` | Deploy to Raindrop sandbox |
| `npm run build` | Build TypeScript |
| `npm start` | Deploy and start on Raindrop |
| `npm run deploy` | Deploy to Raindrop |
| `npm run status` | Check deployment status |
| `npm run logs` | View live logs |
| `npm run url` | Get API URL |
| `npm run stop` | Stop deployment |

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
