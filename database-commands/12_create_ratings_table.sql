-- Create enums for rating
CREATE TYPE rating_target_type AS ENUM ('store', 'item');
CREATE TYPE rating_status AS ENUM ('pending', 'approved', 'rejected', 'reported');

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id UUID NOT NULL,
    city_id UUID,
    user_id UUID NOT NULL,
    target_type rating_target_type NOT NULL,
    target_id UUID NOT NULL,
    star_count INTEGER NOT NULL,
    description TEXT,
    status rating_status NOT NULL DEFAULT 'pending',
    report_reason TEXT,
    moderated_by UUID,
    moderated_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_star_count CHECK (star_count >= 1 AND star_count <= 5),
    CONSTRAINT fk_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_moderator FOREIGN KEY (moderated_by) REFERENCES admins(id) ON DELETE SET NULL,
    -- Ensure report_reason is only set when status is 'reported'
    CONSTRAINT valid_report_reason CHECK (
        (status != 'reported' AND report_reason IS NULL) OR
        (status = 'reported' AND report_reason IS NOT NULL)
    ),
    -- Ensure moderated_by and moderated_at are set together
    CONSTRAINT valid_moderation CHECK (
        (moderated_by IS NULL AND moderated_at IS NULL) OR
        (moderated_by IS NOT NULL AND moderated_at IS NOT NULL)
    ),
    -- Prevent duplicate ratings from same user for same target
    CONSTRAINT unique_user_target_rating UNIQUE (user_id, target_type, target_id)
);

-- Create indexes
CREATE INDEX idx_ratings_country_id ON ratings(country_id);
CREATE INDEX idx_ratings_city_id ON ratings(city_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_ratings_target ON ratings(target_type, target_id);
CREATE INDEX idx_ratings_status ON ratings(status);
CREATE INDEX idx_ratings_moderated_by ON ratings(moderated_by);
CREATE INDEX idx_ratings_is_active ON ratings(is_active);
CREATE INDEX idx_ratings_created_at ON ratings(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_ratings_updated_at
    BEFORE UPDATE ON ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_ratings_updated_at();

-- Add comments
COMMENT ON TABLE ratings IS 'Stores user ratings for stores and items with moderation support';
COMMENT ON COLUMN ratings.country_id IS 'Reference to the country for location scoping';
COMMENT ON COLUMN ratings.city_id IS 'Optional reference to city for city-specific analytics';
COMMENT ON COLUMN ratings.user_id IS 'Reference to the user who created the rating';
COMMENT ON COLUMN ratings.target_type IS 'Type of rating target (store or item)';
COMMENT ON COLUMN ratings.target_id IS 'ID of the store or item being rated';
COMMENT ON COLUMN ratings.star_count IS 'Rating value from 1 to 5 stars';
COMMENT ON COLUMN ratings.description IS 'Optional review text';
COMMENT ON COLUMN ratings.status IS 'Moderation status of the rating';
COMMENT ON COLUMN ratings.report_reason IS 'Reason if rating is reported';
COMMENT ON COLUMN ratings.moderated_by IS 'Admin who moderated this rating';
COMMENT ON COLUMN ratings.moderated_at IS 'When the rating was moderated';
COMMENT ON COLUMN ratings.is_active IS 'Whether this rating is currently active'; 