import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, RefreshCw, Loader2, Upload } from 'lucide-react';
import { compressImage, ProcessedImageResult } from '../../utils/imageProcessor';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (result: ProcessedImageResult) => void;
  onFallbackToFileUpload?: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackToFileUpload,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  };

  const startCamera = async (mode: 'environment' | 'user' = 'environment') => {
    setIsLoading(true);
    setCameraError(null);
    stopStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by this browser. Please use the Upload File option.');
      setIsLoading(false);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback without constraints if specific facingMode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsLoading(false);
    } catch (err: any) {
      let message = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera access in your browser settings or use Upload File.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera hardware found on this device. Please use Upload File.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera is currently in use by another application.';
      }
      setCameraError(message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCancel = () => {
    stopStream();
    onClose();
  };

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleTakePhoto = async () => {
    if (!videoRef.current || isCapturing) return;

    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      return;
    }

    setIsCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

      // Stop camera immediately
      stopStream();

      // Convert frame to Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to capture frame from video'));
          },
          'image/jpeg',
          0.92
        );
      });

      // Compress and optimize locally using standard pipeline
      const optimized = await compressImage(blob, {
        maxDimension: 1600,
        quality: 0.82,
        fileName: `camera_${Date.now()}.webp`,
      });

      onCapture(optimized);
      onClose();
    } catch (err: any) {
      console.error('Error during photo capture:', err);
      setCameraError('Failed to capture photo frame. Please try again.');
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/80 backdrop-blur-xs p-4 animate-auth-fade"
      onClick={handleCancel}
    >
      <div 
        className="w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Live Item Camera</h3>
              <p className="text-[11px] text-stone-500">Capture clear photograph for inventory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-50 transition cursor-pointer"
            aria-label="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Preview Viewport */}
        <div className="relative bg-stone-950 aspect-4/3 flex items-center justify-center overflow-hidden">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#C85A32]" />
              <span className="text-xs font-medium">Starting camera...</span>
            </div>
          )}

          {cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-stone-200 leading-relaxed font-medium">{cameraError}</p>
              <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Retry Camera
                </button>
                {onFallbackToFileUpload && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCancel();
                      onFallbackToFileUpload();
                    }}
                    className="px-4 py-2 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File Instead</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-8 pointer-events-none border border-white/25 rounded-2xl flex items-center justify-center">
                <div className="w-8 h-8 border-t-2 border-l-2 border-white/70 absolute top-0 left-0 rounded-tl-lg" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-white/70 absolute top-0 right-0 rounded-tr-lg" />
                <div className="w-8 h-8 border-b-2 border-l-2 border-white/70 absolute bottom-0 left-0 rounded-bl-lg" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-white/70 absolute bottom-0 right-0 rounded-br-lg" />
              </div>

              {/* Flip camera button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs transition cursor-pointer shadow-md"
                title="Switch Camera"
                aria-label="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}

          {isCapturing && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#C85A32]" />
              <span className="text-xs font-bold text-stone-900">Optimizing photograph…</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-stone-50 flex items-center justify-between gap-3 border-t border-stone-100">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCapturing}
            className="px-5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          {!cameraError && (
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={isLoading || isCapturing}
              className="flex-1 max-w-[200px] py-3 px-6 bg-[#C85A32] hover:bg-[#B84E27] disabled:bg-stone-300 disabled:text-stone-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-[#C85A32]/20 cursor-pointer active:scale-95"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing…</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span>Take Photo</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
