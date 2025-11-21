# Environment Variables Guide

## 🔑 Understanding Environment Variables in Raindrop

Raindrop environment variables work differently than traditional Node.js applications:

### Key Concepts

1. **Environment variables are tied to a specific deployment version**
2. **Each new deployment creates a new version ID**
3. **Use `--amend` to update existing deployment without creating new version**
4. **Environment variables persist across `--amend` deployments**

---

## 📋 File Structure

### `.env` - Local Development Only
```bash
# Used by: npm run dev
# Location: NOT tracked in git
# Purpose: Local development with mock services

PORT=4000
ALLOWED_ORIGINS=http://localhost:3000
WORKOS_CLIENT_ID=client_01K9...
WORKOS_CLIENT_SECRET=sk_test_...
WORKOS_COOKIE_PASSWORD=your-secret-here
```

### `.env.raindrop` - Raindrop Deployment
```bash
# Used by: npm run start, npm run deploy
# Location: NOT tracked in git
# Purpose: Syncing env vars to Raindrop deployment

WORKOS_CLIENT_ID=client_01K9...
WORKOS_CLIENT_SECRET=sk_test_...
WORKOS_COOKIE_PASSWORD=your-secret-here
ALLOWED_ORIGINS=https://soul-guardian.netlify.app,https://www.soul-guardian.com
```

### `.env.example` / `.env.raindrop.example` - Templates
```bash
# Used by: Developers for setup
# Location: Tracked in git
# Purpose: Template showing required variables (no secrets!)
```

---

## 🚀 Official Deployment Workflow

### ✅ CORRECT: First-Time Deployment

```bash
# 1. Create .env.raindrop with your values
cp .env.raindrop.example .env.raindrop
# Edit .env.raindrop with your actual credentials

# 2. Deploy (automatically sets env vars)
npm run start
```

**What happens:**
1. `prestart` script runs `./scripts/set-env.sh`
2. Env vars are read from `.env.raindrop`
3. Env vars are set in Raindrop using `raindrop build env set`
4. Deployment is created with `raindrop build deploy --start`
5. ✅ Env vars are attached to the new deployment

---

### ✅ CORRECT: Updating Existing Deployment

```bash
# Option 1: Quick update (amend existing deployment)
npm run deploy

# Option 2: Full restart (amend + restart)
npm run restart

# Option 3: Manual env update only
npm run env:set
```

**What happens:**
1. `predeploy` script runs `./scripts/set-env.sh`
2. Env vars are updated in Raindrop
3. Deployment is **amended** (same version ID)
4. ✅ Env vars persist across the update

---

### ❌ WRONG: What You Were Doing

```bash
# This is WRONG - creates new version without env vars
npm run prestart  # Sets env for OLD version
raindrop build deploy  # Creates NEW version (no env vars!)
```

**Problem:**
- `raindrop build deploy` creates a **new deployment version**
- Env vars are still attached to the **old version**
- New version has **no env vars** → deployment fails

---

## 📊 Deployment Commands Explained

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `npm run start` | Sets env vars + creates new deployment | First deployment |
| `npm run deploy` | Sets env vars + amends existing deployment | Code updates |
| `npm run restart` | Sets env vars + amends + restarts | Full restart needed |
| `npm run env:set` | Only sets env vars (no deploy) | Env var changes only |
| `npm run deploy:fresh` | Creates NEW deployment (no env vars!) | ⚠️ Rarely needed |

---

## 🔧 Manual Environment Variable Management

### View Current Env Vars

```bash
raindrop build env get api:env:WORKOS_CLIENT_ID
raindrop build env get api:env:ALLOWED_ORIGINS
```

### Set Individual Env Var

```bash
raindrop build env set api:env:ALLOWED_ORIGINS 'https://myapp.com,https://app.myapp.com'
```

### Set All Env Vars from File

```bash
npm run env:set
```

---

## 🐛 Troubleshooting

### Issue: "environment variables were not set and are required"

**Symptom:**
```
Warning: The following environment variables were not set...
```

**Cause:** You created a new deployment version without setting env vars

**Solution:**
```bash
# Option 1: Set env vars and amend
npm run deploy

# Option 2: Set env vars manually and deploy with --amend
npm run env:set
raindrop build deploy --amend
```

---

### Issue: Env vars get lost after deployment

**Cause:** Using `raindrop build deploy` without `--amend`

**Solution:** Use npm scripts instead:
```bash
# ✅ CORRECT
npm run deploy

# ❌ WRONG
raindrop build deploy
```

---

### Issue: Need to start fresh deployment

**Scenario:** You want to completely delete and recreate deployment

**Steps:**
```bash
# 1. Stop and delete current deployment
npm run stop
raindrop build delete .

# 2. Create new deployment with env vars
npm run start
```

---

## 📝 Best Practices

### ✅ DO

1. **Always use npm scripts** for deployment (`npm run deploy`, not `raindrop build deploy`)
2. **Keep `.env.raindrop` up to date** with all required variables
3. **Use `--amend`** for updates to preserve env vars
4. **Commit `.env.example`** templates to git (no secrets!)
5. **Document new env vars** in `.env.example` when added

### ❌ DON'T

1. **Don't run `raindrop build deploy` directly** (bypasses env var setup)
2. **Don't commit `.env` or `.env.raindrop`** files (contains secrets!)
3. **Don't create new deployments unnecessarily** (use `--amend` instead)
4. **Don't forget to run `npm run env:set`** after deleting a deployment
5. **Don't use `process.env` in Raindrop code** (use `c.env` instead)

---

## 🔐 Security Notes

### Git Ignore Status
✅ `.gitignore` includes:
```
.env
.env.raindrop
.dev.vars
```

### Checking What's Tracked
```bash
# Verify no secrets are tracked
git status
git ls-files | grep -E '\.(env|vars)$'

# Should return nothing (all env files ignored)
```

### If You Accidentally Commit Secrets
```bash
# Remove from git history
git rm --cached .env .env.raindrop
git commit -m "Remove sensitive env files"

# Rotate all secrets immediately!
# Update in WorkOS dashboard + .env.raindrop
```

---

## 📚 Reference

### Environment Variable Naming

In code:
```typescript
// ✅ Raindrop deployment
const clientId = c.env.WORKOS_CLIENT_ID

// ✅ Local development
const clientId = process.env.WORKOS_CLIENT_ID

// ✅ Works in both (from src/api/index.ts)
const value = c?.env?.VAR_NAME || process.env.VAR_NAME
```

In Raindrop CLI:
```bash
# Format: api:env:VARIABLE_NAME
raindrop build env set api:env:WORKOS_CLIENT_ID 'value'
```

In manifest:
```hcl
service "api" {
  env "WORKOS_CLIENT_ID" {
    secret = true
  }
}
```

---

## 🎯 Quick Reference Card

**First deployment:**
```bash
npm run start
```

**Update code:**
```bash
npm run deploy
```

**Update env vars:**
```bash
# Edit .env.raindrop
npm run env:set
```

**Full restart:**
```bash
npm run restart
```

**Check env vars:**
```bash
raindrop build env get api:env:WORKOS_CLIENT_ID
```

**View logs:**
```bash
npm run logs
```
