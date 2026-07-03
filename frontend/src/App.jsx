import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import {
  LayoutDashboard, CloudRain, BarChart3, FileText, MessageSquare,
  Settings, Menu, X, Sun, Moon, Bell, Wifi, ChevronRight, Globe,
  Thermometer, Wind, Droplets, Eye, AlertTriangle, TrendingUp, Map, Download, Share2
} from 'lucide-react';
import { format } from 'date-fns';

import Dashboard from './pages/Dashboard';
import Observations from './pages/Observations';
import Forecast from './pages/Forecast';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Chatbot from './pages/Chatbot';
import Admin from './pages/Admin';
import RainfallReport from './pages/RainfallReport';
import RainfallObservationPage from './pages/RainfallObservationPage';
import { alertTicker, weatherData } from './data/weatherData';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', badge: null },
  { path: '/observations', icon: CloudRain, label: 'Today\'s Observations', badge: '12' },
  { path: '/rainfall-observation', icon: Droplets, label: 'Rainfall Observations', badge: 'NEW' },
  { path: '/forecast', icon: TrendingUp, label: 'Forecast', badge: null },
  { path: '/rainfall-report', icon: Droplets, label: 'Rainfall Report', badge: 'NEW' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', badge: null },
  { path: '/reports', icon: FileText, label: 'Reports', badge: '3' },
  { path: '/chatbot', icon: MessageSquare, label: 'AI Assistant', badge: 'NEW' },
  { path: '/admin', icon: Settings, label: 'Admin Panel', badge: null },
];

function Sidebar({ isOpen, onClose }) {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-full w-64 z-40 lg:relative lg:translate-x-0 sidebar-gradient border-r border-blue-900/30 flex flex-col"
      >
        {/* Logo area */}
        <div className="p-4 border-b border-blue-900/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-white rounded-lg p-1 shadow-md">
              <img src="/images/imd_logoc.gif" alt="IMD Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm leading-tight">WeatherDesk</h1>
              <p className="text-blue-400 text-[10px] leading-tight">RMC Nagpur • v2.5.1</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
            <span className="text-green-400 font-medium">System Online</span>
            <span className="ml-auto text-blue-500">LIVE</span>
          </div>
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-blue-900/20 hover:bg-blue-900/40 text-blue-300 hover:text-white transition-all cursor-pointer border border-blue-900/30"
          >
            <span className="text-xs font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-400" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* App Navigation */}
          <div className="px-3 py-1.5 mx-2 mb-2 rounded old-theme-header">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">Main Menu</span>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 mb-1 rounded-lg transition-all duration-200 text-sm old-theme-link ${
                  isActive
                    ? 'nav-active font-semibold'
                    : 'text-blue-300 hover:bg-blue-900/30 hover:text-white'
                }`
              }
              onClick={() => window.innerWidth < 1024 && onClose()}
            >
              <item.icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  item.badge === 'NEW'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-blue-600/30 text-blue-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Official RMC Nagpur Navigation Tabs */}
          <div className="mt-6 mb-2 border-t border-blue-900/30 pt-4">
            <div className="px-3 py-1.5 mx-2 mb-2 rounded old-theme-header">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest">Official RMC Tabs</span>
            </div>
            
            <div className="space-y-1">
              {/* Weather Analysis */}
              <div className="mx-2 rounded-lg bg-blue-900/20 old-theme-accordion">
                <div className="px-4 py-2 text-sm font-semibold text-blue-200 flex items-center justify-between cursor-pointer old-theme-accordion-header">
                  <span>Weather Analysis</span>
                  <ChevronRight size={14} className="text-blue-400 rotate-90" />
                </div>
                <div className="px-3 pb-2 pt-1 flex flex-col space-y-1">
                  <NavLink 
                    to="/observations" 
                    className={({ isActive }) => `text-xs py-2 px-3 rounded old-theme-link ${isActive ? 'nav-active text-white font-semibold' : 'text-blue-300 hover:text-white'}`}
                    onClick={() => window.innerWidth < 1024 && onClose()}
                  >
                    Today's Observations
                  </NavLink>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">All India Weather Bulletin</a>
                </div>
              </div>

              {/* Forecasts & Warnings */}
              <div className="mx-2 rounded-lg bg-blue-900/20 old-theme-accordion mt-2">
                <div className="px-4 py-2 text-sm font-semibold text-blue-200 flex items-center justify-between cursor-pointer old-theme-accordion-header">
                  <span>Forecasts & Warnings</span>
                  <ChevronRight size={14} className="text-blue-400 rotate-90" />
                </div>
                <div className="px-3 pb-2 pt-1 flex flex-col space-y-1">
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Regional Weather Forecast</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Precipitation Forecast</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Warning Forecast</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Districtwise Warnings</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Local (City) Forecast</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Agromet Advisories</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Impact Based Forecast</a>
                </div>
              </div>

              {/* Reports */}
              <div className="mx-2 rounded-lg bg-blue-900/20 old-theme-accordion mt-2">
                <div className="px-4 py-2 text-sm font-semibold text-blue-200 flex items-center justify-between cursor-pointer old-theme-accordion-header">
                  <span>Reports</span>
                  <ChevronRight size={14} className="text-blue-400 rotate-90" />
                </div>
                <div className="px-3 pb-2 pt-1 flex flex-col space-y-1">
                  <NavLink to="/rainfall-report" className={({ isActive }) => `text-xs py-2 px-3 rounded old-theme-link ${isActive ? 'nav-active text-white font-semibold' : 'text-blue-300 hover:text-white'}`}
                    onClick={() => window.innerWidth < 1024 && onClose()}>DRMS Rainfall Report</NavLink>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Rainfall Activity</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Regional Daily Report</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Weekly Weather Report</a>
                  <a href="#" className="text-xs py-2 px-3 rounded old-theme-link text-blue-300 hover:text-white">Seasonal Data</a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="px-3 py-1.5 mx-2 mt-6 mb-2 rounded old-theme-header">
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">Quick Links</span>
          </div>
          {[
            { label: 'IMD Nagpur Website', url: 'https://www.imdnagpur.gov.in' },
            { label: 'Observations Page', url: 'https://www.imdnagpur.gov.in/pages/observations.php' },
            { label: 'India Met Dept', url: 'https://mausam.imd.gov.in' },
          ].map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 mx-2 mb-1 rounded-lg text-xs text-blue-400 hover:text-blue-200 hover:bg-blue-900/20 transition-all old-theme-link"
            >
              <Globe size={13} />
              <span className="truncate">{link.label}</span>
              <ChevronRight size={11} className="ml-auto flex-shrink-0" />
            </a>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-4 border-t border-blue-900/30">
          <div className="glass-light rounded-lg p-3">
            <p className="text-[10px] text-blue-400 font-medium mb-1">Data as of</p>
            <p className="text-xs text-white font-semibold">{format(new Date(), 'dd MMM yyyy, HH:mm')} IST</p>
            <p className="text-[10px] text-blue-400 mt-1">Source: RMC Nagpur / IMD</p>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function Header({ onMenuClick }) {
  const [time, setTime] = useState(new Date());
  const [tickerIdx, setTickerIdx] = useState(0);
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => {
      setTickerIdx(i => (i + 1) % alertTicker.length);
    }, 8000);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="sticky top-0 z-30">
      {/* ═══ OFFICIAL RMC NAGPUR BANNER ═══ */}
      <div
        className="w-full relative"
        style={{
          backgroundImage: 'url(/images/bg3.jpg)',
          backgroundSize: 'cover',
          borderBottom: 'none'
        }}
      >
        <div className="flex items-center justify-between min-h-[70px] w-full px-2">
          {/* LEFT: Government of India Emblem */}
          <div className="flex-shrink-0 flex items-center justify-end" style={{ width: '100px', padding: '3px' }}>
            <img src="/images/emblem.gif" alt="Government of India Emblem"
              className="h-[80px] border-0" style={{ padding: '7px' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>

          {/* CENTER: Title */}
          <div className="flex-1 text-center py-1 flex flex-col items-center justify-center">
            <h1 style={{
              fontSize: '28px', color: '#39ff14', fontWeight: '900',
              textShadow: '1px 1px 0 #ff4500, -1px -1px 0 #ff4500, 1px -1px 0 #ff4500, -1px 1px 0 #ff4500, 2px 2px 4px rgba(0,0,0,0.5)', 
              letterSpacing: '1px',
              fontFamily: 'Courier New, Courier, monospace',
              margin: '0', padding: '0', lineHeight: '1.2'
            }}>
              Regional Meteorological Centre, Nagpur
            </h1>
            <h2 style={{
              fontSize: '14px', color: '#4169e1', fontWeight: 'bold',
              fontFamily: 'Courier New, Courier, monospace', margin: '2px 0 0 0',
              textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
            }}>
              India Meteorological Department, Ministry of Earth Sciences
            </h2>
            <h3 style={{
              fontSize: '12px', color: '#8b7355', fontWeight: 'bold',
              fontFamily: 'Courier New, Courier, monospace', margin: '2px 0 0 0'
            }}>
              Government of India
            </h3>
          </div>

          {/* RIGHT: 150 Years IMD + IMD Logo */}
          <div className="flex items-center flex-shrink-0">
             <div style={{ width: '100px', padding: '3px' }} className="flex items-center justify-center">
                <img src="/images/imd150t.png" alt="150 Years IMD"
                  className="h-[75px] border-0" style={{ padding: '7px' }}
                  onError={e => { e.target.style.display = 'none'; }} />
             </div>
             <div style={{ width: '100px', padding: '3px' }} className="flex items-center justify-center">
                <img src="/images/imd_logoc.gif" alt="IMD Logo"
                  className="h-[80px] border-0" style={{ padding: '7px' }}
                  onError={e => { e.target.style.display = 'none'; }} />
             </div>
          </div>
        </div>
      </div>

      {/* ═══ DARK BLUE NAV BAR ═══ */}
      <div style={{
        backgroundColor: '#003366',
        borderTop: '2px solid #333',
        borderBottom: '2px solid #333',
      }}>
        <div className="flex items-center justify-between px-2">
          {/* Left Date/Time */}
          <div className="hidden lg:flex flex-col items-center justify-center px-4 border-r border-[#1a4a82] min-w-[150px]">
            <span className="text-yellow-300 text-[11px] font-bold">
              {format(time, 'EEEE, dd MMMM yyyy')}
            </span>
            <span className="text-yellow-300 text-[11px] font-bold mt-0.5">
              {format(time, 'hh:mm:ss a')} IST
            </span>
          </div>

          <button onClick={onMenuClick}
            className="lg:hidden p-2 text-white hover:bg-[#1a4a82] transition-all">
            <Menu size={18} />
          </button>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center text-[10.5px] font-semibold text-white">
            <NavLink to="/" className={({ isActive }) => `px-4 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82] ${isActive ? 'bg-[#1a4a82]' : ''}`}>H O M E</NavLink>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">IMD Website for General Public</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">About RMC Nagpur ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">About MoES & IMD ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">Publications ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">Miscellaneous ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">Do's & Dont's ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">FAQs ▾</a>
            <a href="#" className="px-3 py-3 border-r border-[#1a4a82] hover:bg-[#1a4a82]">Contact Us</a>
          </div>

          <div className="flex-1"></div>

          {/* Right Hindi Toggle */}
          <div className="hidden lg:flex items-center px-4 border-l border-[#1a4a82] h-full py-3">
            <button onClick={toggleTheme} className="text-yellow-400">
               {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <span className="text-yellow-400 text-[12px] font-bold ml-3">हिन्दी / Hindi</span>
          </div>

        </div>
      </div>

      {/* ═══ ALERT TICKER ═══ */}
      <div className="bg-gradient-to-r from-red-900/80 via-orange-900/60 to-red-900/80 border-b border-red-700/30 py-1 px-4 alert-ticker">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <AlertTriangle size={12} className="text-red-400 animate-pulse" />
            <span className="text-red-300 text-[11px] font-bold tracking-wider uppercase">Alert</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p key={tickerIdx}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}
                className="text-orange-200 text-[11px] font-medium truncate">
                {alertTicker[tickerIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            <Wifi size={11} className="text-green-400" />
            <span className="text-green-400 text-[10px] font-semibold">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-blue-900/30 mt-auto">
      <div className="bg-gradient-to-r from-[#050d1a] via-[#0c1b33] to-[#050d1a] py-6 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <h4 className="text-amber-400 font-semibold mb-3">Regional Meteorological Centre</h4>
            <p className="text-blue-400 leading-relaxed">
              Regional Meteorological Centre, Nagpur<br />
              India Meteorological Department<br />
              Ministry of Earth Sciences<br />
              Government of India
            </p>
          </div>
          <div>
            <h4 className="text-blue-300 font-semibold mb-3">Official Links</h4>
            <div className="space-y-1.5">
              {[
                ['IMD Nagpur', 'https://www.imdnagpur.gov.in'],
                ['Observations', 'https://www.imdnagpur.gov.in/pages/observations.php'],
                ['India Met Dept', 'https://mausam.imd.gov.in'],
                ['Ministry of Earth Sciences', 'https://www.moes.gov.in'],
              ].map(([label, url]) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-400 hover:text-cyan-300 transition-colors">
                  <ChevronRight size={10} />
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-blue-300 font-semibold mb-3">Internship Project</h4>
            <p className="text-blue-400 leading-relaxed">
              Developed as part of Internship Project at<br />
              <strong className="text-amber-300">Regional Meteorological Centre, Nagpur</strong><br />
              <span className="text-cyan-400">25 May 2026 – 30 June 2026</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot"></div>
              <span className="text-green-400 font-medium">WeatherDesk v2.5.1 • MVP Prototype</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-900/30 text-center text-[10px] text-blue-600">
          © 2026 Regional Meteorological Centre, Nagpur | India Meteorological Department | Ministry of Earth Sciences | Government of India
        </div>
      </div>
    </footer>
  );
}

export default function AppWrapper() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDarkMode } = useTheme();

  // Observations Data State
  const [realTimeData, setRealTimeData] = useState([]);
  const [observedDates, setObservedDates] = useState({ maxDate: '', minDate: '' });
  const [regionTitle, setRegionTitle] = useState('Vidarbha Region (Maharashtra)');
  const [observationsLoading, setObservationsLoading] = useState(true);

  const fetchObservationsData = async () => {
    try {
      setObservationsLoading(true);
      const response = await fetch('/proxy-rmc/pages/observations.php');
      const htmlText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      
      // Find all rows with bgcolor="#ffffee" which are the data rows
      const rows = doc.querySelectorAll('tr[bgcolor="#ffffee"]');
      
      // Extract "Observed On" dates from the 3rd header row
      const headerRows = doc.querySelectorAll('tr[bgcolor="#d9edf7"]');
      let maxDate = '';
      let minDate = '';
      if (headerRows.length >= 3) {
        const dateRow = headerRows[2];
        const dateCells = dateRow.querySelectorAll('td');
        if (dateCells.length >= 2) {
          maxDate = dateCells[0]?.textContent.trim() || '';
          minDate = dateCells[1]?.textContent.trim() || '';
        }
      }
      setObservedDates({ maxDate, minDate });
      
      // Extract region title
      let title = 'Vidarbha Region (Maharashtra)';
      const regionFont = doc.querySelector('font[style*="color:#ee3333"]');
      if (regionFont) {
        title = regionFont.textContent.trim().replace(/:$/, '');
      }
      setRegionTitle(title);
      
      const parsedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return null;
        
        const cityName = cells[0].textContent.trim();
        const mockCity = weatherData.find(c => c.city.toLowerCase() === cityName.toLowerCase()) || weatherData[0];
        
        const parsedMaxTemp = parseFloat(cells[1]?.textContent.trim());
        const parsedMinTemp = parseFloat(cells[4]?.textContent.trim());
        const parsedMaxDep = parseFloat(cells[3]?.textContent.trim());
        const parsedMinDep = parseFloat(cells[6]?.textContent.trim());
        const parsedMaxChange = parseFloat(cells[2]?.textContent.trim());
        
        let trend = 'Steady';
        if (parsedMaxChange > 0) trend = 'Rising';
        else if (parsedMaxChange < 0) trend = 'Falling';
        
        return {
          ...mockCity, // Base data for charts and history
          id: cityName + Math.random(),
          city: cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase(),
          region: 'Vidarbha Region',
          
          // Parsed numeric data for Cards
          maxTemp: !isNaN(parsedMaxTemp) ? parsedMaxTemp : null,
          minTemp: !isNaN(parsedMinTemp) ? parsedMinTemp : null,
          maxDeparture: !isNaN(parsedMaxDep) ? parsedMaxDep : null,
          minDeparture: !isNaN(parsedMinDep) ? parsedMinDep : null,
          humidityMorning: cells[7] ? cells[7].textContent.trim() : '--',
          humidityEvening: cells[8] ? cells[8].textContent.trim() : '--',
          rainfall24hr: cells[9] ? cells[9].textContent.trim() : '0.0',
          trend: trend,
          
          // Raw string data for the exact Table layout
          rawMaxTemp: cells[1] ? cells[1].textContent.trim() : '',
          maxChange: cells[2] ? cells[2].textContent.trim() : '',
          rawMaxDeparture: cells[3] ? cells[3].textContent.trim() : '',
          rawMinTemp: cells[4] ? cells[4].textContent.trim() : '',
          minChange: cells[5] ? cells[5].textContent.trim() : '',
          rawMinDeparture: cells[6] ? cells[6].textContent.trim() : '',
          rh830: cells[7] ? cells[7].textContent.trim() : '',
          rh1730: cells[8] ? cells[8].textContent.trim() : '',
          rf24: cells[9] ? cells[9].textContent.trim() : '',
          rf9: cells[10] ? cells[10].textContent.trim() : ''
        };
      }).filter(Boolean);

      setRealTimeData(parsedData);
    } catch (error) {
      console.error("Failed to fetch observations data", error);
    } finally {
      setObservationsLoading(false);
    }
  };

  useEffect(() => {
    toast.success('WeatherDesk connected to RMC Nagpur data feed', {
      duration: 4000,
      icon: '🛰️',
      style: { background: '#0f2847', color: '#e2e8f0', border: '1px solid #3b82c4' }
    });
    fetchObservationsData();
  }, []);

  return (
    <Router>
      <div className={`h-screen overflow-hidden ${isDarkMode ? '' : 'light-mode'}`}
        style={{ background: isDarkMode ? '#050d1a' : '#f4f7fc', transition: 'background 0.3s ease' }}>
        <Toaster position="top-right" />
        <div className="flex flex-col h-full">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="hidden lg:block flex-shrink-0 h-full">
              <Sidebar isOpen={true} onClose={() => {}} />
            </div>
            {/* Mobile sidebar */}
            <div className="lg:hidden">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
              <main className="flex-1 overflow-auto">
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/observations" element={
                      <Observations
                        realTimeData={realTimeData}
                        observedDates={observedDates}
                        regionTitle={regionTitle}
                        loading={observationsLoading}
                        onRefresh={fetchObservationsData}
                      />
                    } />
                    <Route path="/forecast" element={<Forecast />} />
                    <Route path="/rainfall-observation" element={<RainfallObservationPage />} />
                    <Route path="/rainfall-report" element={<RainfallReport />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/chatbot" element={<Chatbot />} />
                    <Route path="/admin" element={<Admin />} />
                  </Routes>
                </AnimatePresence>
                <Footer />
              </main>
            </div>
          </div>
        </div>
      </div>
    </Router>
  );
}


