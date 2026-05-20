CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_id TEXT,
    subscription_id TEXT,
    amount NUMERIC,
    currency TEXT,
    status TEXT,
    event_type TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Add policy: authenticated users can only view their own payment logs
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
