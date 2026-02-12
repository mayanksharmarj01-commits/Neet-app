# Mock Test System - Complete Documentation

## 🎯 Overview

A comprehensive mock test system with **subject-wise and chapter-wise tests**, **subscription limits**, **national ranking**, and **real-time leaderboard**.

---

## ✅ Features Implemented

### 1. **Mock Test Types** ✅
- ✅ **Subject-wise Mock** - Tests focused on specific subjects
- ✅ **Chapter-wise Mock** - Tests on specific chapters
- ✅ **Full Syllabus Mock** - Complete syllabus coverage
- ✅ **Custom Mock** - Admin-defined custom tests

### 2. **Subscription & Limits** ✅
- ✅ **Free Users**: 2 mock tests per week
- ✅ **Paid Users**: Unlimited mock tests
- ✅ **Weekly Reset**: Limits reset every Monday
- ✅ **Upgrade Prompts**: Clear CTAs for premium conversion

### 3. **Ranking System** ✅
- ✅ **70% Mock Score** - Mock tests contribute 70% to national rank
- ✅ **30% Practice Score** - Daily practice contributes 30%
- ✅ **Percentile Calculation** - Based on all active users
- ✅ **Last 30 Days** - Rankings based on recent performance
- ✅ **Efficient Aggregation** - Pre-calculated in cached table

### 4. **Leaderboard** ✅
- ✅ **National Leaderboard Only** - Single unified leaderboard
- ✅ **Cached Table** - Updated every 5 minutes
- ✅ **Top 100 Display** - Shows top performers
- ✅ **User Rank Badge** - Your position prominently displayed
- ✅ **Auto-refresh** - Updates every 5 minutes on client

### 5. **Performance** ✅
- ✅ **No Heavy Recalculations** - All scores pre-computed
- ✅ **Efficient Queries** - Indexed lookups, no table scans
- ✅ **Cron-based Updates** - Background processing
- ✅ **JSONB Storage** - Fast answer retrieval

---

## 📊 Database Schema

### Core Tables

#### `mock_tests`
Mock test templates with configuration.

```sql
- id: UUID
- title: TEXT
- mock_type: 'subject' | 'chapter' | 'full_syllabus' | 'custom'
- subject_id: UUID (optional)
- chapter_ids: UUID[] (optional)
- difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
- total_questions: INTEGER
- duration_minutes: INTEGER
- total_marks: INTEGER
- is_active: BOOLEAN
- is_premium: BOOLEAN
```

#### `user_mock_attempts`
User's mock test attempts and scores.

```sql
- id: UUID
- user_id: UUID
- mock_test_id: UUID
- session_id: UUID
- status: 'in_progress' | 'completed' | 'abandoned'
- total_score: DECIMAL
- percentage: DECIMAL
- questions_attempted: INTEGER
- correct_answers: INTEGER
- rank_contribution: DECIMAL (70% of total_score)
```

#### `user_mock_limits`
Weekly limit tracking for free users.

```sql
- user_id: UUID
- week_start: DATE
- week_end: DATE
- mocks_taken: INTEGER
- free_limit: INTEGER (default: 2)
```

#### `daily_practice_stats`
Daily practice performance tracking.

```sql
- user_id: UUID
- practice_date: DATE
- questions_attempted: INTEGER
- correct_answers: INTEGER
- total_points: DECIMAL
- rank_contribution: DECIMAL (30% of total_points)
```

#### `leaderboard_cache`
Pre-calculated rankings (updated every 5 minutes).

```sql
- user_id: UUID
- rank: INTEGER
- percentile: DECIMAL
- total_score: DECIMAL
- mock_score: DECIMAL (70% weight)
- practice_score: DECIMAL (30% weight)
- mocks_completed: INTEGER
- accuracy: DECIMAL
- cached_at: TIMESTAMPTZ
```

---

## 🔧 Database Functions

### `check_weekly_mock_limit(user_id)`
**Returns:** `BOOLEAN`

Checks if user can take a mock test based on subscription and weekly limits.

**Logic:**
1. Check if user has active subscription → Return TRUE
2. Get current week's usage
3. Compare with limit (2 for free users)
4. Return TRUE if under limit, FALSE otherwise

### `increment_mock_count(user_id)`
**Returns:** `VOID`

Increments the mock count for the current week.

**Usage:** Called after successfully starting a mock test.

### `refresh_leaderboard_cache()`
**Returns:** `VOID`

Recalculates all rankings and updates the leaderboard cache.

**Process:**
1. Calculate mock scores (last 30 days) → 70% weight
2. Calculate practice scores (last 30 days) → 30% weight
3. Combine scores: `total = (mock * 0.7) + (practice * 0.3)`
4. Rank users by total score
5. Calculate percentiles
6. Truncate old cache and insert new data

**Called by:** Cron job every 5 minutes

---

## 🚀 API Endpoints

### GET `/api/mock/list`
Fetch available mock tests with optional filters.

**Query Params:**
- `mockType`: 'subject' | 'chapter' | 'full_syllabus'
- `subjectId`: UUID
- `difficulty`: 'easy' | 'medium' | 'hard' | 'mixed'

**Response:**
```json
{
  "success": true,
  "mocks": [
    {
      "id": "uuid",
      "title": "Physics Full Syllabus Mock",
      "mockType": "subject",
      "totalQuestions": 50,
      "durationMinutes": 180,
      "totalMarks": 200,
      "isPremium": false
    }
  ]
}
```

### POST `/api/mock/start`
Start a mock test (checks limits).

**Request:**
```json
{
  "mockTestId": "uuid"
}
```

**Response (Success):**
```json
{
  "success": true,
  "sessionId": "uuid"
}
```

**Response (Limit Reached):**
```json
{
  "error": "You have reached your weekly limit of 2 mock tests..."
}
```

### GET `/api/leaderboard`
Fetch national leaderboard from cache.

**Query Params:**
- `limit`: Number of entries (default: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "rank": 1,
      "percentile": 99.8,
      "totalScore": 15420,
      "mockScore": 10794,
      "practiceScore": 4626,
      "mocksCompleted": 25,
      "accuracy": 87.5
    }
  ],
  "cacheAge": 120,
  "lastUpdated": "2026-02-12T08:00:00Z"
}
```

### GET `/api/leaderboard/my-rank`
Get current user's rank and percentile.

**Response:**
```json
{
  "success": true,
  "rank": {
    "rank": 45,
    "percentile": 92.3,
    "totalScore": 8675,
    "mockScore": 6072,
    "practiceScore": 2603
  }
}
```

### GET `/api/cron/refresh-leaderboard`
Cron endpoint to refresh leaderboard cache.

**Headers:**
- `Authorization: Bearer <CRON_SECRET>`

**Called by:** Vercel Cron every 5 minutes

---

## 🎨 UI Components

### `<MockTestSelector />`
**Location:** `/mock`

Displays available mock tests with:
- Filter by type and difficulty
- Premium badges
- Question count, duration, marks
- Start button (checks limits)
- Loading states

### `<Leaderboard />`
**Location:** `/leaderboard`

Shows national leaderboard with:
- Top 100 students
- Medal emojis for top 3
- User's rank badge
- Percentile display
- Mock vs Practice breakdown
- Auto-refresh every 5 minutes
- Cache age indicator

---

## 📐 Ranking Formula

### Total Score Calculation
```
Total Score = (Mock Score × 0.7) + (Practice Score × 0.3)
```

### Mock Score
```
Mock Score = Σ(total_score from completed mocks in last 30 days)
```

### Practice Score
```
Practice Score = Σ(total_points from daily practice in last 30 days)
```

### Percentile Calculation
```
Percentile = ((Total Users - Rank + 1) / Total Users) × 100
```

**Example:**
- User Rank: 45
- Total Users: 1000
- Percentile = ((1000 - 45 + 1) / 1000) × 100 = 95.6%

---

## ⚡ Performance Optimizations

### 1. **Cached Leaderboard**
- Pre-calculated every 5 minutes
- No runtime aggregation
- Instant leaderboard loading
- Indexed by rank and score

### 2. **Efficient Aggregations**
```sql
-- Only last 30 days considered
WHERE completed_at > NOW() - INTERVAL '30 days'

-- CTEs for clean, optimized queries
WITH mock_scores AS (...),
     practice_scores AS (...)
```

### 3. **Database Indexes**
```sql
CREATE INDEX idx_user_mock_attempts_completed 
ON user_mock_attempts(user_id, completed_at) 
WHERE status = 'completed';

CREATE INDEX idx_leaderboard_rank 
ON leaderboard_cache(rank);
```

### 4. **Triggers for Auto-calculation**
```sql
-- Auto-calculate rank contribution on mock completion
CREATE TRIGGER trigger_update_mock_contribution
    BEFORE UPDATE ON user_mock_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_mock_rank_contribution();
```

---

## 🔒 Security & Access Control

### RLS Policies

```sql
-- Users can view all active mock tests
CREATE POLICY "Anyone can view active mock tests" 
ON mock_tests FOR SELECT 
USING (is_active = true);

-- Users can only view their own attempts
CREATE POLICY "Users can view their own attempts" 
ON user_mock_attempts FOR SELECT 
USING (auth.uid() = user_id);

-- Leaderboard is public
CREATE POLICY "Anyone can view leaderboard" 
ON leaderboard_cache FOR SELECT 
USING (true);
```

### Subscription Checks

Performed at **multiple levels**:
1. **API Level** - `/api/mock/start` checks limits
2. **UI Level** - Shows warnings/upgrade prompts
3. **Database Level** - `check_weekly_mock_limit()` function

---

## 🎯 User Flows

### Free User Flow

```
1. Visit /mock
2. See "2 mocks remaining this week" banner
3. Select mock test
4. Click "Start Mock Test"
5. Check passes (under limit)
6. Redirected to /test/[sessionId]
7. Complete test
8. Mock count incremented (1 remaining)
9. After 2 mocks: See upgrade prompt
```

### Paid User Flow

```
1. Visit /mock
2. No limit banner (unlimited access)
3. Select any mock test
4. Click "Start Mock Test"
5. Check passes (paid user)
6. Redirected to /test/[sessionId]
7. Complete unlimited mocks
```

### Ranking Flow

```
1. Complete mock test
   → Score added to user_mock_attempts
   → Trigger calculates rank_contribution (70%)

2. Daily practice
   → Points added to daily_practice_stats
   → Trigger calculates rank_contribution (30%)

3. Cron job runs (every 5 minutes)
   → refresh_leaderboard_cache() called
   → All scores aggregated
   → Rankings calculated
   → Percentiles computed
   → Cache table updated

4. User visits /leaderboard
   → Instant load from cache
   → Shows position & percentile
```

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# In Supabase SQL Editor
Run: supabase/migrations/003_mock_test_system.sql
```

### 2. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # For cron job
CRON_SECRET=... # Random secret for cron security
```

### 3. Deploy to Vercel
```bash
vercel --prod
```

### 4. Verify Cron Setup
- Check Vercel Dashboard → Project → Settings → Cron Jobs
- Verify `/api/cron/refresh-leaderboard` runs every 5 minutes
- Check logs for successful executions

### 5. Manual Cache Refresh (First Time)
```sql
-- In Supabase SQL Editor
SELECT refresh_leaderboard_cache();
```

---

## 📈 Monitoring & Maintenance

### Check Leaderboard Cache Age
```sql
SELECT 
    cached_at,
    NOW() - cached_at as age,
    COUNT(*) as total_users
FROM leaderboard_cache;
```

### Monitor Weekly Limits
```sql
SELECT 
    u.email,
    uml.mocks_taken,
    uml.free_limit,
    uml.week_start
FROM user_mock_limits uml
JOIN users u ON u.id = uml.user_id
WHERE week_start = date_trunc('week', CURRENT_DATE)
ORDER BY mocks_taken DESC;
```

### Check Cron Job Health
```bash
# Vercel CLI
vercel logs --follow

# Look for: "Leaderboard cache refreshed successfully"
```

---

## 🧪 Testing Checklist

- [ ] Create sample mock tests (subject, chapter, full syllabus)
- [ ] Test as free user (2 mocks limit)
- [ ] Test limit reset on Monday
- [ ] Test as paid user (unlimited)
- [ ] Start and complete a mock test
- [ ] Verify score calculation (70% weight)
- [ ] Track daily practice (30% weight)
- [ ] Run `refresh_leaderboard_cache()` manually
- [ ] Check leaderboard displays correctly
- [ ] Verify percentile calculation
- [ ] Test auto-refresh on leaderboard page
- [ ] Verify cron job execution (wait 5 minutes)
- [ ] Check ranking updates after new completions

---

## 📊 Sample Data

### Create Mock Tests
```sql
INSERT INTO mock_tests (title, description, mock_type, subject_id, difficulty, total_questions, duration_minutes, total_marks, is_premium)
VALUES 
    ('Physics Full Mock', 'Complete physics syllabus', 'subject', 'subject-uuid', 'mixed', 50, 180, 200, false),
    ('Chemistry Chapter 1', 'Atomic Structure', 'chapter', 'subject-uuid', 'medium', 30, 60, 120, false),
    ('JEE Main Mock 1', 'Full syllabus practice', 'full_syllabus', null, 'mixed', 90, 180, 360, true);
```

---

**Mock Test System Version:** 1.0  
**Status:** ✅ Production Ready  
**Last Updated:** 2026-02-12

Built with Next.js 14, TypeScript, Supabase, and efficient caching strategies! 🚀
