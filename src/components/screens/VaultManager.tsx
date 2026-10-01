import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useInventory } from '../../context/InventoryContext';
import { useLoans } from '../../context/LoanContext';
import { useAuth } from '../../context/AuthContext';
import { PawnLoan } from '../../types';
import * as ReactWindow from 'react-window';
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';

const FixedSizeList = (ReactWindow as any).List;
const AutoSizer = (AutoSizerComponent as any);
import {
  Lock,
  AlertTriangle,
  Store,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  ArrowRight,
  Archive,
  Layers,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Banknote,
  CreditCard,
  Loader2,
  Calendar,
  Tag,
  Hash,
  User,
  Phone,
  FileText
} from 'lucide-react';
import { OnboardingOverlay } from '../common/OnboardingOverlay';

export const VaultManager: React.FC = () => {
  const { showToast, businessRules } = useApp();
  const { verifyManagerPin, isManager, isAtLeastSeniorCashier } = useAuth();
  const { inventory } = useInventory();
  const { 
    loans, 
    archiveLoan, 
    transferOverdueToFloor, 
    approveForfeiture, 
    rejectForfeiture,
    batchTransferOverdue,
    batchApproveForfeitures,
    redeemLoan,
    extendLoan
  } = useLoans();

  // Active Vault is the practical default first view
  const [activeTab, setActiveTab] = useState<'storage' | 'overdue' | 'review'>('storage');
  const [searchFilter, setSearchFilter] = useState('');

  // Active Pawn detail drawer state
  const [selectedLoanForDetail, setSelectedLoanForDetail] = useState<PawnLoan | null>(null);
  const [settlementOption, setSettlementOption] = useState<'redeem' | 'extend'>('redeem');
  const [tenderMethod, setTenderMethod] = useState<'cash' | 'card'>('cash');
  const [isProcessingSettlement, setIsProcessingSettlement] = useState(false);

  // Overdue transfer modal state
  const [selectedLoanForTransfer, setSelectedLoanForTransfer] = useState<PawnLoan | null>(null);
  const [managerPin, setManagerPin] = useState(['', '', '', '', '', '']);
  const [targetRetailPrice, setTargetRetailPrice] = useState<number>(0);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false);

  // Calculate live countdown / days remaining based on actual dates
  const getLiveDaysRemaining = (loan: PawnLoan): number => {
    if (!loan.expiryDate) return loan.daysRemaining;
    const expiry = new Date(loan.expiryDate).getTime();
    const now = Date.now();
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  };

  const activeVaultLoans = useMemo(() => loans.filter(l => l.status === 'Active'), [loans]);
  const totalVaultOutlay = useMemo(() => activeVaultLoans.reduce((sum, l) => sum + l.principal, 0), [activeVaultLoans]);
  
  const overdueLoans = useMemo(() => loans.filter(l => {
    if (l.status !== 'Active') return false;
    const liveRemaining = getLiveDaysRemaining(l);
    return liveRemaining <= 0 || l.daysElapsed > businessRules.defaultLoanTermDays;
  }), [loans, businessRules.defaultLoanTermDays]);

  const totalOverdueCapital = useMemo(() => overdueLoans.reduce((sum, l) => sum + l.principal, 0), [overdueLoans]);

  const reviewQueueLoans = useMemo(() => loans.filter(l => l.status === 'Pending Forfeit'), [loans]);
  
  const floorItems = useMemo(() => inventory.filter(i => i.status === 'Retail Floor'), [inventory]);
  const totalFloorValue = useMemo(() => floorItems.reduce((sum, i) => sum + i.retailPrice, 0), [floorItems]);

  const filteredActiveStorage = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return activeVaultLoans;
    return activeVaultLoans.filter(l => 
      l.itemTitle.toLowerCase().includes(q) || 
      l.ticketNumber.toLowerCase().includes(q) || 
      l.customerName.toLowerCase().includes(q) || 
      l.vaultShelf.toLowerCase().includes(q) || 
      l.serialOrImei.toLowerCase().includes(q)
    );
  }, [activeVaultLoans, searchFilter]);

  const filteredOverdue = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return overdueLoans;
    return overdueLoans.filter(l => 
      l.itemTitle.toLowerCase().includes(q) || 
      l.ticketNumber.toLowerCase().includes(q) || 
      l.customerName.toLowerCase().includes(q) || 
      l.vaultShelf.toLowerCase().includes(q) || 
      l.serialOrImei.toLowerCase().includes(q)
    );
  }, [overdueLoans, searchFilter]);

  const filteredReviewQueue = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    if (!q) return reviewQueueLoans;
    return reviewQueueLoans.filter(l => 
      l.itemTitle.toLowerCase().includes(q) || 
      l.ticketNumber.toLowerCase().includes(q) || 
      l.customerName.toLowerCase().includes(q) || 
      l.vaultShelf.toLowerCase().includes(q) || 
      l.serialOrImei.toLowerCase().includes(q)
    );
  }, [reviewQueueLoans, searchFilter]);

  // Lookup matching catalog item for brand and model specifications
  const matchingDetailInventoryItem = useMemo(() => {
    if (!selectedLoanForDetail) return null;
    return inventory.find(i => i.id === selectedLoanForDetail.itemId || i.pawnTicketId === selectedLoanForDetail.ticketNumber);
  }, [selectedLoanForDetail, inventory]);

  const brandModelText = useMemo(() => {
    if (!matchingDetailInventoryItem) return null;
    const parts = [matchingDetailInventoryItem.brand, matchingDetailInventoryItem.model].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }, [matchingDetailInventoryItem]);

  const handleOpenTransferModal = (loan: PawnLoan) => {
    setSelectedLoanForTransfer(loan);
    setTargetRetailPrice(Math.round(loan.principal * businessRules.defaultRetailMarkupMultiplier));
    setIsManagerModalOpen(true);
  };

  const handleConfirmPinTransfer = async () => {
    const pinStr = managerPin.join('');
    const authRes = await verifyManagerPin(pinStr);
    
    if (!authRes.success) {
      showToast('Invalid Manager PIN', 'error');
      setManagerPin(['', '', '', '', '', '']);
      return;
    }

    if (!selectedLoanForTransfer) {
      const res = await batchTransferOverdue();
      showToast(`Moved ${res.count} items to review queue.`, 'success');
      setIsManagerModalOpen(false);
      return;
    }

    const res = await transferOverdueToFloor(
      selectedLoanForTransfer.ticketNumber,
      targetRetailPrice
    );

    if (res.success) {
      showToast('Item moved to Forfeiture Review Queue.', 'success');
      setIsManagerModalOpen(false);
      setSelectedLoanForTransfer(null);
    } else {
      showToast(res.error || 'Transfer failed', 'error');
    }
  };

  const handleApproveForfeit = async (loan: PawnLoan) => {
    const res = await approveForfeiture(loan.id, (loan as any).retailPrice || loan.principal * 2);
    if (res.success) {
      showToast('Forfeiture finalized. Item is now on the Retail Floor.', 'success');
    }
  };

  const handleRejectForfeit = async (loan: PawnLoan) => {
    const res = await rejectForfeiture(loan.id);
    if (res.success) {
      showToast('Forfeiture rejected. Item returned to Vault Holds.', 'success');
    }
  };

  const handleExecuteSettlement = async () => {
    if (!selectedLoanForDetail) return;
    setIsProcessingSettlement(true);
    try {
      if (settlementOption === 'redeem') {
        const res = await redeemLoan(selectedLoanForDetail.ticketNumber, selectedLoanForDetail.totalRedemptionAmount);
        if (res.success) {
          showToast('Collateral Redeemed', `Ticket ${selectedLoanForDetail.ticketNumber} settled. Asset released from vault.`, 'success');
          setSelectedLoanForDetail(null);
        } else {
          showToast('Redemption Failed', res.error || 'Failed to redeem loan.', 'error');
        }
      } else {
        const res = await extendLoan(selectedLoanForDetail.ticketNumber, selectedLoanForDetail.extensionFee);
        if (res.success) {
          showToast('Term Extended', `Ticket ${selectedLoanForDetail.ticketNumber} extended by 30 days.`, 'success');
          setSelectedLoanForDetail(null);
        } else {
          showToast('Extension Failed', res.error || 'Failed to extend loan.', 'error');
        }
      }
    } finally {
      setIsProcessingSettlement(false);
    }
  };

  // Clean, easy-to-scan list row for Active Vault collateral
  const ActiveVaultRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const loan = filteredActiveStorage[index];
    if (!loan) return null;
    const liveDays = getLiveDaysRemaining(loan);
    const isOverdue = liveDays <= 0;
    const isCritical = liveDays > 0 && liveDays <= 5;

    return (
      <div style={style} className="px-1 py-1.5">
        <div
          data-testid={`active-pawn-row-${loan.ticketNumber}`}
          onClick={() => {
            setSelectedLoanForDetail(loan);
            setSettlementOption('redeem');
          }}
          className="bg-white rounded-xl p-3.5 border border-stone-200 hover:border-[#C85A32] hover:shadow-sm transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs h-full group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-lg bg-stone-50 border border-stone-200 overflow-hidden shrink-0 group-hover:border-[#C85A32]/40 transition">
              <img
                src={loan.itemImageUrl}
                alt={loan.itemTitle}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs sm:text-sm text-stone-900 font-headline truncate group-hover:text-[#C85A32] transition">
                  {loan.itemTitle}
                </h4>
                <span className="px-2 py-0.5 rounded bg-stone-50 text-[#C85A32] font-mono text-[10px] font-bold border border-stone-200">
                  {loan.ticketNumber}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold border border-emerald-200">
                  Shelf: {loan.vaultShelf}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500 font-mono mt-1 flex-wrap">
                <span>Pledgor: <strong className="text-stone-700 font-sans font-semibold">{loan.customerName}</strong></span>
                {loan.serialOrImei && loan.serialOrImei !== 'N/A' && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span>SN: <span className="text-stone-600">{loan.serialOrImei}</span></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-stone-400 font-mono block uppercase">Principal</span>
              <span className="text-sm font-bold text-stone-800 font-mono">
                R {loan.principal.toFixed(2)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-stone-400 font-mono block uppercase">Countdown</span>
              {isOverdue ? (
                <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold font-mono inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  {Math.abs(liveDays)}d Overdue
                </span>
              ) : isCritical ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  {liveDays}d left
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-600" />
                  {liveDays}d left
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center text-stone-400 group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OverdueRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const loan = filteredOverdue[index];
    if (!loan) return null;
    const liveDays = getLiveDaysRemaining(loan);
    const daysOverdue = Math.max(1, Math.abs(liveDays));
    return (
      <div style={style} className="px-1 py-1.5">
        <div className="bg-white rounded-xl p-3.5 border border-stone-200 hover:border-[#C85A32]/60 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs h-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-lg bg-stone-50 border border-stone-200 overflow-hidden shrink-0">
              <img src={loan.itemImageUrl} alt={loan.itemTitle} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs sm:text-sm text-stone-900 font-headline truncate">{loan.itemTitle}</h4>
                <span className="px-2 py-0.5 rounded bg-stone-50 text-[#C85A32] font-mono text-[10px] font-bold border border-stone-200">{loan.ticketNumber}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500 font-mono mt-1 flex-wrap">
                <span>Bin Shelf: <strong className="text-emerald-600 font-bold">{loan.vaultShelf}</strong></span>
                <span className="text-stone-300">•</span>
                <span>Pledgor: <span className="text-stone-600">{loan.customerName}</span></span>
                <span className="text-stone-300">•</span>
                <span className="text-red-600 font-bold">+{daysOverdue} Days Overdue</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-stone-400 font-mono block uppercase">Principal Outlay</span>
              <span className="text-sm font-bold text-stone-800 font-mono">R {loan.principal.toFixed(2)}</span>
            </div>
            <button type="button" onClick={() => handleOpenTransferModal(loan)} className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#B84E27] text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer">
              <ShieldCheck className="w-4 h-4" />
              <span>Transfer to Review</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReviewRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const loan = filteredReviewQueue[index];
    if (!loan) return null;
    const suggestedPrice = (loan as any).retailPrice || loan.principal * 2;
    return (
      <div style={style} className="px-1 py-1.5">
        <div className="bg-white rounded-xl p-3.5 border border-amber-200 hover:border-amber-400 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs h-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 rounded-lg bg-stone-50 border border-stone-200 overflow-hidden shrink-0">
              <img src={loan.itemImageUrl} alt={loan.itemTitle} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-xs sm:text-sm text-stone-900 font-headline truncate">{loan.itemTitle}</h4>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[10px] font-bold border border-amber-200">PENDING REVIEW</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500 font-mono mt-1 flex-wrap">
                <span>Proposed Retail: <strong className="text-emerald-600 font-bold">R {suggestedPrice.toFixed(2)}</strong></span>
                <span className="text-stone-300">•</span>
                <span>Cost: <span className="text-stone-600">R {loan.principal.toFixed(2)}</span></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => handleRejectForfeit(loan)}
              className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition cursor-pointer"
              title="Reject & Return to Vault"
            >
              <X className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleApproveForfeit(loan)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalize Forfeit</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50/60 p-3.5 sm:p-5 gap-4 relative overflow-hidden">
      <OnboardingOverlay screenId="vault" />
      
      {/* Ticker Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
        <div className="md:col-span-3 overflow-hidden bg-white border border-stone-200 rounded-xl py-2 px-4 shadow-xs relative">
          <div className="flex items-center gap-3 whitespace-nowrap animate-marquee">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono">Vault Storage:</span>
            </div>
            <div className="flex items-center gap-8 text-[11px] font-mono text-stone-600">
              {activeVaultLoans.slice(0, 5).map(loan => {
                const days = getLiveDaysRemaining(loan);
                return (
                  <div key={loan.id} className="flex items-center gap-2">
                    <span className="text-stone-400">{loan.ticketNumber}</span>
                    <span className="font-bold text-stone-700">{loan.itemTitle}</span>
                    <span className={days <= 5 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                      [{days <= 0 ? 'Overdue' : `${days} Days Left`}]
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Real Vault Collateral metric (No fake 82% percentage) */}
        <div className="bg-white border border-stone-200 rounded-xl py-2 px-4 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono block leading-tight">Secured Collateral</span>
            <span className="text-xs font-bold text-stone-800 font-mono block mt-0.5">{activeVaultLoans.length} Pledges Shelved</span>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Lock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Metrics Header */}
      <div className="w-full space-y-2 shrink-0">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider font-mono">Vault Inventory &amp; Capital Status</span>
          <button type="button" onClick={() => setIsMetricsCollapsed(prev => !prev)} className="text-xs text-[#C85A32] hover:text-[#B84E27] flex items-center gap-1 font-mono transition cursor-pointer">
            {isMetricsCollapsed ? <><span>Expand Metrics</span><ChevronDown className="w-3.5 h-3.5" /></> : <><span>Collapse to Ticker</span><ChevronUp className="w-3.5 h-3.5" /></>}
          </button>
        </div>
        {isMetricsCollapsed ? (
          <div className="bg-white rounded-xl px-4 py-2.5 border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xs text-stone-700">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-stone-400">Active Holds:</span>
              <strong className="text-stone-800">{activeVaultLoans.length}</strong>
              <span className="text-stone-500">(R {totalVaultOutlay.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-stone-400">Overdue:</span>
              <strong className="text-amber-500">{overdueLoans.length}</strong>
              <span className="text-stone-500">(R {totalOverdueCapital.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span className="text-stone-400">Retail Floor:</span>
              <strong className="text-emerald-600">{floorItems.length}</strong>
              <span className="text-stone-500">(R {totalFloorValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full animate-in fade-in duration-150">
            <div className="bg-white rounded-xl p-4 border border-stone-200 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-mono uppercase tracking-wider">Active Vault Holds</span>
                <div className="p-2 rounded-lg bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/25"><Lock className="w-4 h-4" /></div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-stone-850 font-mono">{activeVaultLoans.length}</span><span className="text-xs text-stone-400 font-mono">Secured Items</span></div>
                <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono"><span className="text-stone-400">Total Outlay:</span><span className="text-[#C85A32] font-bold">R {totalVaultOutlay.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#C85A32]/40 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#C85A32] font-mono uppercase tracking-wider font-bold">Overdue / Forfeit Contracts</span>
                <div className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /><span>Pending Action</span></div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-amber-500 font-mono">{overdueLoans.length}</span><span className="text-xs text-amber-600 font-mono">Contracts</span></div>
                <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono"><span className="text-stone-400">Forfeited Capital:</span><span className="text-amber-500 font-bold">R {totalOverdueCapital.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-stone-200 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 font-mono uppercase tracking-wider">Retail Floor Stock</span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100"><Store className="w-4 h-4" /></div>
              </div>
              <div className="pt-2">
                <div className="flex items-baseline gap-2"><span className="text-2xl font-black text-emerald-600 font-mono">{floorItems.length}</span><span className="text-xs text-stone-400 font-mono">Active POS Items</span></div>
                <div className="pt-2 mt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono"><span className="text-stone-400">Total Floor Value:</span><span className="text-emerald-600 font-bold">R {totalFloorValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs and Search - Active Vault is First and Default */}
      <div className="bg-white rounded-xl p-3 border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button 
            type="button" 
            data-testid="tab-active-vault"
            onClick={() => setActiveTab('storage')} 
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition flex-1 sm:flex-initial justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 cursor-pointer ${activeTab === 'storage' ? 'bg-[#C85A32] text-white border border-[#C85A32]' : 'bg-stone-50 text-stone-500 hover:text-stone-900 border border-stone-200'}`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Active Vault</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'storage' ? 'bg-black/20 text-white' : 'bg-stone-200/50 text-stone-600'}`}>{activeVaultLoans.length}</span>
          </button>
          
          <button 
            type="button" 
            data-testid="tab-overdue-vault"
            onClick={() => setActiveTab('overdue')} 
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition flex-1 sm:flex-initial justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 cursor-pointer ${activeTab === 'overdue' ? 'bg-[#C85A32] text-white border border-[#C85A32]' : 'bg-stone-50 text-stone-500 hover:text-stone-900 border border-stone-200'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue &amp; Forfeits</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'overdue' ? 'bg-black/20 text-white' : 'bg-stone-200/50 text-stone-600'}`}>{overdueLoans.length}</span>
          </button>

          <button 
            type="button" 
            data-testid="tab-review-vault"
            onClick={() => setActiveTab('review')} 
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition flex-1 sm:flex-initial justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32] focus-visible:ring-offset-2 cursor-pointer ${activeTab === 'review' ? 'bg-[#C85A32] text-white border border-[#C85A32]' : 'bg-stone-50 text-stone-500 hover:text-stone-900 border border-stone-200'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Review Queue</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'review' ? 'bg-black/20 text-white' : 'bg-stone-200/50 text-stone-600'}`}>{reviewQueueLoans.length}</span>
          </button>

          {activeTab === 'overdue' && overdueLoans.length > 0 && (
            <button type="button" onClick={() => { setSelectedLoanForTransfer(null); setIsManagerModalOpen(true); }} className="px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter flex items-center gap-2 transition flex-1 sm:flex-initial justify-center bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/10 cursor-pointer">
              <Layers className="w-3.5 h-3.5" /><span>Batch Transfer</span>
            </button>
          )}

          {activeTab === 'review' && reviewQueueLoans.length > 0 && (
            <button type="button" onClick={() => batchApproveForfeitures(reviewQueueLoans.map(l => l.id))} className="px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-tighter flex items-center gap-2 transition flex-1 sm:flex-initial justify-center bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/10 cursor-pointer">
              <CheckCircle2 className="w-3.5 h-3.5" /><span>Approve All</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <input 
            type="text" 
            value={searchFilter} 
            onChange={(e) => setSearchFilter(e.target.value)} 
            placeholder="Search ticket, item, or bin shelf..." 
            className="w-full bg-white border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#C85A32] font-mono shadow-xs" 
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Main List with Virtualization */}
      <div className="flex-1 min-h-0 bg-stone-50/30 rounded-xl border border-stone-200 overflow-hidden relative">
        <AutoSizer>
          {({ height, width }: any) => {
            if (activeTab === 'storage') {
              return (
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={filteredActiveStorage.length}
                  itemSize={88}
                >
                  {({ index, style }: any) => (
                    <ActiveVaultRow index={index} style={style} />
                  )}
                </FixedSizeList>
              );
            } else if (activeTab === 'overdue') {
              return (
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={filteredOverdue.length}
                  itemSize={100}
                >
                  {({ index, style }: any) => (
                    <OverdueRow index={index} style={style} />
                  )}
                </FixedSizeList>
              );
            } else {
              return (
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={filteredReviewQueue.length}
                  itemSize={100}
                >
                  {({ index, style }: any) => (
                    <ReviewRow index={index} style={style} />
                  )}
                </FixedSizeList>
              );
            }
          }}
        </AutoSizer>

        {(activeTab === 'storage' && filteredActiveStorage.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-stone-100/50">
            <div>
              <Archive className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="font-bold text-stone-800 text-sm">No Active Vault Items Found</p>
              <p className="text-xs text-stone-500 mt-1">Collateral currently secured in the vault will appear here.</p>
            </div>
          </div>
        )}

        {(activeTab === 'overdue' && filteredOverdue.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-stone-100/50">
            <div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-stone-800 text-sm">No Overdue Pawns Requiring Sign-Off</p>
              <p className="text-xs text-stone-500 mt-1">All active collateral items are within their statutory 30-day term.</p>
            </div>
          </div>
        )}

        {(activeTab === 'review' && filteredReviewQueue.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-stone-100/50">
            <div>
              <ShieldCheck className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="font-bold text-stone-800 text-sm">Review Queue Empty</p>
              <p className="text-xs text-stone-500 mt-1">No items currently awaiting manager forfeiture authorization.</p>
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE PAWN DETAIL DRAWER / MODAL */}
      {selectedLoanForDetail && (
        <div data-testid="pawn-detail-drawer" className="fixed inset-0 z-50 overflow-hidden">
          <div 
            onClick={() => setSelectedLoanForDetail(null)} 
            className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in" 
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
            <div className="w-screen max-w-lg bg-white border-l border-stone-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
              
              {/* Drawer Header */}
              <div className="p-4 bg-[#F8F9FA] border-b border-stone-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#C85A32] font-mono">{selectedLoanForDetail.ticketNumber}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      Shelf: {selectedLoanForDetail.vaultShelf}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 font-headline mt-1">Vault Collateral Record</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedLoanForDetail(null)} 
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                
                {/* 1. Item Details Card */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="flex gap-3.5">
                    <div className="w-16 h-16 rounded-xl bg-white border border-stone-200 overflow-hidden shrink-0">
                      <img 
                        src={selectedLoanForDetail.itemImageUrl} 
                        alt={selectedLoanForDetail.itemTitle} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h4 className="text-sm font-bold text-stone-900 leading-snug">{selectedLoanForDetail.itemTitle}</h4>
                      <p className="text-xs text-stone-500">
                        Category: <strong className="text-stone-700">{selectedLoanForDetail.itemCategory}</strong> · Condition: <strong className="text-stone-700">{selectedLoanForDetail.condition}</strong>
                      </p>
                      {brandModelText && (
                        <p className="text-xs text-stone-600">
                          Brand/Model: <strong className="text-stone-800">{brandModelText}</strong>
                        </p>
                      )}
                      <p className="text-[11px] font-mono text-stone-500">
                        Serial / IMEI: <strong className="text-stone-700">{selectedLoanForDetail.serialOrImei || 'N/A'}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-stone-500">Vault Location:</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded border border-emerald-200">
                      Bin Shelf {selectedLoanForDetail.vaultShelf}
                    </span>
                  </div>
                </div>

                {/* 2. Customer / Pledgor Card */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono block">Pledgor Customer</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-stone-900">{selectedLoanForDetail.customerName}</p>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">Customer ID: {selectedLoanForDetail.customerId}</p>
                      <p className="text-[11px] text-stone-500 font-mono">SA ID: {selectedLoanForDetail.customerIdNumber}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block font-mono">Mobile</span>
                      <span className="text-xs font-mono font-bold text-[#C85A32]">{selectedLoanForDetail.customerMobile}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Contract Schedule & Statutory Fees */}
                <div className="p-4 bg-[#F8F9FA] rounded-xl border border-stone-200 space-y-2 text-xs font-mono">
                  <h4 className="text-xs font-bold text-stone-900 font-headline uppercase tracking-wider mb-2">Loan Contract &amp; NCA Breakdown</h4>
                  
                  <div className="flex justify-between text-stone-600">
                    <span>Principal Lent:</span>
                    <strong className="text-stone-900">R {selectedLoanForDetail.principal.toFixed(2)}</strong>
                  </div>
                  
                  <div className="flex justify-between text-stone-600">
                    <span>Monthly Interest (5% Cap):</span>
                    <strong className="text-[#C85A32]">R {selectedLoanForDetail.monthlyInterest.toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between text-stone-600">
                    <span>Storage &amp; Admin Fee:</span>
                    <strong className="text-stone-700">R {selectedLoanForDetail.monthlyStorageAdminFee.toFixed(2)}</strong>
                  </div>

                  <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
                    <span className="font-bold text-stone-900">Total Redemption Amount:</span>
                    <span className="text-base font-bold text-[#C85A32]">R {selectedLoanForDetail.totalRedemptionAmount.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-stone-600 pt-1">
                    <span>30-Day Extension Fee:</span>
                    <strong className="text-emerald-700 font-bold">R {selectedLoanForDetail.extensionFee.toFixed(2)}</strong>
                  </div>

                  <div className="pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Start Date</span>
                      <span className="text-stone-700">{selectedLoanForDetail.startDate}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px]">Expiry Date</span>
                      <span className="text-stone-700">{selectedLoanForDetail.expiryDate}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-stone-500">Live Countdown:</span>
                    {(() => {
                      const liveDays = getLiveDaysRemaining(selectedLoanForDetail);
                      return liveDays <= 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">
                          {Math.abs(liveDays)} Days Overdue
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          {liveDays} Days Remaining
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* 4. Loan History */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider font-mono block">Loan History</span>
                  {selectedLoanForDetail.history && selectedLoanForDetail.history.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedLoanForDetail.history.map((entry, i) => (
                        <div key={i} className="bg-white p-2 rounded-lg border border-stone-200 text-[11px] font-mono flex items-center justify-between">
                          <div>
                            <span className="font-bold text-stone-800">{entry.action}</span>
                            <span className="text-stone-400 text-[10px] ml-2">{new Date(entry.date).toLocaleDateString('en-ZA')}</span>
                            {entry.note && <p className="text-[10px] text-stone-500 font-sans mt-0.5">{entry.note}</p>}
                          </div>
                          {entry.amount !== undefined && (
                            <span className="font-bold text-stone-700">R {Number(entry.amount).toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500 font-mono italic">No prior transaction history recorded.</p>
                  )}
                </div>

                {/* 5. Counter Settlement Action Selection */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono block">Counter Settlement Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button" 
                      onClick={() => setSettlementOption('redeem')} 
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${settlementOption === 'redeem' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <CheckCircle2 className="w-4 h-4 text-[#C85A32]" />
                        <span className="text-[10px] font-mono text-[#C85A32] font-bold">Release Asset</span>
                      </div>
                      <span className="text-xs font-bold mt-2 text-stone-900">Full Redemption</span>
                      <span className="text-[11px] font-mono text-stone-500 mt-0.5">R {selectedLoanForDetail.totalRedemptionAmount.toFixed(2)}</span>
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setSettlementOption('extend')} 
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${settlementOption === 'extend' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <RotateCcw className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">+30 Days</span>
                      </div>
                      <span className="text-xs font-bold mt-2 text-stone-900">Extend Loan</span>
                      <span className="text-[11px] font-mono text-stone-500 mt-0.5">R {selectedLoanForDetail.extensionFee.toFixed(2)}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono block">Payment Tender</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setTenderMethod('cash')} 
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${tenderMethod === 'cash' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                      >
                        <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cash Tender</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setTenderMethod('card')} 
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${tenderMethod === 'card' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        <span>Card / POS</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 bg-[#F8F9FA] border-t border-stone-200 space-y-2 shrink-0">
                {!isAtLeastSeniorCashier ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-medium">
                    Senior Cashier or Manager authority required for counter settlements.
                  </div>
                ) : (
                  <button 
                    type="button" 
                    disabled={isProcessingSettlement} 
                    onClick={handleExecuteSettlement} 
                    className="w-full py-3 px-4 rounded-xl bg-[#C85A32] hover:bg-[#b04d29] disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
                  >
                    {isProcessingSettlement ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{settlementOption === 'redeem' ? 'Releasing asset…' : 'Extending loan…'}</span>
                      </>
                    ) : settlementOption === 'redeem' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Receive Payment &amp; Release Asset</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Collect Fee &amp; Extend 30 Days</span>
                      </>
                    )}
                  </button>
                )}
                
                <button 
                  type="button" 
                  disabled={isProcessingSettlement} 
                  onClick={() => setSelectedLoanForDetail(null)} 
                  className="w-full py-2 text-center text-xs text-stone-500 hover:text-stone-800 disabled:opacity-50 transition cursor-pointer"
                >
                  Cancel &amp; Close Drawer
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Overdue Manager Transfer Modal */}
      {isManagerModalOpen && selectedLoanForTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 text-stone-900">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#C85A32]" /><h3 className="font-bold text-sm text-stone-900 font-headline">Approve Floor Transfer &amp; Markup</h3></div>
              <button type="button" onClick={() => setIsManagerModalOpen(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <img src={selectedLoanForTransfer.itemImageUrl} alt={selectedLoanForTransfer.itemTitle} className="w-12 h-12 rounded-lg object-cover border border-stone-200" />
                <div className="min-w-0 flex-1"><h4 className="text-xs font-bold text-stone-900 truncate">{selectedLoanForTransfer.itemTitle}</h4><p className="text-[11px] text-stone-500 font-mono mt-0.5">Ticket: <strong className="text-[#C85A32]">{selectedLoanForTransfer.ticketNumber}</strong> • Shelf: <strong className="text-emerald-600">{selectedLoanForTransfer.vaultShelf}</strong></p></div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 block">Set Retail Resale Floor Price (R)</label>
                <div className="relative"><span className="absolute left-3.5 top-2 text-[#C85A32] font-bold font-mono">R</span><input type="number" value={targetRetailPrice} onChange={(e) => setTargetRetailPrice(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-4 py-2 text-stone-900 font-bold font-mono focus:border-[#C85A32] focus:outline-none text-base" /></div>
                <div className="flex justify-between text-xs text-stone-500 font-mono pt-1"><span>Acquisition Cost: R {selectedLoanForTransfer.principal.toFixed(2)}</span><span className="text-emerald-600 font-bold">Projected Margin: R {(targetRetailPrice - selectedLoanForTransfer.principal).toFixed(2)}</span></div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-mono block">Liquidity Pricing Presets</span>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 1.45))} className="p-2 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-500/50 text-center transition group cursor-pointer"><span className="text-[10px] text-stone-400 block group-hover:text-emerald-600">Fire Sale</span><span className="text-xs font-bold text-stone-700">45% Markup</span></button>
                  <button type="button" onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 1.85))} className="p-2 rounded-xl bg-[#FDF0EA] border border-[#C85A32]/40 text-center transition cursor-pointer"><span className="text-[10px] text-[#C85A32] block">Standard</span><span className="text-xs font-bold text-stone-800">85% Markup</span></button>
                  <button type="button" onClick={() => setTargetRetailPrice(Math.round(selectedLoanForTransfer.principal * 2.25))} className="p-2 rounded-xl bg-stone-50 border border-stone-200 hover:border-blue-500/50 text-center transition group cursor-pointer"><span className="text-[10px] text-stone-400 block group-hover:text-blue-400">Premium</span><span className="text-xs font-bold text-stone-700">125% Markup</span></button>
                </div>
              </div>
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-semibold text-stone-700 block">Manager Authorization PIN (6 Digits)</span>
                <div className="flex gap-2 justify-center">{managerPin.map((digit, idx) => (<input key={idx} type="password" maxLength={1} value={digit} onChange={(e) => { const newPin = [...managerPin]; newPin[idx] = e.target.value.slice(-1); setManagerPin(newPin); }} className="w-10 h-10 text-center rounded-xl bg-white border border-stone-200 text-lg font-bold text-stone-900 font-mono focus:border-[#C85A32] focus:outline-none" />))}</div>
              </div>
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between"><span className="text-xs text-stone-500 font-mono">Syncs immediately to POS Floor Stock</span><div className="flex gap-2"><button type="button" onClick={() => setIsManagerModalOpen(false)} className="px-4 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold cursor-pointer">Cancel</button><button type="button" onClick={handleConfirmPinTransfer} className="px-5 py-2 rounded-lg bg-[#C85A32] hover:bg-[#B84E27] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"><span>Authorize &amp; Transfer to POS</span><ArrowRight className="w-4 h-4" /></button></div></div>
          </div>
        </div>
      )}
    </div>
  );
};
