-- Create store cover type enum
CREATE TYPE store_cover_type AS ENUM ('image', 'video', 'gif');

-- Create stores table
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    logo_media_id UUID REFERENCES media(id),
    cover_media_id UUID REFERENCES media(id),
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Cover Type
    cover_type store_cover_type NOT NULL DEFAULT 'image',
    
    -- Operating Information
    operating_hours JSONB NOT NULL DEFAULT '[]',
    location JSONB NOT NULL,
    preparation_time_minutes INTEGER DEFAULT 0,
    
    -- Business Settings
    special_delivery_fee DECIMAL(10,2),
    special_discount_percentage DECIMAL(5,2),
    is_sponsored BOOLEAN DEFAULT false,
    
    -- Authentication
    auth_details JSONB NOT NULL,
    
    -- Ratings
    ratings JSONB DEFAULT '{"count": 0, "summary": 0}',
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    is_busy BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT stores_unique_name_per_location UNIQUE (name, country_id, city_id),
    CONSTRAINT stores_unique_slug_per_location UNIQUE (slug, country_id, city_id),
    CONSTRAINT stores_valid_location CHECK (
        (country_id IS NOT NULL AND city_id IS NULL) OR
        (country_id IS NOT NULL AND city_id IS NOT NULL)
    ),
    CONSTRAINT stores_unique_id_country UNIQUE (id, country_id),
    CONSTRAINT stores_fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    -- Note: category validation will be enforced at the application level
    CONSTRAINT stores_fk_category_country FOREIGN KEY (category_id, country_id) REFERENCES categories(id, country_id),
    -- Note: media validation will be enforced at the application level
    CONSTRAINT stores_fk_logo_media_country FOREIGN KEY (logo_media_id, country_id) REFERENCES media(id, country_id),
    CONSTRAINT stores_fk_cover_media_country FOREIGN KEY (cover_media_id, country_id) REFERENCES media(id, country_id),
    CONSTRAINT stores_valid_operating_hours CHECK (
        jsonb_typeof(operating_hours) = 'array'
    ),
    CONSTRAINT stores_valid_location_details CHECK (
        jsonb_typeof(location) = 'object'
        AND location ? 'latitude'
        AND location ? 'longitude'
        AND location ? 'street_name'
    ),
    CONSTRAINT stores_valid_auth_details CHECK (
        jsonb_typeof(auth_details) = 'object'
        AND auth_details ? 'username'
        AND auth_details ? 'password_hash'
    ),
    CONSTRAINT stores_valid_ratings CHECK (
        jsonb_typeof(ratings) = 'object'
        AND ratings ? 'count'
        AND ratings ? 'summary'
    ),
    CONSTRAINT stores_valid_special_discount CHECK (
        special_discount_percentage IS NULL OR
        (special_discount_percentage >= 0 AND special_discount_percentage <= 100)
    ),
    CONSTRAINT stores_valid_preparation_time CHECK (
        preparation_time_minutes >= 0
    )
);

-- Create indexes
CREATE INDEX idx_stores_country_id ON stores(country_id);
CREATE INDEX idx_stores_city_id ON stores(city_id);
CREATE INDEX idx_stores_category_id ON stores(category_id);
CREATE INDEX idx_stores_logo_media_id ON stores(logo_media_id);
CREATE INDEX idx_stores_cover_media_id ON stores(cover_media_id);
CREATE INDEX idx_stores_is_sponsored ON stores(is_sponsored);
CREATE INDEX idx_stores_is_active ON stores(is_active);
CREATE INDEX idx_stores_is_busy ON stores(is_busy);
CREATE INDEX idx_stores_created_at ON stores(created_at);
CREATE INDEX idx_stores_tags ON stores USING gin(tags);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_stores_updated_at();

-- Add comments
COMMENT ON TABLE stores IS 'Stores registered in the system';
COMMENT ON COLUMN stores.name IS 'Store name, unique within location';
COMMENT ON COLUMN stores.slug IS 'URL-friendly version of store name';
COMMENT ON COLUMN stores.logo_media_id IS 'Reference to store logo in media system';
COMMENT ON COLUMN stores.cover_media_id IS 'Reference to store cover in media system';
COMMENT ON COLUMN stores.tags IS 'Array of searchable tags';
COMMENT ON COLUMN stores.operating_hours IS 'JSON array of operating hours';
COMMENT ON COLUMN stores.location IS 'JSON object with latitude, longitude, and street name';
COMMENT ON COLUMN stores.auth_details IS 'JSON object with username and hashed password';
COMMENT ON COLUMN stores.ratings IS 'JSON object with rating count and summary';
COMMENT ON COLUMN stores.is_active IS 'Whether the store is active in the system';
COMMENT ON COLUMN stores.is_busy IS 'Whether the store is currently busy and not accepting orders'; 