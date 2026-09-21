import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, X, Flashlight, Barcode } from 'lucide-react';

export const ScannerModal: React.FC = () => {
  const {
    isScannerModalOpen,
    setIsScannerModalOpen,
    hardwareScannerSource,
    setHardwareScannerSource,
    inventory,
    addToCart,
    showToast
  } = useApp();

  const [flashlightOn, setFlashlightOn] = useState(false);

  if (!isScannerModalOpen) return null;

  const testBarcodes = [
    { label: 'Samsung Galaxy A53', sku: 'LM-9021', type: 'Forfeited' },
    { label: 'Makita Angle Grinder', sku: 'LM-8840', type: 'Buy' },
    { label: 'Hisense 43" Smart TV', sku: 'LM-7712', type: 'Forfeited' },
    { label: 'PlayStation 4 Slim', sku: 'LM-9104', type: 'Buy' },
    { label: 'Pawn Ticket #PWN-8829', sku: 'PWN-8829', type: 'Pawn' }
  ];

  const handleSimulateScan = (sku: string) => {
    const item = inventory.find(i => i.sku === sku || i.pawnTicketId === `#${sku}` || i.sku.includes(sku));
    if (item && item.status === 'Retail Floor') {
      addToCart(item);
      setIsScannerModalOpen(false);
    } else {
      showToast('Barcode Captured', `Scanned SKU #${sku}`, 'info');
      setIsScannerModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E87A5D]" />
            <h3 className="font-bold text-sm text-white font-headline">
              Hardware Scanner &amp; Camera Feed
            </h3>
          </div>
          <button
            onClick={() => setIsScannerModalOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Feed */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-full h-56 rounded-xl bg-black overflow-hidden flex items-center justify-center border-2 border-dashed border-[#C85A32]/60">
            {/* Viewfinder Reticle */}
            <div className="absolute inset-8 border border-white/40 rounded-lg pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <span className="w-3 h-3 border-t-2 border-l-2 border-[#E87A5D]"></span>
                <span className="w-3 h-3 border-t-2 border-r-2 border-[#E87A5D]"></span>
              </div>
              {/* Laser line animation */}
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
              <div className="flex justify-between">
                <span className="w-3 h-3 border-b-2 border-l-2 border-[#E87A5D]"></span>
                <span className="w-3 h-3 border-b-2 border-r-2 border-[#E87A5D]"></span>
              </div>
            </div>

            <div className="text-center z-10 space-y-1">
              <Barcode className="w-12 h-12 text-[#E87A5D] mx-auto animate-pulse" />
              <p className="text-xs font-mono text-gray-300">Point lens at thermal asset tag or RSA ID barcode</p>
              <p className="text-[10px] text-emerald-400 font-mono">
                {hardwareScannerSource === 'phone' ? 'Mobile Phone Cam (Paired)' : 'USB Optical Engine Active'}
              </p>
            </div>
          </div>

          {/* Quick Hardware Controls */}
          <div className="flex items-center justify-between w-full text-xs">
            <select
              value={hardwareScannerSource}
              onChange={(e) => setHardwareScannerSource(e.target.value)}
              className="bg-[#121212] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-gray-300 text-xs font-mono focus:outline-none"
            >
              <option value="phone">Mobile Phone Cam (Paired)</option>
              <option value="usb">USB HD Scanner Cam</option>
              <option value="webcam">Integrated Cam</option>
            </select>

            <button
              type="button"
              onClick={() => setFlashlightOn(!flashlightOn)}
              className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                flashlightOn
                  ? 'bg-amber-400 text-black border-amber-300 font-bold'
                  : 'bg-[#121212] border-[#2A2A2A] text-gray-400 hover:text-white'
              }`}
            >
              <Flashlight className="w-3.5 h-3.5" />
              <span>{flashlightOn ? 'Flash On' : 'Flashlight'}</span>
            </button>
          </div>

          {/* Rapid Test Barcodes for Cashier Simulation */}
          <div className="w-full bg-[#141414] p-3 rounded-xl border border-[#2A2A2A] space-y-2">
            <span className="text-[10px] uppercase font-mono text-gray-400 tracking-wider block">
              Quick Test Barcodes (Click to Scan Into Till)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {testBarcodes.map(tb => (
                <button
                  key={tb.sku}
                  type="button"
                  onClick={() => handleSimulateScan(tb.sku)}
                  className="p-2 rounded-lg bg-[#1E1E1E] hover:bg-[#C85A32] text-gray-300 hover:text-white border border-[#2A2A2A] text-left transition flex items-center justify-between"
                >
                  <span className="truncate">{tb.label}</span>
                  <span className="text-[10px] opacity-75 font-bold">#{tb.sku}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
