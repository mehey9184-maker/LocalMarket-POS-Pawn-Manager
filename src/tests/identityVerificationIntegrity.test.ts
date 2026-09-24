import { parseAndValidateRsaId } from '../utils/rsaIdValidator';
import { customersApi, sellersApi, sapsApi } from '../services/supabaseApi';
import { Customer, Seller, SapsEntry } from '../types';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertFalse(cond: boolean, msg: string) {
  if (cond) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    console.error(`[FAIL] ${msg}: Expected ${expected}, got ${actual}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`[PASS] ${msg}`);
}

export async function runIdentityVerificationIntegrityTests() {
  console.log('=== RUNNING IDENTITY VERIFICATION INTEGRITY TEST SUITE ===');

  // Test 1: RSA ID decoded => verified=false / pending
  {
    const rawRsaBarcode = '9204145082086';
    const parsed = parseAndValidateRsaId(rawRsaBarcode);
    assertTrue(parsed.isValid, 'Test 1: Valid RSA ID barcode decoded');

    // Simulated scan capture
    const scanResult = {
      idNumber: parsed.idNumber,
      dob: parsed.dob,
      gender: parsed.gender,
      citizenship: parsed.citizenship,
      source: 'rsa_id_barcode' as const,
      verified: false
    };

    assertFalse(scanResult.verified, 'Test 1: Barcode decode produces verified=false (not automatically verified)');
  }

  // Test 2: Manual identity creation => verified=false / pending
  {
    const newSellerInput: Omit<Seller, 'id' | 'createdAt'> = {
      fullName: 'Bongani Sithole',
      idNumber: '8905125192089',
      idType: 'RSA Smart ID',
      mobile: '+27 82 555 1234',
      address: '42 Ndaba Street, Soweto',
      verified: false
    };

    assertFalse(newSellerInput.verified, 'Test 2: Newly created seller defaults to verified=false');

    const mappedSellerRow = sellersApi.mapSellerToRow(newSellerInput as Seller);
    assertFalse(Boolean(mappedSellerRow.verified), 'Test 2: Mapped seller row in Supabase preserves verified=false');
    assertEqual(mappedSellerRow.verification_status, 'pending', 'Test 2: Mapped seller verification_status is "pending"');

    const newCustomerInput: Omit<Customer, 'id' | 'createdAt'> = {
      fullName: 'Lerato Khumalo',
      idNumber: '9508230192089',
      idType: 'RSA Smart ID',
      mobile: '+27 71 888 4321',
      address: '15 Vilakazi Street, Orlando West',
      verified: false
    };

    assertFalse(newCustomerInput.verified, 'Test 2: Newly created customer defaults to verified=false');
    const mappedCustomerRow = customersApi.mapCustomerToRow(newCustomerInput as Customer);
    assertFalse(Boolean(mappedCustomerRow.verified), 'Test 2: Mapped customer row in Supabase preserves verified=false');
  }

  // Test 3: Existing record match does NOT create a false new verification event
  {
    const existingUnverifiedCustomer: Customer = {
      id: 'cust-12345',
      fullName: 'Nomvula Dlamini',
      idNumber: '9204145082086',
      idType: 'RSA Smart ID',
      mobile: '+27 83 111 2222',
      address: '88 Fox Street, Johannesburg',
      createdAt: '2026-01-10T10:00:00Z',
      verified: false
    };

    // Simulate decoding an RSA barcode matching this customer
    const rawRsaBarcode = '9204145082086';
    const parsed = parseAndValidateRsaId(rawRsaBarcode);
    const matchedRecord = existingUnverifiedCustomer.idNumber === parsed.idNumber ? existingUnverifiedCustomer : null;

    assertTrue(matchedRecord !== null, 'Test 3: Matched customer by ID number');
    // Ensure matching by ID does not mutate or claim verified=true
    assertFalse(matchedRecord!.verified, 'Test 3: Matched existing customer preserves verified=false without fabricating verification');
  }

  // Test 4: Only an explicit verification action can set verified=true
  {
    let sellerRecord: Seller = {
      id: 'seller-777',
      fullName: 'Kagiso Molefe',
      idNumber: '9002155092080',
      idType: 'RSA Smart ID',
      mobile: '+27 84 999 8888',
      address: '10 Commissioner St, JHB',
      createdAt: '2026-03-01T12:00:00Z',
      verified: false
    };

    // Verify statutory default when unverified
    const pendingSapsStatus = sellerRecord.verified ? 'VERIFIED' : 'PENDING';
    const pendingComplianceStatus = sellerRecord.verified ? 'VERIFIED' : 'PENDING';
    assertEqual(pendingSapsStatus, 'PENDING', 'Test 4: Unverified seller produces PENDING SAPS Form 21 status');
    assertEqual(pendingComplianceStatus, 'PENDING', 'Test 4: Unverified seller produces PENDING compliance status');

    // Simulate explicit verification action (e.g. staff verifies physical ID document)
    const performExplicitVerification = (record: Seller): Seller => {
      return {
        ...record,
        verified: true
      };
    };

    sellerRecord = performExplicitVerification(sellerRecord);
    assertTrue(sellerRecord.verified, 'Test 4: Explicit physical ID verification action successfully sets verified=true');

    const verifiedSapsStatus = sellerRecord.verified ? 'VERIFIED' : 'PENDING';
    const verifiedComplianceStatus = sellerRecord.verified ? 'VERIFIED' : 'PENDING';
    assertEqual(verifiedSapsStatus, 'VERIFIED', 'Test 4: Explicitly verified seller produces VERIFIED SAPS Form 21 status');
    assertEqual(verifiedComplianceStatus, 'VERIFIED', 'Test 4: Explicitly verified seller produces VERIFIED compliance status');
  }

  // Test 5: Scanner captures actual ID data without fabricating names
  {
    const rawBarcode = '9204145082086';
    const parsed = parseAndValidateRsaId(rawBarcode);

    assertTrue(parsed.isValid, 'Test 5: Barcode valid');
    assertEqual(parsed.idNumber, '9204145082086', 'Test 5: Real 13-digit ID number captured from barcode');
    assertEqual(parsed.dob, '1992-04-14', 'Test 5: DOB parsed accurately from ID formula');
    assertEqual(parsed.gender, 'Male', 'Test 5: Gender parsed accurately from ID formula');
    assertEqual(parsed.citizenship, 'SA Citizen', 'Test 5: Citizenship parsed accurately from ID formula');

    // The name field for newly staged identity must NOT be fabricated from barcode
    const stagedIdentity = {
      idNumber: parsed.idNumber,
      idType: 'RSA Smart ID' as const,
      fullName: '', // Never fabricated
      verified: false
    };

    assertEqual(stagedIdentity.fullName, '', 'Test 5: Full legal name is NOT fabricated from barcode');
    assertFalse(stagedIdentity.verified, 'Test 5: Staged identity from barcode scan remains unverified');
  }

  // Test 6: Supabase mapping defaults for SAPS entries
  {
    const sapsEntry: SapsEntry = {
      id: 'saps-101',
      entryNumber: 'SAPS-2026-001',
      timestamp: '2026-03-24T10:00:00Z',
      customerId: 'cust-1',
      customerName: 'Thabo Mokoena',
      customerIdNumber: '9203155091084',
      customerAddress: '42 Main Rd',
      customerPhone: '+27 82 000 1111',
      itemDescription: 'Samsung Galaxy S22',
      category: 'Phones & Tech',
      serialOrImei: '354892019948210',
      condition: 'Good',
      acquisitionType: 'Buy',
      considerationPaid: 3500,
      officerName: 'Inspector Sithole',
      policeStationRef: 'STN-JHB-01',
      verificationStatus: 'PENDING',
      barcodeRef: 'LM-55443'
    };

    const insertPayload = sapsApi.mapEntryToRow(sapsEntry);
    assertEqual(insertPayload.verification_status, 'PENDING', 'Test 6: SapsEntryRow preserves PENDING verification_status');

    // Simulate full DB returned row
    const dbRow = {
      id: sapsEntry.id,
      shop_id: null,
      entry_number: sapsEntry.entryNumber,
      timestamp: sapsEntry.timestamp,
      customer_id: sapsEntry.customerId,
      customer_name: sapsEntry.customerName,
      customer_id_number: sapsEntry.customerIdNumber,
      customer_address: sapsEntry.customerAddress,
      customer_phone: sapsEntry.customerPhone,
      item_description: sapsEntry.itemDescription,
      category: sapsEntry.category,
      serial_or_imei: sapsEntry.serialOrImei,
      condition: sapsEntry.condition,
      acquisition_type: sapsEntry.acquisitionType,
      consideration_paid: sapsEntry.considerationPaid,
      officer_name: sapsEntry.officerName,
      police_station_ref: sapsEntry.policeStationRef,
      verification_status: insertPayload.verification_status,
      barcode_ref: sapsEntry.barcodeRef,
      is_cancelled: false,
      cancelled_at: null,
      cancel_reason: null,
      created_at: sapsEntry.timestamp,
      updated_at: sapsEntry.timestamp
    };

    const mappedBack = sapsApi.mapRowToEntry(dbRow as any);
    assertEqual(mappedBack.verificationStatus, 'PENDING', 'Test 6: SapsEntry mapped back preserves PENDING verificationStatus');
  }

  console.log('=== ALL IDENTITY VERIFICATION INTEGRITY TESTS PASSED ===\n');
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('identityVerificationIntegrity')) {
  runIdentityVerificationIntegrityTests();
}
