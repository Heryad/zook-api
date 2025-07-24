-- Function to update banner positions
CREATE OR REPLACE FUNCTION update_banner_position(
    p_banner_id UUID,
    p_new_position INTEGER,
    p_country_id UUID,
    p_city_id UUID
) RETURNS void AS $$
DECLARE
    v_old_position INTEGER;
    v_max_position INTEGER;
BEGIN
    -- Get the current position
    SELECT position INTO v_old_position
    FROM banners
    WHERE id = p_banner_id;

    -- Get the maximum position
    SELECT COALESCE(MAX(position), 0) INTO v_max_position
    FROM banners
    WHERE country_id = p_country_id
    AND COALESCE(city_id, UUID_NIL()) = COALESCE(p_city_id, UUID_NIL());

    -- Validate new position
    IF p_new_position < 0 THEN
        p_new_position := 0;
    ELSIF p_new_position > v_max_position THEN
        p_new_position := v_max_position;
    END IF;

    -- Update positions
    IF v_old_position > p_new_position THEN
        -- Moving up: increment positions of items in between
        UPDATE banners
        SET position = position + 1
        WHERE country_id = p_country_id
        AND COALESCE(city_id, UUID_NIL()) = COALESCE(p_city_id, UUID_NIL())
        AND position >= p_new_position
        AND position < v_old_position;
    ELSIF v_old_position < p_new_position THEN
        -- Moving down: decrement positions of items in between
        UPDATE banners
        SET position = position - 1
        WHERE country_id = p_country_id
        AND COALESCE(city_id, UUID_NIL()) = COALESCE(p_city_id, UUID_NIL())
        AND position > v_old_position
        AND position <= p_new_position;
    ELSE
        -- Same position, no change needed
        RETURN;
    END IF;

    -- Update the banner's position
    UPDATE banners
    SET position = p_new_position
    WHERE id = p_banner_id;
END;
$$ LANGUAGE plpgsql; 