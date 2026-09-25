import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Read from localStorage (user UI entry) first, then fallback to Vite/Node environment variables
export const getActiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lm_supabase_url');
    if (saved && saved.trim()) return saved.trim();
  }
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
                 (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
                 '';
  return envUrl.trim();
};

export const getActiveSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lm_supabase_anon_key');
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
                 (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
                 '';
  return envKey.trim();
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

// Mutex / in-flight promise for concurrent session refreshes
let inFlightRefreshPromise: Promise<Session | null> | null = null;

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

/**
 * Checks if an error returned by PostgREST or Supabase indicates an expired/invalid JWT or 401 auth error.
 */
export const isAuthExpiryError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || error.statusCode || error.status || '');
  const msg = String(error.message || error.error_description || error.error || '').toLowerCase();
  return (
    code === 'PGRST303' ||
    code === '401' ||
    code === 'PGRST301' ||
    msg.includes('jwt expired') ||
    msg.includes('invalid jwt') ||
    msg.includes('token expired') ||
    msg.includes('expired token') ||
    msg.includes('unauthorized') ||
    msg.includes('pgrst303')
  );
};

/**
 * Refreshes the Supabase auth session.
 * Uses an in-flight promise to prevent racing concurrent refresh requests.
 */
export const refreshSupabaseSession = async (): Promise<Session | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        // If refresh token is revoked or invalid, do not loop
        console.warn('Supabase session refresh note:', error.message);
        return null;
      }
      return data?.session ?? null;
    } catch (err: any) {
      console.warn('Supabase refreshSession exception:', err?.message);
      return null;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

/**
 * Returns the currently valid Supabase session.
 * If the session is missing, returns null.
 * If the session is expired or within 60s of expiring, safely refreshes it using a mutex.
 */
export const getValidSupabaseSession = async (): Promise<Session | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      return null;
    }

    const session = data.session;
    // Check if expires within 60 seconds (expires_at is in seconds since epoch)
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const nowMs = Date.now();
    const isExpiringSoon = expiresAtMs > 0 && expiresAtMs - nowMs < 60000;

    if (isExpiringSoon) {
      const refreshed = await refreshSupabaseSession();
      return refreshed || session;
    }

    return session;
  } catch (err) {
    console.warn('Error reading Supabase session:', err);
    return null;
  }
};

/**
 * Authenticated Request Recovery Wrapper
 * 1. Obtains a valid session.
 * 2. Executes request.
 * 3. If PGRST303 or JWT expired error occurs, refreshes session once and retries exactly once.
 * 4. Never returns silent empty arrays on auth errors.
 */
export const withAuthRecovery = async <T>(
  operation: (supabase: SupabaseClient<any>, session: Session) => Promise<T>
): Promise<T> => {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const session = await getValidSupabaseSession();
  if (!session) {
    throw new Error('Authentication required: No active session.');
  }

  try {
    return await operation(supabase, session);
  } catch (err: any) {
    if (isAuthExpiryError(err)) {
      // Refresh session once
      const refreshedSession = await refreshSupabaseSession();
      if (!refreshedSession) {
        throw new Error('Session expired. Please sign in again.');
      }
      // Retry once with refreshed session
      return await operation(supabase, refreshedSession);
    }
    throw err;
  }
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

