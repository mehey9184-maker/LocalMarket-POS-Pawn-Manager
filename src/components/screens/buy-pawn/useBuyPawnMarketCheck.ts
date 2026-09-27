import { useState, useCallback } from 'react';
import { marketIntelligenceApi } from '../../../services/marketIntelligenceApi';
import { MarketCheckResult } from '../../../types/marketIntelligence';
import { ItemDraft } from './buyPawnTypes';

export function useBuyPawnMarketCheck(itemData: ItemDraft) {
  const [marketCheckData, setMarketCheckData] = useState<MarketCheckResult | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState<boolean>(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const handleRunMarketCheck = useCallback(async () => {
    if (!itemData.title) return;
    setIsMarketLoading(true);
    setMarketError(null);
    const res = await marketIntelligenceApi.fetchMarketCheck({
      barcode: itemData.serialOrImei,
      title: itemData.title,
      category: itemData.category,
      condition: itemData.condition,
    });
    setIsMarketLoading(false);
    if (res.success && res.data) {
      setMarketCheckData(res.data);
    } else {
      setMarketError(res.error || 'Insufficient market data');
    }
  }, [itemData.serialOrImei, itemData.title, itemData.category, itemData.condition]);

  const resetMarketCheck = useCallback(() => {
    setMarketCheckData(null);
    setIsMarketLoading(false);
    setMarketError(null);
  }, []);

  return {
    marketCheckData,
    isMarketLoading,
    marketError,
    handleRunMarketCheck,
    resetMarketCheck,
  };
}
