import { MarketObservation, ProviderQuota, ExternalMarketCacheEntry } from '../types/marketIntelligence';

export interface ProviderConfig {
  provider: string;
  enabled: boolean;
  dailyLimit: number;
  cacheDurationDays: number;
  productCacheDurationDays: number;
  timeoutMs: number;
  sourceName: string;
}

export class ExternalMarketProviderManager {
  private static instance: ExternalMarketProviderManager;

  // In-flight request deduplication map
  private inFlightRequests: Map<string, Promise<MarketObservation | null>> = new Map();

  // In-memory quota and cooldown tracking
  private quotas: Map<string, ProviderQuota> = new Map();

  // Configuration
  private enabled: boolean = process.env.EXTERNAL_MARKET_DATA_ENABLED !== 'false';
  private defaultDailyLimit: number = 25; // MAX_EXTERNAL_REQUESTS_PER_DAY = 25
  private priceCacheDurationDays: number = 7;
  private productCacheDurationDays: number = 30;
  private timeoutMs: number = 4000;

  private constructor() {
    this.initQuota('upcitemdb');
  }

  public static getInstance(): ExternalMarketProviderManager {
    if (!ExternalMarketProviderManager.instance) {
      ExternalMarketProviderManager.instance = new ExternalMarketProviderManager();
    }
    return ExternalMarketProviderManager.instance;
  }

  // Reset state for testing
  public resetState(): void {
    this.inFlightRequests.clear();
    this.quotas.clear();
    this.initQuota('upcitemdb');
    this.enabled = true;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setDailyLimit(provider: string, limit: number): void {
    const q = this.getQuota(provider);
    q.dailyLimit = limit;
  }

  private initQuota(provider: string): ProviderQuota {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setUTCHours(24, 0, 0, 0);

    const quota: ProviderQuota = {
      provider,
      dailyLimit: this.defaultDailyLimit,
      requestsToday: 0,
      resetAt: nextReset.toISOString(),
      consecutiveFailures: 0,
      cooldownUntil: null
    };
    this.quotas.set(provider, quota);
    return quota;
  }

  public getQuota(provider: string = 'upcitemdb'): ProviderQuota {
    let quota = this.quotas.get(provider);
    if (!quota) {
      quota = this.initQuota(provider);
    }
    const now = new Date().getTime();
    if (now >= new Date(quota.resetAt).getTime()) {
      quota.requestsToday = 0;
      const nextReset = new Date();
      nextReset.setUTCHours(24, 0, 0, 0);
      quota.resetAt = nextReset.toISOString();
    }
    return quota;
  }

  /**
   * Atomic Provider Quota Reservation via Supabase RPC reserve_provider_request.
   * Lock row -> Check daily reset -> Check cooldown -> Check limit -> Reserve slot (+1).
   * Fallback to in-memory reservation when DB is absent/mocked.
   */
  public async reserveQuota(
    provider: string = 'upcitemdb',
    supabaseAdmin?: any
  ): Promise<{ allowed: boolean; reason?: string; quota?: ProviderQuota }> {
    if (!this.enabled) {
      return { allowed: false, reason: 'External market data disabled via configuration switch' };
    }

    if (supabaseAdmin && typeof supabaseAdmin.rpc === 'function') {
      try {
        const { data, error } = await supabaseAdmin.rpc('reserve_provider_request', {
          p_provider: provider,
          p_default_limit: this.defaultDailyLimit
        });

        if (!error && data) {
          const quota = this.getQuota(provider);
          quota.requestsToday = data.requests_today ?? quota.requestsToday;
          quota.dailyLimit = data.daily_limit ?? quota.dailyLimit;
          quota.resetAt = data.reset_at ?? quota.resetAt;
          if (data.cooldown_until !== undefined) quota.cooldownUntil = data.cooldown_until;
          if (data.consecutive_failures !== undefined) quota.consecutiveFailures = data.consecutive_failures;

          return {
            allowed: !!data.allowed,
            reason: data.reason || (data.allowed ? undefined : 'Quota exhausted or cooldown active'),
            quota
          };
        }
        if (error) {
          console.warn('[ExternalProviderManager] RPC reserve_provider_request error:', error.message || error);
        }
      } catch (err) {
        console.warn('[ExternalProviderManager] RPC call exception:', err);
      }
    }

    return this.reserveQuotaInMemory(provider);
  }

  private reserveQuotaInMemory(provider: string): { allowed: boolean; reason?: string; quota?: ProviderQuota } {
    const quota = this.getQuota(provider);
    const now = Date.now();

    if (quota.cooldownUntil && now < new Date(quota.cooldownUntil).getTime()) {
      return {
        allowed: false,
        reason: `Provider in failure cooldown until ${quota.cooldownUntil}`,
        quota
      };
    }

    if (quota.requestsToday >= quota.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily provider request quota exhausted (${quota.requestsToday}/${quota.dailyLimit})`,
        quota
      };
    }

    // Reserved slot in memory
    quota.requestsToday += 1;
    return { allowed: true, quota };
  }

  /**
   * Resets failure state upon successful HTTP response.
   * NOTE: MUST NOT increment requestsToday because the slot was already reserved!
   */
  public recordSuccess(provider: string = 'upcitemdb', supabaseAdmin?: any): void {
    const quota = this.getQuota(provider);
    quota.consecutiveFailures = 0;
    quota.cooldownUntil = null;

    if (supabaseAdmin) {
      supabaseAdmin.from('provider_quotas').upsert({
        provider,
        daily_limit: quota.dailyLimit,
        reset_at: quota.resetAt,
        consecutive_failures: 0,
        cooldown_until: null,
        updated_at: new Date().toISOString()
      }).then(() => {}).catch((err: any) => console.warn('Error updating quota in DB:', err));
    }
  }

  /**
   * Records failure and triggers cooldown upon HTTP error / 429 / timeout.
   * NOTE: MUST NOT increment requestsToday because the slot was already reserved!
   */
  public recordFailure(provider: string = 'upcitemdb', statusCode?: number, supabaseAdmin?: any): void {
    const quota = this.getQuota(provider);
    quota.consecutiveFailures = (quota.consecutiveFailures || 0) + 1;

    let cooldownMinutes = 1;
    if (statusCode === 429) {
      cooldownMinutes = 15;
    } else if (quota.consecutiveFailures === 2) {
      cooldownMinutes = 5;
    } else if (quota.consecutiveFailures === 3) {
      cooldownMinutes = 15;
    } else if (quota.consecutiveFailures >= 4) {
      cooldownMinutes = 60;
    }

    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
    quota.cooldownUntil = cooldownUntil;

    console.warn(`[ExternalProviderManager] Provider ${provider} failure (status ${statusCode || 'unknown'}). Consecutive failures: ${quota.consecutiveFailures}. Cooldown until ${cooldownUntil}`);

    if (supabaseAdmin) {
      supabaseAdmin.from('provider_quotas').upsert({
        provider,
        daily_limit: quota.dailyLimit,
        reset_at: quota.resetAt,
        last_failure_at: new Date().toISOString(),
        consecutive_failures: quota.consecutiveFailures,
        cooldown_until: cooldownUntil,
        updated_at: new Date().toISOString()
      }).then(() => {}).catch((err: any) => console.warn('Error recording failure in DB:', err));
    }
  }

  public async getCachedObservation(
    supabaseAdmin: any,
    cacheKey: string
  ): Promise<ExternalMarketCacheEntry | null> {
    if (!supabaseAdmin) return null;

    try {
      const { data } = await supabaseAdmin
        .from('external_market_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          provider: data.provider,
          cacheKey: data.cache_key,
          barcode: data.barcode,
          normalizedProductName: data.normalized_product_name,
          brand: data.brand,
          model: data.model,
          category: data.category,
          referencePrice: data.reference_price != null ? Number(data.reference_price) : null,
          askingLow: data.asking_low != null ? Number(data.asking_low) : null,
          askingHigh: data.asking_high != null ? Number(data.asking_high) : null,
          rawSummary: data.raw_summary,
          sourceUrl: data.source_url,
          observedAt: data.observed_at,
          expiresAt: data.expires_at,
          lastErrorAt: data.last_error_at,
          failureCount: data.failure_count || 0
        };
      }
    } catch (err) {
      console.warn('[ExternalProviderManager] Error reading external cache:', err);
    }
    return null;
  }

  public async saveCachedObservation(
    supabaseAdmin: any,
    entry: ExternalMarketCacheEntry
  ): Promise<void> {
    if (!supabaseAdmin) return;

    try {
      await supabaseAdmin.from('external_market_cache').upsert({
        provider: entry.provider,
        cache_key: entry.cacheKey,
        barcode: entry.barcode,
        normalized_product_name: entry.normalizedProductName,
        brand: entry.brand,
        model: entry.model,
        category: entry.category,
        reference_price: entry.referencePrice,
        asking_low: entry.askingLow,
        asking_high: entry.askingHigh,
        raw_summary: entry.rawSummary || {},
        source_url: entry.sourceUrl,
        observed_at: entry.observedAt,
        expires_at: entry.expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'cache_key' });
    } catch (err) {
      console.warn('[ExternalProviderManager] Error writing external cache:', err);
    }
  }

  public async getExternalObservation(
    cleanBarcode: string,
    cleanTitle: string,
    category?: string,
    supabaseAdmin?: any,
    forceRefresh: boolean = false,
    customFetch?: typeof fetch
  ): Promise<{ observation: MarketObservation | null; source: 'cache' | 'provider' | 'none'; quotaExhausted?: boolean }> {
    if (!this.enabled) {
      return { observation: null, source: 'none' };
    }

    const provider = 'upcitemdb';
    const cacheKey = cleanBarcode
      ? `${provider}:barcode:${cleanBarcode}`
      : `${provider}:title:${cleanTitle.toLowerCase().trim()}`;

    // Step 0: Request Deduplication - Synchronous check before any async gaps
    if (this.inFlightRequests.has(cacheKey)) {
      const obs = await this.inFlightRequests.get(cacheKey)!;
      return { observation: obs, source: obs ? (obs.sourceName.includes('Cached') ? 'cache' : 'provider') : 'none' };
    }

    // Wrap entire lookup process in an orchestrator promise and register IMMEDIATELY
    const orchestratorPromise = (async (): Promise<MarketObservation | null> => {
      // Step 1: Check Global External Cache
      const cachedEntry = await this.getCachedObservation(supabaseAdmin, cacheKey);
      const nowIso = new Date().toISOString();

      if (cachedEntry) {
        const isUnexpired = cachedEntry.expiresAt > nowIso;
        if (isUnexpired && !forceRefresh) {
          return {
            sourceType: 'upcitemdb',
            sourceName: 'UPCitemdb Online Reference (Cached)',
            sourceUrl: cachedEntry.sourceUrl || `https://www.upcitemdb.com/upc/${cleanBarcode}`,
            productName: cachedEntry.normalizedProductName,
            brand: cachedEntry.brand || undefined,
            model: cachedEntry.model || undefined,
            category: cachedEntry.category || category,
            barcode: cachedEntry.barcode || cleanBarcode,
            referencePrice: cachedEntry.referencePrice ?? null,
            usedLow: cachedEntry.askingLow ?? null,
            usedHigh: cachedEntry.askingHigh ?? null,
            medianPrice: (cachedEntry.referencePrice || cachedEntry.askingLow) ?? null,
            rawSummary: cachedEntry.rawSummary || undefined,
            observedAt: cachedEntry.observedAt
          };
        }
      }

      // Step 2: Atomic Provider Quota Reservation
      const reservation = await this.reserveQuota(provider, supabaseAdmin);

      if (!reservation.allowed) {
        if (cachedEntry) {
          return {
            sourceType: 'upcitemdb',
            sourceName: 'UPCitemdb Online Reference (Expired Cache)',
            sourceUrl: cachedEntry.sourceUrl || `https://www.upcitemdb.com/upc/${cleanBarcode}`,
            productName: cachedEntry.normalizedProductName,
            brand: cachedEntry.brand || undefined,
            model: cachedEntry.model || undefined,
            category: cachedEntry.category || category,
            barcode: cachedEntry.barcode || cleanBarcode,
            referencePrice: cachedEntry.referencePrice ?? null,
            usedLow: cachedEntry.askingLow ?? null,
            usedHigh: cachedEntry.askingHigh ?? null,
            medianPrice: (cachedEntry.referencePrice || cachedEntry.askingLow) ?? null,
            rawSummary: cachedEntry.rawSummary || undefined,
            observedAt: cachedEntry.observedAt
          };
        }
        return null;
      }

      // Step 3: Execute external HTTP call
      const activeFetch = customFetch || (typeof fetch !== 'undefined' ? fetch : undefined);
      if (!cleanBarcode || !activeFetch) {
        return null;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(cleanBarcode)}`;
        const response = await activeFetch(upcUrl, {
          headers: { "Accept": "application/json", "User-Agent": "LocalMarket-POS/1.0" },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          this.recordFailure(provider, 429, supabaseAdmin);
          return null;
        }

        if (!response.ok) {
          this.recordFailure(provider, response.status, supabaseAdmin);
          return null;
        }

        const upcData = await response.json();
        if (upcData && upcData.items && upcData.items.length > 0) {
          const item = upcData.items[0];
          const offers = item.offers || [];
          const offerPrices = offers.map((o: any) => Number(o.price)).filter((p: number) => p > 0);
          offerPrices.sort((a: number, b: number) => a - b);

          const msrp = item.msrp ? Number(item.msrp) : null;
          const onlineAskingLow = offerPrices.length > 0 ? offerPrices[0] : null;
          const onlineAskingHigh = offerPrices.length > 0 ? offerPrices[offerPrices.length - 1] : null;
          const medianPrice = offerPrices.length > 0 ? offerPrices[Math.floor(offerPrices.length / 2)] : msrp;

          const obs: MarketObservation = {
            sourceType: "upcitemdb",
            sourceName: "UPCitemdb Online Reference",
            sourceUrl: `https://www.upcitemdb.com/upc/${cleanBarcode}`,
            productName: item.title || cleanTitle || "Reference Item",
            brand: item.brand,
            model: item.model,
            category: item.category || category,
            barcode: cleanBarcode,
            referencePrice: msrp || medianPrice,
            usedLow: onlineAskingLow,
            usedHigh: onlineAskingHigh,
            medianPrice,
            observedAt: new Date().toISOString()
          };

          this.recordSuccess(provider, supabaseAdmin);

          const expiresAt = new Date(Date.now() + this.priceCacheDurationDays * 24 * 60 * 60 * 1000).toISOString();

          await this.saveCachedObservation(supabaseAdmin, {
            provider,
            cacheKey,
            barcode: cleanBarcode,
            normalizedProductName: obs.productName,
            brand: obs.brand,
            model: obs.model,
            category: obs.category,
            referencePrice: obs.referencePrice,
            askingLow: obs.usedLow,
            askingHigh: obs.usedHigh,
            rawSummary: { upcitemdbItem: item },
            sourceUrl: obs.sourceUrl,
            observedAt: obs.observedAt,
            expiresAt
          });

          return obs;
        }

        this.recordSuccess(provider, supabaseAdmin);
        return null;

      } catch (err: any) {
        console.warn(`[ExternalProviderManager] Fetch exception for barcode ${cleanBarcode}:`, err.message || err);
        this.recordFailure(provider, 0, supabaseAdmin);
        return null;
      }
    })();

    this.inFlightRequests.set(cacheKey, orchestratorPromise);

    try {
      const result = await orchestratorPromise;
      const isQuotaExhausted = !result && this.getQuota(provider).requestsToday >= this.getQuota(provider).dailyLimit;

      return {
        observation: result,
        source: result ? (result.sourceName.includes('Cached') ? 'cache' : 'provider') : 'none',
        quotaExhausted: isQuotaExhausted
      };
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }
}

export const externalMarketProviderManager = ExternalMarketProviderManager.getInstance();
