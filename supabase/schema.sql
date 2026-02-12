-- =====================================================
-- PRODUCTION-READY SUPABASE SCHEMA
-- Scalable to 50k+ users
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'past_due', 'trialing');
CREATE TYPE plan_interval AS ENUM ('monthly', 'yearly', 'lifetime');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE question_type AS ENUM ('mcq', 'multiple_correct', 'true_false', 'subjective');
CREATE TYPE attempt_status AS ENUM ('in_progress', 'completed', 'abandoned', 'timed_out');
CREATE TYPE arena_status AS ENUM ('waiting', 'active', 'completed', 'cancelled');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');
CREATE TYPE system_flag_type AS ENUM ('maintenance', 'feature_flag', 'rate_limit', 'global_announcement');

-- =====================================================
-- TABLES
-- =====================================================

-- -----------------------------------------------------
-- Table: users (extends Supabase auth.users)
-- -----------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    phone TEXT,
    country_code TEXT,
    timezone TEXT DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    total_points INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- -----------------------------------------------------
-- Table: plans
-- -----------------------------------------------------
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),
    price_lifetime DECIMAL(10, 2),
    features JSONB DEFAULT '[]',
    max_daily_questions INTEGER,
    max_monthly_questions INTEGER,
    ai_credits_monthly INTEGER DEFAULT 0,
    arena_access BOOLEAN DEFAULT false,
    priority_support BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    stripe_product_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: subscriptions
-- -----------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'trialing',
    interval plan_interval,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    payment_method_id TEXT,
    last_payment_at TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    amount_paid DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: questions
-- -----------------------------------------------------
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    question_type question_type NOT NULL DEFAULT 'mcq',
    difficulty difficulty_level,
    auto_difficulty DECIMAL(3, 2), -- Auto-calculated from stats
    tags TEXT[] DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    options JSONB, -- For MCQ: [{"id": "a", "text": "...", "is_correct": true}]
    correct_answers TEXT[], -- For storing correct answer IDs
    explanation TEXT,
    hints JSONB DEFAULT '[]',
    time_limit_seconds INTEGER,
    points INTEGER DEFAULT 10,
    source TEXT,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    avg_solve_time_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- -----------------------------------------------------
-- Table: question_stats
-- -----------------------------------------------------
CREATE TABLE question_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    incorrect_attempts INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    avg_time_seconds DECIMAL(10, 2),
    success_rate DECIMAL(5, 2), -- Percentage
    difficulty_rating DECIMAL(3, 2), -- Calculated: 1.00 = easy, 3.00 = hard
    last_attempted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_question_stats UNIQUE (question_id)
);

-- -----------------------------------------------------
-- Table: user_attempts
-- -----------------------------------------------------
CREATE TABLE user_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    session_id UUID, -- For grouping attempts in a session/test
    arena_room_id UUID, -- If attempted in arena mode
    status attempt_status NOT NULL DEFAULT 'in_progress',
    user_answer JSONB, -- Store user's selected answers
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    hints_used INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: attempt_summary
-- -----------------------------------------------------
CREATE TABLE attempt_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    incorrect_attempts INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    total_time_seconds BIGINT DEFAULT 0,
    avg_accuracy DECIMAL(5, 2),
    streak_days INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    questions_by_difficulty JSONB DEFAULT '{"easy": 0, "medium": 0, "hard": 0}',
    questions_by_topic JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_month UNIQUE (user_id, year, month)
);

-- -----------------------------------------------------
-- Table: arena_rooms
-- -----------------------------------------------------
CREATE TABLE arena_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code TEXT UNIQUE NOT NULL,
    name TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status arena_status NOT NULL DEFAULT 'waiting',
    max_participants INTEGER DEFAULT 10,
    current_participants INTEGER DEFAULT 0,
    difficulty difficulty_level,
    topics TEXT[] DEFAULT '{}',
    total_questions INTEGER DEFAULT 10,
    time_limit_seconds INTEGER,
    scheduled_start_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_config JSONB DEFAULT '{}',
    is_private BOOLEAN DEFAULT false,
    password_hash TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: arena_participants
-- -----------------------------------------------------
CREATE TABLE arena_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_room_id UUID NOT NULL REFERENCES arena_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    incorrect_answers INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    rank INTEGER,
    is_ready BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_arena_participant UNIQUE (arena_room_id, user_id)
);

-- -----------------------------------------------------
-- Table: leaderboard_cache
-- -----------------------------------------------------
CREATE TABLE leaderboard_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leaderboard_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time', 'arena'
    period_start DATE,
    period_end DATE,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_attempts INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_leaderboard_entry UNIQUE (user_id, leaderboard_type, period_start)
);

-- -----------------------------------------------------
-- Table: conversations
-- -----------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    is_group BOOLEAN DEFAULT false,
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: conversation_members
-- -----------------------------------------------------
CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    left_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

-- -----------------------------------------------------
-- Table: messages
-- -----------------------------------------------------
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type message_type DEFAULT 'text',
    attachments JSONB DEFAULT '[]', -- [{url, name, size, type}]
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    read_by UUID[] DEFAULT '{}',
    reactions JSONB DEFAULT '{}', -- {"👍": ["user_id1", "user_id2"]}
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: ai_usage_logs
-- -----------------------------------------------------
CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL, -- 'explanation', 'hint', 'chat', 'analysis'
    model TEXT, -- 'gpt-4', 'gpt-3.5-turbo', etc.
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd DECIMAL(10, 6),
    credits_used INTEGER DEFAULT 1,
    question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    request_data JSONB,
    response_data JSONB,
    latency_ms INTEGER,
    error TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: system_flags
-- -----------------------------------------------------
CREATE TABLE system_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key TEXT UNIQUE NOT NULL,
    flag_type system_flag_type NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    value JSONB, -- For storing complex flag values
    description TEXT,
    applies_to_users UUID[], -- Specific users (for gradual rollout)
    applies_to_plans UUID[], -- Specific plans
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: device_tracking
-- -----------------------------------------------------
CREATE TABLE device_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT, -- 'mobile', 'tablet', 'desktop'
    os TEXT,
    os_version TEXT,
    browser TEXT,
    browser_version TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    location JSONB, -- {country, city, lat, lon}
    fcm_token TEXT, -- For push notifications
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- -----------------------------------------------------
-- Table: ip_logs
-- -----------------------------------------------------
CREATE TABLE ip_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    action TEXT, -- 'login', 'signup', 'failed_login', 'api_call'
    endpoint TEXT,
    method TEXT,
    status_code INTEGER,
    user_agent TEXT,
    referer TEXT,
    country TEXT,
    city TEXT,
    is_vpn BOOLEAN,
    is_proxy BOOLEAN,
    is_suspicious BOOLEAN DEFAULT false,
    risk_score INTEGER, -- 0-100
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_total_points ON users(total_points DESC);
CREATE INDEX idx_users_last_active_at ON users(last_active_at DESC);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Partial unique index to enforce only one active subscription per user
CREATE UNIQUE INDEX idx_subscriptions_unique_active ON subscriptions(user_id) 
    WHERE status IN ('active', 'trialing');


-- Plans indexes
CREATE INDEX idx_plans_is_active ON plans(is_active);
CREATE INDEX idx_plans_sort_order ON plans(sort_order);

-- Questions indexes
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_question_type ON questions(question_type);
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);
CREATE INDEX idx_questions_topics ON questions USING GIN(topics);
CREATE INDEX idx_questions_is_active ON questions(is_active);
CREATE INDEX idx_questions_author_id ON questions(author_id);
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX idx_questions_deleted_at ON questions(deleted_at) WHERE deleted_at IS NOT NULL;

-- Question stats indexes
CREATE INDEX idx_question_stats_question_id ON question_stats(question_id);
CREATE INDEX idx_question_stats_success_rate ON question_stats(success_rate);
CREATE INDEX idx_question_stats_difficulty_rating ON question_stats(difficulty_rating);

-- User attempts indexes
CREATE INDEX idx_user_attempts_user_id ON user_attempts(user_id);
CREATE INDEX idx_user_attempts_question_id ON user_attempts(question_id);
CREATE INDEX idx_user_attempts_session_id ON user_attempts(session_id);
CREATE INDEX idx_user_attempts_arena_room_id ON user_attempts(arena_room_id);
CREATE INDEX idx_user_attempts_status ON user_attempts(status);
CREATE INDEX idx_user_attempts_is_correct ON user_attempts(is_correct);
CREATE INDEX idx_user_attempts_created_at ON user_attempts(created_at DESC);
CREATE INDEX idx_user_attempts_completed_at ON user_attempts(completed_at DESC);
CREATE INDEX idx_user_attempts_user_question ON user_attempts(user_id, question_id);

-- Attempt summary indexes
CREATE INDEX idx_attempt_summary_user_id ON attempt_summary(user_id);
CREATE INDEX idx_attempt_summary_year_month ON attempt_summary(year, month);
CREATE INDEX idx_attempt_summary_user_year_month ON attempt_summary(user_id, year, month);

-- Arena rooms indexes
CREATE INDEX idx_arena_rooms_room_code ON arena_rooms(room_code);
CREATE INDEX idx_arena_rooms_created_by ON arena_rooms(created_by);
CREATE INDEX idx_arena_rooms_status ON arena_rooms(status);
CREATE INDEX idx_arena_rooms_scheduled_start_at ON arena_rooms(scheduled_start_at);
CREATE INDEX idx_arena_rooms_created_at ON arena_rooms(created_at DESC);

-- Arena participants indexes
CREATE INDEX idx_arena_participants_arena_room_id ON arena_participants(arena_room_id);
CREATE INDEX idx_arena_participants_user_id ON arena_participants(user_id);
CREATE INDEX idx_arena_participants_score ON arena_participants(score DESC);
CREATE INDEX idx_arena_participants_rank ON arena_participants(rank);

-- Leaderboard cache indexes
CREATE INDEX idx_leaderboard_cache_user_id ON leaderboard_cache(user_id);
CREATE INDEX idx_leaderboard_cache_type ON leaderboard_cache(leaderboard_type);
CREATE INDEX idx_leaderboard_cache_rank ON leaderboard_cache(rank);
CREATE INDEX idx_leaderboard_cache_score ON leaderboard_cache(score DESC);
CREATE INDEX idx_leaderboard_cache_period ON leaderboard_cache(period_start, period_end);
CREATE INDEX idx_leaderboard_cache_type_period_rank ON leaderboard_cache(leaderboard_type, period_start, rank);

-- Conversations indexes
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_is_archived ON conversations(is_archived);

-- Conversation members indexes
CREATE INDEX idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_user_conversation ON conversation_members(user_id, conversation_id);

-- Messages indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_reply_to_id ON messages(reply_to_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- AI usage logs indexes
CREATE INDEX idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_feature ON ai_usage_logs(feature);
CREATE INDEX idx_ai_usage_logs_question_id ON ai_usage_logs(question_id);
CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_user_created ON ai_usage_logs(user_id, created_at DESC);

-- System flags indexes
CREATE INDEX idx_system_flags_flag_key ON system_flags(flag_key);
CREATE INDEX idx_system_flags_flag_type ON system_flags(flag_type);
CREATE INDEX idx_system_flags_is_enabled ON system_flags(is_enabled);

-- Device tracking indexes
CREATE INDEX idx_device_tracking_user_id ON device_tracking(user_id);
CREATE INDEX idx_device_tracking_device_id ON device_tracking(device_id);
CREATE INDEX idx_device_tracking_is_active ON device_tracking(is_active);
CREATE INDEX idx_device_tracking_last_seen_at ON device_tracking(last_seen_at DESC);

-- IP logs indexes
CREATE INDEX idx_ip_logs_user_id ON ip_logs(user_id);
CREATE INDEX idx_ip_logs_ip_address ON ip_logs(ip_address);
CREATE INDEX idx_ip_logs_action ON ip_logs(action);
CREATE INDEX idx_ip_logs_created_at ON ip_logs(created_at DESC);
CREATE INDEX idx_ip_logs_is_suspicious ON ip_logs(is_suspicious) WHERE is_suspicious = true;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate question difficulty based on stats
CREATE OR REPLACE FUNCTION calculate_question_difficulty()
RETURNS TRIGGER AS $$
DECLARE
    v_difficulty DECIMAL(3, 2);
BEGIN
    -- Calculate difficulty: 1.00 (easy) to 3.00 (hard)
    -- Based on success rate and average time
    IF NEW.total_attempts >= 10 THEN
        v_difficulty := CASE
            WHEN NEW.success_rate >= 80 THEN 1.00
            WHEN NEW.success_rate >= 60 THEN 1.50
            WHEN NEW.success_rate >= 40 THEN 2.00
            WHEN NEW.success_rate >= 20 THEN 2.50
            ELSE 3.00
        END;
        
        -- Adjust based on average time
        IF NEW.avg_time_seconds > 180 THEN
            v_difficulty := LEAST(3.00, v_difficulty + 0.25);
        ELSIF NEW.avg_time_seconds < 60 THEN
            v_difficulty := GREATEST(1.00, v_difficulty - 0.25);
        END IF;
        
        -- Update the difficulty rating
        NEW.difficulty_rating := v_difficulty;
        
        -- Update the question's auto_difficulty
        UPDATE questions
        SET auto_difficulty = v_difficulty,
            updated_at = NOW()
        WHERE id = NEW.question_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update question stats after attempt
CREATE OR REPLACE FUNCTION update_question_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO question_stats (question_id, total_attempts, correct_attempts, incorrect_attempts)
        VALUES (NEW.question_id, 1, 
                CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
                CASE WHEN NOT NEW.is_correct THEN 1 ELSE 0 END)
        ON CONFLICT (question_id) DO UPDATE SET
            total_attempts = question_stats.total_attempts + 1,
            correct_attempts = question_stats.correct_attempts + 
                CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
            incorrect_attempts = question_stats.incorrect_attempts + 
                CASE WHEN NOT NEW.is_correct THEN 1 ELSE 0 END,
            avg_time_seconds = (
                COALESCE(question_stats.avg_time_seconds, 0) * question_stats.total_attempts + 
                COALESCE(NEW.time_taken_seconds, 0)
            ) / (question_stats.total_attempts + 1),
            success_rate = ROUND(
                (question_stats.correct_attempts + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DECIMAL / 
                (question_stats.total_attempts + 1) * 100, 
                2
            ),
            last_attempted_at = NEW.completed_at,
            updated_at = NOW();
            
        -- Update question usage count
        UPDATE questions
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE id = NEW.question_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update leaderboard cache
CREATE OR REPLACE FUNCTION update_leaderboard_cache(
    p_user_id UUID,
    p_leaderboard_type TEXT,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID AS $$
DECLARE
    v_score INTEGER;
    v_total_attempts INTEGER;
    v_accuracy DECIMAL(5, 2);
    v_rank INTEGER;
BEGIN
    -- Calculate user score and stats for the period
    SELECT 
        COALESCE(SUM(points_earned), 0),
        COUNT(*),
        ROUND(
            CASE WHEN COUNT(*) > 0 
            THEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100
            ELSE 0 END,
            2
        )
    INTO v_score, v_total_attempts, v_accuracy
    FROM user_attempts
    WHERE user_id = p_user_id
        AND status = 'completed'
        AND completed_at >= p_period_start
        AND completed_at < p_period_end + INTERVAL '1 day';
    
    -- Calculate rank
    SELECT COUNT(*) + 1
    INTO v_rank
    FROM (
        SELECT ua.user_id, SUM(ua.points_earned) as total_score
        FROM user_attempts ua
        WHERE ua.status = 'completed'
            AND ua.completed_at >= p_period_start
            AND ua.completed_at < p_period_end + INTERVAL '1 day'
        GROUP BY ua.user_id
        HAVING SUM(ua.points_earned) > v_score
    ) AS ranked_users;
    
    -- Insert or update leaderboard cache
    INSERT INTO leaderboard_cache (
        user_id, leaderboard_type, period_start, period_end,
        rank, score, total_attempts, accuracy
    )
    VALUES (
        p_user_id, p_leaderboard_type, p_period_start, p_period_end,
        v_rank, v_score, v_total_attempts, v_accuracy
    )
    ON CONFLICT (user_id, leaderboard_type, period_start) DO UPDATE SET
        rank = v_rank,
        score = v_score,
        total_attempts = v_total_attempts,
        accuracy = v_accuracy,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Aggregate monthly attempt summary
CREATE OR REPLACE FUNCTION aggregate_monthly_summary(
    p_user_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_total_attempts INTEGER;
    v_correct_attempts INTEGER;
    v_incorrect_attempts INTEGER;
    v_total_points INTEGER;
    v_total_time BIGINT;
    v_avg_accuracy DECIMAL(5, 2);
    v_questions_by_difficulty JSONB;
    v_questions_by_topic JSONB;
BEGIN
    -- Get aggregated stats for the month
    SELECT 
        COUNT(*),
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END),
        SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END),
        COALESCE(SUM(points_earned), 0),
        COALESCE(SUM(time_taken_seconds), 0),
        ROUND(
            CASE WHEN COUNT(*) > 0 
            THEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100
            ELSE 0 END,
            2
        )
    INTO 
        v_total_attempts,
        v_correct_attempts,
        v_incorrect_attempts,
        v_total_points,
        v_total_time,
        v_avg_accuracy
    FROM user_attempts
    WHERE user_id = p_user_id
        AND status = 'completed'
        AND EXTRACT(YEAR FROM completed_at) = p_year
        AND EXTRACT(MONTH FROM completed_at) = p_month;
    
    -- Aggregate by difficulty
    SELECT jsonb_object_agg(difficulty, count)
    INTO v_questions_by_difficulty
    FROM (
        SELECT 
            COALESCE(q.difficulty::TEXT, 'unknown') as difficulty,
            COUNT(*) as count
        FROM user_attempts ua
        JOIN questions q ON ua.question_id = q.id
        WHERE ua.user_id = p_user_id
            AND ua.status = 'completed'
            AND EXTRACT(YEAR FROM ua.completed_at) = p_year
            AND EXTRACT(MONTH FROM ua.completed_at) = p_month
        GROUP BY q.difficulty
    ) difficulty_counts;
    
    -- Aggregate by topic (flatten topics array)
    SELECT jsonb_object_agg(topic, count)
    INTO v_questions_by_topic
    FROM (
        SELECT 
            unnest(q.topics) as topic,
            COUNT(*) as count
        FROM user_attempts ua
        JOIN questions q ON ua.question_id = q.id
        WHERE ua.user_id = p_user_id
            AND ua.status = 'completed'
            AND EXTRACT(YEAR FROM ua.completed_at) = p_year
            AND EXTRACT(MONTH FROM ua.completed_at) = p_month
        GROUP BY topic
    ) topic_counts;
    
    -- Insert or update summary
    INSERT INTO attempt_summary (
        user_id, year, month,
        total_attempts, correct_attempts, incorrect_attempts,
        total_points_earned, total_time_seconds, avg_accuracy,
        questions_by_difficulty, questions_by_topic
    )
    VALUES (
        p_user_id, p_year, p_month,
        v_total_attempts, v_correct_attempts, v_incorrect_attempts,
        v_total_points, v_total_time, v_avg_accuracy,
        COALESCE(v_questions_by_difficulty, '{}'::jsonb),
        COALESCE(v_questions_by_topic, '{}'::jsonb)
    )
    ON CONFLICT (user_id, year, month) DO UPDATE SET
        total_attempts = v_total_attempts,
        correct_attempts = v_correct_attempts,
        incorrect_attempts = v_incorrect_attempts,
        total_points_earned = v_total_points,
        total_time_seconds = v_total_time,
        avg_accuracy = v_avg_accuracy,
        questions_by_difficulty = COALESCE(v_questions_by_difficulty, '{}'::jsonb),
        questions_by_topic = COALESCE(v_questions_by_topic, '{}'::jsonb),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Update arena participant count
CREATE OR REPLACE FUNCTION update_arena_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.is_active THEN
        UPDATE arena_rooms
        SET current_participants = current_participants + 1,
            updated_at = NOW()
        WHERE id = NEW.arena_room_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active THEN
        UPDATE arena_rooms
        SET current_participants = GREATEST(0, current_participants - 1),
            updated_at = NOW()
        WHERE id = NEW.arena_room_id;
    ELSIF TG_OP = 'DELETE' AND OLD.is_active THEN
        UPDATE arena_rooms
        SET current_participants = GREATEST(0, current_participants - 1),
            updated_at = NOW()
        WHERE id = OLD.arena_room_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Update conversation last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NOT NEW.is_deleted THEN
        UPDATE conversations
        SET last_message_at = NEW.created_at,
            last_message_preview = LEFT(NEW.content, 100),
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user last active timestamp
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET last_active_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers for all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_question_stats_updated_at BEFORE UPDATE ON question_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_attempts_updated_at BEFORE UPDATE ON user_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attempt_summary_updated_at BEFORE UPDATE ON attempt_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arena_rooms_updated_at BEFORE UPDATE ON arena_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arena_participants_updated_at BEFORE UPDATE ON arena_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaderboard_cache_updated_at BEFORE UPDATE ON leaderboard_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_members_updated_at BEFORE UPDATE ON conversation_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_flags_updated_at BEFORE UPDATE ON system_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_tracking_updated_at BEFORE UPDATE ON device_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Question difficulty auto-calculation trigger
CREATE TRIGGER trigger_calculate_question_difficulty 
    BEFORE INSERT OR UPDATE ON question_stats
    FOR EACH ROW EXECUTE FUNCTION calculate_question_difficulty();

-- Question stats update trigger
CREATE TRIGGER trigger_update_question_stats
    AFTER INSERT OR UPDATE ON user_attempts
    FOR EACH ROW EXECUTE FUNCTION update_question_stats();

-- Arena participant count triggers
CREATE TRIGGER trigger_arena_participant_insert
    AFTER INSERT ON arena_participants
    FOR EACH ROW EXECUTE FUNCTION update_arena_participant_count();

CREATE TRIGGER trigger_arena_participant_update
    AFTER UPDATE ON arena_participants
    FOR EACH ROW EXECUTE FUNCTION update_arena_participant_count();

CREATE TRIGGER trigger_arena_participant_delete
    AFTER DELETE ON arena_participants
    FOR EACH ROW EXECUTE FUNCTION update_arena_participant_count();

-- Conversation last message trigger
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- User last active triggers
CREATE TRIGGER trigger_user_last_active_on_attempt
    AFTER INSERT ON user_attempts
    FOR EACH ROW EXECUTE FUNCTION update_user_last_active();

CREATE TRIGGER trigger_user_last_active_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_user_last_active();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public users are viewable by everyone" ON users
    FOR SELECT USING (true);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Plans policies
CREATE POLICY "Plans are viewable by everyone" ON plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage plans" ON plans
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Questions policies
CREATE POLICY "Active questions are viewable by authenticated users" ON questions
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        is_active = true AND 
        deleted_at IS NULL
    );

CREATE POLICY "Users can create questions" ON questions
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own questions" ON questions
    FOR UPDATE USING (auth.uid() = author_id);

-- Question stats policies
CREATE POLICY "Question stats are viewable by authenticated users" ON question_stats
    FOR SELECT USING (auth.role() = 'authenticated');

-- User attempts policies
CREATE POLICY "Users can view their own attempts" ON user_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts" ON user_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts" ON user_attempts
    FOR UPDATE USING (auth.uid() = user_id);

-- Attempt summary policies
CREATE POLICY "Users can view their own summaries" ON attempt_summary
    FOR SELECT USING (auth.uid() = user_id);

-- Arena rooms policies
CREATE POLICY "Arena rooms are viewable by authenticated users" ON arena_rooms
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        (is_private = false OR created_by = auth.uid())
    );

CREATE POLICY "Users can create arena rooms" ON arena_rooms
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Room creators can update their rooms" ON arena_rooms
    FOR UPDATE USING (auth.uid() = created_by);

-- Arena participants policies
CREATE POLICY "Participants can view arena participants" ON arena_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM arena_participants ap
            WHERE ap.arena_room_id = arena_participants.arena_room_id
            AND ap.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join arenas" ON arena_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation" ON arena_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- Leaderboard cache policies
CREATE POLICY "Leaderboard is viewable by authenticated users" ON leaderboard_cache
    FOR SELECT USING (auth.role() = 'authenticated');

-- Conversations policies
CREATE POLICY "Members can view their conversations" ON conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_members cm
            WHERE cm.conversation_id = conversations.id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
    );

CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Conversation members policies
CREATE POLICY "Members can view conversation membership" ON conversation_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_members cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can add members" ON conversation_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation_members cm
            WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.is_admin = true
        )
        OR auth.uid() = user_id
    );

-- Messages policies
CREATE POLICY "Members can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_members cm
            WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
    );

CREATE POLICY "Members can send messages" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversation_members cm
            WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
    );

CREATE POLICY "Senders can update their own messages" ON messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- AI usage logs policies
CREATE POLICY "Users can view their own AI usage" ON ai_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can create AI usage logs" ON ai_usage_logs
    FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- System flags policies
CREATE POLICY "System flags are viewable by authenticated users" ON system_flags
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage system flags" ON system_flags
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Device tracking policies
CREATE POLICY "Users can view their own devices" ON device_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own devices" ON device_tracking
    FOR ALL USING (auth.uid() = user_id);

-- IP logs policies
CREATE POLICY "Users can view their own IP logs" ON ip_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can create IP logs" ON ip_logs
    FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- INITIAL DATA / SEED
-- =====================================================

-- Insert default plans
INSERT INTO plans (name, description, price_monthly, price_yearly, price_lifetime, max_daily_questions, max_monthly_questions, ai_credits_monthly, arena_access, features, sort_order)
VALUES 
    ('Free', 'Get started with basic features', 0.00, 0.00, NULL, 10, 100, 50, false, 
     '["10 questions per day", "Basic analytics", "Community support"]'::jsonb, 1),
    ('Pro', 'For serious learners', 9.99, 99.99, NULL, 100, 3000, 500, true,
     '["100 questions per day", "Advanced analytics", "Arena access", "Priority support", "AI hints"]'::jsonb, 2),
    ('Lifetime', 'One-time payment, lifetime access', NULL, NULL, 199.99, NULL, NULL, 1000, true,
     '["Unlimited questions", "Advanced analytics", "Arena access", "Priority support", "Unlimited AI", "Early access to features"]'::jsonb, 3);

-- Insert system flags
INSERT INTO system_flags (flag_key, flag_type, is_enabled, description)
VALUES 
    ('maintenance_mode', 'maintenance', false, 'Put the application in maintenance mode'),
    ('arena_enabled', 'feature_flag', true, 'Enable arena feature for users'),
    ('ai_features_enabled', 'feature_flag', true, 'Enable AI-powered features'),
    ('rate_limit_api', 'rate_limit', true, 'Enable rate limiting for API endpoints');

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Partial indexes for common queries
CREATE INDEX idx_subscriptions_active_only ON subscriptions(user_id) 
    WHERE status IN ('active', 'trialing');

CREATE INDEX idx_user_attempts_completed_only ON user_attempts(user_id, completed_at) 
    WHERE status = 'completed';

CREATE INDEX idx_messages_undeleted ON messages(conversation_id, created_at DESC) 
    WHERE is_deleted = false;

CREATE INDEX idx_arena_rooms_active ON arena_rooms(status, scheduled_start_at) 
    WHERE status IN ('waiting', 'active');

-- Composite indexes for complex queries
CREATE INDEX idx_user_attempts_user_completed ON user_attempts(user_id, completed_at DESC) 
    WHERE status = 'completed';

CREATE INDEX idx_leaderboard_lookup ON leaderboard_cache(leaderboard_type, period_start, rank);

CREATE INDEX idx_questions_active_difficulty ON questions(difficulty, created_at DESC) 
    WHERE is_active = true AND deleted_at IS NULL;

-- JSONB indexes for faster JSON queries
CREATE INDEX idx_questions_tags_gin ON questions USING GIN(tags);
CREATE INDEX idx_questions_topics_gin ON questions USING GIN(topics);
CREATE INDEX idx_messages_reactions_gin ON messages USING GIN(reactions);
CREATE INDEX idx_system_flags_value_gin ON system_flags USING GIN(value);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE subscriptions IS 'User subscription management with Stripe integration';
COMMENT ON TABLE plans IS 'Available subscription plans';
COMMENT ON TABLE questions IS 'Question bank with multiple question types';
COMMENT ON TABLE question_stats IS 'Aggregated statistics for each question';
COMMENT ON TABLE user_attempts IS 'Individual user attempts on questions';
COMMENT ON TABLE attempt_summary IS 'Monthly aggregated summary of user attempts';
COMMENT ON TABLE arena_rooms IS 'Real-time competitive arena rooms';
COMMENT ON TABLE arena_participants IS 'Participants in arena rooms';
COMMENT ON TABLE leaderboard_cache IS 'Pre-computed leaderboard rankings';
COMMENT ON TABLE conversations IS 'Chat conversations (direct and group)';
COMMENT ON TABLE conversation_members IS 'Members of each conversation';
COMMENT ON TABLE messages IS 'Individual messages in conversations';
COMMENT ON TABLE ai_usage_logs IS 'Tracking AI feature usage and costs';
COMMENT ON TABLE system_flags IS 'Feature flags and system configuration';
COMMENT ON TABLE device_tracking IS 'Track user devices for session management';
COMMENT ON TABLE ip_logs IS 'Security and audit logging for IP addresses';

-- =====================================================
-- END OF SCHEMA
-- =====================================================
