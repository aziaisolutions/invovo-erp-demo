-- 1. Create shop_members table for RBAC
CREATE TABLE shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('shop_owner', 'shop_staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(shop_id, user_id)
);

ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- Helper Functions for RLS
CREATE OR REPLACE FUNCTION is_shop_member(target_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shop_members 
        WHERE shop_id = target_shop_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_shop_owner(target_shop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM shop_members 
        WHERE shop_id = target_shop_id AND user_id = auth.uid() AND role = 'shop_owner'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS Policies
DROP POLICY IF EXISTS "Users can manage products in their shops" ON products;
DROP POLICY IF EXISTS "Users can manage stock transactions in their shops" ON stock_transactions;
DROP POLICY IF EXISTS "Users can manage subscriptions in their shops" ON subscriptions;
DROP POLICY IF EXISTS "Users can manage their own shops" ON shops;

-- Shops
CREATE POLICY "Users can view shops they are members of" ON shops
    FOR SELECT USING (is_shop_member(id));

CREATE POLICY "Owners can update their shops" ON shops
    FOR ALL USING (is_shop_owner(id)) WITH CHECK (is_shop_owner(id));

-- Shop Members
CREATE POLICY "Users can view members of their shops" ON shop_members
    FOR SELECT USING (is_shop_member(shop_id));

CREATE POLICY "Owners can manage shop members" ON shop_members
    FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

-- Products
CREATE POLICY "Members can view products" ON products
    FOR SELECT USING (is_shop_member(shop_id));

CREATE POLICY "Members can insert products" ON products
    FOR INSERT WITH CHECK (is_shop_member(shop_id));

CREATE POLICY "Members can update products" ON products
    FOR UPDATE USING (is_shop_member(shop_id)) WITH CHECK (is_shop_member(shop_id));

CREATE POLICY "Only Owners can delete products" ON products
    FOR DELETE USING (is_shop_owner(shop_id));

-- Stock Transactions
CREATE POLICY "Members can view stock transactions" ON stock_transactions
    FOR SELECT USING (is_shop_member(shop_id));

CREATE POLICY "Members can insert stock transactions" ON stock_transactions
    FOR INSERT WITH CHECK (is_shop_member(shop_id));

CREATE POLICY "Only Owners can update stock transactions" ON stock_transactions
    FOR UPDATE USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

CREATE POLICY "Only Owners can delete stock transactions" ON stock_transactions
    FOR DELETE USING (is_shop_owner(shop_id));

-- Subscriptions
CREATE POLICY "Only owners can view or manage subscriptions" ON subscriptions
    FOR ALL USING (is_shop_owner(shop_id)) WITH CHECK (is_shop_owner(shop_id));

-- 3. Triggers for Automated Inventory Updates
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type IN ('STOCK_IN', 'RETURN') THEN
        UPDATE products 
        SET current_stock = current_stock + NEW.quantity 
        WHERE id = NEW.product_id;
    ELSIF NEW.transaction_type = 'STOCK_OUT' THEN
        UPDATE products 
        SET current_stock = current_stock - NEW.quantity 
        WHERE id = NEW.product_id;
    ELSIF NEW.transaction_type = 'ADJUSTMENT' THEN
        UPDATE products 
        SET current_stock = current_stock + NEW.quantity 
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_stock
AFTER INSERT ON stock_transactions
FOR EACH ROW
EXECUTE FUNCTION update_product_stock();

-- 4. View for dynamic profit calculation
CREATE OR REPLACE VIEW profit_reports_view AS
SELECT 
    p.id as product_id,
    p.shop_id,
    p.name,
    p.sku,
    p.purchase_price,
    p.selling_price,
    (p.selling_price - p.purchase_price) AS profit_per_unit,
    st.transaction_type,
    st.quantity,
    st.created_at as transaction_date,
    CASE 
        WHEN st.transaction_type = 'STOCK_OUT' THEN (p.selling_price - p.purchase_price) * st.quantity
        ELSE 0
    END AS total_transaction_profit
FROM stock_transactions st
JOIN products p ON p.id = st.product_id;
