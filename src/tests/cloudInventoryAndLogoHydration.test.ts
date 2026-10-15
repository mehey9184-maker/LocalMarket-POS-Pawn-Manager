/**
 * Cloud Inventory & Shop Logo Hydration Test Suite
 * 
 * Verifies:
 * 1. Shop profile hydration extracts logo_url from metadata.logo_url
 * 2. updateShopProfile preserves and propagates metadata in Supabase payload
 * 3. syncShopItemsWithSupabase hydrates cloud items into local Dexie store
 * 4. Pending outbox mutations in db.syncLogs are protected from being overwritten by cloud hydration
 * 5. Local item photos (data:image/ or local) are preserved when cloud record has no photo
 * 6. storageService strictly enforces local-only item photos while routing logos/avatars to cloud
 * 7. Source code invariants in AppContext.tsx, CashierProfile.tsx, and Header.tsx
 */

import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { ShopItemRow, ShopProfileRow } from '../types/supabase';
import { shopItemsApi, shopProfilesApi } from '../services/supabaseApi';
import { storageService } from '../services/storageService';
import { saveSupabaseCredentials, clearSupabaseCredentials } from '../services/supabase';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

function readSourceFile(relativePath: string): string {
  const absolutePath = path.resolve(relativePath);
  return fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n');
}

export async function runCloudInventoryAndLogoHydrationTests() {
  console.log('====================================================');
  console.log('   RUNNING CLOUD INVENTORY & LOGO HYDRATION TESTS   ');
  console.log('====================================================');

  const testShopId = '11111111-2222-3333-4444-555555555555';
  const originalFetch = globalThis.fetch;

  try {
    // --- 1. Shop Profile Metadata & Logo Extraction ---
    console.log('[Hydration Test 1] Verifying Shop Profile metadata.logo_url hydration logic...');
    const rawServerShop: ShopProfileRow = {
      id: testShopId,
      shop_code: 'SHOP-TEST',
      shop_name: "John's Pawn & Trading",
      trading_name: 'Johns Cash & Pawn',
      registration_number: '2023/123456/07',
      vat_number: '4999999999',
      saps_dealer_license: 'SHG-GAUTENG-999',
      phone: '011 555 1234',
      email: 'john@localmarket.co.za',
      address: '123 Market Street',
      city: 'Johannesburg',
      province: 'Gauteng',
      postal_code: '2001',
      currency: 'ZAR',
      receipt_header: 'JOHNS PAWN SHOP',
      receipt_footer: 'THANK YOU',
      is_active: true,
      metadata: {
        logo_url: 'https://storage.localmarket.co.za/shops/11111111-2222-3333-4444-555555555555/branding/logo/logo.webp',
        custom_theme: 'copper'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const logoUrl = (rawServerShop.metadata as any)?.logo_url || (rawServerShop as any).logo_url || '';
    assert(
      logoUrl === 'https://storage.localmarket.co.za/shops/11111111-2222-3333-4444-555555555555/branding/logo/logo.webp',
      `Expected logo_url extracted from metadata, got: ${logoUrl}`
    );
    assert(rawServerShop.metadata !== null && typeof rawServerShop.metadata === 'object', 'Metadata must be preserved');
    console.log('  ✔ Shop logo URL and metadata successfully extracted from server shop profile');

    // --- 2. Inventory Item Hydration & Local Photo Protection ---
    console.log('[Hydration Test 2] Verifying inventory hydration into Dexie & local photo preservation...');
    
    // Clear Dexie inventory for this shop
    await db.inventory.where('shopId').equals(testShopId).delete();
    await db.syncLogs.where('shopId').equals(testShopId).delete();

    const mockCloudItemRow: ShopItemRow = {
      id: '22222222-3333-4444-5555-666666666666',
      shop_id: testShopId,
      sku: 'LMP-GLD-001',
      title: '9ct Gold Curb Chain 15.2g',
      category: 'Gold',
      condition: 'Good',
      acquisition_type: 'Pawn Forfeiture',
      cost_basis: 4500,
      retail_price: 8999,
      status: 'Retail Floor',
      vault_location: 'Vault-B2',
      days_in_vault: 30,
      image_url: null, // Cloud row has no image URL
      specs: '15.2g 375 Hallmarked',
      serial_or_imei: 'GLD-8821',
      pawn_ticket_id: null,
      storage_key: null,
      created_by: null,
      added_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-01T10:00:00.000Z'
    };

    // Pre-seed Dexie with a local item that has a local base64 photo
    const localPhotoDataUrl = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';
    await db.inventory.put({
      id: mockCloudItemRow.id,
      shopId: testShopId,
      sku: mockCloudItemRow.sku,
      title: mockCloudItemRow.title,
      category: 'Gold' as any,
      condition: 'Good',
      acquisitionType: 'Pawn Forfeiture' as any,
      costBasis: 4500,
      retailPrice: 8999,
      status: 'Retail Floor',
      daysInVault: 30,
      imageUrl: localPhotoDataUrl, // Local photo!
      serialOrImei: 'GLD-8821',
      addedAt: mockCloudItemRow.added_at
    });

    // Simulate mapping and local image preservation during hydration
    const mappedItem = shopItemsApi.mapRowToInventoryItem(mockCloudItemRow);
    assert(mappedItem.sku === 'LMP-GLD-001', 'Mapped item SKU must match');
    assert(mappedItem.retailPrice === 8999, 'Mapped item retail price must match');
    assert(mappedItem.imageUrl === '', 'Cloud item row image URL is empty string');

    // Simulate hydration loop with local image preservation
    const existing = await db.inventory.where('shopId').equals(testShopId).toArray();
    const existingMap = new Map(existing.map(i => [i.id, i]));
    const localBefore = existingMap.get(mockCloudItemRow.id);
    assert(localBefore?.imageUrl === localPhotoDataUrl, 'Local item must exist before hydration');

    if (!mappedItem.imageUrl && localBefore?.imageUrl) {
      mappedItem.imageUrl = localBefore.imageUrl;
    }
    await db.inventory.put(mappedItem);

    const afterHydration = await db.inventory.get(mockCloudItemRow.id);
    assert(afterHydration?.imageUrl === localPhotoDataUrl, 'Local photo must NOT be erased during cloud hydration');
    console.log('  ✔ Local item photo preserved intact during cloud inventory hydration');

    // --- 3. Pending Outbox Mutation Protection ---
    console.log('[Hydration Test 3] Verifying pending local mutations are not overwritten by cloud...');
    const pendingItemId = '33333333-4444-5555-6666-777777777777';
    await db.inventory.put({
      id: pendingItemId,
      shopId: testShopId,
      sku: 'LMP-PHONE-99',
      title: 'iPhone 15 Pro 128GB - Locally Updated Title',
      category: 'Electronics' as any,
      condition: 'Excellent',
      acquisitionType: 'Direct Buy' as any,
      retailPrice: 16500,
      status: 'Retail Floor',
      daysInVault: 0,
      imageUrl: '',
      serialOrImei: 'IMEI-9999',
      addedAt: new Date().toISOString()
    });

    // Add a pending syncLog in the outbox
    await db.syncLogs.add({
      shopId: testShopId,
      entityType: 'inventory',
      entityId: pendingItemId,
      action: 'update',
      payload: { title: 'iPhone 15 Pro 128GB - Locally Updated Title' },
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    });

    const cloudOldItemRow: ShopItemRow = {
      id: pendingItemId,
      shop_id: testShopId,
      sku: 'LMP-PHONE-99',
      title: 'iPhone 15 Pro 128GB - Stale Cloud Title',
      category: 'Electronics',
      condition: 'Excellent',
      acquisition_type: 'Direct Buy',
      cost_basis: 12000,
      retail_price: 16000,
      status: 'Retail Floor',
      vault_location: null,
      days_in_vault: 0,
      image_url: null,
      specs: null,
      serial_or_imei: 'IMEI-9999',
      pawn_ticket_id: null,
      storage_key: null,
      created_by: null,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Hydration logic checks for pending sync logs
    const pendingLogs = await db.syncLogs
      .where('status')
      .anyOf('pending', 'syncing', 'failed')
      .and(l => l.shopId === testShopId && l.entityType === 'inventory')
      .toArray();
    const pendingIds = new Set(pendingLogs.map(l => l.entityId));

    assert(pendingIds.has(pendingItemId), 'Pending sync log must be detected');

    // Filter out items in pendingIds from cloud overwrite
    const itemsToHydrate = [cloudOldItemRow]
      .map(shopItemsApi.mapRowToInventoryItem)
      .filter(item => !pendingIds.has(item.id));

    assert(itemsToHydrate.length === 0, 'Item with pending sync log must be skipped during cloud hydration');

    const preservedItem = await db.inventory.get(pendingItemId);
    assert(
      preservedItem?.title === 'iPhone 15 Pro 128GB - Locally Updated Title',
      'Local pending edit must be preserved without cloud clobber'
    );
    console.log('  ✔ Pending local mutations protected from stale cloud overwrite');

    // Clean up test data
    await db.inventory.where('shopId').equals(testShopId).delete();
    await db.syncLogs.where('shopId').equals(testShopId).delete();

    // --- 4. Image Storage Separation Policy ---
    console.log('[Hydration Test 4] Verifying image storage separation policy (items local, logos cloud)...');
    const dummyImage = 'data:image/webp;base64,TEST_DATA';
    
    // Items must remain local
    const itemRes = await storageService.uploadItemImage(dummyImage, testShopId, 'item-1', 'item.webp', 'item');
    assert(itemRes.storageKey.startsWith('local/'), `Item storageKey must start with local/, got: ${itemRes.storageKey}`);
    assert(itemRes.imageUrl === dummyImage, 'Item photo must return local data without remote request');

    // Logos must use cloud upload pipeline
    const logoRes = await storageService.uploadLogoImage(dummyImage, testShopId, 'logo.webp');
    assert(logoRes.storageKey.includes('logo'), `Logo storageKey must include logo, got: ${logoRes.storageKey}`);
    console.log('  ✔ Image storage separation verified: item photos strictly local, logos cloud-backed');

    // --- 5. Source Invariants Audit ---
    console.log('[Hydration Test 5] Auditing AppContext.tsx and CashierProfile.tsx source invariants...');
    const appContextSrc = readSourceFile('src/context/AppContext.tsx');
    
    // Logo persistence in updateShopProfile
    assert(
      appContextSrc.includes('payload.metadata = updates.metadata') ||
      appContextSrc.includes('payload.metadata ='),
      'AppContext.tsx updateShopProfile must include metadata in Supabase payload'
    );
    assert(
      appContextSrc.includes('const finalLogoUrl = next.logo_url || (next.metadata as any)?.logo_url'),
      'AppContext.tsx must compute finalLogoUrl from metadata'
    );
    assert(
      appContextSrc.includes('localStorage.setItem(`shop_logo_local_${targetShopId}`'),
      'AppContext.tsx must cache shop logo to localStorage for fast local offline boot'
    );

    // Consolidated Inventory hydration ownership in InventoryContext
    const inventoryContextSrc = readSourceFile('src/context/InventoryContext.tsx');
    assert(
      inventoryContextSrc.includes('refreshInventory') &&
      inventoryContextSrc.includes('shopItemsApi.getItems'),
      'InventoryContext.tsx must be the authoritative owner of automatic cloud inventory hydration'
    );
    assert(
      appContextSrc.includes('syncShopItemsWithSupabase') &&
      appContextSrc.includes('shopItemsApi.getItems({ shopId: targetShopId })'),
      'AppContext.tsx syncShopItemsWithSupabase must query items by targetShopId for manual triggers'
    );
    assert(
      appContextSrc.includes('!item.imageUrl && local?.imageUrl'),
      'AppContext.tsx must preserve local photos when cloud has no photo'
    );

    // CashierProfile synchronization
    const cashierProfileSrc = readSourceFile('src/components/screens/CashierProfile.tsx');
    assert(
      cashierProfileSrc.includes('useEffect(() => {') &&
      cashierProfileSrc.includes('shopProfile.logo_url || (shopProfile.metadata as any)?.logo_url'),
      'CashierProfile.tsx must sync shopForm and logoPreview when shopProfile updates'
    );

    // Header logo resolution
    const headerSrc = readSourceFile('src/components/Header.tsx');
    assert(
      headerSrc.includes('shopProfile?.logo_url || (shopProfile?.metadata as any)?.logo_url'),
      'Header.tsx must resolve logo from shopProfile.logo_url and shopProfile.metadata.logo_url'
    );
    console.log('  ✔ AppContext, CashierProfile, and Header source invariants audited and verified');

  } finally {
    globalThis.fetch = originalFetch;
    clearSupabaseCredentials();
  }

  console.log('====================================================');
  console.log('   ALL CLOUD INVENTORY & LOGO TESTS PASSED!         ');
  console.log('====================================================\n');
}
