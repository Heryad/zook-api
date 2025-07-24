-- Create login type enum
CREATE TYPE user_login_type AS ENUM ('social', 'phone');

-- Create device type enum
CREATE TYPE user_device_type AS ENUM ('ios', 'android', 'web');

-- Create address type enum
CREATE TYPE user_address_type AS ENUM ('house', 'apartment', 'work');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    username VARCHAR(100),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    photo_media_id UUID REFERENCES media(id),
    login_type user_login_type NOT NULL,
    addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    device_type user_device_type,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT users_unique_phone UNIQUE (phone_number),
    CONSTRAINT users_unique_email UNIQUE (email),
    CONSTRAINT users_unique_username UNIQUE (username),
    CONSTRAINT users_fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    -- Note: photo media validation will be enforced at the application level
    CONSTRAINT users_fk_photo_media_country FOREIGN KEY (photo_media_id, country_id) REFERENCES media(id, country_id),
    -- Basic JSON type validation
    CONSTRAINT users_valid_addresses_type CHECK (jsonb_typeof(addresses) = 'array'),
    -- At least one contact method
    CONSTRAINT users_contact_method CHECK (
        phone_number IS NOT NULL OR email IS NOT NULL
    )
);

-- Create function to validate address structure
CREATE OR REPLACE FUNCTION validate_user_address(addr jsonb)
RETURNS boolean AS $$
BEGIN
    -- Check required fields exist
    IF NOT (
        addr ? 'name' AND
        addr ? 'type' AND
        addr ? 'street' AND
        addr ? 'city' AND
        addr ? 'description' AND
        addr ? 'latitude' AND
        addr ? 'longitude'
    ) THEN
        RETURN false;
    END IF;

    -- Validate address type
    IF NOT (addr ->> 'type' IN ('house', 'apartment', 'work')) THEN
        RETURN false;
    END IF;

    -- Validate coordinates
    IF NOT (
        (addr ->> 'latitude')::decimal BETWEEN -90 AND 90 AND
        (addr ->> 'longitude')::decimal BETWEEN -180 AND 180
    ) THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to validate addresses
CREATE OR REPLACE FUNCTION validate_user_addresses()
RETURNS TRIGGER AS $$
DECLARE
    addr jsonb;
BEGIN
    -- Skip validation if addresses is empty array
    IF jsonb_array_length(NEW.addresses) = 0 THEN
        RETURN NEW;
    END IF;

    -- Check each address
    FOR addr IN SELECT jsonb_array_elements(NEW.addresses) LOOP
        IF NOT validate_user_address(addr) THEN
            RAISE EXCEPTION 'Invalid address structure or values';
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for address validation
CREATE TRIGGER validate_user_addresses
    BEFORE INSERT OR UPDATE OF addresses ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_user_addresses();

-- Create indexes
CREATE INDEX idx_users_country_id ON users(country_id);
CREATE INDEX idx_users_city_id ON users(city_id);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_photo_media_id ON users(photo_media_id);
CREATE INDEX idx_users_login_type ON users(login_type);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_device_type ON users(device_type);
CREATE INDEX idx_users_created_at ON users(created_at);
-- Index for address search (GIN index for JSONB)
CREATE INDEX idx_users_addresses ON users USING gin(addresses);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Add comments
COMMENT ON TABLE users IS 'Stores user accounts and their profile information';
COMMENT ON COLUMN users.username IS 'Optional username for the account';
COMMENT ON COLUMN users.phone_number IS 'Primary contact phone number';
COMMENT ON COLUMN users.email IS 'Optional email address';
COMMENT ON COLUMN users.photo_media_id IS 'Reference to profile photo in media system';
COMMENT ON COLUMN users.login_type IS 'How the user authenticates (social or phone)';
COMMENT ON COLUMN users.addresses IS 'JSON array of saved delivery addresses';
COMMENT ON COLUMN users.device_type IS 'Primary device type used by the user';
COMMENT ON COLUMN users.is_active IS 'Whether this account is currently active';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login'; 