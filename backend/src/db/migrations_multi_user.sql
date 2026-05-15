-- Migration: Multi-user System and Roles expansion
-- ===============================================

-- 1. Add username column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);

-- 2. Update roles column to be more flexible (VARCHAR instead of ENUM if it was one)
-- The current schema uses an enum 'user_role'. Let's change it to VARCHAR to simplify expansion.
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50);

-- 3. Migrate existing roles to the new naming convention
-- admin -> owner (DUEÑO)
-- seller -> employee (EMPLEADO)
-- driver -> delivery (DELIVERY)
-- viewer -> viewer (SOLO LECTURA) - stays same
UPDATE users SET role = 'owner' WHERE role = 'admin';
UPDATE users SET role = 'employee' WHERE role = 'seller';
UPDATE users SET role = 'delivery' WHERE role = 'driver';

-- 4. Create User Invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Internal Comments table
CREATE TABLE IF NOT EXISTS internal_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'order', 'customer', etc.
    entity_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_internal_comments_entity ON internal_comments(entity_type, entity_id);

-- 7. Add RLS policies for the new tables
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_comments ENABLE ROW LEVEL SECURITY;

-- Assuming get_current_business_id() exists from previous schema
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_invitations') THEN
        CREATE POLICY tenant_isolation_invitations ON user_invitations
            FOR ALL USING (business_id = (SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID))
            WITH CHECK (business_id = (SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_comments') THEN
        CREATE POLICY tenant_isolation_comments ON internal_comments
            FOR ALL USING (business_id = (SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID))
            WITH CHECK (business_id = (SELECT NULLIF(current_setting('app.current_business_id', true), '')::UUID));
    END IF;
END $$;
