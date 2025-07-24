-- Create store item categories table
CREATE TABLE IF NOT EXISTS store_item_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT store_item_categories_fk_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    CONSTRAINT store_item_categories_unique_name UNIQUE (store_id, name),
    CONSTRAINT store_item_categories_unique_slug UNIQUE (store_id, slug),
    CONSTRAINT store_item_categories_unique_store_id UNIQUE (store_id, id),
    CONSTRAINT store_item_categories_valid_position CHECK (position >= 0)
);

-- Create indexes
CREATE INDEX idx_store_item_categories_store_id ON store_item_categories(store_id);
CREATE INDEX idx_store_item_categories_position ON store_item_categories(position);
CREATE INDEX idx_store_item_categories_is_active ON store_item_categories(is_active);
CREATE INDEX idx_store_item_categories_created_at ON store_item_categories(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_item_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_store_item_categories_updated_at
    BEFORE UPDATE ON store_item_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_store_item_categories_updated_at();

-- Create function to manage category positions
CREATE OR REPLACE FUNCTION manage_store_item_category_position()
RETURNS TRIGGER AS $$
BEGIN
    -- For new categories, if position is 0 or null, set to last position
    IF TG_OP = 'INSERT' AND (NEW.position = 0 OR NEW.position IS NULL) THEN
        SELECT COALESCE(MAX(position), 0) + 1
        INTO NEW.position
        FROM store_item_categories
        WHERE store_id = NEW.store_id;
    END IF;

    -- When updating position
    IF TG_OP = 'UPDATE' AND NEW.position != OLD.position THEN
        -- If moving up
        IF NEW.position < OLD.position THEN
            UPDATE store_item_categories
            SET position = position + 1
            WHERE store_id = NEW.store_id
            AND position >= NEW.position
            AND position < OLD.position
            AND id != NEW.id;
        -- If moving down
        ELSIF NEW.position > OLD.position THEN
            UPDATE store_item_categories
            SET position = position - 1
            WHERE store_id = NEW.store_id
            AND position <= NEW.position
            AND position > OLD.position
            AND id != NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for position management
CREATE TRIGGER manage_store_item_category_position_on_insert
    BEFORE INSERT ON store_item_categories
    FOR EACH ROW
    EXECUTE FUNCTION manage_store_item_category_position();

CREATE TRIGGER manage_store_item_category_position_on_update
    BEFORE UPDATE ON store_item_categories
    FOR EACH ROW
    WHEN (NEW.position IS DISTINCT FROM OLD.position)
    EXECUTE FUNCTION manage_store_item_category_position();

-- Add comments
COMMENT ON TABLE store_item_categories IS 'Store-specific categories for organizing menu items';
COMMENT ON COLUMN store_item_categories.name IS 'Category name, unique within store';
COMMENT ON COLUMN store_item_categories.slug IS 'URL-friendly version of category name';
COMMENT ON COLUMN store_item_categories.position IS 'Order position of category in store menu';
COMMENT ON COLUMN store_item_categories.is_active IS 'Whether this category is currently active'; 