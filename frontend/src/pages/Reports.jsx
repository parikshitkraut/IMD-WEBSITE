import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Printer, CheckCircle, Loader2, Share2, Hash, Users, MessageCircle, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { fetchLiveWeather } from '../services/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const reportTypes = [
  {
    id: 'daily',
    title: 'Daily Weather Bulletin',
    desc: 'Comprehensive daily report with all observations, forecasts, and alerts',
    icon: '📋',
  },
  {
    id: 'weekly',
    title: 'Weekly Forecast Report',
    desc: '7-day extended range forecast with confidence analysis',
    icon: '📅',
  },
  {
    id: 'rainfall',
    title: 'Rainfall Summary',
    desc: 'Cumulative rainfall data and anomaly analysis',
    icon: '🌧️',
  },
  {
    id: 'summary',
    title: 'Regional Summary Report',
    desc: 'Quick, one-liner summaries of regional weather conditions',
    icon: '📝',
  },
];

function generateReportText(type, liveData) {
  if (!liveData || liveData.length === 0) return 'Fetching data...';
  
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (type === 'daily') {
    return `REGIONAL METEOROLOGICAL CENTRE, NAGPUR
INDIA METEOROLOGICAL DEPARTMENT
Ministry of Earth Sciences, Government of India

════════════════════════════════════════════════════════
        DAILY WEATHER BULLETIN
        Issued: ${date} at ${time} IST
════════════════════════════════════════════════════════

WEATHER OBSERVATION SUMMARY — VIDARBHA REGION

Observation Date: ${date} | Time: 0830 & 1730 IST

Station-wise Temperature & Humidity Data:
─────────────────────────────────────────────────────────────────────
City         | Max (°C) | Min (°C) | Dep  | RH AM% | RH PM% | RF(mm)
─────────────────────────────────────────────────────────────────────
${liveData.map(c =>
  `${c.city.padEnd(12)} | ${(c.temperature.max ?? '---').toString().padEnd(8)} | ${(c.temperature.min ?? '---').toString().padEnd(8)} | ${((c.temperature.maxDeparture != null ? (c.temperature.maxDeparture > 0 ? '+' : '') + c.temperature.maxDeparture : '---')).toString().padEnd(4)} | ${(c.humidity.morning ?? '---').toString().padEnd(6)} | ${(c.humidity.evening ?? '---').toString().padEnd(6)} | ${c.rainfall.last24h}`
).join('\n')}
─────────────────────────────────────────────────────────────────────

WEATHER ALERTS (ACTIVE):
${liveData.filter(c => c.analysis.alertLevel !== 'GREEN').map(c => 
  `• ${c.analysis.heatwave ? 'HEATWAVE WARNING' : 'HIGH TEMP ALERT'}: ${c.city} — Max temp ${c.temperature.max}°C`
).join('\n') || '• No active alerts.'}

─────────────────────────────────────────────────────────────────────
Issued by: Forecasting Officer, RMC Nagpur
Website: www.imdnagpur.gov.in | Tel: 0712-2538333
─────────────────────────────────────────────────────────────────────
`;
  }

  if (type === 'rainfall') {
    return `REGIONAL METEOROLOGICAL CENTRE, NAGPUR
INDIA METEOROLOGICAL DEPARTMENT

════════════════════════════════════════════════════════
        RAINFALL SUMMARY REPORT
        Period: 29 June – ${date}
════════════════════════════════════════════════════════

RAINFALL OBSERVATION DATA:

Station-wise Rainfall:
─────────────────────────────────────────────
City         | Actual (mm) 
─────────────────────────────────────────────
${liveData.map(c =>
  `${c.city.padEnd(12)} | ${c.rainfall.last24h.toString().padEnd(11)}`
).join('\n')}
─────────────────────────────────────────────

STATUS: Active Monsoon season.
Monsoon has set in across the Vidarbha region. Regular daily rainfall observations are being monitored and logged.

─────────────────────────────────────────────
Source: RMC Nagpur | www.imdnagpur.gov.in
─────────────────────────────────────────────
`;
  }

  if (type === 'summary') {
    // Safely get extremes
    let maxTempCity = liveData[0];
    let minTempCity = liveData[0];
    let maxRainCity = liveData[0];

    liveData.forEach(c => {
      if (c.temperature && c.temperature.max > (maxTempCity?.temperature?.max ?? -99)) maxTempCity = c;
      if (c.temperature && c.temperature.min < (minTempCity?.temperature?.min ?? 99)) minTempCity = c;
      if (c.rainfall && c.rainfall.last24h > (maxRainCity?.rainfall?.last24h ?? -1)) maxRainCity = c;
    });

    const alerts = liveData.filter(c => c.analysis && c.analysis.alertLevel !== 'GREEN' && c.analysis.alertLevel !== 'normal');

    return `REGIONAL METEOROLOGICAL CENTRE, NAGPUR
INDIA METEOROLOGICAL DEPARTMENT

════════════════════════════════════════════════════════
        REGIONAL WEATHER SUMMARY (ONE-LINERS)
        Issued: ${date} at ${time} IST
════════════════════════════════════════════════════════

• OVERALL CONDITIONS: The region is experiencing mostly ${alerts.length > 0 ? 'severe' : 'normal'} weather conditions.
• HOTTEST CITY: ${maxTempCity ? maxTempCity.city : 'N/A'} recorded the highest maximum temperature at ${maxTempCity && maxTempCity.temperature ? maxTempCity.temperature.max : '--'}°C.
• COOLEST CITY: ${minTempCity ? minTempCity.city : 'N/A'} recorded the lowest minimum temperature at ${minTempCity && minTempCity.temperature ? minTempCity.temperature.min : '--'}°C.
• RAINFALL: ${maxRainCity && maxRainCity.rainfall && maxRainCity.rainfall.last24h > 0 ? `${maxRainCity.city} received the highest rainfall of ${maxRainCity.rainfall.last24h} mm in the last 24 hours.` : 'No significant rainfall recorded across the region in the last 24 hours.'}
• ALERTS: ${alerts.length > 0 ? `${alerts.length} stations have active warnings (e.g., ${alerts[0].city}).` : 'All stations are currently under normal conditions.'}

────────────────────────────────────────────────────────
Source: RMC Nagpur | www.imdnagpur.gov.in
────────────────────────────────────────────────────────
`;
  }

  return `REGIONAL METEOROLOGICAL CENTRE, NAGPUR\nForecast Report unavailable in simple text view.`;
}

export default function Reports() {
  const { isDarkMode } = useTheme();
  const [selectedType, setSelectedType] = useState('daily');
  const [liveData, setLiveData] = useState([]);
  const [reportContent, setReportContent] = useState('Loading data...');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  
  const reportRef = useRef(null);

  useEffect(() => {
    fetchLiveWeather().then(data => {
      setLiveData(data);
      setReportContent(generateReportText('daily', data));
    });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerated(false);
    await new Promise(r => setTimeout(r, 800));
    setReportContent(generateReportText(selectedType, liveData));
    setGenerating(false);
    setGenerated(true);
    toast.success('Report generated successfully!', {
      icon: '📋',
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #3b82c4' }
    });
  };

  const handleExport = async (format) => {
    const toastId = toast.loading(`Preparing ${format} export...`, {
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #3b82c4' }
    });

    try {
      if (format === 'CSV') {
        const csvData = liveData.map(c => ({
          City: c.city,
          MaxTemp: c.temperature.max,
          MinTemp: c.temperature.min,
          Departure: c.temperature.maxDeparture,
          HumidityAM: c.humidity.morning,
          HumidityPM: c.humidity.evening,
          Rainfall24h: c.rainfall.last24h,
          AlertLevel: c.analysis.alertLevel
        }));
        const headers = Object.keys(csvData[0]).join(',');
        const rows = csvData.map(row => Object.values(row).join(',')).join('\n');
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WeatherDesk_${selectedType}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'JSON') {
        const json = JSON.stringify(liveData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WeatherDesk_data_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'TXT') {
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WeatherDesk_report_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'PDF') {
        const doc = new jsPDF();
        doc.setFontSize(10);
        doc.setFont('courier');
        const splitText = doc.splitTextToSize(reportContent, 180);
        doc.text(splitText, 15, 15);
        doc.save(`WeatherDesk_report_${new Date().toISOString().slice(0, 10)}.pdf`);
      } else if (format === 'DOCX') {
        const paragraphs = reportContent.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun({ text: line, font: "Courier New", size: 20 })] // size 20 is 10pt
          })
        );
        const doc = new Document({
          sections: [{
            properties: {},
            children: paragraphs
          }]
        });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WeatherDesk_report_${new Date().toISOString().slice(0, 10)}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'PNG') {
        if (reportRef.current) {
          const canvas = await html2canvas(reportRef.current, { backgroundColor: '#0f172a' });
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url;
          a.download = `WeatherDesk_report_${new Date().toISOString().slice(0, 10)}.png`;
          a.click();
        }
      }
      toast.dismiss(toastId);
      toast.success(`${format} exported successfully!`, {
        icon: '✅',
        style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #22c55e' }
      });
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(`Failed to export ${format}`);
    }
  };

  const handleShare = (platform) => {
    const text = `Weather Update from RMC Nagpur: Check live dashboard for latest analytics! #IMDNagpur #WeatherDesk`;
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    };
    if (urls[platform]) window.open(urls[platform], '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6 pb-24"
    >
      <div>
        <h2 className="text-xl font-bold gradient-text mb-1">Report Automation System</h2>
        <p className="text-blue-400 text-sm">Auto-generate government-grade weather bulletins and export in PDF, DOCX, CSV, JSON, PNG</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel: Report selection */}
        <div className="space-y-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <FileText size={14} className="text-cyan-400" />
            Select Report Type
          </h3>
          {reportTypes.map(rt => (
            <motion.button
              key={rt.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedType(rt.id);
                setGenerated(false);
              }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                selectedType === rt.id
                  ? 'border-blue-500/60 bg-blue-500/15'
                  : 'glass-light border-blue-800/30 hover:border-blue-600/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{rt.icon}</span>
                <div>
                  <p className="text-white text-xs font-semibold">{rt.title}</p>
                  <p className="text-blue-400 text-[10px] mt-0.5">{rt.desc}</p>
                </div>
                {selectedType === rt.id && (
                  <CheckCircle size={14} className="text-blue-400 ml-auto flex-shrink-0" />
                )}
              </div>
            </motion.button>
          ))}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'linear-gradient(135deg, #2563a8 0%, #06b6d4 100%)',
              boxShadow: '0 8px 24px rgba(37,99,168,0.4)',
            }}
          >
            {generating ? (
              <><Loader2 size={16} className="animate-spin" /> Generating...</>
            ) : (
              <><FileText size={16} /> Generate Report</>
            )}
          </motion.button>

          <div className="glass-card p-3">
            <h4 className="text-white text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Download size={12} className="text-cyan-400" />
              Export Formats
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { format: 'PDF', icon: '📄', color: '#ef4444' },
                { format: 'CSV', icon: '📊', color: '#22c55e' },
                { format: 'JSON', icon: '{ }', color: '#f59e0b' },
                { format: 'TXT', icon: '📝', color: '#3b82f6' },
                { format: 'DOCX', icon: '📝', color: '#2563eb' },
                { format: 'PNG', icon: '🖼️', color: '#a855f7' },
              ].map(({ format, icon, color }) => (
                <motion.button
                  key={format}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleExport(format)}
                  className="flex items-center gap-1 p-2 rounded-lg glass-light border border-blue-800/30 hover:border-blue-600/40 transition-all text-xs"
                >
                  <span style={{ color }}>{icon}</span>
                  <span className="text-white font-medium">{format}</span>
                </motion.button>
              ))}
            </div>
            
            <h4 className="text-white text-xs font-semibold my-3 flex items-center gap-1.5">
              <Share2 size={12} className="text-cyan-400" />
              Share Report
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { platform: 'twitter', label: 'X / Twitter', bg: '#1DA1F2', icon: Hash },
                { platform: 'whatsapp', label: 'WhatsApp', bg: '#25D366', icon: MessageCircle },
                { platform: 'facebook', label: 'Facebook', bg: '#1877F2', icon: Users },
                { platform: 'telegram', label: 'Telegram', bg: '#0088cc', icon: Send },
              ].map(({ platform, label, bg, icon: Icon }) => (
                <motion.button
                  key={platform}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleShare(platform)}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-white transition-all"
                  style={{ 
                    background: isDarkMode ? `${bg}30` : bg, 
                    border: isDarkMode ? `1px solid ${bg}50` : 'none' 
                  }}
                >
                  <Icon size={14} />
                  <span className="text-[10px] font-semibold">{label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Report preview */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <FileText size={14} className="text-amber-400" />
              Report Preview
              {generated && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                  <CheckCircle size={10} />
                  Generated
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExport('PDF')}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-light rounded-lg text-xs text-red-300 hover:text-white transition-all border border-blue-800/30"
              >
                <Download size={12} />
                PDF
              </button>
              <button
                onClick={() => handleExport('DOCX')}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-light rounded-lg text-xs text-blue-300 hover:text-white transition-all border border-blue-800/30"
              >
                <Download size={12} />
                DOCX
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-light rounded-lg text-xs text-cyan-300 hover:text-white transition-all border border-blue-800/30"
              >
                <Printer size={12} />
                Print
              </button>
            </div>
          </div>

          <div ref={reportRef} className="glass-card rounded-2xl overflow-hidden" style={{ minHeight: '600px' }}>
            <div className="border-b border-blue-900/40 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-blue-400 text-[10px]">IMD Weather Report — Official Document</span>
            </div>
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-96"
                >
                  <Loader2 size={40} className="text-blue-400 animate-spin mb-4" />
                  <p className="text-blue-300 text-sm">Generating report from live data...</p>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4"
                >
                  <pre className="text-[11px] text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {reportContent}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
