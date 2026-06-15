-- Enable Row Level Security on newsletter_issues
ALTER TABLE public.newsletter_issues ENABLE ROW LEVEL SECURITY;

-- Allow service_role to perform any operation (used by workers/cron jobs)
CREATE POLICY "newsletter_issues_service_all" ON public.newsletter_issues
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated admin users to read newsletter issues (for the admin panel)
CREATE POLICY "newsletter_issues_admin_read" ON public.newsletter_issues
  FOR SELECT USING (auth.role() = 'authenticated');
