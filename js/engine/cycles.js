// Tier 3: Cycle & Recurrence Detection via Autocorrelation
const CycleEngine = {
  // Compute autocorrelation for a binary appearance series
  autocorrelation(series, maxLag) {
    const n = series.length;
    const mean = series.reduce((s, v) => s + v, 0) / n;
    const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    if (variance === 0) return Array(maxLag + 1).fill(0);

    const acf = [1]; // lag 0 = 1
    for (let k = 1; k <= maxLag; k++) {
      let sum = 0;
      for (let t = 0; t < n - k; t++) {
        sum += (series[t] - mean) * (series[t + k] - mean);
      }
      acf.push(sum / (n * variance));
    }
    return acf;
  },

  // Build binary appearance series for a 4D number across draws
  build4DAppearanceSeries(num, draws) {
    return draws
      .map((draw) => {
        const allNums = [
          draw.first,
          draw.second,
          draw.third,
          ...draw.starters,
          ...draw.consolation,
        ];
        return allNums.includes(num) ? 1 : 0;
      })
      .reverse(); // chronological order
  },

  // Build appearance series for a TOTO number
  buildTotoAppearanceSeries(num, draws) {
    return draws
      .map((draw) => {
        return draw.winning.includes(num) ? 1 : 0;
      })
      .reverse();
  },

  // Detect dominant cycles for a single number
  detectCycles(series, maxLag = 100) {
    const acf = this.autocorrelation(
      series,
      Math.min(maxLag, Math.floor(series.length / 2)),
    );
    const cycles = [];
    const threshold = 0.25;

    // Find peaks in autocorrelation (local maxima above threshold)
    for (let k = 2; k < acf.length - 1; k++) {
      if (acf[k] > threshold && acf[k] > acf[k - 1] && acf[k] > acf[k + 1]) {
        cycles.push({ lag: k, strength: acf[k] });
      }
    }
    cycles.sort((a, b) => b.strength - a.strength);
    return { acf, cycles: cycles.slice(0, 5) };
  },

  // Fit linear model to appearance times: t_i = a + b*i → slope b ≈ period
  fitPeriod(appearances) {
    if (appearances.length < 3) return null;
    const n = appearances.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const meanX = (n - 1) / 2;
    const meanY = appearances.reduce((s, v) => s + v, 0) / n;

    let numerator = 0,
      denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - meanX) * (appearances[i] - meanY);
      denominator += (i - meanX) ** 2;
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // R² for confidence
    const predicted = indices.map((i) => intercept + slope * i);
    const ssRes = appearances.reduce(
      (s, v, i) => s + (v - predicted[i]) ** 2,
      0,
    );
    const ssTot = appearances.reduce((s, v) => s + (v - meanY) ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Predict next appearance
    const nextAppearance = Math.round(intercept + slope * n);

    return {
      period: Math.round(slope),
      intercept,
      rSquared,
      nextPredicted: nextAppearance,
      confidence: Math.max(0, rSquared),
    };
  },

  // Analyze all 4D numbers for cyclical patterns
  analyze4DCycles(draws, topN = 50) {
    const allNums = new Set();
    for (const draw of draws) {
      [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ].forEach((n) => allNums.add(n));
    }

    const results = [];
    const totalDraws = draws.length;

    for (const num of allNums) {
      const series = this.build4DAppearanceSeries(num, draws);
      const { cycles } = this.detectCycles(
        series,
        Math.min(100, Math.floor(totalDraws / 3)),
      );

      // Get appearance indices for period fitting
      const appearances = [];
      for (let i = 0; i < series.length; i++) {
        if (series[i] === 1) appearances.push(i);
      }

      const periodFit = this.fitPeriod(appearances);
      const drawsSinceLast =
        appearances.length > 0
          ? totalDraws - 1 - appearances[appearances.length - 1]
          : totalDraws;

      // Cycle score: how likely this number is to appear based on cycles
      let cycleScore = 0;
      if (cycles.length > 0) {
        const dominantPeriod = cycles[0].lag;
        const cycleStrength = cycles[0].strength;
        // Is the number "due" based on its dominant cycle?
        const phaseInCycle = drawsSinceLast % dominantPeriod;
        const dueRatio = phaseInCycle / dominantPeriod;
        cycleScore = cycleStrength * dueRatio;
      }

      // Period prediction score
      let periodScore = 0;
      if (periodFit && periodFit.rSquared > 0.3) {
        const drawsUntilPredicted = periodFit.nextPredicted - totalDraws;
        if (drawsUntilPredicted <= 3 && drawsUntilPredicted >= -1) {
          periodScore = periodFit.confidence;
        }
      }

      results.push({
        num,
        cycles,
        periodFit,
        drawsSinceLast,
        cycleScore,
        periodScore,
        combinedScore: cycleScore * 0.6 + periodScore * 0.4,
      });
    }

    results.sort((a, b) => b.combinedScore - a.combinedScore);
    return results.slice(0, topN);
  },

  // Analyze TOTO numbers for cyclical patterns
  analyzeTotoCycles(draws) {
    const results = [];
    const totalDraws = draws.length;

    for (let num = 1; num <= 49; num++) {
      const series = this.buildTotoAppearanceSeries(num, draws);
      const { cycles } = this.detectCycles(
        series,
        Math.min(80, Math.floor(totalDraws / 3)),
      );

      const appearances = [];
      for (let i = 0; i < series.length; i++) {
        if (series[i] === 1) appearances.push(i);
      }

      const periodFit = this.fitPeriod(appearances);
      const drawsSinceLast =
        appearances.length > 0
          ? totalDraws - 1 - appearances[appearances.length - 1]
          : totalDraws;

      let cycleScore = 0;
      if (cycles.length > 0) {
        const dominantPeriod = cycles[0].lag;
        const cycleStrength = cycles[0].strength;
        const phaseInCycle = drawsSinceLast % dominantPeriod;
        const dueRatio = phaseInCycle / dominantPeriod;
        cycleScore = cycleStrength * dueRatio;
      }

      let periodScore = 0;
      if (periodFit && periodFit.rSquared > 0.3) {
        const drawsUntilPredicted = periodFit.nextPredicted - totalDraws;
        if (drawsUntilPredicted <= 3 && drawsUntilPredicted >= -1) {
          periodScore = periodFit.confidence;
        }
      }

      results.push({
        num,
        cycles,
        periodFit,
        drawsSinceLast,
        cycleScore,
        periodScore,
        combinedScore: cycleScore * 0.6 + periodScore * 0.4,
      });
    }

    results.sort((a, b) => b.combinedScore - a.combinedScore);
    return results;
  },
};
