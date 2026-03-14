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

  // Quick 4D prediction for backtesting (v2 — profile matching + anti-recency)
  quickPredict4D(draws, count) {
    const { posProb } = Analysis4D.positionalFrequency(draws);
    const transitions = Analysis4D.digitTransitionProbs(draws);
    const sumDist = Analysis4D.sumDistribution(draws);
    const recentNumbers = Analysis4D.getAllHistoricalNumbers(draws);

    const candidates = [];
    // Generate candidates using conditional probabilities
    for (let i = 0; i < 3000; i++) {
      const digits = [];
      // First digit from positional probability
      const r0 = Math.random();
      let cum0 = 0;
      for (let d = 0; d <= 9; d++) {
        cum0 += posProb[0][d];
        if (r0 <= cum0) {
          digits.push(d);
          break;
        }
      }
      if (digits.length === 0) digits.push(0);
      // Remaining digits: blend positional + transition
      for (let p = 1; p < 4; p++) {
        const blended = [];
        for (let d = 0; d < 10; d++) {
          blended.push(
            posProb[p][d] * 0.4 + transitions[p - 1][digits[p - 1]][d] * 0.6,
          );
        }
        const total = blended.reduce((s, v) => s + v, 0);
        const r = Math.random();
        let cum = 0;
        let picked = 0;
        for (let d = 0; d < 10; d++) {
          cum += blended[d] / total;
          if (r <= cum) {
            picked = d;
            break;
          }
        }
        digits.push(picked);
      }
      const str = digits.join("");
      if (recentNumbers.has(str)) continue;
      const digitSum = digits.reduce((s, d) => s + d, 0);
      // Score: positional probability × sum fit
      let score = 1;
      for (let p = 0; p < 4; p++) score *= posProb[p][digits[p]];
      const sumFit =
        digitSum >= sumDist.sweetSpotLow && digitSum <= sumDist.sweetSpotHigh
          ? 1.5
          : 1.0;
      score *= sumFit;
      candidates.push({ num: str, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    // Diversity filter
    const result = [];
    for (const c of candidates) {
      if (result.length >= count) break;
      const tooSimilar = result.some((r) => {
        let match = 0;
        for (let p = 0; p < 4; p++) if (r[p] === c.num[p]) match++;
        return match >= 3;
      });
      if (!tooSimilar) result.push(c.num);
    }
    return result;
  },

  // Quick TOTO prediction for backtesting (v2 — multi-dimensional + constrained)
  quickPredictToto(draws, setsCount) {
    const freq = AnalysisToto.numberFrequency(draws);
    const lastSeen = AnalysisToto.overdueAnalysis(draws);
    const gaps = AnalysisToto.gapAnalysis(draws);
    const sumData = AnalysisToto.sumAnalysis(draws);
    const pairData = AnalysisToto.pairAnalysis(draws);

    // Multi-dimensional scoring
    const maxFreq = Math.max(...freq.slice(1), 1);
    const scores = [];
    for (let n = 1; n <= 49; n++) {
      const freqScore = freq[n] / maxFreq;
      const overdueScore = Math.min(lastSeen[n] / (draws.length * 0.3), 1);
      // Gap rhythm
      const avgGap = gaps.avgGaps[n];
      const drawsSince = lastSeen[n];
      let gapScore = 0;
      if (avgGap > 0 && avgGap < draws.length) {
        const ratio = drawsSince / avgGap;
        gapScore = Math.exp((-0.5 * Math.pow(ratio - 1, 2)) / 0.25);
      }
      scores.push({
        num: n,
        score: freqScore * 0.35 + overdueScore * 0.3 + gapScore * 0.35,
      });
    }
    scores.sort((a, b) => b.score - a.score);

    const idealSum = sumData.idealRange;
    const sets = [];
    for (let s = 0; s < setsCount; s++) {
      const pool = scores.slice(0, 25 + s * 3);
      let bestSet = null,
        bestScore = -1;
      // Try multiple random draws, keep the best
      for (let attempt = 0; attempt < 100; attempt++) {
        const set = new Set();
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (const p of shuffled) {
          if (set.size >= 6) break;
          set.add(p.num);
        }
        if (set.size < 6) continue;
        const arr = [...set].sort((a, b) => a - b);
        const sum = arr.reduce((s, n) => s + n, 0);
        // Check sum range
        if (sum < idealSum[0] - 20 || sum > idealSum[1] + 20) continue;
        // Score: sum of individual scores + pair bonus
        let score = 0;
        for (const n of arr) {
          const ns = scores.find((x) => x.num === n);
          score += ns ? ns.score : 0;
        }
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const key = arr[i] + "-" + arr[j];
            score += (pairData.pairCount[key] || 0) * 0.1;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestSet = arr;
        }
      }
      if (bestSet) sets.push(bestSet);
      else {
        // Fallback
        const set = new Set();
        for (const p of pool) {
          if (set.size >= 6) break;
          set.add(p.num);
        }
        sets.push([...set].sort((a, b) => a - b));
      }
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
