// Prediction Logger — saves predictions with full algorithmic context
const PredictionLogger = {
  STORAGE_KEY: "lottery_prediction_log",

  // Save a prediction entry
  log(entry) {
    const logs = this.getAll();
    const record = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      game: entry.game, // '4d' or 'toto'
      predictions: entry.predictions,
      weights: entry.weights,
      stats: entry.stats,
      drawsAnalyzed: entry.stats.drawsAnalyzed,
      // Store tier scores for each prediction for analysis
      tierBreakdown: entry.predictions.map((p) => ({
        value: p.number || p.numbers,
        score: p.score,
        confidence: p.confidence,
        tierScores: p.tierScores,
      })),
      // Result tracking (filled in later)
      result: null,
      checkedAt: null,
      accuracy: null,
      notes: entry.notes || "",
      // Bet tracking
      betPlaced: false,
    };
    logs.unshift(record);
    this.save(logs);
    return record;
  },

  // Toggle bet placed status
  toggleBet(id) {
    const logs = this.getAll();
    const entry = logs.find((l) => l.id === id);
    if (!entry) return null;
    entry.betPlaced = !entry.betPlaced;
    this.save(logs);
    return entry;
  },

  // Update a prediction with actual results
  updateResult(id, actualResult) {
    const logs = this.getAll();
    const entry = logs.find((l) => l.id === id);
    if (!entry) return null;

    entry.checkedAt = new Date().toISOString();
    entry.result = actualResult;

    if (entry.game === "4d") {
      entry.accuracy = this.calculate4DAccuracy(
        entry.predictions,
        actualResult,
      );
    } else {
      entry.accuracy = this.calculateTotoAccuracy(
        entry.predictions,
        actualResult,
      );
    }

    this.save(logs);
    return entry;
  },

  // Calculate 4D prediction accuracy
  calculate4DAccuracy(predictions, result) {
    const winningNumbers = [
      result.first,
      result.second,
      result.third,
      ...(result.starters || []),
      ...(result.consolation || []),
    ];
    let hits = 0,
      top3Hits = 0,
      starterHits = 0,
      consolationHits = 0;
    const details = [];

    for (const pred of predictions) {
      const num = pred.number || pred;
      let hitType = "miss";
      if ([result.first, result.second, result.third].includes(num)) {
        hits++;
        top3Hits++;
        hitType = "top3";
      } else if ((result.starters || []).includes(num)) {
        hits++;
        starterHits++;
        hitType = "starter";
      } else if ((result.consolation || []).includes(num)) {
        hits++;
        consolationHits++;
        hitType = "consolation";
      }
      details.push({ number: num, hitType, score: pred.score });
    }

    return {
      hitRate: hits / predictions.length,
      hits,
      top3Hits,
      starterHits,
      consolationHits,
      total: predictions.length,
      details,
    };
  },

  // Calculate TOTO prediction accuracy
  calculateTotoAccuracy(predictions, result) {
    const winning = result.winning || [];
    const additional = result.additional;
    const details = [];

    for (const pred of predictions) {
      const nums = pred.numbers || pred;
      const matches = nums.filter((n) => winning.includes(n)).length;
      const additionalMatch = nums.includes(additional);
      let prize = "none";
      if (matches === 6) prize = "group1";
      else if (matches === 5 && additionalMatch) prize = "group2";
      else if (matches === 5) prize = "group3";
      else if (matches === 4 && additionalMatch) prize = "group4";
      else if (matches === 4) prize = "group5";
      else if (matches === 3 && additionalMatch) prize = "group6";
      else if (matches === 3) prize = "group7";
      details.push({
        numbers: nums,
        matches,
        additionalMatch,
        prize,
        score: pred.score,
      });
    }

    const bestMatch = Math.max(...details.map((d) => d.matches));
    return {
      details,
      bestMatch,
      avgMatches: details.reduce((s, d) => s + d.matches, 0) / details.length,
      anyPrize: details.some((d) => d.prize !== "none"),
    };
  },

  // Get accuracy statistics across all logged predictions
  getAccuracyStats(game) {
    const logs = this.getAll().filter((l) => l.game === game && l.accuracy);
    if (logs.length === 0) return null;

    if (game === "4d") {
      const totalPredictions = logs.reduce((s, l) => s + l.accuracy.total, 0);
      const totalHits = logs.reduce((s, l) => s + l.accuracy.hits, 0);
      const top3Hits = logs.reduce((s, l) => s + l.accuracy.top3Hits, 0);

      // Per-tier accuracy (which tiers predicted the hits)
      const tierAccuracy = {};
      for (const log of logs) {
        if (!log.accuracy.details) continue;
        for (const d of log.accuracy.details) {
          if (d.hitType !== "miss") {
            const tb = log.tierBreakdown.find((t) => t.value === d.number);
            if (tb && tb.tierScores) {
              for (const [tier, score] of Object.entries(tb.tierScores)) {
                if (!tierAccuracy[tier])
                  tierAccuracy[tier] = { hits: 0, total: 0, scoreSum: 0 };
                tierAccuracy[tier].hits++;
                tierAccuracy[tier].scoreSum += score;
              }
            }
          }
          // Count total for each tier
          const tb = log.tierBreakdown.find((t) => t.value === d.number);
          if (tb && tb.tierScores) {
            for (const tier of Object.keys(tb.tierScores)) {
              if (!tierAccuracy[tier])
                tierAccuracy[tier] = { hits: 0, total: 0, scoreSum: 0 };
              tierAccuracy[tier].total++;
            }
          }
        }
      }

      return {
        totalLogs: logs.length,
        totalPredictions,
        totalHits,
        hitRate: totalHits / totalPredictions,
        top3Hits,
        tierAccuracy,
      };
    } else {
      const allDetails = logs.flatMap((l) => l.accuracy.details);
      const avgMatches =
        allDetails.reduce((s, d) => s + d.matches, 0) / allDetails.length;
      const prizes = allDetails.filter((d) => d.prize !== "none");

      return {
        totalLogs: logs.length,
        totalSets: allDetails.length,
        avgMatches,
        bestMatch: Math.max(...allDetails.map((d) => d.matches)),
        prizeSets: prizes.length,
        prizeRate: prizes.length / allDetails.length,
      };
    }
  },

  // Suggest optimal weights based on historical accuracy
  suggestWeights(game) {
    const stats = this.getAccuracyStats(game);
    if (!stats || !stats.tierAccuracy) return null;

    const weights = {};
    let totalWeight = 0;

    for (const [tier, data] of Object.entries(stats.tierAccuracy)) {
      // Weight = hit rate * average score contribution
      const hitRate = data.total > 0 ? data.hits / data.total : 0;
      const avgScore = data.total > 0 ? data.scoreSum / data.total : 0;
      weights[tier] = hitRate * (1 + avgScore);
      totalWeight += weights[tier];
    }

    // Normalize to sum to 1
    if (totalWeight > 0) {
      for (const tier in weights) weights[tier] /= totalWeight;
    }

    return weights;
  },

  // Get bet tracking statistics
  getBetStats() {
    const logs = this.getAll();
    const bets = logs.filter((l) => l.betPlaced);
    const noBets = logs.filter((l) => !l.betPlaced);
    const betsChecked = bets.filter((l) => l.accuracy);
    const noBetsChecked = noBets.filter((l) => l.accuracy);

    const betsWon4D = betsChecked.filter(
      (l) => l.game === "4d" && l.accuracy && l.accuracy.hits > 0,
    ).length;
    const betsWonToto = betsChecked.filter(
      (l) => l.game === "toto" && l.accuracy && l.accuracy.anyPrize,
    ).length;
    const noBetsWon4D = noBetsChecked.filter(
      (l) => l.game === "4d" && l.accuracy && l.accuracy.hits > 0,
    ).length;
    const noBetsWonToto = noBetsChecked.filter(
      (l) => l.game === "toto" && l.accuracy && l.accuracy.anyPrize,
    ).length;

    return {
      totalBets: bets.length,
      totalNoBets: noBets.length,
      betsWon: betsWon4D + betsWonToto,
      betsLost: betsChecked.length - betsWon4D - betsWonToto,
      noBetsWon: noBetsWon4D + noBetsWonToto,
      betsChecked: betsChecked.length,
      noBetsChecked: noBetsChecked.length,
    };
  },

  // Export logs as JSON
  exportJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  // Import logs from JSON
  importJSON(jsonStr) {
    const imported = JSON.parse(jsonStr);
    if (!Array.isArray(imported)) throw new Error("Invalid log format");
    const existing = this.getAll();
    const existingIds = new Set(existing.map((l) => l.id));
    let added = 0;
    for (const entry of imported) {
      if (!existingIds.has(entry.id)) {
        existing.push(entry);
        added++;
      }
    }
    existing.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    this.save(existing);
    return added;
  },

  // Clear all logs
  clearAll() {
    localStorage.removeItem(this.STORAGE_KEY);
  },

  // Get all logs
  getAll() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  save(logs) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
};
