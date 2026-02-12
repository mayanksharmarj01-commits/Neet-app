-- Admin Panel & Performance Optimization Schema

-- =====================================================
-- ROLE-BASED ACCESS CONTROL (RBAC)
-- =====================================================

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name TEXT UNIQUE NOT NULL CHECK (role_name IN ('super_admin', 'admin', 'moderator', 'content_manager')),
    description TEXT,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles assignment
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- Insert default roles
INSERT INTO admin_roles (role_name, description, permissions) VALUES
    ('super_admin', 'Full system access', '{"all": true}'),
    ('admin', 'Manage users, content, analytics', '{"users": true, "content": true, "analytics": true, "subscriptions": true}'),
    ('moderator', 'Moderate content and users', '{"users": ["view", "ban", "warn"], "content": ["view", "edit", "delete"]}'),
    ('content_manager', 'Manage questions and content', '{"content": true, "questions": true}')
ON CONFLICT (role_name) DO NOTHING;

-- =====================================================
-- ANALYTICS & METRICS CACHING
-- =====================================================

-- Daily analytics cache
CREATE TABLE IF NOT EXISTS analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('dau', 'revenue', 'subscriptions', 'ai_usage', 'mock_attempts', 'arena_activity')),
    metric_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_date, metric_type)
);

CREATE INDEX idx_analytics_cache_date_type ON analytics_cache(metric_date, metric_type);

-- User activity tracking (for DAU/MAU)
CREATE TABLE IF NOT EXISTS user_activity (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    actions_count INTEGER DEFAULT 1,
    last_action_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (user_id, activity_date)
);

CREATE INDEX idx_user_activity_date ON user_activity(activity_date);

-- Churn tracking
CREATE TABLE IF NOT EXISTS user_churn (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    churn_date DATE NOT NULL,
    reason TEXT,
    previous_subscription_id UUID REFERENCES user_subscriptions(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, churn_date)
);

CREATE INDEX idx_user_churn_date ON user_churn(churn_date);

-- =====================================================
-- USER MODERATION
-- =====================================================

-- Banned users
CREATE TABLE IF NOT EXISTS banned_users (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    banned_by UUID REFERENCES users(id),
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL,
    unban_at TIMESTAMPTZ,
    is_permanent BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_banned_users_unban ON banned_users(unban_at) WHERE unban_at IS NOT NULL;

-- User warnings
CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_by UUID REFERENCES users(id),
    warning_type TEXT NOT NULL,
    message TEXT NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_warnings_user ON user_warnings(user_id);

-- =====================================================
-- LEADERBOARD OVERRIDES
-- =====================================================

-- Manual leaderboard adjustments
CREATE TABLE IF NOT EXISTS leaderboard_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    override_type TEXT NOT NULL CHECK (override_type IN ('rank', 'score', 'hide')),
    override_value JSONB NOT NULL,
    reason TEXT NOT NULL,
    applied_by UUID REFERENCES users(id),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_leaderboard_overrides_user ON leaderboard_overrides(user_id) WHERE is_active = true;

-- =====================================================
-- QUESTION MANAGEMENT
-- =====================================================

-- Question edit history
CREATE TABLE IF NOT EXISTS question_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    edited_by UUID REFERENCES users(id),
    field_changed TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    edited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_edit_history_question ON question_edit_history(question_id);
CREATE INDEX idx_question_edit_history_date ON question_edit_history(edited_at);

-- Bulk upload history
CREATE TABLE IF NOT EXISTS bulk_upload_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID REFERENCES users(id),
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    validation_errors JSONB DEFAULT '[]',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bulk_upload_history_user ON bulk_upload_history(uploaded_by);
CREATE INDEX idx_bulk_upload_history_status ON bulk_upload_history(status);

-- =====================================================
-- SYSTEM BACKUPS
-- =====================================================

-- Backup history
CREATE TABLE IF NOT EXISTS backup_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'manual')),
    initiated_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    file_path TEXT,
    file_size_bytes BIGINT,
    tables_included TEXT[],
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_backup_history_date ON backup_history(started_at);

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active 
    ON user_subscriptions(user_id, status, expires_at) 
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_mock_attempts_user_recent 
    ON user_mock_attempts(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_arena_participants_active 
    ON arena_participants(arena_id, user_id) 
    WHERE submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_filters 
    ON questions(subject_id, difficulty, is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_recent 
    ON payment_transactions(user_id, created_at DESC);

-- Partial indexes for hot data
CREATE INDEX IF NOT EXISTS idx_arenas_live 
    ON arenas(status, scheduled_start_time) 
    WHERE status IN ('scheduled', 'live');

CREATE INDEX IF NOT EXISTS idx_users_active_subscribed 
    ON users(subscription_status, last_login_at) 
    WHERE subscription_status = 'active';

-- =====================================================
-- ADMIN FUNCTIONS
-- =====================================================

-- Check if user has admin permission
CREATE OR REPLACE FUNCTION has_admin_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN admin_roles ar ON ar.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND (
              ar.permissions->>'all' = 'true'
              OR ar.permissions ? p_permission
          )
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Get daily active users (DAU)
CREATE OR REPLACE FUNCTION get_dau(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    v_dau INTEGER;
BEGIN
    SELECT COUNT(DISTINCT user_id)
    INTO v_dau
    FROM user_activity
    WHERE activity_date = p_date;
    
    RETURN COALESCE(v_dau, 0);
END;
$$ LANGUAGE plpgsql;

-- Get monthly active users (MAU)
CREATE OR REPLACE FUNCTION get_mau(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
    v_mau INTEGER;
BEGIN
    SELECT COUNT(DISTINCT user_id)
    INTO v_mau
    FROM user_activity
    WHERE activity_date >= DATE_TRUNC('month', p_date)
      AND activity_date < DATE_TRUNC('month', p_date) + INTERVAL '1 month';
    
    RETURN COALESCE(v_mau, 0);
END;
$$ LANGUAGE plpgsql;

-- Calculate churn rate
CREATE OR REPLACE FUNCTION get_churn_rate(p_start_date DATE, p_end_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    v_churned_count INTEGER;
    v_total_subscribers INTEGER;
    v_churn_rate DECIMAL;
BEGIN
    -- Count users who churned in the period
    SELECT COUNT(*)
    INTO v_churned_count
    FROM user_churn
    WHERE churn_date BETWEEN p_start_date AND p_end_date;
    
    -- Count total active subscribers at start of period
    SELECT COUNT(*)
    INTO v_total_subscribers
    FROM user_subscriptions
    WHERE status = 'active'
      AND started_at < p_start_date;
    
    IF v_total_subscribers = 0 THEN
        RETURN 0;
    END IF;
    
    v_churn_rate := (v_churned_count::DECIMAL / v_total_subscribers) * 100;
    
    RETURN v_churn_rate;
END;
$$ LANGUAGE plpgsql;

-- Get revenue metrics
CREATE OR REPLACE FUNCTION get_revenue_metrics(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    total_revenue DECIMAL,
    subscription_revenue DECIMAL,
    new_subscriptions INTEGER,
    renewed_subscriptions INTEGER,
    average_deal_size DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(pt.amount::DECIMAL) / 100, 0) as total_revenue,
        COALESCE(SUM(CASE WHEN pt.transaction_type = 'subscription' THEN pt.amount::DECIMAL END) / 100, 0) as subscription_revenue,
        COUNT(DISTINCT CASE WHEN us.started_at BETWEEN p_start_date AND p_end_date THEN us.id END)::INTEGER as new_subscriptions,
        COUNT(DISTINCT CASE WHEN us.payment_retry_count > 0 AND us.status = 'active' THEN us.id END)::INTEGER as renewed_subscriptions,
        COALESCE(AVG(pt.amount::DECIMAL) / 100, 0) as average_deal_size
    FROM payment_transactions pt
    LEFT JOIN user_subscriptions us ON us.id = pt.subscription_id
    WHERE pt.created_at BETWEEN p_start_date AND p_end_date
      AND pt.status = 'success';
END;
$$ LANGUAGE plpgsql;

-- Track user activity
CREATE OR REPLACE FUNCTION track_user_activity(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_activity (user_id, activity_date, actions_count, last_action_at)
    VALUES (p_user_id, CURRENT_DATE, 1, NOW())
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
        actions_count = user_activity.actions_count + 1,
        last_action_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Ban user
CREATE OR REPLACE FUNCTION ban_user(
    p_user_id UUID,
    p_banned_by UUID,
    p_reason TEXT,
    p_is_permanent BOOLEAN DEFAULT false,
    p_unban_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if admin has permission
    IF NOT has_admin_permission(p_banned_by, 'users') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Insert ban record
    INSERT INTO banned_users (user_id, banned_by, reason, is_permanent, unban_at)
    VALUES (p_user_id, p_banned_by, p_reason, p_is_permanent, p_unban_at)
    ON CONFLICT (user_id)
    DO UPDATE SET
        banned_by = p_banned_by,
        banned_at = NOW(),
        reason = p_reason,
        is_permanent = p_is_permanent,
        unban_at = p_unban_at;
    
    -- Deactivate user
    UPDATE users
    SET is_active = false
    WHERE id = p_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Refresh analytics cache
CREATE OR REPLACE FUNCTION refresh_analytics_cache(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    v_dau INTEGER;
    v_revenue RECORD;
BEGIN
    -- DAU
    v_dau := get_dau(p_date);
    INSERT INTO analytics_cache (metric_date, metric_type, metric_value)
    VALUES (p_date, 'dau', jsonb_build_object('count', v_dau))
    ON CONFLICT (metric_date, metric_type)
    DO UPDATE SET metric_value = EXCLUDED.metric_value, updated_at = NOW();
    
    -- Revenue
    SELECT * INTO v_revenue FROM get_revenue_metrics(p_date, p_date);
    INSERT INTO analytics_cache (metric_date, metric_type, metric_value)
    VALUES (p_date, 'revenue', row_to_json(v_revenue)::jsonb)
    ON CONFLICT (metric_date, metric_type)
    DO UPDATE SET metric_value = EXCLUDED.metric_value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_overrides ENABLE ROW LEVEL SECURITY;

-- Admin-only access to admin tables
CREATE POLICY "Admins can view all roles" ON admin_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN admin_roles ar ON ar.id = ur.role_id
            WHERE ur.user_id = auth.uid()
        )
    );

CREATE POLICY "Super admins can manage roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN admin_roles ar ON ar.id = ur.role_id
            WHERE ur.user_id = auth.uid()
              AND ar.role_name = 'super_admin'
        )
    );

CREATE POLICY "Admins can view analytics" ON analytics_cache
    FOR SELECT USING (has_admin_permission(auth.uid(), 'analytics'));

COMMENT ON TABLE admin_roles IS 'Role-based access control for admin panel';
COMMENT ON TABLE user_activity IS 'Daily user activity tracking for DAU/MAU metrics';
COMMENT ON TABLE analytics_cache IS 'Pre-computed analytics for dashboard performance';
COMMENT ON TABLE banned_users IS 'User moderation and bans';
COMMENT ON TABLE leaderboard_overrides IS 'Manual leaderboard adjustments by admins';
