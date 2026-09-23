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
    <div style={style} className={`border-b border-[#2A2A2A] flex items-center hover:bg-[#252525] transition group px-4 ${isCancelled ? 'opacity-50 grayscale bg-[#1a1a1a]/40' : ''}`}>
      <div className="w-48 py-2 font-mono whitespace-nowrap">
        <span className={`font-bold block text-xs ${isCancelled ? 'text-gray-500 line-through' : 'text-[#E87A5D]'}`}>{entry.entryNumber}</span>
        <span className="text-[10px] text-gray-500 block mt-0.5">{entry.timestamp}</span>
      </div>

      <div className="flex-1 py-2 px-4">
        <span className="font-semibold text-white block truncate text-xs">{entry.customerName}</span>
        <span className="text-[10px] font-mono text-gray-500 block mt-0.5">ID: {entry.customerIdNumber}</span>
      </div>

      <div className="flex-[1.5] py-2 px-4 min-w-0">
        <span className="text-gray-200 font-medium block truncate text-xs">{entry.itemDescription}</span>
        <span className={`text-[10px] font-mono block mt-0.5 truncate ${isCancelled ? 'text-gray-500' : 'text-[#E87A5D]'}`}>SN/IMEI: {entry.serialOrImei}</span>
      </div>

      <div className="w-32 py-2 px-4 whitespace-nowrap">
        {isCancelled ? (
          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 text-[9px] font-bold uppercase">CANCELLED</span>
        ) : (
          <>
            {isPawn && (
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50 text-[9px] font-bold uppercase">PAWN</span>
            )}
            {isBuy && (
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/50 text-[9px] font-bold uppercase">BUY</span>
            )}
            {isForfeit && (
              <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/50 text-[9px] font-bold uppercase">FORFEIT</span>
            )}
          </>
        )}
      </div>

      <div className={`w-32 py-2 px-4 text-right font-mono font-bold text-xs ${isCancelled ? 'text-gray-500' : 'text-[#C85A32]'}`}>
        R {entry.considerationPaid.toFixed(2)}
      </div>

      <div className="w-24 py-2 px-4 text-right flex items-center justify-end gap-2">
        {!isCancelled && (
          <button
            type="button"
            onClick={() => onCancel(entry.id)}
            className="p-1.5 rounded-lg bg-[#2A2A2A] hover:bg-red-950/40 text-gray-500 hover:text-red-400 transition"
            title="Cancel Entry (Statutory Correction)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onView(entry)}
          className="p-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-gray-300 hover:text-white transition"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const SapsRegister: React.FC = () => {
  const { showToast, isPoliceInspectionMode, setIsPoliceInspectionMode, activeCustomer } = useApp();
  const { sapsEntries, cancelSapsEntry, exportSapsCsv } = useSaps();
  const { customers } = useCustomers();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'Pawn' | 'Buy' | 'Forfeit'>('all');
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SapsEntry | null>(null);
  const [isLogVisitModalOpen, setIsLogVisitModalOpen] = useState(false);
  const [cancellingEntryId, setCancellingEntryId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  const [officerName, setOfficerName] = useState('Capt. K. Dlamini');
  const [officerRank, setOfficerRank] = useState('Captain');
  const [officerBadge, setOfficerBadge] = useState('SAPS-8491024');
  const [officerNotes, setOfficerNotes] = useState('Routine statutory audit completed. Verified registers and serial numbers.');
  const [hasConfirmedSignoff, setHasConfirmedSignoff] = useState(true);
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
      station: 'Soweto West SAPS • Code: 00482', notes: officerNotes,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    setRecordedVisit(newVisit);
    setIsLogVisitModalOpen(false);
    showToast('Inspection Logged', `Audit sign-off recorded by ${officerRank} ${officerName}`, 'success');
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-[#121212] p-4 sm:p-6 gap-5 overflow-hidden transition-colors ${isPoliceInspectionMode ? 'border-2 border-blue-800/80 rounded-xl' : ''}`}>
      {isPoliceInspectionMode && (
        <div className="bg-blue-950/90 border border-blue-500/80 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-md"><Shield className="w-6 h-6 text-white" /></div>
            <div>
              <p className="text-xs font-black uppercase font-mono text-blue-100">Police Inspection Mode</p>
              <p className="text-[10px] text-blue-300 mt-0.5">Act 6 of 2009 • Station Precinct: Soweto West (00482)</p>
            </div>
          </div>
          <button onClick={() => setIsLogVisitModalOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-2 transition shadow-md">
            <BadgeCheck className="w-4 h-4" /><span>Log Visit</span>
          </button>
        </div>
      )}

      {recordedVisit && isPoliceInspectionMode && (
        <div className="bg-[#101726] border border-blue-900/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-[10px] font-mono text-blue-200 shrink-0">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span>Audit: <strong className="text-white">{recordedVisit.rank} {recordedVisit.officerName}</strong> • {recordedVisit.timestamp}</span></div>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-bold uppercase">Certified</span>
        </div>
      )}

      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Statutory Registers</span>
          <button onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} className="text-[10px] text-[#C85A32] font-mono hover:underline">{isStatsCollapsed ? 'Expand Stats' : 'Collapse Stats'}</button>
        </div>
        {!isStatsCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
              <span className="text-[9px] text-gray-500 uppercase font-mono block">Form 21 Records</span>
              <span className="text-xl font-black text-white font-mono">{counts.all}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
              <span className="text-[9px] text-gray-500 uppercase font-mono block">Total Consideration</span>
              <span className="text-xl font-black text-[#C85A32] font-mono">R {totalConsiderationPaid.toLocaleString('en-ZA')}</span>
            </div>
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
              <span className="text-[9px] text-gray-500 uppercase font-mono block">Station Code</span>
              <span className="text-xl font-black text-emerald-400 font-mono">00482</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search records..." className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg pl-9 pr-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#C85A32]" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportSapsCsv} className="p-2.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400 hover:text-white transition"><Download className="w-4 h-4" /></button>
          <button onClick={() => setIsPoliceInspectionMode(!isPoliceInspectionMode)} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${isPoliceInspectionMode ? 'bg-blue-600 text-white' : 'bg-[#C85A32] text-white'}`}>
            <Shield className="w-4 h-4" /><span>{isPoliceInspectionMode ? 'Exit Inspection' : 'Police Mode'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'All Logs', count: counts.all },
          { id: 'Pawn', label: 'Pawns', count: counts.pawn },
          { id: 'Buy', label: 'Buys', count: counts.buy },
          { id: 'Forfeit', label: 'Forfeits', count: counts.forfeit }
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterTab(tab.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${filterTab === tab.id ? 'bg-[#C85A32] text-white' : 'bg-[#141414] text-gray-400 border border-[#2A2A2A]'}`}>
            <span>{tab.label}</span>
            <span className="text-[10px] font-mono opacity-60">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden flex flex-col">
        <div className="bg-[#141414] text-gray-500 font-mono uppercase text-[10px] tracking-widest border-b border-[#2A2A2A] flex px-4 shrink-0">
          <div className="w-48 py-3">SAPS Ref</div>
          <div className="flex-1 py-3 px-4">Seller / RSA ID</div>
          <div className="flex-[1.5] py-3 px-4">Asset Specification</div>
          <div className="w-32 py-3 px-4">Type</div>
          <div className="w-32 py-3 px-4 text-right">Payout (R)</div>
          <div className="w-24 py-3 px-4 text-right">Audit</div>
        </div>
        <div className="flex-1 min-h-0 relative">
          {filteredEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <ClipboardList className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-xs font-mono">No compliance records found</p>
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

      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-950/30 text-emerald-400 border border-emerald-900/50"><BadgeCheck className="w-5 h-5" /></div>
                <div><h3 className="font-bold text-sm text-white">SAPS Form 21</h3><p className="text-[10px] text-gray-500 font-mono">Ref: {selectedEntry.entryNumber}</p></div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-gray-500 hover:text-white transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-[#2A2A2A] pb-2">Seller Identification</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div><span className="text-gray-500 block text-[9px] uppercase">Name</span><span className="text-white font-bold">{selectedEntry.customerName}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">RSA ID</span><span className="text-[#E87A5D] font-bold">{selectedEntry.customerIdNumber}</span></div>
                  <div className="col-span-2"><span className="text-gray-500 block text-[9px] uppercase">Address</span><span className="text-gray-300">{selectedEntry.customerAddress}</span></div>
                </div>
              </div>
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-[#2A2A2A] pb-2">Asset Details</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="col-span-2"><span className="text-gray-500 block text-[9px] uppercase">Description</span><span className="text-white font-bold">{selectedEntry.itemDescription}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Serial / IMEI</span><span className="text-[#E87A5D] font-bold">{selectedEntry.serialOrImei}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Condition</span><span className="text-emerald-400 font-bold">{selectedEntry.condition}</span></div>
                </div>
              </div>
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-[#2A2A2A] pb-2">Transaction Proof</p>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div><span className="text-gray-500 block text-[9px] uppercase">Consideration</span><span className="text-lg font-black text-emerald-400">R {selectedEntry.considerationPaid.toFixed(2)}</span></div>
                  <div><span className="text-gray-500 block text-[9px] uppercase">Station Code</span><span className="text-white font-bold">{selectedEntry.policeStationRef}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-[#141414] border-t border-[#2A2A2A] flex justify-end gap-3">
              <button onClick={() => showToast('Dispatched', 'SAPS form sent to printer', 'success')} className="px-4 py-2 rounded-lg bg-[#2A2A2A] text-gray-300 text-xs font-bold hover:text-white transition flex items-center gap-2"><Printer className="w-4 h-4" /><span>Print Sheet</span></button>
              <button onClick={() => setSelectedEntry(null)} className="px-6 py-2 rounded-lg bg-[#C85A32] text-white text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {isLogVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-blue-600/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-blue-950 border-b border-blue-800/50 flex items-center justify-between text-white">
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400" /><h3 className="font-bold text-sm">Official Inspection Log</h3></div>
              <button onClick={() => setIsLogVisitModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRecordInspectorVisit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Rank</label><input type="text" value={officerRank} onChange={e => setOfficerRank(e.target.value)} className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white" /></div>
                <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Name</label><input type="text" value={officerName} onChange={e => setOfficerName(e.target.value)} className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Force Number</label><input type="text" value={officerBadge} onChange={e => setOfficerBadge(e.target.value)} className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white font-mono" /></div>
              <div className="space-y-1"><label className="text-[10px] text-gray-500 uppercase font-bold">Inspection Remarks</label><textarea rows={3} value={officerNotes} onChange={e => setOfficerNotes(e.target.value)} className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white resize-none" /></div>
              <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg flex items-start gap-3">
                <input type="checkbox" id="signoff" checked={hasConfirmedSignoff} onChange={e => setHasConfirmedSignoff(e.target.checked)} className="mt-1 rounded border-[#2A2A2A] bg-transparent" />
                <label htmlFor="signoff" className="text-[10px] text-blue-300 leading-tight">I certify that this inspection was conducted in compliance with the Second-Hand Goods Act 6 of 2009.</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsLogVisitModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500">Cancel</button>
                <button type="submit" disabled={!hasConfirmedSignoff} className="px-6 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50 transition shadow-lg">Certify Inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancellingEntryId && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-red-900/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-red-950/20 border-b border-red-900/30 flex items-center justify-between">
              <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-500" /><h3 className="font-bold text-sm text-white">Statutory Correction</h3></div>
              <button onClick={() => setCancellingEntryId(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleCancelEntry} className="p-6 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                You are about to mark this entry as <span className="text-red-400 font-bold">CANCELLED</span>. 
                This action is permanent and will be logged for police audit.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Reason for Cancellation</label>
                <textarea 
                  required
                  rows={3} 
                  value={cancelReason} 
                  onChange={e => setCancelReason(e.target.value)} 
                  placeholder="e.g., Clerical error in serial number, Transaction voided..."
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white resize-none focus:border-red-500 outline-none" 
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCancellingEntryId(null)} className="px-4 py-2 text-xs font-bold text-gray-500">Close</button>
                <button type="submit" className="px-6 py-2 rounded-lg bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/20">Confirm Cancellation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
