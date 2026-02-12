# Authentication System Architecture

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────────┤
│  Login Page          Signup Page         Consent Required Page      │
│  /auth/login         /auth/signup        /auth/consent-required     │
│     │                    │                        │                 │
│     │                    │                        │                 │
│     ▼                    ▼                        ▼                 │
│  LoginForm           SignupForm           ConsentForm               │
└─────────┬────────────────┬────────────────────────┬─────────────────┘
          │                │                        │
          │                │                        │
          ▼                ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API ROUTES                                 │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/auth/login                                              │
│  POST /api/auth/signup                                             │
│  POST /api/auth/logout                                             │
│  POST /api/auth/consent                                            │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          │  Calls
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTH SERVICE LAYER                             │
├─────────────────────────────────────────────────────────────────────┤
│  src/features/auth/services/auth.service.ts                        │
│                                                                     │
│  Functions:                                                         │
│  • getDeviceInfo()          - Extract device fingerprint           │
│  • checkIpBlock()           - Verify IP not blocked                │
│  • blockIp()                - Block suspicious IP                  │
│  • trackFailedLogin()       - Log failed attempts                  │
│  • checkDeviceChangeLimit() - Verify device changes < 3/month     │
│  • logDeviceChange()        - Record device change                │
│  • trackDevice()            - Update device tracking               │
│  • createUserSession()      - Create session record                │
│  • validateSession()        - Check session validity               │
│  • deactivateSession()      - Logout session                       │
│  • checkUserConsents()      - Verify required consents             │
│  • recordConsent()          - Save consent record                  │
│  • logIpActivity()          - Log IP actions                       │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          │  Queries
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  src/lib/supabase/server.ts                                        │
│  src/lib/supabase/client.ts                                        │
│                                                                     │
│  • Cookie-based session management                                 │
│  • Supabase Auth integration                                       │
│  • Row Level Security enforcement                                  │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          │  SQL Queries
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TABLES:                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  user_sessions   │  │ device_tracking  │  │device_changes_log│ │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤ │
│  │ • id             │  │ • id             │  │ • id             │ │
│  │ • user_id        │  │ • user_id        │  │ • user_id        │ │
│  │ • session_token  │  │ • device_id      │  │ • old_device_id  │ │
│  │ • device_id      │  │ • is_active      │  │ • new_device_id  │ │
│  │ • is_active      │  │ • last_seen_at   │  │ • year           │ │
│  │ • last_activity  │  │ • ip_address     │  │ • month          │ │
│  │ • expires_at     │  │ • user_agent     │  │ • changed_at     │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   ip_blocks      │  │  user_consents   │  │    ip_logs       │ │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤ │
│  │ • id             │  │ • id             │  │ • id             │ │
│  │ • ip_address     │  │ • user_id        │  │ • ip_address     │ │
│  │ • user_id        │  │ • consent_type   │  │ • user_id        │ │
│  │ • reason         │  │ • consent_version│  │ • action         │ │
│  │ • blocked_until  │  │ • consented_at   │  │ • status_code    │ │
│  │ • is_active      │  │ • ip_address     │  │ • is_suspicious  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  FUNCTIONS:                                                         │
│  • count_device_changes_current_month()                            │
│  • is_ip_blocked()                                                 │
│  • has_user_consent()                                              │
│  • deactivate_old_sessions()                                       │
│  • cleanup_expired_sessions()                                      │
│  • update_session_activity()                                       │
│                                                                     │
│  TRIGGERS:                                                          │
│  • trigger_deactivate_old_sessions (AFTER INSERT on user_sessions)│
│                                                                     │
│  INDEXES:                                                           │
│  • Partial unique index on user_sessions(user_id) WHERE is_active │
│  • Indexes on ip_address, device_id, session_token, etc.          │
└─────────────────────────────────────────────────────────────────────┘
```

## Request Flow Diagram

### Login Request Flow

```
User enters credentials
         │
         ▼
┌────────────────────┐
│   Login API        │
│  /api/auth/login   │
└─────────┬──────────┘
          │
          ├─► 1. getDeviceInfo()
          │   └─► Extract IP, User-Agent, Device ID
          │
          ├─► 2. checkIpBlock(ip)
          │   └─► Query ip_blocks table
          │       ├─► ✅ Not blocked → Continue
          │       └─► ❌ Blocked → Return 403
          │
          ├─► 3. Supabase Auth signInWithPassword()
          │   ├─► ✅ Success → Continue
          │   └─► ❌ Fail → trackFailedLogin() → Return 401
          │
          ├─► 4. Check user ban status
          │   └─► Query users.is_banned
          │       ├─► ✅ Not banned → Continue
          │       └─► ❌ Banned → signOut() → Return 403
          │
          ├─► 5. checkDeviceChangeLimit(userId, deviceId)
          │   └─► Call count_device_changes_current_month()
          │       ├─► ✅ < 3 changes → Continue
          │       └─► ❌ >= 3 changes → signOut() → Return 403
          │
          ├─► 6. Get previous device
          │   └─► Query device_tracking WHERE is_active = true
          │
          ├─► 7. If different device:
          │   └─► logDeviceChange(old_id, new_id)
          │       └─► INSERT into device_changes_log
          │
          ├─► 8. trackDevice(deviceInfo)
          │   └─► UPSERT device_tracking
          │       └─► Set is_active=true, deactivate others
          │
          ├─► 9. createUserSession(token, deviceInfo)
          │   └─► INSERT into user_sessions
          │       └─► TRIGGER: deactivate_old_sessions()
          │           └─► UPDATE other sessions SET is_active=false
          │
          ├─► 10. logIpActivity('login', userId)
          │   └─► INSERT into ip_logs
          │
          └─► 11. Return success + session
              └─► User redirected to /dashboard
```

### Middleware Protection Flow

```
User requests /dashboard
         │
         ▼
┌────────────────────┐
│   Middleware       │
│  src/middleware.ts │
└─────────┬──────────┘
          │
          ├─► 1. Get Supabase session from cookies
          │   ├─► ✅ Session exists → Continue
          │   └─► ❌ No session → Redirect to /auth/login
          │
          ├─► 2. Validate session in database
          │   └─► Query user_sessions WHERE session_token & is_active
          │       ├─► ✅ Found → Continue
          │       └─► ❌ Not found → Redirect to /auth/login?error=session_expired
          │
          ├─► 3. Check session expiry
          │   └─► Compare expires_at with NOW()
          │       ├─► ✅ Not expired → Continue
          │       └─► ❌ Expired → UPDATE is_active=false
          │                      → Redirect to /auth/login?error=session_expired
          │
          ├─► 4. Check inactivity timeout
          │   └─► Calculate (NOW - last_activity_at)
          │       ├─► ✅ < 30 minutes → Continue
          │       └─► ❌ >= 30 minutes → UPDATE is_active=false
          │                           → Redirect to /auth/login?error=session_timeout
          │
          ├─► 5. Check user ban status
          │   └─► Query users.is_banned
          │       ├─► ✅ Not banned → Continue
          │       └─► ❌ Banned → signOut()
          │                    → Redirect to /auth/login?error=account_banned
          │
          ├─► 6. Check required consents (for dashboard routes)
          │   └─► Query user_consents for terms & age
          │       ├─► ✅ Both present → Continue
          │       └─► ❌ Missing → Redirect to /auth/consent-required
          │
          ├─► 7. Update activity timestamp
          │   └─► UPDATE user_sessions SET last_activity_at=NOW()
          │
          └─► 8. Allow request to proceed
              └─► Dashboard loads
```

### Signup Request Flow

```
User fills signup form
         │
         ▼
┌────────────────────┐
│   Signup API       │
│  /api/auth/signup  │
└─────────┬──────────┘
          │
          ├─► 1. Validate input
          │   ├─► Email, password, fullName
          │   ├─► acceptTerms = true
          │   └─► ageConfirmation = true (18+)
          │
          ├─► 2. getDeviceInfo()
          │   └─► Extract IP, User-Agent, Device ID
          │
          ├─► 3. checkIpBlock(ip)
          │   └─► Verify IP not blocked
          │
          ├─► 4. Supabase Auth signUp()
          │   └─► Create auth.users record
          │
          ├─► 5. Create user profile
          │   └─► INSERT into users (id, email, full_name)
          │
          ├─► 6. Record Terms consent
          │   └─► INSERT into user_consents
          │       (type='terms_and_conditions', version='1.0')
          │
          ├─► 7. Record Age consent
          │   └─► INSERT into user_consents
          │       (type='age_declaration', metadata={age_confirmed: true})
          │
          ├─► 8. trackDevice(deviceInfo)
          │   └─► INSERT into device_tracking
          │
          ├─► 9. createUserSession(token)
          │   └─► INSERT into user_sessions
          │
          ├─► 10. logIpActivity('signup')
          │   └─► INSERT into ip_logs
          │
          └─► 11. Return success
              └─► User redirected to /dashboard
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: IP Protection                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Failed login tracking                              │  │
│  │ • Automatic IP blocking (5 failures)                 │  │
│  │ • 30-minute block duration                           │  │
│  │ • Risk scoring                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 2: Device Management                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Device fingerprinting                              │  │
│  │ • 3 device changes per month limit                   │  │
│  │ • Monthly auto-reset                                 │  │
│  │ • Change history logging                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 3: Session Control                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Single active session per user                     │  │
│  │ • 24-hour expiry                                     │  │
│  │ • 30-minute inactivity timeout                       │  │
│  │ • Automatic old session deactivation                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 4: Compliance & Consent                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Terms & Conditions gate                            │  │
│  │ • Age verification (18+)                             │  │
│  │ • Timestamped consent records                        │  │
│  │ • IP & user-agent logging                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Layer 5: Database Security                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Row Level Security (RLS) on all tables             │  │
│  │ • User can only see own data                         │  │
│  │ • Service role for backend operations                │  │
│  │ • Encrypted connections                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Example: Complete Login Journey

```
1. User enters email + password on /auth/login
   ↓
2. Frontend: LoginForm submits to /api/auth/login
   ↓
3. API: Extract device info (IP: 203.0.113.1, Device: abc123)
   ↓
4. API: Check ip_blocks table
   → No active block for 203.0.113.1 ✅
   ↓
5. API: Call Supabase Auth signInWithPassword()
   → Credentials valid ✅
   ↓
6. API: Query users table
   → is_banned = false ✅
   ↓
7. API: Call count_device_changes_current_month()
   → Returns 1 (< 3) ✅
   ↓
8. API: Query device_tracking for active device
   → Last device: xyz789 (different from abc123)
   ↓
9. API: INSERT into device_changes_log
   → Record change from xyz789 to abc123
   ↓
10. API: UPSERT device_tracking
    → Set abc123 as active, deactivate xyz789
    ↓
11. API: INSERT into user_sessions
    → session_token: token123, device_id: abc123
    → TRIGGER fires: deactivate_old_sessions()
    → All other sessions for this user marked inactive
    ↓
12. API: INSERT into ip_logs
    → action: 'login', status_code: 200
    ↓
13. API: Return success to frontend
    ↓
14. Frontend: Redirect to /dashboard
    ↓
15. Middleware: Intercept request
    ↓
16. Middleware: Get session from cookie
    → session_token: token123 ✅
    ↓
17. Middleware: Query user_sessions
    → Found, is_active = true ✅
    ↓
18. Middleware: Check expires_at
    → Not expired ✅
    ↓
19. Middleware: Check last_activity_at
    → < 30 minutes ✅
    ↓
20. Middleware: Check users.is_banned
    → false ✅
    ↓
21. Middleware: Query user_consents
    → Has terms consent ✅
    → Has age consent ✅
    ↓
22. Middleware: UPDATE user_sessions
    → SET last_activity_at = NOW()
    ↓
23. Middleware: Allow request
    ↓
24. Dashboard page loads successfully 🎉
```

---

**This architecture ensures:**
- ✅ Multiple layers of security
- ✅ Complete audit trail
- ✅ GDPR compliance
- ✅ Scalable to 50k+ users
- ✅ Zero mock functions - all database-backed
