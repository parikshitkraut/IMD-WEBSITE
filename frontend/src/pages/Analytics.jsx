import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScatterChart, Scatter, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, ComposedChart, Area, AreaChart
} from 'recharts';
import { BarChart3, TrendingUp, Droplets, Thermometer, Map, Activity } from 'lucide-react';
import { weatherData } from '../data/weatherData';

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

const vidarbhaCities = weatherData.filter(c => c.region === 'Vidarbha Region');

export default function Analytics() {
  const [activeMetric, setActiveMetric] = useState('temperature');

  const tempData = vidarbhaCities.map(c => ({
    name: c.city,
    max: c.maxTemp,
    min: c.minTemp,
    departure: c.maxDeparture,
  })).filter(c => c.max != null);

  const humidityData = vidarbhaCities.map(c => ({
    name: c.city,
    morning: c.humidityMorning,
    evening: c.humidityEvening,
  })).filter(c => c.morning != null);

  const rainfallData = weatherData.map(c => ({
    name: c.city,
    rf24: c.rainfall24hr,
    rf9: c.rainfall9hr,
  }));

  const heatmapData = vidarbhaCities.map((c, i) => ({
    name: c.city,
    value: c.maxTemp || 28,
    humidity: c.humidityMorning || 40,
    alert: c.alertLevel,
  }));

  const departureData = vidarbhaCities
    .filter(c => c.maxDeparture != null)
    .map(c => ({
      name: c.city,
      departure: c.maxDeparture,
      fill: c.maxDeparture > 0 ? '#ef4444' : '#3b82f6',
    }));

  const scatterData = weatherData.map(c => ({
    x: c.humidityMorning || 40,
    y: c.maxTemp || 28,
    name: c.city,
  }));

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
              <p className="text-blue-400 text-xs">21 May 2026 — Observed data</p>
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
            {vidarbhaCities.filter(c => c.maxTemp != null).map((city, i) => {
              const pct = Math.min(((city.maxTemp - 20) / 30) * 100, 100);
              const color = city.maxTemp >= 42 ? '#ef4444' : city.maxTemp >= 38 ? '#f97316' : city.maxTemp >= 34 ? '#f59e0b' : '#22c55e';
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
                      <span className="text-white text-[9px] font-bold">{city.maxTemp}°C</span>
                    </motion.div>
                  </div>
                  <span className={`text-[10px] font-bold w-14 text-right ${
                    city.alertLevel === 'warning' || city.alertLevel === 'danger' ? 'text-red-400' :
                    city.alertLevel === 'watch' ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {city.alertLevel === 'normal' ? 'Normal' : city.alertLevel === 'watch' ? 'Watch' : 'Warning'}
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
          Statistical Summary — Vidarbha Region (21 May 2026)
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
              {[
                {
                  param: 'Maximum Temperature (°C)',
                  max: '42.6 (Nagpur)',
                  min: '25.4 (Gadchiroli)',
                  avg: '30.8',
                  dep: '+2.1',
                  depColor: '#f97316',
                },
                {
                  param: 'Minimum Temperature (°C)',
                  max: '27.8 (Nagpur)',
                  min: '19.8 (Gadchiroli)',
                  avg: '23.1',
                  dep: '+0.8',
                  depColor: '#f59e0b',
                },
                {
                  param: 'Morning RH (%)',
                  max: '67 (Bhandara)',
                  min: '31 (Chandrapur)',
                  avg: '42',
                  dep: '-5',
                  depColor: '#3b82f6',
                },
                {
                  param: 'Evening RH (%)',
                  max: '38 (Bhandara)',
                  min: '17 (Chandrapur)',
                  avg: '26',
                  dep: '-8',
                  depColor: '#3b82f6',
                },
                {
                  param: 'Rainfall 24h (mm)',
                  max: '0.0',
                  min: '0.0',
                  avg: '0.0',
                  dep: '—',
                  depColor: '#60a5e0',
                },
              ].map((row, i) => (
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
