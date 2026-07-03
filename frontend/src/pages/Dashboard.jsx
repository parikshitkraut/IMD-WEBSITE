import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  ComposedChart
} from 'recharts';
import {
  Thermometer, CloudRain, Droplets, Wind, AlertTriangle,
  TrendingUp, MapPin, Activity, Zap, BarChart3, Loader2,
  Download, FileSpreadsheet, FileText, Database, RefreshCw, Calendar
} from 'lucide-react';
import { fetchLiveWeather } from '../services/api';
import { fetchRecentRainfall, downloadRainfallDbExcel, downloadRainfallDbCsv } from '../services/api';
import { toast } from 'react-hot-toast';
import CityCard from '../components/CityCard';

const alertColors = {
  normal: 'border-green-500/40 bg-green-500/10 text-green-400',
  watch: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  warning: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  danger: 'border-red-500/40 bg-red-500/10 text-red-400',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-3 border border-blue-700/40 text-xs shadow-2xl">
        <p className="text-cyan-300 font-semibold mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}:</span>
            <strong className="text-white ml-auto">{p.value}{p.name.includes('Temp') ? '°C' : p.name.includes('Humidity') ? '%' : p.name.includes('Rainfall') ? ' mm' : '%'}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ icon: Icon, title, value, unit, subtitle, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-4 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10"
      style={{ background: color, transform: 'translate(30%, -30%)' }} />
    <div className="relative z-10">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg" style={{ background: `${color}25` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-blue-400 text-xs">{title}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-white">{value}</span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      <p className="text-[10px] text-blue-500 mt-1">{subtitle}</p>
    </div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════
// Rainfall color-coding (IMD classification)
// ═══════════════════════════════════════════════════════════════

function getRainfallColor(value) {
  if (value === null || value === undefined || value === '') return 'text-gray-600';
  const v = parseFloat(value);
  if (isNaN(v) || v === 0) return 'text-gray-500';
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

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDayName(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  } catch {
    return '';
  }
}

export default function Dashboard() {
  const [liveData, setLiveData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Rainfall database state
  const [rainfallData, setRainfallData] = useState([]);
  const [rainfallLoading, setRainfallLoading] = useState(true);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  useEffect(() => {
    fetchLiveWeather().then(data => {
      setLiveData(data);
      setLoading(false);
    });

    // Fetch previous 3 days rainfall from the persistent database
    fetchRecentRainfall(3).then(result => {
      setRainfallData(result.data || []);
      setRainfallLoading(false);
    });
  }, []);

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true);
    const result = await downloadRainfallDbExcel();
    setDownloadingXlsx(false);
    if (result && !result.success) {
      toast.error(result.error || 'Excel download failed', { duration: 5000, style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #ef4444' } });
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    const result = await downloadRainfallDbCsv();
    setDownloadingCsv(false);
    if (result && !result.success) {
      toast.error(result.error || 'CSV download failed', { duration: 5000, style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #ef4444' } });
    }
  };

  const refreshRainfall = async () => {
    setRainfallLoading(true);
    const result = await fetchRecentRainfall(3);
    setRainfallData(result.data || []);
    setRainfallLoading(false);
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      </div>
    );
  }

  const nagpur = liveData.find(c => c.city === 'Nagpur') || liveData[0];
  const maxTempAvg = (liveData.reduce((acc, curr) => acc + curr.temperature.max, 0) / liveData.length).toFixed(1);
  const rainTotal = liveData.reduce((acc, curr) => acc + curr.rainfall.last24h, 0).toFixed(1);
  const activeAlerts = liveData.filter(c => c.analysis.alertLevel !== 'GREEN').length;

  const heatmapData = liveData.map(c => ({
    name: c.city,
    temp: c.temperature.max,
    rainfall: c.rainfall.last24h,
    humidity: c.humidity.morning,
  }));

  // Group rainfall data by date for the 3-day table
  const rainfallByDate = {};
  rainfallData.forEach(rec => {
    if (!rainfallByDate[rec.date]) {
      rainfallByDate[rec.date] = [];
    }
    rainfallByDate[rec.date].push(rec);
  });
  const rainfallDates = Object.keys(rainfallByDate).sort().reverse(); // newest first

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 space-y-6 pb-24"
    >
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black gradient-text">Weather Intelligence Dashboard</h2>
          <p className="text-blue-400 text-sm mt-0.5">
            Vidarbha Regional Overview •{' '}
            <span className="text-cyan-400">Live Data Sync</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 glass-light px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
            <span className="text-green-400 text-xs font-semibold">Live Mock API Connected</span>
          </div>
          <div className="glass-light px-3 py-1.5 rounded-lg text-xs text-blue-300">
            {liveData.length} Stations Active
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Thermometer} title="Avg Max Temp" value={maxTempAvg} unit="°C" subtitle="Vidarbha Region" color="#ef4444" delay={0} />
        <StatCard icon={CloudRain} title="Total Rainfall (24h)" value={rainTotal} unit="mm" subtitle="Across 12 stations" color="#3b82f6" delay={0.05} />
        <StatCard icon={Droplets} title="Avg Humidity" value={nagpur?.humidity.morning || '45'} unit="%" subtitle="Nagpur Morning RH" color="#06b6d4" delay={0.1} />
        <StatCard icon={AlertTriangle} title="Active Heat Alerts" value={activeAlerts} unit="" subtitle="Districts > 41°C" color="#f97316" delay={0.15} />
      </div>

      {/* Hover-Based Analytics City Grid (MAIN FEATURE) */}
      <div>
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-cyan-400" />
          Interactive City Analytics (Click for detailed forecast)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {liveData.map((cityData) => (
            <CityCard key={cityData.id} data={cityData} />
          ))}
        </div>
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* District temperature comparison */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Vidarbha Temperature Comparison</h3>
              <p className="text-blue-400 text-xs">Live Max/Min across districts</p>
            </div>
            <BarChart3 size={18} className="text-amber-400" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={heatmapData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#4e7a9e' }} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} domain={[20, 50]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#60a5e0' }} />
              <Bar dataKey="temp" fill="#f97316" radius={[3, 3, 0, 0]} name="Max Temp" />
              <Bar dataKey="humidity" fill="#06b6d4" radius={[3, 3, 0, 0]} name="Humidity %" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        
        {/* Alert summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4"
        >
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Zap size={16} className="text-red-400" />
            Active Weather Alerts
          </h3>
          <div className="space-y-3 h-[260px] overflow-y-auto pr-2 custom-scrollbar">
            {liveData.filter(c => c.analysis.alertLevel !== 'GREEN').map((alert, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-xl border ${
                alert.analysis.alertLevel === 'RED' ? alertColors.danger :
                alert.analysis.alertLevel === 'ORANGE' ? alertColors.warning : alertColors.watch
              }`} style={{ background: 'rgba(0,0,0,0.2)' }}>
                <span className="text-base flex-shrink-0">
                  {alert.analysis.alertLevel === 'RED' ? '🔴' : alert.analysis.alertLevel === 'ORANGE' ? '🟠' : '🟡'}
                </span>
                <div>
                  <p className="font-bold text-xs mb-0.5">{alert.analysis.heatwave ? 'Heatwave Warning' : 'High Temperature Alert'}</p>
                  <p className="text-[10px] opacity-80 font-semibold">{alert.city}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Max temp recorded: {alert.temperature.max}°C</p>
                </div>
              </div>
            ))}
            {activeAlerts === 0 && (
              <div className="flex gap-3 p-3 rounded-xl border border-green-500/40 bg-green-500/10 text-green-400">
                <span className="text-base flex-shrink-0">🟢</span>
                <div>
                  <p className="font-bold text-xs mb-0.5">No Active Alerts</p>
                  <p className="text-[10px] opacity-80">All districts reporting normal temperatures.</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PREVIOUS 3 DAYS RAINFALL — Official IMD Data              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card rounded-2xl overflow-hidden"
        id="rainfall-section"
      >
        {/* Section header */}
        <div
          className="px-5 py-4 border-b border-blue-900/40"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(37,99,168,0.10) 50%, rgba(99,37,168,0.08) 100%)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <CloudRain size={18} className="text-cyan-400" />
                Previous 3 Days — Official IMD Rainfall Data
              </h3>
              <p className="text-blue-400 text-xs mt-0.5">
                Source: IMD Nagpur Observations • Rainfall Database • Updated daily
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Download XLSX */}
              <button
                onClick={handleDownloadXlsx}
                disabled={downloadingXlsx}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white transition-all shadow-lg shadow-green-900/30 disabled:opacity-50 cursor-pointer"
                id="download-rainfall-xlsx"
              >
                <FileSpreadsheet size={13} />
                {downloadingXlsx ? 'Preparing...' : 'Download Excel'}
              </button>
              {/* Download CSV */}
              <button
                onClick={handleDownloadCsv}
                disabled={downloadingCsv}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 cursor-pointer"
                id="download-rainfall-csv"
              >
                <FileText size={13} />
                {downloadingCsv ? 'Preparing...' : 'Download CSV'}
              </button>
              {/* Refresh */}
              <button
                onClick={refreshRainfall}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-light text-blue-300 hover:text-white transition-all border border-blue-800/30 cursor-pointer"
                id="refresh-rainfall"
              >
                <RefreshCw size={13} className={rainfallLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {rainfallLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-cyan-400 animate-spin" />
                <p className="text-blue-300 text-sm font-medium animate-pulse">Loading rainfall data...</p>
              </div>
            </div>
          ) : rainfallData.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Database size={40} className="text-blue-700" />
                <p className="text-blue-300 font-semibold">No rainfall data available yet</p>
                <p className="text-blue-500 text-xs">Data will appear after the historical import and daily scraping begins</p>
              </div>
            </div>
          ) : (
            <>
              {/* Data source badges */}
              <div className="flex items-center gap-3 mb-4 flex-wrap text-[10px]">
                <div className="flex items-center gap-1.5 glass-light px-3 py-1.5 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
                  <span className="text-green-400 font-semibold">Official IMD Data</span>
                </div>
                <div className="glass-light px-3 py-1.5 rounded-lg text-blue-300">
                  <Calendar size={10} className="inline mr-1" />
                  {rainfallDates.length} Day{rainfallDates.length !== 1 ? 's' : ''} • {rainfallData.length} Records
                </div>
                <div className="glass-light px-3 py-1.5 rounded-lg text-blue-300">
                  <Database size={10} className="inline mr-1" />
                  Persistent Database
                </div>
              </div>

              {/* Rainfall table — grouped by date */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" id="rainfall-3day-table">
                  <thead>
                    <tr className="bg-blue-900/25 border-b border-blue-900/40">
                      <th className="text-left px-4 py-3 text-blue-300 font-semibold min-w-[130px]">Date</th>
                      <th className="text-left px-4 py-3 text-blue-300 font-semibold min-w-[180px]">Station Name</th>
                      <th className="text-center px-4 py-3 text-cyan-300 font-semibold min-w-[120px]">Rainfall (mm)</th>
                      <th className="text-center px-4 py-3 text-blue-400 font-semibold min-w-[100px]">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rainfallDates.map((date, dIdx) => {
                      const stations = rainfallByDate[date].sort((a, b) => a.station.localeCompare(b.station));
                      return stations.map((rec, sIdx) => (
                        <tr
                          key={`${date}-${rec.station}`}
                          className={`border-b border-blue-900/15 transition-all hover:bg-blue-900/15 ${
                            dIdx % 2 === 0 ? '' : 'bg-blue-900/5'
                          }`}
                        >
                          {/* Show date only on first row of each date group */}
                          <td className={`px-4 py-2.5 font-semibold ${sIdx === 0 ? 'text-white' : 'text-transparent'}`}>
                            {sIdx === 0 ? (
                              <div>
                                <span className="text-white">{formatDate(date)}</span>
                                <span className="text-blue-500 ml-2 text-[10px]">{formatDayName(date)}</span>
                              </div>
                            ) : ''}
                          </td>
                          <td className="px-4 py-2.5 text-blue-200 font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin size={10} className="text-cyan-500 shrink-0" />
                              {rec.station}
                            </div>
                          </td>
                          <td className={`text-center px-4 py-2.5 font-bold text-sm ${getRainfallColor(rec.rainfall_mm)} ${getRainfallBg(rec.rainfall_mm)} rounded`}>
                            {rec.rainfall_mm !== null ? rec.rainfall_mm.toFixed(1) : '—'}
                          </td>
                          <td className="text-center px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                              rec.source === 'excel_import'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                : 'bg-green-500/15 text-green-400 border border-green-500/20'
                            }`}>
                              {rec.source === 'excel_import' ? '📊 Excel' : '🌐 Scraped'}
                            </span>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>

              {/* IMD Classification Legend */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap text-[10px]">
                <span className="text-gray-500 font-semibold">IMD Classification:</span>
                {[
                  { label: 'Dry (0 mm)', color: 'text-gray-500' },
                  { label: 'Light (≤2.5)', color: 'text-green-400' },
                  { label: 'Moderate (2.5–7.5)', color: 'text-cyan-400' },
                  { label: 'Heavy (7.5–35.5)', color: 'text-blue-400' },
                  { label: 'Very Heavy (35.5–64.5)', color: 'text-blue-300' },
                  { label: 'Extreme (>64.5)', color: 'text-purple-400' },
                ].map(item => (
                  <span key={item.label} className={`px-2 py-0.5 rounded glass-light ${item.color} font-medium`}>
                    {item.label}
                  </span>
                ))}
              </div>

              {/* Footer note */}
              <p className="text-[10px] text-blue-600 text-center mt-3">
                *** Data sourced from official IMD Nagpur observations — Rainfall Database updated daily ***
              </p>
            </>
          )}
        </div>
      </motion.div>

    </motion.div>
  );
}
