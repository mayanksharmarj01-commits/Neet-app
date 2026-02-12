# 🚀 Quick Start Guide: Authentication System

## Setup Steps

### 1. Database Setup

1. **Apply Main Schema**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste contents of `supabase/schema.sql`
   - Run the query

2. **Apply Auth Migration**
   - In SQL Editor, create a new query
   - Copy and paste contents of `supabase/migrations/001_auth_enhancements.sql`
   - Run the query

3. **Verify Tables Created**
   ```sql
   -- Check if all tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

   You should see:
   - users
   - user_sessions
   - user_consents
   - device_tracking
   - device_changes_log
   - ip_blocks
   - ip_logs
   - (and all other tables from schema)

### 2. Environment Setup

Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install Dependencies

```bash
npm install
```

Required packages (should already be installed):
- `@supabase/ssr`
- `@supabase/supabase-js`
- `next`
- `react`

### 4. Run Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000/auth/login`

## Testing the System

### Test 1: User Signup
1. Go to `/auth/signup`
2. Fill in:
   - Full Name
   - Email
   - Password (min 8 characters)
   - Confirm Password
3. Check "I am 18 years or older"
4. Check "I agree to Terms and Conditions"
5. Click "Create Account"
6. Should redirect to `/dashboard`

### Test 2: Login
1. Go to `/auth/login`
2. Enter email and password
3. Click "Sign In"
4. Should redirect to `/dashboard`

### Test 3: Consent Gate
1. Create a new user via Supabase Auth directly (SQL):
   ```sql
   -- This creates a user without consents
   ```
2. Try to login
3. Should redirect to `/auth/consent-required`
4. Accept both consents
5. Should then allow dashboard access

### Test 4: Single Session Enforcement
1. Login on Browser A
2. Login with same account on Browser B
3. Browser A should be logged out (middleware will catch it on next request)

### Test 5: Device Limit
1. Login from 3 different devices/browsers (clear cookies to simulate new device)
2. On the 4th attempt, you should get:
   > "Device change limit reached. You can only change devices 3 times per month."

### Test 6: IP Blocking
1. Try to login with wrong password 6 times
2. After 5 failed attempts, you should see:
   > "Your IP address has been temporarily blocked due to suspicious activity"

### Test 7: Inactivity Timeout
1. Login successfully
2. Leave the browser idle for 30+ minutes
3. Try to navigate or refresh
4. Should auto-logout with message:
   > "Your session timed out due to inactivity"

## Verify Database Records

After testing, check the database:

```sql
-- Check user consents
SELECT * FROM user_consents WHERE user_id = 'your-user-id';

-- Check active sessions
SELECT * FROM user_sessions WHERE is_active = true;

-- Check device tracking
SELECT * FROM device_tracking WHERE user_id = 'your-user-id';

-- Check IP logs
SELECT * FROM ip_logs ORDER BY created_at DESC LIMIT 10;

-- Check device changes
SELECT * FROM device_changes_log WHERE user_id = 'your-user-id';

-- Check IP blocks
SELECT * FROM ip_blocks WHERE is_active = true;
```

## Common Issues

### Issue: "Session not found or inactive"
- **Cause**: Session was deactivated or expired
- **Fix**: Login again

### Issue: "CORS error" when calling API
- **Cause**: API route misconfiguration
- **Fix**: Ensure middleware is not blocking API routes

### Issue: Device tracking not working
- **Cause**: RLS policies or missing functions
- **Fix**: Run migration again, verify `count_device_changes_current_month()` exists

### Issue: IP blocking not triggering
- **Cause**: Function not created or RLS blocking service role
- **Fix**: Verify `is_ip_blocked()` function exists

### Issue: Consent gate keeps redirecting
- **Cause**: Consents not being saved
- **Fix**: Check `/api/auth/consent` route is working, verify RLS policies

## API Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "fullName": "Test User",
    "acceptTerms": true,
    "ageConfirmation": true
  }'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: your-session-cookie"
```

## Production Deployment

### Before deploying:

1. **Set environment variables** in Vercel/production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Verify Supabase Settings**:
   - Enable email confirmations (Settings → Auth)
   - Set redirect URLs (add your production domain)
   - Configure SMTP for email (optional)

3. **Setup Cleanup Cron Job**:
   - Use Vercel Cron or external service
   - Call cleanup function daily:
     ```sql
     SELECT cleanup_expired_sessions();
     ```

4. **Enable RLS** on all tables (should already be done)

5. **Test in production** before public launch

## Monitoring

### Key Metrics to Track

1. **Failed Login Count**
   ```sql
   SELECT COUNT(*) FROM ip_logs 
   WHERE action = 'failed_login' 
   AND created_at > NOW() - INTERVAL '1 day';
   ```

2. **Active Sessions**
   ```sql
   SELECT COUNT(*) FROM user_sessions WHERE is_active = true;
   ```

3. **Device Changes This Month**
   ```sql
   SELECT COUNT(*) FROM device_changes_log 
   WHERE year = EXTRACT(YEAR FROM NOW())
   AND month = EXTRACT(MONTH FROM NOW());
   ```

4. **IP Blocks Active**
   ```sql
   SELECT COUNT(*) FROM ip_blocks 
   WHERE is_active = true AND blocked_until > NOW();
   ```

## Next Steps

After setup:
1. ✅ Customize error messages in components
2. ✅ Add email templates for Supabase Auth
3. ✅ Implement forgot password flow
4. ✅ Add 2FA (optional)
5. ✅ Setup monitoring dashboard
6. ✅ Configure email notifications for suspicious activity
7. ✅ Add rate limiting middleware
8. ✅ Implement session management UI (view active devices)

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs
3. Verify all migrations ran successfully
4. Check RLS policies are enabled
5. Review `AUTH_SYSTEM.md` for detailed documentation

---

**Happy Coding! 🎉**
