-- Create store items table
CREATE TABLE store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id),
    category_id UUID NOT NULL REFERENCES store_item_categories(id),
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    
    -- Options and Extras
    options JSONB NOT NULL DEFAULT '[]',
    extras JSONB NOT NULL DEFAULT '[]',
    
    -- Ratings
    ratings JSONB DEFAULT '{"count": 0, "summary": 0}',
    
    -- Status and Timestamps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT store_items_unique_name_per_store UNIQUE (name, store_id),
    CONSTRAINT store_items_valid_price CHECK (price >= 0),
    -- Note: options and extras structure validation will be enforced at the application level
    CONSTRAINT store_items_valid_options_type CHECK (jsonb_typeof(options) = 'array'),
    CONSTRAINT store_items_valid_extras_type CHECK (jsonb_typeof(extras) = 'array'),
    CONSTRAINT store_items_valid_ratings CHECK (
        jsonb_typeof(ratings) = 'object' AND
        ratings ? 'count' AND
        ratings ? 'summary'
    ),
    -- Note: store-category relationship will be enforced at the application level
    CONSTRAINT store_items_fk_store_category FOREIGN KEY (store_id, category_id) REFERENCES store_item_categories(store_id, id)
);

-- Create store item photos table for media integration
CREATE TABLE store_item_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_item_id UUID NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media(id),
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT store_item_photos_unique_media_per_item UNIQUE (store_item_id, media_id),
    -- Note: media purpose validation will be enforced at the application level
    CONSTRAINT store_item_photos_fk_media FOREIGN KEY (media_id) REFERENCES media(id)
);

-- Create indexes
CREATE INDEX idx_store_items_store_id ON store_items(store_id);
CREATE INDEX idx_store_items_category_id ON store_items(category_id);
CREATE INDEX idx_store_items_is_active ON store_items(is_active);
CREATE INDEX idx_store_items_created_at ON store_items(created_at);
CREATE INDEX idx_store_item_photos_store_item_id ON store_item_photos(store_item_id);
CREATE INDEX idx_store_item_photos_media_id ON store_item_photos(media_id);
CREATE INDEX idx_store_item_photos_position ON store_item_photos(position);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_store_items_updated_at
    BEFORE UPDATE ON store_items
    FOR EACH ROW
    EXECUTE FUNCTION update_store_items_updated_at();

-- Add comments
COMMENT ON TABLE store_items IS 'Store items/products available for purchase';
COMMENT ON COLUMN store_items.name IS 'Item name, unique within store';
COMMENT ON COLUMN store_items.options IS 'JSON array of item options (e.g., size, color) with their choices';
COMMENT ON COLUMN store_items.extras IS 'JSON array of additional paid options (e.g., extra cheese)';
COMMENT ON COLUMN store_items.ratings IS 'JSON object with rating count and summary';

COMMENT ON TABLE store_item_photos IS 'Photos associated with store items';
COMMENT ON COLUMN store_item_photos.position IS 'Display order of photos'; 