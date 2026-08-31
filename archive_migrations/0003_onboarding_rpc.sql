-- RPC Function to create a new shop and set the creator as the owner.
-- SECURITY DEFINER allows the function to bypass RLS policies temporarily
-- since the user cannot insert a shop before being an owner of it.

CREATE OR REPLACE FUNCTION create_new_shop(p_shop_name TEXT, p_city TEXT)
RETURNS UUID AS $$
DECLARE
    new_shop_id UUID;
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Insert the new shop
    INSERT INTO shops (user_id, shop_name, city)
    VALUES (current_uid, p_shop_name, p_city)
    RETURNING id INTO new_shop_id;

    -- 2. Insert the user as the shop_owner
    INSERT INTO shop_members (shop_id, user_id, role)
    VALUES (new_shop_id, current_uid, 'shop_owner');

    RETURN new_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
