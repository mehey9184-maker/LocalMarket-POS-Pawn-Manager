import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { PawnLoan } from '../../types';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Lock,
  AlertTriangle,
  Store,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  Printer,
  Fingerprint,
  ArrowRight,
  Archive,
  Layers,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const VaultItemRow: React.FC<{ loan: PawnLoan; onArchive: (id: string) => void }> = ({ loan, onArchive }) => {
  const x = useMotionValue(0);
  const [hasVibrated, setHasVibrated] = React.useState(false);

  // Dynamic transforms for visual feedback
  const iconScale = useTransform(x, [0, -40, -80], [0.6, 1.1, 1.3]);
  const bgOpacity = useTransform(x, [0, -40], [0.2, 1]);
  const overlayOpacity = useTransform(x, [0, -80], [0, 0.4]);
  const buttonOpacity = useTransform(x, [0, -20, -40], [0, 0, 1]);
  const buttonX = useTransform(x, [0, -40], [20, 0]);

  // Haptic Feedback Simulation
  React.useEffect(() => {
    return x.on('change', (latest) => {
      if (latest < -40 && !hasVibrated) {
        if ('vibrate' in navigator) navigator.vibrate(10);
        setHasVibrated(true);
      } else if (latest > -30 && hasVibrated) {
        setHasVibrated(false);
      }
    });
  }, [x, hasVibrated]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className="relative group overflow-hidden rounded-xl h-full min-h-[140px]"
    >
      {/* Swipe Background (Archive Action) */}
      <motion.div 
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-[#C85A32] flex items-center justify-end px-4 rounded-xl border border-[#C85A32]/40"
      >
        <motion.div 
          style={{ x: buttonX, opacity: buttonOpacity }}
          className="flex items-center gap-2"
        >
          <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Archive Record</span>
          <motion.div style={{ scale: iconScale }} className="p-2 bg-white/10 rounded-lg">
            <Archive className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragSnapToOrigin
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -40) {
            onArchive(loan.id);
          }
        }}
        whileDrag={{ 
          scale: 0.98,
          transition: { type: "spring", stiffness: 400, damping: 25 } 
        }}
        animate={hasVibrated ? { scale: 0.97, transition: { duration: 0.1 } } : { scale: 1 }}
        className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-sm relative z-10 cursor-grab active:cursor-grabbing hover:border-[#383838] transition-colors h-full"
      >
        {/* Tactile Overlay */}
        <motion.div 
          style={{ opacity: overlayOpacity }}
          className="absolute inset-0 bg-black/50 pointer-events-none rounded-xl"
        />

        <div className="relative z-20">
          {/* Header: Shelf Bin & Ticket */}
          <div className="flex items-center justify-between mb-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 text-[10px] font-mono font-bold">
              {loan.vaultShelf}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{loan.ticketNumber}</span>
          </div>

          {/* Image & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-lg bg-[#141414] border border-[#2A2A2A] overflow-hidden shrink-0">
              <img
                src={loan.itemImageUrl}
                alt={loan.itemTitle}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-gray-100 truncate">{loan.itemTitle}</h4>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                Pledgor: {loan.customerName}
              </p>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                SN: {loan.serialOrImei}
              </p>
            </div>
          </div>
        </div>

        {/* Footer details */}
        <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono relative z-20">
          <div>
            <span className="text-[10px] text-gray-500 block uppercase tracking-tighter">Principal</span>
            <span className="font-bold text-white tabular-nums tracking-tight text-sm">R {loan.principal.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-500 block">Term Status</span>
            {loan.daysRemaining <= 0 ? (
              <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/40 text-[10px] font-bold animate-pulse">
                RED ZONE: DAY {loan.daysElapsed}
              </span>
            ) : loan.daysRemaining <= 3 ? (
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/40 text-[10px] font-bold">
                CRITICAL: {loan.daysRemaining}d
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-400">
                {loan.daysRemaining}d left
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const VaultManager: React.FC = () => {
  const {
    inventory,
    pawnLoans,
    transferOverdueToFloor,
    batchTransferOverdue,
    archiveLoan,
    showToast
  } = useApp();

  // Active view toggle tab: 'overdue' (Day 31+) vs 'storage' (Active Vault Storage)
  const [activeTab, setActiveTab] = useState<'overdue' | 'storage'>('overdue');
  const [searchFilter, setSearchFilter] = useState('');

  // Transfer modal state
  const [selectedLoanForTransfer, setSelectedLoanForTransfer] = useState<PawnLoan | null>(null);
  const [managerPin, setManagerPin] = useState(['8', '4', '1', '9']);
  const [targetRetailPrice, setTargetRetailPrice] = useState<number>(5800);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false);

  // 1. Calculations for 3 Clean Summary Stats
  const activeVaultLoans = useMemo(() => {
    return pawnLoans.filter(l => l.status === 'Active');
  }, [pawnLoans]);

  const totalVaultOutlay = useMemo(() => {
    return activeVaultLoans.reduce((sum, l) => sum + l.principal, 0);
  }, [activeVaultLoans]);

  const overdueLoans = useMemo(() => {
    return pawnLoans.filter(
      l => (l.daysRemaining <= 0 || l.daysElapsed > 30) && l.status === 'Active'
    );
  }, [pawnLoans]);

  const totalOverdueCapital = useMemo(() => {
    return overdueLoans.reduce((sum, l) => sum + l.principal, 0);
  }, [overdueLoans]);

  const floorItems = useMemo(() => {
    return inventory.filter(i => i.status === 'Retail Floor');
  }, [inventory]);

  const totalFloorValue = useMemo(() => {
    return floorItems.reduce((sum, i) => sum + i.retailPrice, 0);
  }, [floorItems]);

  // Filtered overdue list
  const filteredOverdue = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return overdueLoans;
    return overdueLoans.filter(
      l =>
        l.itemTitle.toLowerCase().includes(q) ||
        l.ticketNumber.toLowerCase().includes(q) ||
        l.customerName.toLowerCase().includes(q) ||
        l.vaultShelf.toLowerCase().includes(q) ||
        l.serialOrImei.toLowerCase().includes(q)
    );
  }, [overdueLoans, searchFilter]);

  // Filtered active storage list
  const filteredActiveStorage = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return activeVaultLoans;
    return activeVaultLoans.filter(
      l =>
        l.itemTitle.toLowerCase().includes(q) ||
        l.ticketNumber.toLowerCase().includes(q) ||
        l.customerName.toLowerCase().includes(q) ||
        l.vaultShelf.toLowerCase().includes(q) ||
        l.serialOrImei.toLowerCase().includes(q)
    );
  }, [activeVaultLoans, searchFilter]);

  const handleOpenTransferModal = (loan: PawnLoan) => {
    setSelectedLoanForTransfer(loan);
    setTargetRetailPrice(Math.round(loan.principal * 1.8));
    setIsManagerModalOpen(true);
  };

  const handleConfirmPinTransfer = () => {
    const pin = managerPin.join('');
    if (!selectedLoanForTransfer) {
      batchTransferOverdue(pin);
      setIsManagerModalOpen(false);
      return;
    }

    const res = transferOverdueToFloor(
      selectedLoanForTransfer.ticketNumber,
      targetRetailPrice,
      pin
    );

    if (res.success) {
      setIsManagerModalOpen(false);
      setSelectedLoanForTransfer(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#121212] p-3.5 sm:p-5 gap-4">
      {/* ============================================================
          0. VAULT LOGISTICS & DENSITY (UBER LOGISTICS PATTERN)
         ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3 overflow-hidden bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-2 px-4 shadow-inner relative">
          <div className="flex items-center gap-3 whitespace-nowrap animate-marquee">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Vault Cooling Down:</span>
            </div>
            <div className="flex items-center gap-8 text-[11px] font-mono text-gray-300">
              {activeVaultLoans.slice(0, 5).map(loan => (
                <div key={loan.id} className="flex items-center gap-2">
                  <span className="text-gray-500">{loan.ticketNumber}</span>
                  <span className="font-bold text-white">{loan.itemTitle}</span>
                  <span className="text-emerald-500">[{loan.daysRemaining} Days Left]</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-2 px-4 flex items-center justify-between">
          <div>
             <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono block leading-tight">Vault Density</span>
             <div className="flex gap-1 mt-1">
               {[1, 2, 3, 4, 5].map(i => (
                 <div key={i} className={`w-2.5 h-2.5 rounded-sm ${i <= 4 ? 'bg-emerald-500/40' : 'bg-gray-800'}`} />
               ))}
             </div>
          </div>
          <span className="text-xs font-bold text-emerald-400 font-mono">82% Full</span>
        </div>
      </div>

      {/* ============================================================
          1. COLLAPSIBLE METRIC HEADER (ZEN COUNTER COMPATIBLE)
         ============================================================ */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
            Vault Inventory & Capital Status
          </span>
          <button
            type="button"
            onClick={() => setIsMetricsCollapsed(prev => !prev)}
            className="text-xs text-[#E87A5D] hover:text-[#f0967d] flex items-center gap-1 font-mono transition"
          >
            {isMetricsCollapsed ? (
              <>
                <span>Expand Metrics</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Collapse to Ticker</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {isMetricsCollapsed ? (
          /* Sleek single-line ticker (saves 150px vertical screen real estate) */
          <div className="bg-[#1E1E1E] rounded-xl px-4 py-2.5 border border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-gray-400">Active Holds:</span>
              <strong className="text-white">{activeVaultLoans.length}</strong>
              <span className="text-gray-500">(R {totalVaultOutlay.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-gray-400">Day 31+ Overdue:</span>
              <strong className="text-amber-400">{overdueLoans.length}</strong>
              <span className="text-gray-500">(R {totalOverdueCapital.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span className="text-gray-400">Retail Floor:</span>
              <strong className="text-emerald-400">{floorItems.length}</strong>
              <span className="text-gray-500">(R {totalFloorValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>
          </div>
        ) : (
          /* Standard 3 Stat Cards */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full animate-in fade-in duration-150">
            {/* Stat 1: Active Vault Holds */}
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A] flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">Active Vault Holds</span>
                <div className="p-2 rounded-lg bg-[#291813] text-[#E87A5D] border border-[#C85A32]/30">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white font-mono">{activeVaultLoans.length}</span>
                  <span className="text-xs text-gray-400 font-mono">Secured Items</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Total Outlay:</span>
                  <span className="text-[#E87A5D] font-bold">
                    R {totalVaultOutlay.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Stat 2: Forfeited / Overdue Items (Pending Action) */}
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#C85A32]/50 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#E87A5D] font-mono uppercase tracking-wider font-bold">
                  Forfeited / Overdue Items
                </span>
                <div className="px-2 py-1 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/40 text-[10px] font-mono font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Pending Action</span>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400 font-mono">{overdueLoans.length}</span>
                  <span className="text-xs text-amber-400/80 font-mono">Day 31+ Contracts</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Forfeited Capital:</span>
                  <span className="text-amber-400 font-bold">
                    R {totalOverdueCapital.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Stat 3: Retail Floor Stock */}
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A] flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">Retail Floor Stock</span>
                <div className="p-2 rounded-lg bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400 font-mono">{floorItems.length}</span>
                  <span className="text-xs text-gray-400 font-mono">Active POS Items</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#2A2A2A] flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Total Floor Value:</span>
                  <span className="text-emerald-400 font-bold">
                    R {totalFloorValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          2. VIEW TOGGLE TABS & SEARCH
         ============================================================ */}
      <div className="bg-[#1E1E1E] rounded-xl p-3 border border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        {/* View Toggle Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition flex-1 sm:flex-initial justify-center ${
              activeTab === 'overdue'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-gray-200 border border-[#2A2A2A]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue &amp; Forfeits (Day 31+)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {overdueLoans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition flex-1 sm:flex-initial justify-center ${
              activeTab === 'storage'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-gray-200 border border-[#2A2A2A]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Active Vault Storage</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {activeVaultLoans.length}
            </span>
          </button>

          {activeTab === 'overdue' && overdueLoans.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedLoanForTransfer(null);
                setIsManagerModalOpen(true);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter flex items-center gap-2 transition flex-1 sm:flex-initial justify-center bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 animate-in slide-in-from-left-2`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>One-Tap Sweep Overdue</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
                {overdueLoans.length}
              </span>
            </button>
          )}
        </div>

        {/* Filter input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search ticket, item, or bin shelf..."
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#C85A32] font-mono"
          />
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* ============================================================
          TAB 1: OVERDUE & FORFEITS (DAY 31+) - ACTION CARDS
         ============================================================ */}
      {activeTab === 'overdue' && (
        <div className="space-y-3">
          {filteredOverdue.length === 0 ? (
            <div className="p-8 text-center bg-[#1E1E1E] rounded-xl border border-dashed border-[#2A2A2A]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-bold text-gray-200 text-sm">No Overdue Pawns Requiring Sign-Off</p>
              <p className="text-xs text-gray-500 mt-1">
                All active collateral items are within their statutory 30-day term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredOverdue.map(loan => {
                const daysOverdue = Math.max(1, Math.abs(loan.daysRemaining));
                return (
                  <div
                    key={loan.id}
                    className="bg-[#1E1E1E] rounded-xl p-3.5 border border-[#2A2A2A] hover:border-[#C85A32]/60 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                  >
                    {/* Item Image + Title + Bin Shelf + Pledgor Name + Days Overdue */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-lg bg-[#141414] border border-[#2A2A2A] overflow-hidden shrink-0">
                        <img
                          src={loan.itemImageUrl}
                          alt={loan.itemTitle}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-white font-headline truncate">
                            {loan.itemTitle}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-[#141414] text-[#E87A5D] font-mono text-[10px] font-bold border border-[#2A2A2A]">
                            {loan.ticketNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mt-1 flex-wrap">
                          <span>
                            Bin Shelf: <strong className="text-emerald-400 font-bold">{loan.vaultShelf}</strong>
                          </span>
                          <span className="text-gray-600">•</span>
                          <span>Pledgor: <span className="text-gray-300">{loan.customerName}</span></span>
                          <span className="text-gray-600">•</span>
                          <span className="text-amber-400 font-bold">+{daysOverdue} Days Overdue</span>
                        </div>
                      </div>
                    </div>

                    {/* Principal and Single Primary Action Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2A2A2A] shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-gray-500 font-mono block uppercase">Principal Outlay</span>
                        <span className="text-sm font-bold text-white font-mono">
                          R {loan.principal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTransferModal(loan)}
                        className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d29] text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve Floor Transfer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TAB 2: ACTIVE VAULT STORAGE - SEARCHABLE INVENTORY IN BINS
         ============================================================ */}
      {activeTab === 'storage' && (
        <div className="space-y-3">
          {filteredActiveStorage.length === 0 ? (
            <div className="p-8 text-center bg-[#1E1E1E] rounded-xl border border-dashed border-[#2A2A2A]">
              <Archive className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="font-bold text-gray-300 text-sm">No Active Vault Items Found</p>
              <p className="text-xs text-gray-500 mt-1">Try searching with a different term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence initial={false}>
                {filteredActiveStorage.map(loan => (
                  <VaultItemRow 
                    key={loan.id} 
                    loan={loan} 
                    onArchive={archiveLoan} 
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          FLOOR TRANSFER CONFIRMATION MODAL
         ============================================================ */}
      {isManagerModalOpen && selectedLoanForTransfer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#161616]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E87A5D]" />
                <h3 className="font-bold text-sm text-white font-headline">
                  Approve Floor Transfer &amp; Resale Markup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManagerModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Item Summary */}
              <div className="p-3 bg-[#141414] rounded-xl border border-[#2A2A2A] flex items-center gap-3">
                <img
                  src={selectedLoanForTransfer.itemImageUrl}
                  alt={selectedLoanForTransfer.itemTitle}
                  className="w-12 h-12 rounded-lg object-cover border border-[#2A2A2A]"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{selectedLoanForTransfer.itemTitle}</h4>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                    Ticket: <strong className="text-[#E87A5D]">{selectedLoanForTransfer.ticketNumber}</strong> • Shelf: <strong className="text-emerald-400">{selectedLoanForTransfer.vaultShelf}</strong>
                  </p>
                </div>
              </div>

              {/* Set Retail Resale Markup Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">
                  Set Retail Resale Floor Price (R)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-[#E87A5D] font-bold font-mono">R</span>
                  <input
                    type="number"
                    value={targetRetailPrice}
                    onChange={(e) => setTargetRetailPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-xl pl-8 pr-4 py-2 text-white font-bold font-mono focus:border-[#C85A32] focus:outline-none text-base"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 font-mono pt-1">
                  <span>Acquisition Cost: R {selectedLoanForTransfer.principal.toFixed(2)}</span>
                  <span className="text-emerald-400 font-bold">
                    Projected Margin: R {(targetRetailPrice - selectedLoanForTransfer.principal).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* LIQUIDITY PRESETS (ALGORITHMIC PRICING) */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono block">Liquidity Pricing Presets</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 1.45))}
                    className="p-2 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-emerald-500/50 text-center transition group"
                  >
                    <span className="text-[10px] text-gray-400 block group-hover:text-emerald-400">Fire Sale</span>
                    <span className="text-xs font-bold text-white">45% Markup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 1.85))}
                    className="p-2 rounded-xl bg-[#291813] border border-[#C85A32]/40 text-center transition"
                  >
                    <span className="text-[10px] text-[#E87A5D] block">Standard</span>
                    <span className="text-xs font-bold text-white">85% Markup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 2.25))}
                    className="p-2 rounded-xl bg-[#141414] border border-[#2A2A2A] hover:border-blue-500/50 text-center transition group"
                  >
                    <span className="text-[10px] text-gray-400 block group-hover:text-blue-400">Premium</span>
                    <span className="text-xs font-bold text-white">125% Markup</span>
                  </button>
                </div>
              </div>

              {/* Manager PIN Verification */}
              <div className="p-3.5 bg-[#141414] rounded-xl border border-[#2A2A2A] space-y-2">
                <span className="text-xs font-semibold text-gray-300 block">
                  Manager Authorization PIN (Default: 8419)
                </span>
                <div className="flex gap-2 justify-center">
                  {managerPin.map((digit, idx) => (
                    <input
                      key={idx}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const newPin = [...managerPin];
                        newPin[idx] = e.target.value.slice(-1);
                        setManagerPin(newPin);
                      }}
                      className="w-12 h-12 text-center rounded-xl bg-[#1E1E1E] border border-[#2A2A2A] text-lg font-bold text-white font-mono focus:border-[#C85A32] focus:outline-none"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#161616] border-t border-[#2A2A2A] flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono">
                Syncs immediately to POS Floor Stock
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsManagerModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPinTransfer}
                  className="px-5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d29] text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <span>Authorize &amp; Transfer to POS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
