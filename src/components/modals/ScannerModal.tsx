import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useCustomers } from '../../context/CustomerContext';
import { useSellers } from '../../context/SellerContext';
import { Camera, X, Flashlight, Barcode, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, ZoomIn, ZoomOut, Keyboard } from 'lucide-react';
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
  | 'paused'
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

  // Manual fallback code entry
  const [manualInput, setManualInput] = useState<string>('');

  // Zoom controls
  const [zoomSupported, setZoomSupported] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomMinMax, setZoomMinMax] = useState<{ min: number; max: number; step: number }>({ min: 1, max: 3, step: 0.1 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectorIntervalRef = useRef<any>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastDecodeAttemptAtRef = useRef<number>(Date.now());

  // Up-to-date refs for state and context values
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

  // Clean shutdown of all media streams, readers, and timers
  const stopCameraStream = useCallback(() => {
    isScanningRef.current = false;

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (detectorIntervalRef.current) {
      clearInterval(detectorIntervalRef.current);
      detectorIntervalRef.current = null;
    }

    if (readerRef.current) {
      try {
        (readerRef.current as any).reset?.();
      } catch (e) {
        console.warn('Reader reset note:', e);
      }
      readerRef.current = null;
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

    setZoomSupported(false);
  }, []);

  // Handle decoded code payload cleanly
  const handleDecodedCode = useCallback(async (codeText: string) => {
    const cleanCode = codeText.trim();
    if (!cleanCode || isScanningRef.current) return;

    isScanningRef.current = true;
    setLastScannedResult(cleanCode);
    setScannerStatus('checking');
    setStatusMessage('Barcode detected — checking');

    const currentMode = scanModeRef.current;

    if (currentMode === 'asset') {
      // 1. Local inventory search (offline-first)
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
          setStatusMessage('No barcode detected — adjust position');
          showToastRef.current('Asset Unavailable', `Asset #${localMatch.sku} is in status "${localMatch.status}".`, 'amber');
          setTimeout(() => {
            isScanningRef.current = false;
            setScannerStatus('ready');
            setStatusMessage('Camera ready — looking for barcode');
          }, 1500);
          return;
        }
      }

      // 2. Query remote catalog if device is online
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
              setStatusMessage('No barcode detected — adjust position');
              showToastRef.current('Asset Unavailable', `Asset #${mappedItem.sku} is in status "${mappedItem.status}".`, 'amber');
              setTimeout(() => {
                isScanningRef.current = false;
                setScannerStatus('ready');
                setStatusMessage('Camera ready — looking for barcode');
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
      setStatusMessage('No barcode detected — adjust position');
      showToastRef.current('Asset Not Found', `Asset #${cleanCode} could not be found in active inventory.`, 'error');
      setTimeout(() => {
        isScanningRef.current = false;
        setScannerStatus('ready');
        setStatusMessage('Camera ready — looking for barcode');
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
          setStatusMessage('Camera ready — looking for barcode');
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

  // Handle manual code entry submit or USB scanner input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const valueToSubmit = manualInput.trim();
    setManualInput('');
    handleDecodedCode(valueToSubmit);
  };

  // Adjust zoom level when supported
  const adjustZoom = async (delta: number) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextZoom = Math.min(zoomMinMax.max, Math.max(zoomMinMax.min, zoomLevel + delta));
      await track.applyConstraints({
        advanced: [{ zoom: nextZoom }]
      } as any);
      setZoomLevel(nextZoom);
    } catch (err) {
      console.warn('Zoom adjustment error:', err);
    }
  };

  // Initialize camera and start single decoder engine
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
      // Barcode-friendly camera constraints supporting desktop and mobile cameras
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities() as any;
        // Continuous focus if supported
        if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any);
          } catch (e) {
            console.warn('Continuous focus constraint note:', e);
          }
        }
        // Zoom capabilities
        if (caps.zoom) {
          setZoomSupported(true);
          const minVal = caps.zoom.min || 1;
          const maxVal = caps.zoom.max || 3;
          const stepVal = caps.zoom.step || 0.1;
          setZoomMinMax({ min: minVal, max: maxVal, step: stepVal });
          setZoomLevel(minVal);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Verify camera frame readiness before declaring ready state
      let retries = 0;
      while (retries < 15) {
        if (
          videoRef.current &&
          videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          videoRef.current.videoWidth > 0 &&
          videoRef.current.videoHeight > 0 &&
          stream.active
        ) {
          break;
        }
        await new Promise(r => setTimeout(r, 150));
        retries++;
      }

      setCameraState('active');
      setScannerStatus('ready');
      setStatusMessage('Camera ready — looking for barcode');
      lastDecodeAttemptAtRef.current = Date.now();

      // Decoder heartbeat monitor
      heartbeatTimerRef.current = setInterval(() => {
        if (!isScanningRef.current && Date.now() - lastDecodeAttemptAtRef.current > 8000) {
          setScannerStatus('paused');
          setStatusMessage('Scanner paused — tap Retry');
        }
      }, 3000);

      let nativeDetectorInitialized = false;

      // PATH A: Use Native BarcodeDetector if supported and constructor succeeds
      if ('BarcodeDetector' in window) {
        try {
          const testDetector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'ean_13', 'qr_code', 'pdf417']
          });

          const detectFrame = async () => {
            if (!videoRef.current || !streamRef.current || isScanningRef.current) return;
            lastDecodeAttemptAtRef.current = Date.now();
            try {
              const barcodes = await testDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDecodedCode(barcodes[0].rawValue);
              }
            } catch (e) {
              // Ignore frame detection exceptions
            }
          };

          detectorIntervalRef.current = setInterval(detectFrame, 200);
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
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1000
        });
        readerRef.current = reader;

        if (videoRef.current) {
          reader.decodeFromVideoElement(videoRef.current, (result) => {
            lastDecodeAttemptAtRef.current = Date.now();
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

  // Manage camera lifecycle when modal opens/closes
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

        {/* Viewfinder Feed Area with Stable Aspect-Video Geometry */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-full aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center border-2 border-[#C85A32]/60 shadow-inner">
            {/* Live Video Element filling outer container with no sidebars */}
            <video
              ref={videoRef}
              className={`w-full h-full ${cameraState === 'active' ? 'block' : 'hidden'}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center'
              }}
              playsInline
              muted
            />

            {/* Overlaid Scanning Reticle Guide */}
            {cameraState === 'active' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                <div 
                  className={`relative border-2 border-[#E87A5D]/90 rounded-lg transition-all duration-200 flex flex-col items-center justify-between p-2 bg-black/10 backdrop-blur-[0.5px] ${
                    scanMode === 'asset' ? 'w-[82%] h-[50%]' : 'w-[92%] h-[65%]'
                  }`}
                >
                  {/* Corner Accent Brackets */}
                  <div className="w-full flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-[#E87A5D]"></span>
                    <span className="w-4 h-4 border-t-2 border-r-2 border-[#E87A5D]"></span>
                  </div>

                  {/* Subtle Centered Laser Beam & Text Guide */}
                  <div className="w-full flex flex-col items-center gap-1">
                    <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
                    <span className="text-[10px] font-mono font-semibold bg-black/60 text-white/90 px-2 py-0.5 rounded backdrop-blur-xs border border-white/10">
                      Place barcode inside the guide
                    </span>
                  </div>

                  <div className="w-full flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-[#E87A5D]"></span>
                    <span className="w-4 h-4 border-b-2 border-r-2 border-[#E87A5D]"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Initializing / Permission States */}
            {cameraState === 'initializing' && (
              <div className="text-center z-10 space-y-2 p-4">
                <RefreshCw className="w-8 h-8 text-[#E87A5D] mx-auto animate-spin" />
                <p className="text-xs font-mono text-gray-300">Starting camera...</p>
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

          {/* Real-World Distance Guidance Panel */}
          {scanMode === 'asset' ? (
            <div className="w-full bg-[#161616] border border-[#2A2A2A] rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-gray-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-[#E87A5D]" />
                  <span>Scanning tips</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono font-medium">Move closer until barcode fills guide</span>
              </div>
              <ul className="text-gray-400 text-[11px] space-y-0.5 list-disc list-inside">
                <li>Keep the barcode inside the frame.</li>
                <li>Move closer until the barcode fills the guide.</li>
                <li>Hold the camera steady and avoid glare.</li>
              </ul>
            </div>
          ) : (
            <div className="w-full bg-[#161616] border border-[#2A2A2A] rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-gray-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E87A5D]" />
                  <span>RSA ID scanning tips</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono font-medium">Fill guide with PDF417 barcode</span>
              </div>
              <ul className="text-gray-400 text-[11px] space-y-0.5 list-disc list-inside">
                <li>Keep the full PDF417 barcode inside the frame.</li>
                <li>Hold the RSA ID card flat and steady.</li>
                <li>Avoid reflections or dark shadows.</li>
              </ul>
            </div>
          )}

          {/* Status Indicator Bar + Camera Controls */}
          <div className="flex items-center justify-between w-full text-xs bg-[#141414] p-2.5 rounded-xl border border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                scannerStatus === 'ready'
                  ? 'bg-emerald-500 animate-ping'
                  : scannerStatus === 'checking' || scannerStatus === 'processing'
                  ? 'bg-amber-400 animate-pulse'
                  : scannerStatus === 'decoded_unverified'
                  ? 'bg-blue-400'
                  : scannerStatus === 'failed' || scannerStatus === 'paused'
                  ? 'bg-red-500'
                  : 'bg-gray-500'
              }`} />
              <span className="text-xs font-mono font-medium text-gray-200">
                {statusMessage}
              </span>
            </div>

            {cameraState === 'active' && (
              <div className="flex items-center gap-2">
                {/* Optional Zoom Controls */}
                {zoomSupported && (
                  <div className="flex items-center bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => adjustZoom(-0.5)}
                      disabled={zoomLevel <= zoomMinMax.min}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono px-1 text-gray-300">{zoomLevel.toFixed(1)}x</span>
                    <button
                      type="button"
                      onClick={() => adjustZoom(0.5)}
                      disabled={zoomLevel >= zoomMinMax.max}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Torch Button */}
                <button
                  type="button"
                  onClick={toggleFlashlight}
                  className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                    flashlightOn
                      ? 'bg-amber-400 text-black border-amber-300 font-bold'
                      : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-400 hover:text-white'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  <span>{flashlightOn ? 'Torch On' : 'Torch'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Manual Entry Fallback Form */}
          <form onSubmit={handleManualSubmit} className="w-full bg-[#161616] border border-[#2A2A2A] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-[#E87A5D]" />
                <span>Enter code manually or scan with USB scanner</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">SKU / IMEI / ID / Ticket</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={scanMode === 'asset' ? 'Type SKU, Serial, IMEI or Ticket #' : 'Type 13-digit RSA ID #'}
                className="flex-1 bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C85A32]"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-3 py-1.5 bg-[#C85A32] hover:bg-[#b04a25] disabled:opacity-40 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1"
              >
                <span>Submit</span>
              </button>
            </div>
          </form>

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
