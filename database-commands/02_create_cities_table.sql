-- Create cities table (second level of hierarchy)
CREATE TABLE IF NOT EXISTS cities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id UUID NOT NULL REFERENCES countries(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    
    -- Location info
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- Delivery settings
    has_delivery BOOLEAN DEFAULT true,
    delivery_fee DECIMAL(10,2),  -- NULL means use country's default_delivery_fee
    min_order_amount DECIMAL(10,2),  -- NULL means use country's min_order_amount
    
    -- Operating hours (JSON array of time ranges per day)
    operating_hours JSONB DEFAULT '[]'::JSONB NOT NULL,
    
    -- Status and timestamps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_city_per_country UNIQUE (country_id, name),
    CONSTRAINT unique_city_country_id UNIQUE (id, country_id),
    CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT valid_operating_hours CHECK (
        jsonb_typeof(operating_hours) = 'array' 
        AND jsonb_array_length(operating_hours) <= 7
    )
);

-- Create indexes
CREATE INDEX idx_cities_country_id ON cities (country_id);
CREATE INDEX idx_cities_is_active ON cities (is_active);
CREATE INDEX idx_cities_name ON cities (name);
CREATE INDEX idx_cities_location ON cities (latitude, longitude);

-- Create trigger for updated_at
CREATE TRIGGER update_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE cities IS 'Stores city information with delivery settings';
COMMENT ON COLUMN cities.country_id IS 'Reference to the country this city belongs to';
COMMENT ON COLUMN cities.latitude IS 'City center latitude for distance calculations';
COMMENT ON COLUMN cities.longitude IS 'City center longitude for distance calculations';
COMMENT ON COLUMN cities.delivery_fee IS 'City-specific delivery fee. NULL means use country default';
COMMENT ON COLUMN cities.min_order_amount IS 'City-specific minimum order amount. NULL means use country default';
COMMENT ON COLUMN cities.operating_hours IS 'JSON array of operating hours per day of week';
COMMENT ON COLUMN cities.is_active IS 'Whether this city is currently active for operations'; 