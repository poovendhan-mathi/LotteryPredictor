/**
 * Singapore Pools Scraper
 * Usage:
 *   node scrape.js          — scrape both 4D and TOTO
 *   node scrape.js 4d       — scrape 4D only
 *   node scrape.js toto     — scrape TOTO only
 *
 * Requires: npm install puppeteer
 * Output: updates ../data/4d-results.json and ../data/toto-results.json
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE_4D = path.join(DATA_DIR, "4d-results.json");
const FILE_TOTO = path.join(DATA_DIR, "toto-results.json");

async function scrape4D(browser) {
  console.log("[4D] Opening Singapore Pools 4D page...");
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  );

  try {
    await page.goto(
      "https://www.singaporepools.com.sg/en/product/sr/Pages/4d-results.aspx",
      {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
    );

    // Wait for results table
    await page.waitForSelector(".tables-702702 table", { timeout: 15000 });

    const results = await page.evaluate(() => {
      const draws = [];
      const tables = document.querySelectorAll(".tables-702702 table");

      for (const table of tables) {
        const rows = table.querySelectorAll("tr");
        const draw = { starters: [], consolation: [] };

        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length === 0) continue;

          const label = row.querySelector("th, td:first-child");
          const text = label ? label.textContent.trim().toLowerCase() : "";

          if (text.includes("draw no") || text.includes("draw date")) {
            const val = cells[cells.length - 1].textContent.trim();
            if (text.includes("no")) draw.drawNo = parseInt(val) || val;
            if (text.includes("date")) draw.date = val;
          }
          if (text.includes("1st prize")) {
            draw.first = cells[cells.length - 1].textContent.trim();
          }
          if (text.includes("2nd prize")) {
            draw.second = cells[cells.length - 1].textContent.trim();
          }
          if (text.includes("3rd prize")) {
            draw.third = cells[cells.length - 1].textContent.trim();
          }
          if (text.includes("starter")) {
            cells.forEach((c) => {
              const num = c.textContent.trim();
              if (/^\d{4}$/.test(num)) draw.starters.push(num);
            });
          }
          if (text.includes("consolation")) {
            cells.forEach((c) => {
              const num = c.textContent.trim();
              if (/^\d{4}$/.test(num)) draw.consolation.push(num);
            });
          }
        }

        if (draw.first) draws.push(draw);
      }
      return draws;
    });

    console.log(`[4D] Scraped ${results.length} draw(s)`);

    // Merge with existing data
    let existing = { draws: [] };
    if (fs.existsSync(FILE_4D)) {
      existing = JSON.parse(fs.readFileSync(FILE_4D, "utf8"));
    }

    const existingNos = new Set(existing.draws.map((d) => d.drawNo));
    let added = 0;
    for (const draw of results) {
      if (!existingNos.has(draw.drawNo)) {
        existing.draws.unshift(draw);
        added++;
      }
    }

    // Sort by drawNo descending
    existing.draws.sort((a, b) => (b.drawNo || 0) - (a.drawNo || 0));

    fs.writeFileSync(FILE_4D, JSON.stringify(existing, null, 2));
    console.log(
      `[4D] Added ${added} new draw(s). Total: ${existing.draws.length}`,
    );
  } finally {
    await page.close();
  }
}

async function scrapeToto(browser) {
  console.log("[TOTO] Opening Singapore Pools TOTO page...");
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  );

  try {
    await page.goto(
      "https://www.singaporepools.com.sg/en/product/sr/Pages/toto-results.aspx",
      {
        waitUntil: "networkidle2",
        timeout: 30000,
      },
    );

    await page.waitForSelector(".tables-702702", { timeout: 15000 });

    const results = await page.evaluate(() => {
      const draws = [];
      const containers = document.querySelectorAll(".tables-702702");

      for (const container of containers) {
        const draw = { winning: [], shares: [] };
        const texts = container.textContent;

        // Draw number and date
        const drawNoMatch = texts.match(/Draw No[.\s]*(\d+)/i);
        const dateMatch = texts.match(
          /Draw Date[.\s]*([A-Za-z]+\s+\d+\s+[A-Za-z]+\s+\d+|\d{2}\s+\w+\s+\d{4})/i,
        );
        if (drawNoMatch) draw.drawNo = parseInt(drawNoMatch[1]);
        if (dateMatch) draw.date = dateMatch[1].trim();

        // Winning numbers - look for the number balls
        const balls = container.querySelectorAll(
          '.ball, .winning-number, [class*="ball"]',
        );
        balls.forEach((ball) => {
          const num = parseInt(ball.textContent.trim());
          if (!isNaN(num) && num >= 1 && num <= 49) {
            draw.winning.push(num);
          }
        });

        // Additional number
        const addEl = container.querySelector(
          '.additional, [class*="additional"]',
        );
        if (addEl) {
          draw.additional = parseInt(addEl.textContent.trim());
        }

        // If we found at least 6 winning numbers, take first 6 as winning and 7th as additional
        if (draw.winning.length >= 7 && !draw.additional) {
          draw.additional = draw.winning[6];
          draw.winning = draw.winning.slice(0, 6);
        }

        if (draw.winning.length === 6) draws.push(draw);
      }
      return draws;
    });

    console.log(`[TOTO] Scraped ${results.length} draw(s)`);

    let existing = { draws: [] };
    if (fs.existsSync(FILE_TOTO)) {
      existing = JSON.parse(fs.readFileSync(FILE_TOTO, "utf8"));
    }

    const existingNos = new Set(existing.draws.map((d) => d.drawNo));
    let added = 0;
    for (const draw of results) {
      if (draw.drawNo && !existingNos.has(draw.drawNo)) {
        existing.draws.unshift(draw);
        added++;
      }
    }

    existing.draws.sort((a, b) => (b.drawNo || 0) - (a.drawNo || 0));

    fs.writeFileSync(FILE_TOTO, JSON.stringify(existing, null, 2));
    console.log(
      `[TOTO] Added ${added} new draw(s). Total: ${existing.draws.length}`,
    );
  } finally {
    await page.close();
  }
}

async function main() {
  const arg = process.argv[2];
  const do4D = !arg || arg === "4d";
  const doToto = !arg || arg === "toto";

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    if (do4D) await scrape4D(browser);
    if (doToto) await scrapeToto(browser);
    console.log("Done!");
  } catch (err) {
    console.error("Scraping error:", err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
