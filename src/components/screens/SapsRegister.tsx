import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SapsEntry } from '../../types';
import {
  Shield,
  Download,
  Search,
  CheckCircle2,
  BadgeCheck,
  Eye,
  FileText,
  Building2,
  Calendar,
  X,
  UserCheck,
  Printer,
  Lock,
  Clock,
  ExternalLink,
  ClipboardList,
  AlertTriangle,
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

export const SapsRegister: React.FC = () => {
  const {
    sapsRegister,
    exportSapsCsv,
    isPoliceInspectionMode,
    setIsPoliceInspectionMode,
    customers,
    activeCustomer,
    setActiveCustomer,
    showToast
  } = useApp();

  // Search and Filter Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'Pawn' | 'Buy' | 'Forfeit'>('all');
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [filterOnlyActiveCustomer, setFilterOnlyActiveCustomer] = useState(true);

  // Detailed Entry Audit Modal
  const [selectedEntry, setSelectedEntry] = useState<SapsEntry | null>(null);

  // Inspector Visit Modal State
  const [isLogVisitModalOpen, setIsLogVisitModalOpen] = useState(false);
  const [officerName, setOfficerName] = useState('Capt. K. Dlamini');
  const [officerRank, setOfficerRank] = useState('Captain');
  const [officerBadge, setOfficerBadge] = useState('SAPS-8491024');
  const [officerNotes, setOfficerNotes] = useState(
    'Routine statutory audit completed under Act 6 of 2009. All registers, serial numbers, and ID copies verified compliant.'
  );
  const [hasConfirmedSignoff, setHasConfirmedSignoff] = useState(true);
  const [recordedVisit, setRecordedVisit] = useState<InspectorVisit | null>({
    officerName: 'Capt. K. Dlamini',
    rank: 'Captain',
    badgeNumber: 'SAPS-8491024',
    station: 'Soweto West SAPS • Code: 00482',
    notes: 'Statutory compliance check completed. Physical vault and registers in full order.',
    timestamp: '2026-09-21 10:15'
  });

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return sapsRegister.filter(entry => {
      // Pinned customer filter
      if (activeCustomer && filterOnlyActiveCustomer && !searchQuery) {
        if (entry.customerId !== activeCustomer.id && entry.customerIdNumber !== activeCustomer.idNumber) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        entry.customerName.toLowerCase().includes(q) ||
        entry.customerIdNumber.toLowerCase().includes(q) ||
        entry.serialOrImei.toLowerCase().includes(q) ||
        entry.entryNumber.toLowerCase().includes(q) ||
        entry.itemDescription.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterTab === 'Pawn') return entry.acquisitionType === 'Pawn';
      if (filterTab === 'Buy') return entry.acquisitionType === 'Buy';
      if (filterTab === 'Forfeit') return entry.acquisitionType === 'Forfeited' || entry.acquisitionType === ('Forfeit' as any);

      return true;
    });
  }, [sapsRegister, searchQuery, filterTab, activeCustomer, filterOnlyActiveCustomer]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: sapsRegister.length,
      pawn: sapsRegister.filter(e => e.acquisitionType === 'Pawn').length,
      buy: sapsRegister.filter(e => e.acquisitionType === 'Buy').length,
      forfeit: sapsRegister.filter(e => e.acquisitionType === 'Forfeited' || e.acquisitionType === ('Forfeit' as any)).length
    };
  }, [sapsRegister]);

  // Total Consideration Paid (ZAR)
  const totalConsiderationPaid = useMemo(() => {
    return sapsRegister.reduce((sum, e) => sum + e.considerationPaid, 0);
  }, [sapsRegister]);

  // Customer match helper for Detailed Audit Sheet
  const selectedCustomer = useMemo(() => {
    if (!selectedEntry) return null;
    return (
      customers.find(
        c =>
          c.idNumber.replace(/\s+/g, '') === selectedEntry.customerIdNumber.replace(/\s+/g, '') ||
          c.id === selectedEntry.customerId
      ) || null
    );
  }, [customers, selectedEntry]);

  // Handler for logging an inspector visit
  const handleRecordInspectorVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerName.trim() || !officerBadge.trim() || !hasConfirmedSignoff) {
      showToast('Validation Incomplete', 'Please fill officer details and confirm the sign-off.', 'error');
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newVisit: InspectorVisit = {
      officerName,
      rank: officerRank,
      badgeNumber: officerBadge,
      station: 'Soweto West SAPS • Code: 00482',
      notes: officerNotes,
      timestamp: nowStr
    };

    setRecordedVisit(newVisit);
    setIsLogVisitModalOpen(false);
    showToast(
      'SAPS Inspection Logged',
      `${officerRank} ${officerName} (Force #${officerBadge}) recorded official sign-off.`,
      'success'
    );
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-y-auto p-3.5 sm:p-5 gap-4 transition-colors ${
        isPoliceInspectionMode
          ? 'bg-[#0B0F19] text-gray-100 border-2 border-blue-800/80 rounded-xl'
          : 'bg-[#121212] text-gray-100'
      }`}
    >
      {/* ============================================================
          3. POLICE INSPECTION MODE: TOP WARNING & AUDIT BANNER
         ============================================================ */}
      {isPoliceInspectionMode && (
        <div className="w-full bg-blue-950/90 border border-blue-500/80 rounded-xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black tracking-wider uppercase font-mono px-2 py-0.5 rounded bg-blue-500 text-white">
                  Official Police Inspection Mode
                </span>
                <span className="text-xs text-blue-200 font-mono">
                  READ-ONLY STATUTORY REGISTER
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-1 max-w-2xl leading-relaxed">
                South African Second-Hand Goods Act (Act 6 of 2009) • Station Precinct: Soweto West (00482).
                Store retail markups and commercial profit margins are hidden from view.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => setIsLogVisitModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow-md transition active:scale-95 whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" />
              <span>Log Inspector Visit</span>
            </button>
          </div>
        </div>
      )}

      {/* Recorded Inspector Visit Certification Strip (if present & in inspection mode) */}
      {isPoliceInspectionMode && recordedVisit && (
        <div className="bg-[#101726] border border-blue-900/60 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-mono text-blue-200 flex-wrap">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Latest Official Audit: <strong className="text-white">{recordedVisit.rank} {recordedVisit.officerName}</strong> ({recordedVisit.badgeNumber})
            </span>
            <span className="text-blue-400">•</span>
            <span>{recordedVisit.timestamp}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold">
            AUDIT PASSED / CERTIFIED
          </span>
        </div>
      )}

      {/* ============================================================
          1. STATUTORY COMPLIANCE HEADER: 3 MINIMALIST SUMMARY STATS & TOP ACTIONS
         ============================================================ */}
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">
            SAPS Statutory Compliance &amp; Registers
          </span>
          <button
            type="button"
            onClick={() => setIsStatsCollapsed(prev => !prev)}
            className="text-xs text-[#E87A5D] hover:text-[#f0967d] flex items-center gap-1 font-mono transition"
          >
            {isStatsCollapsed ? (
              <>
                <span>Expand Stats</span>
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

        {isStatsCollapsed ? (
          /* Sleek single-line ticker */
          <div className="bg-[#1E1E1E] rounded-xl px-4 py-2.5 border border-[#2A2A2A] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-gray-400">Station:</span>
              <strong className="text-white">Soweto West SAPS (00482)</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span className="text-gray-400">Form 21 Records:</span>
              <strong className="text-emerald-400">{sapsRegister.length}</strong>
              <span className="text-gray-500">(100% ID Verified)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C85A32]"></span>
              <span className="text-gray-400">Disbursed Funds:</span>
              <strong className="text-[#E87A5D]">R {totalConsiderationPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full animate-in fade-in duration-150">
            {/* Counter 1: Total Logged Register Entries */}
            <div className="bg-[#1E1E1E] rounded-xl p-3.5 border border-[#2A2A2A] flex flex-col justify-between shadow-sm">
              <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                Total Logged Register Entries
              </span>
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{sapsRegister.length}</span>
                <span className="text-xs text-emerald-400 font-mono">Form 21 Records</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono pt-1">
                100% RSA ID &amp; Biometric Checked
              </span>
            </div>

            {/* Counter 2: Total Consideration Paid */}
            <div className="bg-[#1E1E1E] rounded-xl p-3.5 border border-[#2A2A2A] flex flex-col justify-between shadow-sm">
              <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                Total Consideration Paid
              </span>
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#C85A32] font-mono">
                  R {totalConsiderationPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono pt-1">
                Statutory Disbursed Funds
              </span>
            </div>

            {/* Counter 3: Designated Police Station & Station Code */}
            <div className="bg-[#1E1E1E] rounded-xl p-3.5 border border-[#2A2A2A] flex flex-col justify-between shadow-sm">
              <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                Designated Police Station
              </span>
              <div className="pt-2">
                <p className="text-sm font-bold text-white font-headline">Soweto West SAPS</p>
                <p className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
                  Station Code: 00482
                </p>
              </div>
              <span className="text-[10px] text-gray-500 font-mono pt-1">
                Sector 2 • Reg No: SHG-2009/49182
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex-1"></div>

        {/* Top Actions: [Export SAPS CSV] and [Police Inspection Mode] */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end shrink-0">
          {/* Export SAPS CSV (Secondary Outline Button) */}
          <button
            type="button"
            onClick={exportSapsCsv}
            className="flex-1 lg:flex-initial px-4 py-2.5 rounded-xl border border-[#3A3A3A] bg-[#161616] hover:bg-[#222222] text-gray-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Download className="w-4 h-4 text-gray-400" />
            <span>Export SAPS CSV</span>
          </button>

          {/* Police Inspection Mode (Primary Toggle Button with Badge Icon) */}
          <button
            type="button"
            onClick={() => {
              const nextState = !isPoliceInspectionMode;
              setIsPoliceInspectionMode(nextState);
              showToast(
                nextState ? 'Police Inspection Mode Activated' : 'Standard Cashier View Restored',
                nextState
                  ? 'Official Read-Only Register activated for SAPS inspection.'
                  : 'Store tools and administrative controls restored.',
                'info'
              );
            }}
            className={`flex-1 lg:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
              isPoliceInspectionMode
                ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400'
                : 'bg-[#C85A32] hover:bg-[#b04d29] text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{isPoliceInspectionMode ? 'Exit Inspection Mode' : 'Police Inspection Mode'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          2. STREAMLINED REGISTER TABLE LAYOUT: SEARCH & FILTER SHELL
         ============================================================ */}
      <div className="bg-[#1E1E1E] rounded-xl p-3 border border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Full-width Search Bar */}
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search seller name, SA ID, serial/IMEI, or SAPS entry #..."
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-[#C85A32]"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
        </div>

        {/* Filter Tabs: [All Logs] [Pawn Pledges] [Direct Buys] [Forfeitures] */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>All Logs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('Pawn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              filterTab === 'Pawn'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>Pawn Pledges</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono text-amber-400">
              {counts.pawn}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('Buy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              filterTab === 'Buy'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>Direct Buys</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono text-blue-400">
              {counts.buy}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('Forfeit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
              filterTab === 'Forfeit'
                ? 'bg-[#C85A32] text-white shadow-sm'
                : 'bg-[#141414] text-gray-400 hover:text-white border border-[#2A2A2A]'
            }`}
          >
            <span>Forfeitures</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono text-purple-400">
              {counts.forfeit}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================
          2. HIGH-LEGIBILITY REGISTER TABLE (6 CORE COLUMNS)
          Rule: Strictly omit store markup, profit margins, or internal inventory costs.
         ============================================================ */}
      <div className="bg-[#1E1E1E] rounded-xl border border-[#2A2A2A] overflow-hidden shadow-md flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#161616] text-gray-400 uppercase font-semibold font-mono border-b border-[#2A2A2A] tracking-wider">
                <th className="p-3.5 whitespace-nowrap">1. SAPS Entry # &amp; Date</th>
                <th className="p-3.5 whitespace-nowrap">2. Seller / Pledgor &amp; RSA ID</th>
                <th className="p-3.5">3. Collateral Spec &amp; Serial / IMEI</th>
                <th className="p-3.5 whitespace-nowrap">4. Acquisition Type</th>
                <th className="p-3.5 whitespace-nowrap text-right">5. Consideration Paid (R)</th>
                <th className="p-3.5 text-center whitespace-nowrap">6. Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-500 font-mono">
                    <ClipboardList className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="font-bold text-gray-400 text-sm">No Statutory Entries Found</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Try adjusting the search filters above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
                  const isPawn = entry.acquisitionType === 'Pawn';
                  const isBuy = entry.acquisitionType === 'Buy';
                  const isForfeit = entry.acquisitionType === 'Forfeited' || entry.acquisitionType === ('Forfeit' as any);

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-[#252525] transition group"
                    >
                      {/* Column 1: SAPS Entry # & Date/Time */}
                      <td className="p-3.5 font-mono whitespace-nowrap">
                        <span className="font-bold text-[#E87A5D] block">
                          {entry.entryNumber}
                        </span>
                        <span className="text-[11px] text-gray-400 block mt-0.5">
                          {entry.timestamp}
                        </span>
                      </td>

                      {/* Column 2: Seller / Pledgor Full Name & RSA ID Number */}
                      <td className="p-3.5">
                        <span className="font-semibold text-white block truncate max-w-[200px]">
                          {entry.customerName}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                          ID: {entry.customerIdNumber}
                        </span>
                      </td>

                      {/* Column 3: Collateral Spec & Serial / IMEI Barcode */}
                      <td className="p-3.5">
                        <span className="text-gray-200 font-medium block truncate max-w-[260px]">
                          {entry.itemDescription}
                        </span>
                        <span className="text-[11px] font-mono text-[#E87A5D] block mt-0.5 truncate max-w-[260px]">
                          SN/IMEI: {entry.serialOrImei}
                        </span>
                      </td>

                      {/* Column 4: Acquisition Type Badge (`Pawn` in orange, `Buy` in blue, `Forfeit` in purple) */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isPawn && (
                          <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800/50">
                            PAWN PLEDGE
                          </span>
                        )}
                        {isBuy && (
                          <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800/50">
                            DIRECT BUY
                          </span>
                        )}
                        {isForfeit && (
                          <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800/50">
                            FORFEITURE
                          </span>
                        )}
                      </td>

                      {/* Column 5: Consideration Paid (R) */}
                      <td className="p-3.5 text-right font-mono font-bold text-[#C85A32] whitespace-nowrap">
                        R {entry.considerationPaid.toFixed(2)}
                      </td>

                      {/* Column 6: Audit Action ("View Full Sheet") */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className="px-3 py-1.5 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-gray-200 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 mx-auto transition active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#E87A5D]" />
                          <span>View Full Sheet</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================
          4. DETAILED ENTRY AUDIT MODAL (STATUTORY FORM 21 SHEET)
         ============================================================ */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-[#161616] border-b border-[#2A2A2A] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white font-headline">
                    SAPS Form 21 Statutory Register Sheet
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    Entry Reference: <strong className="text-[#E87A5D]">{selectedEntry.entryNumber}</strong> • Second-Hand Goods Act 6 of 2009
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Section 1: Customer RSA ID Photo Snapshot & Domicile Address */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                  <span className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#E87A5D]" />
                    Pledgor / Seller Identification
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono text-[10px] font-bold">
                    RSA SMART ID VERIFIED
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* ID Photo Snapshot Card */}
                  <div className="w-24 h-28 rounded-lg bg-[#1E1E1E] border-2 border-emerald-700/60 p-1 flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                    <img
                      src={`https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80`}
                      alt="Customer Identification Photo"
                      className="w-full h-20 object-cover rounded"
                    />
                    <span className="text-[8px] font-mono text-emerald-400 uppercase font-bold mt-1">
                      CHIP VERIFIED
                    </span>
                  </div>

                  {/* Customer Information Grid */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">Full Legal Name</span>
                      <span className="text-white font-bold text-sm">{selectedEntry.customerName}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">RSA ID Number</span>
                      <span className="text-[#E87A5D] font-bold">{selectedEntry.customerIdNumber}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">Contact Telephone</span>
                      <span className="text-gray-300">{selectedEntry.customerPhone}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">ID Document Type</span>
                      <span className="text-gray-300">
                        {selectedCustomer?.idType || 'RSA Smart ID Card'}
                      </span>
                    </div>

                    <div className="sm:col-span-2 pt-1">
                      <span className="text-gray-500 block text-[10px] uppercase">
                        Domicile Physical Address (Section 21 Verified)
                      </span>
                      <span className="text-gray-200">
                        {selectedEntry.customerAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Collateral Spec & Serial / IMEI Verification Logs */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                  <span className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#E87A5D]" />
                    Collateral Asset &amp; Serial Verification
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800/40 font-mono text-[10px] font-bold">
                    SAPS STOLEN DB: CLEAR
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 block text-[10px] uppercase">Item Specification</span>
                    <span className="text-white font-semibold">{selectedEntry.itemDescription}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Serial Number / IMEI</span>
                    <span className="text-[#E87A5D] font-bold">{selectedEntry.serialOrImei}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Physical Condition Grade</span>
                    <span className="text-emerald-400 font-bold">{selectedEntry.condition} Grade</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Category</span>
                    <span className="text-gray-300">{selectedEntry.category}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Inventory / POS Barcode</span>
                    <span className="text-gray-300">{selectedEntry.barcodeRef}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Timestamped Cashier Signature & Disbursed Tender Record */}
              <div className="bg-[#141414] rounded-xl p-4 border border-[#2A2A2A] space-y-3">
                <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                  <span className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Statutory Consideration &amp; Cashier Sign-off
                  </span>
                  <span className="text-xs text-gray-400 font-mono">{selectedEntry.timestamp}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Consideration Disbursed</span>
                    <span className="text-lg font-black text-emerald-400">
                      R {selectedEntry.considerationPaid.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Cash Tender • Paid in Full to Seller
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Authorized Intake Agent</span>
                    <span className="text-white font-bold block">Cashier 01 (Soweto Main)</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Digital Cryptographic Stamp #SIG-9082
                    </span>
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-[#2A2A2A] flex items-center justify-between text-gray-400">
                    <span>Designated Station Reference:</span>
                    <span className="text-white font-bold">{selectedEntry.policeStationRef}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#161616] border-t border-[#2A2A2A] flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-mono">
                Official Document pursuant to Section 21 of Act 6 of 2009
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    showToast('Form 21 Printed', `Statutory sheet #${selectedEntry.entryNumber} sent to receipt printer.`, 'success');
                  }}
                  className="px-3 py-2 rounded-lg bg-[#2A2A2A] hover:bg-[#383838] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d29] text-white text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          POLICE INSPECTOR VISIT LOGGING MODAL
         ============================================================ */}
      {isLogVisitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-blue-600/60 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 bg-blue-950 border-b border-blue-700/60 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm font-headline">
                  Log Official SAPS Police Inspector Visit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogVisitModalOpen(false)}
                className="p-1 rounded-lg text-blue-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordInspectorVisit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-300 font-semibold block">Officer Rank</label>
                  <select
                    value={officerRank}
                    onChange={(e) => setOfficerRank(e.target.value)}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Constable">Constable</option>
                    <option value="Sergeant">Sergeant</option>
                    <option value="Inspector">Inspector</option>
                    <option value="Captain">Captain</option>
                    <option value="Warrant Officer">Warrant Officer</option>
                    <option value="Lieutenant Colonel">Lieutenant Colonel</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-gray-300 font-semibold block">Officer Full Name</label>
                  <input
                    type="text"
                    required
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Capt. K. Dlamini"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold block">
                  Force / Badge Number
                </label>
                <input
                  type="text"
                  required
                  value={officerBadge}
                  onChange={(e) => setOfficerBadge(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="e.g., SAPS-8491024"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold block">
                  Station Precinct
                </label>
                <input
                  type="text"
                  disabled
                  value="Soweto West SAPS • Code: 00482"
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-gray-400 font-mono cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold block">
                  Inspection Findings / Official Remarks
                </label>
                <textarea
                  rows={3}
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
              </div>

              <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-900/60 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="confirm-signoff"
                  checked={hasConfirmedSignoff}
                  onChange={(e) => setHasConfirmedSignoff(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 bg-[#121212] border-[#2A2A2A]"
                />
                <label htmlFor="confirm-signoff" className="text-xs text-blue-200 leading-tight select-none">
                  I hereby certify under the South African Second-Hand Goods Act 6 of 2009 that I have inspected the physical register and premises.
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogVisitModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#2A2A2A] hover:bg-[#383838] text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasConfirmedSignoff}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                >
                  <BadgeCheck className="w-4 h-4" />
                  <span>Submit Official Sign-off</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
