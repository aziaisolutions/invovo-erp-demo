-- ==============================================================================
-- INVOVO ERP - MASTER DATABASE SCHEMA & SECURITY DEFINITIONS
-- Compatible with PostgreSQL / Supabase
-- Multi-Tenant Architecture with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. SYSTEM SUPER ADMINS (Platform Level Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. PUBLIC PROFILES MAPPING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. SHOPS / TENANTS (Multi-Tenancy Root)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_type TEXT DEFAULT 'Retail / General',
    currency TEXT DEFAULT 'USD',
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    invoice_header TEXT,
    invoice_footer TEXT DEFAULT 'Thank you for your business!',
    subscription_status TEXT DEFAULT 'active', -- active, past_due, trial
    is_maintenance_mode BOOLEAN DEFAULT false,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. SHOP MEMBERS & ROLES (RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('shop_owner', 'shop_manager', 'shop_staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 5. PRODUCTS & INVENTORY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT DEFAULT 'General',
    cost_price NUMERIC(12, 2) DEFAULT 0.00,
    selling_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    current_stock NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    low_stock_threshold NUMERIC(12, 2) DEFAULT 5.00,
    unit TEXT DEFAULT 'pcs',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. STOCK TRANSACTIONS / AUDIT LOG
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity_change NUMERIC(12, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'return')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. CUSTOMERS & SUPPLIERS (Khata / CRM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    payment_due NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    balance_due NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. INVOICES & SALES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00,
    tax NUMERIC(12, 2) DEFAULT 0.00,
    net_total NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    cash_paid_received NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    payment_due NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    items JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. FINANCIAL TRANSACTIONS & EXPENSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'customer_payment', 'supplier_payment')),
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Utilities',
    amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_shop_member(target_shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members 
    WHERE shop_id = target_shop_id 
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_owner(target_shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members 
    WHERE shop_id = target_shop_id 
      AND user_id = auth.uid()
      AND role = 'shop_owner'
  );
$$;

-- ------------------------------------------------------------------------------
-- 11. ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 12. RLS POLICIES (TENANT ISOLATION)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can manage their shop memberships" ON public.shop_members
  FOR ALL USING (user_id = auth.uid() OR public.is_shop_owner(shop_id));

CREATE POLICY "Members can view their shops" ON public.shops
  FOR SELECT USING (public.is_shop_member(id) OR owner_id = auth.uid());

CREATE POLICY "Owners can update their shops" ON public.shops
  FOR UPDATE USING (public.is_shop_owner(id) OR owner_id = auth.uid());

CREATE POLICY "Shop Isolation - Products" ON public.products
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Stock Transactions" ON public.stock_transactions
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Customers" ON public.customers
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Suppliers" ON public.suppliers
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Invoices" ON public.invoices
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Transactions" ON public.transactions
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Shop Isolation - Expenses" ON public.expenses
  FOR ALL USING (public.is_shop_member(shop_id));