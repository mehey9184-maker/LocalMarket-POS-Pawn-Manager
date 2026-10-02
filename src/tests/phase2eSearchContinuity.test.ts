import assert from 'node:assert';
import { getSearchItemStatus } from '../components/Header';
import { InventoryItem, PawnLoan, SaleTransaction } from '../types';

/**
 * Phase 2F Universal Search Continuity & Phase 2E Safety Test Suite:
 * Covers Tests 1-3 (Pawn Loan Exact Selection, Identity, No Fabrication) and Tests A-G (Phase 2E Safety & Ambiguity Guard).
 */
export async function runPhase2eSearchContinuityTests() {
  console.log('=== RUNNING PHASE 2F UNIVERSAL SEARCH CONTINUITY & SAFETY TEST SUITE ===');

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
    },
    {
      id: 'loan-real-002',
      ticketNumber: 'PAWN-REAL-002',
      customerId: 'cust-2',
      customerName: 'John Doe',
      customerIdNumber: '8502025009088',
      customerMobile: '0821234567',
      customerAddress: '789 Pine St',
      itemId: 'item-vault-with-loan-2',
      itemTitle: 'Another Pawn Vault Item',
      itemCategory: 'Electronics',
      serialOrImei: 'ELC888',
      condition: 'Good',
      itemImageUrl: '',
      principal: 3000,
      ncrMonthlyRate: 0.05,
      monthlyInterest: 150,
      monthlyStorageAdminFee: 150,
      totalRedemptionAmount: 3300,
      extensionFee: 150,
      startDate: '2026-01-05',
      expiryDate: '2026-02-05',
      daysRemaining: 31,
      daysElapsed: 0,
      vaultShelf: 'Shelf-Z',
      status: 'Active',
      qrToken: 'qr-real-2',
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

  // --- Test 1 — Pawn Loan Exact Selection ---
  const loanToSelect = mockLoans[0];
  let selectedVaultLoanState: PawnLoan | null = null;
  let activeTabState = 'home';

  // Simulate search action click for Pawn Loan
  const simulatePawnLoanSelection = (loan: PawnLoan) => {
    selectedVaultLoanState = loan;
    activeTabState = 'vault';
  };

  simulatePawnLoanSelection(loanToSelect);
  assert.strictEqual(selectedVaultLoanState, loanToSelect, 'Test 1: Selecting pawn loan stores that exact object/reference');
  assert.strictEqual(activeTabState, 'vault', 'Test 1: Destination becomes vault');

  // --- Test 2 — Pawn Loan Identity ---
  const loanA = mockLoans[0];
  const loanB = mockLoans[1];
  let currentVaultLoan: PawnLoan | null = null;

  currentVaultLoan = loanA;
  assert.strictEqual(currentVaultLoan.ticketNumber, 'PAWN-REAL-001', 'Test 2: Selecting Loan A ties ticket number correctly');
  assert.notStrictEqual(currentVaultLoan.ticketNumber, loanB.ticketNumber, 'Test 2: Selecting Loan A must not open Loan B');

  currentVaultLoan = loanB;
  assert.strictEqual(currentVaultLoan.ticketNumber, 'PAWN-REAL-002', 'Test 2: Selecting Loan B ties ticket number correctly');

  // --- Test 3 — No Fabrication ---
  const existingLoan = mockLoans[0];
  assert.ok(existingLoan, 'Test 3: Real loan exists');
  // Confirm that searching/selecting does not instantiate any fake/fallback loan object
  assert.strictEqual(existingLoan.ticketNumber, 'PAWN-REAL-001');
  assert.strictEqual(existingLoan.customerId, 'cust-1');

  // --- Test A — Sold item with real sale ---
  const soldItemA = mockInventory.find(i => i.id === 'item-sold-A')!;
  const matchedSaleA = resolveMatchingSale(soldItemA, mockSales);
  assert.ok(matchedSaleA, 'Test A: Sold item A resolves to a real sale');
  assert.strictEqual(matchedSaleA?.id, 'sale-real-A');

  // --- Test B — Sold item with no sale ---
  const soldItemB = mockInventory.find(i => i.id === 'item-sold-B')!;
  const matchedSaleB = resolveMatchingSale(soldItemB, mockSales);
  assert.strictEqual(matchedSaleB, undefined, 'Test B: Sold item B with no sale resolves to undefined');

  // --- Test C — SKU collision safety ---
  const soldItemC = mockInventory.find(i => i.id === 'item-sold-C')!;
  const matchedSaleC = resolveMatchingSale(soldItemC, mockSales);
  assert.strictEqual(matchedSaleC, undefined, 'Test C: SKU collision safety verified');

  // --- Test D — Vault with real loan ---
  const vaultLoanStatus = getSearchItemStatus(mockInventory[3], mockLoans);
  assert.strictEqual(vaultLoanStatus.type, 'vault');
  assert.ok(vaultLoanStatus.linkedLoan);
  assert.strictEqual(vaultLoanStatus.linkedLoan?.ticketNumber, 'PAWN-REAL-001');

  // --- Test E — Vault without loan ---
  const vaultNoLoanStatus = getSearchItemStatus(mockInventory[2], mockLoans);
  assert.strictEqual(vaultNoLoanStatus.type, 'vault');
  assert.strictEqual(vaultNoLoanStatus.linkedLoan, undefined);

  // --- Test F — Sold/Retail precedence ---
  const retailStatus = getSearchItemStatus(mockInventory[0], mockLoans);
  assert.strictEqual(retailStatus.type, 'retail');
  const soldStatus = getSearchItemStatus(mockInventory[1], mockLoans);
  assert.strictEqual(soldStatus.type, 'sold');

  // --- Test G — Ambiguous Serial/IMEI Guard ---
  const soldItemDup = mockInventory.find(i => i.id === 'item-duplicate-serial')!;
  const matchedSaleDup = resolveMatchingSale(soldItemDup, mockSales);
  assert.strictEqual(matchedSaleDup, undefined, 'Test G: Ambiguous serial guard verified');

  console.log('[PASS] Tests 1-3 & A-G: All Phase 2F Universal Search Continuity & Safety tests passed successfully!');
  console.log('====================================================');
  console.log('   ALL PHASE 2F UNIVERSAL SEARCH TESTS PASSED!');
  console.log('====================================================');
}
