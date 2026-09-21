const DB_NAME = 'LocalMarketOfflineDB';
const DB_VERSION = 1;

export interface OfflineTransaction {
  id: string;
  type: 'POS_SALE' | 'PAWN_INTAKE' | 'LOAN_SETTLEMENT' | 'SAPS_LOG';
  payload: any;
  timestamp: number;
  synced: boolean;
}

export class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pawnLoans')) {
          db.createObjectStore('pawnLoans', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sapsRegister')) {
          db.createObjectStore('sapsRegister', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('offlineQueue')) {
          db.createObjectStore('offlineQueue', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async queueTransaction(type: OfflineTransaction['type'], payload: any): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('offlineQueue', 'readwrite');
    const store = tx.objectStore('offlineQueue');
    const record: OfflineTransaction = {
      id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      timestamp: Date.now(),
      synced: false,
    };
    store.put(record);
  }

  async getPendingQueue(): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction('offlineQueue', 'readonly');
      const store = tx.objectStore('offlineQueue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async clearSynced(id: string): Promise<void> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('offlineQueue', 'readwrite');
    tx.objectStore('offlineQueue').delete(id);
  }
}

export const offlineStorage = new OfflineStorage();
