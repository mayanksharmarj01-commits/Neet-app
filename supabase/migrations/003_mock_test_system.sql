-- Mock Test System Database Schema

-- Mock Test Templates
CREATE TABLE IF NOT EXISTS mock_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    mock_type TEXT NOT NULL CHECK (mock_type IN ('subject', 'chapter', 'full_syllabus', 'custom')),
    subject_id UUID REFERENCES subjects(id),
    chapter_ids UUID[],
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
    total_questions INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 180,
    total_marks INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mock_tests_type ON mock_tests(mock_type);
CREATE INDEX idx_mock_tests_subject ON mock_tests(subject_id);
CREATE INDEX idx_mock_tests_active ON mock_tests(is_active);
CREATE INDEX idx_mock_tests_premium ON mock_tests(is_premium);

-- User Mock Attempts (extends test_sessions for mock-specific data)
CREATE TABLE IF NOT EXISTS user_mock_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mock_test_id UUID NOT NULL REFERENCES mock_tests(id),
    session_id UUID REFERENCES test_sessions(id),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_score DECIMAL(10, 2) DEFAULT 0,
    max_score DECIMAL(10, 2),
    percentage DECIMAL(5, 2),
    questions_attempted INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    incorrect_answers INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    rank_contribution DECIMAL(10, 2) DEFAULT 0, -- For ranking calculation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_mock_attempts_user ON user_mock_attempts(user_id);
CREATE INDEX idx_user_mock_attempts_mock ON user_mock_attempts(mock_test_id);
CREATE INDEX idx_user_mock_attempts_status ON user_mock_attempts(status);
CREATE INDEX idx_user_mock_attempts_completed ON user_mock_attempts(user_id, completed_at) WHERE status = 'completed';

-- Weekly Mock Limit Tracking (for free users)
CREATE TABLE IF NOT EXISTS user_mock_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    mocks_taken INTEGER DEFAULT 0,
    free_limit INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE INDEX idx_user_mock_limits_user_week ON user_mock_limits(user_id, week_start);

-- Daily Practice Tracking
CREATE TABLE IF NOT EXISTS daily_practice_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    practice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    questions_attempted INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_points DECIMAL(10, 2) DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    rank_contribution DECIMAL(10, 2) DEFAULT 0, -- For ranking calculation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, practice_date)
);

CREATE INDEX idx_daily_practice_user_date ON daily_practice_stats(user_id, practice_date);

-- Leaderboard Cache (Updated every 5 minutes)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER,
    percentile DECIMAL(5, 2),
    total_score DECIMAL(10, 2),
    mock_score DECIMAL(10, 2),      -- 70% weight
    practice_score DECIMAL(10, 2),  -- 30% weight
    mocks_completed INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 2),
    last_active_at TIMESTAMPTZ,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_leaderboard_rank ON leaderboard_cache(rank);
CREATE INDEX idx_leaderboard_score ON leaderboard_cache(total_score DESC);
CREATE INDEX idx_leaderboard_cached_at ON leaderboard_cache(cached_at);

-- Function to check weekly mock limit
CREATE OR REPLACE FUNCTION check_weekly_mock_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_subscription_status TEXT;
    v_week_start DATE;
    v_week_end DATE;
    v_mocks_taken INTEGER;
    v_limit INTEGER;
BEGIN
    -- Check if user has active subscription
    SELECT subscription_status INTO v_subscription_status
    FROM users
    WHERE id = p_user_id;
    
    -- Paid users have unlimited access
    IF v_subscription_status IN ('active', 'trialing') THEN
        RETURN TRUE;
    END IF;
    
    -- Calculate current week
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    v_week_end := v_week_start + INTERVAL '6 days';
    
    -- Get or create limit record
    INSERT INTO user_mock_limits (user_id, week_start, week_end)
    VALUES (p_user_id, v_week_start, v_week_end)
    ON CONFLICT (user_id, week_start) DO NOTHING;
    
    -- Get current usage
    SELECT mocks_taken, free_limit
    INTO v_mocks_taken, v_limit
    FROM user_mock_limits
    WHERE user_id = p_user_id AND week_start = v_week_start;
    
    -- Check if limit reached
    RETURN v_mocks_taken < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment mock count
CREATE OR REPLACE FUNCTION increment_mock_count(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    v_week_start := date_trunc('week', CURRENT_DATE)::DATE;
    v_week_end := v_week_start + INTERVAL '6 days';
    
    -- Insert or update
    INSERT INTO user_mock_limits (user_id, week_start, week_end, mocks_taken)
    VALUES (p_user_id, v_week_start, v_week_end, 1)
    ON CONFLICT (user_id, week_start)
    DO UPDATE SET mocks_taken = user_mock_limits.mocks_taken + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh leaderboard cache
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS VOID AS $$
BEGIN
    -- Truncate old cache
    TRUNCATE leaderboard_cache;
    
    -- Calculate scores and insert new data
    INSERT INTO leaderboard_cache (
        user_id,
        rank,
        percentile,
        total_score,
        mock_score,
        practice_score,
        mocks_completed,
        total_questions,
        accuracy,
        last_active_at,
        cached_at
    )
    WITH mock_scores AS (
        SELECT 
            user_id,
            COUNT(*) as mocks_completed,
            SUM(total_score) as total_mock_score,
            SUM(questions_attempted) as mock_questions,
            AVG(percentage) as mock_accuracy
        FROM user_mock_attempts
        WHERE status = 'completed'
          AND completed_at > NOW() - INTERVAL '30 days' -- Last 30 days
        GROUP BY user_id
    ),
    practice_scores AS (
        SELECT 
            user_id,
            SUM(total_points) as total_practice_score,
            SUM(questions_attempted) as practice_questions,
            AVG(CASE WHEN questions_attempted > 0 
                THEN (correct_answers::DECIMAL / questions_attempted * 100) 
                ELSE 0 END) as practice_accuracy
        FROM daily_practice_stats
        WHERE practice_date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY user_id
    ),
    combined_scores AS (
        SELECT 
            COALESCE(m.user_id, p.user_id) as user_id,
            COALESCE(m.total_mock_score, 0) * 0.7 as weighted_mock_score,
            COALESCE(p.total_practice_score, 0) * 0.3 as weighted_practice_score,
            (COALESCE(m.total_mock_score, 0) * 0.7) + 
            (COALESCE(p.total_practice_score, 0) * 0.3) as final_score,
            COALESCE(m.mocks_completed, 0) as mocks_count,
            COALESCE(m.mock_questions, 0) + COALESCE(p.practice_questions, 0) as total_qs,
            CASE 
                WHEN COALESCE(m.mock_questions, 0) + COALESCE(p.practice_questions, 0) > 0
                THEN (
                    (COALESCE(m.mock_accuracy, 0) * COALESCE(m.mock_questions, 0) +
                     COALESCE(p.practice_accuracy, 0) * COALESCE(p.practice_questions, 0))
                    / (COALESCE(m.mock_questions, 0) + COALESCE(p.practice_questions, 0))
                )
                ELSE 0
            END as avg_accuracy,
            GREATEST(m.user_id, p.user_id) as last_activity
        FROM mock_scores m
        FULL OUTER JOIN practice_scores p ON m.user_id = p.user_id
    ),
    ranked_scores AS (
        SELECT 
            user_id,
            final_score,
            weighted_mock_score,
            weighted_practice_score,
            mocks_count,
            total_qs,
            avg_accuracy,
            ROW_NUMBER() OVER (ORDER BY final_score DESC, total_qs DESC) as rank,
            COUNT(*) OVER () as total_users
        FROM combined_scores
        WHERE final_score > 0
    )
    SELECT 
        user_id,
        rank::INTEGER,
        ROUND(((total_users - rank + 1)::DECIMAL / total_users * 100), 2) as percentile,
        ROUND(final_score, 2),
        ROUND(weighted_mock_score, 2),
        ROUND(weighted_practice_score, 2),
        mocks_count,
        total_qs,
        ROUND(avg_accuracy, 2),
        NOW(), -- last_active_at
        NOW()  -- cached_at
    FROM ranked_scores;
    
END;
$$ LANGUAGE plpgsql;

-- Trigger to update leaderboard contribution on mock completion
CREATE OR REPLACE FUNCTION update_mock_rank_contribution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Calculate contribution (70% weight)
        NEW.rank_contribution := NEW.total_score * 0.7;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mock_contribution
    BEFORE UPDATE ON user_mock_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_mock_rank_contribution();

-- Trigger to update practice rank contribution
CREATE OR REPLACE FUNCTION update_practice_rank_contribution()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate contribution (30% weight)
    NEW.rank_contribution := NEW.total_points * 0.3;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_practice_contribution
    BEFORE INSERT OR UPDATE ON daily_practice_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_practice_rank_contribution();

-- RLS Policies
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_practice_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active mock tests" ON mock_tests
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own mock attempts" ON user_mock_attempts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create mock attempts" ON user_mock_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts" ON user_mock_attempts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own limits" ON user_mock_limits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own practice stats" ON daily_practice_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view leaderboard" ON leaderboard_cache
    FOR SELECT USING (true);

COMMENT ON TABLE mock_tests IS 'Mock test templates with subject/chapter filtering';
COMMENT ON TABLE user_mock_attempts IS 'User attempts at mock tests with scoring';
COMMENT ON TABLE user_mock_limits IS 'Weekly mock test limits for free users';
COMMENT ON TABLE daily_practice_stats IS 'Daily practice statistics for ranking';
COMMENT ON TABLE leaderboard_cache IS 'Cached leaderboard updated every 5 minutes';
