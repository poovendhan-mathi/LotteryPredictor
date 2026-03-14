// TOTO Prediction Engine v2 — Multi-Dimensional Scoring + Constraint-Based Sets
const PredictorToto = {
  async generate(setsCount = 5, options = {}) {
    const draws = DataLoader.getTotoDraws(options.historyLimit || 80);
    if (draws.length < 10)
      throw new Error("Need at least 10 draws for analysis");

    const t0 = performance.now();

    // ===== Phase 1: Precompute ALL statistics =====
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
    const transitions = AnalysisToto.numberTransitions(draws, 0.95);
    const structProfile = AnalysisToto.structuralProfile(draws);

    // ===== Phase 2: Tier engines =====
    const markovPredictions = MarkovEngine.predictToto(draws, 30);
    const markovMap = new Map();
    for (const mp of markovPredictions) markovMap.set(mp.num, mp.score);

    const cycleResults = CycleEngine.analyzeTotoCycles(draws);
    const cycleMap = new Map();
    if (Array.isArray(cycleResults)) {
      for (const cp of cycleResults) cycleMap.set(cp.num, cp.combinedScore);
    }

    const bayesianScores = BayesianEngine.scoreToto(draws);
    const bayesMap = new Map();
    for (const bs of bayesianScores) bayesMap.set(bs.num, bs.score);

    const anomalyReport = AnomalyEngine.scanToto(draws);

    // ===== Phase 3: Transition-based predictions =====
    // Which numbers are likely based on what appeared in the LAST draw?
    const lastWinning = draws[0].winning;
    const transitionScores = Array(50).fill(0);
    for (const n of lastWinning) {
      if (transitions[n]) {
        for (let m = 1; m <= 49; m++) {
          transitionScores[m] += transitions[n][m];
        }
      }
    }
    // Normalize transition scores
    const maxTrans = Math.max(...transitionScores.slice(1), 0.001);

    // ===== Phase 4: Comprehensive Number Scoring (7 dimensions) =====
    const numberScores = [];
    for (let n = 1; n <= 49; n++) {
      const sr = AnalysisToto.scoreNumber(n, draws);

      // Dimension scores
      const dims = {
        frequency: sr.freqScore, // How often it appears
        overdue: sr.overdueScore, // How long since last seen
        gapRhythm: sr.gapScore, // Is it "due" by its gap pattern?
        trend: sr.trendScore, // Increasing or decreasing?
        markov: markovMap.get(n) || 0, // Markov chain prediction
        cycles: cycleMap.get(n) || 0, // Cycle detection
        bayesian: bayesMap.get(n) || 0, // Bayesian posterior
        anomaly:
          (anomalyReport.bonusScores && anomalyReport.bonusScores[n]) || 0,
        transition: transitionScores[n] / maxTrans, // Follow-on from last draw
        decade: sr.decadeScore, // Decade balance
      };

      // Weighted ensemble — balanced between data-driven and pattern methods
      const w = {
        frequency: 0.12,
        overdue: 0.1,
        gapRhythm: 0.1,
        trend: 0.08,
        markov: 0.12,
        cycles: 0.08,
        bayesian: 0.15,
        anomaly: 0.05,
        transition: 0.12,
        decade: 0.08,
      };

      let ensembleScore = 0;
      for (const [k, wt] of Object.entries(w))
        ensembleScore += (dims[k] || 0) * wt;

      // Consensus bonus: more dimensions agreeing = more reliable
      const activeCount = Object.values(dims).filter((v) => v > 0.1).length;
      const consensusBonus = activeCount >= 6 ? (activeCount - 5) * 0.005 : 0;

      const tierScores = {
        frequency: (dims.frequency + dims.trend) / 2,
        markov: dims.markov,
        cycles: dims.cycles,
        bayesian: dims.bayesian,
        anomaly: dims.anomaly,
      };

      numberScores.push({
        number: n,
        score: ensembleScore + consensusBonus,
        tierScores,
        dims,
      });
    }

    numberScores.sort((a, b) => b.score - a.score);

    // ===== Phase 5: Constraint-Based Set Generation =====
    const idealSum = sumData.idealRange;
    const targetOdd = oddEven.mostCommonSplit ? oddEven.mostCommonSplit.odd : 3;
    const targetHigh = hiLo.mostCommonSplit ? hiLo.mostCommonSplit.high : 3;
    const maxConsecAllowed = consec.rate > 0.5 ? 2 : 1; // If >50% draws have consecutive, allow some

    const sets = [];
    const usedSets = new Set(); // Avoid duplicate sets

    // Generate many candidate sets, keep the best
    const candidateSets = [];
    const strategies = [
      "top-constrained",
      "balanced-spread",
      "pair-cluster",
      "gap-driven",
      "transition-focus",
      "diverse-mix",
    ];

    for (let attempt = 0; attempt < setsCount * 30; attempt++) {
      const strategy = strategies[attempt % strategies.length];
      const set = this._buildConstrainedSet(
        numberScores,
        pairData,
        sumData,
        oddEven,
        hiLo,
        transitions,
        gaps,
        overdue,
        draws,
        strategy,
        targetOdd,
        targetHigh,
        idealSum,
        maxConsecAllowed,
      );

      if (!set || set.length !== 6) continue;

      const setKey = [...set].sort((a, b) => a - b).join("-");
      if (usedSets.has(setKey)) continue;
      usedSets.add(setKey);

      // Score the set
      const setScore = this._scoreSet(
        set,
        numberScores,
        pairData,
        tripletData,
        sumData,
        oddEven,
        hiLo,
        structProfile,
      );
      candidateSets.push({ numbers: set, ...setScore });
    }

    // Sort by set score and take top N
    candidateSets.sort((a, b) => b.score - a.score);

    // Pick diverse top sets (ensure different number compositions)
    for (const cs of candidateSets) {
      if (sets.length >= setsCount) break;
      const isDiverse = sets.every((existing) => {
        const overlap = existing.numbers.filter((n) =>
          cs.numbers.includes(n),
        ).length;
        return overlap <= 3; // Max 3 shared numbers between any two sets
      });
      if (isDiverse) sets.push(cs);
    }

    // Fallback: if we couldn't fill enough diverse sets, relax constraint
    if (sets.length < setsCount) {
      for (const cs of candidateSets) {
        if (sets.length >= setsCount) break;
        if (!sets.some((s) => s.numbers.join("-") === cs.numbers.join("-"))) {
          sets.push(cs);
        }
      }
    }

    const elapsed = performance.now() - t0;

    return {
      predictions: sets,
      numberRankings: numberScores.slice(0, 20),
      stats: {
        drawsAnalyzed: draws.length,
        elapsedMs: Math.round(elapsed),
        latestDraw: draws[0],
        candidateSetsGenerated: candidateSets.length,
        sumIdealRange: idealSum,
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
      weights: {
        frequency: 0.12,
        overdue: 0.1,
        gapRhythm: 0.1,
        trend: 0.08,
        markov: 0.12,
        cycles: 0.08,
        bayesian: 0.15,
        anomaly: 0.05,
        transition: 0.12,
        decade: 0.08,
      },
    };
  },

  // Build a single set with hard structural constraints
  _buildConstrainedSet(
    numberScores,
    pairData,
    sumData,
    oddEven,
    hiLo,
    transitions,
    gaps,
    overdue,
    draws,
    strategy,
    targetOdd,
    targetHigh,
    idealSum,
    maxConsec,
  ) {
    const set = [];
    const used = new Set();
    const maxAttempts = 300;

    // Create weighted pool based on strategy
    let pool;
    switch (strategy) {
      case "top-constrained":
        // Top-ranked numbers with constraint enforcement
        pool = numberScores.slice(0, 25);
        break;
      case "balanced-spread":
        // Ensure good spread: pick from each decade
        pool = numberScores.slice(0, 35);
        break;
      case "pair-cluster":
        // Start with a strong pair, build around it
        pool = numberScores.slice(0, 30);
        break;
      case "gap-driven":
        // Favor numbers that are overdue by their gap pattern
        pool = [...numberScores]
          .sort(
            (a, b) =>
              b.dims.gapRhythm +
              b.dims.overdue -
              (a.dims.gapRhythm + a.dims.overdue),
          )
          .slice(0, 25);
        break;
      case "transition-focus":
        // Favor numbers predicted by transitions from last draw
        pool = [...numberScores]
          .sort(
            (a, b) =>
              b.dims.transition + b.score - (a.dims.transition + a.score),
          )
          .slice(0, 25);
        break;
      case "diverse-mix":
        // Mix: 2 from top, 2 from middle, 2 from gap-driven
        pool = numberScores.slice(0, 40);
        break;
      default:
        pool = numberScores.slice(0, 25);
    }

    // For pair-cluster: seed with a top pair
    if (strategy === "pair-cluster" && pairData.topPairs.length > 0) {
      const pairIdx = Math.floor(
        Math.random() * Math.min(10, pairData.topPairs.length),
      );
      const [pairKey] = pairData.topPairs[pairIdx];
      const [a, b] = pairKey.split("-").map(Number);
      // Only use if both are in the top pool
      if (
        pool.some((p) => p.number === a) &&
        pool.some((p) => p.number === b)
      ) {
        set.push(a, b);
        used.add(a);
        used.add(b);
      }
    }

    for (let attempt = 0; attempt < maxAttempts && set.length < 6; attempt++) {
      // Pick from pool with score-weighted probability
      let pick;
      if (strategy === "diverse-mix" && set.length < 2) {
        pick = pool[Math.floor(Math.random() * 8)];
      } else if (strategy === "diverse-mix" && set.length < 4) {
        pick = pool[Math.floor(Math.random() * Math.min(25, pool.length))];
      } else {
        // Score-weighted selection from pool
        const availPool = pool.filter((p) => !used.has(p.number));
        if (availPool.length === 0) break;
        const totalScore = availPool.reduce((s, p) => s + p.score, 0);
        let r = Math.random() * totalScore;
        pick = availPool[availPool.length - 1];
        for (const p of availPool) {
          r -= p.score;
          if (r <= 0) {
            pick = p;
            break;
          }
        }
      }

      if (!pick || used.has(pick.number)) continue;

      // ===== Constraint checks =====
      const candidate = [...set, pick.number];
      const sorted = candidate.sort((a, b) => a - b);

      // 1. Consecutive constraint
      let maxConsecCount = 1,
        curConsecCount = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
          curConsecCount++;
          maxConsecCount = Math.max(maxConsecCount, curConsecCount);
        } else curConsecCount = 1;
      }
      if (maxConsecCount > maxConsec + 1) continue;

      // 2. Odd/Even balance check (flexible — allow ±1 from target)
      if (set.length >= 4) {
        const oddCount = candidate.filter((n) => n % 2 !== 0).length;
        const remaining = 6 - candidate.length;
        if (oddCount > targetOdd + 1 + remaining) continue;
        if (candidate.length === 6 && Math.abs(oddCount - targetOdd) > 1)
          continue;
      }

      // 3. High/Low balance check
      if (set.length >= 4) {
        const highCount = candidate.filter((n) => n >= 25).length;
        const remaining = 6 - candidate.length;
        if (highCount > targetHigh + 1 + remaining) continue;
        if (candidate.length === 6 && Math.abs(highCount - targetHigh) > 1)
          continue;
      }

      // 4. Sum range check on final set
      if (candidate.length === 6) {
        const sum = candidate.reduce((s, n) => s + n, 0);
        if (sum < idealSum[0] - 15 || sum > idealSum[1] + 15) continue;
      }

      // 5. Spread check — avoid all numbers from same narrow range
      if (candidate.length >= 4) {
        const range = Math.max(...candidate) - Math.min(...candidate);
        if (range < 15) continue; // Too clustered
      }

      set.push(pick.number);
      used.add(pick.number);
    }

    // Fallback fill
    if (set.length < 6) {
      for (const ns of numberScores) {
        if (!used.has(ns.number)) {
          set.push(ns.number);
          used.add(ns.number);
        }
        if (set.length >= 6) break;
      }
    }

    return set.sort((a, b) => a - b);
  },

  // Score a complete set of 6 numbers
  _scoreSet(
    set,
    numberScores,
    pairData,
    tripletData,
    sumData,
    oddEven,
    hiLo,
    structProfile,
  ) {
    const sorted = [...set].sort((a, b) => a - b);

    // 1. Sum of individual number scores
    let numberScore = 0;
    for (const n of set) {
      const ns = numberScores.find((x) => x.number === n);
      numberScore += ns ? ns.score : 0;
    }

    // 2. Pair affinity bonus
    let pairBonus = 0;
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        const key = Math.min(set[i], set[j]) + "-" + Math.max(set[i], set[j]);
        pairBonus += pairData.pairCount[key] || 0;
      }
    }

    // 3. Triplet bonus
    let tripletBonus = 0;
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        for (let k = j + 1; k < set.length; k++) {
          const nums = [set[i], set[j], set[k]].sort((a, b) => a - b);
          const key = nums.join("-");
          tripletBonus += tripletData.tripCount[key] || 0;
        }
      }
    }

    // 4. Sum fit score
    const sum = set.reduce((s, n) => s + n, 0);
    const sumCenter = (sumData.idealRange[0] + sumData.idealRange[1]) / 2;
    const sumRange = (sumData.idealRange[1] - sumData.idealRange[0]) / 2;
    const sumFit =
      sum >= sumData.idealRange[0] && sum <= sumData.idealRange[1]
        ? 1.0
        : Math.max(0, 1.0 - Math.abs(sum - sumCenter) / (sumRange * 2));

    // 5. Structural fit
    const oddCount = set.filter((n) => n % 2 !== 0).length;
    const highCount = set.filter((n) => n >= 25).length;
    const structFit =
      (structProfile.oddCounts[oddCount] || 0) * 0.5 +
      (structProfile.highCounts[highCount] || 0) * 0.5;

    // 6. Spread score — good distribution across 1-49 range
    const spread = sorted[5] - sorted[0];
    const spreadFit = spread >= 25 && spread <= 42 ? 1.0 : 0.5;

    const score =
      numberScore * 1.0 +
      pairBonus * 0.15 +
      tripletBonus * 0.3 +
      sumFit * 0.5 +
      structFit * 0.3 +
      spreadFit * 0.2;

    return {
      score,
      sum,
      oddCount,
      highCount,
      confidence: this._calculateSetConfidence(
        set,
        numberScores,
        sumFit,
        structFit,
      ),
    };
  },

  _calculateSetConfidence(set, numberScores, sumFit, structFit) {
    const setScores = set.map((n) => {
      const ns = numberScores.find((x) => x.number === n);
      return ns ? ns.score : 0;
    });
    const mean = setScores.reduce((s, v) => s + v, 0) / setScores.length;
    const maxPossible = numberScores[0] ? numberScores[0].score : 1;
    const scoreConf = Math.min(1, mean / (maxPossible * 0.5));
    // Blend score confidence with structural fit
    return scoreConf * 0.6 + sumFit * 0.2 + structFit * 0.2;
  },
};
