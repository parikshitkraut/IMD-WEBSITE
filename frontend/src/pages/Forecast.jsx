import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, ComposedChart
} from 'recharts';
import { Calendar, CloudRain, Thermometer, TrendingUp, Wind, Activity } from 'lucide-react';
import { weatherData, extendedForecast } from '../data/weatherData';

const tabs = ['2-Day', '5-Day', '7-Day Extended'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-blue-700/40 text-xs shadow-2xl">
      <p className="text-cyan-300 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}: <strong className="text-white">{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const forecastIcons = {
  'Sunny': '☀️', 'Clear': '☀️', 'Hot': '🌡️', 'Very Hot': '🌡️', 'Extreme Heat': '🔥',
  'Partly Cloudy': '🌤️', 'Cloudy': '⛅', 'Mostly Cloudy': '☁️',
  'Showers': '🌦️', 'Rain': '🌧️', 'Heavy Rain': '🌧️', 'Very Heavy Rain': '🌊',
  'Thunderstorm': '⛈️', 'Lightning': '⚡', 'Hot & Dry': '🏜️',
  'Humid & Cloudy': '🌫️', 'Hot & Sunny': '☀️', 'Hot & Humid': '💧',
  'Mostly Clear': '🌤️', 'Clear Sky': '☀️',
};

export default function Forecast() {
  const [activeTab, setActiveTab] = useState('7-Day Extended');
  const [selectedCity, setSelectedCity] = useState('Nagpur');

  const city = weatherData.find(c => c.city === selectedCity) || weatherData[0];
  const ef = extendedForecast;

  const getDayRange = () => {
    if (activeTab === '2-Day') return 2;
    if (activeTab === '5-Day') return 5;
    return 7;
  };

  const days = getDayRange();
  const forecastData = ef.days.slice(0, days).map((day, i) => ({
    day,
    'Max Temp': ef.nagpur.maxTemps[i],
    'Min Temp': ef.nagpur.minTemps[i],
    'Rainfall': ef.nagpur.rainfall[i],
    'Humidity': ef.nagpur.humidity[i],
    'Confidence': ef.nagpur.confidence[i],
    'Departure': ef.nagpur.maxTemps[i] - 40, // Normal reference 40°C
  }));

  const radarData = [
    { subject: 'Max Temp', value: Math.round(city.maxTemp / 50 * 100) || 60, fullMark: 100 },
    { subject: 'Humidity', value: city.humidityMorning || 40, fullMark: 100 },
    { subject: 'Rain Prob', value: city.rainfall24hr > 0 ? 60 : 15, fullMark: 100 },
    { subject: 'Wind', value: Math.round((city.windSpeed || 10) / 40 * 100), fullMark: 100 },
    { subject: 'UV Index', value: Math.round((city.uvIndex || 7) / 12 * 100), fullMark: 100 },
    { subject: 'Visibility', value: Math.round((city.visibility || 8) / 10 * 100), fullMark: 100 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold gradient-text mb-1">Extended Range Forecast</h2>
          <p className="text-blue-400 text-sm">2 / 5 / 7-Day Analysis for Central India Region</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            className="glass border border-blue-700/40 rounded-lg px-3 py-1.5 text-sm text-white bg-transparent outline-none cursor-pointer"
          >
            {weatherData.map(c => (
              <option key={c.id} value={c.city} className="bg-gray-900">{c.city}</option>
            ))}
          </select>
          <div className="flex rounded-lg overflow-hidden border border-blue-700/30">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === tab ? 'bg-blue-600 text-white' : 'glass-light text-blue-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
        {city.forecastDays.slice(0, days).map((day, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-3 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-5 rounded-2xl flex items-center justify-center text-6xl">
              {day.icon}
            </div>
            <div className="relative z-10">
              <div className="text-blue-400 text-xs font-semibold mb-1">{day.day}</div>
              <div className="text-3xl mb-2">{day.icon}</div>
              <div className="text-xl font-black text-orange-400 mb-0.5">{day.maxTemp}°C</div>
              <div className="text-sm text-blue-300 mb-2">{day.minTemp}°C</div>
              <div className="text-[10px] text-blue-400 leading-tight">{day.condition}</div>
              {day.rainfall > 0 && (
                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-cyan-400">
                  <CloudRain size={9} />
                  {day.rainfall} mm
                </div>
              )}
              <div className="mt-2 h-1 rounded-full overflow-hidden bg-blue-900/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-orange-400"
                  style={{ width: `${ef.nagpur.confidence[i] || 80}%` }}
                />
              </div>
              <div className="text-[8px] text-blue-500 mt-0.5">Confidence: {ef.nagpur.confidence[i] || 80}%</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Temperature anomaly */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Temperature Forecast — {selectedCity}</h3>
              <p className="text-blue-400 text-xs">Max & Min with Departure Analysis</p>
            </div>
            <Thermometer size={16} className="text-orange-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
              <YAxis tick={{ fontSize: 10, fill: '#4e7a9e' }} domain={[20, 50]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <defs>
                <linearGradient id="fMaxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fMinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="Max Temp" stroke="#ef4444" strokeWidth={2.5} fill="url(#fMaxGrad)" dot={{ fill: '#ef4444', r: 4 }} />
              <Area type="monotone" dataKey="Min Temp" stroke="#3b82f6" strokeWidth={2} fill="url(#fMinGrad)" dot={{ fill: '#3b82f6', r: 3 }} />
              <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 2" label={{ value: 'Heatwave Threshold', fill: '#f97316', fontSize: 9 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Rainfall + Humidity */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Rainfall & Humidity Forecast</h3>
              <p className="text-blue-400 text-xs">Precipitation probability & moisture</p>
            </div>
            <CloudRain size={16} className="text-blue-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,196,0.1)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
              <YAxis yAxisId="rain" tick={{ fontSize: 10, fill: '#4e7a9e' }} />
              <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#4e7a9e' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="rain" dataKey="Rainfall" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Rainfall (mm)" />
              <Line yAxisId="hum" type="monotone" dataKey="Humidity" stroke="#a78bfa" strokeWidth={2.5} dot={{ fill: '#a78bfa', r: 4 }} name="Humidity (%)" />
              <Line yAxisId="hum" type="monotone" dataKey="Confidence" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Confidence (%)" />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Weather radar chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Weather Parameter Radar</h3>
              <p className="text-blue-400 text-xs">{selectedCity} — Current Conditions</p>
            </div>
            <Activity size={16} className="text-purple-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="rgba(59,130,196,0.2)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#60a5e0', fontSize: 11 }} />
              <Radar name="Today" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Forecast confidence */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-sm">Forecast Confidence Metrics</h3>
              <p className="text-blue-400 text-xs">Day-by-day model accuracy</p>
            </div>
            <TrendingUp size={16} className="text-green-400" />
          </div>

          <div className="space-y-3">
            {forecastData.map((day, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-blue-400 text-xs w-14 flex-shrink-0">{day.day}</span>
                <div className="flex-1 h-2 bg-blue-900/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${day.Confidence}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${day.Confidence >= 80 ? '#22c55e' : day.Confidence >= 65 ? '#f59e0b' : '#ef4444'}, ${day.Confidence >= 80 ? '#06b6d4' : '#f97316'})`,
                    }}
                  />
                </div>
                <span className="text-white text-xs font-bold w-10 text-right">{day.Confidence}%</span>
                <span className={`text-[10px] w-14 ${day.Confidence >= 80 ? 'text-green-400' : day.Confidence >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
                  {day.Confidence >= 80 ? 'HIGH' : day.Confidence >= 65 ? 'MEDIUM' : 'LOW'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-900/20 rounded-xl border border-blue-800/30">
            <p className="text-[10px] text-blue-400 leading-relaxed">
              <strong className="text-blue-300">Note:</strong> Extended range forecasts (beyond 5 days) carry higher uncertainty.
              Confidence levels are based on ensemble model agreement and historical verification.
              Forecasts issued by RMC Nagpur / IMD.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
