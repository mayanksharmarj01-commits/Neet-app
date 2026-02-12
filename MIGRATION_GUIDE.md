# Database Migration Guide

## ⚠️ IMPORTANT: Migration Order

Migrations **MUST** be run in the following order:

## Step-by-Step Migration

### 1. Base Schema (REQUIRED FIRST)
```sql
-- File: supabase/migrations/000_base_schema.sql
-- Creates: users, subjects, chapters, questions, user_answers
-- Run this FIRST!
```

### 2. System Flags (Optional but Recommended)
```sql
-- File: supabase/migrations/002_system_flags.sql
-- Creates: system_flags table for feature toggles
-- Run this SECOND
```

### 3. Mock Test System
```sql
-- File: supabase/migrations/003_mock_test_system.sql
-- Requires: 000_base_schema.sql
-- Creates: mock_tests, user_mock_attempts, rankings
```

### 4. Arena System
```sql
-- File: supabase/migrations/004_arena_system.sql
-- Requires: 000_base_schema.sql
-- Creates: arenas, arena_participants, arena_rankings
```

### 5. Razorpay Subscriptions
```sql
-- File: supabase/migrations/005_razorpay_subscriptions.sql
-- Requires: 000_base_schema.sql
-- Creates: subscription_plans, user_subscriptions, payment_transactions
```

### 6. Gemini AI System
```sql
-- File: supabase/migrations/006_gemini_ai_system.sql
-- Requires: 000_base_schema.sql, 002_system_flags.sql (for system_flags reference)
-- Creates: ai_token_limits, user_ai_usage, ai_interaction_logs
```

### 7. Admin Panel
```sql
-- File: supabase/migrations/007_admin_panel.sql
-- Requires: 001_base_schema.sql
-- Creates: admin_roles, user_roles, analytics_cache, banned_users
```

---

## Quick Migration Script

Run in Supabase SQL Editor in this exact order:

```sql
-- 1. REQUIRED: Base Schema
\i supabase/migrations/001_base_schema.sql

-- 2. Optional: System Flags (needed for AI)
-- Create this file if you want system-wide feature toggles
-- (Or AI migration will create it)

-- 3. Mock Test System
\i supabase/migrations/003_mock_test_system.sql

-- 4. Arena System
\i supabase/migrations/004_arena_system.sql

-- 5. Razorpay Subscriptions
\i supabase/migrations/005_razorpay_subscriptions.sql

-- 6. Gemini AI System
\i supabase/migrations/006_gemini_ai_system.sql

-- 7. Admin Panel
\i supabase/migrations/007_admin_panel.sql
```

---

## Verify Migrations

After running all migrations, verify:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should see:
-- admin_roles
-- ai_global_usage
-- ai_interaction_logs
-- ai_rate_limits
-- ai_token_limits
-- analytics_cache
-- arena_participants
-- arena_rankings
-- arenas
-- backup_history
-- banned_users
-- bulk_upload_history
-- chapters
-- leaderboard_cache
-- leaderboard_overrides
-- mock_tests
-- payment_transactions
-- question_edit_history
-- questions
-- subscription_plans
-- subjects
-- system_flags
-- user_activity
-- user_ai_usage
-- user_answers
-- user_churn
-- user_mock_answers
-- user_mock_attempts
-- user_roles
-- user_subscriptions
-- user_warnings
-- users
```

---

## Enable Supabase Realtime

After migrations, enable Realtime for these tables:

1. Go to Database → Replication
2. Enable for:
   - `arenas`
   - `arena_participants`

---

## Common Errors

### Error: "relation does not exist"

**Cause:** Running migrations out of order

**Fix:** 
1. Drop all tables: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
2. Re-run migrations in correct order (starting with 001)

### Error: "permission denied"

**Cause:** RLS policy conflict

**Fix:**
```sql
-- Temporarily disable RLS
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Re-run migration

-- Re-enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Error: "duplicate key value"

**Cause:** Data already exists (e.g., default subjects)

**Fix:** This is usually safe to ignore if using `ON CONFLICT DO NOTHING`

---

## Migration Checklist

- [ ] 001_base_schema.sql ✅
- [ ] 003_mock_test_system.sql
- [ ] 004_arena_system.sql
- [ ] 005_razorpay_subscriptions.sql
- [ ] 006_gemini_ai_system.sql
- [ ] 007_admin_panel.sql
- [ ] Enable Realtime (arenas, arena_participants)
- [ ] Verify all tables exist
- [ ] Test basic queries

---

## Next Steps After Migration

1. **Create Super Admin:**
```sql
-- Get your user ID (after signing up)
SELECT id, email FROM users WHERE email = 'your_email@example.com';

-- Assign super_admin role
INSERT INTO user_roles (user_id, role_id)
SELECT 'YOUR_USER_ID', id FROM admin_roles WHERE role_name = 'super_admin';
```

2. **Add Sample Questions:**
Use the admin panel CSV upload feature or insert manually:
```sql
INSERT INTO questions (subject_id, question_text, options, correct_answer, difficulty, marks)
SELECT 
    s.id,
    'Sample question?',
    '{"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"}'::jsonb,
    'A',
    'medium',
    4
FROM subjects s
WHERE s.name = 'Physics'
LIMIT 1;
```

3. **Test All Features:**
- Create mock test
- Join arena
- Subscribe to plan
- Use AI doubt solver
- Access admin dashboard

---

**Current Status:** Migration order corrected ✅  
**Next:** Run 001_base_schema.sql first, then others in order
