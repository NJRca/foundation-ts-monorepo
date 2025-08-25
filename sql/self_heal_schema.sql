-- Self-healing system database schema
-- This migration adds tables for tracking error fingerprints and healing events

-- Error fingerprints table
CREATE TABLE IF NOT EXISTS error_fingerprints (
    id VARCHAR(16) PRIMARY KEY,
    pattern TEXT NOT NULL,
    service VARCHAR(255) NOT NULL,
    error_type VARCHAR(100) NOT NULL,
    stack_signature VARCHAR(12) NOT NULL,
    frequency INTEGER DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'healing', 'resolved', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Self-healing events table
CREATE TABLE IF NOT EXISTS self_heal_events (
    id VARCHAR(32) PRIMARY KEY,
    fingerprint_id VARCHAR(16) NOT NULL REFERENCES error_fingerprints(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('error_detected', 'healing_started', 'healing_completed', 'healing_failed')),
    service VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Healing results table
CREATE TABLE IF NOT EXISTS healing_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_id VARCHAR(16) NOT NULL REFERENCES error_fingerprints(id) ON DELETE CASCADE,
    strategy VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    confidence DECIMAL(3,2) CHECK (confidence >= 0.0 AND confidence <= 1.0),
    reasoning TEXT,
    time_to_healing INTEGER, -- milliseconds
    actions JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Healing actions table (normalized from healing_results.actions)
CREATE TABLE IF NOT EXISTS healing_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    healing_result_id UUID NOT NULL REFERENCES healing_results(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('code_fix', 'config_change', 'restart_service', 'scale_resource', 'dependency_update')),
    description TEXT NOT NULL,
    target VARCHAR(255) NOT NULL,
    content TEXT,
    executed BOOLEAN DEFAULT FALSE,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Log entries table (for storing processed logs)
CREATE TABLE IF NOT EXISTS log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_id VARCHAR(16) REFERENCES error_fingerprints(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message TEXT NOT NULL,
    service VARCHAR(255) NOT NULL,
    request_id VARCHAR(50),
    user_id VARCHAR(50),
    stack_trace TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_fingerprints_service ON error_fingerprints(service);
CREATE INDEX IF NOT EXISTS idx_error_fingerprints_severity ON error_fingerprints(severity);
CREATE INDEX IF NOT EXISTS idx_error_fingerprints_status ON error_fingerprints(status);
CREATE INDEX IF NOT EXISTS idx_error_fingerprints_last_seen ON error_fingerprints(last_seen);

CREATE INDEX IF NOT EXISTS idx_self_heal_events_fingerprint_id ON self_heal_events(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_self_heal_events_event_type ON self_heal_events(event_type);
CREATE INDEX IF NOT EXISTS idx_self_heal_events_created_at ON self_heal_events(created_at);

CREATE INDEX IF NOT EXISTS idx_healing_results_fingerprint_id ON healing_results(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_healing_results_strategy ON healing_results(strategy);
CREATE INDEX IF NOT EXISTS idx_healing_results_success ON healing_results(success);

CREATE INDEX IF NOT EXISTS idx_healing_actions_healing_result_id ON healing_actions(healing_result_id);
CREATE INDEX IF NOT EXISTS idx_healing_actions_action_type ON healing_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_healing_actions_executed ON healing_actions(executed);

CREATE INDEX IF NOT EXISTS idx_log_entries_fingerprint_id ON log_entries(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_service ON log_entries(service);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_timestamp ON log_entries(timestamp);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_error_fingerprints_updated_at
    BEFORE UPDATE ON error_fingerprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW healing_overview AS
SELECT
    fp.service,
    fp.error_type,
    fp.severity,
    fp.status,
    COUNT(*) as fingerprint_count,
    AVG(fp.frequency) as avg_frequency,
    MAX(fp.last_seen) as latest_occurrence,
    COUNT(hr.id) as healing_attempts,
    COUNT(CASE WHEN hr.success = true THEN 1 END) as successful_healings,
    ROUND(
        COUNT(CASE WHEN hr.success = true THEN 1 END)::decimal /
        NULLIF(COUNT(hr.id), 0) * 100,
        2
    ) as success_rate
FROM error_fingerprints fp
LEFT JOIN healing_results hr ON fp.id = hr.fingerprint_id
GROUP BY fp.service, fp.error_type, fp.severity, fp.status
ORDER BY fp.service, fp.severity DESC;

CREATE OR REPLACE VIEW recent_healing_activity AS
SELECT
    fp.service,
    fp.error_type,
    fp.pattern,
    fp.severity,
    hr.strategy,
    hr.success,
    hr.confidence,
    hr.time_to_healing,
    hr.created_at as healing_timestamp
FROM healing_results hr
JOIN error_fingerprints fp ON hr.fingerprint_id = fp.id
WHERE hr.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY hr.created_at DESC;

-- Function to get healing statistics
CREATE OR REPLACE FUNCTION get_healing_stats()
RETURNS TABLE (
    total_fingerprints bigint,
    resolved_fingerprints bigint,
    active_healings bigint,
    critical_errors bigint,
    avg_healing_time numeric,
    success_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_fingerprints,
        COUNT(CASE WHEN fp.status = 'resolved' THEN 1 END) as resolved_fingerprints,
        COUNT(CASE WHEN fp.status = 'healing' THEN 1 END) as active_healings,
        COUNT(CASE WHEN fp.severity = 'critical' THEN 1 END) as critical_errors,
        COALESCE(AVG(hr.time_to_healing), 0) as avg_healing_time,
        ROUND(
            COALESCE(
                COUNT(CASE WHEN hr.success = true THEN 1 END)::decimal /
                NULLIF(COUNT(hr.id), 0) * 100,
                0
            ),
            2
        ) as success_rate
    FROM error_fingerprints fp
    LEFT JOIN healing_results hr ON fp.id = hr.fingerprint_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_healing_data(days_to_keep integer DEFAULT 30)
RETURNS TABLE (
    deleted_log_entries bigint,
    deleted_fingerprints bigint,
    deleted_events bigint
) AS $$
DECLARE
    cutoff_date timestamp with time zone;
    log_count bigint;
    fp_count bigint;
    event_count bigint;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - (days_to_keep || ' days')::interval;

    -- Delete old log entries
    DELETE FROM log_entries WHERE created_at < cutoff_date;
    GET DIAGNOSTICS log_count = ROW_COUNT;

    -- Delete old resolved fingerprints
    DELETE FROM error_fingerprints
    WHERE status = 'resolved' AND updated_at < cutoff_date;
    GET DIAGNOSTICS fp_count = ROW_COUNT;

    -- Delete old events (will cascade to related data)
    DELETE FROM self_heal_events WHERE created_at < cutoff_date;
    GET DIAGNOSTICS event_count = ROW_COUNT;

    RETURN QUERY SELECT log_count, fp_count, event_count;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO error_fingerprints (id, pattern, service, error_type, stack_signature, frequency, first_seen, last_seen, severity, status)
VALUES
    ('fp_001', 'database connection timeout', 'user-service', 'database', 'abc123', 15, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '10 minutes', 'high', 'new'),
    ('fp_002', 'authentication failed for user', 'auth-service', 'authentication', 'def456', 8, CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'medium', 'investigating'),
    ('fp_003', 'rate limit exceeded', 'api-gateway', 'network', 'ghi789', 45, CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '2 minutes', 'critical', 'healing')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions (adjust as needed for your user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO selfheal_service;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO selfheal_service;
