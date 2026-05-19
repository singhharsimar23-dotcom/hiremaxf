-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260518_create_cover_letters_history.sql
-- Goal: Support saving and managing optimized cover letters inside the user history.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cover_letters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    content_text TEXT NOT NULL,
    specificity_score INTEGER DEFAULT 75,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can only see their own cover letters
DROP POLICY IF EXISTS "Users can view their own cover letters" ON public.cover_letters;
CREATE POLICY "Users can view their own cover letters"
  ON public.cover_letters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy: Users can only insert their own cover letters
DROP POLICY IF EXISTS "Users can insert their own cover letters" ON public.cover_letters;
CREATE POLICY "Users can insert their own cover letters"
  ON public.cover_letters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Users can only delete their own cover letters
DROP POLICY IF EXISTS "Users can delete their own cover letters" ON public.cover_letters;
CREATE POLICY "Users can delete their own cover letters"
  ON public.cover_letters
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
