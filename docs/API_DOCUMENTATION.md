# Soul Guardian Backend API Documentation

## 🎯 Overview

This backend provides authentication and avatar management for the Soul Guardian application using:
- **Framework**: Hono (running on Cloudflare Workers via Raindrop)
- **Database**: SmartSQL (SQLite-compatible)
- **Storage**: SmartBucket (S3-compatible)
- **Authentication**: WorkOS + JWT cookies

## 🔐 Authentication

### POST `/auth/exchange` (Primary Endpoint)

Exchange a WorkOS authorization code for a JWT cookie.

**Request:**
```json
POST /auth/exchange
Content-Type: application/json

{
  "code": "workos_authorization_code_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

**Behavior:**
- Exchanges WorkOS code for user profile
- Creates/updates user in database
- Generates JWT with user ID
- Sets JWT in `auth_token` HttpOnly cookie (24-hour expiry)
- Cookie is Secure on HTTPS, non-Secure on HTTP (for local dev)

---

### POST `/auth/logout`

Clear authentication cookies.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### GET `/api/profile` (Protected)

Get authenticated user's profile information.

**Headers:**
```
Cookie: auth_token=<jwt_token>
```

**Response:**
```json
{
  "id": "user_01K9T496...",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

---

### POST `/auth/logout`

Logout user by clearing JWT cookie and providing WorkOS logout URL.

**Headers:**
```
Cookie: auth_token=<jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "workosLogoutUrl": "https://api.workos.com/user_management/sessions/logout?..."
}
```

**Frontend Flow:**
1. Call `POST /auth/logout` with credentials
2. Backend clears JWT cookie
3. Redirect user to `workosLogoutUrl` to clear WorkOS session
4. WorkOS redirects back to your configured logout redirect URI

**See:** [Complete Logout Flow Documentation](./LOGOUT_FLOW.md)

---

## 👤 Avatar Management

All avatar endpoints require authentication (JWT cookie).

### POST `/api/avatars`

Create a new avatar with optional photo upload.

**Request:**
```
POST /api/avatars
Content-Type: multipart/form-data
Cookie: auth_token=<jwt_token>

Fields:
- name: string (required)
- relationship: string (optional, default: "Friend")
- photo: File (optional)
```

**Response:**
```json
{
  "id": 1,
  "user_id": "user_01K9T496...",
  "name": "Guardian Angel",
  "relationship": "Spirit Guide",
  "photo_url": "/api/avatars/photo/user_01K9T496.../1234567890-photo.jpg"
}
```

---

### GET `/api/avatars`

List all avatars for the authenticated user.

**Headers:**
```
Cookie: auth_token=<jwt_token>
```

**Response:**
```json
[
  {
    "id": 1,
    "user_id": "user_01K9T496...",
    "name": "Guardian Angel",
    "relationship": "Spirit Guide",
    "photo_url": "/api/avatars/photo/..."
  }
]
```

---

### GET `/api/avatars/photo/:key`

Retrieve an avatar photo. Only accessible by the photo's owner.

**Headers:**
```
Cookie: auth_token=<jwt_token>
```

**Response:**
- Image file with appropriate Content-Type
- 403 Forbidden if accessing another user's photo
- 404 Not Found if photo doesn't exist

---

### DELETE `/api/avatars/:id`

Delete an avatar and its associated photo.

**Headers:**
```
Cookie: auth_token=<jwt_token>
```

**Response:**
```json
{
  "success": true
}
```

---

## 🔑 Environment Variables

### Required (Set in Raindrop):
```bash
WORKOS_CLIENT_ID=client_01K9...
WORKOS_CLIENT_SECRET=sk_test_...
WORKOS_COOKIE_PASSWORD=<32+ char random string>
```

### Optional:
```bash
ALLOWED_ORIGINS=https://myapp.com,https://app.myapp.com
```

---

## 🛠️ Development

### Local Development (with mocks):
```bash
npm run dev
# Runs on http://localhost:4000
# Uses mock database and storage
```

### Deploy to Raindrop:
```bash
npm run start
# Builds, deploys, and starts the application
# Uses real SmartDB and SmartBucket
```

### Other Commands:
```bash
npm run build     # Validate and build
npm run stop      # Stop running deployment
npm run status    # Check deployment status
npm run logs      # Tail application logs
```

---

## 📊 Database Schema

### `users` table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- WorkOS user ID
  email TEXT,
  first_name TEXT,
  last_name TEXT
);
```

### `avatars` table
```sql
CREATE TABLE avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'Friend',
  photo_url TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔒 Security Features

1. **JWT Authentication**
   - HttpOnly cookies (prevents XSS)
   - Secure flag on HTTPS
   - 24-hour expiration
   - Signed with WORKOS_COOKIE_PASSWORD

2. **CORS Protection**
   - Allowlist-based in production
   - Localhost allowed in development
   - Credentials enabled for cookies

3. **Avatar Access Control**
   - Users can only access their own avatars
   - Photo URLs contain user ID for validation
   - Foreign key cascade delete

4. **Input Validation**
   - Zod schema validation on avatar creation
   - SQL injection prevention (parameterized queries recommended)

---

## 🚀 Frontend Integration

### 1. WorkOS Authentication Flow

```typescript
// Step 1: Redirect user to WorkOS
const authUrl = workos.userManagement.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  provider: 'authkit', // or 'google', 'github', etc.
});
window.location.href = authUrl;

// Step 2: Handle callback (receives code)
const code = new URL(window.location.href).searchParams.get('code');

// Step 3: Exchange code for JWT cookie
const response = await fetch('https://api.yourapp.com/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
  credentials: 'include', // IMPORTANT: Include cookies
});

if (response.ok) {
  // Cookie is set! User is authenticated
  window.location.href = '/dashboard';
}
```

### 2. Making Authenticated Requests

```typescript
// All subsequent requests automatically include the cookie
const response = await fetch('https://api.yourapp.com/api/avatars', {
  credentials: 'include', // IMPORTANT: Include cookies
});

const avatars = await response.json();
```

### 3. Creating an Avatar with Photo

```typescript
const formData = new FormData();
formData.append('name', 'Guardian Angel');
formData.append('relationship', 'Spirit Guide');
formData.append('photo', photoFile); // File object from input

const response = await fetch('https://api.yourapp.com/api/avatars', {
  method: 'POST',
  body: formData,
  credentials: 'include',
});

const newAvatar = await response.json();
```

---

## 📝 Notes

- **Local Development**: Cookies work over HTTP for easier local testing
- **Production**: Cookies are Secure-only (HTTPS required)
- **WorkOS**: User ID from WorkOS is used as the primary database key
- **Avatar Photos**: Stored in SmartBucket with user ID prefix for security
