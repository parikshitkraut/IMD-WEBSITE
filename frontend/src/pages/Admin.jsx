import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Upload, Database, Bell, Loader2, CheckCircle,
  Plus, Trash2, Edit, RefreshCw, Shield, User, BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { weatherData } from '../data/weatherData';

const adminStats = [
  { label: 'Total Stations', value: '47', icon: Database, color: '#3b82f6', delta: '+2 this week' },
  { label: 'Active Alerts', value: '5', icon: Bell, color: '#ef4444', delta: '2 warnings, 3 watches' },
  { label: 'Reports Generated', value: '128', icon: BarChart3, color: '#22c55e', delta: '+12 today' },
  { label: 'Data Uploads', value: '3', icon: Upload, color: '#f59e0b', delta: 'Last 24 hours' },
];

export default function Admin() {
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('stations');

  const [stations, setStations] = useState(
    weatherData.slice(0, 8).map(c => ({ ...c, status: 'active', lastUpdate: '0830 IST' }))
  );

  const handleUpload = async () => {
    setUploading(true);
    await new Promise(r => setTimeout(r, 2000));
    setUploading(false);
    toast.success('Weather data uploaded successfully! 47 stations updated.', {
      icon: '📤',
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #22c55e' }
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setRefreshing(false);
    toast.success('Data refreshed from IMD observation network!', {
      icon: '🔄',
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #3b82c4' }
    });
  };

  const triggerAlert = (type) => {
    toast.success(`${type} alert triggered and broadcast to all district offices!`, {
      icon: '⚠️',
      duration: 5000,
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #f97316' }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-amber-400" />
            <h2 className="text-xl font-bold gradient-text">Admin Control Panel</h2>
          </div>
          <p className="text-blue-400 text-sm">Demo interface — Manage stations, alerts, data, and reports</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 glass-light rounded-lg text-xs">
          <User size={12} className="text-blue-400" />
          <span className="text-blue-300">Forecasting Officer</span>
          <span className="text-green-400 ml-2 font-medium">● Online</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {adminStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10"
              style={{ background: stat.color, transform: 'translate(30%, -30%)' }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${stat.color}25` }}>
                  <stat.icon size={14} style={{ color: stat.color }} />
                </div>
                <span className="text-blue-400 text-[10px]">{stat.label}</span>
              </div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <p className="text-[10px] text-blue-500 mt-0.5">{stat.delta}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b border-blue-900/30 pb-0">
        {['stations', 'alerts', 'upload', 'settings'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-all border-b-2 ${
              tab === t
                ? 'border-blue-500 text-white'
                : 'border-transparent text-blue-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'stations' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Observation Stations</h3>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-light rounded-lg text-xs text-blue-300 hover:text-white border border-blue-800/30 transition-all"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white border border-blue-600/40 transition-all"
                style={{ background: 'linear-gradient(135deg, #2563a8, #06b6d4)' }}
              >
                <Plus size={12} />
                Add Station
              </motion.button>
            </div>
          </div>

          <div className="glass-card overflow-hidden rounded-2xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-blue-900/40 text-blue-400">
                  <th className="text-left px-4 py-3">Station</th>
                  <th className="text-left px-3 py-3">Region</th>
                  <th className="text-center px-3 py-3">Max Temp</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-center px-3 py-3">Last Update</th>
                  <th className="text-center px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station, i) => (
                  <tr key={station.id} className="border-b border-blue-900/20 hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-white">{station.city}</td>
                    <td className="px-3 py-2.5 text-blue-400 text-[10px]">{station.region.split(' ')[0]}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-orange-400">{station.maxTemp ?? '--'}°C</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`status-badge border ${i === 3 ? 'alert-watch' : 'alert-normal'}`}>
                        {i === 3 ? '⚠ Maintenance' : '✓ Active'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-blue-400">{station.lastUpdate}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingId(station.id)}
                          className="p-1.5 rounded glass-light text-blue-400 hover:text-white transition-all"
                        >
                          <Edit size={11} />
                        </button>
                        <button className="p-1.5 rounded glass-light text-red-400 hover:text-red-300 transition-all">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-sm">Alert Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Heatwave Warning', areas: 'Wardha, Chandrapur', level: 'danger', issued: '21 May 2026 06:00 IST', valid: '23 May 2026 18:00 IST' },
              { title: 'Heatwave Watch', areas: 'Nagpur, Akola, Amravati', level: 'warning', issued: '21 May 2026 06:00 IST', valid: '22 May 2026 18:00 IST' },
              { title: 'Thunderstorm Alert', areas: 'Gadchiroli, Bhandara', level: 'watch', issued: '21 May 2026 12:00 IST', valid: '23 May 2026 21:00 IST' },
              { title: 'UV Index Advisory', areas: 'All Vidarbha', level: 'watch', issued: '21 May 2026 08:00 IST', valid: '21 May 2026 16:00 IST' },
            ].map((alert, i) => (
              <div key={i} className={`glass-card p-4 border-l-4 ${
                alert.level === 'danger' ? 'border-l-red-500' : alert.level === 'warning' ? 'border-l-orange-500' : 'border-l-amber-500'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-semibold text-sm">{alert.title}</h4>
                    <p className="text-blue-400 text-xs mt-0.5">{alert.areas}</p>
                  </div>
                  <span className={`status-badge border ${
                    alert.level === 'danger' ? 'alert-extreme' : alert.level === 'warning' ? 'alert-warning' : 'alert-watch'
                  }`}>
                    {alert.level.toUpperCase()}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-[10px] text-blue-400">
                  <div>Issued: {alert.issued}</div>
                  <div>Valid till: {alert.valid}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 py-1.5 glass-light rounded-lg text-xs text-blue-300 hover:text-white border border-blue-800/30 transition-all">
                    Edit
                  </button>
                  <button
                    onClick={() => triggerAlert(alert.title)}
                    className="flex-1 py-1.5 rounded-lg text-xs text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}
                  >
                    Broadcast
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white font-medium"
            style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}
            onClick={() => triggerAlert('New Heatwave')}
          >
            <Plus size={14} />
            Create New Alert
          </button>
        </div>
      )}

      {tab === 'upload' && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-sm">Data Upload</h3>
          <div className="glass-card p-6 border-2 border-dashed border-blue-700/40 rounded-2xl text-center">
            <Upload size={40} className="text-blue-400 mx-auto mb-3" />
            <h4 className="text-white font-semibold mb-1">Upload Weather Observation Data</h4>
            <p className="text-blue-400 text-sm mb-4">Accepts CSV, JSON, or IMD standard formats</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <label className="cursor-pointer px-6 py-2.5 rounded-xl text-sm text-white font-medium transition-all"
                style={{ background: 'linear-gradient(135deg, #2563a8, #06b6d4)' }}>
                <input type="file" accept=".csv,.json" className="hidden" onChange={() => handleUpload()} />
                Choose File
              </label>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleUpload}
                className="px-6 py-2.5 rounded-xl text-sm font-medium glass-light text-blue-300 hover:text-white border border-blue-800/30 transition-all flex items-center gap-2"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {uploading ? 'Uploading...' : 'Use Demo Data'}
              </motion.button>
            </div>
          </div>

          <div className="glass-card p-4">
            <h4 className="text-white font-semibold text-sm mb-3">Recent Uploads</h4>
            <div className="space-y-2">
              {[
                { file: 'observations_21May_0830.csv', size: '12.4 KB', time: '0830 IST', status: 'success' },
                { file: 'forecast_21May.json', size: '8.2 KB', time: '0600 IST', status: 'success' },
                { file: 'alerts_20May.json', size: '2.1 KB', time: '18:00 IST', status: 'success' },
              ].map((upload, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 glass-light rounded-lg">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-white text-xs font-medium">{upload.file}</p>
                    <p className="text-blue-400 text-[10px]">{upload.size} • {upload.time}</p>
                  </div>
                  <span className="text-green-400 text-[10px] font-semibold">Uploaded</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-sm">System Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Data Refresh Interval', value: 'Every 30 minutes', type: 'select', options: ['15 min', '30 min', '1 hour', '3 hours'] },
              { label: 'Alert Threshold (Heatwave)', value: '40°C', type: 'input' },
              { label: 'Rainfall Alert Threshold', value: '64.5 mm/day', type: 'input' },
              { label: 'Default Region', value: 'Vidarbha Region', type: 'select', options: ['Vidarbha Region', 'Marathwada Region', 'Mumbai & Konkan'] },
            ].map((setting, i) => (
              <div key={i} className="glass-card p-4">
                <label className="block text-blue-400 text-xs mb-2 font-medium">{setting.label}</label>
                {setting.type === 'select' ? (
                  <select className="w-full bg-transparent glass border border-blue-700/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/60 transition-colors">
                    {setting.options.map(opt => (
                      <option key={opt} value={opt} className="bg-gray-900">{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    defaultValue={setting.value}
                    className="w-full bg-transparent glass border border-blue-700/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/60 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => toast.success('Settings saved successfully!', {
              style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #22c55e' }
            })}
            className="px-6 py-2.5 rounded-xl text-sm text-white font-medium transition-all"
            style={{ background: 'linear-gradient(135deg, #2563a8, #06b6d4)' }}
          >
            Save Settings
          </motion.button>
        </div>
      )}

      {/* Demo notice */}
      <div className="glass-card p-3 border-l-4 border-l-amber-500">
        <p className="text-amber-400 text-xs font-semibold flex items-center gap-1.5">
          <Shield size={12} />
          Demo Mode Notice
        </p>
        <p className="text-blue-400 text-[10px] mt-1">
          This admin panel is a functional prototype for demonstration purposes. In production, all actions would be secured with role-based authentication and audit logging.
        </p>
      </div>
    </motion.div>
  );
}
