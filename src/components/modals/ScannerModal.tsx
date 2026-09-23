import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSellers } from '../../context/SellerContext';
import { Camera, X, Flashlight, Barcode, ShieldCheck, RefreshCw, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { shopItemsApi } from '../../services/supabaseApi';
import { parseAndValidateRsaId } from '../../utils/rsaIdValidator';
import { RsaIdScanResult } from '../../types';

export type ScannerStatusState = 
  | 'starting'
  | 'ready'
  | 'checking'
  | 'processing'
  | 'failed'
  | 'decoded_unverified';

export const ScannerModal: React.FC = () => {
  const {
    isScannerModalOpen,
    setIsScannerModalOpen,
    inventory,
    addToCart,
    showToast,
    setActiveCustomer,
    setCapturedRsaIdScan
  } = useApp();

  const { customers } = useCustomers();
  const { sellers } = useSellers();

  const [scanMode, setScanMode] = useState<'asset' | 'rsa_id'>('asset');
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'denied' | 'no_hardware' | 'error'>('initializing');
  const [scannerStatus, setScannerStatus] = useState<ScannerStatusState>('starting');
  const [statusMessage, setStatusMessage] = useState<string>('Starting camera...');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectorIntervalRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);

  // Maintain up-to-date refs for handlers and dependencies to prevent camera restarts
  const scanModeRef = useRef(scanMode);
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);

  const inventoryRef = useRef(inventory);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);

  const customersRef = useRef(customers);
  useEffect(() => { customersRef.current = customers; }, [customers]);

  const sellersRef = useRef(sellers);
  useEffect(() => { sellersRef.current = sellers; }, [sellers]);

  const addToCartRef = useRef(addToCart);
  useEffect(() => { addToCartRef.current = addToCart; }, [addToCart]);

  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const setActiveCustomerRef = useRef(setActiveCustomer);
  useEffect(() => { setActiveCustomerRef.current = setActiveCustomer; }, [setActiveCustomer]);

  const setCapturedRsaIdScanRef = useRef(setCapturedRsaIdScan);
  useEffect(() => { setCapturedRsaIdScanRef.current = setCapturedRsaIdScan; }, [setCapturedRsaIdScan]);

  const setIsScannerModalOpenRef = useRef(setIsScannerModalOpen);
  useEffect(() => { setIsScannerModalOpenRef.current = setIsScannerModalOpen; }, [setIsScannerModalOpen]);

  // Completely shut down and clean up all active camera streams, readers, and frame intervals
  const stopCameraStream = useCallback(() => {
    isScanningRef.current = false;

    // 1. Clear native detector interval
    if (detectorIntervalRef.current) {
      clearInterval(detectorIntervalRef.current);
      detectorIntervalRef.current = null;
    }

    // 2. Clear ZXing reader
    if (readerRef.current) {
      try {
        (readerRef.current as any).reset?.();
      } catch (e) {
        console.warn('Reader reset note:', e);
      }
      readerRef.current = null;
    }

    // 3. Stop MediaStream tracks
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

    // 4. Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Handle decoded code payload safely
  const handleDecodedCode = useCallback(async (codeText: string) => {
    const cleanCode = codeText.trim();
    if (!cleanCode || isScanningRef.current) return;

    isScanningRef.current = true;
    setLastScannedResult(cleanCode);
    setScannerStatus('checking');
    setStatusMessage('Barcode detected — checking');

    const currentMode = scanModeRef.current;

    if (currentMode === 'asset') {
      // 1. Search local inventory first (offline-first)
      const currentInventory = inventoryRef.current;
      const localMatch = currentInventory.find(i => 
        i.sku.toLowerCase() === cleanCode.toLowerCase() ||
        (i.serialOrImei && i.serialOrImei.toLowerCase() === cleanCode.toLowerCase()) ||
        (i.pawnTicketId && i.pawnTicketId.toLowerCase().includes(cleanCode.toLowerCase()))
      );

      if (localMatch) {
        if (localMatch.status === 'Retail Floor' || localMatch.status === 'Reserved') {
          setScannerStatus('processing');
          setStatusMessage('Decoded — processing');
          addToCartRef.current(localMatch);
          showToastRef.current('Asset Found', `Added ${localMatch.title} (${localMatch.sku}) to sale basket.`, 'success');
          stopCameraStream();
          setIsScannerModalOpenRef.current(false);
          return;
        } else {
          setScannerStatus('failed');
          setStatusMessage('Scan failed — asset unavailable');
          showToastRef.current('Asset Unavailable', `Asset #${localMatch.sku} is in status "${localMatch.status}".`, 'amber');
          setTimeout(() => {
            isScanningRef.current = false;
            setScannerStatus('ready');
            setStatusMessage('Camera ready — scanning');
          }, 1500);
          return;
        }
      }

      // 2. Search online catalog if missing locally and device is online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const remoteItemRow = await shopItemsApi.getItemBySku(cleanCode);
          if (remoteItemRow) {
            const mappedItem = shopItemsApi.mapRowToInventoryItem(remoteItemRow);
            if (mappedItem.status === 'Retail Floor' || mappedItem.status === 'Reserved') {
              setScannerStatus('processing');
              setStatusMessage('Decoded — processing');
              addToCartRef.current(mappedItem);
              showToastRef.current('Asset Found (Online)', `Added ${mappedItem.title} (${mappedItem.sku}) to sale basket.`, 'success');
              stopCameraStream();
              setIsScannerModalOpenRef.current(false);
              return;
            } else {
              setScannerStatus('failed');
              setStatusMessage('Scan failed — asset unavailable');
              showToastRef.current('Asset Unavailable', `Asset #${mappedItem.sku} is in status "${mappedItem.status}".`, 'amber');
              setTimeout(() => {
                isScanningRef.current = false;
                setScannerStatus('ready');
                setStatusMessage('Camera ready — scanning');
              }, 1500);
              return;
            }
          }
        } catch (e) {
          console.warn('Online inventory lookup failed:', e);
        }
      }

      // 3. Asset not found
      setScannerStatus('failed');
      setStatusMessage('Scan failed — try again');
      showToastRef.current('Asset Not Found', `Asset #${cleanCode} could not be found in active inventory.`, 'error');
      setTimeout(() => {
        isScanningRef.current = false;
        setScannerStatus('ready');
        setStatusMessage('Camera ready — scanning');
      }, 1500);

    } else if (currentMode === 'rsa_id') {
      const parsed = parseAndValidateRsaId(cleanCode);

      if (!parsed.isValid || !parsed.idNumber) {
        setScannerStatus('failed');
        setStatusMessage('Scan failed — invalid RSA ID structure');
        showToastRef.current('Invalid RSA ID Barcode', parsed.error || 'Decoded barcode does not contain a valid 13-digit RSA ID structure.', 'error');
        setTimeout(() => {
          isScanningRef.current = false;
          setScannerStatus('ready');
          setStatusMessage('Camera ready — scanning');
        }, 1500);
        return;
      }

      setScannerStatus('decoded_unverified');
      setStatusMessage('ID decoded — identity still needs verification');

      const scanResult: RsaIdScanResult = {
        idNumber: parsed.idNumber,
        dob: parsed.dob,
        gender: parsed.gender,
        citizenship: parsed.citizenship,
        rawText: cleanCode,
        source: 'rsa_id_barcode',
        capturedAt: new Date().toISOString()
      };

      setCapturedRsaIdScanRef.current(scanResult);

      const currentCustomers = customersRef.current;
      const currentSellers = sellersRef.current;

      const existingCustomer = currentCustomers.find(c => c.idNumber.replace(/\s+/g, '') === parsed.idNumber!.replace(/\s+/g, ''));
      const existingSeller = currentSellers.find(s => s.idNumber.replace(/\s+/g, '') === parsed.idNumber!.replace(/\s+/g, ''));

      if (existingCustomer) {
        setActiveCustomerRef.current(existingCustomer);
        showToastRef.current('ID Barcode Decoded', `Matched client: ${existingCustomer.fullName}`, 'success');
      } else if (existingSeller) {
        showToastRef.current('ID Barcode Decoded', `Matched seller: ${existingSeller.fullName}`, 'success');
      } else {
        setActiveCustomerRef.current(null);
        showToastRef.current('ID Captured', `Decoded ID #${parsed.idNumber}. Complete mandatory details to verify identity.`, 'info');
      }

      stopCameraStream();
      setIsScannerModalOpenRef.current(false);
    }
  }, [stopCameraStream]);

  // Start real camera stream using ONE decoder path at a time
  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraState('initializing');
    setScannerStatus('starting');
    setStatusMessage('Starting camera...');
    setErrorMessage('');
    setLastScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('no_hardware');
      setErrorMessage('Browser API mediaDevices.getUserMedia is not supported on this browser or device.');
      return;
    }

    try {
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
      setScannerStatus('ready');
      setStatusMessage('Camera ready — scanning');

      let nativeDetectorInitialized = false;

      // PATH A: Use Native BarcodeDetector API if supported and initializes without error
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
              // Ignore individual frame detection errors
            }
          };

          const intervalId = setInterval(detectFrame, 200);
          detectorIntervalRef.current = intervalId;
          nativeDetectorInitialized = true;
        } catch (e) {
          console.warn('Native BarcodeDetector initialization failed, falling back to ZXing:', e);
        }
      }

      // PATH B: Fallback to ZXing MultiFormat Reader ONLY when native detector is unavailable
      if (!nativeDetectorInitialized) {
        const formats = [
          BarcodeFormat.CODE_128,
          BarcodeFormat.EAN_13,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.PDF_417
        ];

        const hints = new Map<DecodeHintType, any>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 300,
          delayBetweenScanSuccess: 1000
        });
        readerRef.current = reader;

        if (videoRef.current) {
          reader.decodeFromVideoElement(videoRef.current, (result) => {
            if (result && result.getText()) {
              handleDecodedCode(result.getText());
            }
          });
        }
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
        showToastRef.current('Torch Unavailable', 'Flashlight/Torch is not supported on this camera device.', 'info');
      }
    } catch (err) {
      console.warn('Torch control error:', err);
      showToastRef.current('Torch Error', 'Unable to toggle camera flashlight.', 'amber');
    }
  };

  // Manage stream lifecycle when modal opens/closes — depends ONLY on isScannerModalOpen
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
          <div className="relative w-full h-60 rounded-xl bg-black overflow-hidden flex items-center justify-center border-2 border-[#C85A32]/60">
            {/* Live Video Element */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
              playsInline
              muted
            />

            {/* Viewfinder Reticle Overlay */}
            {cameraState === 'active' && (
              <div className="absolute inset-6 border border-white/30 rounded-lg pointer-events-none flex flex-col justify-between p-2">
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

            {/* Initializing / Error / Permission States */}
            {cameraState === 'initializing' && (
              <div className="text-center z-10 space-y-2 p-4">
                <RefreshCw className="w-8 h-8 text-[#E87A5D] mx-auto animate-spin" />
                <p className="text-xs font-mono text-gray-300">Requesting camera permission...</p>
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

          {/* Scanner Guidance Panel */}
          {scanMode === 'asset' ? (
            <div className="w-full bg-[#161616] border border-[#2A2A2A] rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-gray-200 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-[#E87A5D]" />
                <span>Scanning tips</span>
              </div>
              <ul className="text-gray-400 text-[11px] space-y-0.5 list-disc list-inside">
                <li>Keep the barcode inside the frame.</li>
                <li>Move closer until the barcode fills the guide.</li>
                <li>Hold the camera steady.</li>
                <li>Avoid glare and very dark lighting.</li>
              </ul>
            </div>
          ) : (
            <div className="w-full bg-[#161616] border border-[#2A2A2A] rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-gray-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E87A5D]" />
                <span>RSA ID scanning tips</span>
              </div>
              <ul className="text-gray-400 text-[11px] space-y-0.5 list-disc list-inside">
                <li>Use the PDF417 barcode.</li>
                <li>Keep the whole barcode visible.</li>
                <li>Hold the ID flat and steady.</li>
                <li>Avoid glare/reflections.</li>
              </ul>
            </div>
          )}

          {/* Explicit Status Bar */}
          <div className="flex items-center justify-between w-full text-xs bg-[#141414] p-2.5 rounded-xl border border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                scannerStatus === 'ready'
                  ? 'bg-emerald-500 animate-ping'
                  : scannerStatus === 'checking' || scannerStatus === 'processing'
                  ? 'bg-amber-400 animate-pulse'
                  : scannerStatus === 'decoded_unverified'
                  ? 'bg-blue-400'
                  : scannerStatus === 'failed'
                  ? 'bg-red-500'
                  : 'bg-gray-500'
              }`} />
              <span className="text-xs font-mono font-medium text-gray-200">
                {statusMessage}
              </span>
            </div>

            {cameraState === 'active' && (
              <button
                type="button"
                onClick={toggleFlashlight}
                className={`px-3 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                  flashlightOn
                    ? 'bg-amber-400 text-black border-amber-300 font-bold'
                    : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400 hover:text-white'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                <span>{flashlightOn ? 'Torch On' : 'Torch'}</span>
              </button>
            )}
          </div>

          {lastScannedResult && (
            <div className="w-full bg-[#141414] p-3 rounded-xl border border-[#2A2A2A] text-center font-mono text-xs text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Decoded Payload: <strong className="text-white">{lastScannedResult}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
