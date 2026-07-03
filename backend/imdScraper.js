/**
 * imdScraper.js — IMD Nagpur Observations Page Scraper
 * 
 * Fetches and parses the official IMD Nagpur observations page to extract
 * rainfall data for all stations in the Vidarbha region.
 * 
 * Source: https://imdnagpur.gov.in/pages/observations.php
 * 
 * The scraping logic uses CSS selectors stored in constants at the top
 * of this file, making it easy to update if the IMD website structure changes.
 */

const https = require('https');
const cheerio = require('cheerio');
const { log } = require('./rainfallDb');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — CSS SELECTORS (update here if IMD page changes)
// ═══════════════════════════════════════════════════════════════

const IMD_URL = 'https://imdnagpur.gov.in/pages/observations.php';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Selectors for the observations table
const SELECTORS = {
  // Data rows have bgcolor="#ffffee"
  dataRow: 'tr[bgcolor="#ffffee"]',
  // Header rows with date info have bgcolor="#d9edf7"
  headerRow: 'tr[bgcolor="#d9edf7"]',
  // Table cells
  cell: 'td',
};

// Column indices in the data rows (0-indexed)
// The IMD observations table has these columns:
// 0: Station Name
// 1: Max Temp
// 2: Change in Max
// 3: Departure from Normal (Max)
// 4: Min Temp
// 5: Change in Min
// 6: Departure from Normal (Min)
// 7: RH 08:30 (%)
// 8: RH 17:30 (%)
// 9: RF 24 hrs (mm) ← Primary rainfall value
// 10: RF Since 09 hrs (mm)
const COL = {
  stationName: 0,
  rf24hrs: 9,
  rfSince09hrs: 10,
};

// ═══════════════════════════════════════════════════════════════
// HTTP FETCH
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch the HTML content of the IMD observations page.
 * Uses Node.js built-in `https` module (no external dependency).
 * 
 * @returns {Promise<string>} Raw HTML string
 */
function fetchHtml() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'WeatherDesk-RMC-Nagpur/1.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: REQUEST_TIMEOUT_MS,
      // Ignore self-signed certificate issues (IMD site sometimes has cert issues)
      rejectUnauthorized: false,
    };

    const req = https.get(IMD_URL, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`IMD page returned HTTP ${res.statusCode}`));
        res.resume(); // Consume response to free memory
        return;
      }

      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// HTML PARSING
// ═══════════════════════════════════════════════════════════════

/**
 * Parse the observation date from the header rows.
 * The IMD page has header rows with bgcolor="#d9edf7" containing
 * "Observed On" date information in the 3rd such row.
 * 
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 * @returns {string} Date string in YYYY-MM-DD format, or today's date as fallback
 */
function parseObservationDate($) {
  try {
    const headerRows = $(SELECTORS.headerRow);

    // The 3rd header row (index 2) typically contains the observation dates
    if (headerRows.length >= 3) {
      const dateRow = headerRows.eq(2);
      const dateCells = dateRow.find(SELECTORS.cell);

      if (dateCells.length >= 1) {
        // The first cell contains the "Max Temp" observation date
        // Format on the page is typically: "Observed on: 29/06/2026"
        const dateText = dateCells.eq(0).text().trim();

        // Try to extract a date in various formats
        const datePatterns = [
          // DD/MM/YYYY
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
          // MM/DD/YYYY
          /(\d{1,2})-(\d{1,2})-(\d{4})/,
          // YYYY-MM-DD
          /(\d{4})-(\d{2})-(\d{2})/,
        ];

        for (const pattern of datePatterns) {
          const match = dateText.match(pattern);
          if (match) {
            let dateObj;
            if (match[3] && match[3].length === 4) {
              // DD/MM/YYYY format
              dateObj = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
            } else if (match[1] && match[1].length === 4) {
              // YYYY-MM-DD format
              dateObj = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
              return dateObj.toISOString().split('T')[0];
            }
          }
        }
      }
    }

    // Fallback: try to find any date on the page
    const pageText = $.text();
    const dateMatch = pageText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
      const d = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  } catch (e) {
    log('WARN', `Could not parse observation date: ${e.message}`);
  }

  // Last fallback: use today's date
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Parse a rainfall value from the table cell text.
 * Handles various formats: numbers, "Trace", "TR", empty, "--", etc.
 * 
 * @param {string} text - Cell text content
 * @returns {number|null} Parsed rainfall value, or null if unavailable
 */
function parseRainfallValue(text) {
  if (!text) return null;

  const cleaned = text.trim().toUpperCase();

  // Handle special values
  if (cleaned === '' || cleaned === '--' || cleaned === '-' || cleaned === 'NA' || cleaned === 'N/A') {
    return null;
  }

  // Trace rainfall (< 0.1mm, treated as 0)
  if (cleaned === 'TRACE' || cleaned === 'TR' || cleaned === 'T') {
    return 0;
  }

  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return Math.round(num * 10) / 10; // Round to 1 decimal
  }

  return null;
}

/**
 * Scrape the IMD Nagpur observations page and extract rainfall data.
 * 
 * @returns {Promise<{ success: boolean, date: string, records: Array, error?: string }>}
 */
async function scrapeObservations() {
  const startTime = Date.now();
  log('INFO', 'Starting IMD observations scrape...');

  try {
    // Step 1: Fetch the HTML
    const html = await fetchHtml();
    log('INFO', `Fetched HTML: ${html.length} bytes in ${Date.now() - startTime}ms`);

    // Step 2: Parse with Cheerio
    const $ = cheerio.load(html);

    // Step 3: Extract the observation date
    const observationDate = parseObservationDate($);
    log('INFO', `Observation date: ${observationDate}`);

    // Step 4: Extract station data from data rows
    const dataRows = $(SELECTORS.dataRow);
    const records = [];

    dataRows.each((idx, el) => {
      const cells = $(el).find(SELECTORS.cell);
      if (cells.length < 10) return; // Skip rows with too few columns

      const stationName = cells.eq(COL.stationName).text().trim();
      if (!stationName) return;

      // Skip rows that are clearly not station data
      if (stationName.match(/^(total|average|mean|sub\s*division)/i)) return;

      const rf24hrs = parseRainfallValue(cells.eq(COL.rf24hrs).text());
      const rfSince09hrs = cells.length > COL.rfSince09hrs
        ? parseRainfallValue(cells.eq(COL.rfSince09hrs).text())
        : null;

      records.push({
        date: observationDate,
        station: stationName,
        rainfall_mm: rf24hrs,
        rf_since_09hrs: rfSince09hrs,
        source: 'imd_scrape',
      });
    });

    const elapsed = Date.now() - startTime;
    log('INFO', `Scrape complete: ${records.length} stations extracted in ${elapsed}ms`);

    return {
      success: true,
      date: observationDate,
      records,
      stationCount: records.length,
      elapsed,
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    log('ERROR', `Scrape failed after ${elapsed}ms: ${error.message}`);

    return {
      success: false,
      date: null,
      records: [],
      error: error.message,
      elapsed,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  scrapeObservations,
  fetchHtml,
  parseObservationDate,
  parseRainfallValue,
  IMD_URL,
};
