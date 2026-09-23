import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://zhwiinqlknzxyxzvhvni.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function check() {
  const tables = [
    'profiles', 'shop_profiles', 'shop_items', 'system_logs', 
    'customers', 'sellers', 'pawn_loans', 'sales', 'refund_requests', 
    'staff_audit_logs', 'terminal_sessions', 'seller_transaction_items', 
    'seller_reversals', 'business_rule_audit_logs'
  ];

  console.log('=== CHECKING LIVE TABLES ===');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table [${t}]: NOT ACCESSIBLE or DOES NOT EXIST -> ${error.message}`);
    } else {
      console.log(`Table [${t}]: EXISTS (count: ${count})`);
    }
  }

  console.log('=== CHECKING PROFILES COLUMNS ===');
  const { data: prof, error: profErr } = await supabase.from('profiles').select('*').limit(1);
  if (profErr) {
    console.log('Profiles select error:', profErr.message);
  } else if (prof && prof.length > 0) {
    console.log('Profile columns present:', Object.keys(prof[0]));
  } else {
    console.log('Profiles table is empty.');
  }
}

check();
