-- Razorpay Manual Subscription System

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price_inr INTEGER NOT NULL, -- Price in paise (100 paise = 1 INR)
    duration_days INTEGER NOT NULL DEFAULT 30,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Status Management
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed')),
    
    -- Subscription Period
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Payment Info
    amount_paid INTEGER, -- Amount in paise
    payment_method TEXT DEFAULT 'razorpay',
    
    -- Razorpay Details
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    razorpay_signature TEXT,
    
    -- Retry Logic (3 attempts before downgrade)
    payment_retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, started_at) -- Prevent duplicate active subscriptions
);

CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_expires ON user_subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX idx_user_subscriptions_retry ON user_subscriptions(next_retry_at) WHERE status = 'pending' AND payment_retry_count < 3;

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    
    -- Transaction Details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription', 'manual_verification', 'refund_rejected')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refund_rejected')),
    amount INTEGER NOT NULL, -- Amount in paise
    currency TEXT DEFAULT 'INR',
    
    -- Razorpay Details
    razorpay_payment_id TEXT UNIQUE,
    razorpay_order_id TEXT,
    razorpay_signature TEXT,
    payment_link TEXT,
    
    -- Webhook Data
    webhook_received_at TIMESTAMPTZ,
    webhook_payload JSONB,
    signature_verified BOOLEAN DEFAULT false,
    
    -- Manual Verification (Admin)
    manually_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    -- Payment Method Details
    payment_method TEXT,
    payment_email TEXT,
    payment_contact TEXT,
    
    -- Refund Prevention
    refund_requested BOOLEAN DEFAULT false,
    refund_rejected_at TIMESTAMPTZ,
    refund_rejection_reason TEXT DEFAULT 'No refunds as per policy',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX idx_payment_transactions_razorpay_id ON payment_transactions(razorpay_payment_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_manual_verify ON payment_transactions(manually_verified) WHERE manually_verified = false AND status = 'pending';

-- Subscription Expiry Reminders
CREATE TABLE IF NOT EXISTS subscription_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('7_days', '3_days', '1_day', 'expired')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(subscription_id, reminder_type)
);

CREATE INDEX idx_subscription_reminders_user ON subscription_reminders(user_id);
CREATE INDEX idx_subscription_reminders_subscription ON subscription_reminders(subscription_id);

-- Function: Get user's active subscription
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_name TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id,
        sp.name,
        us.status,
        us.expires_at,
        CASE 
            WHEN us.expires_at IS NOT NULL 
            THEN EXTRACT(DAY FROM us.expires_at - NOW())::INTEGER
            ELSE NULL
        END
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id
      AND us.status = 'active'
      AND us.expires_at > NOW()
    ORDER BY us.expires_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND expires_at > NOW();
    
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function: Process expired subscriptions
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- Update expired subscriptions
    WITH updated AS (
        UPDATE user_subscriptions
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'active'
          AND expires_at <= NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM updated;
    
    -- Update users table subscription_status
    UPDATE users u
    SET subscription_status = 'inactive'
    FROM user_subscriptions us
    WHERE u.id = us.user_id
      AND us.status = 'expired'
      AND u.subscription_status = 'active';
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get subscriptions needing reminders
CREATE OR REPLACE FUNCTION get_subscriptions_needing_reminders()
RETURNS TABLE (
    subscription_id UUID,
    user_id UUID,
    user_email TEXT,
    expires_at TIMESTAMPTZ,
    days_remaining INTEGER,
    reminder_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- 7 days reminder
    SELECT 
        us.id,
        us.user_id,
        u.email,
        us.expires_at,
        EXTRACT(DAY FROM us.expires_at - NOW())::INTEGER,
        '7_days'::TEXT
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    WHERE us.status = 'active'
      AND us.expires_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '7 days'
      AND NOT EXISTS (
          SELECT 1 FROM subscription_reminders sr
          WHERE sr.subscription_id = us.id AND sr.reminder_type = '7_days'
      )
    
    UNION ALL
    
    -- 3 days reminder
    SELECT 
        us.id,
        us.user_id,
        u.email,
        us.expires_at,
        EXTRACT(DAY FROM us.expires_at - NOW())::INTEGER,
        '3_days'::TEXT
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    WHERE us.status = 'active'
      AND us.expires_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '3 days'
      AND NOT EXISTS (
          SELECT 1 FROM subscription_reminders sr
          WHERE sr.subscription_id = us.id AND sr.reminder_type = '3_days'
      )
    
    UNION ALL
    
    -- 1 day reminder
    SELECT 
        us.id,
        us.user_id,
        u.email,
        us.expires_at,
        EXTRACT(DAY FROM us.expires_at - NOW())::INTEGER,
        '1_day'::TEXT
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    WHERE us.status = 'active'
      AND us.expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 day'
      AND NOT EXISTS (
          SELECT 1 FROM subscription_reminders sr
          WHERE sr.subscription_id = us.id AND sr.reminder_type = '1_day'
      );
END;
$$ LANGUAGE plpgsql;

-- Function: Retry failed payment
CREATE OR REPLACE FUNCTION retry_failed_payment(p_subscription_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
BEGIN
    -- Get current retry count
    SELECT payment_retry_count INTO v_retry_count
    FROM user_subscriptions
    WHERE id = p_subscription_id;
    
    -- Check if under 3 retries
    IF v_retry_count >= 3 THEN
        -- Exceeded retry limit, mark as failed
        UPDATE user_subscriptions
        SET status = 'failed',
            updated_at = NOW()
        WHERE id = p_subscription_id;
        
        RETURN FALSE;
    END IF;
    
    -- Increment retry count
    UPDATE user_subscriptions
    SET payment_retry_count = payment_retry_count + 1,
        last_retry_at = NOW(),
        next_retry_at = NOW() + INTERVAL '24 hours',
        updated_at = NOW()
    WHERE id = p_subscription_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_reminders ENABLE ROW LEVEL SECURITY;

-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Users can view their own subscriptions
CREATE POLICY "Users can view their subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own transactions
CREATE POLICY "Users can view their transactions" ON payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (requires is_admin flag in users table)
CREATE POLICY "Admins can view all subscriptions" ON user_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admins can update subscriptions" ON user_subscriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admins can view all transactions" ON payment_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_inr, duration_days, features) VALUES
    ('Monthly Pro', 'Full access to all features', 49900, 30, '{"unlimited_mocks": true, "unlimited_arenas": true, "priority_support": true}'),
    ('Quarterly Pro', 'Save 15% with quarterly plan', 127400, 90, '{"unlimited_mocks": true, "unlimited_arenas": true, "priority_support": true, "discount": "15%"}'),
    ('Annual Pro', 'Save 30% with annual plan', 419300, 365, '{"unlimited_mocks": true, "unlimited_arenas": true, "priority_support": true, "discount": "30%"}')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE subscription_plans IS 'Available subscription plans';
COMMENT ON TABLE user_subscriptions IS 'User subscription records with retry logic (max 3 attempts)';
COMMENT ON TABLE payment_transactions IS 'Payment transaction log with webhook verification';
COMMENT ON TABLE subscription_reminders IS 'Expiry reminder tracking (7d, 3d, 1d before expiry)';
