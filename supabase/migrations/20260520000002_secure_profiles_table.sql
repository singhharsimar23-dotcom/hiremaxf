DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only access their own profile_optimized" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Revoke update privilege on plan and credits columns
REVOKE UPDATE (plan, credits) ON public.profiles FROM authenticated, anon, public;
GRANT UPDATE (plan, credits) ON public.profiles TO service_role;
