-- Base Schema: Users, Subjects, Chapters, Questions
-- This must be run FIRST before all other migrations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    
    -- Subscription tracking
    subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'trial')),
    subscription_expires_at TIMESTAMPTZ,
    
    -- Usage limits (for free users)
    daily_mock_attempts INTEGER DEFAULT 0,
    daily_arena_creations INTEGER DEFAULT 0,
    last_daily_reset DATE DEFAULT CURRENT_DATE,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    
    -- Tracking
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- =====================================================
-- SUBJECTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subjects_active ON subjects(is_active, display_order);

-- Insert default subjects
INSERT INTO subjects (name, description, display_order) VALUES
    ('Physics', 'Physics questions covering mechanics, thermodynamics, optics, etc.', 1),
    ('Chemistry', 'Chemistry questions covering organic, inorganic, physical chemistry', 2),
    ('Mathematics', 'Mathematics questions covering algebra, calculus, geometry, etc.', 3),
    ('Biology', 'Biology questions covering botany, zoology, human physiology, etc.', 4)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- CHAPTERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_id, name)
);

CREATE INDEX idx_chapters_subject ON chapters(subject_id, is_active, display_order);

-- Insert sample chapters for Physics
INSERT INTO chapters (subject_id, name, display_order)
SELECT id, 'Mechanics', 1 FROM subjects WHERE name = 'Physics'
UNION ALL
SELECT id, 'Thermodynamics', 2 FROM subjects WHERE name = 'Physics'
UNION ALL
SELECT id, 'Optics', 3 FROM subjects WHERE name = 'Physics'
UNION ALL
SELECT id, 'Electromagnetism', 4 FROM subjects WHERE name = 'Physics'
ON CONFLICT (subject_id, name) DO NOTHING;

-- Insert sample chapters for Chemistry
INSERT INTO chapters (subject_id, name, display_order)
SELECT id, 'Organic Chemistry', 1 FROM subjects WHERE name = 'Chemistry'
UNION ALL
SELECT id, 'Inorganic Chemistry', 2 FROM subjects WHERE name = 'Chemistry'
UNION ALL
SELECT id, 'Physical Chemistry', 3 FROM subjects WHERE name = 'Chemistry'
ON CONFLICT (subject_id, name) DO NOTHING;

-- Insert sample chapters for Mathematics
INSERT INTO chapters (subject_id, name, display_order)
SELECT id, 'Algebra', 1 FROM subjects WHERE name = 'Mathematics'
UNION ALL
SELECT id, 'Calculus', 2 FROM subjects WHERE name = 'Mathematics'
UNION ALL
SELECT id, 'Geometry', 3 FROM subjects WHERE name = 'Mathematics'
UNION ALL
SELECT id, 'Trigonometry', 4 FROM subjects WHERE name = 'Mathematics'
ON CONFLICT (subject_id, name) DO NOTHING;

-- =====================================================
-- QUESTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    
    -- Question content
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"}
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    
    -- Metadata
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    marks INTEGER DEFAULT 4 CHECK (marks >= 1 AND marks <= 10),
    tags TEXT[] DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    
    -- Usage stats
    times_used INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    times_incorrect INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_subject ON questions(subject_id, is_active);
CREATE INDEX idx_questions_chapter ON questions(chapter_id, is_active);
CREATE INDEX idx_questions_difficulty ON questions(difficulty, is_active);
CREATE INDEX idx_questions_filters ON questions(subject_id, difficulty, is_active) WHERE is_active = true;

-- =====================================================
-- USER ANSWERS TABLE (for tracking all answers)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_answer TEXT CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN NOT NULL,
    time_taken_seconds INTEGER,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Context (which test/arena was this from)
    context_type TEXT CHECK (context_type IN ('mock_test', 'arena', 'daily_practice')),
    context_id UUID -- Reference to mock_test or arena
);

CREATE INDEX idx_user_answers_user ON user_answers(user_id, attempted_at);
CREATE INDEX idx_user_answers_question ON user_answers(question_id);
CREATE INDEX idx_user_answers_context ON user_answers(context_type, context_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
    BEFORE UPDATE ON chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update question stats when user answers
CREATE OR REPLACE FUNCTION update_question_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE questions
    SET times_used = times_used + 1,
        times_correct = times_correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
        times_incorrect = times_incorrect + CASE WHEN NOT NEW.is_correct THEN 1 ELSE 0 END
    WHERE id = NEW.question_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_question_stats_trigger
    AFTER INSERT ON user_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_question_stats();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Everyone can read subjects and chapters
CREATE POLICY "Anyone can view active subjects" ON subjects
    FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active chapters" ON chapters
    FOR SELECT USING (is_active = true);

-- Everyone can read questions
CREATE POLICY "Anyone can view active questions" ON questions
    FOR SELECT USING (is_active = true);

-- Users can view and insert their own answers
CREATE POLICY "Users can view their own answers" ON user_answers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own answers" ON user_answers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins can manage users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can manage subjects" ON subjects
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can manage chapters" ON chapters
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can manage questions" ON questions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Reset daily usage limits
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET daily_mock_attempts = 0,
        daily_arena_creations = 0,
        last_daily_reset = CURRENT_DATE
    WHERE last_daily_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Check if user can create mock test
CREATE OR REPLACE FUNCTION can_create_mock(p_user_id UUID)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_subscription_status TEXT;
    v_daily_attempts INTEGER;
    v_last_reset DATE;
BEGIN
    -- Get user data
    SELECT 
        subscription_status,
        daily_mock_attempts,
        last_daily_reset
    INTO v_subscription_status, v_daily_attempts, v_last_reset
    FROM users
    WHERE id = p_user_id;
    
    -- Reset if needed
    IF v_last_reset < CURRENT_DATE THEN
        UPDATE users
        SET daily_mock_attempts = 0,
            last_daily_reset = CURRENT_DATE
        WHERE id = p_user_id;
        
        v_daily_attempts := 0;
    END IF;
    
    -- Paid users: unlimited
    IF v_subscription_status = 'active' THEN
        RETURN QUERY SELECT true, 'Paid user - unlimited access';
        RETURN;
    END IF;
    
    -- Free users: 2 per week (simplified to 2 per day for now)
    IF v_daily_attempts >= 2 THEN
        RETURN QUERY SELECT false, 'Daily limit reached (2 mock tests/day for free users)';
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, 'OK';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE users IS 'User accounts with subscription tracking';
COMMENT ON TABLE subjects IS 'Academic subjects (Physics, Chemistry, etc.)';
COMMENT ON TABLE chapters IS 'Chapters within subjects';
COMMENT ON TABLE questions IS 'Question bank with options and answers';
COMMENT ON TABLE user_answers IS 'Tracks all user answers across mocks/arenas';
