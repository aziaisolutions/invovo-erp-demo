CREATE OR REPLACE FUNCTION create_new_shop(p_shop_name TEXT, p_city TEXT)
RETURNS UUID AS $$
DECLARE
    new_shop_id UUID;
    current_uid UUID;
    user_email TEXT;
BEGIN
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch user's email from Auth table safely
    SELECT email INTO user_email FROM auth.users WHERE id = current_uid;

    -- Fix: Automatically heal missing public.users profile with required email constraint
    INSERT INTO users (id, full_name, email)
    VALUES (current_uid, 'Store Owner', user_email)
    ON CONFLICT (id) DO NOTHING;

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
