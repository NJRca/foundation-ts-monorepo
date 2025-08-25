-- Migration 002: Seed data
-- Insert default users for development and testing

-- Insert default admin user (password: admin123)
-- Note: Password is bcrypt hashed with salt rounds 10
INSERT INTO users (id, name, email, password_hash, roles, is_active, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'System Administrator',
    'admin@foundation.local',
    '$2b$10$rGN5wZmGjD7S7KnNP8vYu.eY8VKJFRYjNS1F0J8uLmQr7ZKnXoYKi', -- hashed 'admin123'
    ARRAY['admin', 'user'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Insert sample regular user (password: user123)
-- Note: Password is bcrypt hashed with salt rounds 10
INSERT INTO users (id, name, email, password_hash, roles, is_active, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'Sample User',
    'user@foundation.local',
    '$2b$10$8YkGdHPl5KH6FZYsNpGN2uY7VJ1J6vQgZWr9Yc5K2sHrKn4QfRzLK', -- hashed 'user123'
    ARRAY['user'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;
