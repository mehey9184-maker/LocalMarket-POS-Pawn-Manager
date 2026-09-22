import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from localStorage (user UI entry) first, then fallback to Vite environment variables
export const getActiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lm_supabase_url');
    if (saved && saved.trim()) return saved.trim();
  }
  return (import.meta.env.VITE_SUPABASE_URL || '').trim();
};

export const getActiveSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lm_supabase_anon_key');
    if (saved && saved.trim()) return saved.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
};

export const isSupabaseConfigured = (): boolean => {
  const url = getActiveSupabaseUrl();
  const key = getActiveSupabaseAnonKey();
  return Boolean(
    url && 
    key && 
    url.startsWith('https://') && 
    key.length > 20
  );
};

// Client instance cache
let clientInstance: SupabaseClient<any> | null = null;

export const getSupabase = (): SupabaseClient<any> | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  
  if (!clientInstance) {
    const url = getActiveSupabaseUrl();
    const key = getActiveSupabaseAnonKey();
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  
  return clientInstance;
};

export const saveSupabaseCredentials = (url: string, anonKey: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lm_supabase_url', url.trim());
    localStorage.setItem('lm_supabase_anon_key', anonKey.trim());
    clientInstance = null; // Clear cached instance so next call re-creates with new credentials
  }
};

export const clearSupabaseCredentials = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lm_supabase_url');
    localStorage.removeItem('lm_supabase_anon_key');
    clientInstance = null;
  }
};

export const getSupabaseConfig = () => {
  const url = getActiveSupabaseUrl();
  const key = getActiveSupabaseAnonKey();
  return {
    url,
    hasAnonKey: Boolean(key),
    isConfigured: isSupabaseConfigured(),
    isFromLocalStorage: typeof window !== 'undefined' && Boolean(localStorage.getItem('lm_supabase_url'))
  };
};

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  hasShopItemsTable: boolean;
  hasProfilesTable: boolean;
  hasSystemLogsTable: boolean;
  itemCount: number;
}

export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      message: 'Supabase credentials are not provided or invalid.',
      hasShopItemsTable: false,
      hasProfilesTable: false,
      hasSystemLogsTable: false,
      itemCount: 0
    };
  }

  let hasShopItemsTable = false;
  let hasProfilesTable = false;
  let hasSystemLogsTable = false;
  let itemCount = 0;

  try {
    // 1. Test shop_items table
    const { data: items, error: itemsErr } = await supabase.from('shop_items').select('id', { count: 'exact', head: false }).limit(5);
    if (!itemsErr) {
      hasShopItemsTable = true;
      itemCount = items?.length || 0;
    }

    // 2. Test profiles table
    const { error: profErr } = await supabase.from('profiles').select('id').limit(1);
    if (!profErr) {
      hasProfilesTable = true;
    }

    // 3. Test system_logs table
    const { error: logErr } = await supabase.from('system_logs').select('id').limit(1);
    if (!logErr) {
      hasSystemLogsTable = true;
    }

    if (hasShopItemsTable && hasProfilesTable && hasSystemLogsTable) {
      return {
        success: true,
        message: 'Connected to Supabase! All 3 tables (shop_items, profiles, system_logs) exist.',
        hasShopItemsTable,
        hasProfilesTable,
        hasSystemLogsTable,
        itemCount
      };
    } else if (hasShopItemsTable || hasProfilesTable || hasSystemLogsTable) {
      return {
        success: true,
        message: 'Connected to Supabase project, but some tables are missing. Please run schema.sql in SQL Editor.',
        hasShopItemsTable,
        hasProfilesTable,
        hasSystemLogsTable,
        itemCount
      };
    } else {
      return {
        success: false,
        message: 'Connected to Supabase, but no tables exist yet. Please run schema.sql in the SQL Editor.',
        hasShopItemsTable: false,
        hasProfilesTable: false,
        hasSystemLogsTable: false,
        itemCount: 0
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Unknown network error'}`,
      hasShopItemsTable: false,
      hasProfilesTable: false,
      hasSystemLogsTable: false,
      itemCount: 0
    };
  }
};

