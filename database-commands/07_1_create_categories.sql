-- Create categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    
    -- Basic info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Media
    media_id UUID REFERENCES media(id),
    
    -- Ordering
    position INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT categories_unique_name_per_location UNIQUE (name, country_id, city_id),
    CONSTRAINT categories_valid_location CHECK (
        (country_id IS NOT NULL AND city_id IS NULL) OR
        (country_id IS NOT NULL AND city_id IS NOT NULL)
    ),
    CONSTRAINT categories_unique_id_country UNIQUE (id, country_id),
    CONSTRAINT categories_fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    -- Note: media validation will be enforced at the application level
    CONSTRAINT categories_fk_media_country FOREIGN KEY (media_id, country_id) REFERENCES media(id, country_id)
);

-- Create indexes
CREATE INDEX idx_categories_country ON categories(country_id);
CREATE INDEX idx_categories_city ON categories(city_id);
CREATE INDEX idx_categories_active ON categories(is_active);
CREATE INDEX idx_categories_position ON categories(position);
CREATE INDEX idx_categories_media ON categories(media_id);
CREATE INDEX idx_categories_created ON categories(created_at);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_category_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
CREATE TRIGGER update_category_timestamp
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_category_timestamp(); 