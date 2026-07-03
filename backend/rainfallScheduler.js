/**
 * rainfallScheduler.js — Automatic Daily Rainfall Collection Scheduler
 * 
 * Uses node-cron to run the IMD scraper on a daily schedule.
 * Scrapes at 09:30 AM IST and 06:00 PM IST daily.
 * 
 * Features:
 *  - Automatic daily scraping
 *  - Retry logic with exponential backoff
 *  - Never deletes existing data
 *  - Comprehensive logging
 *  - Status reporting
 */

const cron = require('node-cron');
const { scrapeObservations } = require('./imdScraper');
const rainfallDb = require('./rainfallDb');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Cron schedule expressions (IST = UTC+5:30)
// 09:30 AM IST = 04:00 UTC
// 06:00 PM IST = 12:30 UTC
const SCHEDULE_MORNING = '0 4 * * *';   // 09:30 AM IST (approximated to 04:00 UTC)
const SCHEDULE_EVENING = '30 12 * * *'; // 06:00 PM IST (approximated to 12:30 UTC)

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

// ═══════════════════════════════════════════════════════════════
// SCHEDULER STATE
// ═══════════════════════════════════════════════════════════════

let schedulerState = {
  isRunning: false,
  lastScrapeTime: null,
  lastScrapeResult: null,
  totalScrapes: 0,
  totalRecordsInserted: 0,
  startedAt: null,
  morningJob: null,
  eveningJob: null,
};

// ═══════════════════════════════════════════════════════════════
// SCRAPE AND STORE
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a single scrape-and-store cycle.
 * Fetches data from IMD, validates, and inserts into the database.
 * 
 * @param {number} [attempt=1] - Current retry attempt number
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function scrapeAndStore(attempt = 1) {
  rainfallDb.log('INFO', `Scrape-and-store cycle starting (attempt ${attempt}/${MAX_RETRIES})`);

  try {
    // Step 1: Scrape the IMD page
    const scrapeResult = await scrapeObservations();

    if (!scrapeResult.success) {
      throw new Error(scrapeResult.error || 'Scrape returned unsuccessful');
    }

    if (scrapeResult.records.length === 0) {
      rainfallDb.log('WARN', 'Scrape returned 0 records — IMD page may be empty or structure changed');
      return { success: false, message: 'No records found on IMD page' };
    }

    // Step 2: Validate records
    const validRecords = scrapeResult.records.filter(rec => {
      if (!rec.date || !rec.station) return false;
      // Allow null rainfall (station may not have reported yet)
      return true;
    });

    rainfallDb.log('INFO', `Validated ${validRecords.length}/${scrapeResult.records.length} records for date ${scrapeResult.date}`);

    // Step 3: Insert into database (upsert prevents duplicates)
    const result = rainfallDb.bulkUpsert(validRecords);

    // Step 4: Update scheduler state
    schedulerState.lastScrapeTime = new Date().toISOString();
    schedulerState.lastScrapeResult = {
      success: true,
      date: scrapeResult.date,
      stationsScraped: validRecords.length,
      inserted: result.inserted,
      updated: result.updated,
      elapsed: scrapeResult.elapsed,
    };
    schedulerState.totalScrapes++;
    schedulerState.totalRecordsInserted += result.inserted;

    const msg = `Scrape successful: ${result.inserted} new, ${result.updated} updated for ${scrapeResult.date}`;
    rainfallDb.log('INFO', msg);
    return { success: true, message: msg };

  } catch (error) {
    rainfallDb.log('ERROR', `Scrape attempt ${attempt} failed: ${error.message}`);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      rainfallDb.log('INFO', `Retrying in ${RETRY_DELAY_MS / 1000 / 60} minutes...`);
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await scrapeAndStore(attempt + 1));
        }, RETRY_DELAY_MS);
      });
    }

    // All retries exhausted
    schedulerState.lastScrapeTime = new Date().toISOString();
    schedulerState.lastScrapeResult = {
      success: false,
      error: error.message,
      retriesExhausted: true,
    };

    const msg = `Scrape failed after ${MAX_RETRIES} attempts: ${error.message}`;
    rainfallDb.log('ERROR', msg);
    return { success: false, message: msg };
  }
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER START / STOP
// ═══════════════════════════════════════════════════════════════

/**
 * Start the daily rainfall collection scheduler.
 * Sets up two cron jobs: morning and evening.
 */
function startScheduler() {
  if (schedulerState.isRunning) {
    rainfallDb.log('WARN', 'Scheduler is already running');
    return;
  }

  rainfallDb.log('INFO', 'Starting rainfall collection scheduler...');
  rainfallDb.log('INFO', `Morning schedule: ${SCHEDULE_MORNING} (approx 09:30 AM IST)`);
  rainfallDb.log('INFO', `Evening schedule: ${SCHEDULE_EVENING} (approx 06:00 PM IST)`);

  // Morning job
  schedulerState.morningJob = cron.schedule(SCHEDULE_MORNING, async () => {
    rainfallDb.log('INFO', '⏰ Morning scrape triggered by scheduler');
    await scrapeAndStore();
  });

  // Evening job
  schedulerState.eveningJob = cron.schedule(SCHEDULE_EVENING, async () => {
    rainfallDb.log('INFO', '⏰ Evening scrape triggered by scheduler');
    await scrapeAndStore();
  });

  schedulerState.isRunning = true;
  schedulerState.startedAt = new Date().toISOString();

  rainfallDb.log('INFO', 'Scheduler started successfully');

  // Run an initial scrape after a short delay (give server time to fully start)
  setTimeout(async () => {
    rainfallDb.log('INFO', 'Running initial scrape on startup...');
    await scrapeAndStore();
  }, 5000);
}

/**
 * Stop the scheduler.
 */
function stopScheduler() {
  if (schedulerState.morningJob) {
    schedulerState.morningJob.stop();
    schedulerState.morningJob = null;
  }
  if (schedulerState.eveningJob) {
    schedulerState.eveningJob.stop();
    schedulerState.eveningJob = null;
  }
  schedulerState.isRunning = false;
  rainfallDb.log('INFO', 'Scheduler stopped');
}

/**
 * Get the current status of the scheduler.
 * @returns {object} Scheduler status
 */
function getStatus() {
  return {
    isRunning: schedulerState.isRunning,
    startedAt: schedulerState.startedAt,
    lastScrapeTime: schedulerState.lastScrapeTime,
    lastScrapeResult: schedulerState.lastScrapeResult,
    totalScrapes: schedulerState.totalScrapes,
    totalRecordsInserted: schedulerState.totalRecordsInserted,
    dbRecordCount: rainfallDb.getRecordCount(),
    dbLatestDate: rainfallDb.getLatestDate(),
    dbOldestDate: rainfallDb.getOldestDate(),
    dbStationCount: rainfallDb.getStationNames().length,
    schedule: {
      morning: SCHEDULE_MORNING + ' (approx 09:30 AM IST)',
      evening: SCHEDULE_EVENING + ' (approx 06:00 PM IST)',
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  startScheduler,
  stopScheduler,
  scrapeAndStore,
  getStatus,
};
