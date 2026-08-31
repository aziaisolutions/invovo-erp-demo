DROP POLICY IF EXISTS "Allow public insert access" ON public.expenses;
CREATE POLICY "Allow public insert access" ON public.expenses 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.expenses;
CREATE POLICY "Allow authenticated insert access" ON public.expenses 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
