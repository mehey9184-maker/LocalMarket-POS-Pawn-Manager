import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useSaps } from '../../context/SapsContext';
import { useCustomers } from '../../context/CustomerContext';
import { SapsEntry } from '../../types';
import { AutoSizer as AutoSizerComponent } from 'react-virtualized-auto-sizer';
import { VirtualList } from '../common/VirtualList';

const AutoSizer = (AutoSizerComponent as any);
import {
  Shield,
  Download,
  Search,
  CheckCircle2,
  BadgeCheck,
  Eye,
  FileText,
  UserCheck,
  Printer,
  X,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface InspectorVisit {
  officerName: string;
  rank: string;
  badgeNumber: string;
  station: string;
  notes: string;
  timestamp: string;
}

const SapsEntryRow: React.FC<{ 
  entry: SapsEntry; 
  onView: (entry: SapsEntry) => void;
  onCancel: (id: string) => void;
  style?: React.CSSProperties;
}> = ({ entry, onView, onCancel, style }) => {
  const isPawn = entry.acquisitionType === 'Pawn';
  const isBuy = entry.acquisitionType === 'Buy';
  const isForfeit = entry.acquisitionType === 'Forfeited' || (entry.acquisitionType as any) === 'Forfeit';
  const isCancelled = entry.isCancelled;

  return (
    <div style={style} className={`border-b border-gray-100 flex items-center hover:bg-gray-50 transition group px-4 ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : ''}`}>
      <div className="w-48 py-2 font-mono whitespace-nowrap">
        <span className={`font-bold block text-xs ${isCancelled ? 'text-gray-400 line-through' : 'text-[#C85A32]'}`}>{entry.entryNumber}</span>
        <span className="text-[10px] text-gray-400 block mt-0.5">{entry.timestamp}</span>
      </div>

      <div className="flex-1 py-2 px-4">
        <span className="font-semibold text-gray-900 block truncate text-xs">{entry.customerName}</span>
        <span className="text-[10px] font-mono text-gray-400 block mt-0.5">ID: {entry.customerIdNumber}</span>
      </div>

      <div className="flex-[1.5] py-2 px-4 min-w-0">
        <span className="text-gray-800 font-medium block truncate text-xs">{entry.itemDescription}</span>
        <span className={`text-[10px] font-mono block mt-0.5 truncate ${isCancelled ? 'text-gray-400' : 'text-gray-500'}`}>SN/IMEI: {entry.serialOrImei}</span>
      </div>

      <div className="w-32 py-2 px-4 whitespace-nowrap">
        {isCancelled ? (
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 text-[9px] font-bold uppercase">CANCELLED</span>
        ) : (
          <>
            {isPawn && (
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-bold uppercase">PAWN</span>
            )}
            {isBuy && (
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold uppercase">BUY</span>
            )}
            {isForfeit && (
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase">FORFEIT</span>
            )}
          </>
        )}
      </div>

      <div className={`w-32 py-2 px-4 text-right font-mono font-bold text-xs ${isCancelled ? 'text-gray-400' : 'text-[#C85A32]'}`}>
        R {entry.considerationPaid.toFixed(2)}
      </div>

      <div className="w-24 py-2 px-4 text-right flex items-center justify-end gap-2">
        {!isCancelled && (
          <button
            type="button"
            onClick={() => onCancel(entry.id)}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 transition cursor-pointer"
            title="Cancel Entry (Statutory Correction)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onView(entry)}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition cursor-pointer"
          title="View Form 21 Record"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const SapsRegister: React.FC = () => {
  const { showToast, isPoliceInspectionMode, setIsPoliceInspectionMode, activeCustomer, shopProfile } = useApp();
  const { sapsEntries, cancelSapsEntry, exportSapsCsv } = useSaps();
  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'Pawn' | 'Buy' | 'Forfeit'>('all');
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SapsEntry | null>(null);
  const [isLogVisitModalOpen, setIsLogVisitModalOpen] = useState(false);
  const [cancellingEntryId, setCancellingEntryId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [officerName, setOfficerName] = useState('');
  const [officerRank, setOfficerRank] = useState('Constable');
  const [officerBadge, setOfficerBadge] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [hasConfirmedSignoff, setHasConfirmedSignoff] = useState(false);
  const [recordedVisit, setRecordedVisit] = useState<InspectorVisit | null>(null);

  const filteredEntries = useMemo(() => {
    return sapsEntries.filter(entry => {
      if (activeCustomer && !searchQuery) {
        if (entry.customerId !== activeCustomer.id && entry.customerIdNumber !== activeCustomer.idNumber) return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        entry.customerName.toLowerCase().includes(q) || 
        entry.customerIdNumber.toLowerCase().includes(q) || 
        entry.serialOrImei.toLowerCase().includes(q) || 
        entry.entryNumber.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filterTab === 'Pawn') return entry.acquisitionType === 'Pawn';
      if (filterTab === 'Buy') return entry.acquisitionType === 'Buy';
      if (filterTab === 'Forfeit') return entry.acquisitionType === 'Forfeited' || (entry.acquisitionType as any) === 'Forfeit';
      return true;
    });
  }, [sapsEntries, searchQuery, filterTab, activeCustomer]);

  const counts = useMemo(() => ({
    all: sapsEntries.length,
    pawn: sapsEntries.filter(e => e.acquisitionType === 'Pawn').length,
    buy: sapsEntries.filter(e => e.acquisitionType === 'Buy').length,
    forfeit: sapsEntries.filter(e => e.acquisitionType === 'Forfeited' || (e.acquisitionType as any) === 'Forfeit').length
  }), [sapsEntries]);

  const totalConsiderationPaid = useMemo(() => sapsEntries.reduce((sum, e) => sum + (e.isCancelled ? 0 : e.considerationPaid), 0), [sapsEntries]);

  const handleCancelEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingEntryId || !cancelReason) return;
    
    await cancelSapsEntry(cancellingEntryId, cancelReason);
    showToast('Entry Cancelled', 'Statutory register correction recorded.', 'success');
    setCancellingEntryId(null);
    setCancelReason('');
  };

  const selectedCustomer = useMemo(() => {
    if (!selectedEntry) return null;
    return customers.find(c => c.id === selectedEntry.customerId || c.idNumber === selectedEntry.customerIdNumber);
  }, [customers, selectedEntry]);

  const handleRecordInspectorVisit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVisit: InspectorVisit = {
      officerName, rank: officerRank, badgeNumber: officerBadge,
      station: `SAPS Precinct • License: ${shopProfile?.saps_dealer_license || 'Not Configured'}`, notes: officerNotes,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    setRecordedVisit(newVisit);
    setIsLogVisitModalOpen(false);
    showToast('Inspection Logged', `Audit sign-off recorded by ${officerRank} ${officerName}`, 'success');
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-[#F5F6F8] p-4 sm:p-6 gap-5 overflow-hidden transition-colors ${isPoliceInspectionMode ? 'border-2 border-blue-500 rounded-2xl' : ''}`}>
      {/* POLICE INSPECTION BANNER */}
      {isPoliceInspectionMode && (
        <div className="bg-blue-900 border border-blue-700 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase font-mono tracking-wider text-blue-100">Police Inspection Mode</p>
              <p className="text-[11px] text-blue-200 mt-0.5">Second-Hand Goods Act 6 of 2009 • SHG License: {shopProfile?.saps_dealer_license || 'Not Configured'}</p>
            </div>
          </div>
          <button onClick={() => setIsLogVisitModalOpen(true)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-2 transition shadow-xs cursor-pointer">
            <BadgeCheck className="w-4 h-4" /><span>Log Visit</span>
          </button>
        </div>
      )}

      {recordedVisit && isPoliceInspectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-[11px] font-mono text-blue-900 shrink-0">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Audit Certified: <strong className="text-gray-900">{recordedVisit.rank} {recordedVisit.officerName}</strong> • {recordedVisit.timestamp}</span></div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] uppercase">Certified</span>
        </div>
      )}

      {/* STATUTORY REGISTERS STATS */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Statutory Compliance Registers</span>
          <button onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} className="text-[11px] text-[#C85A32] font-mono hover:underline cursor-pointer">{isStatsCollapsed ? 'Expand Stats' : 'Collapse Stats'}</button>
        </div>
        {!isStatsCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Form 21 Records</span>
              <span className="text-xl font-bold text-gray-900 font-mono mt-1 block">{counts.all}</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Total Consideration Paid</span>
              <span className="text-xl font-bold text-[#C85A32] font-mono mt-1 block">R {totalConsiderationPaid.toLocaleString('en-ZA')}</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Dealer SHG License</span>
              <span className="text-xl font-bold text-emerald-700 font-mono mt-1 block">{shopProfile?.saps_dealer_license || 'Unconfigured'}</span>
            </div>
          </div>
        )}
      </div>

      {/* SEARCH AND CONTROLS */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search records by name, ID number, serial, ref..." className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#C85A32] shadow-xs" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportSapsCsv} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition shadow-xs cursor-pointer" title="Export SAPS CSV Register"><Download className="w-4 h-4" /></button>
          <button onClick={() => setIsPoliceInspectionMode(!isPoliceInspectionMode)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer ${isPoliceInspectionMode ? 'bg-blue-700 text-white' : 'bg-[#C85A32] hover:bg-[#A94725] text-white'}`}>
            <Shield className="w-4 h-4" /><span>{isPoliceInspectionMode ? 'Exit Inspection' : 'Police Mode'}</span>
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'All Logs', count: counts.all },
          { id: 'Pawn', label: 'Pawns', count: counts.pawn },
          { id: 'Buy', label: 'Buys', count: counts.buy },
          { id: 'Forfeit', label: 'Forfeits', count: counts.forfeit }
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterTab(tab.id as any)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${filterTab === tab.id ? 'bg-[#C85A32] text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <span>{tab.label}</span>
            <span className="text-[10px] font-mono opacity-80 bg-black/10 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-xs">
        <div className="bg-[#F8F9FA] text-gray-500 font-mono uppercase text-[10px] tracking-widest border-b border-gray-200 flex px-4 shrink-0">
          <div className="w-48 py-3">SAPS Ref</div>
          <div className="flex-1 py-3 px-4">Seller / RSA ID</div>
          <div className="flex-[1.5] py-3 px-4">Asset Specification</div>
          <div className="w-32 py-3 px-4">Type</div>
          <div className="w-32 py-3 px-4 text-right">Payout (R)</div>
          <div className="w-24 py-3 px-4 text-right">Audit</div>
        </div>
        <div className="flex-1 min-h-0 relative">
          {filteredEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ClipboardList className="w-10 h-10 mb-2 opacity-30 text-gray-300" />
              <p className="text-xs font-mono text-gray-500">No compliance records found</p>
            </div>
          ) : (
            <AutoSizer>
              {({ height, width }: any) => (
                <VirtualList height={height} width={width} itemCount={filteredEntries.length} itemSize={54}>
                  {({ index, style }: any) => (
                    <SapsEntryRow 
                      entry={filteredEntries[index]} 
                      onView={setSelectedEntry} 
                      onCancel={setCancellingEntryId}
                      style={style} 
                    />
                  )}
                </VirtualList>
              )}
            </AutoSizer>
          )}
        </div>
      </div>

      {/* ENTRY DETAILS MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#F8F9FA]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"><BadgeCheck className="w-5 h-5" /></div>
                <div><h3 className="font-bold text-sm text-gray-900">SAPS Form 21 Inspection Sheet</h3><p className="text-[10px] text-gray-500 font-mono">Ref: {selectedEntry.entryNumber}</p></div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-gray-400 hover:text-gray-700 transition cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-[#F8F9FA] rounded-xl p-4 border border-gray-200 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2">Seller Identification</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div><span className="text-gray-500 block text-[9px] uppercase">Name</span><span className="text-gray-900 font-bold">{selectedEntry.customerName}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">RSA ID</span><span className="text-[#C85A32] font-bold">{selectedEntry.customerIdNumber}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 block text-[9px] uppercase">Address</span><span className="text-gray-700">{selectedEntry.customerAddress}</span></div>
                </div>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl p-4 border border-gray-200 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2">Asset Details</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="col-span-2"><span className="text-gray-500 block text-[9px] uppercase">Description</span><span className="text-gray-900 font-bold">{selectedEntry.itemDescription}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Serial / IMEI</span><span className="text-[#C85A32] font-bold">{selectedEntry.serialOrImei}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Condition</span><span className="text-emerald-700 font-bold">{selectedEntry.condition}</span></div>
                </div>
              </div>
              <div className="bg-[#F8F9FA] rounded-xl p-4 border border-gray-200 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2">Transaction Proof</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div><span className="text-gray-500 block text-[9px] uppercase">Consideration</span><span className="text-lg font-bold text-emerald-700">R {selectedEntry.considerationPaid.toFixed(2)}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Station Code</span><span className="text-gray-900 font-bold">{selectedEntry.policeStationRef}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#F8F9FA] border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => showToast('Dispatched', 'SAPS form sent to printer', 'success')} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition flex items-center gap-2 cursor-pointer shadow-xs"><Printer className="w-4 h-4" /><span>Print Sheet</span></button>
              <button onClick={() => setSelectedEntry(null)} className="px-6 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A94725] text-white text-xs font-bold cursor-pointer shadow-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LOG INSPECTION MODAL */}
      {isLogVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-blue-900 border-b border-blue-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-300" /><h3 className="font-bold text-sm">Official Inspection Log</h3></div>
              <button onClick={() => setIsLogVisitModalOpen(false)} className="cursor-pointer text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRecordInspectorVisit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-600 uppercase font-bold">Rank</label><input type="text" value={officerRank} onChange={e => setOfficerRank(e.target.value)} className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900" /></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-600 uppercase font-bold">Name</label><input type="text" value={officerName} onChange={e => setOfficerName(e.target.value)} className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-600 uppercase font-bold">Force Number</label><input type="text" value={officerBadge} onChange={e => setOfficerBadge(e.target.value)} className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono" /></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-600 uppercase font-bold">Inspection Remarks</label><textarea rows={3} value={officerNotes} onChange={e => setOfficerNotes(e.target.value)} className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 resize-none" /></div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <input type="checkbox" id="signoff" checked={hasConfirmedSignoff} onChange={e => setHasConfirmedSignoff(e.target.checked)} className="mt-1 rounded border-gray-300" />
                <label htmlFor="signoff" className="text-xs text-blue-900 leading-tight">I certify that this inspection was conducted in compliance with the Second-Hand Goods Act 6 of 2009.</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsLogVisitModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">Cancel</button>
                <button type="submit" disabled={!hasConfirmedSignoff} className="px-6 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold disabled:opacity-50 transition shadow-xs cursor-pointer">Certify Inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL ENTRY MODAL */}
      {cancellingEntryId && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /><h3 className="font-bold text-sm text-red-900">Statutory Correction</h3></div>
              <button onClick={() => setCancellingEntryId(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCancelEntry} className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                You are about to mark this entry as <span className="text-red-600 font-bold">CANCELLED</span>. 
                This action is permanent and will be logged for police audit.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-600 uppercase font-bold">Reason for Cancellation</label>
                <textarea 
                  required
                  rows={3} 
                  value={cancelReason} 
                  onChange={e => setCancelReason(e.target.value)} 
                  placeholder="e.g., Clerical error in serial number, Transaction voided..."
                  className="w-full bg-[#F8F9FA] border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 resize-none focus:border-red-500 outline-none" 
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCancellingEntryId(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer">Close</button>
                <button type="submit" className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer">Confirm Cancellation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
