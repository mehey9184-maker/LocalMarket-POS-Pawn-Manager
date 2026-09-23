import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, X, Flashlight, Barcode, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { shopItemsApi } from '../../services/supabaseApi';

export const ScannerModal: React.FC = () => {
  const {
    isScannerModalOpen,
    setIsScannerModalOpen,
    inventory,
    addToCart,
    showToast,
    setActiveCustomer,
    activeCustomer
  } = useApp();

  const [scanMode, setScanMode] = useState<'asset' | 'rsa_id'>('asset');
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'denied' | 'no_hardware' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Stop camera stream tracks cleanly
  const stopCameraStream = useCallback(() => {
    isScanningRef.current = false;
    if (videoRef.current && (videoRef.current as any)._detectorInterval) {
      clearInterval((videoRef.current as any)._detectorInterval);
      (videoRef.current as any)._detectorInterval = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop note:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Parse RSA ID barcode raw payload
  const parseRSAIDPayload = (rawText: string) => {
    // Check for RSA 13-digit ID number pattern (YYMMDD SSSS C A Z)
    const idMatch = rawText.match(/\b\d{13}\b/);
    const idNumber = idMatch ? idMatch[0] : null;

    if (idNumber) {
      const yearPrefix = parseInt(idNumber.substring(0, 2), 10);
      const fullYear = yearPrefix > 30 ? `19${idNumber.substring(0, 2)}` : `20${idNumber.substring(0, 2)}`;
      const month = idNumber.substring(2, 4);
      const day = idNumber.substring(4, 6);
      const genderDigit = parseInt(idNumber.substring(6, 7), 10);
      const gender = genderDigit >= 5 ? 'Male' : 'Female';
      const dob = `${fullYear}-${month}-${day}`;

      return {
        idNumber,
        dob,
        gender,
        rawText
      };
    }

    return {
      idNumber: rawText.trim(),
      dob: undefined,
      gender: undefined,
      rawText
    };
  };

  // Handle scanned code
  const handleDecodedCode = useCallback(async (codeText: string) => {
    const cleanCode = codeText.trim();
    if (!cleanCode || isScanningRef.current) return;

    isScanningRef.current = true;
    setLastScannedResult(cleanCode);

    if (scanMode === 'asset') {
      // 1. Check local inventory first
      const localMatch = inventory.find(i => 
        i.sku.toLowerCase() === cleanCode.toLowerCase() ||
        (i.serialOrImei && i.serialOrImei.toLowerCase() === cleanCode.toLowerCase()) ||
        (i.pawnTicketId && i.pawnTicketId.toLowerCase().includes(cleanCode.toLowerCase()))
      );

      if (localMatch) {
        if (localMatch.status === 'Retail Floor' || localMatch.status === 'Reserved') {
          addToCart(localMatch);
          showToast('Asset Found', `Added ${localMatch.title} (${localMatch.sku}) to sale basket.`, 'success');
          stopCameraStream();
          setIsScannerModalOpen(false);
          return;
        } else {
          showToast('Asset Unavailable', `Asset #${localMatch.sku} is in status "${localMatch.status}".`, 'amber');
          isScanningRef.current = false;
          return;
        }
      }

      // 2. Query online inventory if online and not found locally
      if (navigator.onLine) {
        try {
          const remoteItemRow = await shopItemsApi.getItemBySku(cleanCode);
          if (remoteItemRow) {
            const mappedItem = shopItemsApi.mapRowToInventoryItem(remoteItemRow);
            if (mappedItem.status === 'Retail Floor' || mappedItem.status === 'Reserved') {
              addToCart(mappedItem);
              showToast('Asset Found (Online)', `Added ${mappedItem.title} (${mappedItem.sku}) to sale basket.`, 'success');
              stopCameraStream();
              setIsScannerModalOpen(false);
              return;
            } else {
              showToast('Asset Unavailable', `Asset #${mappedItem.sku} is in status "${mappedItem.status}".`, 'amber');
              isScanningRef.current = false;
              return;
            }
          }
        } catch (e) {
          console.warn('Online inventory lookup failed:', e);
        }
      }

      // 3. Asset not found
      showToast('Asset Not Found', `Asset #${cleanCode} could not be found in active inventory.`, 'error');
      setTimeout(() => {
        isScanningRef.current = false;
      }, 1500);

    } else if (scanMode === 'rsa_id') {
      const parsed = parseRSAIDPayload(cleanCode);
      
      const newCustomer = {
        id: activeCustomer?.id || `cust-scan-${Date.now()}`,
        fullName: activeCustomer?.fullName || 'Scanned ID Holder',
        idNumber: parsed.idNumber,
        idType: 'RSA Smart ID' as const,
        mobile: activeCustomer?.mobile || '',
        address: activeCustomer?.address || '',
        dob: parsed.dob || activeCustomer?.dob,
        gender: parsed.gender || activeCustomer?.gender,
        verified: true,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setActiveCustomer(newCustomer);
      showToast('RSA ID Scanned', `ID Number #${parsed.idNumber} verified and captured.`, 'success');
      stopCameraStream();
      setIsScannerModalOpen(false);
    }
  }, [scanMode, inventory, addToCart, showToast, stopCameraStream, setIsScannerModalOpen, setActiveCustomer, activeCustomer]);

  // Start real camera stream & barcode reader
  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraState('initializing');
    setErrorMessage('');
    setLastScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('no_hardware');
      setErrorMessage('Browser API mediaDevices.getUserMedia is not supported on this browser or device.');
      return;
    }

    try {
      // 1. Request camera stream
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('active');

      // 2. Initialize native BarcodeDetector or ZXing MultiFormat Reader
      const formats = [
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.PDF_417
      ];

      // Native BarcodeDetector API check if available
      if ('BarcodeDetector' in window) {
        try {
          const nativeDetector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'ean_13', 'qr_code', 'pdf417']
          });
          const detectFrame = async () => {
            if (!videoRef.current || !streamRef.current || isScanningRef.current) return;
            try {
              const barcodes = await nativeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDecodedCode(barcodes[0].rawValue);
              }
            } catch (e) {
              // Ignore frame detection errors
            }
          };
          const intervalId = setInterval(detectFrame, 250);
          (videoRef.current as any)._detectorInterval = intervalId;
        } catch (e) {
          console.warn('Native BarcodeDetector initialization fallback to ZXing:', e);
        }
      }

      // ZXing MultiFormat Reader fallback
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 300,
        delayBetweenScanSuccess: 1000
      });
      readerRef.current = reader;

      // 3. Start continuous decoding from video element
      if (videoRef.current) {
        reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (result && result.getText()) {
            handleDecodedCode(result.getText());
          }
        });
      }

    } catch (err: any) {
      console.error('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMessage('Camera access permission was denied. Please allow camera permissions in your browser address bar and click Retry.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('no_hardware');
        setErrorMessage('No camera hardware was found connected to this device.');
      } else {
        setCameraState('error');
        setErrorMessage(err.message || 'Failed to initialize camera video stream.');
      }
    }
  }, [stopCameraStream, handleDecodedCode]);

  // Flashlight toggle handler
  const toggleFlashlight = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = (track.getCapabilities?.() || {}) as any;
      if (capabilities.torch) {
        const nextState = !flashlightOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        } as any);
        setFlashlightOn(nextState);
      } else {
        showToast('Torch Unavailable', 'Flashlight/Torch is not supported on this camera device.', 'info');
      }
    } catch (err) {
      console.warn('Torch control error:', err);
      showToast('Torch Error', 'Unable to toggle camera flashlight.', 'amber');
    }
  };

  // Manage stream lifecycle when modal opens/closes
  useEffect(() => {
    if (isScannerModalOpen) {
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isScannerModalOpen, startCamera, stopCameraStream]);

  if (!isScannerModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E87A5D]" />
            <h3 className="font-bold text-sm text-white font-headline">
              Live Camera Barcode &amp; ID Scanner
            </h3>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              setIsScannerModalOpen(false);
            }}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-3 bg-[#121212] border-b border-[#2A2A2A] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-[#1E1E1E] p-1 rounded-xl border border-[#2A2A2A] w-full">
            <button
              type="button"
              onClick={() => setScanMode('asset')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                scanMode === 'asset'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Asset Tag (Code128 / EAN / QR)</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('rsa_id')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                scanMode === 'rsa_id'
                  ? 'bg-[#C85A32] text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>RSA ID (PDF417)</span>
            </button>
          </div>
        </div>

        {/* Viewfinder Feed Area */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-full h-64 rounded-xl bg-black overflow-hidden flex items-center justify-center border-2 border-[#C85A32]/60">
            {/* Live Video Element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Viewfinder Reticle Overlay */}
            {cameraState === 'active' && (
              <div className="absolute inset-8 border border-white/30 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-[#E87A5D]"></span>
                  <span className="w-4 h-4 border-t-2 border-r-2 border-[#E87A5D]"></span>
                </div>
                {/* Laser scanning beam */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse"></div>
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-[#E87A5D]"></span>
                  <span className="w-4 h-4 border-b-2 border-r-2 border-[#E87A5D]"></span>
                </div>
              </div>
            )}

            {/* Error / Permission States */}
            {cameraState === 'initializing' && (
              <div className="text-center z-10 space-y-2 p-4">
                <RefreshCw className="w-8 h-8 text-[#E87A5D] mx-auto animate-spin" />
                <p className="text-xs font-mono text-gray-300">Requesting live camera permission...</p>
              </div>
            )}

            {cameraState === 'denied' && (
              <div className="text-center z-10 space-y-3 p-6 max-w-xs">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <h4 className="text-xs font-bold text-white">Camera Permission Denied</h4>
                <p className="text-[11px] text-gray-400">{errorMessage}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04a25] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Grant Permission / Retry</span>
                </button>
              </div>
            )}

            {cameraState === 'no_hardware' && (
              <div className="text-center z-10 space-y-3 p-6 max-w-xs">
                <Camera className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="text-xs font-bold text-white">No Camera Found</h4>
                <p className="text-[11px] text-gray-400">{errorMessage}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 border border-gray-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Device Detection</span>
                </button>
              </div>
            )}

            {cameraState === 'error' && (
              <div className="text-center z-10 space-y-3 p-6 max-w-xs">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">Camera Stream Error</h4>
                <p className="text-[11px] text-gray-400">{errorMessage}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#b04a25] text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restart Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Real Status Footer */}
          <div className="flex items-center justify-between w-full text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cameraState === 'active' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span className="text-xs font-mono text-gray-300">
                {cameraState === 'active'
                  ? scanMode === 'asset' ? 'Point lens at asset tag / barcode' : 'Point lens at RSA ID card (PDF417)'
                  : 'Camera inactive'}
              </span>
            </div>

            {cameraState === 'active' && (
              <button
                type="button"
                onClick={toggleFlashlight}
                className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                  flashlightOn
                    ? 'bg-amber-400 text-black border-amber-300 font-bold'
                    : 'bg-[#121212] border-[#2A2A2A] text-gray-400 hover:text-white'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                <span>{flashlightOn ? 'Torch On' : 'Torch'}</span>
              </button>
            )}
          </div>

          {lastScannedResult && (
            <div className="w-full bg-[#141414] p-3 rounded-xl border border-[#2A2A2A] text-center font-mono text-xs text-emerald-400">
              Scanned Payload: <span className="text-white font-bold">{lastScannedResult}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
