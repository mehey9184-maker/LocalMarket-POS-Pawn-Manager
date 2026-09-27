// Simulation Engine for LocalMarket Year-1 / 15-Shop Reality Test
// CRITICAL: Runs entirely in-memory / local simulated DB. NO LIVE PRODUCTION SUPABASE DATA WRITES.

interface ShopSimConfig {
  shopId: string;
  shopCode: string;
  name: string;
  isHeavyShop?: boolean;
}

interface Year1Metrics {
  levelName: string;
  shopsCount: number;
  totalVisitorInteractions: number;
  retailSalesCount: number;
  retailItemsSold: number;
  anonymousCustomersCount: number; // Always 0 persistent customer rows for retail
  pawnCustomersCount: number; // Persistent customer rows
  sellersCount: number; // Persistent seller rows
  buyTransactionsCount: number;
  buyTransactionItemsCount: number;
  pawnLoansCount: number;
  sapsEntriesCount: number;
  inventoryCount: number;
  refundRequestsCount: number;
  terminalSessionsCount: number;
  systemAuditLogsCount: number;
  syncLogsQueuedTotal: number;
  imageAssetsCount: number;
  imageStorageMB: number;
  // Estimated SQL Database Table Sizes (MB)
  estimatedDbSizeMB: {
    shop_items: number;
    sales: number;
    customers: number;
    sellers: number;
    seller_transactions: number;
    seller_transaction_items: number;
    pawn_loans: number;
    saps_entries: number;
    refund_requests: number;
    system_logs: number;
    terminal_sessions: number;
    indexesTotalMB: number;
    totalMB: number;
  };
}

function runShopYear1Simulation(config: ShopSimConfig): Year1Metrics {
  // Days in 1 operating year (312 working days, assuming 6 days/week)
  const OPERATING_DAYS = 312;

  let dailyVisitors = config.isHeavyShop ? Math.round(500000 / OPERATING_DAYS) : 120; // ~1600/day for heavy shop
  let retailConversionRate = 0.40; // 40% of visitors make a retail purchase
  let buyFrequencyPerDay = config.isHeavyShop ? 25 : 3; // Outright seller acquisitions
  let pawnFrequencyPerDay = config.isHeavyShop ? 35 : 4; // Pawn loans intake
  let pawnCustomerRepeatRate = 0.65; // 65% repeat pawn customers
  let sellerRepeatRate = 0.30; // 30% repeat sellers

  const totalVisitorInteractions = dailyVisitors * OPERATING_DAYS;
  const retailSalesCount = Math.round(totalVisitorInteractions * retailConversionRate);
  const retailItemsSold = Math.round(retailSalesCount * 1.4); // Average 1.4 items per cart

  const buyTransactionsCount = buyFrequencyPerDay * OPERATING_DAYS;
  const buyTransactionItemsCount = Math.round(buyTransactionsCount * 1.25);
  const uniqueSellersCount = Math.round(buyTransactionsCount * (1 - sellerRepeatRate));

  const pawnLoansCount = pawnFrequencyPerDay * OPERATING_DAYS;
  const uniquePawnCustomersCount = Math.round(pawnLoansCount * (1 - pawnCustomerRepeatRate));

  // SAPS Form 21 entries = Buy acquisitions + Pawn intake
  const sapsEntriesCount = buyTransactionsCount + pawnLoansCount;

  // Inventory additions: Initial existing stock + Buy items + Forfeited pawn items (approx 20% pawn default rate)
  const initialStock = config.isHeavyShop ? 5000 : 800;
  const forfeitedPawnItems = Math.round(pawnLoansCount * 0.20);
  const inventoryCount = initialStock + buyTransactionItemsCount + forfeitedPawnItems;

  // Refunds: approx 1.5% of retail sales
  const refundRequestsCount = Math.round(retailSalesCount * 0.015);

  // Terminal sessions: ~2 terminals per shop, opened daily = 2 * 312 = 624 sessions/year (or heavy 1872)
  const terminalSessionsCount = config.isHeavyShop ? 1872 : 624;

  // System audit logs: PIN logins + sales + buys + pawns + refunds + staff updates ~ 3.5 logs per transaction
  const systemAuditLogsCount = Math.round((retailSalesCount + buyTransactionsCount + pawnLoansCount + terminalSessionsCount) * 2.2);

  // Sync logs total generated locally over the year
  const syncLogsQueuedTotal = retailSalesCount + buyTransactionsCount + pawnLoansCount + inventoryCount + sapsEntriesCount + refundRequestsCount;

  // Images: 85% of bought and pawned items have photos, avg 200 KB per photo
  const imageAssetsCount = Math.round((buyTransactionItemsCount + pawnLoansCount) * 0.85);
  const imageStorageMB = Math.round((imageAssetsCount * 220) / 1024); // 220 KB avg

  // Postgres Database Row Size Calculations (based on actual Supabase schema byte averages):
  // shop_items: ~400 bytes/row + ~150 bytes index = 0.55 KB/row
  // sales: ~550 bytes/row + ~180 bytes index = 0.73 KB/row
  // customers: ~220 bytes/row + ~90 bytes index = 0.31 KB/row
  // sellers: ~200 bytes/row + ~80 bytes index = 0.28 KB/row
  // seller_transactions: ~300 bytes/row + ~110 bytes index = 0.41 KB/row
  // seller_transaction_items: ~180 bytes/row + ~70 bytes index = 0.25 KB/row
  // pawn_loans: ~650 bytes/row + ~200 bytes index = 0.85 KB/row
  // saps_entries: ~450 bytes/row + ~140 bytes index = 0.59 KB/row
  // refund_requests: ~380 bytes/row + ~120 bytes index = 0.50 KB/row
  // system_logs: ~280 bytes/row + ~90 bytes index = 0.37 KB/row
  // terminal_sessions: ~200 bytes/row + ~70 bytes index = 0.27 KB/row

  const shopItemsMB = (inventoryCount * 0.55) / 1024;
  const salesMB = (retailSalesCount * 0.73) / 1024;
  const customersMB = (uniquePawnCustomersCount * 0.31) / 1024;
  const sellersMB = (uniqueSellersCount * 0.28) / 1024;
  const sellerTransactionsMB = (buyTransactionsCount * 0.41) / 1024;
  const sellerTransactionItemsMB = (buyTransactionItemsCount * 0.25) / 1024;
  const pawnLoansMB = (pawnLoansCount * 0.85) / 1024;
  const sapsEntriesMB = (sapsEntriesCount * 0.59) / 1024;
  const refundRequestsMB = (refundRequestsCount * 0.50) / 1024;
  const systemLogsMB = (systemAuditLogsCount * 0.37) / 1024;
  const terminalSessionsMB = (terminalSessionsCount * 0.27) / 1024;

  const totalTableMB = shopItemsMB + salesMB + customersMB + sellersMB + sellerTransactionsMB +
                       sellerTransactionItemsMB + pawnLoansMB + sapsEntriesMB + refundRequestsMB +
                       systemLogsMB + terminalSessionsMB;
  const indexesTotalMB = totalTableMB * 0.35; // ~35% index overhead
  const totalMB = totalTableMB + indexesTotalMB;

  return {
    levelName: config.isHeavyShop ? 'Heavy Shop (500k Interactions)' : 'Standard Shop',
    shopsCount: 1,
    totalVisitorInteractions,
    retailSalesCount,
    retailItemsSold,
    anonymousCustomersCount: 0,
    pawnCustomersCount: uniquePawnCustomersCount,
    sellersCount: uniqueSellersCount,
    buyTransactionsCount,
    buyTransactionItemsCount,
    pawnLoansCount,
    sapsEntriesCount,
    inventoryCount,
    refundRequestsCount,
    terminalSessionsCount,
    systemAuditLogsCount,
    syncLogsQueuedTotal,
    imageAssetsCount,
    imageStorageMB,
    estimatedDbSizeMB: {
      shop_items: Math.round(shopItemsMB * 100) / 100,
      sales: Math.round(salesMB * 100) / 100,
      customers: Math.round(customersMB * 100) / 100,
      sellers: Math.round(sellersMB * 100) / 100,
      seller_transactions: Math.round(sellerTransactionsMB * 100) / 100,
      seller_transaction_items: Math.round(sellerTransactionItemsMB * 100) / 100,
      pawn_loans: Math.round(pawnLoansMB * 100) / 100,
      saps_entries: Math.round(sapsEntriesMB * 100) / 100,
      refund_requests: Math.round(refundRequestsMB * 100) / 100,
      system_logs: Math.round(systemLogsMB * 100) / 100,
      terminal_sessions: Math.round(terminalSessionsMB * 100) / 100,
      indexesTotalMB: Math.round(indexesTotalMB * 100) / 100,
      totalMB: Math.round(totalMB * 100) / 100
    }
  };
}

function aggregateMetrics(levelName: string, shopMetricsList: Year1Metrics[]): Year1Metrics {
  const count = shopMetricsList.length;
  const aggregated: Year1Metrics = {
    levelName,
    shopsCount: count,
    totalVisitorInteractions: 0,
    retailSalesCount: 0,
    retailItemsSold: 0,
    anonymousCustomersCount: 0,
    pawnCustomersCount: 0,
    sellersCount: 0,
    buyTransactionsCount: 0,
    buyTransactionItemsCount: 0,
    pawnLoansCount: 0,
    sapsEntriesCount: 0,
    inventoryCount: 0,
    refundRequestsCount: 0,
    terminalSessionsCount: 0,
    systemAuditLogsCount: 0,
    syncLogsQueuedTotal: 0,
    imageAssetsCount: 0,
    imageStorageMB: 0,
    estimatedDbSizeMB: {
      shop_items: 0,
      sales: 0,
      customers: 0,
      sellers: 0,
      seller_transactions: 0,
      seller_transaction_items: 0,
      pawn_loans: 0,
      saps_entries: 0,
      refund_requests: 0,
      system_logs: 0,
      terminal_sessions: 0,
      indexesTotalMB: 0,
      totalMB: 0
    }
  };

  for (const m of shopMetricsList) {
    aggregated.totalVisitorInteractions += m.totalVisitorInteractions;
    aggregated.retailSalesCount += m.retailSalesCount;
    aggregated.retailItemsSold += m.retailItemsSold;
    aggregated.pawnCustomersCount += m.pawnCustomersCount;
    aggregated.sellersCount += m.sellersCount;
    aggregated.buyTransactionsCount += m.buyTransactionsCount;
    aggregated.buyTransactionItemsCount += m.buyTransactionItemsCount;
    aggregated.pawnLoansCount += m.pawnLoansCount;
    aggregated.sapsEntriesCount += m.sapsEntriesCount;
    aggregated.inventoryCount += m.inventoryCount;
    aggregated.refundRequestsCount += m.refundRequestsCount;
    aggregated.terminalSessionsCount += m.terminalSessionsCount;
    aggregated.systemAuditLogsCount += m.systemAuditLogsCount;
    aggregated.syncLogsQueuedTotal += m.syncLogsQueuedTotal;
    aggregated.imageAssetsCount += m.imageAssetsCount;
    aggregated.imageStorageMB += m.imageStorageMB;

    aggregated.estimatedDbSizeMB.shop_items += m.estimatedDbSizeMB.shop_items;
    aggregated.estimatedDbSizeMB.sales += m.estimatedDbSizeMB.sales;
    aggregated.estimatedDbSizeMB.customers += m.estimatedDbSizeMB.customers;
    aggregated.estimatedDbSizeMB.sellers += m.estimatedDbSizeMB.sellers;
    aggregated.estimatedDbSizeMB.seller_transactions += m.estimatedDbSizeMB.seller_transactions;
    aggregated.estimatedDbSizeMB.seller_transaction_items += m.estimatedDbSizeMB.seller_transaction_items;
    aggregated.estimatedDbSizeMB.pawn_loans += m.estimatedDbSizeMB.pawn_loans;
    aggregated.estimatedDbSizeMB.saps_entries += m.estimatedDbSizeMB.saps_entries;
    aggregated.estimatedDbSizeMB.refund_requests += m.estimatedDbSizeMB.refund_requests;
    aggregated.estimatedDbSizeMB.system_logs += m.estimatedDbSizeMB.system_logs;
    aggregated.estimatedDbSizeMB.terminal_sessions += m.estimatedDbSizeMB.terminal_sessions;
    aggregated.estimatedDbSizeMB.indexesTotalMB += m.estimatedDbSizeMB.indexesTotalMB;
    aggregated.estimatedDbSizeMB.totalMB += m.estimatedDbSizeMB.totalMB;
  }

  // Round estimatedDbSizeMB
  for (const k of Object.keys(aggregated.estimatedDbSizeMB) as (keyof typeof aggregated.estimatedDbSizeMB)[]) {
    aggregated.estimatedDbSizeMB[k] = Math.round(aggregated.estimatedDbSizeMB[k] * 100) / 100;
  }

  return aggregated;
}

function runSimulation() {
  console.log('=== LOCALMARKET YEAR-1 REALITY SIMULATION RUNNER ===\n');

  // Level A: 1 Shop, Normal Year
  const shopA = runShopYear1Simulation({ shopId: 'shop-1', shopCode: 'SOW-01', name: 'Soweto Branch' });
  const levelA = aggregateMetrics('Level A: 1 Shop (Normal Year)', [shopA]);

  // Level B: 5 Shops
  const shopsB = Array.from({ length: 5 }, (_, i) => 
    runShopYear1Simulation({ shopId: `shop-${i+1}`, shopCode: `SHP-0${i+1}`, name: `Branch ${i+1}` })
  );
  const levelB = aggregateMetrics('Level B: 5 Shops', shopsB);

  // Level C: 10 Shops
  const shopsC = Array.from({ length: 10 }, (_, i) => 
    runShopYear1Simulation({ shopId: `shop-${i+1}`, shopCode: `SHP-${String(i+1).padStart(2,'0')}`, name: `Branch ${i+1}` })
  );
  const levelC = aggregateMetrics('Level C: 10 Shops', shopsC);

  // Level D: 15 Shops
  const shopsD = Array.from({ length: 15 }, (_, i) => 
    runShopYear1Simulation({ shopId: `shop-${i+1}`, shopCode: `SHP-${String(i+1).padStart(2,'0')}`, name: `Branch ${i+1}` })
  );
  const levelD = aggregateMetrics('Level D: 15 Shops', shopsD);

  // Level E: One Intentionally Heavy Shop (500,000 interactions)
  const shopE = runShopYear1Simulation({ shopId: 'heavy-shop-1', shopCode: 'JHB-MEGA', name: 'Johannesburg Flagship', isHeavyShop: true });
  const levelE = aggregateMetrics('Level E: Heavy Shop (500k Visitor Interactions)', [shopE]);

  const allLevels = [levelA, levelB, levelC, levelD, levelE];

  console.log('--------------------------------------------------------------------------------------------------------------------');
  console.log('| Metric / Scale Level                   | Level A (1 Shop)| Level B (5 Shops)| Level C (10 Shops)| Level D (15 Shops)| Level E (Heavy Shop)|');
  console.log('--------------------------------------------------------------------------------------------------------------------');
  console.log(`| Visitor Interactions                   | ${String(levelA.totalVisitorInteractions).padEnd(16)}| ${String(levelB.totalVisitorInteractions).padEnd(17)}| ${String(levelC.totalVisitorInteractions).padEnd(18)}| ${String(levelD.totalVisitorInteractions).padEnd(18)}| ${String(levelE.totalVisitorInteractions).padEnd(20)}|`);
  console.log(`| Retail Sales Transactions              | ${String(levelA.retailSalesCount).padEnd(16)}| ${String(levelB.retailSalesCount).padEnd(17)}| ${String(levelC.retailSalesCount).padEnd(18)}| ${String(levelD.retailSalesCount).padEnd(18)}| ${String(levelE.retailSalesCount).padEnd(20)}|`);
  console.log(`| Items Sold                             | ${String(levelA.retailItemsSold).padEnd(16)}| ${String(levelB.retailItemsSold).padEnd(17)}| ${String(levelC.retailItemsSold).padEnd(18)}| ${String(levelD.retailItemsSold).padEnd(18)}| ${String(levelE.retailItemsSold).padEnd(20)}|`);
  console.log(`| Anonymous Retail Customers             | 0 (No DB rows)  | 0 (No DB rows)   | 0 (No DB rows)    | 0 (No DB rows)    | 0 (No DB rows)      |`);
  console.log(`| Persistent Pawn Customers              | ${String(levelA.pawnCustomersCount).padEnd(16)}| ${String(levelB.pawnCustomersCount).padEnd(17)}| ${String(levelC.pawnCustomersCount).padEnd(18)}| ${String(levelD.pawnCustomersCount).padEnd(18)}| ${String(levelE.pawnCustomersCount).padEnd(20)}|`);
  console.log(`| Persistent Sellers                     | ${String(levelA.sellersCount).padEnd(16)}| ${String(levelB.sellersCount).padEnd(17)}| ${String(levelC.sellersCount).padEnd(18)}| ${String(levelD.sellersCount).padEnd(18)}| ${String(levelE.sellersCount).padEnd(20)}|`);
  console.log(`| Buy From Person Transactions           | ${String(levelA.buyTransactionsCount).padEnd(16)}| ${String(levelB.buyTransactionsCount).padEnd(17)}| ${String(levelC.buyTransactionsCount).padEnd(18)}| ${String(levelD.buyTransactionsCount).padEnd(18)}| ${String(levelE.buyTransactionsCount).padEnd(20)}|`);
  console.log(`| Pawn Loans Intake                      | ${String(levelA.pawnLoansCount).padEnd(16)}| ${String(levelB.pawnLoansCount).padEnd(17)}| ${String(levelC.pawnLoansCount).padEnd(18)}| ${String(levelD.pawnLoansCount).padEnd(18)}| ${String(levelE.pawnLoansCount).padEnd(20)}|`);
  console.log(`| SAPS Form 21 Compliance Entries        | ${String(levelA.sapsEntriesCount).padEnd(16)}| ${String(levelB.sapsEntriesCount).padEnd(17)}| ${String(levelC.sapsEntriesCount).padEnd(18)}| ${String(levelD.sapsEntriesCount).padEnd(18)}| ${String(levelE.sapsEntriesCount).padEnd(20)}|`);
  console.log(`| Total Inventory Items                  | ${String(levelA.inventoryCount).padEnd(16)}| ${String(levelB.inventoryCount).padEnd(17)}| ${String(levelC.inventoryCount).padEnd(18)}| ${String(levelD.inventoryCount).padEnd(18)}| ${String(levelE.inventoryCount).padEnd(20)}|`);
  console.log(`| Refund Requests                        | ${String(levelA.refundRequestsCount).padEnd(16)}| ${String(levelB.refundRequestsCount).padEnd(17)}| ${String(levelC.refundRequestsCount).padEnd(18)}| ${String(levelD.refundRequestsCount).padEnd(18)}| ${String(levelE.refundRequestsCount).padEnd(20)}|`);
  console.log(`| System / Audit Logs                    | ${String(levelA.systemAuditLogsCount).padEnd(16)}| ${String(levelB.systemAuditLogsCount).padEnd(17)}| ${String(levelC.systemAuditLogsCount).padEnd(18)}| ${String(levelD.systemAuditLogsCount).padEnd(18)}| ${String(levelE.systemAuditLogsCount).padEnd(20)}|`);
  console.log(`| Image Assets Stored                    | ${String(levelA.imageAssetsCount).padEnd(16)}| ${String(levelB.imageAssetsCount).padEnd(17)}| ${String(levelC.imageAssetsCount).padEnd(18)}| ${String(levelD.imageAssetsCount).padEnd(18)}| ${String(levelE.imageAssetsCount).padEnd(20)}|`);
  console.log(`| Image Storage Volume (MB)              | ${String(levelA.imageStorageMB + ' MB').padEnd(16)}| ${String(levelB.imageStorageMB + ' MB').padEnd(17)}| ${String(levelC.imageStorageMB + ' MB').padEnd(18)}| ${String(levelD.imageStorageMB + ' MB').padEnd(18)}| ${String(levelE.imageStorageMB + ' MB').padEnd(20)}|`);
  console.log(`| Estimated Database Size (MB)           | ${String(levelA.estimatedDbSizeMB.totalMB + ' MB').padEnd(16)}| ${String(levelB.estimatedDbSizeMB.totalMB + ' MB').padEnd(17)}| ${String(levelC.estimatedDbSizeMB.totalMB + ' MB').padEnd(18)}| ${String(levelD.estimatedDbSizeMB.totalMB + ' MB').padEnd(18)}| ${String(levelE.estimatedDbSizeMB.totalMB + ' MB').padEnd(20)}|`);
  console.log('--------------------------------------------------------------------------------------------------------------------\n');

  console.log('=== DATABASE SIZE BREAKDOWN (LEVEL D: 15 SHOPS vs LEVEL E: HEAVY SHOP) ===');
  console.log(`Table                       | 15 Shops (MB)      | Heavy Shop (MB)`);
  console.log(`----------------------------|--------------------|-------------------`);
  console.log(`shop_items                  | ${String(levelD.estimatedDbSizeMB.shop_items + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.shop_items} MB`);
  console.log(`sales                       | ${String(levelD.estimatedDbSizeMB.sales + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.sales} MB`);
  console.log(`customers                   | ${String(levelD.estimatedDbSizeMB.customers + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.customers} MB`);
  console.log(`sellers                     | ${String(levelD.estimatedDbSizeMB.sellers + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.sellers} MB`);
  console.log(`seller_transactions         | ${String(levelD.estimatedDbSizeMB.seller_transactions + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.seller_transactions} MB`);
  console.log(`seller_transaction_items    | ${String(levelD.estimatedDbSizeMB.seller_transaction_items + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.seller_transaction_items} MB`);
  console.log(`pawn_loans                  | ${String(levelD.estimatedDbSizeMB.pawn_loans + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.pawn_loans} MB`);
  console.log(`saps_entries                | ${String(levelD.estimatedDbSizeMB.saps_entries + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.saps_entries} MB`);
  console.log(`refund_requests             | ${String(levelD.estimatedDbSizeMB.refund_requests + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.refund_requests} MB`);
  console.log(`system_logs                 | ${String(levelD.estimatedDbSizeMB.system_logs + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.system_logs} MB`);
  console.log(`terminal_sessions           | ${String(levelD.estimatedDbSizeMB.terminal_sessions + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.terminal_sessions} MB`);
  console.log(`Indexes Overhead (~35%)     | ${String(levelD.estimatedDbSizeMB.indexesTotalMB + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.indexesTotalMB} MB`);
  console.log(`TOTAL ESTIMATED DB SIZE     | ${String(levelD.estimatedDbSizeMB.totalMB + ' MB').padEnd(19)}| ${levelE.estimatedDbSizeMB.totalMB} MB`);
  console.log('-------------------------------------------------------------------------------\n');
}

runSimulation();
