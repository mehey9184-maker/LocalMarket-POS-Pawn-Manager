import { MarketCheckRequest, MarketCheckResult } from '../types/marketIntelligence';
import { getValidSupabaseSession } from './supabaseApi';
import { apiPost } from '../utils/apiClient';

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

      const result = await apiPost<{ success: boolean; data?: MarketCheckResult; error?: string }>(
        '/api/market-intelligence/check',
        req,
        token
      );

      if (!result.ok || !result.data?.success || !result.data?.data) {
        return {
          success: false,
          error: result.error || result.data?.error || 'Failed to generate Market Intelligence'
        };
      }

      return {
        success: true,
        data: result.data.data
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
