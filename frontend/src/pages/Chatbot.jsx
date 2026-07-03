import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Zap, CloudRain, Thermometer, AlertTriangle, MapPin, Wind } from 'lucide-react';
import { fetchLiveWeather } from '../services/api';
import { chatbotResponses } from '../data/weatherData';
import { useTheme } from '../context/ThemeContext';

const quickActions = [
  { label: "Today's Weather", key: 'today', icon: Thermometer },
  { label: '7-Day Forecast', key: 'forecast', icon: CloudRain },
  { label: 'Rainfall Data', key: 'rainfall', icon: CloudRain },
  { label: 'Active Alerts', key: 'alerts', icon: AlertTriangle },
];

const initialMessages = [
  {
    id: 1,
    role: 'bot',
    text: `🌤️ **Welcome to RMC Weather Assistant**

I'm your AI-powered meteorological assistant for Regional Meteorological Centre, Nagpur.

I can help you with:
• Current weather observations across Central India
• Extended range forecasts (2/5/7 days)
• Heatwave & rainfall alerts
• District-wise weather analysis
• IMD weather bulletins

What would you like to know today?`,
    time: new Date(),
  }
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
        <Bot size={14} className="text-white" />
      </div>
      <div className="chat-bubble-bot px-4 py-3 max-w-xs">
        <div className="flex gap-1.5 items-center py-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ y: [-3, 0, -3] }}
              transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-blue-400"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isBot = msg.role === 'bot';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isBot
          ? 'bg-gradient-to-br from-blue-500 to-cyan-400'
          : 'bg-gradient-to-br from-purple-500 to-blue-600'
      }`}>
        {isBot ? <Bot size={14} className="text-white" /> : <User size={14} className="text-white" />}
      </div>
      <div className={`max-w-sm md:max-w-md px-4 py-3 text-sm leading-relaxed ${
        isBot ? 'chat-bubble-bot' : 'chat-bubble-user'
      }`}>
        <div className="whitespace-pre-wrap text-white" dangerouslySetInnerHTML={{
          __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />
        <p className="text-[10px] mt-1.5 opacity-50">
          {msg.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

function parseQuery(query, liveData) {
  const q = query.toLowerCase();
  if (q.includes('today') || q.includes('current') || q.includes('now') || q.includes('temperature')) return 'today';
  if (q.includes('forecast') || q.includes('week') || q.includes('day') || q.includes('predict')) return 'forecast';
  if (q.includes('rain') || q.includes('monsoon') || q.includes('precipitation')) return 'rainfall';
  if (q.includes('alert') || q.includes('warning') || q.includes('heatwave') || q.includes('danger')) return 'alerts';

  // City-specific
  const city = liveData.find(c => q.includes(c.city.toLowerCase()));
  if (city) {
    return `city:${city.city}`;
  }

  return 'general';
}

function getBotResponse(query, liveData) {
  if (!liveData || liveData.length === 0) {
    return {
      text: "I am still loading live data from the IMD servers. Please try again in a moment.",
      suggestions: ["Today's Weather"]
    };
  }

  const key = parseQuery(query, liveData);

  if (key.startsWith('city:')) {
    const cityName = key.split(':')[1];
    const city = liveData.find(c => c.city === cityName);
    if (city) {
      return {
        text: `📍 **${city.city}, ${city.region}**

🌡️ **Temperature**: Max ${city.temperature.max ?? '--'}°C / Min ${city.temperature.min ?? '--'}°C
💧 **Humidity**: ${city.humidity.morning ?? '--'}% (Morning) / ${city.humidity.evening ?? '--'}% (Evening)
🌧️ **Rainfall (24h)**: ${city.rainfall.last24h} mm
📈 **Trend**: ${city.analysis.trend}
⚠️ **Alert Level**: ${city.analysis.alertLevel}

${city.temperature.maxDeparture != null ? `📊 **Departure from Normal**: ${city.temperature.maxDeparture > 0 ? '+' : ''}${city.temperature.maxDeparture}°C` : ''}`,
        suggestions: ["Today's Weather", 'Rainfall Data', 'Active Alerts', '7-Day Forecast'],
      };
    }
  }

  if (key === 'today' || key === 'alerts') {
    const activeAlerts = liveData.filter(c => c.analysis.alertLevel !== 'GREEN');
    return {
      text: `Based on live data across Vidarbha:

${activeAlerts.length > 0 ? `⚠️ **${activeAlerts.length} Active Alerts Found:**\n${activeAlerts.map(c => `• **${c.city}**: ${c.analysis.alertLevel} Alert (${c.temperature.max}°C)`).join('\n')}` : '✅ No active heatwave alerts currently.'}

I can give you specific details for any city if you ask!`,
      suggestions: ["Nagpur weather", "Rainfall Data"]
    };
  }

  if (key === 'rainfall') {
    const topRain = [...liveData].sort((a,b) => b.rainfall.last24h - a.rainfall.last24h)[0];
    return {
      text: `🌧️ **Rainfall Update**
Highest rainfall in the last 24h was recorded at **${topRain.city}** (${topRain.rainfall.last24h} mm).

Ask about a specific city for local data.`,
      suggestions: ["Today's Weather"]
    }
  }

  if (key === 'general') {
    return {
      text: `I can provide weather information for the following cities based on our live mock data:

**Vidarbha Region**: ${liveData.map(c => c.city).join(', ')}

Just type a city name or ask about weather conditions, forecasts, or alerts!`,
      suggestions: ["Nagpur weather", "Active Alerts", "Today's Weather", '7-Day Forecast'],
    };
  }

  const response = chatbotResponses[key];
  if (response) return response;

  return {
    text: `I don't have specific data for that query. Please try asking about:\n• A specific city's weather\n• Today's conditions\n• Rainfall data\n• Active weather alerts\n• The 7-day forecast`,
    suggestions: ["Today's Weather", '7-Day Forecast', 'Active Alerts'],
  };
}

export default function Chatbot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const bottomRef = useRef(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    fetchLiveWeather().then(data => setLiveData(data));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMsg = { id: Date.now(), role: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const response = getBotResponse(text, liveData);
    const botMsg = {
      id: Date.now() + 1,
      role: 'bot',
      text: response.text,
      suggestions: response.suggestions,
      time: new Date(),
    };

    setIsTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full"
      style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-blue-900/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center glow-teal">
              <Bot size={20} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-900 pulse-dot" />
          </div>
          <div>
            <h2 className="text-white font-bold">RMC Weather Assistant</h2>
            <p className="text-green-400 text-xs font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block pulse-dot" />
              Online — Connected to Live API
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[10px] text-blue-400">
            <Zap size={11} className="text-amber-400" />
            AI-Assisted Weather Intelligence
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-2 border-b border-blue-900/20 flex gap-2 overflow-x-auto">
        {quickActions.map(({ label, key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => sendMessage(label)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-light border border-blue-700/30 text-xs text-blue-300 hover:text-white hover:border-blue-500/50 transition-all whitespace-nowrap"
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id}>
            <ChatMessage msg={msg} />
            {msg.suggestions && (
              <div className="ml-10 mt-2 flex flex-wrap gap-1.5">
                {msg.suggestions.map((sug, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => sendMessage(sug)}
                    className="px-2.5 py-1 rounded-full text-[10px] text-cyan-300 hover:text-white transition-all"
                    style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}
                  >
                    {sug}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        ))}

        <AnimatePresence>
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-blue-900/30">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about weather, forecasts, alerts... (e.g. 'Nagpur weather')"
            className="flex-1 px-4 py-2.5 rounded-xl glass border border-blue-700/30 text-sm placeholder-blue-500 outline-none focus:border-blue-500/60 transition-colors chatbot-input"
            style={{ background: isDarkMode ? 'rgba(15,40,71,0.6)' : 'rgba(241,245,249,0.8)', color: isDarkMode ? 'white' : '#1e293b' }}
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!input.trim() || isTyping || liveData.length === 0}
            className="px-4 py-2.5 rounded-xl font-medium text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #2563a8 0%, #06b6d4 100%)' }}
          >
            <Send size={16} />
          </motion.button>
        </form>
        <p className="text-[10px] text-blue-600 text-center mt-2">
          Powered by RMC Nagpur observational data • Not for operational use • Educational/Demo only
        </p>
      </div>
    </motion.div>
  );
}
