// Backtesting Engine: Walk-Forward Validation
const BacktestEngine = {
  // Walk-forward backtest for 4D
  backtest4D(draws, windowSize = 30, stepSize = 5, predictCount = 5) {
    const results = [];
    const totalDraws = draws.length;

    // We need draws in chronological order for walk-forward
    const chrono = [...draws].reverse();

    for (
      let start = 0;
      start + windowSize + stepSize <= chrono.length;
      start += stepSize
    ) {
      const trainDraws = chrono.slice(start, start + windowSize).reverse();
      const testDraws = chrono
        .slice(start + windowSize, start + windowSize + stepSize)
        .reverse();

      // Generate predictions using simplified scoring
      const predictions = this.quickPredict4D(trainDraws, predictCount);

      // Check against test draws
      let hits = 0,
        top3Hits = 0,
        starterHits = 0,
        consolationHits = 0;
      for (const testDraw of testDraws) {
        for (const pred of predictions) {
          if (
            [testDraw.first, testDraw.second, testDraw.third].includes(pred)
          ) {
            hits++;
            top3Hits++;
          } else if (testDraw.starters.includes(pred)) {
            hits++;
            starterHits++;
          } else if (testDraw.consolation.includes(pred)) {
            hits++;
            consolationHits++;
          }
        }
      }

      results.push({
        trainStart: start,
        trainEnd: start + windowSize,
        testStart: start + windowSize,
        testEnd: start + windowSize + stepSize,
        predictions,
        hits,
        top3Hits,
        starterHits,
        consolationHits,
        hitRate: hits / (predictions.length * testDraws.length),
      });
    }

    // Summary statistics
    const totalHits = results.reduce((s, r) => s + r.hits, 0);
    const totalTests = results.reduce(
      (s, r) => s + r.predictions.length * stepSize,
      0,
    );
    const hitRates = results.map((r) => r.hitRate);
    const avgHitRate = hitRates.reduce((s, v) => s + v, 0) / hitRates.length;

    return {
      windows: results,
      summary: {
        totalWindows: results.length,
        totalHits,
        totalTests,
        avgHitRate,
        top3Hits: results.reduce((s, r) => s + r.top3Hits, 0),
        starterHits: results.reduce((s, r) => s + r.starterHits, 0),
        consolationHits: results.reduce((s, r) => s + r.consolationHits, 0),
      },
    };
  },

  // Walk-forward backtest for TOTO
  backtestToto(draws, windowSize = 20, stepSize = 3, setsCount = 3) {
    const results = [];
    const chrono = [...draws].reverse();

    for (
      let start = 0;
      start + windowSize + stepSize <= chrono.length;
      start += stepSize
    ) {
      const trainDraws = chrono.slice(start, start + windowSize).reverse();
      const testDraws = chrono
        .slice(start + windowSize, start + windowSize + stepSize)
        .reverse();

      const predictions = this.quickPredictToto(trainDraws, setsCount);

      let totalMatches = 0,
        maxMatches = 0;
      for (const testDraw of testDraws) {
        for (const predSet of predictions) {
          const matches = predSet.filter((n) =>
            testDraw.winning.includes(n),
          ).length;
          totalMatches += matches;
          maxMatches = Math.max(maxMatches, matches);
        }
      }

      results.push({
        trainStart: start,
        predictions,
        totalMatches,
        maxMatches,
        avgMatches: totalMatches / (predictions.length * testDraws.length),
      });
    }

    const avgMatches =
      results.reduce((s, r) => s + r.avgMatches, 0) / results.length;

    return {
      windows: results,
      summary: {
        totalWindows: results.length,
        avgMatchesPerSet: avgMatches,
        bestMatch: Math.max(...results.map((r) => r.maxMatches)),
        windows3Plus: results.filter((r) => r.maxMatches >= 3).length,
      },
    };
  },

  // Quick 4D prediction for backtesting (simplified - frequency + overdue + positional)
  quickPredict4D(draws, count) {
    const { posProb } = Analysis4D.positionalFrequency(draws);
    const { lastSeen } = Analysis4D.overdueAnalysis(draws);

    const candidates = [];
    // Sample 2000 random candidates and score them
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(Math.random() * 10000);
      const str = n.toString().padStart(4, "0");
      let score = 1;
      for (let p = 0; p < 4; p++) score *= posProb[p][parseInt(str[p])];
      const overdue =
        lastSeen[str] !== undefined ? lastSeen[str] / draws.length : 0.5;
      score *= 1 + overdue;
      candidates.push({ num: str, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, count).map((c) => c.num);
  },

  // Quick TOTO prediction for backtesting
  quickPredictToto(draws, setsCount) {
    const freq = AnalysisToto.numberFrequency(draws);
    const lastSeen = AnalysisToto.overdueAnalysis(draws);

    const scores = [];
    for (let n = 1; n <= 49; n++) {
      const freqScore = freq[n] / (Math.max(...freq.slice(1)) || 1);
      const overdueScore = Math.min(lastSeen[n] / (draws.length * 0.3), 1);
      scores.push({ num: n, score: freqScore * 0.6 + overdueScore * 0.4 });
    }
    scores.sort((a, b) => b.score - a.score);

    const sets = [];
    for (let s = 0; s < setsCount; s++) {
      // Pick from top candidates with some randomization
      const pool = scores.slice(0, 20);
      const set = new Set();
      while (set.size < 6) {
        const idx = Math.floor(Math.random() * pool.length);
        set.add(pool[idx].num);
      }
      sets.push([...set].sort((a, b) => a - b));
    }
    return sets;
  },

  // Calculate confidence interval for hit rate
  confidenceInterval(hitRate, n, confidence = 0.95) {
    const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
    const margin = z * Math.sqrt((hitRate * (1 - hitRate)) / n);
    return {
      lower: Math.max(0, hitRate - margin),
      upper: Math.min(1, hitRate + margin),
      margin,
    };
  },
};
