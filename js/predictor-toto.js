// TOTO Prediction Orchestrator — calls all tiers → ensemble → anomaly → output
const PredictorToto = {
  async generate(setsCount = 5, options = {}) {
    const draws = DataLoader.getTotoDraws(options.historyLimit || 80);
    if (draws.length < 10)
      throw new Error("Need at least 10 draws for analysis");

    const t0 = performance.now();

    // ===== Tier 1: Foundational Statistics =====
    const freq = AnalysisToto.numberFrequency(draws);
    const hotCold = AnalysisToto.hotColdNumbers(draws);
    const overdue = AnalysisToto.overdueAnalysis(draws);
    const gaps = AnalysisToto.gapAnalysis(draws);
    const delta = AnalysisToto.deltaAnalysis(draws);
    const pairData = AnalysisToto.pairAnalysis(draws);
    const tripletData = AnalysisToto.tripletAnalysis(draws);
    const sumData = AnalysisToto.sumAnalysis(draws);
    const oddEven = AnalysisToto.oddEvenDistribution(draws);
    const hiLo = AnalysisToto.highLowDistribution(draws);
    const consec = AnalysisToto.consecutiveAnalysis(draws);

    // ===== Tier 2: Markov Chains =====
    const markovPredictions = MarkovEngine.predictToto(draws, 30);

    // ===== Tier 3: Cycle Detection =====
    const cycleResults = CycleEngine.analyzeTotoCycles(draws);

    // ===== Tier 5: Bayesian Posteriors =====
    const bayesianScores = BayesianEngine.scoreToto(draws);

    // ===== Tier 6: Anomaly Scan =====
    const anomalyReport = AnomalyEngine.scanToto(draws);

    // ===== Number Scoring (1-49) =====
    const numberScores = [];
    for (let n = 1; n <= 49; n++) {
      const scoreResult = AnalysisToto.scoreNumber(n, draws);
      const freqScore = (scoreResult.freqScore + scoreResult.overdueScore) / 2;
      const tierScores = {
        frequency: freqScore,
        markov: 0,
        cycles: 0,
        bayesian: 0,
        anomaly: 0,
      };

      // Markov score
      const mp = markovPredictions.find((p) => p.num === n);
      tierScores.markov = mp ? mp.score : 0;

      // Cycle score
      if (Array.isArray(cycleResults)) {
        const cp = cycleResults.find((p) => p.num === n);
        tierScores.cycles = cp ? cp.combinedScore : 0;
      }

      // Bayesian score
      const bs = bayesianScores.find((s) => s.num === n);
      tierScores.bayesian = bs ? bs.score : 0;

      // Anomaly bonus (per-number bonus)
      tierScores.anomaly =
        (anomalyReport.bonusScores && anomalyReport.bonusScores[n]) || 0;

      // Inline weighted sum
      const w = {
        frequency: 0.2,
        markov: 0.2,
        cycles: 0.15,
        bayesian: 0.25,
        anomaly: 0.2,
      };
      let ensembleScore = 0;
      for (const [k, wt] of Object.entries(w))
        ensembleScore += (tierScores[k] || 0) * wt;

      numberScores.push({
        number: n,
        score: ensembleScore,
        tierScores,
      });
    }

    numberScores.sort((a, b) => b.score - a.score);

    // ===== Generate Sets =====
    const sets = [];
    for (let s = 0; s < setsCount; s++) {
      const set = this.buildSet(
        numberScores,
        pairData,
        sumData,
        oddEven,
        hiLo,
        consec,
        s,
      );
      const setScoreTotal = set.reduce((acc, n) => {
        const ns = numberScores.find((x) => x.number === n);
        return acc + (ns ? ns.score : 0);
      }, 0);

      // Pair affinity bonus
      let pairBonus = 0;
      for (let i = 0; i < set.length; i++) {
        for (let j = i + 1; j < set.length; j++) {
          const pairKey =
            Math.min(set[i], set[j]) + "-" + Math.max(set[i], set[j]);
          pairBonus += pairData.pairCount[pairKey] || 0;
        }
      }

      sets.push({
        numbers: set,
        score: setScoreTotal + pairBonus * 0.2,
        sum: set.reduce((a, b) => a + b, 0),
        oddCount: set.filter((n) => n % 2 !== 0).length,
        highCount: set.filter((n) => n >= 25).length,
        confidence: this.calculateSetConfidence(set, numberScores),
      });
    }

    // Sort sets by score
    sets.sort((a, b) => b.score - a.score);

    const elapsed = performance.now() - t0;

    return {
      predictions: sets,
      numberRankings: numberScores.slice(0, 20),
      stats: {
        drawsAnalyzed: draws.length,
        elapsedMs: Math.round(elapsed),
        latestDraw: draws[0],
      },
      analysis: {
        hotCold,
        sumData,
        oddEven,
        hiLo,
        delta,
        consec,
        anomalyReport,
        cycleResults,
      },
      weights: EnsembleEngine.defaultWeightsToto,
    };
  },

  // Build a single set of 6 numbers with constraints
  buildSet(numberScores, pairData, sumData, oddEven, hiLo, consec, setIndex) {
    const targetOdd = oddEven.mostCommonSplit ? oddEven.mostCommonSplit.odd : 3;
    const targetHigh = hiLo.mostCommonSplit ? hiLo.mostCommonSplit.high : 3;

    // Use different strategies per set for diversity
    const strategies = [
      "top",
      "balanced",
      "overdue-mix",
      "pair-focus",
      "spread",
    ];
    const strategy = strategies[setIndex % strategies.length];

    const pool = [...numberScores];
    const set = new Set();
    const maxAttempts = 200;
    let attempts = 0;

    while (set.size < 6 && attempts < maxAttempts) {
      attempts++;
      let pick;

      switch (strategy) {
        case "top":
          // Straight top scores with slight noise
          pick = pool[Math.floor(Math.random() * Math.min(15, pool.length))];
          break;
        case "balanced":
          // Balance odd/even and high/low
          pick = this.pickBalanced(pool, set, targetOdd, targetHigh);
          break;
        case "overdue-mix":
          // Mix top scores with some deeper picks
          if (set.size < 3) pick = pool[Math.floor(Math.random() * 10)];
          else pick = pool[Math.floor(Math.random() * 30)];
          break;
        case "pair-focus":
          // Pick numbers with high pair affinity to already-selected
          pick = this.pickByPairAffinity(pool, set, pairData);
          break;
        case "spread":
          // Ensure good number spread across range
          pick = this.pickSpread(pool, set);
          break;
        default:
          pick = pool[Math.floor(Math.random() * 12)];
      }

      if (!pick) pick = pool[Math.floor(Math.random() * pool.length)];

      // Validate: check sum won't go out of common range
      const currentNums = [...set, pick.number];
      const partialSum = currentNums.reduce((a, b) => a + b, 0);
      if (set.size === 5) {
        // Final number: check total sum is in reasonable range (100-200 is typical)
        if (partialSum < 80 || partialSum > 220) continue;
      }

      // Avoid too many consecutive numbers
      const sorted = [...currentNums].sort((a, b) => a - b);
      let maxConsec = 1,
        curConsec = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          curConsec++;
          maxConsec = Math.max(maxConsec, curConsec);
        } else curConsec = 1;
      }
      if (maxConsec > 3) continue;

      set.add(pick.number);
    }

    // Fallback: fill remaining with top scores
    if (set.size < 6) {
      for (const ns of numberScores) {
        if (!set.has(ns.number)) set.add(ns.number);
        if (set.size >= 6) break;
      }
    }

    return [...set].sort((a, b) => a - b);
  },

  pickBalanced(pool, currentSet, targetOdd, targetHigh) {
    const nums = [...currentSet];
    const currentOdd = nums.filter((n) => n % 2 !== 0).length;
    const currentHigh = nums.filter((n) => n >= 25).length;
    const remaining = 6 - currentSet.size;

    const needOdd = targetOdd - currentOdd;
    const needHigh = targetHigh - currentHigh;

    // Filter pool to satisfy balance
    let filtered = pool.filter((p) => {
      if (currentSet.has(p.number)) return false;
      const isOdd = p.number % 2 !== 0;
      const isHigh = p.number >= 25;
      if (needOdd > 0 && remaining <= needOdd && !isOdd) return false;
      if (needHigh > 0 && remaining <= needHigh && !isHigh) return false;
      return true;
    });

    if (filtered.length === 0)
      filtered = pool.filter((p) => !currentSet.has(p.number));
    return filtered[Math.floor(Math.random() * Math.min(12, filtered.length))];
  },

  pickByPairAffinity(pool, currentSet, pairData) {
    if (currentSet.size === 0) return pool[Math.floor(Math.random() * 10)];

    const nums = [...currentSet];
    let best = null,
      bestAffinity = -1;
    const candidates = pool
      .filter((p) => !currentSet.has(p.number))
      .slice(0, 25);

    for (const c of candidates) {
      let aff = 0;
      for (const n of nums) {
        const pk = Math.min(n, c.number) + "-" + Math.max(n, c.number);
        aff += pairData.pairCount[pk] || 0;
      }
      aff += c.score * 0.5;
      if (aff > bestAffinity) {
        bestAffinity = aff;
        best = c;
      }
    }
    return best;
  },

  pickSpread(pool, currentSet) {
    const nums = [...currentSet].sort((a, b) => a - b);
    const candidates = pool.filter((p) => !currentSet.has(p.number));

    if (nums.length === 0) return candidates[Math.floor(Math.random() * 10)];

    // Find the biggest gap in current selection vs ideal spread
    const idealSpread = [1, 10, 20, 30, 40, 49];
    let bestGapCandidate = null,
      bestFit = Infinity;

    for (const c of candidates.slice(0, 20)) {
      const allNums = [...nums, c.number].sort((a, b) => a - b);
      let deviation = 0;
      for (let i = 0; i < allNums.length && i < idealSpread.length; i++) {
        deviation += Math.abs(allNums[i] - idealSpread[i]);
      }
      deviation -= c.score * 5; // Favor higher scores
      if (deviation < bestFit) {
        bestFit = deviation;
        bestGapCandidate = c;
      }
    }
    return bestGapCandidate;
  },

  calculateSetConfidence(set, numberScores) {
    const setScores = set.map((n) => {
      const ns = numberScores.find((x) => x.number === n);
      return ns ? ns.score : 0;
    });
    const mean = setScores.reduce((s, v) => s + v, 0) / setScores.length;
    const maxPossible = numberScores[0] ? numberScores[0].score : 1;
    return Math.min(1, mean / (maxPossible * 0.6));
  },
};
