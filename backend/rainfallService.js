const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data', 'rainfall');

// District-to-city mapping (maps Excel district names to the 12 cities used in the frontend)
const DISTRICT_CITY_MAP = {
  'AKOLA': 'Akola',
  'AMRAOTI': 'Amravati',
  'AMRAVATI': 'Amravati',
  'BHANDARA': 'Bhandara',
  'BULDHANA': 'Buldana',
  'BULDANA': 'Buldana',
  'CHANDRAPUR': 'Chandrapur',
  'GADCHIROLI': 'Gadchiroli',
  'GONDIA': 'Gondia',
  'NAGPUR': 'Nagpur',
  'WARDHA': 'Wardha',
  'WASHIM': 'Washim',
  'YEOTMAL': 'Yavatmal',
  'YAVATMAL': 'Yavatmal',
};

/**
 * Find the most recent rainfall Excel file in the data directory.
 * Files are expected to follow the naming pattern: "Rainfall Statement - MKFormat_YYYYMMDD.xls"
 */
function getLatestRainfallFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return null;
  }

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /\.(xls|xlsx)$/i.test(f))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return path.join(DATA_DIR, files[0]);
}

/**
 * Parse an IMD MK-Format rainfall Excel file.
 * Returns structured data:
 * {
 *   month: string,
 *   year: string,
 *   dataDate: string,
 *   subdivision: string,
 *   districts: {
 *     [districtName]: {
 *       city: string,            // mapped city name
 *       stations: [
 *         { name: string, dailyRainfall: { [day]: number } }
 *       ],
 *       dailyAverage: { [day]: number },  // district average per day
 *       dailyTotal: { [day]: number },    // district total per day
 *     }
 *   }
 * }
 */
function parseRainfallExcel(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const wb = XLSX.readFile(filePath);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

  // Extract metadata from header rows
  let month = '';
  let year = '';
  let dataDate = '';

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const firstCell = String(rows[i]?.[0] || '').trim();
    const secondCell = String(rows[i]?.[1] || '').trim();

    // MONTH row: could be "MONTH: JUNE, 2026" in col 0, or "MONTH:" in col 0 and "JUNE, 2026" in col 1
    if (firstCell.toUpperCase().startsWith('MONTH')) {
      let monthStr = '';
      // Check if value is in column 1
      if (secondCell) {
        monthStr = secondCell;
      } else {
        const match = firstCell.match(/:\s*(.+)/);
        if (match) monthStr = match[1].trim();
      }
      if (monthStr) {
        const parts = monthStr.split(',').map(s => s.trim());
        month = parts[0] || '';
        year = parts[1] || '';
      }
    }

    // NOTE row: "STATEMENT BASED ON DATA AVAILABLE TILL 6/22/2026"
    if (firstCell.toUpperCase().startsWith('NOTE')) {
      const noteText = secondCell || firstCell;
      const match = noteText.match(/TILL\s+(\S+)/i);
      if (match) dataDate = match[1];
    }
  }

  // Find the header row with day numbers (row 10 typically)
  let headerRowIdx = -1;
  let dayColumns = {}; // { dayNumber: columnIndex }
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const firstCell = String(rows[i]?.[0] || '').trim();
    if (firstCell.includes('MET.SUB') || firstCell.includes('STATION')) {
      headerRowIdx = i;
      // Map day numbers to column indices
      for (let j = 1; j < rows[i].length; j++) {
        const val = rows[i][j];
        if (typeof val === 'number' && val >= 1 && val <= 31) {
          dayColumns[val] = j;
        }
      }
      break;
    }
  }

  if (headerRowIdx === -1) return null;

  // Parse districts and stations
  const districts = {};
  let currentDistrict = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || '').trim();
    if (!firstCell) continue;

    // Check for district header
    const districtMatch = firstCell.match(/^DISTRICT:\s*(.+)/i);
    if (districtMatch) {
      const distName = districtMatch[1].trim().toUpperCase();
      const cityName = DISTRICT_CITY_MAP[distName] || distName;
      currentDistrict = distName;
      if (!districts[currentDistrict]) {
        districts[currentDistrict] = {
          city: cityName,
          stations: [],
          dailyAverage: {},
          dailyTotal: {},
        };
      }
      continue;
    }

    // Check for subdivision header
    if (firstCell.match(/^MET\.\s*SUBDIVISION/i) || firstCell.match(/^-+$/)) {
      continue;
    }

    // Check if it's a station data row (has numeric data in day columns)
    if (currentDistrict && firstCell && !firstCell.match(/^-+$/)) {
      // Skip AWS/ARG-only rows (they have no data)
      const hasData = Object.values(dayColumns).some(colIdx => {
        const val = row[colIdx];
        return typeof val === 'number';
      });

      if (!hasData) continue;

      const stationName = firstCell;
      const dailyRainfall = {};

      for (const [day, colIdx] of Object.entries(dayColumns)) {
        const val = row[colIdx];
        if (typeof val === 'number') {
          dailyRainfall[day] = val;
        } else if (val === '' || val === null || val === undefined) {
          dailyRainfall[day] = null; // Missing data
        } else {
          dailyRainfall[day] = null;
        }
      }

      districts[currentDistrict].stations.push({
        name: stationName,
        dailyRainfall,
      });
    }
  }

  // Calculate district averages and totals
  for (const distName of Object.keys(districts)) {
    const dist = districts[distName];
    const stationsWithData = dist.stations.filter(s =>
      Object.values(s.dailyRainfall).some(v => v !== null)
    );

    for (let day = 1; day <= 31; day++) {
      const dayStr = String(day);
      const values = stationsWithData
        .map(s => s.dailyRainfall[dayStr])
        .filter(v => v !== null && v !== undefined);

      if (values.length > 0) {
        dist.dailyTotal[dayStr] = Number(values.reduce((a, b) => a + b, 0).toFixed(1));
        dist.dailyAverage[dayStr] = Number((dist.dailyTotal[dayStr] / values.length).toFixed(1));
      }
    }
  }

  return {
    month,
    year,
    dataDate,
    subdivision: 'VIDARBHA',
    districts,
  };
}

/**
 * Get previous N days of actual rainfall data for a specific city.
 * Returns data in the same shape as the old forecast10 endpoint so the frontend transition is smooth.
 */
function getPreviousRainfall(cityName, days = 10) {
  const filePath = getLatestRainfallFile();
  const data = parseRainfallExcel(filePath);
  if (!data) return [];

  // Find the district matching this city
  const cityLower = cityName.toLowerCase();
  let districtData = null;

  for (const dist of Object.values(data.districts)) {
    if (dist.city.toLowerCase() === cityLower) {
      districtData = dist;
      break;
    }
  }

  if (!districtData) return [];

  // Find the latest day with data
  const availableDays = Object.entries(districtData.dailyAverage)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([d]) => parseInt(d))
    .sort((a, b) => a - b);

  if (availableDays.length === 0) return [];

  // Take the last N days
  const lastNDays = availableDays.slice(-days);

  // Month/year from Excel metadata
  const monthNames = {
    'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'MAY': 4, 'JUNE': 5,
    'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11,
  };
  const monthIdx = monthNames[data.month.toUpperCase()] ?? new Date().getMonth();
  const yearNum = parseInt(data.year) || new Date().getFullYear();

  return lastNDays.map(day => {
    const date = new Date(yearNum, monthIdx, day);
    const rainfall = districtData.dailyAverage[String(day)] || 0;

    // Determine condition based on actual rainfall
    let condition, icon;
    if (rainfall === 0) { condition = 'Dry'; icon = '☀️'; }
    else if (rainfall <= 2.5) { condition = 'Light Rain'; icon = '🌦️'; }
    else if (rainfall <= 7.5) { condition = 'Moderate Rain'; icon = '🌧️'; }
    else if (rainfall <= 35.5) { condition = 'Heavy Rain'; icon = '🌧️'; }
    else if (rainfall <= 64.5) { condition = 'Very Heavy Rain'; icon = '⛈️'; }
    else { condition = 'Extremely Heavy Rain'; icon = '⛈️'; }

    return {
      date: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      dayFull: date.toLocaleDateString('en-IN', { weekday: 'long' }),
      dateFormatted: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      day: day,
      actualRainfall: rainfall,
      // Keep these for backward compat with frontend
      expectedRainfall: rainfall,
      rainProbability: rainfall > 0 ? 100 : 0,
      condition,
      icon,
      isActualData: true,
    };
  });
}

/**
 * Get full monthly data for the Rainfall Report page.
 */
function getMonthlyRainfallData(monthNum, yearNum) {
  const filePath = getLatestRainfallFile();
  const data = parseRainfallExcel(filePath);
  if (!data) return null;

  // Convert districts to a flat array for the frontend
  const districtRows = Object.entries(data.districts).map(([distName, dist]) => {
    // Calculate totals
    const totalRainfall = Object.values(dist.dailyAverage)
      .filter(v => v !== null && v !== undefined)
      .reduce((a, b) => a + b, 0);
    const rainyDays = Object.values(dist.dailyAverage)
      .filter(v => v !== null && v !== undefined && v > 0).length;

    return {
      district: distName,
      city: dist.city,
      dailyData: dist.dailyAverage,
      dailyTotal: dist.dailyTotal,
      stations: dist.stations.map(s => ({
        name: s.name,
        dailyRainfall: s.dailyRainfall,
        total: Object.values(s.dailyRainfall)
          .filter(v => v !== null && v !== undefined)
          .reduce((a, b) => a + b, 0).toFixed(1),
        rainyDays: Object.values(s.dailyRainfall)
          .filter(v => v !== null && v !== undefined && v > 0).length,
      })),
      totalRainfall: totalRainfall.toFixed(1),
      rainyDays,
    };
  });

  return {
    month: data.month,
    year: data.year,
    dataDate: data.dataDate,
    subdivision: data.subdivision,
    districts: districtRows,
  };
}

/**
 * Generate a downloadable Excel workbook buffer for a month's rainfall data.
 */
function generateMonthlyExcel(monthNum, yearNum) {
  const data = getMonthlyRainfallData(monthNum, yearNum);
  if (!data) return null;

  const wb = XLSX.utils.book_new();

  // Build the worksheet data array
  const wsData = [];

  // Title rows
  wsData.push(['RAINFALL STATEMENT — VIDARBHA REGION']);
  wsData.push([`Month: ${data.month}, ${data.year}`]);
  wsData.push([`Data as of: ${data.dataDate}`]);
  wsData.push([`Generated: ${new Date().toLocaleString('en-IN')}`]);
  wsData.push([]);

  // Header row
  const header = ['District / Station'];
  for (let d = 1; d <= 31; d++) header.push(d);
  header.push('Total RF', 'Rainy Days');
  wsData.push(header);

  // Data rows
  for (const dist of data.districts) {
    // District header row
    const distRow = [`DISTRICT: ${dist.district}`];
    for (let d = 1; d <= 31; d++) {
      const val = dist.dailyData[String(d)];
      distRow.push(val !== undefined && val !== null ? val : '');
    }
    distRow.push(dist.totalRainfall, dist.rainyDays);
    wsData.push(distRow);

    // Station rows
    for (const station of dist.stations) {
      const stRow = [`  ${station.name}`];
      for (let d = 1; d <= 31; d++) {
        const val = station.dailyRainfall[String(d)];
        stRow.push(val !== null && val !== undefined ? val : '');
      }
      stRow.push(station.total, station.rainyDays);
      wsData.push(stRow);
    }

    // Empty row between districts
    wsData.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [{ wch: 22 }];
  for (let i = 1; i <= 31; i++) ws['!cols'].push({ wch: 6 });
  ws['!cols'].push({ wch: 10 }, { wch: 10 });

  XLSX.utils.book_append_sheet(wb, ws, `${data.month} ${data.year}`);

  // Return as buffer
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  getLatestRainfallFile,
  parseRainfallExcel,
  getPreviousRainfall,
  getMonthlyRainfallData,
  generateMonthlyExcel,
  DATA_DIR,
};
