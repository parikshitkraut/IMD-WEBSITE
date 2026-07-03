import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, CloudRain, AlertTriangle, Wind, Droplets } from 'lucide-react';
import { fetchForecast } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const CityCard = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [forecast, setForecast] = useState(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (isOpen && !forecast) {
      fetchForecast(data.city).then(res => setForecast(res));
    }
  }, [isOpen, data.city, forecast]);

  const sc = data.analysis.alertLevel === 'RED' ? { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' } :
             data.analysis.alertLevel === 'ORANGE' ? { bg: 'rgba(249,115,22,0.1)', text: '#f97316', border: 'rgba(249,115,22,0.3)' } :
             data.analysis.alertLevel === 'YELLOW' ? { bg: 'rgba(234,179,8,0.1)', text: '#eab308', border: 'rgba(234,179,8,0.3)' } :
             { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' };

  return (
    <div 
      className="relative"
    >
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        className="glass-card p-4 cursor-pointer"
        style={{ border: `1px solid ${sc.border}` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="absolute inset-0 rounded-2xl" style={{ background: sc.bg }} />
        <div className="relative z-10">
          <h3 className="text-white font-bold text-sm mb-2">{data.city}</h3>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-2xl font-black" style={{ color: sc.text }}>{data.temperature.max}°C</div>
              <div className="text-[10px] text-gray-400">Max Temp {data.temperature.maxDeparture > 0 ? `(+${data.temperature.maxDeparture})` : `(${data.temperature.maxDeparture})`}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-300">{data.temperature.min}°C</div>
              <div className="text-[10px] text-gray-400">Min Temp</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hover Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute z-50 w-72 glass-card p-4 shadow-2xl top-full mt-2 left-1/2 -translate-x-1/2 ${!isDarkMode ? 'light-mode-popup' : ''}`}
            style={{
              border: `1px solid ${sc.border}`,
              background: isDarkMode ? 'rgba(10, 22, 40, 0.95)' : 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <h4 className="text-white font-bold text-sm mb-3 flex items-center justify-between">
              <span>{data.city} Analytics</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>
                {data.analysis.alertLevel} ALERT
              </span>
            </h4>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-blue-900/30 p-2 rounded-lg">
                <div className="flex items-center gap-1 text-cyan-400 mb-1"><Droplets size={12} /> <span className="text-[10px]">Humidity</span></div>
                <div className="text-white text-xs font-bold">{data.humidity.morning}% (M) / {data.humidity.evening}% (E)</div>
              </div>
              <div className="bg-blue-900/30 p-2 rounded-lg">
                <div className="flex items-center gap-1 text-blue-400 mb-1"><CloudRain size={12} /> <span className="text-[10px]">Rainfall</span></div>
                <div className="text-white text-xs font-bold">{data.rainfall.last24h}mm</div>
              </div>
            </div>

            {forecast ? (
              <div className="mb-2">
                <div className="text-[10px] text-gray-400 mb-1">7-Day Temp Trend</div>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecast} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`colorMax-${data.city}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={{ background: '#0f172a', border: 'none', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="maxTemp" stroke="#ef4444" fillOpacity={1} fill={`url(#colorMax-${data.city})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center text-[10px] text-gray-500">Loading forecast...</div>
            )}
            
            <div className="text-[9px] text-center text-gray-400 mt-2">
              Forecast Confidence: <span className="text-green-400">{data.analysis.forecastConfidence}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CityCard;
