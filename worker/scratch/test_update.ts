
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

const env = process.env as any;

async function testUpdate() {
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  // 1. Select
  const { data: companies, error: selectError } = await db.from('company_registry')
    .select('slug, company_slug, source, is_active, last_checked_at')
    .eq('is_active', true)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(1);
    
  if (selectError) {
    console.error('Select error:', selectError);
    return;
  }
  
  if (!companies || companies.length === 0) {
    console.log('No companies found');
    return;
  }
  
  const company = companies[0];
  console.log('Selected company:', company);
  
  // 2. Update using the "buggy" way (as per my view of the code)
  console.log('Attempting update with .eq("slug", company.slug)...');
  const { data: updateData, error: updateError, status } = await db.from('company_registry')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('slug', company.slug)
    .select();
    
  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('Update status:', status);
    console.log('Updated data:', updateData);
  }
}

testUpdate();
