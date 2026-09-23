import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useLoans } from '../../context/LoanContext';
import { useCustomers } from '../../context/CustomerContext';
import { PawnLoan } from '../../types';
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';
import { VirtualList } from '../common/VirtualList';

const AutoSizer = (AutoSizerComponent as any);
import {
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  CreditCard,
  Banknote,
  ChevronRight,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';

const LoanCard: React.FC<{ 
  loan: PawnLoan; 
  onClick: (loan: PawnLoan) => void;
  onWhatsApp: (loan: PawnLoan) => void;
  style?: React.CSSProperties;
}> = ({ loan, onClick, onWhatsApp, style }) => {
  const isOverdue = loan.daysRemaining <= 0;
  const isExpiring = loan.daysRemaining > 0 && loan.daysRemaining <= 5;
  const isRedeemed = loan.status === 'Redeemed';

  return (
    <div style={style} className="px-1 py-1.5">
      <div
        onClick={() => onClick(loan)}
        className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#C85A32] hover:shadow-sm transition cursor-pointer flex flex-col justify-between gap-3 shadow-2xs group h-full"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FDF0EA] text-[#C85A32] font-mono font-bold text-xs border border-[#C85A32]/20">
              {loan.ticketNumber}
            </span>
            <span className="text-[11px] text-gray-500 font-mono">
              Vault: <strong className="text-gray-800">{loan.vaultShelf}</strong>
            </span>
          </div>

          <div
            className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1 ${
              isRedeemed
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isOverdue
                ? 'bg-red-50 text-red-700 border border-red-200'
                : isExpiring
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>
              {isRedeemed
                ? 'Redeemed'
                : isOverdue
                ? `${Math.abs(loan.daysRemaining)}d Overdue`
                : `${loan.daysRemaining}d Left`}
            </span>
          </div>
        </div>

        <div className="bg-[#F8F9FA] p-2.5 rounded-lg border border-gray-100 flex items-center justify-between group/cust">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold text-xs">
                {loan.customerName.charAt(0)}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${loan.daysElapsed < 15 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate font-headline">
                {loan.customerName}
              </p>
              <p className="text-[10px] text-gray-500 font-mono truncate">
                SA ID: {loan.customerIdNumber}
              </p>
            </div>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onWhatsApp(loan); }}
            className="p-1.5 rounded-lg bg-white border border-gray-200 text-emerald-600 opacity-0 group-hover/cust:opacity-100 hover:bg-emerald-50 transition"
            title="Chat via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
            <img
              src={loan.itemImageUrl}
              alt={loan.itemTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-gray-800 truncate group-hover:text-[#C85A32] transition-colors">
              {loan.itemTitle}
            </h4>
            <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
              SN: {loan.serialOrImei}
            </p>
          </div>
        </div>

        <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-mono block">Principal Loan</span>
            <span className="text-sm font-bold text-[#C85A32] font-mono">
              R {loan.principal.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-[#C85A32] font-medium transition">
            <span>{isRedeemed ? 'View Details' : 'Settle / Extend'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const LoansLedger: React.FC = () => {
  const { showToast, activeCustomer, setActiveCustomer } = useApp();
  const { loans, redeemLoan, extendLoan } = useLoans();
  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'expiring' | 'overdue' | 'redeemed'>('all');
  const [filterOnlyActiveCustomer, setFilterOnlyActiveCustomer] = useState(true);

  const [selectedLoanForDrawer, setSelectedLoanForDrawer] = useState<PawnLoan | null>(null);
  const [settlementOption, setSettlementOption] = useState<'redeem' | 'extend'>('redeem');
  const [tenderMethod, setTenderMethod] = useState<'cash' | 'card'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      if (activeCustomer && filterOnlyActiveCustomer && !searchQuery) {
        if (loan.customerId !== activeCustomer.id && loan.customerIdNumber !== activeCustomer.idNumber) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        loan.ticketNumber.toLowerCase().includes(q) ||
        loan.customerName.toLowerCase().includes(q) ||
        loan.customerIdNumber.toLowerCase().includes(q) ||
        loan.customerMobile.includes(q) ||
        loan.itemTitle.toLowerCase().includes(q) ||
        loan.serialOrImei.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterTab === 'expiring') {
        return loan.status === 'Active' && loan.daysRemaining > 0 && loan.daysRemaining <= 5;
      }
      if (filterTab === 'overdue') {
        return loan.status === 'Active' && (loan.daysRemaining <= 0 || loan.daysElapsed > 30);
      }
      if (filterTab === 'redeemed') {
        return loan.status === 'Redeemed';
      }
      return loan.status === 'Active';
    });
  }, [loans, searchQuery, filterTab, activeCustomer, filterOnlyActiveCustomer]);

  const counts = useMemo(() => {
    return {
      all: loans.filter(l => l.status === 'Active').length,
      expiring: loans.filter(l => l.status === 'Active' && l.daysRemaining > 0 && l.daysRemaining <= 5).length,
      overdue: loans.filter(l => l.status === 'Active' && (l.daysRemaining <= 0 || l.daysElapsed > 30)).length,
      redeemed: loans.filter(l => l.status === 'Redeemed').length
    };
  }, [loans]);

  const handleCardClick = (loan: PawnLoan) => {
    setSelectedLoanForDrawer(loan);
    setSettlementOption('redeem');
    const matchedCustomer = customers.find(c => c.id === loan.customerId || c.idNumber === loan.customerIdNumber);
    if (matchedCustomer) {
      setActiveCustomer(matchedCustomer);
    }
  };

  const handleExecuteSettlement = async () => {
    if (!selectedLoanForDrawer) return;

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    
    if (settlementOption === 'redeem') {
      await redeemLoan(selectedLoanForDrawer.ticketNumber, selectedLoanForDrawer.totalRedemptionAmount);
      showToast(
        'Loan Redeemed',
        `Ticket ${selectedLoanForDrawer.ticketNumber} settled. Asset released.`,
        'success'
      );
    } else {
      await extendLoan(selectedLoanForDrawer.ticketNumber, selectedLoanForDrawer.extensionFee);
      showToast(
        'Term Extended',
        `Ticket ${selectedLoanForDrawer.ticketNumber} extended.`,
        'success'
      );
    }

    setIsProcessing(false);
    setSelectedLoanForDrawer(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F6F8] p-4 sm:p-6 gap-4 relative overflow-hidden">
      <div className="space-y-3 bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs shrink-0">
        <div className="relative w-full flex items-center">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Customer Name, SA ID, Mobile (+27), or Ticket #..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F8F9FA] border border-gray-200 text-gray-900 placeholder-gray-400 font-mono text-xs sm:text-sm focus:border-[#C85A32] focus:bg-white focus:outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button type="button" onClick={() => setFilterTab('all')} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${filterTab === 'all' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <span>All Active</span><span className="px-1.5 py-0.5 rounded-full bg-black/15 font-mono text-[10px]">{counts.all}</span>
          </button>
          <button type="button" onClick={() => setFilterTab('expiring')} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${filterTab === 'expiring' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span><span>Expiring Soon</span><span className="px-1.5 py-0.5 rounded-full bg-black/15 text-white font-mono text-[10px]">{counts.expiring}</span>
          </button>
          <button type="button" onClick={() => setFilterTab('overdue')} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${filterTab === 'overdue' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" /><span>Overdue</span><span className="px-1.5 py-0.5 rounded-full bg-black/15 text-white font-mono text-[10px]">{counts.overdue}</span>
          </button>
          <button type="button" onClick={() => setFilterTab('redeemed')} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${filterTab === 'redeemed' ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900'}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>Redeemed</span><span className="px-1.5 py-0.5 rounded-full bg-black/15 text-white font-mono text-[10px]">{counts.redeemed}</span>
          </button>
        </div>

        {activeCustomer && (
          <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Filtered by client: <strong className="text-gray-900 font-headline">{activeCustomer.fullName}</strong></span>
            <button type="button" onClick={() => setFilterOnlyActiveCustomer(prev => !prev)} className="text-[#C85A32] hover:text-[#A94725] font-mono text-[11px] underline">
              {filterOnlyActiveCustomer ? 'Show all customers' : `Focus on ${activeCustomer.fullName}`}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {filteredLoans.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-gray-300 h-full flex flex-col items-center justify-center">
            <Clock className="w-10 h-10 text-gray-400 mb-2" />
            <p className="font-bold text-gray-800 text-sm">No Loan Records Found</p>
            <p className="text-xs text-gray-500 mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <AutoSizer>
            {({ height, width }: any) => {
              const columnCount = width > 768 ? 2 : 1;
              const columnWidth = width / columnCount;
              const rowCount = Math.ceil(filteredLoans.length / columnCount);
              return (
                <VirtualList
                  height={height}
                  width={width}
                  itemCount={rowCount}
                  itemSize={180}
                >
                  {({ index, style }: any) => {
                    const rowItems = [];
                    for (let i = 0; i < columnCount; i++) {
                      const itemIndex = index * columnCount + i;
                      if (itemIndex < filteredLoans.length) {
                        rowItems.push(filteredLoans[itemIndex]);
                      }
                    }
                    return (
                      <div style={style} className="flex">
                        {rowItems.map(loan => (
                          <div key={loan.id} style={{ width: columnWidth }}>
                            <LoanCard 
                              loan={loan} 
                              onClick={handleCardClick} 
                              onWhatsApp={(l) => showToast('WhatsApp', `Opening chat with ${l.customerName}`, 'info')}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  }}
                </VirtualList>
              );
            }}
          </AutoSizer>
        )}
      </div>

      {selectedLoanForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div onClick={() => setSelectedLoanForDrawer(null)} className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in" />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white border-l border-gray-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
              <div className="p-4 bg-[#F8F9FA] border-b border-gray-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#C85A32] font-mono">{selectedLoanForDrawer.ticketNumber}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-mono">Shelf: {selectedLoanForDrawer.vaultShelf}</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 font-headline mt-1">Counter Settlement Terminal</h3>
                </div>
                <button type="button" onClick={() => setSelectedLoanForDrawer(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{selectedLoanForDrawer.customerName}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">SA ID: {selectedLoanForDrawer.customerIdNumber}</p>
                      <p className="text-[11px] text-[#C85A32] font-mono">{selectedLoanForDrawer.customerMobile}</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden shrink-0">
                      <img src={selectedLoanForDrawer.itemImageUrl} alt={selectedLoanForDrawer.itemTitle} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-600 truncate max-w-[220px]">{selectedLoanForDrawer.itemTitle}</span>
                    <span className="text-gray-500">SN: {selectedLoanForDrawer.serialOrImei}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono block">Choose Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSettlementOption('redeem')} className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${settlementOption === 'redeem' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between"><CheckCircle2 className="w-4 h-4 text-[#C85A32]" /><span className="text-[10px] font-mono text-[#C85A32] font-bold">Release Asset</span></div>
                      <span className="text-xs font-bold mt-2 text-gray-900">Full Redemption</span>
                      <span className="text-[11px] font-mono text-gray-500 mt-0.5">R {selectedLoanForDrawer.totalRedemptionAmount.toFixed(2)}</span>
                    </button>
                    <button type="button" onClick={() => setSettlementOption('extend')} className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${settlementOption === 'extend' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <div className="flex items-center justify-between"><RotateCcw className="w-4 h-4 text-emerald-600" /><span className="text-[10px] font-mono text-emerald-600 font-bold">+30 Days</span></div>
                      <span className="text-xs font-bold mt-2 text-gray-900">Extend Loan</span>
                      <span className="text-[11px] font-mono text-gray-500 mt-0.5">R {selectedLoanForDrawer.extensionFee.toFixed(2)}</span>
                    </button>
                  </div>
                </div>

                {settlementOption === 'redeem' && (
                  <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-gray-200 space-y-2 text-xs font-mono">
                    <h4 className="text-xs font-bold text-gray-900 font-headline uppercase tracking-wider mb-2">Full Redemption Breakdown</h4>
                    <div className="flex justify-between text-gray-600"><span>Principal Amount:</span><span className="text-gray-900 font-bold">R {selectedLoanForDrawer.principal.toFixed(2)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>NCA Interest (5.00%/mo):</span><span className="text-[#C85A32]">R {selectedLoanForDrawer.monthlyInterest.toFixed(2)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Storage &amp; Admin Fee:</span><span className="text-gray-700">R {selectedLoanForDrawer.monthlyStorageAdminFee.toFixed(2)}</span></div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline"><span className="text-xs font-bold text-gray-900">Total Due:</span><span className="text-lg font-bold text-[#C85A32]">R {selectedLoanForDrawer.totalRedemptionAmount.toFixed(2)}</span></div>
                  </div>
                )}

                {settlementOption === 'extend' && (
                  <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-gray-200 space-y-2 text-xs font-mono">
                    <h4 className="text-xs font-bold text-gray-900 font-headline uppercase tracking-wider mb-2">30-Day Extension Fee</h4>
                    <div className="flex justify-between text-gray-600"><span>Monthly Interest:</span><span className="text-[#C85A32]">R {selectedLoanForDrawer.monthlyInterest.toFixed(2)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Vault Storage/Admin:</span><span className="text-gray-700">R {selectedLoanForDrawer.monthlyStorageAdminFee.toFixed(2)}</span></div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline"><span className="text-xs font-bold text-gray-900">Fee Due:</span><span className="text-lg font-bold text-emerald-600">R {selectedLoanForDrawer.extensionFee.toFixed(2)}</span></div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono block">Payment Tender</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTenderMethod('cash')} className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${tenderMethod === 'cash' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><Banknote className="w-3.5 h-3.5 text-emerald-600" /><span>Cash Tender</span></button>
                    <button type="button" onClick={() => setTenderMethod('card')} className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${tenderMethod === 'card' ? 'bg-[#FDF0EA] border-[#C85A32] text-[#C85A32] shadow-xs' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><CreditCard className="w-3.5 h-3.5 text-blue-600" /><span>Card / POS</span></button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-[#F8F9FA] border-t border-gray-200 space-y-2 shrink-0">
                <button type="button" disabled={isProcessing} onClick={handleExecuteSettlement} className="w-full py-3 px-4 rounded-xl bg-[#C85A32] hover:bg-[#b04d29] text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer">
                  {isProcessing ? <span>Processing...</span> : settlementOption === 'redeem' ? <><CheckCircle2 className="w-4 h-4" /><span>Receive Payment &amp; Release Asset</span></> : <><RotateCcw className="w-4 h-4" /><span>Collect Fee &amp; Extend</span></>}
                </button>
                <button type="button" onClick={() => setSelectedLoanForDrawer(null)} className="w-full py-2 text-center text-xs text-gray-500 hover:text-gray-800 transition cursor-pointer">Cancel &amp; Close Drawer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
