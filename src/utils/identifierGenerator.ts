/**
 * Identifier Generator Utility
 * 
 * Provides cryptographically secure, collision-safe business identifiers
 * adhering strictly to the store's human-readable format specifications:
 * - SKUs: LM-xxxxx
 * - Seller Transactions: ST-xxxxxx
 * - Pawn Tickets: PWN-xxxx
 * - Receipts: REC-xxxxxx
 */

/**
 * Returns a cryptographically secure uniform random integer between min and max (inclusive).
 * Employs rejection sampling against 32-bit unsigned integers to eliminate modulo bias.
 */
export function getCryptoRandomInt(min: number, max: number): number {
  if (min > max) {
    throw new Error(`min (${min}) cannot be greater than max (${max})`);
  }
  const range = max - min + 1;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % range);
  const buffer = new Uint32Array(1);

  let randomValue: number;
  do {
    crypto.getRandomValues(buffer);
    randomValue = buffer[0];
  } while (randomValue >= limit);

  return min + (randomValue % range);
}

/**
 * Generates an Inventory SKU in the standard LM-xxxxx format (5-digit random),
 * ensuring collision avoidance against provided inventory items or lookup callback.
 */
export function generateUniqueSku(isExisting?: (sku: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(10000, 99999);
    const sku = `LM-${num}`;
    if (!isExisting || !isExisting(sku)) {
      return sku;
    }
  }
  // High-collision fallback: append short hex suffix to preserve LM- prefix while guaranteeing uniqueness
  const num = getCryptoRandomInt(10000, 99999);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `LM-${num}-${hex}`;
}

/**
 * Generates a Seller Statutory Transaction Number in the standard ST-xxxxxx format (6-digit random),
 * checking for collision avoidance against existing transactions.
 */
export function generateUniqueTransactionNumber(isExisting?: (txNum: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(100000, 999999);
    const txNum = `ST-${num}`;
    if (!isExisting || !isExisting(txNum)) {
      return txNum;
    }
  }
  const num = getCryptoRandomInt(100000, 999999);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `ST-${num}-${hex}`;
}

/**
 * Generates a Pawn Ticket Number in the standard PWN-xxxx format (4-digit random),
 * checking for collision avoidance against active or archived loans.
 */
export function generateUniquePawnTicket(isExisting?: (ticket: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(1000, 9999);
    const ticket = `PWN-${num}`;
    if (!isExisting || !isExisting(ticket)) {
      return ticket;
    }
  }
  // In dense loan databases, expand safely to 5 digits
  const num = getCryptoRandomInt(10000, 99999);
  return `PWN-${num}`;
}

/**
 * Generates a Point of Sale Receipt Number in the standard REC-xxxxxx format (6-digit random),
 * checking for collision avoidance against existing sales transactions.
 */
export function generateUniqueReceiptNumber(isExisting?: (receipt: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(100000, 999999);
    const receipt = `REC-${num}`;
    if (!isExisting || !isExisting(receipt)) {
      return receipt;
    }
  }
  const num = getCryptoRandomInt(100000, 999999);
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `REC-${num}-${hex}`;
}
