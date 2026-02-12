-- Test Sessions Table for Question Engine

CREATE TABLE IF NOT EXISTS test_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER NOT NULL,
    question_ids UUID[] NOT NULL,
    current_question_index INTEGER DEFAULT 0,
    answers JSONB DEFAULT '{}',
    marked_for_review UUID[] DEFAULT '{}',
    tab_switch_count INTEGER DEFAULT 0,
    total_score DECIMAL(10, 2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_sessions_user_id ON test_sessions(user_id);
CREATE INDEX idx_test_sessions_status ON test_sessions(status);
CREATE INDEX idx_test_sessions_started_at ON test_sessions(started_at DESC);
CREATE INDEX idx_test_sessions_user_status ON test_sessions(user_id, status);

-- RLS Policies
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test sessions" ON test_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test sessions" ON test_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test sessions" ON test_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_test_sessions_updated_at 
    BEFORE UPDATE ON test_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE test_sessions IS 'Active test/mock test sessions with timer and auto-save';
