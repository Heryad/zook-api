-- Create banners table
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    store_id UUID REFERENCES stores(id),  -- Optional store reference
    
    -- Basic info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Media
    media_id UUID NOT NULL REFERENCES media(id),
    
    -- Banner properties
    is_promotion BOOLEAN DEFAULT false,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    
    -- Ordering
    position INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_location CHECK (
        (country_id IS NOT NULL AND city_id IS NULL) OR
        (country_id IS NOT NULL AND city_id IS NOT NULL)
    ),
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    -- Note: store and media validation rules will be enforced at the application level
    CONSTRAINT fk_store_country FOREIGN KEY (store_id, country_id) REFERENCES stores(id, country_id),
    CONSTRAINT fk_media_country FOREIGN KEY (media_id, country_id) REFERENCES media(id, country_id)
);

-- Create indexes
CREATE INDEX idx_banners_country_id ON banners(country_id);
CREATE INDEX idx_banners_city_id ON banners(city_id);
CREATE INDEX idx_banners_store_id ON banners(store_id);
CREATE INDEX idx_banners_media_id ON banners(media_id);
CREATE INDEX idx_banners_is_active ON banners(is_active);
CREATE INDEX idx_banners_position ON banners(position);
CREATE INDEX idx_banners_created_at ON banners(created_at);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_banner_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
CREATE TRIGGER update_banner_timestamp
    BEFORE UPDATE ON banners
    FOR EACH ROW
    EXECUTE FUNCTION update_banner_timestamp(); 