import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from 'recharts';
import {
  CloudRain, Download, ChevronLeft, ChevronRight, Loader2,
  FileSpreadsheet, Calendar, Droplets, MapPin, BarChart3, RefreshCw, Upload
} from 'lucide-react';
import { fetchMonthlyRainfall, downloadRainfallExcel, uploadRainfallFile } from '../services/api';
import { toast } from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getRainfallColor(value) {
  if (value === null || value === undefined || value === '') return '';
  const v = parseFloat(value);
  if (isNaN(v) || v === 0) return 'text-gray-600';
  if (v <= 2.5) return 'text-green-400';
  if (v <= 7.5) return 'text-cyan-400';
  if (v <= 35.5) return 'text-blue-400';
  if (v <= 64.5) return 'text-blue-300 font-bold';
  return 'text-purple-400 font-black';
}

function getRainfallBg(value) {
  if (value === null || value === undefined || value === '') return '';
  const v = parseFloat(value);
  if (isNaN(v) || v === 0) return '';
  if (v <= 2.5) return 'bg-green-500/5';
  if (v <= 7.5) return 'bg-cyan-500/8';
  if (v <= 35.5) return 'bg-blue-500/10';
  if (v <= 64.5) return 'bg-blue-500/15';
  return 'bg-purple-500/20';
}

function getRainfallCategory(value) {
  if (value === null || value === undefined) return '';
  const v = parseFloat(value);
  if (isNaN(v) || v === 0) return 'Dry';
  if (v <= 2.5) return 'Light';
  if (v <= 7.5) return 'Moderate';
  if (v <= 35.5) return 'Heavy';
  if (v <= 64.5) return 'Very Heavy';
  return 'Extreme';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-3 border border-blue-700/40 text-xs shadow-2xl">
        <p className="text-cyan-300 font-semibold mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}:</span>
            <strong className="text-white ml-auto">{p.value} mm</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function RainfallReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [uploading, setUploading] = useState(false);
  const { isDarkMode } = useTheme();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await fetchMonthlyRainfall(month, year);
    setData(result);
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    const success = await downloadRainfallExcel(month, year);
    if (success) {
      toast.success('Excel downloaded successfully!', {
        icon: '📊',
        style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #22c55e' }
      });
    } else {
      toast.error('Failed to download Excel');
    }
    setDownloading(false);
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const toggleDistrict = (distName) => {
    setExpandedDistricts(prev => ({
      ...prev,
      [distName]: !prev[distName],
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadRainfallFile(file);
    if (result.success) {
      toast.success(result.message, {
        icon: '✅',
        style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #22c55e' }
      });
      fetchData(); // Reload data
    } else {
      toast.error(result.error || 'Upload failed');
    }
    setUploading(false);
    e.target.value = ''; // Reset file input
  };

  // Determine which days have data
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysWithData = new Set();
  if (data?.districts) {
    data.districts.forEach(dist => {
      Object.keys(dist.dailyData || {}).forEach(d => daysWithData.add(parseInt(d)));
    });
  }
  const activeDays = Array.from(daysWithData).sort((a, b) => a - b);
  const maxDay = activeDays.length > 0 ? Math.max(...activeDays) : daysInMonth;

  // Chart data for district totals
  const chartData = data?.districts?.map(dist => ({
    name: dist.city,
    total: parseFloat(dist.totalRainfall) || 0,
    rainyDays: dist.rainyDays,
  })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6 pb-24"
    >
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold gradient-text mb-1 flex items-center gap-2">
            <CloudRain size={22} className="text-cyan-400" />
            Daily Rainfall Report
          </h2>
          <p className="text-blue-400 text-sm">
            Real IMD readings from RMC Nagpur Excel data •{' '}
            <span className="text-cyan-400">{data?.subdivision || 'Vidarbha'} Region</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Upload button */}
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-amber-600/80 to-orange-700/80 hover:from-amber-500 hover:to-orange-600 text-white cursor-pointer transition-all shadow-lg shadow-amber-900/30">
            <Upload size={13} />
            {uploading ? 'Uploading...' : 'Upload New Data'}
            <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {/* Download button */}
          <button
            onClick={handleDownloadExcel}
            disabled={downloading || !data}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white transition-all shadow-lg shadow-green-900/30 disabled:opacity-50 cursor-pointer"
          >
            <Download size={13} />
            {downloading ? 'Preparing...' : 'Download Excel'}
          </button>
          {/* Refresh */}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-light text-blue-300 hover:text-white transition-all border border-blue-800/30 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg glass-light hover:bg-blue-900/50 text-blue-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="glass-card px-6 py-3 rounded-xl flex items-center gap-3">
          <Calendar size={18} className="text-cyan-400" />
          <span className="text-white font-bold text-lg">{MONTH_NAMES[month - 1]} {year}</span>
        </div>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg glass-light hover:bg-blue-900/50 text-blue-400 hover:text-white transition-all cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Data Source Info */}
      {data && (
        <div className="flex items-center justify-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5 glass-light px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
            <span className="text-green-400 font-semibold">Source: IMD Excel Data</span>
          </div>
          <div className="glass-light px-3 py-1.5 rounded-lg text-blue-300">
            Data up to: {data.dataDate || 'N/A'}
          </div>
          <div className="glass-light px-3 py-1.5 rounded-lg text-blue-300">
            {data.districts?.length || 0} Districts • {activeDays.length} Days
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-20 glass-card rounded-2xl">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-blue-400 animate-spin" />
            <p className="text-blue-300 font-semibold animate-pulse">Loading rainfall data...</p>
          </div>
        </div>
      ) : !data || !data.districts || data.districts.length === 0 ? (
        <div className="flex items-center justify-center p-20 glass-card rounded-2xl">
          <div className="flex flex-col items-center gap-4">
            <CloudRain size={48} className="text-blue-600" />
            <p className="text-blue-300 font-semibold">No rainfall data available for {MONTH_NAMES[month - 1]} {year}</p>
            <p className="text-blue-500 text-sm">Upload an IMD Excel file to populate data</p>
          </div>
        </div>
      ) : (
        <>
          {/* District Rainfall Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5 rounded-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-cyan-400" />
                  District-wise Total Rainfall — {MONTH_NAMES[month - 1]} {year}
                </h3>
                <p className="text-blue-400 text-xs mt-0.5">District average rainfall (mm) from all stations</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.12)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#60a5e0', fontWeight: 600 }}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#60a5e0', paddingTop: '10px' }} />
                <Bar dataKey="total" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Total Rainfall (mm)" barSize={35} />
                <Line type="monotone" dataKey="rainyDays" stroke="#f97316" strokeWidth={2} dot={{ r: 4, fill: '#f97316' }} name="Rainy Days" yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 flex-wrap text-[10px]">
            <span className="text-gray-500 font-semibold">IMD Rainfall Classification:</span>
            {[
              { label: 'Dry (0 mm)', color: 'text-gray-600', bg: '' },
              { label: 'Light (≤2.5)', color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Moderate (2.5–7.5)', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { label: 'Heavy (7.5–35.5)', color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Very Heavy (35.5–64.5)', color: 'text-blue-300', bg: 'bg-blue-500/15' },
              { label: 'Extreme (>64.5)', color: 'text-purple-400', bg: 'bg-purple-500/20' },
            ].map(item => (
              <span key={item.label} className={`px-2 py-0.5 rounded ${item.color} ${item.bg} font-medium`}>
                {item.label}
              </span>
            ))}
          </div>

          {/* Main Data Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl overflow-hidden"
          >
            {/* Table header */}
            <div className="px-5 py-3 border-b border-blue-900/40 flex items-center justify-between"
              style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(37,99,168,0.15) 0%, rgba(6,182,212,0.08) 100%)' : 'linear-gradient(135deg, rgba(59,130,196,0.06) 0%, rgba(6,182,212,0.03) 100%)' }}
            >
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  Rainfall Statement — {data.subdivision || 'Vidarbha'} Region
                </h3>
                <p className="text-blue-400 text-xs mt-0.5">
                  {MONTH_NAMES[month - 1]} {year} • Click district to expand stations
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all cursor-pointer"
                >
                  <Download size={11} /> XLSX
                </button>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-blue-900/25 border-b border-blue-900/40">
                    <th className="text-left px-3 py-2 text-blue-300 font-semibold sticky left-0 z-10 bg-[#0a1628] min-w-[160px]">
                      District / Station
                    </th>
                    {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => (
                      <th key={day} className={`text-center px-1 py-2 font-semibold min-w-[36px] ${
                        daysWithData.has(day) ? 'text-cyan-300' : 'text-blue-800'
                      }`}>
                        {day}
                      </th>
                    ))}
                    <th className="text-center px-2 py-2 text-amber-300 font-bold min-w-[50px] border-l border-blue-900/40">Total</th>
                    <th className="text-center px-2 py-2 text-emerald-300 font-bold min-w-[40px]">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.districts.map((dist, dIdx) => (
                    <DistrictRows
                      key={dist.district}
                      dist={dist}
                      dIdx={dIdx}
                      maxDay={maxDay}
                      daysWithData={daysWithData}
                      expanded={expandedDistricts[dist.district]}
                      onToggle={() => toggleDistrict(dist.district)}
                      isDarkMode={isDarkMode}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const totalRegion = data.districts.reduce((s, d) => s + (parseFloat(d.totalRainfall) || 0), 0);
              const maxDist = data.districts.reduce((a, b) => (parseFloat(a.totalRainfall) || 0) > (parseFloat(b.totalRainfall) || 0) ? a : b);
              const totalRainyDays = Math.max(...data.districts.map(d => d.rainyDays || 0));
              const stationCount = data.districts.reduce((s, d) => s + (d.stations?.length || 0), 0);

              return [
                { label: 'Regional Total (Avg)', value: `${totalRegion.toFixed(1)} mm`, sub: 'All districts combined', icon: Droplets, color: '#38bdf8' },
                { label: 'Highest District', value: `${parseFloat(maxDist.totalRainfall).toFixed(1)} mm`, sub: maxDist.city, icon: CloudRain, color: '#06b6d4' },
                { label: 'Max Rainy Days', value: totalRainyDays, sub: 'Across districts', icon: Calendar, color: '#22c55e' },
                { label: 'Total Stations', value: stationCount, sub: `${data.districts.length} districts`, icon: MapPin, color: '#f97316' },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="glass-card p-4 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10"
                    style={{ background: card.color, transform: 'translate(30%, -30%)' }} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg" style={{ background: `${card.color}20` }}>
                        <card.icon size={14} style={{ color: card.color }} />
                      </div>
                      <span className="text-blue-400 text-[10px]">{card.label}</span>
                    </div>
                    <div className="text-xl font-black text-white">{card.value}</div>
                    <p className="text-[10px] text-blue-500 mt-0.5">{card.sub}</p>
                  </div>
                </motion.div>
              ));
            })()}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-blue-600 text-center">
            *** Data sourced from IMD MK-Format Rainfall Statement — Regional Meteorological Centre, Nagpur ***
          </p>
        </>
      )}
    </motion.div>
  );
}

// Sub-component for district rows with expandable station rows
function DistrictRows({ dist, dIdx, maxDay, daysWithData, expanded, onToggle, isDarkMode }) {
  return (
    <>
      {/* District summary row */}
      <tr
        className={`border-b border-blue-900/20 cursor-pointer transition-all hover:bg-blue-900/15 ${dIdx % 2 === 0 ? 'rainfall-row-even' : 'rainfall-row-odd'}`}
        style={{
          background: isDarkMode
            ? (dIdx % 2 === 0 ? 'rgba(15,40,71,0.3)' : 'rgba(10,30,55,0.3)')
            : (dIdx % 2 === 0 ? 'rgba(59,130,196,0.03)' : 'rgba(59,130,196,0.06)'),
          borderLeft: expanded ? '3px solid rgba(56,189,248,0.6)' : '3px solid transparent',
        }}
        onClick={onToggle}
      >
        <td className="px-3 py-2 font-bold text-white sticky left-0 z-10 rainfall-sticky-cell"
          style={{ background: isDarkMode
            ? (dIdx % 2 === 0 ? 'rgba(15,40,71,0.95)' : 'rgba(10,30,55,0.95)')
            : (dIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9')
          }}
        >
          <div className="flex items-center gap-2">
            <MapPin size={10} className="text-cyan-400 shrink-0" />
            <span>{dist.city}</span>
            <span className="text-[8px] text-blue-500 font-normal ml-auto">
              {expanded ? '▼' : '▶'} {dist.stations?.length || 0} stn
            </span>
          </div>
        </td>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
          const val = dist.dailyData?.[String(day)];
          const display = val !== undefined && val !== null ? val : '';
          return (
            <td key={day} className={`text-center px-1 py-2 ${getRainfallColor(display)} ${getRainfallBg(display)} font-semibold`}>
              {display !== '' ? display : '—'}
            </td>
          );
        })}
        <td className="text-center px-2 py-2 text-amber-300 font-bold border-l border-blue-900/40">
          {dist.totalRainfall}
        </td>
        <td className="text-center px-2 py-2 text-emerald-300 font-bold">
          {dist.rainyDays}
        </td>
      </tr>

      {/* Expanded station rows */}
      <AnimatePresence>
        {expanded && dist.stations?.map((station, sIdx) => (
          <motion.tr
            key={station.name}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-blue-900/10 rainfall-station-row"
            style={{ background: isDarkMode ? 'rgba(5,15,30,0.7)' : 'rgba(248,250,252,0.95)' }}
          >
            <td className="px-3 py-1.5 text-blue-400 sticky left-0 z-10 rainfall-station-sticky"
              style={{ background: isDarkMode ? 'rgba(5,15,30,0.95)' : 'rgba(248,250,252,0.98)', paddingLeft: '28px' }}
            >
              <span className="text-[9px]">{station.name}</span>
            </td>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
              const val = station.dailyRainfall?.[String(day)];
              const display = val !== null && val !== undefined ? val : '';
              return (
                <td key={day} className={`text-center px-1 py-1.5 text-[9px] ${getRainfallColor(display)} ${getRainfallBg(display)}`}>
                  {display !== '' ? display : '—'}
                </td>
              );
            })}
            <td className="text-center px-2 py-1.5 text-amber-200 text-[9px] border-l border-blue-900/40">
              {station.total}
            </td>
            <td className="text-center px-2 py-1.5 text-emerald-200 text-[9px]">
              {station.rainyDays}
            </td>
          </motion.tr>
        ))}
      </AnimatePresence>
    </>
  );
}
