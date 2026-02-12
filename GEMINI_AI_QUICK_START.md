# Gemini AI System - Quick Start Guide

## ✅ All Requirements Implemented

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Text-based doubt solver | ✅ | AI-powered Q&A system |
| AI performance coach | ✅ | Personalized coaching analysis |
| Token usage visible | ✅ | Real-time usage widget |
| Daily per-user limit | ✅ | 10,000 tokens/user/day |
| Global daily cap | ✅ | 1,000,000 tokens/day total |
| Peak hours disable | ✅ | Via system_flags (10 AM - 6 PM IST) |
| Log all AI usage | ✅ | Detailed interaction logs |
| Rate limiting | ✅ | 5 requests/minute/user |
| Cost control | ✅ | Multi-layer safeguards |
| Error handling | ✅ | Graceful degradation |

---

## 🚀 Setup (5 Minutes)

### Step 1: Get Gemini API Key

```
1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key
```

### Step 2: Install Package (✅ Already Done!)

```bash
npm install @google/generative-ai
```

### Step 3: Add Environment Variable

```bash
# Add to .env.local
GEMINI_API_KEY=AIzaSy...
```

### Step 4: Apply Database Migration

```sql
-- In Supabase SQL Editor
-- Run: supabase/migrations/006_gemini_ai_system.sql
```

### Step 5: Test

```bash
npm run dev
# Visit: http://localhost:3000/ai/doubt-solver
```

---

## 🛡️ Multi-Layer Protection

### Protection Flow

```
Request arrives
    ↓
Layer 1: System Flags
✓ AI enabled globally?
✓ Not peak hours (10 AM - 6 PM IST)?
    ↓
Layer 2: Rate Limiting
✓ Under 5 requests/minute?
    ↓
Layer 3: User Daily Quota
✓ Under 10,000 tokens/day?
    ↓
Layer 4: Global Daily Cap
✓ Under 1,000,000 tokens/day?
    ↓
Layer 5: Prompt Validation
✓ Valid length (< 5000 chars)?
✓ No prohibited patterns?
    ↓
✅ Process Request
    ↓
Log usage:
- Update user_ai_usage
- Insert ai_interaction_logs
- Update ai_global_usage
    ↓
Return response + token count
```

---

## 💰 Cost Breakdown

### Pricing (Gemini 1.5 Flash)

```
$0.075 per 1 million tokens
= $0.000000075 per token
```

### Example Costs

```
Single doubt solver request:
- Input: ~200 tokens
- Output: ~800 tokens
- Total: ~1,000 tokens
- Cost: $0.000075 (negligible!)

Daily per user (max):
- Limit: 10,000 tokens
- Cost: $0.00075/day
- Monthly: $0.0225/user

Global daily (max):
- Cap: 1,000,000 tokens
- Cost: $0.075/day
- Monthly: $2.25 total

Realistic usage (10% of limit):
- ~100,000 tokens/day globally
- Cost: $0.0075/day
- Monthly: ~$0.23
```

### Budget Safety

```
Hard caps prevent:
❌ Runaway costs
❌ Surprise bills
❌ Unlimited usage

✅ Max monthly cost: $2.25
✅ Predictable spending
✅ No overages
```

---

## 🎯 Key Features

### 1. Doubt Solver

**What it does:**
- Answers questions on any topic
- Provides detailed explanations
- Uses context (subject, difficulty)
- Educational focus

**Example:**
```
Question: "What is Newton's first law?"

Answer: "Newton's first law of motion, also known as the
law of inertia, states that an object at rest stays at
rest and an object in motion stays in motion with the same
speed and direction unless acted upon by an unbalanced force.

Key points:
1. Objects resist changes in motion
2. A force is needed to change velocity
3. This explains everyday phenomena like...
[detailed explanation]"

Tokens used: 450
Cost: $0.00003375
```

### 2. Performance Coach

**What it does:**
- Analyzes user performance data
- Identifies weak/strong topics
- Provides actionable advice
- Motivates and encourages

**Example:**
```
Input:
- Total attempts: 100
- Accuracy: 65%
- Weak topics: Thermodynamics, Calculus
- Recent trend: Improving

Analysis: "Your performance shows steady improvement!
Here's what I recommend:

1. Focus Areas:
   - Thermodynamics: Practice heat transfer problems
   - Calculus: Master derivatives first

2. Study Strategy:
   - 30 min daily on weak topics
   - Review strong topics weekly
   
3. Upcoming Goals:
   - Aim for 70% accuracy this week
   - Complete 20 practice problems daily
   
Keep up the great work! 🚀"

Tokens used: 320
Cost: $0.000024
```

### 3. Token Usage Widget

**What it shows:**
- Tokens used today
- Tokens remaining
- Progress bar (visual)
- Request count
- Estimated cost
- Warning at 80% usage

**Auto-updates every 30 seconds!**

---

## 🧪 Testing Checklist

### Basic Functionality

- [ ] Submit doubt solver question
- [ ] Verify AI response received
- [ ] Check token count displayed
- [ ] Confirm usage widget updated
- [ ] Test with different subjects

### Rate Limiting

- [ ] Make 5 requests within 1 minute
- [ ] 6th request should be blocked
- [ ] Error: "Rate limit exceeded"
- [ ] Wait 60 seconds
- [ ] Request should work again

### Daily Quota

```sql
-- Set user near limit (manual test)
UPDATE user_ai_usage
SET total_tokens_used = 9900
WHERE user_id = 'your_user_id' AND usage_date = CURRENT_DATE;

-- Make request (should work)
-- Make another request (might hit limit)
```

- [ ] Check quota enforcement
- [ ] Verify error message
- [ ] Confirm usage widget shows limit

### Peak Hours

```sql
-- Enable peak hours restriction
UPDATE system_flags
SET flag_value = true
WHERE flag_name = 'ai_peak_hours_disabled';
```

- [ ] During 10 AM - 6 PM IST: Blocked
- [ ] During off-peak: Works
- [ ] Error message clear

### Error Handling

- [ ] Empty question → Error
- [ ] Question too long (> 5000 chars) → Error
- [ ] Invalid API key → Graceful error
- [ ] Network failure → User-friendly message

---

## 📊 Default Limits

### Per-User Daily

```
Limit: 10,000 tokens
Requests: ~10-20 typical requests
Resets: Midnight IST
```

### Global Daily

```
Cap: 1,000,000 tokens
Users: ~100 users at max usage
Resets: Midnight IST
```

### Rate Limiting

```
Limit: 5 requests per minute
Window: 60 seconds rolling
Per: Individual user
```

---

## 🔧 Admin Operations

### Disable AI Globally

```sql
UPDATE system_flags
SET flag_value = false
WHERE flag_name = 'ai_enabled';
```

### Enable Peak Hours Mode

```sql
UPDATE system_flags
SET flag_value = true
WHERE flag_name = 'ai_peak_hours_disabled';

-- AI will be disabled 10 AM - 6 PM IST
```

### Increase User Daily Limit

```sql
UPDATE ai_token_limits
SET token_limit = 20000
WHERE limit_type = 'per_user_daily';
```

### View Top Users Today

```sql
SELECT 
    u.email,
    uau.total_tokens_used,
    uau.total_requests,
    uau.estimated_cost_usd
FROM user_ai_usage uau
JOIN users u ON u.id = uau.user_id
WHERE uau.usage_date = CURRENT_DATE
ORDER BY uau.total_tokens_used DESC
LIMIT 20;
```

### Check Global Usage

```sql
SELECT * FROM ai_global_usage
WHERE usage_date = CURRENT_DATE;
```

---

## 📁 Files Created

**Database:**
1. `supabase/migrations/006_gemini_ai_system.sql`

**Services:**
2. `src/lib/gemini/gemini.service.ts` - Core AI logic
3. `src/features/ai/services/ai-management.service.ts` - Rate limiting & quotas

**API Routes:**
4. `src/app/api/ai/doubt-solver/route.ts`
5. `src/app/api/ai/performance-coach/route.ts`
6. `src/app/api/ai/usage/route.ts`

**UI Components:**
7. `src/features/ai/components/ai-token-usage.tsx`
8. `src/features/ai/components/doubt-solver.tsx`

**Pages:**
9. `src/app/ai/doubt-solver/page.tsx`

**Config:**
10. `.env.example` (updated with GEMINI_API_KEY)

**Documentation:**
11. `GEMINI_AI_SYSTEM.md`
12. `GEMINI_AI_QUICK_START.md` (this file)

---

## 🚨 Common Errors & Solutions

### "AI disabled during peak hours"

```
Cause: Peak hours mode enabled (10 AM - 6 PM IST)
Solution: Wait for off-peak hours or disable flag:

UPDATE system_flags
SET flag_value = false
WHERE flag_name = 'ai_peak_hours_disabled';
```

### "Rate limit exceeded"

```
Cause: More than 5 requests in 1 minute
Solution: Wait 60 seconds, then retry
```

### "Daily token limit reached"

```
Cause: User used 10,000 tokens today
Solution:
1. Wait for midnight IST (auto-reset)
2. Or increase limit (admin):

UPDATE ai_token_limits
SET token_limit = 20000
WHERE limit_type = 'per_user_daily';
```

### "Global AI usage limit reached"

```
Cause: All users used 1M tokens today
Solution:
1. Wait for midnight IST
2. Or increase global cap (admin):

UPDATE ai_token_limits
SET token_limit = 2000000
WHERE limit_type = 'global_daily';
```

### "GEMINI_API_KEY not configured"

```
Cause: Missing or invalid API key
Solution:
1. Get key from: https://aistudio.google.com/app/apikey
2. Add to .env.local:
   GEMINI_API_KEY=AIzaSy...
3. Restart dev server
```

---

## 📈 Monitoring Commands

### Today's Usage

```sql
-- Total tokens used today
SELECT SUM(total_tokens_used) as total_tokens
FROM user_ai_usage
WHERE usage_date = CURRENT_DATE;

-- Total cost today
SELECT SUM(estimated_cost_usd) as total_cost
FROM user_ai_usage
WHERE usage_date = CURRENT_DATE;
```

### Failed Requests (Last 24h)

```sql
SELECT 
    status,
    error_message,
    COUNT(*) as count
FROM ai_interaction_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND status != 'success'
GROUP BY status, error_message
ORDER BY count DESC;
```

### Average Tokens Per Request

```sql
SELECT 
    interaction_type,
    AVG(total_tokens) as avg_tokens,
    COUNT(*) as request_count
FROM ai_interaction_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'success'
GROUP BY interaction_type;
```

---

## 🎯 Next Steps (Optional Enhancements)

1. **Performance Coach UI**
   - Create UI component
   - Fetch user performance automatically
   - Display coaching analysis

2. **Admin Dashboard**
   - View all users' usage
   - Manage system flags
   - Adjust limits dynamically

3. **Email Notifications**
   - Alert when near quota
   - Daily usage summary
   - Failed request alerts

4. **Enhanced Analytics**
   - Usage trends
   - Cost projections
   - Popular topics

---

**Status:** ✅ Ready to Use  
**Cost:** ✅ Controlled ($2.25/month max)  
**Security:** ✅ Multi-layer protection  

Your AI-powered learning system is ready! 🤖🚀
