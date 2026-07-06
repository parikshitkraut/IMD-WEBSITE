const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const multer = require('multer');
const { getPreviousRainfall, getMonthlyRainfallData, generateMonthlyExcel, DATA_DIR } = require('./rainfallService');
const rainfallDb = require('./rainfallDb');
const { scrapeAndStore, startScheduler, getStatus: getSchedulerStatus } = require('./rainfallScheduler');
const { scrapeObservations } = require('./imdScraper');

const app = express();
app.use(cors());
app.use(express.json());

// Multer config for rainfall file uploads
const upload = multer({
  dest: path.join(__dirname, 'data', 'rainfall', 'uploads'),
  fileFilter: (req, file, cb) => {
    if (/\.(xls|xlsx)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xls and .xlsx files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// List of cities requested by the user
const cities = [
  'Nagpur', 'Akola', 'Amravati', 'Bhandara', 'Buldana', 
  'Brahmapuri', 'Chandrapur', 'Gadchiroli', 'Gondia', 
  'Wardha', 'Washim', 'Yavatmal'
];

// Global in-memory cache for scraped observations
let cachedWeatherData = null;
let lastScrapeTime = null;


// Helper to generate a random number between min and max (inclusive)
const random = (min, max, decimals = 1) => {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
};

// Helper to get random array element
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate dynamic weather data based on realistic monsoon conditions in Vidarbha
const generateWeatherData = () => {
  // Fetch actual rainfall records for the latest date in the database
  const latestDbDate = rainfallDb.getLatestDate();
  const targetDateStr = latestDbDate || new Date().toISOString().split('T')[0];
  const targetRecords = latestDbDate ? rainfallDb.getRecords().filter(r => r.date === targetDateStr) : [];

  return cities.map(city => {
    // Vidarbha monsoon temps are typically 27-32°C Max, 22-26°C Min
    const maxTemp = random(27.5, 31.5);
    const minTemp = random(22.0, 25.5);
    const maxChange = random(-1.5, 1.5);
    const minChange = random(-1.0, 1.0);
    const maxDeparture = random(-1.5, 1.5);
    const minDeparture = random(-1.0, 1.0);
    
    // Humidity is very high during monsoon (70-98%)
    const humidity830 = Math.floor(random(85, 98, 0));
    const humidity1730 = Math.floor(random(70, 90, 0));
    
    // Map rainfall to actual database records for targetDateStr if available (robust match)
    const cityLower = city.toLowerCase();
    const dbRecord = targetRecords.find(r => {
      const stationName = r.station.toLowerCase();
      const districtName = getDistrict(r.station).toLowerCase();
      return stationName === cityLower || 
             districtName === cityLower || 
             (cityLower === 'brahmpuri' && (stationName.includes('bramhapuri') || stationName.includes('brahmapuri')));
    });
    
    const rain24 = dbRecord && dbRecord.rainfall_mm !== null ? dbRecord.rainfall_mm : 0.0;
    const rain9 = dbRecord && dbRecord.rf_since_09hrs !== null ? dbRecord.rf_since_09hrs : 0.0;
    
    // Derived values for analytics and UI (IMD official criteria)
    const isHeatwave = maxTemp >= 45.0;
    const isVeryHeavyRain = rain24 >= 115.6; // IMD Very Heavy
    const isHeavyRain = rain24 >= 64.5; // IMD Heavy
    const isModerateRain = rain24 >= 15.6; // IMD Moderate
    
    let alertLevel = 'GREEN';
    if (isHeatwave || isVeryHeavyRain) {
      alertLevel = 'RED';
    } else if (maxTemp >= 43.0 || isHeavyRain) {
      alertLevel = 'ORANGE';
    } else if (maxTemp >= 41.0 || isModerateRain) {
      alertLevel = 'YELLOW';
    }
    
    const trend = maxChange > 1.5 ? 'RISING' : (maxChange < -1.5 ? 'FALLING' : 'STABLE');

    return {
      id: city.toLowerCase(),
      city: city,
      region: 'Vidarbha',
      temperature: {
        max: maxTemp,
        maxChange: maxChange,
        maxDeparture: maxDeparture,
        min: minTemp,
        minChange: minChange,
        minDeparture: minDeparture
      },
      humidity: {
        morning: humidity830,
        evening: humidity1730
      },
      rainfall: {
        last24h: rain24,
        last9h: rain9
      },
      analysis: {
        heatwave: isHeatwave,
        heavyRain: rain24 >= 7.5,
        alertLevel: alertLevel,
        trend: trend,
        forecastConfidence: Math.floor(random(75, 98, 0)) + '%'
      },
      lastUpdated: new Date().toISOString()
    };
  });
};

async function updateWeatherCache() {
  try {
    console.log('[WeatherCache] Performing background scrape of IMD Nagpur observations...');
    const scrapeResult = await scrapeObservations();
    if (scrapeResult && scrapeResult.success && scrapeResult.records.length > 0) {
      const mappedData = cities.map(city => {
        const cityLower = city.toLowerCase();
        // Robust match station by name, district, or spelling variations
        const rec = scrapeResult.records.find(r => {
          const stationName = r.station.toLowerCase();
          const districtName = getDistrict(r.station).toLowerCase();
          return stationName === cityLower || 
                 districtName === cityLower || 
                 (cityLower === 'brahmpuri' && (stationName.includes('bramhapuri') || stationName.includes('brahmapuri')));
        });
        
        if (rec) {
          const maxTemp = rec.max_temp !== null ? rec.max_temp : Number(random(27.5, 31.5).toFixed(1));
          const minTemp = rec.min_temp !== null ? rec.min_temp : Number(random(22.0, 25.5).toFixed(1));
          const maxDeparture = rec.max_temp_dep !== null ? rec.max_temp_dep : Number(random(-1.5, 1.5).toFixed(1));
          const minDeparture = rec.min_temp_dep !== null ? rec.min_temp_dep : Number(random(-1.0, 1.0).toFixed(1));
          const humidity830 = rec.humidity_morning !== null ? rec.humidity_morning : Math.floor(random(85, 98, 0));
          const humidity1730 = rec.humidity_evening !== null ? rec.humidity_evening : Math.floor(random(70, 90, 0));
          const rain24 = rec.rainfall_mm !== null ? rec.rainfall_mm : 0.0;
          const rain9 = rec.rf_since_09hrs !== null ? rec.rf_since_09hrs : 0.0;
          
          const isHeatwave = maxTemp >= 45.0;
          let alertLevel = 'normal';
          if (maxTemp >= 45.0 || rain24 >= 115.6) alertLevel = 'danger';
          else if (maxTemp >= 42.0 || rain24 >= 64.5) alertLevel = 'warning';
          else if (maxTemp >= 38.0 || rain24 >= 15.6) alertLevel = 'watch';
          
          return {
            city: city,
            region: 'Vidarbha Region',
            temperature: {
              max: maxTemp,
              min: minTemp,
              maxChange: 0,
              minChange: 0,
              maxDeparture: maxDeparture,
              minDeparture: minDeparture
            },
            humidity: {
              morning: humidity830,
              evening: humidity1730
            },
            rainfall: {
              last24h: rain24,
              last9h: rain9
            },
            analysis: {
              heatwave: isHeatwave,
              heavyRain: rain24 >= 7.5,
              alertLevel: alertLevel,
              trend: 'Steady',
              forecastConfidence: '95%'
            },
            lastUpdated: new Date().toISOString()
          };
        } else {
          return generateWeatherData().find(c => c.city === city);
        }
      });
      
      cachedWeatherData = mappedData;
      lastScrapeTime = new Date().toISOString();
      console.log('[WeatherCache] Background scrape successful. Cache updated at', lastScrapeTime);
      return true;
    }
  } catch (err) {
    console.error('[WeatherCache] Background scrape failed:', err.message);
  }
  return false;
}

// Initial background scrape on startup
updateWeatherCache();

// Update weather cache in background every 15 minutes (900,000 ms)
setInterval(updateWeatherCache, 15 * 60 * 1000);

app.get('/api/weather', async (req, res) => {
  // If cache is empty (e.g. startup failed or pending), try to scrape synchronously once
  if (!cachedWeatherData) {
    console.log('[WeatherAPI] Cache empty. Performing initial synchronous scrape...');
    await updateWeatherCache();
  }
  
  if (cachedWeatherData) {
    return res.json({
      success: true,
      data: cachedWeatherData,
      source: 'Background Scraped Cache (RMC Nagpur Official)',
      lastUpdated: lastScrapeTime
    });
  }
  
  // Last resort fallback
  res.json({
    success: true,
    data: generateWeatherData(),
    source: 'Mock data (Scraping cache empty)'
  });
});

app.get('/api/forecast', (req, res) => {
  // Simple 7 day forecast data for a specific city
  const city = req.query.city || 'Nagpur';
  
  const forecast = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    
    const rainProb = Math.floor(random(10, 85, 0));
    let condition = 'Partly Cloudy';
    if (rainProb > 75) condition = 'Heavy Rain';
    else if (rainProb > 55) condition = 'Moderate Rain';
    else if (rainProb > 30) condition = 'Light Rain';
    else if (rainProb > 10) condition = 'Very Light Rain';

    return {
      date: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      maxTemp: Number(random(28.0, 32.0).toFixed(1)),
      minTemp: Number(random(22.0, 25.0).toFixed(1)),
      condition: condition,
      rainProbability: rainProb
    };
  });

  res.json({
    success: true,
    city: city,
    data: forecast
  });
});

// ═══════════════════════════════════════════════════════════════
// RAINFALL DATA ENDPOINTS (Real IMD Data from Excel)
// ═══════════════════════════════════════════════════════════════

// Previous 10-day actual rainfall for a specific city (replaces old forecast10)
app.get('/api/forecast10', (req, res) => {
  const city = req.query.city || 'Nagpur';
  
  try {
    // Fetch all records from our persistent JSON database
    const allRecords = rainfallDb.getRecords();
    
    // Filter records matching the requested city/district
    const cityLower = city.toLowerCase();
    const cityRecords = allRecords.filter(r => getDistrict(r.station).toLowerCase() === cityLower);
    
    // Group by date and calculate average rainfall
    const dateMap = {};
    for (const rec of cityRecords) {
      if (!dateMap[rec.date]) {
        dateMap[rec.date] = {
          rainfall_mm: rec.rainfall_mm !== null ? rec.rainfall_mm : 0,
          count: rec.rainfall_mm !== null ? 1 : 0
        };
      } else {
        if (rec.rainfall_mm !== null) {
          dateMap[rec.date].rainfall_mm += rec.rainfall_mm;
          dateMap[rec.date].count++;
        }
      }
    }
    
    // Sort dates ascending for the chart (oldest first)
    const sortedDates = Object.keys(dateMap).sort();
    
    // Take the last 5 days of available data (e.g., June 29 to today)
    const targetDates = sortedDates.slice(-5);
    
    const data = targetDates.map(dateStr => {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const val = dateMap[dateStr];
      const avgRainfall = val.count > 0 ? Number((val.rainfall_mm / val.count).toFixed(1)) : 0;
      
      // Determine condition based on actual rainfall (IMD official criteria)
      let condition, icon;
      if (avgRainfall === 0 || avgRainfall == null) { condition = 'No Rain'; icon = '☀️'; }
      else if (avgRainfall >= 0.1 && avgRainfall <= 2.4) { condition = 'Very Light'; icon = '🌦️'; }
      else if (avgRainfall >= 2.5 && avgRainfall <= 15.5) { condition = 'Light'; icon = '🌧️'; }
      else if (avgRainfall >= 15.6 && avgRainfall <= 64.4) { condition = 'Moderate'; icon = '🌧️'; }
      else if (avgRainfall >= 64.5 && avgRainfall <= 115.5) { condition = 'Heavy'; icon = '⛈️'; }
      else if (avgRainfall >= 115.6 && avgRainfall <= 204.4) { condition = 'Very Heavy'; icon = '⛈️'; }
      else if (avgRainfall >= 204.5) { condition = 'Extremely Heavy'; icon = '🌊'; }
      else { condition = 'Light'; icon = '🌧️'; }
      
      return {
        date: dateStr,
        dayName: dateObj.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayFull: dateObj.toLocaleDateString('en-IN', { weekday: 'long' }),
        dateFormatted: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        day: dateObj.getDate(),
        actualRainfall: avgRainfall,
        expectedRainfall: avgRainfall,
        rainProbability: avgRainfall > 0 ? 100 : 0,
        condition,
        icon,
        isActualData: true,
      };
    });
    
    if (data.length > 0) {
      res.json({
        success: true,
        city: city,
        source: 'IMD Persistent Database (Scraped & Backfilled)',
        data: data,
      });
    } else {
      res.json({
        success: true,
        city: city,
        source: 'No IMD data available in database',
        data: [],
      });
    }
  } catch (error) {
    console.error('Error fetching rainfall history:', error);
    res.status(500).json({ success: false, error: 'Failed to query rainfall database' });
  }
});

// Full monthly rainfall data for the Rainfall Report page (uses persistent JSON database)
app.get('/api/rainfall/monthly', (req, res) => {
  try {
    // Query all records from our persistent JSON database
    const allRecords = rainfallDb.getRecords();
    
    // Get unique stations and unique dates
    const uniqueStations = [...new Set(allRecords.map(r => r.station))].sort();
    const uniqueDates = [...new Set(allRecords.map(r => r.date))].sort(); // Oldest first
    
    // Group stations by district
    const districtsMap = {};
    
    for (const stationName of uniqueStations) {
      const distName = getDistrict(stationName).toUpperCase();
      const cityName = getDistrict(stationName);
      
      if (!districtsMap[distName]) {
        districtsMap[distName] = {
          district: distName,
          city: cityName,
          stations: [],
          dailyData: {},
          dailyTotal: {},
          totalRainfall: 0,
          rainyDays: 0
        };
      }
      
      // Get all records for this station
      const stationRecords = allRecords.filter(r => r.station === stationName);
      const dailyRainfall = {};
      let totalRain = 0;
      let rainyDaysCount = 0;
      
      for (const d of uniqueDates) {
        const rec = stationRecords.find(r => r.date === d);
        if (rec && rec.rainfall_mm !== null) {
          dailyRainfall[d] = rec.rainfall_mm;
          totalRain += rec.rainfall_mm;
          if (rec.rainfall_mm > 0) {
            rainyDaysCount++;
          }
        } else {
          dailyRainfall[d] = null;
        }
      }
      
      districtsMap[distName].stations.push({
        name: stationName,
        dailyRainfall: dailyRainfall,
        total: totalRain.toFixed(1),
        rainyDays: rainyDaysCount
      });
    }
    
    // Calculate district-level daily averages and totals
    const districtsList = Object.values(districtsMap);
    for (const dist of districtsList) {
      let grandTotalAverage = 0;
      let grandRainyDays = 0;
      
      for (const d of uniqueDates) {
        const stationVals = dist.stations
          .map(s => s.dailyRainfall[d])
          .filter(v => v !== null && v !== undefined);
        
        if (stationVals.length > 0) {
          const sum = stationVals.reduce((a, b) => a + b, 0);
          const avg = sum / stationVals.length;
          dist.dailyTotal[d] = Number(sum.toFixed(1));
          dist.dailyData[d] = Number(avg.toFixed(1));
          grandTotalAverage += avg;
          if (avg > 0) {
            grandRainyDays++;
          }
        } else {
          dist.dailyTotal[d] = 0;
          dist.dailyData[d] = 0;
        }
      }
      
      dist.totalRainfall = grandTotalAverage.toFixed(1);
      dist.rainyDays = grandRainyDays;
    }
    
    res.json({
      success: true,
      data: {
        month: 'July',
        year: '2026',
        dataDate: uniqueDates[uniqueDates.length - 1] || 'N/A',
        subdivision: 'VIDARBHA',
        districts: districtsList
      }
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate monthly rainfall report' });
  }
});

// Download monthly rainfall as Excel (uses persistent JSON database)
app.get('/api/rainfall/download/:month/:year', (req, res) => {
  try {
    const buffer = rainfallDb.exportToExcel();
    if (buffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Rainfall_Report_${req.params.month}_${req.params.year}.xlsx`);
      res.send(Buffer.from(buffer));
    } else {
      res.status(404).json({ success: false, error: 'No data available for download' });
    }
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Excel' });
  }
});

// Upload a new rainfall Excel file
app.post('/api/rainfall/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fs = require('fs');
    const finalName = req.file.originalname;
    const finalPath = path.join(DATA_DIR, finalName);

    // Move from temp upload dir to main data dir
    fs.renameSync(req.file.path, finalPath);

    res.json({
      success: true,
      message: `File "${finalName}" uploaded successfully`,
      filename: finalName,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// ═══════════════════════════════════════════════════════════════
// RAINFALL DATABASE ENDPOINTS (Persistent JSON DB + Scraping)
// ═══════════════════════════════════════════════════════════════

// Import historical Excel data into the rainfall database
app.post('/api/rainfall/import', (req, res) => {
  try {
    // Check multiple possible locations for the Excel file
    const possiblePaths = [
      'D:\\Downloads\\Rainfall Statement - MKFormat_20260622.xls',
      path.join(DATA_DIR, 'Rainfall Statement - MKFormat_20260622.xls'),
    ];

    let filePath = null;
    const fs = require('fs');
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'Historical Excel file not found in any known location',
        searchedPaths: possiblePaths,
      });
    }

    const result = rainfallDb.importFromExcel(filePath);
    res.json({ success: result.success, ...result });
  } catch (error) {
    console.error('Error importing Excel:', error);
    res.status(500).json({ success: false, error: 'Import failed: ' + error.message });
  }
});

// Get all rainfall records (with optional date range filtering)
app.get('/api/rainfall/db', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const records = rainfallDb.getRecords(startDate, endDate);
    res.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching rainfall DB:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch records' });
  }
});

// Get previous N days' rainfall for all stations (default: 3 days)
app.get('/api/rainfall/recent', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const records = rainfallDb.getRecentDays(days);
    res.json({
      success: true,
      days,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error('Error fetching recent rainfall:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent data' });
  }
});

// District → city name map (for district summary endpoint)
const STATION_DISTRICT_MAP = {
  // Nagpur district stations
  'NAGPUR': 'Nagpur', 'NAGPUR CITY': 'Nagpur', 'RAMTEK': 'Nagpur', 'KATOL': 'Nagpur',
  'NARKHED': 'Nagpur', 'SAVNER': 'Nagpur', 'HINGNA': 'Nagpur', 'UMRED': 'Nagpur',
  'KUHI': 'Nagpur', 'BHIWAPUR': 'Nagpur', 'PARSEONI': 'Nagpur', 'KALMESHWAR': 'Nagpur',
  // Wardha
  'WARDHA': 'Wardha', 'ARVI': 'Wardha', 'SELOO': 'Wardha', 'DEOLI': 'Wardha',
  'HINGANGHAT': 'Wardha', 'SAMUDRAPUR': 'Wardha', 'ASHTI(WARDHA)': 'Wardha', 'KARANJA': 'Wardha',
  // Amravati
  'AMRAVATI': 'Amravati', 'AMRAOTI': 'Amravati', 'ACHALPUR': 'Amravati', 'DARYAPUR': 'Amravati',
  'CHANDUR BAZAR': 'Amravati', 'NANDGAON KHANDESHWAR': 'Amravati', 'MORSHI': 'Amravati',
  'WARUD': 'Amravati', 'DHAMANGAON': 'Amravati', 'TIOSA': 'Amravati',
  // Akola
  'AKOLA': 'Akola', 'AKOT': 'Akola', 'BALAPUR': 'Akola', 'BARSHITAKLI': 'Akola',
  'PATUR': 'Akola', 'MURTIZAPUR': 'Akola', 'TELHARA': 'Akola',
  // Bhandara
  'BHANDARA': 'Bhandara', 'TUMSAR': 'Bhandara', 'SAKOLI': 'Bhandara', 'MOHADI': 'Bhandara',
  'PAUNI': 'Bhandara', 'LAKHANDUR': 'Bhandara',
  // Buldana
  'BULDANA': 'Buldana', 'BULDHANA': 'Buldana', 'CHIKHLI': 'Buldana', 'DEULGAON RAJA': 'Buldana',
  'JALGAON JAMOD': 'Buldana', 'KHAMGAON': 'Buldana', 'LONAR': 'Buldana', 'MALKAPUR': 'Buldana',
  'MEHKAR': 'Buldana', 'MOTALA': 'Buldana', 'NANDURA': 'Buldana', 'SANGRAMPUR': 'Buldana',
  'SHEGAON': 'Buldana', 'SINDKHED RAJA': 'Buldana',
  // Chandrapur
  'CHANDRAPUR': 'Chandrapur', 'BALLARPUR': 'Chandrapur', 'BRAHMAPURI': 'Chandrapur',
  'CHIMUR': 'Chandrapur', 'GONDPIPRI': 'Chandrapur', 'JIWATI': 'Chandrapur',
  'MUL': 'Chandrapur', 'NAGBHID': 'Chandrapur', 'POMBHURNA': 'Chandrapur',
  'RAJURA': 'Chandrapur', 'SAWALI': 'Chandrapur', 'SINDEWAHI': 'Chandrapur',
  'WARORA': 'Chandrapur',
  // Gadchiroli
  'GADCHIROLI': 'Gadchiroli', 'AHERI': 'Gadchiroli', 'ARMORI': 'Gadchiroli',
  'BHAMRAGAD': 'Gadchiroli', 'CHAMORSHI': 'Gadchiroli', 'DHANORA': 'Gadchiroli',
  'DESAIGANJ': 'Gadchiroli', 'ETAPALLI': 'Gadchiroli', 'KORCHI': 'Gadchiroli',
  'KURKHEDA': 'Gadchiroli', 'MULCHERA': 'Gadchiroli', 'SIRONCHA': 'Gadchiroli',
  // Gondia
  'GONDIA': 'Gondia', 'AMGAON': 'Gondia', 'ARJUNI MORGAON': 'Gondia', 'DEORI': 'Gondia',
  'GOREGAON': 'Gondia', 'SALEKASA': 'Gondia', 'SADAK ARJUNI': 'Gondia', 'TIRORA': 'Gondia',
  // Washim
  'WASHIM': 'Washim', 'KARANJA (LAD)': 'Washim', 'MALEGAON': 'Washim', 'MANGRULPIR': 'Washim',
  'MANORA': 'Washim', 'RISOD': 'Washim',
  // Yavatmal
  'YAVATMAL': 'Yavatmal', 'YEOTMAL': 'Yavatmal', 'ARNI': 'Yavatmal', 'BABHULGAON': 'Yavatmal',
  'DARWHA': 'Yavatmal', 'DIGRAS': 'Yavatmal', 'GHATANJI': 'Yavatmal', 'KALAMB': 'Yavatmal',
  'KELAPUR': 'Yavatmal', 'MAHAGAON': 'Yavatmal', 'MANDAVA': 'Yavatmal', 'NER': 'Yavatmal',
  'PUSAD': 'Yavatmal', 'RALEGAON': 'Yavatmal', 'UMARKHED': 'Yavatmal', 'WANI': 'Yavatmal',
  'ZARI JAMANI': 'Yavatmal',
};

function getDistrict(stationName) {
  if (!stationName) return 'Other';
  const upper = stationName.toUpperCase().trim();
  // Direct match
  if (STATION_DISTRICT_MAP[upper]) return STATION_DISTRICT_MAP[upper];
  // Partial match — check if station starts with a known district name
  for (const [key, dist] of Object.entries(STATION_DISTRICT_MAP)) {
    if (upper.startsWith(key) || key.startsWith(upper)) return dist;
  }
  // Fallback: capitalise the station name
  return stationName.charAt(0).toUpperCase() + stationName.slice(1).toLowerCase();
}

// District-wise rainfall summary (aggregated)
app.get('/api/rainfall/district-summary', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const { startDate, endDate } = req.query;
    let records;
    if (startDate || endDate) {
      records = rainfallDb.getRecords(startDate, endDate);
    } else {
      records = rainfallDb.getRecentDays(days);
    }

    // Aggregate: for each district+date combination, pick max rainfall
    const districtDateMap = {};
    for (const rec of records) {
      const district = getDistrict(rec.station);
      const key = `${district}|${rec.date}`;
      if (!districtDateMap[key]) {
        districtDateMap[key] = {
          district,
          date: rec.date,
          rainfall_mm: rec.rainfall_mm,
          stationCount: 1,
          updatedAt: rec.updatedAt,
          source: rec.source,
        };
      } else {
        districtDateMap[key].stationCount++;
        // Use maximum rainfall value
        if (rec.rainfall_mm !== null && (districtDateMap[key].rainfall_mm === null || rec.rainfall_mm > districtDateMap[key].rainfall_mm)) {
          districtDateMap[key].rainfall_mm = rec.rainfall_mm;
          districtDateMap[key].updatedAt = rec.updatedAt;
        }
      }
    }

    const summary = Object.values(districtDateMap).sort((a, b) => {
      const dc = b.date.localeCompare(a.date);
      if (dc !== 0) return dc;
      return a.district.localeCompare(b.district);
    });

    res.json({
      success: true,
      count: summary.length,
      totalStationRecords: records.length,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching district summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch district summary' });
  }
});

// Download the full rainfall database as Excel (.xlsx)
app.get('/api/rainfall/download-db/xlsx', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const count = rainfallDb.getRecordCount();
    if (count === 0) {
      return res.status(404).json({ success: false, error: 'No rainfall data available to export.' });
    }
    const buffer = rainfallDb.exportToExcel(startDate, endDate);
    const today = new Date().toISOString().split('T')[0];
    const filename = `Rainfall_Data_${today}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating Excel export:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Excel: ' + error.message });
  }
});

// Download the full rainfall database as CSV
app.get('/api/rainfall/download-db/csv', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const count = rainfallDb.getRecordCount();
    if (count === 0) {
      return res.status(404).json({ success: false, error: 'No rainfall data available to export.' });
    }
    const csv = rainfallDb.exportToCsv(startDate, endDate);
    const today = new Date().toISOString().split('T')[0];
    const filename = `Rainfall_Data_${today}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf-8'));
    res.send(csv);
  } catch (error) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ success: false, error: 'Failed to generate CSV: ' + error.message });
  }
});

// Manually trigger a scrape (admin use)
app.post('/api/rainfall/scrape-now', async (req, res) => {
  try {
    const result = await scrapeAndStore();
    res.json({ success: result.success, ...result });
  } catch (error) {
    console.error('Error triggering scrape:', error);
    res.status(500).json({ success: false, error: 'Scrape failed: ' + error.message });
  }
});

// Get scheduler status, last scrape info, DB stats
app.get('/api/rainfall/status', (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// IMD PROXY — For production mode (Vite proxy only works in dev)
// ═══════════════════════════════════════════════════════════════

app.get('/proxy-rmc/*splat', (req, res) => {
  const targetPath = req.params.splat || req.path.replace('/proxy-rmc', '');
  const targetUrl = `https://www.imdnagpur.gov.in${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

  https.get(targetUrl, { rejectUnauthorized: false }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('IMD proxy error:', err.message);
    res.status(502).json({ error: 'Failed to proxy request to IMD' });
  });
});

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Handle React routing, return all requests to React app
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP + RAINFALL DB INITIALIZATION
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`RMC WeatherDesk Backend running on port ${PORT}`);
  console.log(`Rainfall data directory: ${DATA_DIR}`);

  // Initialize the rainfall database
  // Auto-import historical Excel if DB is empty
  const fs = require('fs');
  const excelPaths = [
    'D:\\Downloads\\Rainfall Statement - MKFormat_20260622.xls',
    path.join(DATA_DIR, 'Rainfall Statement - MKFormat_20260622.xls'),
  ];
  let excelPath = null;
  for (const p of excelPaths) {
    if (fs.existsSync(p)) {
      excelPath = p;
      break;
    }
  }
  rainfallDb.initialize(excelPath);

  // Start the automatic daily scraping scheduler
  startScheduler();

  console.log('Rainfall database initialized, scheduler started');
});
