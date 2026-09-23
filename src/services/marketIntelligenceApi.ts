import { MarketCheckRequest, MarketCheckResult } from '../types/marketIntelligence';
import { getValidSupabaseSession } from './supabaseApi';

export const marketIntelligenceApi = {
  async fetchMarketCheck(req: MarketCheckRequest): Promise<{ success: boolean; data?: MarketCheckResult; error?: string }> {
    if (!navigator.onLine) {
      return {
        success: false,
        error: 'Market Check unavailable offline'
      };
    }

    try {
      const session = await getValidSupabaseSession();
      const token = session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/market-intelligence/check', {
        method: 'POST',
        headers,
        body: JSON.stringify(req)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errJson.error || `Server responded with status ${res.status}`
        };
      }

      const body = await res.json();
      if (!body.success || !body.data) {
        return {
          success: false,
          error: body.error || 'Failed to generate Market Intelligence'
        };
      }

      return {
        success: true,
        data: body.data
      };
    } catch (err: any) {
      console.warn('Market Intelligence fetch exception:', err);
      return {
        success: false,
        error: err.message || 'Network error during Market Check'
      };
    }
  }
};
