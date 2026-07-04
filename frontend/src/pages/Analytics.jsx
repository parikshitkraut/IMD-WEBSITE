import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, ComposedChart, Area, AreaChart
} from 'recharts';
import { BarChart3, TrendingUp, Droplets, Thermometer, Map, Activity, Loader2 } from 'lucide-react';
import { fetchLiveWeather } from '../services/api';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a78bfa', '#f43f5e', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-blue-700/40 text-xs shadow-2xl">
      <p className="text-cyan-300 font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-gray-300">{p.name}: <strong className="text-white">{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [activeMetric, setActiveMetric] = useState('temperature');
  const [liveData, setLiveData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveWeather()
      .then(data => {
        setLiveData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching analytics weather data:', err);
        setLoading(false);
      });
  }, []);

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const tempData = useMemo(() => {
    return liveData.map(c => ({
      name: c.city,
      max: c.temperature.max,
      min: c.temperature.min,
      departure: c.temperature.maxDeparture,
    })).filter(c => c.max != null);
  }, [liveData]);

  const humidityData = useMemo(() => {
    return liveData.map(c => ({
      name: c.city,
      morning: c.humidity.morning,
      evening: c.humidity.evening,
    })).filter(c => c.morning != null);
  }, [liveData]);

  const rainfallData = useMemo(() => {
    return liveData.map(c => ({
      name: c.city,
      rf24: c.rainfall.last24h,
      rf9: c.rainfall.last9h,
    }));
  }, [liveData]);

  const heatmapData = useMemo(() => {
    return liveData.map(c => ({
      name: c.city,
      value: c.temperature.max || 28,
      humidity: c.humidity.morning || 40,
      alert: c.analysis.alertLevel,
    }));
  }, [liveData]);

  const departureData = useMemo(() => {
    return liveData
      .filter(c => c.temperature.maxDeparture != null)
      .map(c => ({
        name: c.city,
        departure: c.temperature.maxDeparture,
        fill: c.temperature.maxDeparture > 0 ? '#ef4444' : '#3b82f6',
      }));
  }, [liveData]);

  const scatterData = useMemo(() => {
    return liveData.map(c => ({
      x: c.humidity.morning || 40,
      y: c.temperature.max || 28,
      name: c.city,
    }));
  }, [liveData]);
  const stats = useMemo(() => {
    if (liveData.length === 0) return null;
    
    // Max Temps
    const maxTemps = liveData.map(c => c.temperature.max).filter(v => v != null);
    const highestMax = Math.max(...maxTemps);
    const highestMaxCity = liveData.find(c => c.temperature.max === highestMax)?.city || 'N/A';
    const lowestMax = Math.min(...maxTemps);
    const lowestMaxCity = liveData.find(c => c.temperature.max === lowestMax)?.city || 'N/A';
    const avgMax = maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length;
    
    const maxDeps = liveData.map(c => c.temperature.maxDeparture).filter(v => v != null);
    const avgMaxDep = maxDeps.length > 0 ? maxDeps.reduce((a, b) => a + b, 0) / maxDeps.length : 0;

    // Min Temps
    const minTemps = liveData.map(c => c.temperature.min).filter(v => v != null);
    const highestMin = Math.max(...minTemps);
    const highestMinCity = liveData.find(c => c.temperature.min === highestMin)?.city || 'N/A';
    const lowestMin = Math.min(...minTemps);
    const lowestMinCity = liveData.find(c => c.temperature.min === lowestMin)?.city || 'N/A';
    const avgMin = minTemps.reduce((a, b) => a + b, 0) / minTemps.length;
    
    const minDeps = liveData.map(c => c.temperature.minDeparture).filter(v => v != null);
    const avgMinDep = minDeps.length > 0 ? minDeps.reduce((a, b) => a + b, 0) / minDeps.length : 0;

    // Morning RH
    const rhMornings = liveData.map(c => c.humidity.morning).filter(v => v != null && !isNaN(parseInt(v)));
    const maxMornRh = rhMornings.length > 0 ? Math.max(...rhMornings) : 0;
    const maxMornRhCity = liveData.find(c => c.humidity.morning == maxMornRh)?.city || 'N/A';
    const minMornRh = rhMornings.length > 0 ? Math.min(...rhMornings) : 0;
    const minMornRhCity = liveData.find(c => c.humidity.morning == minMornRh)?.city || 'N/A';
    const avgMornRh = rhMornings.length > 0 ? rhMornings.reduce((a, b) => a + b, 0) / rhMornings.length : 0;

    // Evening RH
    const rhEvenings = liveData.map(c => c.humidity.evening).filter(v => v != null && !isNaN(parseInt(v)));
    const maxEvenRh = rhEvenings.length > 0 ? Math.max(...rhEvenings) : 0;
    const maxEvenRhCity = liveData.find(c => c.humidity.evening == maxEvenRh)?.city || 'N/A';
    const minEvenRh = rhEvenings.length > 0 ? Math.min(...rhEvenings) : 0;
    const minEvenRhCity = liveData.find(c => c.humidity.evening == minEvenRh)?.city || 'N/A';
    const avgEvenRh = rhEvenings.length > 0 ? rhEvenings.reduce((a, b) => a + b, 0) / rhEvenings.length : 0;

    // Rainfall
    const rainfalls = liveData.map(c => c.rainfall.last24h).filter(v => v != null);
    const maxRain = rainfalls.length > 0 ? Math.max(...rainfalls) : 0;
    const maxRainCity = liveData.find(c => c.rainfall.last24h == maxRain)?.city || 'N/A';
    const minRain = rainfalls.length > 0 ? Math.min(...rainfalls) : 0;
    const minRainCity = liveData.find(c => c.rainfall.last24h == minRain)?.city || 'N/A';
    const avgRain = rainfalls.length > 0 ? rainfalls.reduce((a, b) => a + b, 0) / rainfalls.length : 0;

    return {
      maxTemp: {
        max: `${highestMax.toFixed(1)} (${highestMaxCity})`,
        min: `${lowestMax.toFixed(1)} (${lowestMaxCity})`,
        avg: avgMax.toFixed(1),
        dep: (avgMaxDep > 0 ? '+' : '') + avgMaxDep.toFixed(1),
      },
      minTemp: {
        max: `${highestMin.toFixed(1)} (${highestMinCity})`,
        min: `${lowestMin.toFixed(1)} (${lowestMinCity})`,
        avg: avgMin.toFixed(1),
        dep: (avgMinDep > 0 ? '+' : '') + avgMinDep.toFixed(1),
      },
      morningRh: {
        max: `${maxMornRh} (${maxMornRhCity})`,
        min: `${minMornRh} (${minMornRhCity})`,
        avg: Math.round(avgMornRh),
        dep: '-3',
      },
      eveningRh: {
        max: `${maxEvenRh} (${maxEvenRhCity})`,
        min: `${minEvenRh} (${minEvenRhCity})`,
        avg: Math.round(avgEvenRh),
        dep: '-5',
      },
      rainfall: {
        max: `${maxRain.toFixed(1)} (${maxRainCity})`,
        min: `${minRain.toFixed(1)} (${minRainCity})`,
        avg: avgRain.toFixed(1),
        dep: '—',
      }
    };
  }, [liveData]);

  const tableRows = useMemo(() => {
    if (!stats) return [];
    return [
      {
        param: 'Maximum Temperature (°C)',
        max: stats.maxTemp.max,
        min: stats.maxTemp.min,
        avg: stats.maxTemp.avg,
        dep: stats.maxTemp.dep,
        depColor: parseFloat(stats.maxTemp.dep) >= 0 ? '#ef4444' : '#3b82f6',
      },
      {
        param: 'Minimum Temperature (°C)',
        max: stats.minTemp.max,
        min: stats.minTemp.min,
        avg: stats.minTemp.avg,
        dep: stats.minTemp.dep,
        depColor: parseFloat(stats.minTemp.dep) >= 0 ? '#ef4444' : '#3b82f6',
      },
      {
        param: 'Morning RH (%)',
        max: stats.morningRh.max,
        min: stats.morningRh.min,
        avg: stats.morningRh.avg,
        dep: stats.morningRh.dep,
        depColor: '#3b82f6',
      },
      {
        param: 'Evening RH (%)',
        max: stats.eveningRh.max,
        min: stats.eveningRh.min,
        avg: stats.eveningRh.avg,
        dep: stats.eveningRh.dep,
        depColor: '#3b82f6',
      },
      {
        param: 'Rainfall 24h (mm)',
        max: stats.rainfall.max,
        min: stats.rainfall.min,
        avg: stats.rainfall.avg,
        dep: stats.rainfall.dep,
        depColor: '#60a5e0',
      },
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold gradient-text mb-1">Weather Analytics & Visualization</h2>
        <p className="text-blue-400 text-sm">Deep-dive analysis across Central India districts</p>
      </div>

      {/* Metric tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'temperature', label: 'Temperature', icon: Thermometer },
          { id: 'humidity', label: 'Humidity', icon: Droplets },
          { id: 'rainfall', label: 'Rainfall', icon: Activity },
          { id: 'departure', label: 'Departure', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveMetric(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
              activeMetric === id
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'glass-light border-blue-800/40 text-blue-400 hover:text-white'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Temperature heatmap bars */}
        <motion.div
          key={`main-${activeMetric}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">
                {activeMetric === 'temperature' && 'District Temperature Comparison (Vidarbha)'}
                {activeMetric === 'humidity' && 'Relative Humidity — Morning vs Evening'}
                {activeMetric === 'rainfall' && 'Rainfall Distribution (24h & 9h)'}
                {activeMetric === 'departure' && 'Temperature Departure from Normal'}
              </h3>
              <p className="text-blue-400 text-xs">{currentDate} — Observed data</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            {activeMetric === 'temperature' ? (
              <ComposedChart data={tempData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} domain={[15, 50]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: '#60a5e0' }} />
                <Bar dataKey="max" name="Max Temp (°C)" radius={[4, 4, 0, 0]}>
                  {tempData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="min" name="Min Temp (°C)" stroke="#60a5e0" strokeWidth={2.5} dot={{ r: 4 }} />
              </ComposedChart>
            ) : activeMetric === 'humidity' ? (
              <BarChart data={humidityData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="morning" name="Morning RH (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="evening" name="Evening RH (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : activeMetric === 'rainfall' ? (
              <BarChart data={rainfallData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4e7a9e' }} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="rf24" name="Rainfall 24h (mm)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rf9" name="Rainfall 9h (mm)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={departureData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="departure" name="Departure (°C)" radius={[4, 4, 0, 0]}>
                  {departureData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </motion.div>

        {/* Scatter: Temp vs Humidity */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Temperature vs Humidity</h3>
              <p className="text-blue-400 text-xs">Correlation scatter across all districts</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
              <XAxis
                dataKey="x"
                name="Humidity"
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#4e7a9e' }}
                label={{ value: 'Humidity (%)', position: 'insideBottom', offset: -3, fill: '#4e7a9e', fontSize: 10 }}
              />
              <YAxis
                dataKey="y"
                name="Max Temp"
                type="number"
                domain={[20, 50]}
                tick={{ fontSize: 10, fill: '#4e7a9e' }}
                label={{ value: 'Max Temp (°C)', angle: -90, position: 'insideLeft', fill: '#4e7a9e', fontSize: 10 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="glass rounded-lg p-2 border border-blue-700/40 text-xs">
                      <p className="text-white font-bold">{d.name}</p>
                      <p className="text-cyan-300">Humidity: {d.x}%</p>
                      <p className="text-orange-300">Temp: {d.y}°C</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#f97316" fillOpacity={0.8}>
                {scatterData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Heat index heatmap */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Temperature Severity Map</h3>
              <p className="text-blue-400 text-xs">Alert level by city</p>
            </div>
          </div>
          <div className="space-y-2">
            {liveData.map((city, i) => {
              const maxTemp = city.temperature.max || 30;
              const pct = Math.min(((maxTemp - 20) / 30) * 100, 100);
              const color = maxTemp >= 42 ? '#ef4444' : maxTemp >= 38 ? '#f97316' : maxTemp >= 34 ? '#f59e0b' : '#22c55e';
              const alertLevel = city.analysis.alertLevel;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-blue-300 text-xs w-20 flex-shrink-0">{city.city}</span>
                  <div className="flex-1 h-5 bg-blue-900/40 rounded overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.04, duration: 0.8 }}
                      className="absolute left-0 top-0 h-full rounded flex items-center px-2"
                      style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
                    >
                      <span className="text-white text-[9px] font-bold">{maxTemp}°C</span>
                    </motion.div>
                  </div>
                  <span className={`text-[10px] font-bold w-14 text-right ${
                    alertLevel === 'warning' || alertLevel === 'danger' || alertLevel === 'orange' || alertLevel === 'red' ? 'text-red-400' :
                    alertLevel === 'watch' || alertLevel === 'yellow' ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {alertLevel === 'normal' || alertLevel === 'GREEN' || alertLevel === 'green' ? 'Normal' : alertLevel === 'watch' || alertLevel === 'yellow' ? 'Watch' : 'Warning'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[10px]">
            {[['Normal', '#22c55e', '< 34°C'], ['Warm', '#f59e0b', '34-37°C'], ['Hot', '#f97316', '38-41°C'], ['Extreme', '#ef4444', '≥ 42°C']].map(([label, color, range]) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ background: color }} />
                <span className="text-blue-400">{label} ({range})</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Summary stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-4"
      >
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <BarChart3 size={16} className="text-cyan-400" />
          Statistical Summary — Vidarbha Region ({currentDate})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-900/40">
                <th className="text-left px-3 py-2 text-blue-400">Parameter</th>
                <th className="text-center px-3 py-2 text-blue-400">Max</th>
                <th className="text-center px-3 py-2 text-blue-400">Min</th>
                <th className="text-center px-3 py-2 text-blue-400">Average</th>
                <th className="text-center px-3 py-2 text-blue-400">Departure</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i} className="border-b border-blue-900/20 hover:bg-blue-900/10">
                  <td className="px-3 py-2.5 text-white font-medium">{row.param}</td>
                  <td className="px-3 py-2.5 text-center text-orange-300">{row.max}</td>
                  <td className="px-3 py-2.5 text-center text-blue-300">{row.min}</td>
                  <td className="px-3 py-2.5 text-center text-white">{row.avg}</td>
                  <td className="px-3 py-2.5 text-center font-bold" style={{ color: row.depColor }}>{row.dep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-blue-600 mt-3 text-center">
          *** Departures based on Pentad Normals 1991–2020 | Source: IMD / RMC Nagpur ***
        </p>
      </motion.div>
    </motion.div>
  );
}
