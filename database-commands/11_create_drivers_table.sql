-- Create vehicle type enum
CREATE TYPE driver_vehicle_type AS ENUM ('bicycle', 'motorcycle', 'car', 'van');

-- Create drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    
    -- Basic Information
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    photo_media_id UUID REFERENCES media(id),
    
    -- Vehicle Information
    vehicle_type driver_vehicle_type NOT NULL,
    vehicle_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Delivery Status
    is_online BOOLEAN DEFAULT false,
    is_busy BOOLEAN DEFAULT false,
    last_location JSONB,
    last_location_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    ratings JSONB DEFAULT '{"count": 0, "summary": 0}'::jsonb,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_distance DECIMAL(10,2) DEFAULT 0, -- in kilometers
    
    -- System Fields
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT drivers_unique_id_country UNIQUE (id, country_id),
    CONSTRAINT drivers_unique_phone UNIQUE (phone_number, country_id),
    CONSTRAINT drivers_unique_email UNIQUE (email, country_id),
    CONSTRAINT drivers_fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    CONSTRAINT drivers_fk_photo_media_country FOREIGN KEY (photo_media_id, country_id) REFERENCES media(id, country_id),
    -- Basic type validation for JSONB fields
    CONSTRAINT drivers_valid_vehicle_info CHECK (
        vehicle_info IS NOT NULL AND 
        jsonb_typeof(vehicle_info) = 'object'
    ),
    CONSTRAINT drivers_valid_last_location CHECK (
        last_location IS NULL OR 
        jsonb_typeof(last_location) = 'object'
    ),
    CONSTRAINT drivers_valid_ratings CHECK (
        ratings IS NOT NULL AND 
        jsonb_typeof(ratings) = 'object'
    )
);

-- Create function to validate vehicle info
CREATE OR REPLACE FUNCTION validate_driver_vehicle_info()
RETURNS TRIGGER AS $$
DECLARE
    required_fields JSONB;
BEGIN
    -- Define required fields based on vehicle type
    required_fields := CASE NEW.vehicle_type
        WHEN 'bicycle' THEN '["color"]'
        WHEN 'motorcycle' THEN '["make", "model", "color", "plate_number"]'
        WHEN 'car' THEN '["make", "model", "color", "plate_number"]'
        WHEN 'van' THEN '["make", "model", "color", "plate_number"]'
    END::jsonb;

    -- Check if all required fields exist
    IF NOT (
        SELECT bool_and(NEW.vehicle_info ? field_name)
        FROM jsonb_array_elements_text(required_fields) AS field_name
    ) THEN
        RAISE EXCEPTION 'Missing required fields for vehicle type %', NEW.vehicle_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for vehicle info validation
CREATE TRIGGER validate_driver_vehicle_info
    BEFORE INSERT OR UPDATE OF vehicle_type, vehicle_info ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION validate_driver_vehicle_info();

-- Create indexes
CREATE INDEX idx_drivers_country_id ON drivers(country_id);
CREATE INDEX idx_drivers_city_id ON drivers(city_id);
CREATE INDEX idx_drivers_phone_number ON drivers(phone_number);
CREATE INDEX idx_drivers_email ON drivers(email);
CREATE INDEX idx_drivers_vehicle_type ON drivers(vehicle_type);
CREATE INDEX idx_drivers_is_online ON drivers(is_online);
CREATE INDEX idx_drivers_is_busy ON drivers(is_busy);
CREATE INDEX idx_drivers_is_active ON drivers(is_active);
-- Indexes for JSONB columns
CREATE INDEX idx_drivers_vehicle_info ON drivers USING gin(vehicle_info jsonb_path_ops);
CREATE INDEX idx_drivers_last_location ON drivers USING gin(last_location jsonb_path_ops);
CREATE INDEX idx_drivers_ratings ON drivers USING gin(ratings jsonb_path_ops);
-- Composite index for availability
CREATE INDEX idx_drivers_availability ON drivers(is_online, is_busy, is_active);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_drivers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_drivers_updated_at();

-- Add comments
COMMENT ON TABLE drivers IS 'Stores delivery driver information and status';
COMMENT ON COLUMN drivers.vehicle_type IS 'Type of vehicle used for delivery';
COMMENT ON COLUMN drivers.vehicle_info IS 'JSON object with vehicle details based on type';
COMMENT ON COLUMN drivers.is_online IS 'Whether driver is currently available for orders';
COMMENT ON COLUMN drivers.is_busy IS 'Whether driver is currently handling orders';
COMMENT ON COLUMN drivers.last_location IS 'JSON object with latest lat/long coordinates';
COMMENT ON COLUMN drivers.ratings IS 'JSON object with rating count and summary';
COMMENT ON COLUMN drivers.total_distance IS 'Total distance covered in kilometers'; 