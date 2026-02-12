# 🚀 Ultimate Deployment Guide - EdTech Platform

This guide covers the complete deployment process from local development to production on Vercel with a Supabase backend.

## 📋 Prerequisites

1.  **Vercel Account:** [Sign up](https://vercel.com)
2.  **Supabase Project:** [Create new project](https://supabase.com)
3.  **Razorpay Account:** (For payments)
4.  **Google AI Studio Key:** (For Gemini AI)
5.  **GitHub Repository:** Push your code to a new repo.

---

## 🛠️ Step 1: Database Setup (Supabase)

You must run the migrations in **exactly** this order to set up the database schema.

1.  Go to your **Supabase Dashboard** -> **SQL Editor**.
2.  Click **New Query**.
3.  Copy and paste the content of each file one by one and run them.

### Migration Order

| Order | File | Purpose |
| :--- | :--- | :--- |
| **1** | `supabase/migrations/000_base_schema.sql` | **CRITICAL:** Creates base tables (`users`, `subjects`, `questions`). **Run FIRST!** |
| **2** | `supabase/migrations/001_auth_enhancements.sql` | Adds session management & security. |
| **3** | `supabase/migrations/002_test_sessions.sql` | Adds mock test session tracking. |
| **4** | `supabase/migrations/003_mock_test_system.sql` | Adds full mock test engine tables. |
| **5** | `supabase/migrations/004_arena_system.sql` | Adds real-time arena tables. |
| **6** | `supabase/migrations/005_razorpay_subscriptions.sql` | Adds payment & subscription system. |
| **7** | `supabase/migrations/006_gemini_ai_system.sql` | Adds AI features & structured output tables. |
| **8** | `supabase/migrations/007_admin_panel.sql` | Adds admin dashboard, analytics & banning system. |

> **Verify:** After running all migrations, go to **Table Editor** and ensuring you see tables like `users`, `arenas`, `subscriptions`, `analytics_cache`.

---

## 🔐 Step 2: Environment Variables

Configure these variables in your **Vercel Project Settings** -> **Environment Variables**.

### Core
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Critical for Cron Jobs & Admin API
SUPABASE_JWT_SECRET=your-jwt-secret
```

### Payments (Razorpay)
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

### AI (Gemini)
```env
GEMINI_API_KEY=your-gemini-api-key
```

### Security
```env
CRON_SECRET=generate-a-random-secure-string
# Use this same string when setting up Cron Jobs if authenticating manually, 
# but Vercel handles it automatically for registered crons.
```

### App Config
```env
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

---

## 🚀 Step 3: Vercel Deployment

1.  **Push to GitHub:**
    ```bash
    git add .
    git commit -m "Ready for deployment"
    git push origin main
    ```

2.  **Import to Vercel:**
    *   Go to Vercel Dashboard -> **Add New...** -> **Project**.
    *   Import your GitHub repository.
    *   **Framework Preset:** Next.js.
    *   **Root Directory:** `./` (default).

3.  **Add Environment Variables:**
    *   Copy/paste the variables from Step 2 into the deployment settings.

4.  **Deploy:**
    *   Click **Deploy**.
    *   Wait for the build to complete.

---

## ⏰ Step 4: Configure Cron Jobs (GitHub Actions)

We use GitHub Actions to trigger scheduled tasks reliably.

1.  **Update URL:**
    *   Go to your GitHub repository -> `.github/workflows/cron.yml`.
    *   Edit the file and replace `YOUR_VERCEL_PROJECT_URL` with your actual deployed Vercel URL (e.g., `https://your-project.vercel.app`).
    *   Commit the change.

2.  **Add Secret:**
    *   Go to **Settings** -> **Secrets and variables** -> **Actions**.
    *   Click **New repository secret**.
    *   **Name:** `CRON_SECRET`
    *   **Value:** (The secure string you generated for Vercel env vars).

> **Verification:** You can test the jobs manually in the **Actions** tab on GitHub by selecting the workflow and clicking **Run workflow**.

---

## 🕵️ Step 5: Post-Deployment Verification

1.  **Visit your URL:** `https://your-project.vercel.app`
2.  **Sign Up:** Create a new account.
3.  **Check Admin Panel:**
    *   Go to `supabase` -> `user_roles` table.
    *   Insert a row: `user_id` = your_user_id, `role_id` = (Select ID from `admin_roles` where name='super_admin').
    *   Visit `/admin/dashboard`. You should see the dashboard.
4.  **Test Arena:** Create an arena and ensure it loads.
5.  **Test Payments:** Try a dummy subscription mechanism (Test Mode).

---

## 🚨 Troubleshooting

**Database Errors?**
*   Check if you ran **000_base_schema.sql** first.
*   Check foreign key relationships in Supabase.

**Auth Issues?**
*   Verify `NEXT_PUBLIC_SUPABASE_URL` and `ANON_KEY`.
*   Check "Site URL" in Supabase Auth settings matches your Vercel URL.

**Cron Jobs Failing?**
*   Check Vercel Runtime Logs.
*   Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly.

---

## 🎉 Done!
Your EdTech platform is now live and production-ready!
