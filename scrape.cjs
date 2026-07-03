const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('obs.html');
const $ = cheerio.load(html);
$('tr').each((idx, el) => {
  const tds = $(el).find('td');
  if (tds.length >= 8) {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.includes('NAGPUR') || text.includes('Station')) {
      console.log(tds.map((i, td) => $(td).text().trim()).get().join(' | '));
    }
  }
});
