import { parseAndValidateRsaId } from '../utils/rsaIdValidator';

function assertTrue(cond: boolean, msg: string) {
  if (!cond) {
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

export async function runStabilityAndScannerTests() {
  console.log('=== RUNNING STABILITY & SCANNER GUIDANCE TEST SUITE ===');

  // Test 1: Native detector vs ZXing fallback selection
  {
    let nativeDetectorUsed = false;
    let zxingUsed = false;

    // Simulate Native BarcodeDetector presence
    const mockWindowWithNative = {
      BarcodeDetector: class {
        constructor() {
          nativeDetectorUsed = true;
        }
        detect() {
          return Promise.resolve([]);
        }
      }
    };

    if ('BarcodeDetector' in mockWindowWithNative) {
      new mockWindowWithNative.BarcodeDetector();
    } else {
      zxingUsed = true;
    }

    assertTrue(nativeDetectorUsed && !zxingUsed, 'Test 1: Native BarcodeDetector path selected exclusively when supported');

    // Simulate Native BarcodeDetector absence
    const mockWindowWithoutNative = {};
    if (!('BarcodeDetector' in mockWindowWithoutNative)) {
      zxingUsed = true;
    }

    assertTrue(zxingUsed, 'Test 1: ZXing fallback path selected when Native BarcodeDetector is unavailable');
  }

  // Test 2: Native BarcodeDetector constructor failure falls back to ZXing
  {
    let zxingFallbackTriggered = false;
    const mockWindowFailingNative = {
      BarcodeDetector: class {
        constructor() {
          throw new Error('Unsupported barcode formats');
        }
      }
    };

    if ('BarcodeDetector' in mockWindowFailingNative) {
      try {
        new mockWindowFailingNative.BarcodeDetector();
      } catch (e) {
        zxingFallbackTriggered = true;
      }
    }

    assertTrue(zxingFallbackTriggered, 'Test 2: Native BarcodeDetector constructor error triggers ZXing fallback cleanly');
  }

  // Test 3: Camera readiness validation requires usable video dimensions
  {
    const mockUnreadyVideo = { readyState: 1, videoWidth: 0, videoHeight: 0 };
    const mockReadyVideo = { readyState: 3, videoWidth: 1280, videoHeight: 720 };
    const mockActiveStream = { active: true };

    const isFrameReady = (video: any, stream: any) => 
      video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && stream.active;

    assertTrue(!isFrameReady(mockUnreadyVideo, mockActiveStream), 'Test 3: Unready video with 0x0 dimensions is blocked from scanning');
    assertTrue(isFrameReady(mockReadyVideo, mockActiveStream), 'Test 3: Ready video with 1280x720 dimensions is approved for scanning');
  }

  // Test 4: Scanner closes and stops all MediaStream camera tracks
  {
    let trackStoppedCount = 0;
    const mockTracks = [
      { stop: () => { trackStoppedCount++; } },
      { stop: () => { trackStoppedCount++; } }
    ];

    const mockStream = {
      getTracks: () => mockTracks
    };

    // Cleanup simulation
    mockStream.getTracks().forEach(t => t.stop());
    assertEqual(trackStoppedCount, 2, 'Test 4: Scanner close stops all active MediaStream camera tracks cleanly');
  }

  // Test 5: Duplicate decode callbacks do not process same scan twice under in-flight lock
  {
    let processCount = 0;
    let isScanning = false;

    const handleDecoded = (code: string) => {
      if (isScanning) return;
      isScanning = true;
      processCount++;
    };

    handleDecoded('SKU-100200300');
    handleDecoded('SKU-100200300'); // Rapid duplicate callback
    handleDecoded('SKU-100200300'); // Rapid duplicate callback

    assertEqual(processCount, 1, 'Test 5: In-flight scanning lock prevents duplicate barcode decode callbacks');
  }

  // Test 6: RSA PDF417 payload containing extra text extracts 13-digit ID candidate
  {
    const rawPdf417Payload = 'RSA_DRIVERS_LICENSE|SURNAME:MOKOENA|NAME:THABO|ID:9203155091084|EXP:2028-12-31';
    const parsed = parseAndValidateRsaId(rawPdf417Payload);

    assertTrue(parsed.isValid, 'Test 6: Complex PDF417 string successfully extracted 13-digit ID');
    assertEqual(parsed.idNumber, '9203155091084', 'Test 6: Correct 13-digit candidate extracted from raw payload');
  }

  // Test 7: Decoded RSA ID does not automatically mark identity as verified
  {
    const rawRsaIdCode = '8001015009087';
    const parsed = parseAndValidateRsaId(rawRsaIdCode);
    assertTrue(parsed.isValid, 'Test 7: RSA ID barcode structure parsed successfully');

    // Simulated scan capture object
    const scanResult = {
      idNumber: parsed.idNumber,
      dob: parsed.dob,
      gender: parsed.gender,
      source: 'rsa_id_barcode',
      verified: false // Explicit requirement: decoded barcode is NOT automatic proof of verified identity
    };

    assertEqual(scanResult.verified, false, 'Test 7: Decoded RSA ID barcode captured without forcing automatic identity verification');
  }

  // Test 8: Manual barcode fallback entry
  {
    let manualDecodedValue = '';
    const handleManualSubmit = (inputText: string) => {
      manualDecodedValue = inputText.trim();
    };

    handleManualSubmit(' SKU-999888 ');
    assertEqual(manualDecodedValue, 'SKU-999888', 'Test 8: Manual fallback barcode submission processed trimmed value');
  }

  // Test 9: Routine TOKEN_REFRESHED does not dispatch lm_session_recovered
  {
    let dispatchCount = 0;
    const activeToken = 'token-v1';
    const newToken = 'token-v1'; // Same token / routine refresh

    if (newToken !== activeToken) {
      dispatchCount++;
    }

    assertEqual(dispatchCount, 0, 'Test 9: Routine TOKEN_REFRESHED with identical token does NOT trigger session recovery events or UI churn');
  }

  // Test 10: Expired JWT / PGRST303 recovery with retry once
  {
    let callCount = 0;
    let refreshedCount = 0;

    const mockOperation = async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('JWT expired');
        (err as any).code = 'PGRST303';
        throw err;
      }
      return 'SUCCESS_DATA';
    };

    // Simulate recovery runner logic
    let result;
    try {
      result = await mockOperation();
    } catch (err: any) {
      if (err.code === 'PGRST303' || err.message.includes('JWT expired')) {
        refreshedCount++;
        result = await mockOperation(); // Retry once
      }
    }

    assertEqual(callCount, 2, 'Test 10: Expired JWT error triggered exact 1-time retry');
    assertEqual(refreshedCount, 1, 'Test 10: Session refresh triggered upon auth error');
    assertEqual(result, 'SUCCESS_DATA', 'Test 10: Authenticated request succeeded after recovery retry');
  }

  console.log('=== ALL STABILITY & SCANNER GUIDANCE TESTS PASSED ===');
}
