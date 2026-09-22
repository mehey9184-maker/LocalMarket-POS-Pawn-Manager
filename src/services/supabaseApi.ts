import { getSupabase, isSupabaseConfigured } from './supabase';
import { Database, ProfileRow, ShopProfileRow, ShopItemRow, SystemLogRow, UserRole } from '../types/supabase';
import { InventoryItem } from '../types';

/**
 * Supabase Free Tier API Service
 * Handles Authentication, Profiles, Shop Items (Inventory), and Audit/SAPS Logs.
 * Includes graceful fallbacks when Supabase credentials are not yet configured.
 */

// ==========================================
// 1. AUTHENTICATION & USER SESSIONS
// ==========================================
export const authApi = {
  isConfigured: () => isSupabaseConfigured(),

  async signUp(email: string, password: string, fullName: string, role: UserRole = 'cashier') {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.');

    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          fullName: fullName,
          display_name: fullName,
          role,
        },
      },
    });
  },

  async signIn(email: string, password: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const response = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const { data } = response;

    // Log sign-in event
    if (data?.user) {
      logsApi.createLog(
        'AUTH_SIGN_IN',
        data.user.user_metadata?.full_name || email,
        { email: data.user.email, role: data.user.user_metadata?.role || 'cashier' },
        'info'
      ).catch(() => {});
    }

    return response;
  },

  async signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  async verifyEmailOtp(email: string, token: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    return await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
  },

  onAuthStateChange(callback: (session: any) => void) {
    const supabase = getSupabase();
    if (!supabase) return { unsubscribe: () => {} };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return {
      unsubscribe: () => data.subscription.unsubscribe(),
    };
  },
};

// ==========================================
// 1.5. SHOP PROFILES (Branch & Legal Compliance)
// ==========================================
export const shopProfilesApi = {
  async getShopProfiles(): Promise<ShopProfileRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('shop_profiles')
        .select('id, shop_code, shop_name, trading_name, registration_number, vat_number, saps_dealer_license, phone, email, address, city, province, postal_code, currency, receipt_header, receipt_footer, is_active, metadata, created_at, updated_at')
        .order('shop_name', { ascending: true });

      if (error) {
        console.warn('shop_profiles fetch note (running offline):', error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  async getShopByCode(code: string): Promise<ShopProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('shop_profiles')
        .select('*')
        .eq('shop_code', code)
        .single();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  async updateShopProfile(id: string, updates: Partial<Database['public']['Tables']['shop_profiles']['Update']>): Promise<ShopProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('shop_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// ==========================================
// 2. PROFILES (Staff & Cashier Management)
// ==========================================
export const profilesApi = {
  async getProfiles(): Promise<ProfileRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getProfileById(id: string): Promise<ProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async getCurrentProfile(): Promise<ProfileRow | null> {
    const user = await authApi.getUser();
    if (!user) return null;
    return profilesApi.getProfileById(user.id);
  },

  async updateProfile(id: string, updates: Partial<Database['public']['Tables']['profiles']['Update']>): Promise<ProfileRow> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rotatePin(id: string, newPin: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('profiles')
      .update({ pin_code: newPin })
      .eq('id', id);

    if (error) throw error;

    await logsApi.createLog('PIN_ROTATED', 'Cashier Profile', { targetUserId: id }, 'warning');
  },

  async updateDigitalSignature(id: string, signature: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('profiles')
      .update({ digital_signature: signature })
      .eq('id', id);

    if (error) throw error;

    await logsApi.createLog('SIGNATURE_UPDATED', 'Cashier Profile', { targetUserId: id }, 'audit');
  }
};

// ==========================================
// 3. SHOP ITEMS (Inventory Management)
// ==========================================
export const shopItemsApi = {
  async getItems(options?: {
    category?: string;
    status?: string;
    search?: string;
    limit?: number;
    sinceTimestamp?: string; // Delta sync to save egress
  }): Promise<ShopItemRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    // Explicit projection: prevents downloading unneeded column overhead
    let query = supabase.from('shop_items').select(
      'id, sku, title, category, serial_or_imei, condition, acquisition_type, cost_basis, retail_price, vault_location, status, days_in_vault, image_url, specs, pawn_ticket_id, created_by, added_at, updated_at'
    );

    // Delta Sync: If we have cached inventory locally, only download modified rows!
    if (options?.sinceTimestamp) {
      query = query.gt('updated_at', options.sinceTimestamp);
    }

    if (options?.category && options.category !== 'All') {
      query = query.eq('category', options.category);
    }
    if (options?.status && options.status !== 'All') {
      query = query.eq('status', options.status as any);
    }
    if (options?.search) {
      query = query.or(`title.ilike.%${options.search}%,sku.ilike.%${options.search}%,serial_or_imei.ilike.%${options.search}%`);
    }

    query = query.order('added_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getItemBySku(sku: string): Promise<ShopItemRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('shop_items')
      .select('*')
      .eq('sku', sku)
      .single();

    if (error) return null;
    return data;
  },

  async createItem(item: Database['public']['Tables']['shop_items']['Insert']): Promise<ShopItemRow> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('shop_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;

    // Write audit log
    await logsApi.createLog(
      'SHOP_ITEM_ADDED',
      'Inventory System',
      { sku: item.sku, title: item.title, retailPrice: item.retail_price },
      'info'
    ).catch(() => {});

    return data;
  },

  async updateItem(id: string, updates: Database['public']['Tables']['shop_items']['Update']): Promise<ShopItemRow> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('shop_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteItem(id: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('shop_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Helper converter between local InventoryItem and Supabase ShopItemRow
  mapRowToInventoryItem(row: ShopItemRow): InventoryItem {
    return {
      id: row.id,
      sku: row.sku,
      title: row.title,
      category: row.category as any,
      serialOrImei: row.serial_or_imei || '',
      condition: row.condition,
      acquisitionType: row.acquisition_type as any,
      costBasis: Number(row.cost_basis),
      retailPrice: Number(row.retail_price),
      vaultLocation: row.vault_location || undefined,
      status: row.status,
      daysInVault: row.days_in_vault,
      imageUrl: row.image_url || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&q=80',
      specs: row.specs || undefined,
      pawnTicketId: row.pawn_ticket_id || undefined,
      addedAt: row.added_at,
    };
  },

  // Realtime live subscription for Shop Items
  subscribeToItems(onPayload: (payload: any) => void) {
    const supabase = getSupabase();
    if (!supabase) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('public:shop_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_items' },
        (payload) => onPayload(payload)
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};

// ==========================================
// 4. SYSTEM LOGS & AUDIT LOGS
// ==========================================
export const logsApi = {
  async getLogs(limit = 50, eventType?: string): Promise<SystemLogRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createLog(
    eventType: string,
    actorName: string,
    details: Record<string, any> = {},
    severity: 'info' | 'warning' | 'audit' | 'critical' = 'info',
    sapsReference?: string
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const user = await authApi.getUser();

      // Zero-egress write: Do NOT append .select().single() which wastes egress downloading the written row
      const { error } = await supabase
        .from('system_logs')
        .insert({
          event_type: eventType,
          severity,
          actor_id: user?.id || null,
          actor_name: actorName,
          details,
          saps_reference: sapsReference || null,
        });

      if (error) {
        console.warn('Could not insert system log into Supabase:', error.message);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  // Realtime subscription for System Logs
  subscribeToLogs(onNewLog: (log: SystemLogRow) => void) {
    const supabase = getSupabase();
    if (!supabase) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('public:system_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_logs' },
        (payload) => onNewLog(payload.new as SystemLogRow)
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};
