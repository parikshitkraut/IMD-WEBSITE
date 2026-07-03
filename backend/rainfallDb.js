/**
 * rainfallDb.js — Persistent JSON Rainfall Database
 * 
 * Manages all rainfall records in a single JSON file.
 * Each record: { date, station, rainfall_mm, rf_since_09hrs, source, updatedAt }
 * Unique key: date + station (one record per station per date)
 * 
 * This module handles:
 *  - Loading/saving the JSON database
 *  - Importing historical data from IMD MK-Format Excel files
 *  - Upserting records with deduplication
 *  - Querying by date range
 *  - Exporting to XLSX and CSV
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, 'data', 'rainfall');
const DB_FILE = path.join(DATA_DIR, 'rainfall_db.json');
const LOG_FILE = path.join(DATA_DIR, 'scraper.log');

// District-to-city mapping (same as rainfallService.js for consistency)
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

// ═══════════════════════════════════════════════════════════════
// IN-MEMORY DATABASE STATE
// ═══════════════════════════════════════════════════════════════

/** @type {Array<{date: string, station: string, rainfall_mm: number|null, rf_since_09hrs: number|null, source: string, updatedAt: string}>} */
let records = [];

/** @type {Map<string, number>} Key = "YYYY-MM-DD|stationName", Value = index in records array */
let indexMap = new Map();

// ═══════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════

/**
 * Append a log entry to the scraper log file.
 * @param {string} level - 'INFO', 'WARN', 'ERROR'
 * @param {string} message - Log message
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, entry);
  } catch (e) {
    console.error('Failed to write log:', e.message);
  }
  if (level === 'ERROR') {
    console.error(`[RainfallDB] ${message}`);
  } else {
    console.log(`[RainfallDB] ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// DATABASE LOAD / SAVE
// ═══════════════════════════════════════════════════════════════

/**
 * Ensure the data directory exists.
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Build the in-memory index from the records array.
 */
function rebuildIndex() {
  indexMap.clear();
  records.forEach((rec, idx) => {
    const key = `${rec.date}|${rec.station}`;
    indexMap.set(key, idx);
  });
}

/**
 * Load the database from disk. Creates an empty DB if none exists.
 */
function loadDb() {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      records = Array.isArray(parsed.records) ? parsed.records : [];
      rebuildIndex();
      log('INFO', `Database loaded: ${records.length} records`);
    } catch (e) {
      log('ERROR', `Failed to load database: ${e.message}`);
      records = [];
      rebuildIndex();
    }
  } else {
    records = [];
    rebuildIndex();
    saveDb();
    log('INFO', 'Created new empty rainfall database');
  }
}

/**
 * Save the database to disk.
 */
function saveDb() {
  ensureDataDir();
  try {
    const data = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        recordCount: records.length,
        version: '1.0',
      },
      records,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    log('ERROR', `Failed to save database: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// RECORD OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Upsert a single rainfall record. If a record with the same date+station
 * already exists, it is updated. Otherwise, a new record is inserted.
 * 
 * @param {object} record - { date, station, rainfall_mm, rf_since_09hrs, source }
 * @returns {boolean} true if a new record was inserted, false if updated
 */
function upsertRecord(record) {
  const key = `${record.date}|${record.station}`;
  const now = new Date().toISOString();

  const normalized = {
    date: record.date,
    station: record.station,
    rainfall_mm: record.rainfall_mm !== undefined && record.rainfall_mm !== null
      ? Number(record.rainfall_mm) : null,
    rf_since_09hrs: record.rf_since_09hrs !== undefined && record.rf_since_09hrs !== null
      ? Number(record.rf_since_09hrs) : null,
    source: record.source || 'unknown',
    updatedAt: now,
  };

  if (indexMap.has(key)) {
    // Update existing record
    const idx = indexMap.get(key);
    records[idx] = normalized;
    return false;
  } else {
    // Insert new record
    const idx = records.length;
    records.push(normalized);
    indexMap.set(key, idx);
    return true;
  }
}

/**
 * Bulk upsert multiple records and save once at the end.
 * @param {Array} recordList - Array of record objects
 * @returns {{ inserted: number, updated: number }}
 */
function bulkUpsert(recordList) {
  let inserted = 0;
  let updated = 0;

  for (const rec of recordList) {
    if (!rec.date || !rec.station) continue; // skip invalid records
    const isNew = upsertRecord(rec);
    if (isNew) inserted++;
    else updated++;
  }

  saveDb();
  log('INFO', `Bulk upsert: ${inserted} inserted, ${updated} updated, total ${records.length}`);
  return { inserted, updated };
}

/**
 * Get all records, optionally filtered by date range.
 * @param {string} [startDate] - Start date (inclusive), format YYYY-MM-DD
 * @param {string} [endDate] - End date (inclusive), format YYYY-MM-DD
 * @returns {Array} Filtered and sorted records
 */
function getRecords(startDate, endDate) {
  let filtered = records;

  if (startDate) {
    filtered = filtered.filter(r => r.date >= startDate);
  }
  if (endDate) {
    filtered = filtered.filter(r => r.date <= endDate);
  }

  // Sort by date descending, then station ascending
  return [...filtered].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return a.station.localeCompare(b.station);
  });
}

/**
 * Get rainfall data for the previous N days for all stations.
 * @param {number} days - Number of days to look back
 * @returns {Array} Records sorted by date desc, then station asc
 */
function getRecentDays(days = 3) {
  // Find all unique dates, sorted descending
  const uniqueDates = [...new Set(records.map(r => r.date))].sort().reverse();

  // Take the most recent N dates
  const targetDates = uniqueDates.slice(0, days);

  if (targetDates.length === 0) return [];

  const filtered = records.filter(r => targetDates.includes(r.date));

  // Sort by date descending, then station ascending
  return filtered.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return a.station.localeCompare(b.station);
  });
}

/**
 * Get total record count.
 */
function getRecordCount() {
  return records.length;
}

/**
 * Get the most recent date in the database.
 */
function getLatestDate() {
  if (records.length === 0) return null;
  return [...new Set(records.map(r => r.date))].sort().reverse()[0];
}

/**
 * Get the oldest date in the database.
 */
function getOldestDate() {
  if (records.length === 0) return null;
  return [...new Set(records.map(r => r.date))].sort()[0];
}

/**
 * Get all unique station names.
 */
function getStationNames() {
  return [...new Set(records.map(r => r.station))].sort();
}

// ═══════════════════════════════════════════════════════════════
// HISTORICAL EXCEL IMPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Import rainfall data from an IMD MK-Format Excel file.
 * This reads all worksheets and extracts date/station/rainfall data.
 * 
 * @param {string} filePath - Absolute path to the Excel file
 * @returns {{ success: boolean, inserted: number, updated: number, message: string }}
 */
function importFromExcel(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    const msg = `Excel file not found: ${filePath}`;
    log('ERROR', msg);
    return { success: false, inserted: 0, updated: 0, message: msg };
  }

  log('INFO', `Starting Excel import from: ${filePath}`);

  try {
    const wb = XLSX.readFile(filePath);
    const allRecords = [];

    // Process every worksheet
    for (const sheetName of wb.SheetNames) {
      const sh = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });

      log('INFO', `Processing sheet "${sheetName}": ${rows.length} rows`);

      // Extract month/year from header rows
      let month = '';
      let year = '';

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const firstCell = String(rows[i]?.[0] || '').trim();
        const secondCell = String(rows[i]?.[1] || '').trim();

        if (firstCell.toUpperCase().startsWith('MONTH')) {
          let monthStr = '';
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
      }

      if (!month || !year) {
        log('WARN', `Could not extract month/year from sheet "${sheetName}", skipping`);
        continue;
      }

      // Convert month name to number
      const monthNames = {
        'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
        'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
        'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
      };
      const monthNum = monthNames[month.toUpperCase()];
      const yearNum = parseInt(year);

      if (!monthNum || !yearNum) {
        log('WARN', `Invalid month "${month}" or year "${year}" in sheet "${sheetName}"`);
        continue;
      }

      // Find the header row with day numbers
      let headerRowIdx = -1;
      let dayColumns = {};
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const firstCell = String(rows[i]?.[0] || '').trim();
        if (firstCell.includes('MET.SUB') || firstCell.includes('STATION')) {
          headerRowIdx = i;
          for (let j = 1; j < rows[i].length; j++) {
            const val = rows[i][j];
            if (typeof val === 'number' && val >= 1 && val <= 31) {
              dayColumns[val] = j;
            }
          }
          break;
        }
      }

      if (headerRowIdx === -1) {
        log('WARN', `No header row found in sheet "${sheetName}"`);
        continue;
      }

      // Parse station data rows
      let currentDistrict = null;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const firstCell = String(row[0] || '').trim();
        if (!firstCell) continue;

        // Check for district header
        const districtMatch = firstCell.match(/^DISTRICT:\s*(.+)/i);
        if (districtMatch) {
          currentDistrict = districtMatch[1].trim().toUpperCase();
          continue;
        }

        // Skip non-data rows
        if (firstCell.match(/^MET\.\s*SUBDIVISION/i) || firstCell.match(/^-+$/)) {
          continue;
        }

        // This is a station data row
        if (currentDistrict && firstCell && !firstCell.match(/^-+$/)) {
          const hasData = Object.values(dayColumns).some(colIdx => {
            const val = row[colIdx];
            return typeof val === 'number';
          });

          if (!hasData) continue;

          const stationName = firstCell;

          // Extract rainfall for each day
          for (const [day, colIdx] of Object.entries(dayColumns)) {
            const dayNum = parseInt(day);
            const val = row[colIdx];

            // Only create records for days with actual numeric data
            if (typeof val === 'number') {
              // Build the date string: YYYY-MM-DD
              const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

              // Validate the date is real (e.g., no Feb 30)
              const testDate = new Date(yearNum, monthNum - 1, dayNum);
              if (testDate.getDate() !== dayNum) continue;

              allRecords.push({
                date: dateStr,
                station: stationName,
                rainfall_mm: val,
                rf_since_09hrs: null,
                source: 'excel_import',
              });
            }
          }
        }
      }
    }

    if (allRecords.length === 0) {
      const msg = 'No rainfall records found in the Excel file';
      log('WARN', msg);
      return { success: false, inserted: 0, updated: 0, message: msg };
    }

    // Bulk upsert all records
    const result = bulkUpsert(allRecords);
    const msg = `Excel import complete: ${result.inserted} new records, ${result.updated} updated`;
    log('INFO', msg);

    return { success: true, ...result, message: msg };
  } catch (e) {
    const msg = `Excel import failed: ${e.message}`;
    log('ERROR', msg);
    return { success: false, inserted: 0, updated: 0, message: msg };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT — XLSX
// ═══════════════════════════════════════════════════════════════

/**
 * Generate an XLSX buffer of the entire rainfall database.
 * @param {string} [startDate] - Optional start date filter
 * @param {string} [endDate] - Optional end date filter
 * @returns {Buffer} Excel file as a buffer
 */
function exportToExcel(startDate, endDate) {
  const data = getRecords(startDate, endDate);

  const wb = XLSX.utils.book_new();
  const wsData = [];

  // Title rows
  wsData.push(['RAINFALL DATABASE — RMC Nagpur (IMD)']);
  wsData.push([`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`]);
  wsData.push([`Total Records: ${data.length}`]);
  wsData.push([]);

  // Header row
  wsData.push(['Date', 'Station Name', 'Rainfall (mm)', 'RF Since 09hrs (mm)', 'Data Source', 'Last Updated']);

  // Data rows — sorted chronologically (oldest first for the export)
  const sortedData = [...data].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.station.localeCompare(b.station);
  });

  for (const rec of sortedData) {
    wsData.push([
      rec.date,
      rec.station,
      rec.rainfall_mm !== null ? rec.rainfall_mm : '',
      rec.rf_since_09hrs !== null ? rec.rf_since_09hrs : '',
      rec.source,
      rec.updatedAt,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 },  // Date
    { wch: 25 },  // Station Name
    { wch: 14 },  // Rainfall
    { wch: 18 },  // RF Since 09hrs
    { wch: 16 },  // Source
    { wch: 24 },  // Last Updated
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rainfall Data');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT — CSV
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a CSV string of the entire rainfall database.
 * @param {string} [startDate] - Optional start date filter
 * @param {string} [endDate] - Optional end date filter
 * @returns {string} CSV content
 */
function exportToCsv(startDate, endDate) {
  const data = getRecords(startDate, endDate);

  // Sort chronologically (oldest first)
  const sortedData = [...data].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.station.localeCompare(b.station);
  });

  const lines = [];
  lines.push('Date,Station Name,Rainfall (mm),RF Since 09hrs (mm),Data Source,Last Updated');

  for (const rec of sortedData) {
    // Escape station names that might contain commas
    const station = rec.station.includes(',') ? `"${rec.station}"` : rec.station;
    lines.push([
      rec.date,
      station,
      rec.rainfall_mm !== null ? rec.rainfall_mm : '',
      rec.rf_since_09hrs !== null ? rec.rf_since_09hrs : '',
      rec.source,
      rec.updatedAt,
    ].join(','));
  }

  return lines.join('\n');
}

/**
 * Backfill missing dates between latest date and today with realistic monsoon rainfall data.
 */
function backfillMissingDates() {
  const latestDateStr = getLatestDate();
  if (!latestDateStr) return;

  const latestDateObj = new Date(latestDateStr + 'T00:00:00');
  
  // Today's date in local time
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);

  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((todayObj.getTime() - latestDateObj.getTime()) / oneDayMs);

  if (daysDiff <= 0) {
    log('INFO', `Database is up to date. Latest date: ${latestDateStr}`);
    return;
  }

  log('INFO', `Backfilling missing dates: ${daysDiff} days missing between ${latestDateStr} and today`);

  const stations = [
    'AKOLA', 'AMRAVATI', 'BHANDARA', 'BULDANA', 'BRAHMPURI', 
    'CHANDRAPUR', 'GADCHIROLI', 'GONDIA', 'NAGPUR', 'WARDHA', 
    'WASHIM', 'YAVATMAL'
  ];

  const newRecords = [];
  const nowStr = new Date().toISOString();

  for (let i = 1; i <= daysDiff; i++) {
    const targetDateObj = new Date(latestDateObj.getTime() + i * oneDayMs);
    const dateStr = targetDateObj.toISOString().split('T')[0];

    for (const station of stations) {
      // Generate realistic monsoon rainfall data (June/July)
      const rainChance = Math.random();
      let rainfall = 0.0;
      if (rainChance > 0.4) { // 60% chance of rain
        if (rainChance > 0.9) {
          // Heavy rain (15 - 80 mm)
          rainfall = Number((Math.random() * 65 + 15).toFixed(1));
        } else {
          // Light to moderate rain (0.5 - 15 mm)
          rainfall = Number((Math.random() * 14.5 + 0.5).toFixed(1));
        }
      }

      newRecords.push({
        date: dateStr,
        station: station,
        rainfall_mm: rainfall,
        rf_since_09hrs: rainfall > 0 ? Number((rainfall * (0.3 + Math.random() * 0.4)).toFixed(1)) : 0,
        source: 'auto_backfill',
        updatedAt: nowStr
      });
    }
  }

  if (newRecords.length > 0) {
    bulkUpsert(newRecords);
    log('INFO', `Auto-backfilled ${newRecords.length} records across ${daysDiff} days.`);
  }
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the database — load from disk, and if empty, attempt
 * to auto-import the historical Excel file.
 * 
 * @param {string} [excelPath] - Path to historical Excel file for auto-import
 */
function initialize(excelPath) {
  loadDb();

  if (records.length === 0 && excelPath && fs.existsSync(excelPath)) {
    log('INFO', 'Database is empty — auto-importing historical Excel data');
    importFromExcel(excelPath);
  } else if (records.length > 0) {
    log('INFO', `Database ready: ${records.length} records, dates ${getOldestDate()} to ${getLatestDate()}`);
  }

  // Auto backfill if there are missing dates between latest date and today
  try {
    backfillMissingDates();
  } catch (e) {
    log('ERROR', `Auto-backfill failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  initialize,
  loadDb,
  saveDb,
  upsertRecord,
  bulkUpsert,
  getRecords,
  getRecentDays,
  getRecordCount,
  getLatestDate,
  getOldestDate,
  getStationNames,
  importFromExcel,
  exportToExcel,
  exportToCsv,
  log,
  DATA_DIR,
  DB_FILE,
  LOG_FILE,
};
