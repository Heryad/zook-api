-- Create enum for admin roles
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'finance', 'support', 'operator');

-- Create admins table (first part without media reference)
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL, -- For storing bcrypt hashed passwords
    email VARCHAR(255),
    
    -- Role and access control
    role admin_role NOT NULL,
    country_id UUID REFERENCES countries(id) ON DELETE RESTRICT,
    city_id UUID REFERENCES cities(id) ON DELETE RESTRICT,
    
    -- Additional info
    full_name VARCHAR(100),
    phone_number VARCHAR(20),
    
    -- Status and timestamps
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_username UNIQUE (username),
    CONSTRAINT unique_email UNIQUE (email),
    CONSTRAINT super_admin_no_country CHECK (
        (role = 'super_admin' AND country_id IS NULL AND city_id IS NULL) OR
        (role != 'super_admin')
    ),
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id)
);

-- Create indexes
CREATE INDEX idx_admins_country_id ON admins (country_id);
CREATE INDEX idx_admins_city_id ON admins (city_id);
CREATE INDEX idx_admins_role ON admins (role);
CREATE INDEX idx_admins_is_active ON admins (is_active);
CREATE INDEX idx_admins_username ON admins (username);
CREATE INDEX idx_admins_email ON admins (email);

-- Create trigger for updated_at
CREATE TRIGGER update_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE admins IS 'Stores admin users with role-based and location-based access control';
COMMENT ON COLUMN admins.role IS 'Admin role that determines permissions';
COMMENT ON COLUMN admins.country_id IS 'Country this admin manages. NULL for super_admin';
COMMENT ON COLUMN admins.city_id IS 'City this admin manages. NULL for country-level access';
COMMENT ON COLUMN admins.last_login_at IS 'Timestamp of last successful login';

-- Create first super admin
INSERT INTO admins (
    username,
    password,
    email,
    role,
    full_name,
    is_active
) VALUES (
    'superadmin',
    '$2b$10$EkM9UvyZqPFnwJqZAX.zqOUgwqR3zZ1XrHF48bWqXXm0H.gGdELie',  -- Password: Admin123!
    'admin@example.com',
    'super_admin',
    'Super Admin',
    true
) ON CONFLICT (username) DO NOTHING;

-- Note: The photo_media_id column and constraint will be added after media table is created 