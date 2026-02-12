-- Additional auth tables and enhancements

-- Table: user_sessions (for single active session enforcement)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    device_id TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_session UNIQUE (user_id, is_active) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Remove constraint and use partial index instead
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS unique_active_session;

CREATE UNIQUE INDEX idx_user_sessions_unique_active ON user_sessions(user_id) 
    WHERE is_active = true;

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity_at);

-- Table: device_changes_log (track device changes per month)
CREATE TABLE IF NOT EXISTS device_changes_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_device_id TEXT,
    new_device_id TEXT NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL
);

CREATE INDEX idx_device_changes_user_id ON device_changes_log(user_id);
CREATE INDEX idx_device_changes_user_month ON device_changes_log(user_id, year, month);
CREATE INDEX idx_device_changes_changed_at ON device_changes_log(changed_at DESC);

-- Table: ip_blocks (temporary IP blocking)
CREATE TABLE IF NOT EXISTS ip_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    failed_attempts INTEGER DEFAULT 0,
    blocked_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ip_blocks_ip_address ON ip_blocks(ip_address);
CREATE INDEX idx_ip_blocks_user_id ON ip_blocks(user_id);
CREATE INDEX idx_ip_blocks_blocked_until ON ip_blocks(blocked_until);
CREATE INDEX idx_ip_blocks_is_active ON ip_blocks(is_active) WHERE is_active = true;

-- Table: user_consents (Terms & Conditions, Age Declaration)
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL, -- 'terms_and_conditions', 'privacy_policy', 'age_declaration'
    consent_version TEXT NOT NULL,
    consented_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_consent_type ON user_consents(consent_type);
CREATE INDEX idx_user_consents_user_type ON user_consents(user_id, consent_type);

-- Function: Count device changes for current month
CREATE OR REPLACE FUNCTION count_device_changes_current_month(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM device_changes_log
    WHERE user_id = p_user_id
        AND year = EXTRACT(YEAR FROM NOW())
        AND month = EXTRACT(MONTH FROM NOW());
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
    v_blocked BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM ip_blocks
        WHERE ip_address = p_ip_address
            AND is_active = true
            AND blocked_until > NOW()
    ) INTO v_blocked;
    
    RETURN COALESCE(v_blocked, false);
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user has given consent
CREATE OR REPLACE FUNCTION has_user_consent(
    p_user_id UUID,
    p_consent_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_consent BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM user_consents
        WHERE user_id = p_user_id
            AND consent_type = p_consent_type
    ) INTO v_has_consent;
    
    RETURN COALESCE(v_has_consent, false);
END;
$$ LANGUAGE plpgsql;

-- Function: Deactivate old sessions when new session is created
CREATE OR REPLACE FUNCTION deactivate_old_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- Deactivate all other active sessions for this user
    UPDATE user_sessions
    SET is_active = false,
        last_activity_at = NOW()
    WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_active = true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-deactivate old sessions
CREATE TRIGGER trigger_deactivate_old_sessions
    AFTER INSERT ON user_sessions
    FOR EACH ROW
    WHEN (NEW.is_active = true)
    EXECUTE FUNCTION deactivate_old_sessions();

-- Function: Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_active = false
    WHERE is_active = true
        AND expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_token TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_sessions
    SET last_activity_at = NOW()
    WHERE session_token = p_session_token
        AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for new tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- User sessions policies
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage sessions" ON user_sessions
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Device changes log policies
CREATE POLICY "Users can view their own device changes" ON device_changes_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage device changes" ON device_changes_log
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- IP blocks policies (service role only)
CREATE POLICY "Service role can manage IP blocks" ON ip_blocks
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- User consents policies
CREATE POLICY "Users can view their own consents" ON user_consents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage consents" ON user_consents
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');
