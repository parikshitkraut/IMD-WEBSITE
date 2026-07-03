import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart
} from 'recharts';
import {
  Thermometer, Droplets, Wind, Eye, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Cloud, CloudRain, Sun, Zap, MapPin,
  FileText, BarChart3, X, Download
} from 'lucide-react';
import { weatherData, regions } from '../data/weatherData';
import { fetchForecast10 } from '../services/api';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { useTheme } from '../context/ThemeContext';

const alertColors = {
  normal: 'border-green-500/40 bg-green-500/10 text-green-400',
  watch: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  warning: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  danger: 'border-red-500/40 bg-red-500/10 text-red-400',
};

const alertIcons = {
  'Normal': '🟢',
  'Heatwave Watch': '🟡',
  'Heatwave Warning': '🔴',
};

function getTempColor(temp) {
  if (temp >= 42) return '#ef4444';
  if (temp >= 38) return '#f97316';
  if (temp >= 34) return '#f59e0b';
  if (temp >= 30) return '#eab308';
  return '#22c55e';
}

function getTrendIcon(trend) {
  if (trend === 'Rising') return <TrendingUp size={12} className="text-red-400" />;
  if (trend === 'Falling') return <TrendingDown size={12} className="text-blue-400" />;
  return <Minus size={12} className="text-gray-400" />;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-2 border border-blue-700/40 text-xs">
        <p className="text-blue-300 mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}: <strong className="text-white">{p.value}</strong></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function CitySidePanel({ city, regionStats, onOpenRainfallModal, onClose }) {
  const timeData = city.history;
  const [forecast10, setForecast10] = useState(null);
  const { isDarkMode } = useTheme();
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [prevCity, setPrevCity] = useState(null);

  useEffect(() => {
    if (city?.city && city.city !== prevCity) {
      setPrevCity(city.city);
      setForecast10(null);
      setLoadingForecast(true);
      fetchForecast10(city.city).then(data => {
        setForecast10(data);
        setLoadingForecast(false);
      });
    }
  }, [city?.city]);
  
  // Mini tooltip inside panel
  const MiniTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-lg p-2 border border-blue-700/40 text-[10px]">
          <p className="text-cyan-300 font-semibold">{label}</p>
          {payload.map((p, i) => (
            <div key={i} className="text-gray-300">{p.name}: <strong className="text-white">{p.value} mm</strong></div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Generate Day Summary as editable .docx
  const handleGenerateSummary = async (e) => {
    e.stopPropagation();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.NONE, size: 0 },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
    };

    const thinBorder = {
      top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    };

    // Build forecast rows for table
    const forecastRows = (forecast10 || []).map(day => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${day.dateFormatted} (${day.dayName})`, size: 20 })] })], borders: thinBorder, width: { size: 2500, type: WidthType.DXA } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${day.expectedRainfall} mm`, size: 20 })] })], borders: thinBorder, width: { size: 2000, type: WidthType.DXA } }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: day.condition, size: 20 })] })], borders: thinBorder, width: { size: 3000, type: WidthType.DXA } }),
        ],
      })
    ));

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'REGIONAL METEOROLOGICAL CENTRE, NAGPUR', bold: true, size: 28, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'India Meteorological Department', size: 22, font: 'Times New Roman' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: `Day Weather Summary — ${today}`, bold: true, size: 24, font: 'Times New Roman', color: '003366' })],
          }),
          new Paragraph({ spacing: { after: 100 }, children: [] }),
          
          // City info
          new Paragraph({ children: [
            new TextRun({ text: 'Station: ', bold: true, size: 22, font: 'Times New Roman' }),
            new TextRun({ text: `${city.city} (${city.region})`, size: 22, font: 'Times New Roman' }),
          ]}),
          new Paragraph({ spacing: { after: 100 }, children: [
            new TextRun({ text: 'Date: ', bold: true, size: 22, font: 'Times New Roman' }),
            new TextRun({ text: today, size: 22, font: 'Times New Roman' }),
          ]}),
          
          // Temperature
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [
            new TextRun({ text: 'Temperature Observations:', bold: true, size: 24, font: 'Times New Roman', underline: {} }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: `Maximum Temperature: ${city.maxTemp ?? '--'}°C`, size: 22, font: 'Times New Roman' }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: `Minimum Temperature: ${city.minTemp ?? '--'}°C`, size: 22, font: 'Times New Roman' }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: `Max Departure from Normal: ${city.rawMaxDeparture ?? city.maxDeparture ?? '--'}°C`, size: 22, font: 'Times New Roman' }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: `24hr Max Change: ${city.maxChange ?? '--'}°C`, size: 22, font: 'Times New Roman' }),
          ]}),

          // Rainfall
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [
            new TextRun({ text: 'Rainfall:', bold: true, size: 24, font: 'Times New Roman', underline: {} }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: `Last 24 hours: ${city.rainfall24hr ?? city.rf24 ?? '0.0'} mm`, size: 22, font: 'Times New Roman' }),
          ]}),

          // Region overview
          ...(regionStats ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [
              new TextRun({ text: 'Region Overview:', bold: true, size: 24, font: 'Times New Roman', underline: {} }),
            ]}),
            new Paragraph({ children: [
              new TextRun({ text: `Highest Max Temp in Region: ${regionStats.highestMax}°C`, size: 22, font: 'Times New Roman' }),
            ]}),
            new Paragraph({ children: [
              new TextRun({ text: `Lowest Min Temp in Region: ${regionStats.lowestMin}°C`, size: 22, font: 'Times New Roman' }),
            ]}),
          ] : []),

          // Alert
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [
            new TextRun({ text: 'Alert Status:', bold: true, size: 24, font: 'Times New Roman', underline: {} }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: city.alert || 'Normal — No active alerts', size: 22, font: 'Times New Roman' }),
          ]}),

          // Previous 10-day rainfall report
          ...(forecast10 && forecast10.length > 0 ? [
            new Paragraph({ spacing: { before: 300, after: 100 }, children: [
              new TextRun({ text: 'Previous 10-Day Rainfall Report (IMD Readings):', bold: true, size: 24, font: 'Times New Roman', underline: {} }),
            ]}),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true, size: 20 })] })], borders: thinBorder, shading: { fill: 'E8E8E8' }, width: { size: 2500, type: WidthType.DXA } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Actual Rainfall (mm)', bold: true, size: 20 })] })], borders: thinBorder, shading: { fill: 'E8E8E8' }, width: { size: 2000, type: WidthType.DXA } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Condition', bold: true, size: 20 })] })], borders: thinBorder, shading: { fill: 'E8E8E8' }, width: { size: 3000, type: WidthType.DXA } }),
                  ],
                }),
                ...forecastRows,
              ],
            }),
          ] : []),

          // Footer
          new Paragraph({ spacing: { before: 300 }, children: [
            new TextRun({ text: '*** This is an auto-generated summary. Please verify and edit as needed. ***', italics: true, size: 18, font: 'Times New Roman', color: '888888' }),
          ]}),
          new Paragraph({ children: [
            new TextRun({ text: 'Source: Regional Meteorological Centre, Nagpur — India Meteorological Department', size: 18, font: 'Times New Roman', color: '888888' }),
          ]}),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `DaySummary_${city.city}_${new Date().toISOString().split('T')[0]}.docx`);
  };

  // (MiniTooltip is now defined above)

  return (
    <motion.div
      key="city-side-panel"
      initial={{ x: 440, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 440, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed z-[9999] right-0 top-0 h-screen flex flex-col shadow-2xl city-side-panel"
      style={{
        width: 420,
        background: isDarkMode
          ? 'linear-gradient(180deg, rgba(10,22,42,0.99) 0%, rgba(5,13,26,0.99) 100%)'
          : '#ffffff',
        borderLeft: isDarkMode ? '1px solid rgba(59,130,196,0.35)' : '1px solid rgba(0,0,0,0.1)',
        backdropFilter: 'blur(28px)',
      }}
    >
      {/* ── Sticky header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-blue-900/40 city-panel-header"
        style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(37,99,168,0.25) 0%, rgba(6,182,212,0.12) 100%)' : 'linear-gradient(135deg, #f0f4ff 0%, #e8edf5 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: getTempColor(city.maxTemp || 30), boxShadow: `0 0 8px ${getTempColor(city.maxTemp || 30)}` }}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-cyan-400" />
              <h3 className="text-white font-bold text-base leading-tight">{city.city}</h3>
            </div>
            <p className="text-blue-400 text-[10px]">{city.region}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-black leading-none" style={{ color: getTempColor(city.maxTemp || 30) }}>
              {city.maxTemp ?? '--'}°C
            </div>
            <div className="text-[9px] text-blue-400 text-right">Max Temp</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-blue-900/50 text-blue-500 hover:text-white transition-all cursor-pointer flex-shrink-0"
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-4 border-b border-blue-900/40 city-panel-header-sub"
        style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(37,99,168,0.3) 0%, rgba(6,182,212,0.15) 100%)' : 'linear-gradient(135deg, #f0f4ff 0%, #e8edf5 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-cyan-400" />
              <h3 className="text-white font-bold text-base">{city.city}</h3>
            </div>
            <p className="text-blue-400 text-xs mt-0.5">{city.region}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black" style={{ color: getTempColor(city.maxTemp || 30) }}>
              {city.maxTemp ?? '--'}°C
            </div>
            <div className="text-[10px] text-blue-400">Max Temp</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-2">
        {[
          { label: 'Min Temp (City)', value: `${city.minTemp ?? '--'}°C`, icon: Thermometer, color: '#60a5e0' },
          { label: 'Max Departure', value: `${city.rawMaxDeparture ?? city.maxDeparture ?? '--'}°C`, icon: TrendingUp, color: '#f97316' },
          { label: 'Min Departure', value: `${city.rawMinDeparture ?? city.minDeparture ?? '--'}°C`, icon: TrendingDown, color: '#818cf8' },
          { label: 'Rainfall 24h', value: `${city.rainfall24hr ?? city.rf24 ?? '0.0'} mm`, icon: CloudRain, color: '#38bdf8' },
          { label: 'Region Max', value: regionStats ? `${regionStats.highestMax}°C` : '--', icon: TrendingUp, color: '#ef4444' },
          { label: 'Region Min', value: regionStats ? `${regionStats.lowestMin}°C` : '--', icon: TrendingDown, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-2 bg-blue-900/20 rounded-lg p-2">
            <stat.icon size={13} style={{ color: stat.color }} />
            <div>
              <div className="text-white text-xs font-semibold">{stat.value}</div>
              <div className="text-[9px] text-blue-400">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Temperature chart */}
      <div className="px-4 pb-2">
        <p className="text-[10px] text-blue-400 mb-1.5 font-semibold uppercase tracking-wide">24-Hour Temperature Trend</p>
        <ResponsiveContainer width="100%" height={75}>
          <AreaChart data={timeData} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`tempGrad-${city.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#4e7a9e' }} />
            <YAxis tick={{ fontSize: 8, fill: '#4e7a9e' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2}
              fill={`url(#tempGrad-${city.id})`} name="Temp (°C)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-blue-900/30 mb-3" />

      {/* Previous 10-Day Rainfall Report (Real IMD Data) */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-cyan-400 mb-2 font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <CloudRain size={11} />
          Previous 10-Day Rainfall Report
        </p>
        {loadingForecast ? (
          <div className="h-16 flex items-center justify-center gap-2 text-[10px] text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading forecast...
          </div>
        ) : forecast10 && forecast10.length > 0 ? (
          <>
            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={forecast10} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.08)" />
                <XAxis dataKey="dateFormatted" tick={{ fontSize: 7, fill: '#4e7a9e' }} interval={1} angle={-25} textAnchor="end" height={28} />
                <YAxis tick={{ fontSize: 7, fill: '#4e7a9e' }} />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="expectedRainfall" fill="#38bdf8" radius={[3, 3, 0, 0]} name="Actual Rainfall" />
              </BarChart>
            </ResponsiveContainer>

            {/* Full scrollable table — actual rainfall data */}
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center gap-2 text-[8px] text-blue-600 uppercase tracking-wide px-1.5 pb-1 border-b border-blue-900/30">
                <span className="w-12">Date</span>
                <span className="w-5"></span>
                <span className="flex-1">Condition</span>
                <span className="w-14 text-right">Rainfall</span>
              </div>
              {forecast10.map((day, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-[9px] py-1 px-1.5 rounded-md transition-colors ${day.expectedRainfall > 20 ? 'bg-sky-400/10 border-l-2 border-sky-400/50' : day.expectedRainfall > 5 ? 'bg-sky-400/5 border-l-2 border-transparent' : 'bg-transparent border-l-2 border-transparent'}`}
                >
                  <span className="w-12 text-blue-300 font-semibold shrink-0">{day.dateFormatted}</span>
                  <span className="w-5 shrink-0">{day.icon}</span>
                  <span className="flex-1 text-gray-300 truncate">{day.condition}</span>
                  <span className="text-cyan-300 font-bold w-14 text-right shrink-0">{day.expectedRainfall} mm</span>
                </div>
              ))}
              {forecast10.length > 0 && forecast10[0].isActualData && (
                <div className="mt-1.5 px-1.5 py-1 rounded-md bg-green-900/20 border border-green-800/30">
                  <span className="text-[8px] text-green-400 font-semibold">✓ Real IMD readings from Excel data</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-14 flex items-center justify-center text-[10px] text-gray-500">No forecast data available</div>
        )}
      </div>

      {/* 5-day outlook */}
      {city.forecastDays && city.forecastDays.length > 0 && (
        <div className="px-4 pb-3">
          <div className="mx-0 border-t border-blue-900/30 mb-3" />
          <p className="text-[10px] text-blue-400 mb-2 font-semibold uppercase tracking-wide">5-Day Outlook</p>
          <div className="flex gap-2">
            {city.forecastDays.slice(0, 5).map((day, i) => {
              // Compute departure from normal (reference: city's current maxDeparture extrapolated)
              const normalMax = (city.maxTemp ?? 35) - (city.maxDeparture ?? 0);
              const normalMin = (city.minTemp ?? 22) - (city.minDeparture ?? 0);
              const maxDep = (day.maxTemp - normalMax).toFixed(1);
              const minDep = (day.minTemp - normalMin).toFixed(1);
              return (
                <div key={i} className="flex-1 text-center rounded-xl py-2 px-1 transition-all bg-blue-900/20 border border-blue-900/30">
                  <div className="text-[9px] text-cyan-400 font-bold">{day.day}</div>
                  <div className="text-base my-1">{day.icon}</div>
                  <div className="text-[10px] text-white font-black">{day.maxTemp}°</div>
                  <div className="text-[8px] text-blue-500 font-medium">{day.minTemp}°</div>
                  {day.rainfall > 0 && <div className="text-[8px] text-cyan-400 mt-0.5">{day.rainfall}mm</div>}
                  <div className="mt-1 border-t border-blue-900/30 pt-1">
                    <div className={`text-[7px] font-bold ${parseFloat(maxDep) > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                      Max: {parseFloat(maxDep) > 0 ? '+' : ''}{maxDep}°
                    </div>
                    <div className={`text-[7px] font-bold ${parseFloat(minDep) > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                      Min: {parseFloat(minDep) > 0 ? '+' : ''}{minDep}°
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alert badge */}
      {city.alertLevel && city.alertLevel !== 'normal' && (
        <div className={`mx-4 mb-3 px-3 py-2 rounded-xl border text-[10px] font-semibold flex items-center gap-2 ${alertColors[city.alertLevel]}`}>
          <AlertTriangle size={11} />
          <span>{city.alert}</span>
          <span className="ml-auto">{alertIcons[city.alert]}</span>
        </div>
      )}

      {/* Spacer bottom */}
      <div className="h-4" />
      </div>

      {/* ── Sticky action bar ── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-blue-900/40 flex gap-2 city-panel-action-bar"
        style={{ background: isDarkMode ? 'rgba(10,22,42,0.98)' : '#ffffff' }}>
        <button
          onClick={handleGenerateSummary}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:scale-95 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition-all duration-150 shadow-lg shadow-blue-900/50 cursor-pointer"
        >
          <FileText size={12} />
          Generate Day Summary
        </button>
        <button
          onClick={() => { onOpenRainfallModal && onOpenRainfallModal(); }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 active:scale-95 text-white text-[10px] font-bold py-2.5 px-3 rounded-xl transition-all duration-150 shadow-lg shadow-teal-900/50 cursor-pointer"
        >
          <BarChart3 size={12} />
          Rainfall Tendency
        </button>
      </div>
    </motion.div>
  );
}


function CityCard({ city, onSelect, isSelected }) {
  const maxTempColor = getTempColor(city.maxTemp || 30);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 cursor-pointer group relative overflow-hidden transition-all"
      onClick={() => onSelect(city)}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      style={isSelected ? {
        borderColor: `${maxTempColor}80`,
        boxShadow: `0 0 0 1.5px ${maxTempColor}40, 0 8px 32px ${maxTempColor}20`
      } : {}}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 transition-opacity duration-500 rounded-2xl"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${maxTempColor}15 0%, transparent 70%)`,
          opacity: isSelected ? 1 : 0,
        }}
      />
      {isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
          style={{ background: maxTempColor, boxShadow: `0 0 6px ${maxTempColor}` }} />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-cyan-400" />
              <h3 className="text-white font-bold text-sm">{city.city}</h3>
            </div>
            <p className="text-blue-400 text-[10px] mt-0.5">{city.region}</p>
          </div>
          <div className={`status-badge border ${alertColors[city.alertLevel]}`}>
            {city.alertLevel === 'normal' ? '✓ Normal' : city.alert}
          </div>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black" style={{ color: maxTempColor }}>
                {city.maxTemp ?? '--'}
              </span>
              <span className="text-sm text-gray-400">°C</span>
            </div>
            <p className="text-[10px] text-blue-400">Max</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-300">{city.minTemp ?? '--'}°C</div>
            <p className="text-[10px] text-blue-400">Min</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-blue-900/20 rounded-lg p-1.5">
            <Droplets size={10} className="text-cyan-400 mx-auto mb-0.5" />
            <div className="text-xs font-bold text-white">{city.humidityMorning ?? '--'}%</div>
            <div className="text-[9px] text-blue-500">RH AM</div>
          </div>
          <div className="text-center bg-blue-900/20 rounded-lg p-1.5">
            <CloudRain size={10} className="text-blue-400 mx-auto mb-0.5" />
            <div className="text-xs font-bold text-white">{city.rainfall24hr ?? city.rf24 ?? '0.0'} mm</div>
            <div className="text-[9px] text-blue-500">Rain 24h</div>
          </div>
          <div className="text-center bg-blue-900/20 rounded-lg p-1.5">
            <Droplets size={10} className="text-blue-400 mx-auto mb-0.5" />
            <div className="text-xs font-bold text-white">{city.humidityEvening ?? '--'}%</div>
            <div className="text-[9px] text-blue-500">RH PM</div>
          </div>
        </div>

        {/* Departure boxes — styled same as parameter boxes above */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="text-center rounded-lg p-2" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
            <TrendingUp size={12} className="text-orange-400 mx-auto mb-0.5" />
            <div className={`text-sm font-black ${
              city.maxDeparture > 0 ? 'text-orange-400' : city.maxDeparture < 0 ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {city.maxDeparture != null ? `${city.maxDeparture > 0 ? '+' : ''}${city.maxDeparture}°C` : '—'}
            </div>
            <div className="text-[9px] text-orange-300/70 font-semibold">Max Departure</div>
          </div>
          <div className="text-center rounded-lg p-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <TrendingDown size={12} className="text-indigo-400 mx-auto mb-0.5" />
            <div className={`text-sm font-black ${
              city.minDeparture > 0 ? 'text-orange-400' : city.minDeparture < 0 ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {city.minDeparture != null ? `${city.minDeparture > 0 ? '+' : ''}${city.minDeparture}°C` : '—'}
            </div>
            <div className="text-[9px] text-indigo-300/70 font-semibold">Min Departure</div>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-cyan-500 flex items-center gap-1">
          <Eye size={9} />
          <span>{isSelected ? 'Showing details' : 'Click to view'}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Observations({
  realTimeData = [],
  observedDates = { maxDate: '', minDate: '' },
  regionTitle = 'Vidarbha Region (Maharashtra)',
  loading = true,
  onRefresh
}) {
  const [selectedCity, setSelectedCity] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [rainfallModalOpen, setRainfallModalOpen] = useState(false);
  const { isDarkMode } = useTheme();

  const handleSelectCity = useCallback((city) => {
    setSelectedCity(city);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCity(null);
  }, []);

  // Compute region-level stats from live data
  const regionStats = (() => {
    if (!realTimeData || realTimeData.length === 0) return null;
    const validMax = realTimeData.filter(c => c.maxTemp != null && !isNaN(parseFloat(c.maxTemp)));
    const validMin = realTimeData.filter(c => c.minTemp != null && !isNaN(parseFloat(c.minTemp)));
    if (validMax.length === 0 && validMin.length === 0) return null;
    return {
      highestMax: validMax.length > 0 ? Math.max(...validMax.map(c => parseFloat(c.maxTemp))).toFixed(1) : '--',
      lowestMin: validMin.length > 0 ? Math.min(...validMin.map(c => parseFloat(c.minTemp))).toFixed(1) : '--',
      highestMaxCity: validMax.length > 0 ? validMax.reduce((a, b) => parseFloat(a.maxTemp) > parseFloat(b.maxTemp) ? a : b).city : '--',
      lowestMinCity: validMin.length > 0 ? validMin.reduce((a, b) => parseFloat(a.minTemp) < parseFloat(b.minTemp) ? a : b).city : '--',
    };
  })();

  // Rainfall data for the tendency modal
  const rainfallChartData = realTimeData.map(c => ({
    city: c.city,
    rainfall24h: parseFloat(c.rainfall24hr ?? c.rf24 ?? 0) || 0,
    rainfall9h: parseFloat(c.rf9 ?? 0) || 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
    >
      {/* Main content area — shrinks when panel is open */}
      <div
        className="flex-1 p-4 md:p-6 pb-32 transition-all duration-300 relative z-10 observations-main"
        style={{ marginRight: selectedCity ? 420 : 0, background: isDarkMode ? '#050d1a' : '#f4f7fc' }}
      >
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold gradient-text mb-1">Today's Observations</h2>
              <p className="text-blue-400 text-sm">
                Real-time live data from RMC Nagpur •{' '}
                <span className="text-cyan-400">Observed on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'glass-light text-blue-400'}`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'glass-light text-blue-400'}`}
              >
                Table
              </button>
              <button
                onClick={() => setRainfallModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600 to-teal-700 text-white flex items-center gap-1.5 hover:from-cyan-500 hover:to-teal-600 transition-all shadow-lg shadow-teal-900/40"
              >
                <BarChart3 size={12} />
                Rainfall Tendency
              </button>
              {selectedCity && (
                <button
                  onClick={handleClosePanel}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium glass-light text-blue-400 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  <X size={12} />
                  Close Panel
                </button>
              )}
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 border border-blue-400 shadow-lg shadow-blue-900/50 transition-all cursor-pointer"
                title="Click to refresh data from server"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
                Refresh Live
              </button>
            </div>
          </div>
        </div>

        {/* Prompt when no city selected */}
        {!selectedCity && !loading && (
          <div className="mb-3 px-4 py-2.5 rounded-xl glass-light text-xs text-blue-400 flex items-center gap-2">
            <Eye size={13} className="text-cyan-400 shrink-0" />
            <span>Click any city row or card to open the interactive detail panel</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-20 glass-card rounded-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-blue-300 font-semibold animate-pulse">Fetching real-time data from official server...</p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <ObservationTable
            cities={realTimeData}
            onSelectCity={handleSelectCity}
            selectedCity={selectedCity}
            observedDates={observedDates}
            regionTitle={regionTitle}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-24">
            {realTimeData.map((city, i) => (
              <motion.div
                key={city.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <CityCard
                  city={city}
                  onSelect={handleSelectCity}
                  isSelected={selectedCity?.city === city.city}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Info note */}
        <p className="text-[10px] text-blue-600 mt-6 text-center">
          *** Departures are based on Pentad Normals 1991-2020 *** | Data strictly synced from Regional Meteorological Centre, Nagpur
        </p>
      </div>

      {/* Fixed right-side interactive panel */}
      <AnimatePresence>
        {selectedCity && (
          <CitySidePanel
            city={selectedCity}
            regionStats={regionStats}
            onOpenRainfallModal={() => setRainfallModalOpen(true)}
            onClose={handleClosePanel}
          />
        )}
      </AnimatePresence>

      {/* Rainfall Tendency Modal */}
      <AnimatePresence>
        {rainfallModalOpen && (
          <RainfallTendencyModal
            data={rainfallChartData}
            regionTitle={regionTitle}
            onClose={() => setRainfallModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}


function ObservationTable({ cities, onSelectCity, selectedCity, observedDates, regionTitle }) {
  if (!cities || cities.length === 0) {
    return <div className="p-8 text-center text-blue-400 glass-card rounded-2xl">No observation data available at the moment.</div>;
  }

  return (
    <div className="glass-card overflow-x-auto rounded-2xl">
      {/* Region Title - same as official site */}
      <div className="px-4 py-3 border-b border-blue-900/40">
        <span className="text-red-400 font-bold text-sm">{regionTitle} :</span>
      </div>
      
      <table className="w-full text-xs">
        <thead>
          {/* Row 1: Main group headers */}
          <tr className="border-b border-blue-900/40 bg-blue-900/20">
            <th className="text-left px-4 py-3 text-blue-300 font-semibold border-r border-blue-900/40" rowSpan="3">City</th>
            <th className="text-center px-2 py-2 text-blue-300 font-semibold border-r border-blue-900/40" colSpan="6">Temperature (°C)</th>
            <th className="text-center px-2 py-2 text-blue-300 font-semibold border-r border-blue-900/40" colSpan="2">Relative Humidity (%)</th>
            <th className="text-center px-2 py-2 text-blue-300 font-semibold" colSpan="2">Rainfall (mm)</th>
          </tr>
          {/* Row 2: Sub-parameter headers */}
          <tr className="border-b border-blue-900/40 bg-blue-900/20 text-[10px]">
            <th className="text-center px-2 py-1 text-cyan-300 border-r border-blue-900/40">Maximum</th>
            <th className="text-center px-2 py-1 text-cyan-300 border-r border-blue-900/40">24 Hrs Change</th>
            <th className="text-center px-2 py-1 text-cyan-300 border-r border-blue-900/40">Departure</th>
            <th className="text-center px-2 py-1 text-blue-300 border-r border-blue-900/40">Minimum</th>
            <th className="text-center px-2 py-1 text-blue-300 border-r border-blue-900/40">24 Hrs Change</th>
            <th className="text-center px-2 py-1 text-blue-300 border-r border-blue-900/40">Departure</th>
            <th className="text-center px-2 py-1 text-amber-300 border-r border-blue-900/40">at 0830 hrs IST</th>
            <th className="text-center px-2 py-1 text-amber-300 border-r border-blue-900/40">at 1730 hrs IST</th>
            <th className="text-center px-2 py-1 text-emerald-300 border-r border-blue-900/40">last 24 hrs upto 0830 hrs IST</th>
            <th className="text-center px-2 py-1 text-emerald-300">last 9 hrs upto 1730 hrs IST</th>
          </tr>
          {/* Row 3: Observed On dates - exactly like official site */}
          <tr className="border-b border-blue-900/40 bg-blue-900/20 text-[9px]">
            <td className="text-center px-2 py-1 text-red-400 border-r border-blue-900/40" colSpan="3">
              {observedDates?.maxDate || ''}
            </td>
            <td className="text-center px-2 py-1 text-red-400" colSpan="8">
              {observedDates?.minDate || ''}
            </td>
          </tr>
        </thead>
        <tbody>
          {cities.map((city, i) => {
            const isSelected = selectedCity?.city === city.city;
            return (
              <tr
                key={city.id + i}
                className="border-b border-blue-900/20 transition-all cursor-pointer"
                style={{
                  background: isSelected ? 'rgba(56,130,246,0.12)' : undefined,
                  borderLeft: isSelected ? '3px solid rgba(56,189,248,0.8)' : '3px solid transparent',
                }}
                onClick={() => onSelectCity && onSelectCity(city)}
              >
                <td className={`px-4 py-2 font-semibold border-r border-blue-900/20 ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                  {city.city}
                  {isSelected && <span className="ml-2 text-[8px] text-cyan-400 font-normal">● selected</span>}
                </td>
                <td className="px-2 py-2 text-center font-bold text-orange-400 border-r border-blue-900/20 bg-orange-500/5">{city.rawMaxTemp}</td>
                <td className="px-2 py-2 text-center text-cyan-200 border-r border-blue-900/20 bg-orange-500/5">{city.maxChange}</td>
                <td className="px-2 py-2 text-center text-cyan-200 border-r border-blue-900/20 bg-orange-500/5">{city.rawMaxDeparture}</td>
                <td className="px-2 py-2 text-center font-bold text-blue-300 border-r border-blue-900/20 bg-blue-500/5">{city.rawMinTemp}</td>
                <td className="px-2 py-2 text-center text-blue-200 border-r border-blue-900/20 bg-blue-500/5">{city.minChange}</td>
                <td className="px-2 py-2 text-center text-blue-200 border-r border-blue-900/20 bg-blue-500/5">{city.rawMinDeparture}</td>
                <td className="px-2 py-2 text-center text-amber-200 border-r border-blue-900/20 bg-amber-500/5">{city.rh830}</td>
                <td className="px-2 py-2 text-center text-amber-200 border-r border-blue-900/20 bg-amber-500/5">{city.rh1730}</td>
                <td className="px-2 py-2 text-center text-emerald-200 border-r border-blue-900/20 bg-emerald-500/5">{city.rf24}</td>
                <td className="px-2 py-2 text-center text-emerald-200 bg-emerald-500/5">{city.rf9}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RainfallTendencyModal({ data, regionTitle, onClose }) {
  const { isDarkMode } = useTheme();
  const RainfallTooltip = ({ active, payload, label }) => {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: isDarkMode
            ? 'linear-gradient(135deg, rgba(12,27,51,0.99) 0%, rgba(5,13,26,0.99) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.99) 100%)',
          border: isDarkMode ? '1px solid rgba(59,130,196,0.4)' : '1px solid rgba(0,0,0,0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-blue-900/40"
          style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(37,99,168,0.2) 0%, rgba(6,182,212,0.1) 100%)' : 'linear-gradient(135deg, rgba(59,130,196,0.06) 0%, rgba(6,182,212,0.03) 100%)' }}
        >
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <BarChart3 size={20} className="text-cyan-400" />
              Rainfall Tendency Graph
            </h3>
            <p className="text-blue-400 text-sm mt-0.5">
              {regionTitle} • Max & Min Rainfall (24h & 9h) • {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-blue-900/40 text-blue-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chart */}
        <div className="p-6">
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.15)" />
              <XAxis
                dataKey="city"
                tick={{ fontSize: 11, fill: '#60a5e0', fontWeight: 600 }}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#4e7a9e' }}
                label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', style: { fill: '#4e7a9e', fontSize: 12 } }}
              />
              <Tooltip content={<RainfallTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#60a5e0', paddingTop: '10px' }}
              />
              <Bar
                dataKey="rainfall24h"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                name="Rainfall (Last 24h)"
                barSize={30}
              />
              <Bar
                dataKey="rainfall9h"
                fill="#818cf8"
                radius={[4, 4, 0, 0]}
                name="Rainfall (Last 9h)"
                barSize={30}
              />
              <Line
                type="monotone"
                dataKey="rainfall24h"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 4, fill: '#f97316' }}
                name="24h Trend"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Summary strip */}
          <div className="flex gap-4 mt-4 justify-center">
            {(() => {
              const max24 = data.length > 0 ? Math.max(...data.map(d => d.rainfall24h)) : 0;
              const maxCity = data.find(d => d.rainfall24h === max24)?.city || '--';
              const total24 = data.reduce((s, d) => s + d.rainfall24h, 0).toFixed(1);
              return (
                <>
                  <div className="glass-light rounded-lg px-4 py-2 text-center">
                    <div className="text-[10px] text-blue-400">Highest 24h Rainfall</div>
                    <div className="text-white font-bold text-sm">{max24} mm</div>
                    <div className="text-cyan-400 text-[10px]">{maxCity}</div>
                  </div>
                  <div className="glass-light rounded-lg px-4 py-2 text-center">
                    <div className="text-[10px] text-blue-400">Total Regional 24h</div>
                    <div className="text-white font-bold text-sm">{total24} mm</div>
                    <div className="text-cyan-400 text-[10px]">All stations combined</div>
                  </div>
                  <div className="glass-light rounded-lg px-4 py-2 text-center">
                    <div className="text-[10px] text-blue-400">Stations Reporting Rain</div>
                    <div className="text-white font-bold text-sm">{data.filter(d => d.rainfall24h > 0).length} / {data.length}</div>
                    <div className="text-cyan-400 text-[10px]">Active rainfall</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 text-center">
          <p className="text-[10px] text-blue-600">
            Source: Regional Meteorological Centre, Nagpur — India Meteorological Department | Data as of {new Date().toLocaleString('en-IN')} IST
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
