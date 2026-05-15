-- 1. Actualizar roles existentes y permitir usernames nulos para compatibilidad
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL; -- Para usuarios de Google

-- 2. Crear tabla de invitaciones
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    token UUID NOT NULL UNIQUE,
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla de comentarios internos
CREATE TABLE IF NOT EXISTS internal_comments (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    entity_type VARCHAR(50) NOT NULL, -- 'order', 'customer', etc.
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 4. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON internal_comments(entity_type, entity_id);

-- 5. Asegurar que los dueños actuales tengan el rol 'owner'
UPDATE users SET role = 'owner' WHERE role IN ('admin', 'owner') OR role IS NULL;
