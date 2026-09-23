import { getSupabase, isSupabaseConfigured } from './supabase';
import { 
  Database, 
  ProfileRow, 
  ShopProfileRow, 
  ShopItemRow, 
  CustomerRow,
  SellerRow,
  SellerTransactionRow,
  PawnLoanRow,
  SaleRow,
  SapsEntryRow,
  SystemLogRow, 
  UserRole 
} from '../types/supabase';
import { 
  InventoryItem, 
  Customer, 
  Seller, 
  SellerTransaction, 
  PawnLoan, 
  SaleTransaction, 
  SapsEntry 
} from '../types';

/**
 * Supabase Production API Service
 * Handles Authentication, Shop Profiles, Profiles, Shop Items (Inventory),
 * Customers, Sellers, Seller Transactions, Pawn Loans, Sales, SAPS Compliance, and Audit Logs.
 * 
 * Features:
 * - Robust offline checks (never fake success)
 * - Zero-egress writes where response payload is not needed
 * - Delta synchronization via sinceTimestamp
 * - Idempotent upserts keyed by stable local UUIDs
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
// 2. SHOP PROFILES (Branch & Legal Compliance)
// ==========================================
export const shopProfilesApi = {
  async getShopProfiles(): Promise<ShopProfileRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('shop_profiles')
        .select('*')
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

  async getShopById(id: string): Promise<ShopProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('shop_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  async updateShopProfile(id: string, updates: Partial<Database['public']['Tables']['shop_profiles']['Update']>): Promise<ShopProfileRow | null> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

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
// 3. PROFILES (Staff & Cashier Management)
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
// 4. SHOP ITEMS (Inventory Management)
// ==========================================
export const shopItemsApi = {
  async getItems(options?: {
    shopId?: string;
    category?: string;
    status?: string;
    search?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<ShopItemRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('shop_items').select('*');

    if (options?.shopId) {
      query = query.eq('shop_id', options.shopId);
    }
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

  async createItem(item: Database['public']['Tables']['shop_items']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('shop_items')
      .insert(item);

    if (error) throw error;

    await logsApi.createLog(
      'INVENTORY_ADDED',
      'Inventory System',
      { sku: item.sku, title: item.title, retailPrice: item.retail_price },
      'info'
    ).catch(() => {});
  },

  async upsertItem(item: Database['public']['Tables']['shop_items']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('shop_items')
      .upsert(item, { onConflict: 'id' });

    if (error) throw error;
  },

  async updateItem(id: string, updates: Database['public']['Tables']['shop_items']['Update']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('shop_items')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
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

  mapInventoryItemToRow(item: InventoryItem, shopId?: string): Database['public']['Tables']['shop_items']['Insert'] {
    return {
      id: item.id,
      shop_id: shopId || null,
      sku: item.sku,
      title: item.title,
      category: item.category,
      serial_or_imei: item.serialOrImei || null,
      condition: item.condition,
      acquisition_type: item.acquisitionType,
      cost_basis: item.costBasis,
      retail_price: item.retailPrice,
      vault_location: item.vaultLocation || null,
      status: item.status,
      days_in_vault: item.daysInVault || 0,
      image_url: item.imageUrl || null,
      specs: item.specs || null,
      pawn_ticket_id: item.pawnTicketId || null,
      added_at: item.addedAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

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
// 5. CUSTOMERS (Pawn & Active Relationships)
// ==========================================
export const customersApi = {
  async getCustomers(options?: {
    shopId?: string;
    search?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<CustomerRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('customers').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.sinceTimestamp) query = query.gt('updated_at', options.sinceTimestamp);
    if (options?.search) {
      query = query.or(`full_name.ilike.%${options.search}%,id_number.ilike.%${options.search}%,mobile.ilike.%${options.search}%`);
    }

    query = query.order('full_name', { ascending: true });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getCustomerById(id: string): Promise<CustomerRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async getCustomerByIdNumber(idNumber: string): Promise<CustomerRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('customers').select('*').eq('id_number', idNumber).maybeSingle();
    if (error) return null;
    return data;
  },

  async upsertCustomer(customer: Database['public']['Tables']['customers']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('customers')
      .upsert(customer, { onConflict: 'id' });

    if (error) throw error;
  },

  async updateCustomer(id: string, updates: Database['public']['Tables']['customers']['Update']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.from('customers').update(updates).eq('id', id);
    if (error) throw error;
  },

  mapCustomerToRow(customer: Customer, shopId?: string): Database['public']['Tables']['customers']['Insert'] {
    return {
      id: customer.id,
      shop_id: shopId || null,
      full_name: customer.fullName,
      id_type: customer.idType || 'RSA Smart ID',
      id_number: customer.idNumber,
      mobile: customer.mobile,
      address: customer.address || null,
      dob: customer.dob || null,
      gender: customer.gender || null,
      verified: customer.verified ?? true,
      is_flagged: customer.isFlagged ?? false,
      last_communication_at: customer.lastCommunicationAt || null,
      created_at: customer.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToCustomer(row: CustomerRow): Customer {
    return {
      id: row.id,
      fullName: row.full_name,
      idType: row.id_type as any,
      idNumber: row.id_number,
      mobile: row.mobile,
      address: row.address || '',
      dob: row.dob || '',
      gender: row.gender || '',
      verified: row.verified,
      isFlagged: row.is_flagged,
      lastCommunicationAt: row.last_communication_at || undefined,
      createdAt: row.created_at
    };
  }
};

// ==========================================
// 6. SELLERS (Outright Second-Hand Sellers)
// ==========================================
export const sellersApi = {
  async getSellers(options?: {
    shopId?: string;
    search?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<SellerRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('sellers').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.sinceTimestamp) query = query.gt('updated_at', options.sinceTimestamp);
    if (options?.search) {
      query = query.or(`full_name.ilike.%${options.search}%,id_number.ilike.%${options.search}%,mobile.ilike.%${options.search}%`);
    }

    query = query.order('created_at', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getSellerById(id: string): Promise<SellerRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('sellers').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async getSellerByIdNumber(idNumber: string): Promise<SellerRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('sellers').select('*').eq('id_number', idNumber).maybeSingle();
    if (error) return null;
    return data;
  },

  async searchSellers(term: string): Promise<SellerRow[]> {
    const supabase = getSupabase();
    if (!supabase || !term.trim()) return [];

    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .or(`id_number.ilike.%${term}%,mobile.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(10);

    if (error) return [];
    return data || [];
  },

  async upsertSeller(seller: Database['public']['Tables']['sellers']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('sellers')
      .upsert(seller, { onConflict: 'id' });

    if (error) throw error;
  },

  async updateSeller(id: string, updates: Database['public']['Tables']['sellers']['Update']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.from('sellers').update(updates).eq('id', id);
    if (error) throw error;
  },

  mapSellerToRow(seller: Seller, shopId?: string): Database['public']['Tables']['sellers']['Insert'] {
    return {
      id: seller.id,
      shop_id: shopId || null,
      full_name: seller.fullName,
      id_type: seller.idType || 'RSA Smart ID',
      id_number: seller.idNumber,
      mobile: seller.mobile,
      address: seller.address || null,
      verified: seller.verified ?? true,
      verification_status: 'verified',
      created_at: seller.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToSeller(row: SellerRow): Seller {
    return {
      id: row.id,
      fullName: row.full_name,
      idType: row.id_type as any,
      idNumber: row.id_number,
      mobile: row.mobile,
      address: row.address || '',
      createdAt: row.created_at,
      verified: row.verified
    };
  }
};

// ==========================================
// 7. SELLER TRANSACTIONS (Outright Buys Log)
// ==========================================
export const sellerTransactionsApi = {
  async getTransactions(options?: {
    shopId?: string;
    sellerId?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<SellerTransactionRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('seller_transactions').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.sellerId) query = query.eq('seller_id', options.sellerId);
    if (options?.sinceTimestamp) query = query.gt('created_at', options.sinceTimestamp);

    query = query.order('timestamp', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getTransactionsBySellerId(sellerId: string): Promise<SellerTransactionRow[]> {
    return this.getTransactions({ sellerId });
  },

  async upsertTransaction(tx: Database['public']['Tables']['seller_transactions']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('seller_transactions')
      .upsert(tx, { onConflict: 'id' });

    if (error) throw error;
  },

  mapTransactionToRow(tx: SellerTransaction, shopId?: string): Database['public']['Tables']['seller_transactions']['Insert'] {
    return {
      id: tx.id,
      shop_id: shopId || null,
      seller_id: tx.sellerId,
      item_id: tx.itemId || null,
      item_sku: tx.itemSku || null,
      item_title: tx.itemTitle || null,
      transaction_type: 'Buy',
      amount_paid: tx.amountPaid,
      sku: tx.itemSku || null,
      saps_reference: tx.sapsRef || null,
      status: 'Completed',
      timestamp: tx.timestamp || new Date().toISOString(),
      created_at: tx.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToTransaction(row: SellerTransactionRow): SellerTransaction {
    return {
      id: row.id,
      sellerId: row.seller_id,
      itemId: row.item_id || '',
      itemSku: row.item_sku || row.sku || '',
      itemTitle: row.item_title || '',
      amountPaid: Number(row.amount_paid),
      timestamp: row.timestamp,
      sapsRef: row.saps_reference || ''
    };
  }
};

// ==========================================
// 8. PAWN LOANS (NCR Act 34 Secured Contracts)
// ==========================================
export const pawnLoansApi = {
  async getLoans(options?: {
    shopId?: string;
    customerId?: string;
    status?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<PawnLoanRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('pawn_loans').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.customerId) query = query.eq('customer_id', options.customerId);
    if (options?.status && options.status !== 'All') query = query.eq('status', options.status as any);
    if (options?.sinceTimestamp) query = query.gt('updated_at', options.sinceTimestamp);

    query = query.order('expiry_date', { ascending: true });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getLoanByTicket(ticketNumber: string): Promise<PawnLoanRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('pawn_loans').select('*').eq('ticket_number', ticketNumber).maybeSingle();
    if (error) return null;
    return data;
  },

  async upsertLoan(loan: Database['public']['Tables']['pawn_loans']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('pawn_loans')
      .upsert(loan, { onConflict: 'id' });

    if (error) throw error;
  },

  async updateLoan(id: string, updates: Database['public']['Tables']['pawn_loans']['Update']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.from('pawn_loans').update(updates).eq('id', id);
    if (error) throw error;
  },

  mapLoanToRow(loan: PawnLoan, shopId?: string): Database['public']['Tables']['pawn_loans']['Insert'] {
    return {
      id: loan.id,
      shop_id: shopId || null,
      ticket_number: loan.ticketNumber,
      customer_id: loan.customerId,
      customer_name: loan.customerName || null,
      customer_id_number: loan.customerIdNumber || null,
      customer_mobile: loan.customerMobile || null,
      customer_address: loan.customerAddress || null,
      item_id: loan.itemId || null,
      item_title: loan.itemTitle || null,
      item_category: loan.itemCategory || null,
      serial_or_imei: loan.serialOrImei || null,
      condition: loan.condition || null,
      item_image_url: loan.itemImageUrl || null,
      principal: loan.principal,
      ncr_monthly_rate: loan.ncrMonthlyRate,
      monthly_interest: loan.monthlyInterest,
      monthly_storage_admin_fee: loan.monthlyStorageAdminFee,
      total_redemption_amount: loan.totalRedemptionAmount,
      extension_fee: loan.extensionFee,
      start_date: loan.startDate,
      expiry_date: loan.expiryDate,
      days_remaining: loan.daysRemaining,
      days_elapsed: loan.daysElapsed,
      vault_shelf: loan.vaultShelf || null,
      status: loan.status,
      qr_token: loan.qrToken || null,
      history: (loan.history as any) || [],
      created_at: loan.startDate ? `${loan.startDate}T00:00:00.000Z` : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToLoan(row: PawnLoanRow): PawnLoan {
    return {
      id: row.id,
      ticketNumber: row.ticket_number,
      customerId: row.customer_id,
      customerName: row.customer_name || '',
      customerIdNumber: row.customer_id_number || '',
      customerMobile: row.customer_mobile || '',
      customerAddress: row.customer_address || '',
      itemId: row.item_id || '',
      itemTitle: row.item_title || '',
      itemCategory: row.item_category || '',
      serialOrImei: row.serial_or_imei || '',
      condition: (row.condition as any) || 'Good',
      itemImageUrl: row.item_image_url || '',
      principal: Number(row.principal),
      ncrMonthlyRate: Number(row.ncr_monthly_rate),
      monthlyInterest: Number(row.monthly_interest),
      monthlyStorageAdminFee: Number(row.monthly_storage_admin_fee),
      totalRedemptionAmount: Number(row.total_redemption_amount),
      extensionFee: Number(row.extension_fee),
      startDate: row.start_date,
      expiryDate: row.expiry_date,
      daysRemaining: row.days_remaining,
      daysElapsed: row.days_elapsed,
      vaultShelf: row.vault_shelf || '',
      status: row.status,
      qrToken: row.qr_token || '',
      history: (row.history as any) || []
    };
  }
};

// ==========================================
// 9. SALES (Point of Sale Transactions)
// ==========================================
export const salesApi = {
  async getSales(options?: {
    shopId?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<SaleRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('sales').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.sinceTimestamp) query = query.gt('created_at', options.sinceTimestamp);

    query = query.order('timestamp', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getSaleByReceiptNumber(receiptNumber: string): Promise<SaleRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('sales').select('*').eq('receipt_number', receiptNumber).maybeSingle();
    if (error) return null;
    return data;
  },

  async upsertSale(sale: Database['public']['Tables']['sales']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('sales')
      .upsert(sale, { onConflict: 'id' });

    if (error) throw error;
  },

  mapSaleToRow(sale: SaleTransaction, shopId?: string): Database['public']['Tables']['sales']['Insert'] {
    return {
      id: sale.id,
      shop_id: shopId || null,
      receipt_number: sale.receiptNumber,
      timestamp: sale.timestamp || new Date().toISOString(),
      items: sale.items as any,
      subtotal: sale.subtotal,
      vat_amount: sale.vatAmount,
      total: sale.total,
      tender_method: sale.tenderMethod,
      amount_tendered: sale.amountTendered,
      change: sale.change,
      receipt_type: sale.receiptType || 'thermal',
      customer_mobile: sale.customerMobile || null,
      cashier: sale.cashier,
      status: 'Completed',
      created_at: sale.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToSale(row: SaleRow): SaleTransaction {
    return {
      id: row.id,
      receiptNumber: row.receipt_number,
      timestamp: row.timestamp,
      items: (row.items as any) || [],
      subtotal: Number(row.subtotal),
      vatAmount: Number(row.vat_amount),
      total: Number(row.total),
      tenderMethod: row.tender_method as any,
      amountTendered: Number(row.amount_tendered),
      change: Number(row.change),
      receiptType: (row.receipt_type as any) || 'thermal',
      customerMobile: row.customer_mobile || undefined,
      cashier: row.cashier
    };
  }
};

// ==========================================
// 10. SAPS / COMPLIANCE ENTRIES (Form 21)
// ==========================================
export const sapsApi = {
  async getEntries(options?: {
    shopId?: string;
    limit?: number;
    sinceTimestamp?: string;
  }): Promise<SapsEntryRow[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from('saps_entries').select('*');

    if (options?.shopId) query = query.eq('shop_id', options.shopId);
    if (options?.sinceTimestamp) query = query.gt('created_at', options.sinceTimestamp);

    query = query.order('timestamp', { ascending: false });
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getEntryByNumber(entryNumber: string): Promise<SapsEntryRow | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from('saps_entries').select('*').eq('entry_number', entryNumber).maybeSingle();
    if (error) return null;
    return data;
  },

  async upsertEntry(entry: Database['public']['Tables']['saps_entries']['Insert']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase
      .from('saps_entries')
      .upsert(entry, { onConflict: 'id' });

    if (error) throw error;
  },

  async updateEntry(id: string, updates: Database['public']['Tables']['saps_entries']['Update']): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { error } = await supabase.from('saps_entries').update(updates).eq('id', id);
    if (error) throw error;
  },

  mapEntryToRow(entry: SapsEntry, shopId?: string): Database['public']['Tables']['saps_entries']['Insert'] {
    return {
      id: entry.id,
      shop_id: shopId || null,
      entry_number: entry.entryNumber,
      timestamp: entry.timestamp || new Date().toISOString(),
      customer_id: entry.customerId,
      customer_name: entry.customerName,
      customer_id_number: entry.customerIdNumber,
      customer_address: entry.customerAddress || null,
      customer_phone: entry.customerPhone || null,
      item_description: entry.itemDescription,
      category: entry.category || null,
      serial_or_imei: entry.serialOrImei || null,
      condition: entry.condition || null,
      acquisition_type: entry.acquisitionType,
      consideration_paid: entry.considerationPaid,
      officer_name: entry.officerName || null,
      police_station_ref: entry.policeStationRef || null,
      verification_status: entry.verificationStatus || 'VERIFIED',
      barcode_ref: entry.barcodeRef || null,
      is_cancelled: entry.isCancelled || false,
      cancelled_at: entry.cancelledAt || null,
      cancel_reason: entry.cancelReason || null,
      created_at: entry.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  mapRowToEntry(row: SapsEntryRow): SapsEntry {
    return {
      id: row.id,
      entryNumber: row.entry_number,
      timestamp: row.timestamp,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerIdNumber: row.customer_id_number,
      customerAddress: row.customer_address || '',
      customerPhone: row.customer_phone || '',
      itemDescription: row.item_description,
      category: row.category || '',
      serialOrImei: row.serial_or_imei || '',
      condition: (row.condition as any) || 'Good',
      acquisitionType: (row.acquisition_type as any) || 'Buy',
      considerationPaid: Number(row.consideration_paid),
      officerName: row.officer_name || '',
      policeStationRef: row.police_station_ref || '',
      verificationStatus: (row.verification_status as any) || 'VERIFIED',
      barcodeRef: row.barcode_ref || '',
      isCancelled: row.is_cancelled,
      cancelledAt: row.cancelled_at || undefined,
      cancelReason: row.cancel_reason || undefined
    };
  }
};

// ==========================================
// 11. SYSTEM LOGS & AUDIT LOGS
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
    sapsReference?: string,
    shopId?: string
  ): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const user = await authApi.getUser();

      const { error } = await supabase
        .from('system_logs')
        .insert({
          shop_id: shopId || null,
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
