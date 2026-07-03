import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, ChevronUp, ChevronDown, Download,
  RefreshCw, CloudRain, BarChart2, Calendar, Clock,
  AlertCircle, CheckCircle, FileSpreadsheet, FileText,
  MapPin, Loader2, Info, ChevronsLeft, ChevronLeft,
  ChevronRight, ChevronsRight, Database,
} from 'lucide-react';
import { fetchDistrictSummary, downloadRainfallDbExcel, downloadRainfallDbCsv } from '../services/api';
import { toast } from 'react-hot-toast';

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const PAGE_SIZE = 20;

const VIDARBHA_DISTRICTS = [
  'Nagpur', 'Wardha', 'Amravati', 'Akola',
  'Bhandara', 'Buldana', 'Chandrapur',
  'Gadchiroli', 'Gondia', 'Washim', 'Yavatmal',
];

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '—';
  try {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return '—'; }
}

/** Get rainfall colour class + badge style based on IMD classification */
function getRainfallStyle(mm) {
  if (mm === null || mm === undefined) return { badge: 'imd-badge-nil', text: '—', label: 'No Data' };
  const v = parseFloat(mm);
  if (isNaN(v) || v === 0) return { badge: 'imd-badge-dry', text: '0.0 mm', label: 'Dry' };
  if (v <= 2.5)  return { badge: 'imd-badge-trace', text: `${v.toFixed(1)} mm`, label: 'Trace' };
  if (v <= 7.5)  return { badge: 'imd-badge-light', text: `${v.toFixed(1)} mm`, label: 'Light' };
  if (v <= 35.5) return { badge: 'imd-badge-moderate', text: `${v.toFixed(1)} mm`, label: 'Moderate' };
  if (v <= 64.5) return { badge: 'imd-badge-heavy', text: `${v.toFixed(1)} mm`, label: 'Heavy' };
  if (v <= 115.5) return { badge: 'imd-badge-veryheavy', text: `${v.toFixed(1)} mm`, label: 'Very Heavy' };
  return { badge: 'imd-badge-extreme', text: `${v.toFixed(1)} mm`, label: 'Extreme' };
}

// ═══════════════════════════════════════════════════
// SUMMARY CARD
// ═══════════════════════════════════════════════════

function SummaryCard({ icon: Icon, title, value, subtitle, accent }) {
  return (
    <div className="imd-summary-card">
      <div className="imd-summary-icon" style={{ background: `${accent}18`, color: accent }}>
        <Icon size={20} />
      </div>
      <div className="imd-summary-body">
        <p className="imd-summary-label">{title}</p>
        <p className="imd-summary-value" style={{ color: accent }}>{value}</p>
        {subtitle && <p className="imd-summary-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SORT HEADER BUTTON
// ═══════════════════════════════════════════════════

function SortHeader({ label, sortKey, currentSort, onSort }) {
  const active = currentSort.key === sortKey;
  return (
    <button
      className={`imd-sort-btn ${active ? 'imd-sort-active' : ''}`}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}`}
    >
      {label}
      <span className="imd-sort-icons">
        <ChevronUp size={11} className={active && currentSort.dir === 'asc' ? 'imd-sort-icon-on' : 'imd-sort-icon-off'} />
        <ChevronDown size={11} className={active && currentSort.dir === 'desc' ? 'imd-sort-icon-on' : 'imd-sort-icon-off'} />
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════

export default function RainfallObservationPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [daysRange, setDaysRange] = useState(30);

  // Sort
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

  // Pagination
  const [page, setPage] = useState(1);

  // Download state
  const [dlXlsx, setDlXlsx] = useState(false);
  const [dlCsv, setDlCsv] = useState(false);

  // ── FETCH ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDistrictSummary({ days: daysRange });
      if (result.success) {
        setAllData(result.data || []);
        setLastFetched(new Date().toISOString());
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [daysRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, districtFilter, dateFilter, sort, daysRange]);

  // ── DERIVED DATA ──────────────────────────────────

  // Unique dates from data
  const availableDates = useMemo(() => {
    const dates = [...new Set(allData.map(r => r.date))].sort().reverse();
    return dates;
  }, [allData]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let d = allData;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      d = d.filter(r => r.district.toLowerCase().includes(q));
    }
    if (districtFilter) {
      d = d.filter(r => r.district === districtFilter);
    }
    if (dateFilter) {
      d = d.filter(r => r.date === dateFilter);
    }
    // Sort
    d = [...d].sort((a, b) => {
      let cmp = 0;
      if (sort.key === 'district') cmp = a.district.localeCompare(b.district);
      else if (sort.key === 'rainfall') {
        const av = a.rainfall_mm ?? -1;
        const bv = b.rainfall_mm ?? -1;
        cmp = av - bv;
      }
      else if (sort.key === 'date') cmp = a.date.localeCompare(b.date);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return d;
  }, [allData, search, districtFilter, dateFilter, sort]);

  // Summary stats (from latest date only)
  const summaryStats = useMemo(() => {
    const latestDate = availableDates[0] || null;
    const latestRecs = latestDate ? allData.filter(r => r.date === latestDate) : [];
    const valid = latestRecs.filter(r => r.rainfall_mm !== null);
    const total = latestRecs.length;
    const highest = valid.length ? Math.max(...valid.map(r => r.rainfall_mm)) : null;
    const avg = valid.length ? (valid.reduce((s, r) => s + r.rainfall_mm, 0) / valid.length) : null;
    const lastUpd = allData.length
      ? allData.reduce((latest, r) => r.updatedAt > latest ? r.updatedAt : latest, '')
      : null;
    return { total, highest, avg, lastUpd, latestDate };
  }, [allData, availableDates]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // ── SORT HANDLER ─────────────────────────────────
  const handleSort = (key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  // ── DOWNLOAD HANDLERS ─────────────────────────────
  const handleXlsx = async () => {
    setDlXlsx(true);
    const result = await downloadRainfallDbExcel();
    setDlXlsx(false);
    if (result?.success === false) {
      toast.error(result.error || 'Excel download failed', {
        duration: 6000,
        style: { background: '#fff', color: '#1e293b', border: '1px solid #ef4444' },
      });
    } else {
      toast.success('Excel file downloaded successfully', {
        duration: 3000,
        style: { background: '#fff', color: '#1e293b', border: '1px solid #22c55e' },
      });
    }
  };

  const handleCsv = async () => {
    setDlCsv(true);
    const result = await downloadRainfallDbCsv();
    setDlCsv(false);
    if (result?.success === false) {
      toast.error(result.error || 'CSV download failed', {
        duration: 6000,
        style: { background: '#fff', color: '#1e293b', border: '1px solid #ef4444' },
      });
    } else {
      toast.success('CSV file downloaded successfully', {
        duration: 3000,
        style: { background: '#fff', color: '#1e293b', border: '1px solid #22c55e' },
      });
    }
  };

  // ── RENDER ────────────────────────────────────────
  return (
    <div className="imd-page">

      {/* ── PAGE HEADER ─────────────────────────────── */}
      <div className="imd-page-header">
        <div className="imd-page-title-block">
          <div className="imd-page-icon">
            <CloudRain size={22} />
          </div>
          <div>
            <h2 className="imd-page-title">Rainfall Observations</h2>
            <p className="imd-page-subtitle">
              District-wise Rainfall Data · Vidarbha Region (Maharashtra) ·
              Source: IMD RMC Nagpur
            </p>
          </div>
        </div>
        <div className="imd-page-actions">
          {/* Days range selector */}
          <select
            id="days-range-select"
            className="imd-select"
            value={daysRange}
            onChange={e => setDaysRange(Number(e.target.value))}
          >
            <option value={3}>Last 3 Days</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last 1 Year</option>
          </select>
          <button
            id="refresh-btn"
            className="imd-btn imd-btn-ghost"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'imd-spin' : ''} />
            Refresh
          </button>
          <button
            id="download-xlsx-btn"
            className={`imd-btn imd-btn-success ${allData.length === 0 ? 'imd-btn-disabled' : ''}`}
            onClick={handleXlsx}
            disabled={dlXlsx || allData.length === 0}
            title={allData.length === 0 ? 'No rainfall data available to export.' : 'Download Excel'}
          >
            <FileSpreadsheet size={14} />
            {dlXlsx ? 'Preparing…' : 'Excel (.xlsx)'}
          </button>
          <button
            id="download-csv-btn"
            className={`imd-btn imd-btn-primary ${allData.length === 0 ? 'imd-btn-disabled' : ''}`}
            onClick={handleCsv}
            disabled={dlCsv || allData.length === 0}
            title={allData.length === 0 ? 'No rainfall data available to export.' : 'Download CSV'}
          >
            <FileText size={14} />
            {dlCsv ? 'Preparing…' : 'CSV (.csv)'}
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ───────────────────────────── */}
      <div className="imd-summary-row">
        <SummaryCard
          icon={MapPin}
          title="Districts Reporting"
          value={loading ? '—' : summaryStats.total}
          subtitle={summaryStats.latestDate ? formatDateDisplay(summaryStats.latestDate) : 'Latest date'}
          accent="#1d4ed8"
        />
        <SummaryCard
          icon={CloudRain}
          title="Highest Rainfall Today"
          value={loading ? '—' : summaryStats.highest !== null ? `${summaryStats.highest.toFixed(1)} mm` : '0.0 mm'}
          subtitle="Max across all districts"
          accent="#0369a1"
        />
        <SummaryCard
          icon={BarChart2}
          title="Average Rainfall"
          value={loading ? '—' : summaryStats.avg !== null ? `${summaryStats.avg.toFixed(1)} mm` : '0.0 mm'}
          subtitle="District average (latest date)"
          accent="#0891b2"
        />
        <SummaryCard
          icon={Clock}
          title="Last Updated"
          value={loading ? '—' : formatTimeAgo(summaryStats.lastUpd)}
          subtitle={summaryStats.lastUpd ? new Date(summaryStats.lastUpd).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit' }) + ' IST' : '—'}
          accent="#374151"
        />
      </div>

      {/* ── CONTROLS BAR ───────────────────────────── */}
      <div className="imd-controls">
        {/* Search */}
        <div className="imd-search-wrap">
          <Search size={15} className="imd-search-icon" />
          <input
            id="district-search"
            type="text"
            placeholder="Search district…"
            className="imd-search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="imd-clear-btn" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* District filter */}
        <select
          id="district-filter"
          className="imd-select"
          value={districtFilter}
          onChange={e => setDistrictFilter(e.target.value)}
        >
          <option value="">All Districts</option>
          {VIDARBHA_DISTRICTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Date filter */}
        <select
          id="date-filter"
          className="imd-select"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
        >
          <option value="">All Dates</option>
          {availableDates.map(d => (
            <option key={d} value={d}>{formatDateDisplay(d)}</option>
          ))}
        </select>

        {/* Results count */}
        <span className="imd-results-count">
          {loading ? 'Loading…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
        </span>

        {/* Clear filters */}
        {(search || districtFilter || dateFilter) && (
          <button
            className="imd-btn imd-btn-ghost imd-btn-sm"
            onClick={() => { setSearch(''); setDistrictFilter(''); setDateFilter(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── TABLE ──────────────────────────────────── */}
      <div className="imd-table-wrap">
        {loading ? (
          <div className="imd-loading-state">
            <Loader2 size={32} className="imd-spin imd-loading-icon" />
            <p className="imd-loading-text">Loading rainfall data…</p>
          </div>
        ) : error ? (
          <div className="imd-error-state">
            <AlertCircle size={28} className="imd-error-icon" />
            <p className="imd-error-text">{error}</p>
            <button className="imd-btn imd-btn-primary" onClick={fetchData}>Retry</button>
          </div>
        ) : allData.length === 0 ? (
          <div className="imd-empty-state">
            <Database size={36} className="imd-empty-icon" />
            <p className="imd-empty-title">No rainfall data available</p>
            <p className="imd-empty-sub">Data will appear after daily scraping from IMD Nagpur begins.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="imd-empty-state">
            <Search size={32} className="imd-empty-icon" />
            <p className="imd-empty-title">No matching records</p>
            <p className="imd-empty-sub">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <table className="imd-table" id="rainfall-obs-table">
            <thead className="imd-thead">
              <tr>
                <th className="imd-th imd-th-idx">#</th>
                <th className="imd-th">
                  <SortHeader label="District" sortKey="district" currentSort={sort} onSort={handleSort} />
                </th>
                <th className="imd-th imd-th-center">
                  <SortHeader label="Rainfall (mm)" sortKey="rainfall" currentSort={sort} onSort={handleSort} />
                </th>
                <th className="imd-th imd-th-center">
                  <SortHeader label="Observation Date" sortKey="date" currentSort={sort} onSort={handleSort} />
                </th>
                <th className="imd-th imd-th-center">Category</th>
                <th className="imd-th imd-th-center">Stations</th>
                <th className="imd-th imd-th-center">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, idx) => {
                const rf = getRainfallStyle(row.rainfall_mm);
                const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                return (
                  <tr
                    key={`${row.district}|${row.date}`}
                    className={`imd-tr ${idx % 2 === 0 ? 'imd-tr-even' : 'imd-tr-odd'}`}
                  >
                    <td className="imd-td imd-td-idx">{rowNum}</td>
                    <td className="imd-td imd-td-district">
                      <span className="imd-district-dot" />
                      {row.district}
                    </td>
                    <td className="imd-td imd-td-center">
                      <span className={`imd-badge ${rf.badge}`}>{rf.text}</span>
                    </td>
                    <td className="imd-td imd-td-center imd-td-date">
                      {formatDateDisplay(row.date)}
                    </td>
                    <td className="imd-td imd-td-center">
                      <span className={`imd-category ${rf.badge}`}>{rf.label}</span>
                    </td>
                    <td className="imd-td imd-td-center imd-td-muted">
                      {row.stationCount ?? '—'}
                    </td>
                    <td className="imd-td imd-td-center imd-td-muted" title={row.updatedAt}>
                      {formatTimeAgo(row.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── PAGINATION ─────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="imd-pagination">
          <span className="imd-pg-info">
            Page {page} of {totalPages} · {filtered.length} records
          </span>
          <div className="imd-pg-controls">
            <button className="imd-pg-btn" disabled={page === 1} onClick={() => setPage(1)} title="First page">
              <ChevronsLeft size={14} />
            </button>
            <button className="imd-pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)} title="Previous page">
              <ChevronLeft size={14} />
            </button>
            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg;
              if (totalPages <= 5) pg = i + 1;
              else if (page <= 3) pg = i + 1;
              else if (page >= totalPages - 2) pg = totalPages - 4 + i;
              else pg = page - 2 + i;
              return (
                <button
                  key={pg}
                  className={`imd-pg-btn ${pg === page ? 'imd-pg-active' : ''}`}
                  onClick={() => setPage(pg)}
                >
                  {pg}
                </button>
              );
            })}
            <button className="imd-pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} title="Next page">
              <ChevronRight size={14} />
            </button>
            <button className="imd-pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)} title="Last page">
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── LEGEND ─────────────────────────────────── */}
      <div className="imd-legend">
        <span className="imd-legend-title">IMD Classification:</span>
        {[
          { cls: 'imd-badge-dry',       label: 'Dry (0 mm)' },
          { cls: 'imd-badge-trace',     label: 'Trace (≤2.5)' },
          { cls: 'imd-badge-light',     label: 'Light (≤7.5)' },
          { cls: 'imd-badge-moderate',  label: 'Moderate (≤35.5)' },
          { cls: 'imd-badge-heavy',     label: 'Heavy (≤64.5)' },
          { cls: 'imd-badge-veryheavy', label: 'Very Heavy (≤115.5)' },
          { cls: 'imd-badge-extreme',   label: 'Extreme (>115.5)' },
        ].map(item => (
          <span key={item.label} className={`imd-badge ${item.cls} imd-legend-badge`}>{item.label}</span>
        ))}
      </div>

      {/* ── FOOTER NOTE ────────────────────────────── */}
      <p className="imd-footer-note">
        <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
        Data sourced from official IMD Nagpur observations page. Rainfall values represent the maximum reading
        among all stations within each district. Database updated automatically every day.
        {lastFetched && (
          <span> · Page data loaded at {new Date(lastFetched).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</span>
        )}
      </p>

    </div>
  );
}
