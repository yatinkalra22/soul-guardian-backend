# Deployment Guide

## 🚀 Deploying to Raindrop

### Prerequisites

1. **Raindrop CLI installed**: `npm install -g @liquidmetal-ai/raindrop`
2. **Authenticated**: `raindrop auth login`
3. **Environment variables configured** (see below)

---

## 📝 Environment Variables

### Required Variables (Secrets)

These must be set in Raindrop before deployment:

```bash
# Set WorkOS credentials
raindrop build env set api:env:WORKOS_CLIENT_ID 'client_01K9...'
raindrop build env set api:env:WORKOS_CLIENT_SECRET 'sk_test_...'
raindrop build env set api:env:WORKOS_COOKIE_PASSWORD 'your-32-char-secret-here'

# Set allowed origins for CORS
raindrop build env set api:env:ALLOWED_ORIGINS 'https://soul-guardian.netlify.app,https://www.soul-guardian.com'
```

### Local Development (.env file)

Create a `.env` file in the root directory:

```bash
# Local Development
PORT=4000

# CORS Configuration
# Comma-separated list of allowed origins
# Leave empty for localhost-only in development
ALLOWED_ORIGINS=https://soul-guardian.netlify.app

# WorkOS Authentication
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_01K9...
WORKOS_COOKIE_PASSWORD=your-32-char-secret-here
```

---

## 🔧 Deployment Commands

### First-Time Deployment

```bash
# 1. Validate and build
npm run build

# 2. Set environment variables (see above)
raindrop build env set api:env:WORKOS_CLIENT_ID '...'
raindrop build env set api:env:WORKOS_CLIENT_SECRET '...'
raindrop build env set api:env:WORKOS_COOKIE_PASSWORD '...'
raindrop build env set api:env:ALLOWED_ORIGINS 'https://soul-guardian.netlify.app'

# 3. Deploy and start
npm run start
```

### Update Existing Deployment

```bash
# Option 1: Deploy and restart
npm run restart

# Option 2: Just deploy (manual start)
npm run deploy

# Option 3: Amend existing deployment
raindrop build deploy --amend -s
```

---

## 🌐 CORS Configuration

### How It Works

The CORS configuration supports both local development and production:

**Local Development (no `ALLOWED_ORIGINS` set):**
- Automatically allows all `localhost` and `127.0.0.1` origins
- Perfect for testing with multiple local frontends

**Production (with `ALLOWED_ORIGINS` set):**
- Only allows explicitly listed origins
- Comma-separated list: `https://app1.com,https://app2.com`

### Examples

**Allow single production domain:**
```bash
raindrop build env set api:env:ALLOWED_ORIGINS 'https://soul-guardian.netlify.app'
```

**Allow multiple domains:**
```bash
raindrop build env set api:env:ALLOWED_ORIGINS 'https://soul-guardian.netlify.app,https://www.soul-guardian.com,https://app.soul-guardian.com'
```

**Allow localhost + production (for testing):**
```bash
raindrop build env set api:env:ALLOWED_ORIGINS 'https://soul-guardian.netlify.app,http://localhost:3000'
```

---

## 🔍 Monitoring & Debugging

### Check Deployment Status

```bash
npm run status
```

### View Logs

```bash
# Tail logs (follow)
npm run logs

# Query specific logs
raindrop logs query --lines=100
```

### Get Deployment URL

```bash
npm run url
```

Example output:
```
https://api-soul-guardian.liquidmetal.workers.dev
```

---

## 🛑 Stopping Deployment

```bash
npm run stop
```

---

## 📊 Database Migrations

SQL migrations in `db/smart_db/` are automatically applied during deployment:

- `0001_create_users_and_avatars.sql` - Creates initial tables
- `0002_add_user_info.sql` - Adds user profile fields

To add new migrations:
1. Create a new file: `db/smart_db/0003_your_migration.sql`
2. Deploy: `npm run start`

---

## ⚠️ Important Notes

### Environment Variable Differences

| Aspect | Local Dev | Raindrop Deployment |
|--------|-----------|-------------------|
| **Access** | `process.env.VAR_NAME` | `c.env.VAR_NAME` |
| **Port** | Uses `PORT` env var | Ignored (uses 443) |
| **File** | `.env` file | Set via `raindrop build env set` |
| **Hot Reload** | ✅ Yes | ❌ No (must redeploy) |

### Security Best Practices

1. **Never commit** `.env` or `.env.raindrop` files
2. **Use strong secrets** for `WORKOS_COOKIE_PASSWORD` (32+ chars)
3. **Restrict CORS** in production (don't use `*`)
4. **Rotate secrets** regularly
5. **Monitor logs** for suspicious activity

---

## 🔐 Secret Management

### View Current Environment Variables

```bash
# View all environment variables
raindrop build env get api:env:WORKOS_CLIENT_ID
raindrop build env get api:env:ALLOWED_ORIGINS
```

### Update Environment Variables

```bash
# Update a variable
raindrop build env set api:env:ALLOWED_ORIGINS 'https://new-domain.com'

# Redeploy to apply changes
npm run restart
```

---

## 🐛 Troubleshooting

### Issue: CORS errors in production

**Symptom:** `Access-Control-Allow-Origin` errors in browser console

**Solution:**
1. Check that `ALLOWED_ORIGINS` includes your frontend URL
2. Verify it's set correctly:
   ```bash
   raindrop build env get api:env:ALLOWED_ORIGINS
   ```
3. Update if needed and redeploy

### Issue: Authentication not working

**Symptom:** 401 Unauthorized or JWT errors

**Solution:**
1. Verify WorkOS credentials are set:
   ```bash
   raindrop build env get api:env:WORKOS_CLIENT_ID
   raindrop build env get api:env:WORKOS_COOKIE_PASSWORD
   ```
2. Check that `WORKOS_COOKIE_PASSWORD` is at least 32 characters
3. Ensure frontend is sending `credentials: 'include'`

### Issue: Port conflicts in local dev

**Symptom:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Use a different port
PORT=3001 npm run dev

# Or kill the process using port 4000
lsof -ti:4000 | xargs kill
```

### Issue: Deployment stuck in pending

**Symptom:** `raindrop build status` shows "pending" indefinitely

**Solution:**
1. Check logs: `npm run logs`
2. Stop and redeploy:
   ```bash
   npm run stop
   npm run start
   ```

---

## 📚 Additional Resources

- [Raindrop Documentation](docs/RAINDROP.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Frontend Integration Guide](docs/FRONTEND_INTEGRATION.md)
