
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = 'https://ssuknybhzcuusjardsve.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdWtueWJoemN1dXNqYXJkc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDY1MTIsImV4cCI6MjA4NDcyMjUxMn0.9XaUxtMi3btKZIA_sXQCNJI20-iwruxXISr2J1Kmr-g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
