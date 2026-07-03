const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const multer = require('multer');
const { getPreviousRainfall, getMonthlyRainfallData, generateMonthlyExcel, DATA_DIR } = require('./rainfallService');
const rainfallDb = require('./rainfallDb');
const { scrapeAndStore, startScheduler, getStatus: getSchedulerStatus } = require('./rainfallScheduler');

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

// Helper to generate a random number between min and max (inclusive)
const random = (min, max, decimals = 1) => {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
};

// Helper to get random array element
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate dynamic weather data based on realistic summer conditions in Vidarbha
const generateWeatherData = () => {
  return cities.map(city => {
    // Vidarbha summer temps are typically 40-47°C Max, 25-32°C Min
    const maxTemp = random(40.5, 47.5);
    const minTemp = random(26.0, 32.5);
    const maxChange = random(-2.5, 3.5);
    const minChange = random(-1.5, 2.5);
    const maxDeparture = random(-1.0, 5.0);
    const minDeparture = random(-1.0, 4.0);
    
    // Humidity is lower in summer (15-50%)
    const humidity830 = Math.floor(random(25, 60, 0));
    const humidity1730 = Math.floor(random(15, 40, 0));
    
    // Rainfall is mostly 0 during summer, but occasional pre-monsoon showers
    const rainChance = Math.random();
    const rain24 = rainChance > 0.85 ? random(0.5, 15.0) : 0.0;
    const rain9 = rainChance > 0.90 ? random(0.2, 5.0) : 0.0;
    
    // Derived values for analytics and UI
    const isHeatwave = maxTemp >= 45.0;
    const alertLevel = isHeatwave ? 'RED' : (maxTemp >= 43.0 ? 'ORANGE' : (maxTemp >= 41.0 ? 'YELLOW' : 'GREEN'));
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
        alertLevel: alertLevel,
        trend: trend,
        forecastConfidence: Math.floor(random(75, 98, 0)) + '%'
      },
      lastUpdated: new Date().toISOString()
    };
  });
};

app.get('/api/weather', (req, res) => {
  res.json({
    success: true,
    data: generateWeatherData()
  });
});

app.get('/api/forecast', (req, res) => {
  // Simple 7 day forecast data for a specific city
  const city = req.query.city || 'Nagpur';
  
  const forecast = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    
    return {
      date: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      maxTemp: random(41.0, 47.0),
      minTemp: random(27.0, 31.0),
      condition: pick(['Sunny', 'Mostly Sunny', 'Partly Cloudy', 'Hot', 'Heatwave']),
      rainProbability: Math.floor(random(0, 30, 0))
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
    const data = getPreviousRainfall(city, 10);
    
    if (data && data.length > 0) {
      res.json({
        success: true,
        city: city,
        source: 'IMD Excel Data (Real Readings)',
        data: data,
      });
    } else {
      // Return empty with message if no data found
      res.json({
        success: true,
        city: city,
        source: 'No IMD data available',
        data: [],
      });
    }
  } catch (error) {
    console.error('Error fetching rainfall data:', error);
    res.status(500).json({ success: false, error: 'Failed to parse rainfall data' });
  }
});

// Full monthly rainfall data for the Rainfall Report page
app.get('/api/rainfall/monthly', (req, res) => {
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    const data = getMonthlyRainfallData(month, year);
    if (data) {
      res.json({ success: true, data });
    } else {
      res.json({ success: false, error: 'No rainfall data found for this period' });
    }
  } catch (error) {
    console.error('Error fetching monthly rainfall:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly data' });
  }
});

// Download monthly rainfall as Excel
app.get('/api/rainfall/download/:month/:year', (req, res) => {
  const month = parseInt(req.params.month);
  const year = parseInt(req.params.year);

  try {
    const buffer = generateMonthlyExcel(month, year);
    if (buffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Rainfall_Report_${month}_${year}.xlsx`);
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
