export const fetchLiveWeather = async () => {
  try {
    const response = await fetch('/api/weather');
    const result = await response.json();
    if (result.success) {
      return result.data;
    }
    throw new Error('Failed to fetch weather data');
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
};

export const fetchForecast = async (city) => {
  try {
    const response = await fetch(`/api/forecast?city=${encodeURIComponent(city)}`);
    const result = await response.json();
    if (result.success) {
      return result.data;
    }
    throw new Error('Failed to fetch forecast data');
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
};

// Fetch previous 10 days of actual rainfall data from IMD Excel (replaces old forecast)
export const fetchPast10Rainfall = async (city) => {
  try {
    const response = await fetch(`/api/forecast10?city=${encodeURIComponent(city)}`);
    const result = await response.json();
    if (result.success) {
      return { data: result.data, source: result.source };
    }
    throw new Error('Failed to fetch rainfall data');
  } catch (error) {
    console.error('API Error:', error);
    return { data: [], source: 'Error' };
  }
};

// Legacy alias — still used in Observations.jsx
export const fetchForecast10 = async (city) => {
  const result = await fetchPast10Rainfall(city);
  return result.data;
};

// Fetch full monthly rainfall data for the Rainfall Report page
export const fetchMonthlyRainfall = async (month, year) => {
  try {
    const response = await fetch(`/api/rainfall/monthly?month=${month}&year=${year}`);
    const result = await response.json();
    if (result.success) {
      return result.data;
    }
    throw new Error('Failed to fetch monthly rainfall');
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
};

// Download monthly rainfall as Excel file
export const downloadRainfallExcel = async (month, year) => {
  try {
    const response = await fetch(`/api/rainfall/download/${month}/${year}`);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rainfall_Report_${month}_${year}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Download Error:', error);
    return false;
  }
};

// Upload a new rainfall Excel file
export const uploadRainfallFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/rainfall/upload', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Upload Error:', error);
    return { success: false, error: 'Upload failed' };
  }
};

// ═══════════════════════════════════════════════════════════════
// RAINFALL DATABASE API (Persistent JSON DB + Scraping)
// ═══════════════════════════════════════════════════════════════

// Fetch the previous N days' rainfall for all stations from the DB
export const fetchRecentRainfall = async (days = 3) => {
  try {
    const response = await fetch(`/api/rainfall/recent?days=${days}`);
    const result = await response.json();
    if (result.success) {
      return result;
    }
    throw new Error('Failed to fetch recent rainfall');
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, data: [], count: 0 };
  }
};

// Download the full rainfall database as Excel (.xlsx)
export const downloadRainfallDbExcel = async () => {
  try {
    const response = await fetch('/api/rainfall/download-db/xlsx');
    if (!response.ok) {
      // Try to parse error message from JSON body
      let errMsg = `Download failed (HTTP ${response.status})`;
      try {
        const json = await response.json();
        errMsg = json.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Downloaded file is empty — no data found.');
    const today = new Date().toISOString().split('T')[0];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rainfall_Data_${today}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return { success: true };
  } catch (error) {
    console.error('Download Error:', error);
    return { success: false, error: error.message };
  }
};

// Download the full rainfall database as CSV
export const downloadRainfallDbCsv = async () => {
  try {
    const response = await fetch('/api/rainfall/download-db/csv');
    if (!response.ok) {
      let errMsg = `Download failed (HTTP ${response.status})`;
      try {
        const json = await response.json();
        errMsg = json.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Downloaded file is empty — no data found.');
    const today = new Date().toISOString().split('T')[0];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rainfall_Data_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return { success: true };
  } catch (error) {
    console.error('Download Error:', error);
    return { success: false, error: error.message };
  }
};

// Trigger historical Excel import
export const triggerImport = async () => {
  try {
    const response = await fetch('/api/rainfall/import', { method: 'POST' });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Import Error:', error);
    return { success: false, error: 'Import failed' };
  }
};

// Trigger a manual scrape of IMD observations
export const triggerScrape = async () => {
  try {
    const response = await fetch('/api/rainfall/scrape-now', { method: 'POST' });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Scrape Error:', error);
    return { success: false, error: 'Scrape failed' };
  }
};

// Get scheduler status and DB stats
export const fetchRainfallStatus = async () => {
  try {
    const response = await fetch('/api/rainfall/status');
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Status Error:', error);
    return { success: false };
  }
};

// Fetch district-wise aggregated rainfall summary
export const fetchDistrictSummary = async ({ days = 30, startDate, endDate } = {}) => {
  try {
    let url = `/api/rainfall/district-summary?days=${days}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    const response = await fetch(url);
    const result = await response.json();
    if (result.success) return result;
    throw new Error(result.error || 'Failed to fetch district summary');
  } catch (error) {
    console.error('District Summary Error:', error);
    return { success: false, data: [], count: 0 };
  }
};
