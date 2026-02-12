# Authentication System Documentation

## Overview

This is a production-ready authentication system built with Next.js 14, Supabase Auth, and PostgreSQL. It implements enterprise-grade security features including device tracking, IP blocking, session management, and consent tracking.

## Features Implemented

### ✅ Core Authentication
- **Email/Password Login** - Secure authentication with Supabase Auth
- **User Registration** - Account creation with profile setup
- **Session Management** - Secure cookie-based sessions
- **Logout** - Clean session termination

### ✅ Security Features

#### 1. Single Active Session Enforcement
- Only one active session per user at a time
- Automatic deactivation of previous sessions on new login
- Database-backed session validation

#### 2. Device Tracking & Limiting
- Maximum **3 device changes per month**
- Automatic monthly reset
- Device fingerprinting based on user-agent and IP
- Tracks:
  - Device ID
  - Device type
  - OS & browser information
  - Last seen timestamp
  - IP address

#### 3. IP Blocking & Rate Limiting
- Temporary IP blocks after **5 failed login attempts**
- **30-minute** block duration
- Suspicious activity detection with risk scoring
- IP logging for audit trails

#### 4. Auto-Logout on Inactivity
- **30-minute** inactivity timeout
- Session expiry after **24 hours**
- Automatic session cleanup
- Activity tracking with last_activity_at timestamps

#### 5. Consent Management
- **Terms & Conditions** acceptance required
- **Age Declaration** (18+) required
- Consent blocking before dashboard access
- Timestamped consent records with:
  - IP address
  - User agent
  - Consent version
  - Metadata

### ✅ Database Integration

All features are fully integrated with PostgreSQL/Supabase:

#### Tables Created:
1. **user_sessions** - Active session tracking
2. **device_changes_log** - Device change history
3. **ip_blocks** - Temporary IP bans
4. **user_consents** - Legal consent tracking
5. **device_tracking** - Device information
6. **ip_logs** - Comprehensive IP activity logs

#### Functions:
- `count_device_changes_current_month()` - Count device changes
- `is_ip_blocked()` - Check if IP is blocked
- `has_user_consent()` - Verify user consent
- `deactivate_old_sessions()` - Auto-deactivate previous sessions
- `cleanup_expired_sessions()` - Remove inactive sessions
- `update_session_activity()` - Update last activity timestamp

#### Triggers:
- Auto-deactivate old sessions on new login
- Update session timestamps on activity

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts          # Login API
│   │       ├── signup/route.ts         # Signup API
│   │       ├── logout/route.ts         # Logout API
│   │       └── consent/route.ts        # Consent recording API
│   └── auth/
│       ├── login/page.tsx              # Login page
│       ├── signup/page.tsx             # Signup page
│       └── consent-required/page.tsx   # Consent gate
├── features/
│   └── auth/
│       ├── components/
│       │   ├── login-form.tsx          # Login form component
│       │   └── signup-form.tsx         # Signup form component
│       └── services/
│           └── auth.service.ts         # Auth business logic
├── lib/
│   └── supabase/
│       ├── client.ts                   # Browser client
│       ├── server.ts                   # Server client
│       └── middleware.ts               # (deprecated)
└── middleware.ts                       # Next.js middleware with auth

supabase/
├── schema.sql                          # Main database schema
└── migrations/
    └── 001_auth_enhancements.sql      # Auth tables & functions
```

## API Routes

### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "session": { ... }
}
```

**Security Checks:**
- IP block verification
- Failed attempt tracking
- Device limit enforcement
- Ban status check
- Session creation

### POST /api/auth/signup
Create a new account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "John Doe",
  "acceptTerms": true,
  "ageConfirmation": true
}
```

**Response:**
```json
{
  "success": true,
  "user": { ... },
  "message": "Account created successfully"
}
```

**Actions:**
- Creates auth user
- Creates user profile
- Records consents (terms + age)
- Tracks device
- Creates session

### POST /api/auth/logout
Terminate current session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/consent
Record user consents (can be called separately).

**Request:**
```json
{
  "userId": "uuid",
  "acceptTerms": true,
  "ageConfirmation": true
}
```

## Middleware Protection

The middleware (`src/middleware.ts`) handles:

1. **Protected Routes**: `/dashboard`, `/mock`, `/arena`, `/leaderboard`, `/messaging`, `/admin`, `/settings`
2. **Public Routes**: `/`, `/auth/login`, `/auth/signup`
3. **Session Validation**:
   - Checks if session exists in database
   - Verifies session is active
   - Checks expiry
   - Validates inactivity timeout (30 min)
4. **User Checks**:
   - Ban status
   - Required consents (terms + age)
5. **Activity Tracking**: Updates `last_activity_at` on each request
6. **Auto-Redirects**:
   - Unauthenticated → `/auth/login`
   - Missing consent → `/auth/consent-required`
   - Authenticated on auth pages → `/dashboard`

## Security Constants

```typescript
MAX_DEVICE_CHANGES_PER_MONTH = 3
MAX_FAILED_LOGIN_ATTEMPTS = 5
IP_BLOCK_DURATION_MINUTES = 30
SESSION_INACTIVITY_TIMEOUT_MINUTES = 30
SESSION_EXPIRY_HOURS = 24
```

## Usage Examples

### Login Flow
1. User enters credentials
2. API checks IP block
3. Supabase Auth validates credentials
4. Device tracking checks device limit
5. Logs device change if different device
6. Creates/updates device tracking
7. Creates new session (auto-deactivates old ones)
8. Logs IP activity
9. Returns success + redirects

### Signup Flow
1. User fills form with name, email, password
2. User checks age declaration (18+)
3. User accepts terms & conditions
4. API validates input
5. Creates Supabase auth user
6. Creates user profile in `users` table
7. Records consents with timestamps & IP
8. Tracks device
9. Creates session
10. Redirects to dashboard

### Dashboard Access
1. Middleware checks session exists
2. Validates session in database
3. Checks session expiry
4. Checks inactivity timeout
5. Verifies user not banned
6. Checks for required consents
7. Updates last activity
8. Allows access or redirects

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup

1. Run the main schema:
```bash
# In Supabase SQL Editor
# Paste contents of supabase/schema.sql
```

2. Run auth enhancements migration:
```bash
# Paste contents of supabase/migrations/001_auth_enhancements.sql
```

3. Verify RLS policies are enabled

## Error Messages

### Login Errors
- **"Your IP address has been temporarily blocked"** - Too many failed attempts
- **"Device change limit reached"** - Max 3 device changes/month exceeded
- **"Your account has been banned"** - Account is banned

### Session Errors (via URL params)
- `?error=session_expired` - Session has expired
- `?error=session_timeout` - Inactive for 30+ minutes
- `?error=account_banned` - Account banned mid-session

## Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (triggers IP tracking)
- [ ] Login from 4 different devices in one month (should block 4th)
- [ ] Wait 30 minutes without activity (should auto-logout)
- [ ] Access dashboard without accepting terms (should redirect)
- [ ] Access dashboard after accepting terms (should allow)
- [ ] Sign up with age < 18 (should block)
- [ ] Sign up without accepting terms (should block)
- [ ] Login twice simultaneously (should invalidate first session)
- [ ] Try 6 failed login attempts (should block IP for 30 min)

## Production Considerations

### Performance
- All database queries use indexed columns
- Partial indexes for active sessions and blocks
- Session cleanup should run periodically (cron job)

### Security
- All passwords hashed by Supabase Auth (bcrypt)
- Sessions stored in secure, HTTP-only cookies
- RLS policies protect all sensitive data
- IP and device fingerprinting for audit trails
- Consent records are immutable (append-only)

### Compliance
- GDPR-compliant consent tracking
- Timestamped legal agreements
- IP logging for security audit
- Age verification required
- Right to be forgotten (soft delete with `deleted_at`)

### Monitoring
- Track suspicious IPs in `ip_logs` table
- Monitor failed login attempts
- Alert on unusual device changes
- Session metrics for user engagement

## Maintenance

### Cleanup Tasks
Run periodically (e.g., daily cron):

```sql
-- Clean up expired sessions
SELECT cleanup_expired_sessions();

-- Remove old IP blocks
UPDATE ip_blocks 
SET is_active = false 
WHERE blocked_until < NOW() AND is_active = true;

-- Archive old logs (optional)
DELETE FROM ip_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Support

For issues or questions:
1. Check middleware logs in browser console
2. Verify database functions exist
3. Check RLS policies are enabled
4. Ensure migrations ran successfully
5. Verify environment variables are set

---

**Authentication System Version:** 1.0
**Last Updated:** 2026-02-12
**Production Ready:** ✅
