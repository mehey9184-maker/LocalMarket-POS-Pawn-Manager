export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'cashier' | 'senior_cashier' | 'manager' | 'admin';
export type ItemCondition = 'Mint' | 'Excellent' | 'Good' | 'Fair' | 'Damaged';
export type ItemStatus = 'Vault Hold' | 'Retail Floor' | 'Sold' | 'Redeemed' | 'Reserved' | 'Flagged';

export interface Database {
  public: {
    Tables: {
      shop_profiles: {
        Row: {
          id: string;
          shop_code: string;
          shop_name: string;
          trading_name: string | null;
          registration_number: string | null;
          vat_number: string | null;
          saps_dealer_license: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          currency: string;
          receipt_header: string | null;
          receipt_footer: string | null;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_code: string;
          shop_name: string;
          trading_name?: string | null;
          registration_number?: string | null;
          vat_number?: string | null;
          saps_dealer_license?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          currency?: string;
          receipt_header?: string | null;
          receipt_footer?: string | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_code?: string;
          shop_name?: string;
          trading_name?: string | null;
          registration_number?: string | null;
          vat_number?: string | null;
          saps_dealer_license?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          currency?: string;
          receipt_header?: string | null;
          receipt_footer?: string | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string;
          cashier_code: string;
          role: UserRole;
          phone: string | null;
          avatar_url: string | null;
          pin_code: string | null;
          digital_signature: string | null;
          is_active: boolean;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name: string;
          cashier_code?: string;
          role?: UserRole;
          phone?: string | null;
          avatar_url?: string | null;
          pin_code?: string | null;
          digital_signature?: string | null;
          is_active?: boolean;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string;
          cashier_code?: string;
          role?: UserRole;
          phone?: string | null;
          avatar_url?: string | null;
          pin_code?: string | null;
          digital_signature?: string | null;
          is_active?: boolean;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_items: {
        Row: {
          id: string;
          sku: string;
          title: string;
          category: string;
          serial_or_imei: string | null;
          condition: ItemCondition;
          acquisition_type: string;
          cost_basis: number;
          retail_price: number;
          vault_location: string | null;
          status: ItemStatus;
          days_in_vault: number;
          image_url: string | null;
          specs: string | null;
          pawn_ticket_id: string | null;
          created_by: string | null;
          added_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          title: string;
          category: string;
          serial_or_imei?: string | null;
          condition?: ItemCondition;
          acquisition_type?: string;
          cost_basis?: number;
          retail_price?: number;
          vault_location?: string | null;
          status?: ItemStatus;
          days_in_vault?: number;
          image_url?: string | null;
          specs?: string | null;
          pawn_ticket_id?: string | null;
          created_by?: string | null;
          added_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          title?: string;
          category?: string;
          serial_or_imei?: string | null;
          condition?: ItemCondition;
          acquisition_type?: string;
          cost_basis?: number;
          retail_price?: number;
          vault_location?: string | null;
          status?: ItemStatus;
          days_in_vault?: number;
          image_url?: string | null;
          specs?: string | null;
          pawn_ticket_id?: string | null;
          created_by?: string | null;
          added_at?: string;
          updated_at?: string;
        };
      };
      system_logs: {
        Row: {
          id: string;
          event_type: string;
          severity: string;
          actor_id: string | null;
          actor_name: string;
          details: Json;
          saps_reference: string | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          severity?: string;
          actor_id?: string | null;
          actor_name: string;
          details?: Json;
          saps_reference?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          severity?: string;
          actor_id?: string | null;
          actor_name?: string;
          details?: Json;
          saps_reference?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

export type ShopProfileRow = Database['public']['Tables']['shop_profiles']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ShopItemRow = Database['public']['Tables']['shop_items']['Row'];
export type SystemLogRow = Database['public']['Tables']['system_logs']['Row'];
