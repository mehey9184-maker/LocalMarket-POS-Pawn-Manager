import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, X, AlertCircle, Loader2, Zap, ZapOff } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, fileName: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Capture Item Photograph',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isShutterActive, setIsShutterActive] = useState(false);

  // Stop all active stream tracks safely
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('Error stopping camera tracks:', err);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Enumerate video devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevs);
    } catch {
      // ignore
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string, mode: 'environment' | 'user' = 'environment') => {
    stopTracks();
    setIsLoading(true);
    setError(null);
    setTorchOn(false);
    setHasTorch(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera access is not supported by this browser. Please use the file upload option.');
      setIsLoading(false);
      return;
    }

    try {
      // Primary constraint: prefer 1080p, chosen device or facing mode
      let stream: MediaStream;
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : {
              facingMode: { ideal: mode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (primaryErr: any) {
        console.warn('High-res camera constraints failed, attempting fallback:', primaryErr);
        // Fallback: minimal video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId } : true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      await updateDeviceList();
      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      let userMsg = 'Could not access the camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg = 'Camera permission was denied. Please allow camera permissions in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = 'No camera device found on this system. Please connect a webcam or use file upload.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMsg = 'Camera is already in use by another application. Please close other camera apps and retry.';
      } else if (err.message) {
        userMsg = err.message;
      }
      setError(userMsg);
      setIsLoading(false);
    }
  }, [stopTracks, updateDeviceList]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle not supported:', err);
    }
  };

  // Flip camera between environment and user
  const handleFlipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedDeviceId('');
    startCamera(undefined, nextMode);
  };

  // Switch specific device
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    startCamera(devId, facingMode);
  };

  // Capture frame from video to canvas
  const handleCapture = () => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsShutterActive(true);
    setTimeout(() => setIsShutterActive(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw full-res video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = Date.now();
        const fileName = `item_photo_${timestamp}.jpg`;
        // Stop tracks immediately upon successful capture
        stopTracks();
        onCapture(blob, fileName);
        onClose();
      },
      'image/jpeg',
      0.95
    );
  };

  // Manage open/close and clean up stream
  useEffect(() => {
    if (isOpen) {
      startCamera(selectedDeviceId || undefined, facingMode);
    } else {
      stopTracks();
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, startCamera, stopTracks, selectedDeviceId, facingMode]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopTracks();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stopTracks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C85A32]/20 text-[#C85A32] flex items-center justify-center border border-[#C85A32]/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-stone-400">Position item in viewfinder and capture</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopTracks();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center transition cursor-pointer"
            aria-label="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-4/3 sm:aspect-16/10 bg-black flex items-center justify-center overflow-hidden">
          {/* Shutter flash animation */}
          {isShutterActive && (
            <div className="absolute inset-0 bg-white/70 z-30 transition-opacity duration-150" />
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoading || error ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Viewfinder Target Guidelines */}
          {!isLoading && !error && (
            <div className="absolute inset-6 pointer-events-none flex flex-col justify-between z-10">
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-2 border-l-2 border-[#C85A32] rounded-tl-lg" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-[#C85A32] rounded-tr-lg" />
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-2 border-l-2 border-[#C85A32] rounded-bl-lg" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-[#C85A32] rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Live Indicator Badge */}
          {!isLoading && !error && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-stone-300 z-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#C85A32]" />
              <p className="text-xs font-medium">Starting camera...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center gap-3 bg-stone-900/95 z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-stone-200 max-w-sm leading-relaxed">{error}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => startCamera(selectedDeviceId || undefined, facingMode)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopTracks();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-3">
          {/* Device / Switch Controls */}
          <div className="flex items-center gap-2 flex-1">
            {devices.length > 1 ? (
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                disabled={isLoading}
                className="bg-stone-800 border border-stone-700 rounded-xl px-2.5 py-1.5 text-[11px] text-stone-200 focus:outline-none focus:border-[#C85A32] max-w-[140px] truncate"
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={handleFlipCamera}
                disabled={isLoading}
                title="Flip Camera"
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                }`}
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Shutter / Capture Button */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={isLoading || !!error}
              className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-white hover:bg-stone-100 disabled:opacity-40 transition active:scale-95 shadow-lg shadow-black/40 cursor-pointer"
              aria-label="Take Photo"
            >
              <div className="w-12 h-12 rounded-full border-2 border-stone-900 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#C85A32] group-hover:bg-[#B84E27] transition" />
              </div>
            </button>
          </div>

          {/* Cancel button */}
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                stopTracks();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
