-- Create media type enum
CREATE TYPE media_type AS ENUM ('image', 'video', 'gif');

-- Create media purpose enum (to track where this media is used)
CREATE TYPE media_purpose AS ENUM (
    'store_logo',
    'store_cover',
    'product_image',
    'store_item',
    'category_image',
    'banner',
    'profile_photo',
    'payment_logo',
    'other'
);

-- Create media table (first part without admin reference)
CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    
    -- File details
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    type media_type NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    purpose media_purpose NOT NULL DEFAULT 'other',
    url TEXT NOT NULL,
    thumbnail_url TEXT,  -- For videos and GIFs
    
    -- File metadata
    size_in_bytes BIGINT NOT NULL,
    width INTEGER,       -- For all media types
    height INTEGER,      -- For all media types
    duration INTEGER,    -- For videos (in seconds)
    
    -- Organization
    folder_path TEXT NOT NULL,  -- Logical path in storage
    alt_text VARCHAR(255),      -- For accessibility
    title VARCHAR(255),         -- For display
    description TEXT,
    
    -- Status and tracking
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_dimensions CHECK (
        (type IN ('image', 'gif') AND width IS NOT NULL AND height IS NOT NULL) OR
        (type = 'video' AND width IS NOT NULL AND height IS NOT NULL AND duration IS NOT NULL)
    ),
    CONSTRAINT valid_thumbnail CHECK (
        (type IN ('video', 'gif') AND thumbnail_url IS NOT NULL) OR
        (type = 'image')
    ),
    CONSTRAINT valid_location CHECK (
        (country_id IS NOT NULL AND city_id IS NULL) OR
        (country_id IS NOT NULL AND city_id IS NOT NULL)
    ),
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    CONSTRAINT unique_media_country_id UNIQUE (id, country_id),
    CONSTRAINT valid_mime_type CHECK (
        (type = 'image' AND mime_type IN ('image/jpeg', 'image/png')) OR
        (type = 'video' AND mime_type = 'video/mp4') OR
        (type = 'gif' AND mime_type = 'image/gif')
    ),
    CONSTRAINT valid_size CHECK (
        (type = 'image' AND size_in_bytes <= 5242880) OR    -- 5MB
        (type = 'video' AND size_in_bytes <= 104857600) OR  -- 100MB
        (type = 'gif' AND size_in_bytes <= 10485760)        -- 10MB
    )
);

-- Create indexes
CREATE INDEX idx_media_country ON media(country_id);
CREATE INDEX idx_media_city ON media(city_id);
CREATE INDEX idx_media_type ON media(type);
CREATE INDEX idx_media_purpose ON media(purpose);
CREATE INDEX idx_media_active ON media(is_active);
CREATE INDEX idx_media_created ON media(created_at);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_media_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
CREATE TRIGGER update_media_timestamp
    BEFORE UPDATE ON media
    FOR EACH ROW
    EXECUTE FUNCTION update_media_timestamp();

-- Note: The uploaded_by column and index will be added in a separate migration 