-- Gemini AI System with Rate Limiting and Cost Controls

-- System-wide AI configuration flags
CREATE TABLE IF NOT EXISTS system_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_name TEXT UNIQUE NOT NULL,
    flag_value BOOLEAN DEFAULT true,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Insert default flags
INSERT INTO system_flags (flag_name, flag_value, description) VALUES
    ('ai_enabled', true, 'Master switch for all AI features'),
    ('ai_peak_hours_disabled', false, 'Disable AI during peak hours (10 AM - 6 PM IST)'),
    ('doubt_solver_enabled', true, 'Enable doubt solver feature'),
    ('performance_coach_enabled', true, 'Enable performance coach feature')
ON CONFLICT (flag_name) DO NOTHING;

-- Daily token limits configuration
CREATE TABLE IF NOT EXISTS ai_token_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    limit_type TEXT NOT NULL CHECK (limit_type IN ('per_user_daily', 'global_daily', 'per_user_monthly')),
    token_limit INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default limits
INSERT INTO ai_token_limits (limit_type, token_limit) VALUES
    ('per_user_daily', 10000),    -- 10K tokens per user per day
    ('global_daily', 1000000),    -- 1M tokens globally per day
    ('per_user_monthly', 200000)  -- 200K tokens per user per month
ON CONFLICT DO NOTHING;

-- User AI usage tracking
CREATE TABLE IF NOT EXISTS user_ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Token tracking
    total_tokens_used INTEGER DEFAULT 0,
    input_tokens_used INTEGER DEFAULT 0,
    output_tokens_used INTEGER DEFAULT 0,
    
    -- Request counts
    doubt_solver_requests INTEGER DEFAULT 0,
    performance_coach_requests INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    
    -- Cost estimation (tokens * rate)
    estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, usage_date)
);

CREATE INDEX idx_user_ai_usage_user_date ON user_ai_usage(user_id, usage_date);
CREATE INDEX idx_user_ai_usage_date ON user_ai_usage(usage_date);

-- AI interaction logs (detailed tracking)
CREATE TABLE IF NOT EXISTS ai_interaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Interaction details
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('doubt_solver', 'performance_coach', 'other')),
    prompt_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    
    -- Token usage
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    
    -- Model info
    model_name TEXT DEFAULT 'gemini-1.5-flash',
    response_time_ms INTEGER,
    
    -- Status
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rate_limited', 'quota_exceeded')),
    error_message TEXT,
    
    -- Metadata
    user_agent TEXT,
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_logs_user ON ai_interaction_logs(user_id);
CREATE INDEX idx_ai_logs_type ON ai_interaction_logs(interaction_type);
CREATE INDEX idx_ai_logs_date ON ai_interaction_logs(created_at);
CREATE INDEX idx_ai_logs_status ON ai_interaction_logs(status);

-- Global daily usage aggregation (for global cap)
CREATE TABLE IF NOT EXISTS ai_global_usage (
    usage_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    total_tokens_used INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting table (per user, per minute)
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    minute_bucket TIMESTAMPTZ NOT NULL, -- Truncated to minute
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (user_id, minute_bucket)
);

CREATE INDEX idx_rate_limits_minute ON ai_rate_limits(minute_bucket);

-- Function: Check if AI is available
CREATE OR REPLACE FUNCTION is_ai_available()
RETURNS BOOLEAN AS $$
DECLARE
    v_ai_enabled BOOLEAN;
    v_peak_disabled BOOLEAN;
    v_current_hour INTEGER;
BEGIN
    -- Check master switch
    SELECT flag_value INTO v_ai_enabled
    FROM system_flags
    WHERE flag_name = 'ai_enabled';
    
    IF NOT v_ai_enabled THEN
        RETURN false;
    END IF;
    
    -- Check peak hours (10 AM - 6 PM IST)
    SELECT flag_value INTO v_peak_disabled
    FROM system_flags
    WHERE flag_name = 'ai_peak_hours_disabled';
    
    IF v_peak_disabled THEN
        v_current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata');
        IF v_current_hour >= 10 AND v_current_hour < 18 THEN
            RETURN false;
        END IF;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Check user daily token limit
CREATE OR REPLACE FUNCTION check_user_token_limit(p_user_id UUID, p_estimated_tokens INTEGER)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    tokens_used INTEGER,
    tokens_remaining INTEGER
) AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
    v_remaining INTEGER;
BEGIN
    -- Get per-user daily limit
    SELECT token_limit INTO v_limit
    FROM ai_token_limits
    WHERE limit_type = 'per_user_daily' AND is_active = true
    LIMIT 1;
    
    -- Get user's usage today
    SELECT COALESCE(total_tokens_used, 0) INTO v_used
    FROM user_ai_usage
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
    v_used := COALESCE(v_used, 0);
    v_remaining := v_limit - v_used;
    
    IF v_used + p_estimated_tokens > v_limit THEN
        RETURN QUERY SELECT 
            false,
            'Daily token limit exceeded',
            v_used,
            v_remaining;
    ELSE
        RETURN QUERY SELECT 
            true,
            'OK',
            v_used,
            v_remaining;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Check global daily token limit
CREATE OR REPLACE FUNCTION check_global_token_limit(p_estimated_tokens INTEGER)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    -- Get global daily limit
    SELECT token_limit INTO v_limit
    FROM ai_token_limits
    WHERE limit_type = 'global_daily' AND is_active = true
    LIMIT 1;
    
    -- Get global usage today
    SELECT COALESCE(total_tokens_used, 0) INTO v_used
    FROM ai_global_usage
    WHERE usage_date = CURRENT_DATE;
    
    v_used := COALESCE(v_used, 0);
    
    IF v_used + p_estimated_tokens > v_limit THEN
        RETURN QUERY SELECT 
            false,
            'Global daily token limit exceeded';
    ELSE
        RETURN QUERY SELECT 
            true,
            'OK';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Check rate limit (requests per minute)
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_max_per_minute INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_minute TIMESTAMPTZ;
    v_request_count INTEGER;
BEGIN
    v_current_minute := DATE_TRUNC('minute', NOW());
    
    -- Get request count for current minute
    SELECT COALESCE(request_count, 0) INTO v_request_count
    FROM ai_rate_limits
    WHERE user_id = p_user_id AND minute_bucket = v_current_minute;
    
    v_request_count := COALESCE(v_request_count, 0);
    
    RETURN v_request_count < p_max_per_minute;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_current_minute TIMESTAMPTZ;
BEGIN
    v_current_minute := DATE_TRUNC('minute', NOW());
    
    INSERT INTO ai_rate_limits (user_id, minute_bucket, request_count)
    VALUES (p_user_id, v_current_minute, 1)
    ON CONFLICT (user_id, minute_bucket)
    DO UPDATE SET request_count = ai_rate_limits.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Log AI usage
CREATE OR REPLACE FUNCTION log_ai_usage(
    p_user_id UUID,
    p_interaction_type TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_total_tokens INTEGER;
    v_cost_per_million DECIMAL := 0.075; -- $0.075 per 1M tokens for Gemini Flash
    v_cost DECIMAL;
BEGIN
    v_total_tokens := p_input_tokens + p_output_tokens;
    v_cost := (v_total_tokens::DECIMAL / 1000000) * v_cost_per_million;
    
    -- Update user daily usage
    INSERT INTO user_ai_usage (user_id, usage_date, total_tokens_used, input_tokens_used, output_tokens_used, total_requests, estimated_cost_usd)
    VALUES (p_user_id, CURRENT_DATE, v_total_tokens, p_input_tokens, p_output_tokens, 1, v_cost)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        total_tokens_used = user_ai_usage.total_tokens_used + v_total_tokens,
        input_tokens_used = user_ai_usage.input_tokens_used + p_input_tokens,
        output_tokens_used = user_ai_usage.output_tokens_used + p_output_tokens,
        total_requests = user_ai_usage.total_requests + 1,
        estimated_cost_usd = user_ai_usage.estimated_cost_usd + v_cost,
        updated_at = NOW();
    
    -- Update specific request type counter
    IF p_interaction_type = 'doubt_solver' THEN
        UPDATE user_ai_usage
        SET doubt_solver_requests = doubt_solver_requests + 1
        WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    ELSIF p_interaction_type = 'performance_coach' THEN
        UPDATE user_ai_usage
        SET performance_coach_requests = performance_coach_requests + 1
        WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    END IF;
    
    -- Update global usage
    INSERT INTO ai_global_usage (usage_date, total_tokens_used, total_requests, estimated_cost_usd)
    VALUES (CURRENT_DATE, v_total_tokens, 1, v_cost)
    ON CONFLICT (usage_date)
    DO UPDATE SET
        total_tokens_used = ai_global_usage.total_tokens_used + v_total_tokens,
        total_requests = ai_global_usage.total_requests + 1,
        estimated_cost_usd = ai_global_usage.estimated_cost_usd + v_cost,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get user token usage stats
CREATE OR REPLACE FUNCTION get_user_token_stats(p_user_id UUID)
RETURNS TABLE (
    tokens_used_today INTEGER,
    tokens_remaining_today INTEGER,
    daily_limit INTEGER,
    requests_today INTEGER,
    estimated_cost_today DECIMAL
) AS $$
DECLARE
    v_limit INTEGER;
    v_used INTEGER;
    v_requests INTEGER;
    v_cost DECIMAL;
BEGIN
    -- Get daily limit
    SELECT token_limit INTO v_limit
    FROM ai_token_limits
    WHERE limit_type = 'per_user_daily' AND is_active = true
    LIMIT 1;
    
    -- Get today's usage
    SELECT 
        COALESCE(total_tokens_used, 0),
        COALESCE(total_requests, 0),
        COALESCE(estimated_cost_usd, 0)
    INTO v_used, v_requests, v_cost
    FROM user_ai_usage
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    
    v_used := COALESCE(v_used, 0);
    v_requests := COALESCE(v_requests, 0);
    v_cost := COALESCE(v_cost, 0);
    
    RETURN QUERY SELECT 
        v_used,
        v_limit - v_used,
        v_limit,
        v_requests,
        v_cost;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old rate limit records (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_rate_limits
    WHERE minute_bucket < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_system_flags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_flags_updated_at
    BEFORE UPDATE ON system_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_system_flags_timestamp();

-- RLS Policies
ALTER TABLE system_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_token_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_global_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their AI usage" ON user_ai_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their AI logs" ON ai_interaction_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view everything
CREATE POLICY "Admins can view all AI usage" ON user_ai_usage
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can view all AI logs" ON ai_interaction_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "Admins can manage system flags" ON system_flags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

COMMENT ON TABLE system_flags IS 'System-wide AI feature flags (enable/disable AI, peak hours)';
COMMENT ON TABLE ai_token_limits IS 'Token limits configuration (per-user daily, global daily)';
COMMENT ON TABLE user_ai_usage IS 'User AI usage tracking (tokens, requests, cost)';
COMMENT ON TABLE ai_interaction_logs IS 'Detailed AI interaction logs';
COMMENT ON TABLE ai_global_usage IS 'Global daily usage aggregation';
COMMENT ON TABLE ai_rate_limits IS 'Rate limiting (requests per minute)';
