-- ==============================================================================
-- INVOVO ERP - DEMO SEED DATA
-- IMPORTANT: Before running this script, go to the Sign Up page of the app
-- and create a test account with the following credentials:
-- Email: demo@invovoerp.com
-- Password: demo12345
-- Shop Name: Demo Store
-- After signing up, run this script in your Supabase SQL Editor.
-- ==============================================================================

DO $$
DECLARE
    current_user_id UUID;
    demo_shop_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    demo_customer_id UUID := 'b0000000-0000-0000-0000-000000000001'::uuid;
    demo_supplier_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
    p1_id UUID := 'd0000000-0000-0000-0000-000000000001'::uuid;
    p2_id UUID := 'd0000000-0000-0000-0000-000000000002'::uuid;
BEGIN
    -- Get the first available auth user (or demo user)
    SELECT id INTO current_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    IF current_user_id IS NOT NULL THEN
        -- 1. Create Demo Shop
        INSERT INTO public.shops (id, name, business_type, currency, phone, address, owner_id)
        VALUES (
            demo_shop_id,
            'Invovo Demo Store',
            'Electronics & Retail',
            'USD',
            '+1 234 567 8900',
            '100 Innovation Way, Suite 400, Tech Park',
            current_user_id
        ) ON CONFLICT (id) DO NOTHING;

        -- 2. Link User as Shop Owner
        INSERT INTO public.shop_members (shop_id, user_id, role)
        VALUES (demo_shop_id, current_user_id, 'shop_owner')
        ON CONFLICT (shop_id, user_id) DO NOTHING;

        -- 3. Seed Sample Products
        INSERT INTO public.products (id, shop_id, name, sku, category, cost_price, selling_price, current_stock, low_stock_threshold, unit)
        VALUES 
        (p1_id, demo_shop_id, 'Wireless Ergonomic Mouse', 'MOU-001', 'Peripherals', 18.50, 35.00, 45, 5, 'pcs'),
        (p2_id, demo_shop_id, 'Mechanical Gaming Keyboard', 'KEY-002', 'Peripherals', 42.00, 79.99, 20, 3, 'pcs'),
        (uuid_generate_v4(), demo_shop_id, 'USB-C Fast Charging Cable 2m', 'CAB-003', 'Accessories', 3.00, 12.50, 120, 10, 'pcs'),
        (uuid_generate_v4(), demo_shop_id, 'Ultra HD 4K Monitor 27"', 'MON-004', 'Displays', 180.00, 289.00, 8, 2, 'pcs')
        ON CONFLICT (id) DO NOTHING;

        -- 4. Seed Demo Customer & Supplier
        INSERT INTO public.customers (id, shop_id, name, phone, address, payment_due)
        VALUES (demo_customer_id, demo_shop_id, 'Alex Johnson', '+1 234 567 8900', '742 Evergreen Terrace', 0.00)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.suppliers (id, shop_id, name, phone, company, balance_due)
        VALUES (demo_supplier_id, demo_shop_id, 'Apex Hardware Distributors', '+1 234 567 8900', 'Apex Logistics Inc.', 0.00)
        ON CONFLICT (id) DO NOTHING;

        -- 5. Seed Initial Sample Invoice
        INSERT INTO public.invoices (
            shop_id, invoice_number, customer_id, customer_name, total_amount, discount, tax, net_total, cash_paid_received, payment_due, payment_status, items, created_by
        ) VALUES (
            demo_shop_id,
            'INV-1001',
            demo_customer_id,
            'Alex Johnson',
            114.99,
            0.00,
            0.00,
            114.99,
            114.99,
            0.00,
            'paid',
            '[{"id": "d0000000-0000-0000-0000-000000000001", "name": "Wireless Ergonomic Mouse", "qty": 1, "price": 35.00, "total": 35.00}, {"id": "d0000000-0000-0000-0000-000000000002", "name": "Mechanical Gaming Keyboard", "qty": 1, "price": 79.99, "total": 79.99}]'::jsonb,
            current_user_id
        );

    END IF;
END $$;