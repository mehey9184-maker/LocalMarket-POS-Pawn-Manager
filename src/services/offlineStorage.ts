/**
 * Offline-First Persistent Storage Engine
 * WhatsApp-Style Architecture:
 * 1. All data lives permanently on the local device (IndexedDB + LocalStorage).
 * 2. When offline, all transactions, intakes, logs and edits are saved locally in the Outbox.
 * 3. When the connection is restored, a "Slow Sync" (Trickle Sync) paces requests to Supabase
 *    to prevent network spikes, rate limits, and high egress while data remains on the device.
 * 4. Generates an exportable/downloadable WhatsApp-style backup snapshot file (.json) on device.
 */

const DB_NAME = 'LocalMarketOfflineDB';
const DB_VERSION = 2;

export interface OfflineSyncItem {
  id: string;
  action: 'CREATE_ITEM' | 'UPDATE_ITEM' | 'POS_SALE' | 'PAWN_INTAKE' | 'LOAN_SETTLE' | 'SAPS_LOG' | 'UPDATE_PROFILE';
  entity: string;
  payload: any;
  createdAt: string;
  synced: boolean;
  retryCount: number;
  lastError?: string;
}

export interface DeviceBackupSnapshot {
  version: string;
  backupType: 'WHATSAPP_STYLE_DEVICE_BACKUP';
  createdAt: string;
  shopProfile: any;
  inventory: any[];
  customers: any[];
  pawnLoans: any[];
  sapsRegister: any[];
  salesHistory: any[];
  pendingQueue: OfflineSyncItem[];
  checksum?: string;
}

export class OfflineStorage {
  private db: IDBDatabase | null = null;
  private isSlowSyncRunning = false;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        const stores = [
          'inventory',
          'customers',
          'pawnLoans',
          'sapsRegister',
          'salesHistory',
          'shopProfile',
          'syncQueue',
          'backupSnapshots',
        ];

        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==========================================
  // 1. OUTBOX QUEUE (OFFLINE MUTATIONS)
  // ==========================================
  async queueSyncAction(
    action: OfflineSyncItem['action'],
    entity: string,
    payload: any
  ): Promise<OfflineSyncItem> {
    if (!this.db) await this.init();

    const item: OfflineSyncItem = {
      id: `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      entity,
      payload,
      createdAt: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const req = store.put(item);
      req.onsuccess = () => {
        // Also persist fallback queue in LocalStorage
        this.backupQueueToLocalStorage();
        resolve(item);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingQueue(): Promise<OfflineSyncItem[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const request = store.getAll();
      request.onsuccess = () => {
        const items: OfflineSyncItem[] = request.result || [];
        resolve(items.filter(i => !i.synced));
      };
      request.onerror = () => {
        // Fallback to localstorage if IndexedDB has issues
        try {
          const raw = localStorage.getItem('lm_offline_sync_queue');
          resolve(raw ? JSON.parse(raw) : []);
        } catch {
          resolve([]);
        }
      };
    });
  }

  async markItemSynced(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const updated = { ...getReq.result, synced: true, syncedAt: new Date().toISOString() };
          store.put(updated);
        }
        this.backupQueueToLocalStorage();
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  private async backupQueueToLocalStorage(): Promise<void> {
    try {
      const pending = await this.getPendingQueue();
      localStorage.setItem('lm_offline_sync_queue', JSON.stringify(pending));
    } catch {
      // Ignored
    }
  }

  // ==========================================
  // 2. SLOW / TRICKLE SYNC ENGINE (Paced Background Worker)
  // ==========================================
  /**
   * Slowly trickles pending offline records to Supabase one-by-one.
   * Prevents bandwidth spikes, stays well under egress & rate limits.
   * Data remains fully preserved on local device.
   */
  async runSlowSync(
    syncHandler: (item: OfflineSyncItem) => Promise<boolean>,
    options?: {
      delayBetweenItemsMs?: number;
      onProgress?: (synced: number, total: number, currentItem: OfflineSyncItem) => void;
      onComplete?: (totalSynced: number) => void;
    }
  ): Promise<void> {
    if (this.isSlowSyncRunning) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSlowSyncRunning = true;
    const delayMs = options?.delayBetweenItemsMs ?? 1000; // default 1 second between items for gentle pacing

    try {
      const queue = await this.getPendingQueue();
      if (queue.length === 0) {
        this.isSlowSyncRunning = false;
        return;
      }

      let syncedCount = 0;
      for (const item of queue) {
        // Pause if connection drops midway
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }

        if (options?.onProgress) {
          options.onProgress(syncedCount + 1, queue.length, item);
        }

        try {
          const success = await syncHandler(item);
          if (success) {
            await this.markItemSynced(item.id);
            syncedCount++;
          } else {
            item.retryCount = (item.retryCount || 0) + 1;
          }
        } catch (err: any) {
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastError = err?.message || 'Sync failed';
        }

        // Gentle delay before next item (saving egress & preventing server spike)
        await new Promise(r => setTimeout(r, delayMs));
      }

      if (options?.onComplete) {
        options.onComplete(syncedCount);
      }
    } finally {
      this.isSlowSyncRunning = false;
    }
  }

  // ==========================================
  // 3. WHATSAPP-STYLE LOCAL DEVICE BACKUP (File Generation & Restore)
  // ==========================================
  /**
   * Creates an exact point-in-time snapshot file of the entire store
   * (Inventory, loans, customers, SAPS book, receipts, settings) and triggers
   * a download directly to the device's storage like WhatsApp's msgstore.db.
   */
  async exportLocalDeviceBackupFile(shopCode = 'SOWETO-01'): Promise<void> {
    const snapshot: DeviceBackupSnapshot = {
      version: '2.0.0',
      backupType: 'WHATSAPP_STYLE_DEVICE_BACKUP',
      createdAt: new Date().toISOString(),
      shopProfile: this.getFromLocal('lm_shop_profile', {
        shop_code: 'SHOP-SOW-01',
        shop_name: 'LocalMarket Soweto Main Branch',
        trading_name: 'LocalMarket Pawnbrokers (Pty) Ltd',
        saps_dealer_license: 'SAPS-SHD-2024-99182',
        vat_number: 'ZA4891029381',
        address: '1482 Vilakazi Street, Orlando West, Soweto, 1804',
        phone: '+27 11 938 1200',
        email: 'soweto.branch@localmarket.co.za',
        currency: 'ZAR',
      }),
      inventory: this.getFromLocal('lm_inventory', []),
      customers: this.getFromLocal('lm_customers', []),
      pawnLoans: this.getFromLocal('lm_loans', []),
      sapsRegister: this.getFromLocal('lm_saps', []),
      salesHistory: this.getFromLocal('lm_sales', []),
      pendingQueue: await this.getPendingQueue(),
    };

    const jsonString = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `LocalMarket_Device_Backup_${shopCode}_${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Save metadata of last backup
    localStorage.setItem('lm_last_device_backup_time', new Date().toISOString());
  }

  /**
   * Restores the complete database from an exported WhatsApp-style device backup file
   */
  async restoreFromDeviceBackupFile(fileContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(fileContent);

      if (!data.backupType || data.backupType !== 'WHATSAPP_STYLE_DEVICE_BACKUP') {
        throw new Error('Invalid file format. Please select a valid LocalMarket device backup file.');
      }

      if (data.inventory) localStorage.setItem('lm_inventory', JSON.stringify(data.inventory));
      if (data.customers) localStorage.setItem('lm_customers', JSON.stringify(data.customers));
      if (data.pawnLoans) localStorage.setItem('lm_loans', JSON.stringify(data.pawnLoans));
      if (data.sapsRegister) localStorage.setItem('lm_saps', JSON.stringify(data.sapsRegister));
      if (data.salesHistory) localStorage.setItem('lm_sales', JSON.stringify(data.salesHistory));
      if (data.shopProfile) localStorage.setItem('lm_shop_profile', JSON.stringify(data.shopProfile));

      return {
        success: true,
        message: `Restored: ${data.inventory?.length || 0} items, ${data.salesHistory?.length || 0} sales from backup file (${data.createdAt}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Failed to restore backup file.',
      };
    }
  }

  // ==========================================
  // 4. STORAGE HEALTH & METRICS
  // ==========================================
  getDeviceStorageStats(): {
    totalItems: number;
    totalSales: number;
    pendingOfflineItems: number;
    lastBackupTime: string | null;
    estimatedLocalSizeKb: number;
  } {
    const inventory = this.getFromLocal('lm_inventory', []);
    const sales = this.getFromLocal('lm_sales', []);
    const queue = this.getFromLocal('lm_offline_sync_queue', []);
    const lastBackupTime = localStorage.getItem('lm_last_device_backup_time');

    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('lm_')) {
        totalChars += (localStorage.getItem(key) || '').length;
      }
    }

    return {
      totalItems: inventory.length,
      totalSales: sales.length,
      pendingOfflineItems: queue.length,
      lastBackupTime,
      estimatedLocalSizeKb: Math.round(totalChars / 1024),
    };
  }

  private getFromLocal<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }
}

export const offlineStorage = new OfflineStorage();
