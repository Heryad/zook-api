-- Add uploaded_by to media table
ALTER TABLE media
ADD COLUMN uploaded_by UUID REFERENCES admins(id);

-- Add index for uploaded_by
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);

-- Add photo_media_id to admins table
ALTER TABLE admins
ADD COLUMN photo_media_id UUID REFERENCES media(id),
ADD CONSTRAINT fk_photo_media_country FOREIGN KEY (photo_media_id, country_id) REFERENCES media(id, country_id);

-- Add index for photo_media_id
CREATE INDEX idx_admins_photo_media_id ON admins(photo_media_id);

-- Add comment for photo_media_id
COMMENT ON COLUMN admins.photo_media_id IS 'Reference to admin profile photo in media system'; 