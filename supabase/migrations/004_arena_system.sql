-- Real-time Arena System Database Schema

-- Arenas Table
CREATE TABLE IF NOT EXISTS arenas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_code TEXT UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 50 CHECK (max_participants <= 50),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    
    -- Scheduling
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    actual_start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    
    -- Question Configuration
    question_filters JSONB DEFAULT '{}', -- {subject_id, difficulty, topics, tags}
    question_ids UUID[],
    total_questions INTEGER NOT NULL,
    
    -- Settings
    show_leaderboard_after_submission BOOLEAN DEFAULT true,
    hide_leaderboard_after_solutions BOOLEAN DEFAULT true,
    auto_start BOOLEAN DEFAULT false,
    
    -- Metadata
    participant_count INTEGER DEFAULT 0,
    submission_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_arenas_room_code ON arenas(room_code);
CREATE INDEX idx_arenas_status ON arenas(status);
CREATE INDEX idx_arenas_created_by ON arenas(created_by);
CREATE INDEX idx_arenas_scheduled_start ON arenas(scheduled_start_time);
CREATE INDEX idx_arenas_last_activity ON arenas(last_activity_at);

-- Arena Participants
CREATE TABLE IF NOT EXISTS arena_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES arenas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    
    -- Answers
    answers JSONB DEFAULT '{}', -- {questionId: answer}
    
    -- Performance
    score DECIMAL(10, 2) DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    rank INTEGER,
    
    -- Flags
    is_host BOOLEAN DEFAULT false,
    has_viewed_solutions BOOLEAN DEFAULT false,
    can_view_leaderboard BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(arena_id, user_id)
);

CREATE INDEX idx_arena_participants_arena ON arena_participants(arena_id);
CREATE INDEX idx_arena_participants_user ON arena_participants(user_id);
CREATE INDEX idx_arena_participants_score ON arena_participants(arena_id, score DESC);
CREATE INDEX idx_arena_participants_submitted ON arena_participants(arena_id, submitted_at) WHERE submitted_at IS NOT NULL;

-- Arena Rankings (Separate from national leaderboard)
CREATE TABLE IF NOT EXISTS arena_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_arenas INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_score DECIMAL(10, 2) DEFAULT 0,
    average_rank DECIMAL(10, 2),
    best_rank INTEGER,
    arena_points INTEGER DEFAULT 0, -- Separate point system
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    last_arena_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_arena_rankings_points ON arena_rankings(arena_points DESC);
CREATE INDEX idx_arena_rankings_tier ON arena_rankings(tier);

-- Daily Arena Limits
CREATE TABLE IF NOT EXISTS user_arena_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    arena_date DATE NOT NULL DEFAULT CURRENT_DATE,
    arenas_created INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 2,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, arena_date)
);

CREATE INDEX idx_user_arena_limits_user_date ON user_arena_limits(user_id, arena_date);

-- Function to generate unique room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check daily arena creation limit
CREATE OR REPLACE FUNCTION check_daily_arena_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_arenas_created INTEGER;
    v_limit INTEGER;
BEGIN
    -- Get or create today's record
    INSERT INTO user_arena_limits (user_id, arena_date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, arena_date) DO NOTHING;
    
    -- Get current count
    SELECT arenas_created, daily_limit
    INTO v_arenas_created, v_limit
    FROM user_arena_limits
    WHERE user_id = p_user_id AND arena_date = CURRENT_DATE;
    
    -- Check limit
    RETURN v_arenas_created < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment arena creation count
CREATE OR REPLACE FUNCTION increment_arena_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_arena_limits (user_id, arena_date, arenas_created)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, arena_date)
    DO UPDATE SET arenas_created = user_arena_limits.arenas_created + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate arena rankings
CREATE OR REPLACE FUNCTION update_arena_rankings(p_arena_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Calculate ranks based on score and time
    WITH ranked_participants AS (
        SELECT 
            user_id,
            RANK() OVER (ORDER BY score DESC, time_taken_seconds ASC) as participant_rank
        FROM arena_participants
        WHERE arena_id = p_arena_id
          AND submitted_at IS NOT NULL
    )
    UPDATE arena_participants ap
    SET rank = rp.participant_rank
    FROM ranked_participants rp
    WHERE ap.arena_id = p_arena_id
      AND ap.user_id = rp.user_id;
    
    -- Update arena_rankings table
    INSERT INTO arena_rankings (
        user_id,
        total_arenas,
        total_wins,
        total_score,
        best_rank,
        arena_points,
        last_arena_at
    )
    SELECT 
        ap.user_id,
        1 as total_arenas,
        CASE WHEN ap.rank = 1 THEN 1 ELSE 0 END as total_wins,
        ap.score as total_score,
        ap.rank as best_rank,
        CASE 
            WHEN ap.rank = 1 THEN 100
            WHEN ap.rank = 2 THEN 75
            WHEN ap.rank = 3 THEN 50
            WHEN ap.rank <= 10 THEN 25
            ELSE 10
        END as arena_points,
        NOW() as last_arena_at
    FROM arena_participants ap
    WHERE ap.arena_id = p_arena_id
      AND ap.submitted_at IS NOT NULL
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_arenas = arena_rankings.total_arenas + 1,
        total_wins = arena_rankings.total_wins + EXCLUDED.total_wins,
        total_score = arena_rankings.total_score + EXCLUDED.total_score,
        best_rank = LEAST(arena_rankings.best_rank, EXCLUDED.best_rank),
        arena_points = arena_rankings.arena_points + EXCLUDED.arena_points,
        average_rank = (
            SELECT AVG(rank)::DECIMAL(10,2)
            FROM arena_participants
            WHERE user_id = arena_rankings.user_id
              AND submitted_at IS NOT NULL
        ),
        last_arena_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to auto-delete inactive arenas (10 days)
CREATE OR REPLACE FUNCTION cleanup_inactive_arenas()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM arenas
        WHERE last_activity_at < NOW() - INTERVAL '10 days'
          AND status IN ('completed', 'cancelled')
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_activity_at
CREATE OR REPLACE FUNCTION update_arena_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE arenas
    SET last_activity_at = NOW()
    WHERE id = NEW.arena_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_arena_activity
    AFTER INSERT OR UPDATE ON arena_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_arena_activity();

-- Trigger to update participant count
CREATE OR REPLACE FUNCTION update_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE arenas
        SET participant_count = participant_count + 1
        WHERE id = NEW.arena_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE arenas
        SET participant_count = participant_count - 1
        WHERE id = OLD.arena_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_participant_count
    AFTER INSERT OR DELETE ON arena_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_participant_count();

-- Trigger to update submission count
CREATE OR REPLACE FUNCTION update_submission_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
        UPDATE arenas
        SET submission_count = submission_count + 1
        WHERE id = NEW.arena_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_submission_count
    AFTER UPDATE ON arena_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_count();

-- Enable Realtime for arena tables
ALTER PUBLICATION supabase_realtime ADD TABLE arenas;
ALTER PUBLICATION supabase_realtime ADD TABLE arena_participants;

-- RLS Policies
ALTER TABLE arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_arena_limits ENABLE ROW LEVEL SECURITY;

-- Public arenas visible to all
CREATE POLICY "Public arenas are visible to everyone" ON arenas
    FOR SELECT USING (is_public = true OR created_by = auth.uid());

-- Private arenas visible only to participants
CREATE POLICY "Private arenas visible to participants" ON arenas
    FOR SELECT USING (
        is_public = false AND (
            created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM arena_participants
                WHERE arena_id = arenas.id AND user_id = auth.uid()
            )
        )
    );

-- Users can create arenas
CREATE POLICY "Users can create arenas" ON arenas
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Only creator can update arena
CREATE POLICY "Creator can update arena" ON arenas
    FOR UPDATE USING (auth.uid() = created_by);

-- Users can view participants of arenas they're in
CREATE POLICY "Participants can view arena participants" ON arena_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM arenas
            WHERE arenas.id = arena_participants.arena_id
              AND (arenas.is_public = true OR arenas.created_by = auth.uid())
        ) OR user_id = auth.uid()
    );

-- Users can join arenas
CREATE POLICY "Users can join arenas" ON arena_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own participation
CREATE POLICY "Users can update their participation" ON arena_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- Anyone can view arena rankings
CREATE POLICY "Anyone can view arena rankings" ON arena_rankings
    FOR SELECT USING (true);

-- Users can view their own limits
CREATE POLICY "Users can view their limits" ON user_arena_limits
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE arenas IS 'Real-time competitive arenas with scheduling and room codes';
COMMENT ON TABLE arena_participants IS 'Arena participants with real-time score updates';
COMMENT ON TABLE arena_rankings IS 'Separate arena leaderboard (does not affect national rank)';
COMMENT ON TABLE user_arena_limits IS 'Daily arena creation limits (2 per day)';
