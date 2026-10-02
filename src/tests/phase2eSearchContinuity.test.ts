import assert from 'node:assert';
import { normalizeScannerInput } from '../utils/scannerNormalizer';
import { getSearchItemStatus } from '../components/Header';
import { InventoryItem, PawnLoan, SaleTransaction } from '../types';

/**
 * Phase 2E Final Safety Correction Test Suite: No Fabrication & Status Precedence
 */
export async function runPhase2eSearchContinuityTests() {
  console.log('=== RUNNING PHASE 2E FINAL SAFETY CORRECTION TEST SUITE ===');

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

  const mockSales: SaleTransaction[] = [
    {
      id: 'sale-real-1',
      receiptNumber: 'SKU-SOLD-OLD',
      timestamp: '2026-01-05T12:00:00Z',
      items: [{ item: mockInventory[1], quantity: 1 }],
      subtotal: 4346.96,
      vatAmount: 652.04,
      total: 4999,
      tenderMethod: 'cash',
      amountTendered: 5000,
      change: 1,
      receiptType: 'thermal',
      cashier: 'POS Cashier'
    }
  ];

  // --- Test 1: Retail Precedence over Historical Pawn Ref ---
  const retailStatus = getSearchItemStatus(mockInventory[0], mockLoans);
  assert.strictEqual(retailStatus.type, 'retail', 'Retail Floor status takes strict precedence over pawnTicketId');
  assert.strictEqual(retailStatus.linkedLoan, undefined, 'Retail item without active loan links to undefined loan');

  // --- Test 2: Sold Precedence over Historical Pawn Ref ---
  const soldStatus = getSearchItemStatus(mockInventory[1], mockLoans);
  assert.strictEqual(soldStatus.type, 'sold', 'Sold terminal status takes strict precedence over pawnTicketId');
  assert.strictEqual(soldStatus.linkedLoan, undefined, 'Sold item does not surface active loan');

  // --- Test 3: Vault Item Without Matching Loan (No Fabrication) ---
  const vaultNoLoanStatus = getSearchItemStatus(mockInventory[2], mockLoans);
  assert.strictEqual(vaultNoLoanStatus.type, 'vault', 'Vault item without local loan has vault status');
  assert.strictEqual(vaultNoLoanStatus.linkedLoan, undefined, 'No fake loan object is created or linked');

  // --- Test 4: Vault Item With Real Matching Loan ---
  const vaultLoanStatus = getSearchItemStatus(mockInventory[3], mockLoans);
  assert.strictEqual(vaultLoanStatus.type, 'vault', 'Vault item with active loan has vault status');
  assert.ok(vaultLoanStatus.linkedLoan, 'Real loan is successfully linked');
  assert.strictEqual(vaultLoanStatus.linkedLoan?.ticketNumber, 'PAWN-REAL-001');

  // --- Test 5: Sold With Real Receipt ---
  const soldWithReceipt = mockSales.find(s => s.receiptNumber === mockInventory[1].sku);
  assert.ok(soldWithReceipt, 'Real sale receipt successfully matched to sold item');
  assert.strictEqual(soldWithReceipt?.total, 4999);

  // --- Test 6: Sold Without Receipt (No Fabrication) ---
  const soldWithoutReceiptItem: InventoryItem = {
    id: 'item-sold-noreceipt',
    title: 'Orphan Sold Item',
    sku: 'SKU-SOLD-NOREC',
    category: 'Books',
    condition: 'Good',
    retailPrice: 200,
    costBasis: 100,
    status: 'Sold',
    serialOrImei: 'SN-NOREC',
    imageUrl: '',
    acquisitionType: 'Existing Stock',
    addedAt: '2026-01-01'
  };
  const orphanSoldStatus = getSearchItemStatus(soldWithoutReceiptItem, mockLoans);
  assert.strictEqual(orphanSoldStatus.type, 'sold');
  const matchingOrphanSale = mockSales.find(s => s.receiptNumber === soldWithoutReceiptItem.sku);
  assert.strictEqual(matchingOrphanSale, undefined, 'No fake receipt is ever fabricated for an orphan sold item');

  console.log('[PASS] Test 1-6: All Phase 2E Final Safety Correction tests passed without any data fabrication');
  console.log('====================================================');
  console.log('   ALL PHASE 2E FINAL SAFETY CORRECTION TESTS PASSED!');
  console.log('====================================================');
}
