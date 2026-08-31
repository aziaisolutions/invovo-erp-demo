-- STEP 1: DATABASE LEVEL SETUP (SUPABASE SQL EXECUTOR)
-- Create a table named 'public.system_super_admins' containing 'id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE', 'admin_email TEXT UNIQUE NOT NULL', and 'created_at TIMESTAMPTZ DEFAULT NOW()'.

CREATE TABLE IF NOT EXISTS public.system_super_admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on this table immediately.
ALTER TABLE public.system_super_admins ENABLE ROW LEVEL SECURITY;

-- Establish a standard policy ensuring that authenticated users can only cross-reference this table safely without open data leakage.
CREATE POLICY "Super admins are viewable by authenticated users"
ON public.system_super_admins
FOR SELECT
TO authenticated
USING (true);
