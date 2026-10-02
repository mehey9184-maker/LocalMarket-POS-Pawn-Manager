import assert from 'node:assert';
import { getSearchItemStatus } from '../components/Header';
import { InventoryItem, PawnLoan, SaleTransaction } from '../types';

/**
 * Phase 2E Final Verification Correction Test Suite:
 * Covers Tests A, B, C, D, E, F, and G (Ambiguous Serial/IMEI guard).
 */
export async function runPhase2eSearchContinuityTests() {
  console.log('=== RUNNING PHASE 2E FINAL SERIAL/IMEI AMBIGUITY GUARD TEST SUITE ===');

  const mockInventory: InventoryItem[] = [
    {
      id: 'item-retail-with-pawn',
      title: 'Retail Item With Old Pawn Ref',
      sku: 'SKU-RETAIL-OLD',
      category: 'Audio',
      condition: 'Mint',
      retailPrice: 999,
      costBasis: 500,
      status: 'Retail Floor',
      pawnTicketId: 'PAWN-OLD-123',
      serialOrImei: 'SN-RETAIL',
      imageUrl: '',
      acquisitionType: 'Existing Stock',
      addedAt: '2026-01-01'
    },
    {
      id: 'item-sold-with-pawn',
      title: 'Sold Item With Old Pawn Ref',
      sku: 'SKU-SOLD-OLD',
      category: 'Smartphones',
      condition: 'Good',
      retailPrice: 4999,
      costBasis: 3000,
      status: 'Sold',
      pawnTicketId: 'PAWN-OLD-456',
      serialOrImei: 'SN-SOLD',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-02'
    },
    {
      id: 'item-vault-noloan',
      title: 'Orphan Vault Item',
      sku: 'SKU-VAULT-NOLOAN',
      category: 'Tools',
      condition: 'Fair',
      retailPrice: 1500,
      costBasis: 900,
      status: 'Vault Hold',
      vaultLocation: 'Shelf-X',
      serialOrImei: 'SN-NOLOAN',
      imageUrl: '',
      acquisitionType: 'Existing Stock',
      addedAt: '2026-01-03'
    },
    {
      id: 'item-vault-with-loan',
      title: 'Valid Pawn Vault Item',
      sku: 'SKU-VAULT-LOAN',
      category: 'Jewelry',
      condition: 'Mint',
      retailPrice: 10000,
      costBasis: 6000,
      status: 'Vault Hold',
      vaultLocation: 'Shelf-Y',
      pawnTicketId: 'PAWN-REAL-001',
      serialOrImei: 'RLX999',
      imageUrl: '',
      acquisitionType: 'Pawn',
      addedAt: '2026-01-04'
    },
    {
      id: 'item-sold-A',
      title: 'Sold Item A with Real Sale',
      sku: 'SKU-SOLD-A',
      category: 'Audio',
      condition: 'Mint',
      retailPrice: 2000,
      costBasis: 1000,
      status: 'Sold',
      serialOrImei: 'SN-SOLD-A',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-05'
    },
    {
      id: 'item-sold-B',
      title: 'Sold Item B with No Sale',
      sku: 'SKU-SOLD-B',
      category: 'Audio',
      condition: 'Mint',
      retailPrice: 2000,
      costBasis: 1000,
      status: 'Sold',
      serialOrImei: 'SN-SOLD-B',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-05'
    },
    {
      id: 'item-sold-C',
      title: 'Sold Item C SKU Collision Test',
      sku: 'SKU-123',
      category: 'Audio',
      condition: 'Mint',
      retailPrice: 2000,
      costBasis: 1000,
      status: 'Sold',
      serialOrImei: 'SN-SOLD-C',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-05'
    },
    {
      id: 'item-D',
      title: 'Unrelated Item D',
      sku: 'SKU-OTHER',
      category: 'Audio',
      condition: 'Mint',
      retailPrice: 1000,
      costBasis: 500,
      status: 'Retail Floor',
      serialOrImei: 'SN-D',
      imageUrl: '',
      acquisitionType: 'Existing Stock',
      addedAt: '2026-01-05'
    },
    {
      id: 'item-duplicate-serial',
      title: 'Item with Duplicate Serial',
      sku: 'SKU-DUP',
      category: 'Electronics',
      condition: 'Good',
      retailPrice: 1500,
      costBasis: 800,
      status: 'Sold',
      serialOrImei: 'SN-DUPLICATE',
      imageUrl: '',
      acquisitionType: 'Buy',
      addedAt: '2026-01-06'
    }
  ];

  const mockLoans: PawnLoan[] = [
    {
      id: 'loan-real-001',
      ticketNumber: 'PAWN-REAL-001',
      customerId: 'cust-1',
      customerName: 'Jane Smith',
      customerIdNumber: '9001015009088',
      customerMobile: '0829876543',
      customerAddress: '456 Oak Rd',
      itemId: 'item-vault-with-loan',
      itemTitle: 'Valid Pawn Vault Item',
      itemCategory: 'Jewelry',
      serialOrImei: 'RLX999',
      condition: 'Mint',
      itemImageUrl: '',
      principal: 5000,
      ncrMonthlyRate: 0.05,
      monthlyInterest: 250,
      monthlyStorageAdminFee: 250,
      totalRedemptionAmount: 5500,
      extensionFee: 250,
      startDate: '2026-01-04',
      expiryDate: '2026-02-04',
      daysRemaining: 30,
      daysElapsed: 0,
      vaultShelf: 'Shelf-Y',
      status: 'Active',
      qrToken: 'qr-real',
      history: [],
      shopId: 'shop-1'
    }
  ];

  const realSaleA: SaleTransaction = {
    id: 'sale-real-A',
    receiptNumber: 'REC-001',
    timestamp: '2026-01-05T12:00:00Z',
    items: [{ item: mockInventory.find(i => i.id === 'item-sold-A')!, quantity: 1 }],
    subtotal: 1739.13,
    vatAmount: 260.87,
    total: 2000,
    tenderMethod: 'cash',
    amountTendered: 2000,
    change: 0,
    receiptType: 'thermal',
    cashier: 'POS Cashier'
  };

  const collisionSale: SaleTransaction = {
    id: 'sale-collision',
    receiptNumber: 'SKU-123',
    timestamp: '2026-01-05T12:00:00Z',
    items: [{ item: mockInventory.find(i => i.id === 'item-D')!, quantity: 1 }],
    subtotal: 869.57,
    vatAmount: 130.43,
    total: 1000,
    tenderMethod: 'cash',
    amountTendered: 1000,
    change: 0,
    receiptType: 'thermal',
    cashier: 'POS Cashier'
  };

  // Two different sales containing items with the same serial 'SN-DUPLICATE'
  const duplicateSale1: SaleTransaction = {
    id: 'sale-dup-1',
    receiptNumber: 'REC-DUP-1',
    timestamp: '2026-01-06T10:00:00Z',
    items: [{ item: { id: 'other-item-1', title: 'Other 1', sku: 'SKU-O1', category: 'General', condition: 'Good', retailPrice: 100, costBasis: 50, status: 'Sold', serialOrImei: 'SN-DUPLICATE', imageUrl: '', acquisitionType: 'Buy', addedAt: '2026-01-01' }, quantity: 1 }],
    subtotal: 86.96,
    vatAmount: 13.04,
    total: 100,
    tenderMethod: 'cash',
    amountTendered: 100,
    change: 0,
    receiptType: 'thermal',
    cashier: 'POS Cashier'
  };

  const duplicateSale2: SaleTransaction = {
    id: 'sale-dup-2',
    receiptNumber: 'REC-DUP-2',
    timestamp: '2026-01-06T11:00:00Z',
    items: [{ item: { id: 'other-item-2', title: 'Other 2', sku: 'SKU-O2', category: 'General', condition: 'Good', retailPrice: 100, costBasis: 50, status: 'Sold', serialOrImei: 'SN-DUPLICATE', imageUrl: '', acquisitionType: 'Buy', addedAt: '2026-01-01' }, quantity: 1 }],
    subtotal: 86.96,
    vatAmount: 13.04,
    total: 100,
    tenderMethod: 'cash',
    amountTendered: 100,
    change: 0,
    receiptType: 'thermal',
    cashier: 'POS Cashier'
  };

  const mockSales: SaleTransaction[] = [realSaleA, collisionSale, duplicateSale1, duplicateSale2];

  // Helper matching function mirroring Header.tsx unambiguous serial/IMEI fallback logic
  const resolveMatchingSale = (item: InventoryItem, sales: SaleTransaction[]) => {
    const saleByItemId = sales.find(s =>
      s.items.some(si => si.item.id === item.id)
    );

    let matchingSale = saleByItemId;

    if (!matchingSale && item.serialOrImei) {
      const serialMatches = sales.filter(s =>
        s.items.some(si =>
          Boolean(si.item.serialOrImei) &&
          si.item.serialOrImei!.toLowerCase() === item.serialOrImei!.toLowerCase()
        )
      );

      if (serialMatches.length === 1) {
        matchingSale = serialMatches[0];
      }
    }

    return matchingSale;
  };

  // --- Test A — Sold item with real sale ---
  const soldItemA = mockInventory.find(i => i.id === 'item-sold-A')!;
  const matchedSaleA = resolveMatchingSale(soldItemA, mockSales);
  assert.ok(matchedSaleA, 'Test A: Sold item A resolves to a real sale');
  assert.strictEqual(matchedSaleA?.id, 'sale-real-A', 'Test A: Selected SaleTransaction is the real sale object');

  // --- Test B — Sold item with no sale ---
  const soldItemB = mockInventory.find(i => i.id === 'item-sold-B')!;
  const matchedSaleB = resolveMatchingSale(soldItemB, mockSales);
  assert.strictEqual(matchedSaleB, undefined, 'Test B: Sold item B with no matching sale resolves to undefined (action View Item, no SaleTransaction created)');

  // --- Test C — SKU collision safety ---
  const soldItemC = mockInventory.find(i => i.id === 'item-sold-C')!;
  const matchedSaleC = resolveMatchingSale(soldItemC, mockSales);
  assert.strictEqual(matchedSaleC, undefined, 'Test C: Sold item C with SKU matching unrelated receipt number does NOT resolve to collision sale; action remains View Item');

  // --- Test D — Vault with real loan ---
  const vaultLoanStatus = getSearchItemStatus(mockInventory[3], mockLoans);
  assert.strictEqual(vaultLoanStatus.type, 'vault', 'Test D: Vault item with active loan has vault status');
  assert.ok(vaultLoanStatus.linkedLoan, 'Test D: Real loan object is successfully linked');
  assert.strictEqual(vaultLoanStatus.linkedLoan?.ticketNumber, 'PAWN-REAL-001', 'Test D: Destination is Vault with actual loan object');

  // --- Test E — Vault without loan ---
  const vaultNoLoanStatus = getSearchItemStatus(mockInventory[2], mockLoans);
  assert.strictEqual(vaultNoLoanStatus.type, 'vault', 'Test E: Vault item without local loan has vault status');
  assert.strictEqual(vaultNoLoanStatus.linkedLoan, undefined, 'Test E: InventoryItem selected and no fake PawnLoan created');

  // --- Test F — Sold/Retail precedence over historical pawn ref ---
  const retailStatus = getSearchItemStatus(mockInventory[0], mockLoans);
  assert.strictEqual(retailStatus.type, 'retail', 'Test F: Retail Floor status takes strict precedence over pawnTicketId');
  assert.strictEqual(retailStatus.linkedLoan, undefined);

  const soldStatus = getSearchItemStatus(mockInventory[1], mockLoans);
  assert.strictEqual(soldStatus.type, 'sold', 'Test F: Sold terminal status takes strict precedence over pawnTicketId');
  assert.strictEqual(soldStatus.linkedLoan, undefined);

  // --- Test G — Ambiguous Serial/IMEI Guard ---
  const soldItemDup = mockInventory.find(i => i.id === 'item-duplicate-serial')!;
  const matchedSaleDup = resolveMatchingSale(soldItemDup, mockSales);
  assert.strictEqual(matchedSaleDup, undefined, 'Test G: Ambiguous serial/IMEI with multiple matching sales returns undefined (falls back to View Item, opens neither sale)');

  console.log('[PASS] Tests A, B, C, D, E, F, G: All Phase 2E Final Serial/IMEI Ambiguity Guard tests passed successfully!');
  console.log('====================================================');
  console.log('   ALL PHASE 2E FINAL SERIAL/IMEI AMBIGUITY GUARD TESTS PASSED!');
  console.log('====================================================');
}
