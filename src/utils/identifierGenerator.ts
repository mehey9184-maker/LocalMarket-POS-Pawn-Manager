/**
 * Identifier Generator Utility
 * 
 * Provides cryptographically secure, collision-checked business identifiers
 * adhering strictly to the store's human-readable format specifications:
 * - SKUs: LM-xxxxx (5-digit random, fallback to LM-xxxxx-HEX with existence validation)
 * - Seller Transactions: ST-xxxxxx (6-digit random, fallback to ST-xxxxxx-HEX with existence validation)
 * - Pawn Tickets: PWN-xxxx (4-digit random, expanding to 5-digit PWN-xxxxx, fallback to PWN-xxxxx-HEX with existence validation)
 * - Receipts: REC-xxxxxx (6-digit cryptographically uniform random with collision checking, NOT sequential)
 * 
 * Collision Safety Guarantee:
 * Every primary and fallback generation path checks the supplied existence callback.
 * An identifier is returned ONLY after it has explicitly passed the collision check.
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
 * Generates random hexadecimal string from cryptographically secure random bytes.
 */
function getHexEntropy(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Generates an Inventory SKU in the standard LM-xxxxx format (5-digit random).
 * If the 5-digit space experiences collisions against existing inventory, falls back
 * to high-entropy suffixed candidates (LM-xxxxx-HEX) while rigorously validating
 * every candidate against the supplied collision check before returning.
 */
export function generateUniqueSku(isExisting?: (sku: string) => boolean): string {
  // Primary attempts: standard 5-digit LM-xxxxx format
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(10000, 99999);
    const sku = `LM-${num}`;
    if (!isExisting || !isExisting(sku)) {
      return sku;
    }
  }

  // Fallback path: append crypto-safe hex entropy, validating each candidate
  let fallbackAttempt = 0;
  while (true) {
    fallbackAttempt++;
    const num = getCryptoRandomInt(10000, 99999);
    const byteLength = fallbackAttempt > 50 ? 4 : 2;
    const hex = getHexEntropy(byteLength);
    const candidate = `LM-${num}-${hex}`;
    if (!isExisting || !isExisting(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generates a Seller Statutory Transaction Number in the standard ST-xxxxxx format (6-digit random).
 * Every candidate generated in primary and fallback paths is validated against the existence check.
 */
export function generateUniqueTransactionNumber(isExisting?: (txNum: string) => boolean): string {
  // Primary attempts: standard 6-digit ST-xxxxxx format
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(100000, 999999);
    const txNum = `ST-${num}`;
    if (!isExisting || !isExisting(txNum)) {
      return txNum;
    }
  }

  // Fallback path: append crypto-safe hex entropy, validating each candidate
  let fallbackAttempt = 0;
  while (true) {
    fallbackAttempt++;
    const num = getCryptoRandomInt(100000, 999999);
    const byteLength = fallbackAttempt > 50 ? 4 : 2;
    const hex = getHexEntropy(byteLength);
    const candidate = `ST-${num}-${hex}`;
    if (!isExisting || !isExisting(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generates a Pawn Ticket Number in the standard PWN-xxxx format (4-digit random).
 * Expands to 5-digit PWN-xxxxx if 4-digit space experiences collisions.
 * In saturated loan databases, falls back to PWN-xxxxx-HEX while rigorously verifying
 * that every candidate passes the collision check before returning.
 */
export function generateUniquePawnTicket(isExisting?: (ticket: string) => boolean): string {
  // Primary attempts: standard 4-digit PWN-xxxx format
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(1000, 9999);
    const ticket = `PWN-${num}`;
    if (!isExisting || !isExisting(ticket)) {
      return ticket;
    }
  }

  // Secondary attempts: dense loan database expansion to 5 digits
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(10000, 99999);
    const ticket = `PWN-${num}`;
    if (!isExisting || !isExisting(ticket)) {
      return ticket;
    }
  }

  // Fallback path: append crypto-safe hex entropy, validating each candidate
  let fallbackAttempt = 0;
  while (true) {
    fallbackAttempt++;
    const num = getCryptoRandomInt(10000, 99999);
    const byteLength = fallbackAttempt > 50 ? 4 : 2;
    const hex = getHexEntropy(byteLength);
    const candidate = `PWN-${num}-${hex}`;
    if (!isExisting || !isExisting(candidate)) {
      return candidate;
    }
  }
}

/**
 * Generates a Point of Sale Receipt Number in the standard REC-xxxxxx format (6-digit random).
 * 
 * Note: Receipt numbers are non-sequential cryptographically uniform random identifiers
 * with collision checking against existing sales records.
 * Every candidate generated in primary and fallback paths is validated against the existence check.
 */
export function generateUniqueReceiptNumber(isExisting?: (receipt: string) => boolean): string {
  // Primary attempts: standard 6-digit REC-xxxxxx format
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = getCryptoRandomInt(100000, 999999);
    const receipt = `REC-${num}`;
    if (!isExisting || !isExisting(receipt)) {
      return receipt;
    }
  }

  // Fallback path: append crypto-safe hex entropy, validating each candidate
  let fallbackAttempt = 0;
  while (true) {
    fallbackAttempt++;
    const num = getCryptoRandomInt(100000, 999999);
    const byteLength = fallbackAttempt > 50 ? 4 : 2;
    const hex = getHexEntropy(byteLength);
    const candidate = `REC-${num}-${hex}`;
    if (!isExisting || !isExisting(candidate)) {
      return candidate;
    }
  }
}
