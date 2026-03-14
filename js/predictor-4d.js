// 4D Prediction Engine v2 — Digit-Profile + Migration + Anti-Recency
const Predictor4D = {
  async generate(count = 10, options = {}) {
    const draws = DataLoader.get4DDraws(options.historyLimit || 100);
    if (draws.length < 10)
      throw new Error("Need at least 10 draws for analysis");

    const t0 = performance.now();

    // ===== Phase 1: Precompute all statistics ONCE =====
    const posFreqAll = Analysis4D.positionalFrequency(draws, 0.97);
    const posFreqStarters = Analysis4D.tierPositionalFrequency(
      draws,
      "starters",
      0.97,
    );
    const posFreqConsolation = Analysis4D.tierPositionalFrequency(
      draws,
      "consolation",
      0.97,
    );
    const digitTransitions = Analysis4D.digitTransitionProbs(draws, 0.97);
    const sumDist = Analysis4D.sumDistribution(draws);
    const pairCorr = Analysis4D.digitPairCorrelation(draws);
    const structProfile = Analysis4D.structuralProfile(draws);
    const hotCold = Analysis4D.hotColdNumbers(draws, 30);
    const overdue = Analysis4D.overdueAnalysis(draws);
    const ratios = Analysis4D.ratioAnalysis(draws);

    // ===== Phase 2: Anti-Recency — exclude ALL historical winners =====
    // 4D numbers are 93%+ unique across history — almost never repeat
    const recentNumbers = Analysis4D.getAllHistoricalNumbers(draws);

    // ===== Phase 3: Migration Neighbors =====
    const migrationNeighbors = Analysis4D.getMigrationNeighbors(draws, 3);

    // ===== Phase 4: Bayesian posteriors =====
    const bayesianScores = BayesianEngine.score4D(draws, 100);
    const bayesMap = new Map();
    for (const bs of bayesianScores) bayesMap.set(bs.num, bs.score);

    // ===== Phase 5: Markov positional transitions =====
    const markovPredictions = MarkovEngine.predict4D(draws, 100);
    const markovMap = new Map();
    for (const mp of markovPredictions) markovMap.set(mp.num, mp.score);

    // ===== Phase 6: Cycle detection =====
    const cycleResults = CycleEngine.analyze4DCycles(draws);
    const cycleMap = new Map();
    if (Array.isArray(cycleResults)) {
      for (const cp of cycleResults) cycleMap.set(cp.num, cp.combinedScore);
    }

    // ===== Phase 7: Migration engine scores =====
    const migrationScores = MigrationEngine.scoreMigration(draws);
    const migrationMap = new Map();
    if (Array.isArray(migrationScores)) {
      for (const ms of migrationScores)
        migrationMap.set(ms.num, ms.combinedScore);
    }

    // ===== Phase 8: Anomaly scan =====
    const anomalyReport = AnomalyEngine.scan4D(draws);

    // ===== Phase 9: SMART Candidate Generation =====
    const candidatePool = new Map();

    // --- Strategy A: Digit-by-digit conditional probability generation ---
    // Uses positional frequencies AND digit transition probabilities
    // to generate internally coherent numbers
    this._generateConditionalCandidates(
      candidatePool,
      posFreqAll.posProb,
      digitTransitions,
      sumDist,
      600,
      3.0,
    );

    // --- Strategy B: Starter-tier specific frequency generation ---
    this._generateConditionalCandidates(
      candidatePool,
      posFreqStarters.posProb,
      digitTransitions,
      sumDist,
      300,
      2.5,
    );

    // --- Strategy C: Migration neighbors — numbers near recent winners ---
    for (const [num, migScore] of migrationNeighbors) {
      if (!recentNumbers.has(num)) {
        candidatePool.set(num, (candidatePool.get(num) || 0) + migScore * 2.0);
      }
    }

    // --- Strategy D: Overdue numbers that haven't appeared in a while ---
    const overdueEntries = Object.entries(overdue.lastSeen)
      .filter(([num]) => !recentNumbers.has(num))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
    for (const [num, drawsAgo] of overdueEntries) {
      const overdueScore = Math.min(drawsAgo / (draws.length * 0.3), 1.5);
      candidatePool.set(
        num,
        (candidatePool.get(num) || 0) + overdueScore * 0.8,
      );
    }

    // --- Strategy E: Bayesian top picks (filtered) ---
    for (const bs of bayesianScores.slice(0, 60)) {
      if (!recentNumbers.has(bs.num)) {
        candidatePool.set(
          bs.num,
          (candidatePool.get(bs.num) || 0) + bs.score * 1.5,
        );
      }
    }

    // --- Strategy F: Markov top picks (filtered) ---
    for (const mp of markovPredictions.slice(0, 60)) {
      if (!recentNumbers.has(mp.num)) {
        candidatePool.set(
          mp.num,
          (candidatePool.get(mp.num) || 0) + mp.score * 1.2,
        );
      }
    }

    // ===== Phase 10: REMOVE recent winners from pool =====
    for (const num of recentNumbers) {
      candidatePool.delete(num);
    }

    // ===== Phase 11: Comprehensive Scoring =====
    const candidates = [];
    const maxPair = Math.max(...Object.values(pairCorr), 1);

    for (const [number, baseScore] of candidatePool) {
      const str = number.padStart(4, "0");
      const digits = str.split("").map(Number);

      // --- Score 1: Positional probability (geometric mean) ---
      let posScore = 1;
      for (let p = 0; p < 4; p++) posScore *= posFreqAll.posProb[p][digits[p]];
      posScore = Math.pow(posScore, 0.25);

      // --- Score 2: Digit transition coherence ---
      let transScore = 1;
      for (let p = 0; p < 3; p++) {
        transScore *= digitTransitions[p][digits[p]][digits[p + 1]];
      }
      transScore = Math.pow(transScore, 1 / 3);

      // --- Score 3: Digit sum fit ---
      const digitSum = digits.reduce((s, d) => s + d, 0);
      const sumFit =
        digitSum >= sumDist.sweetSpotLow && digitSum <= sumDist.sweetSpotHigh
          ? 1.0
          : 1.0 -
            Math.min(
              Math.min(
                Math.abs(digitSum - sumDist.sweetSpotLow),
                Math.abs(digitSum - sumDist.sweetSpotHigh),
              ) / 10,
              0.8,
            );

      // --- Score 4: Digit pair correlation ---
      let pairScore = 0;
      for (let i = 0; i < 3; i++) {
        const pair = str[i] + str[i + 1];
        pairScore += pairCorr[pair] || 0;
      }
      pairScore = pairScore / (3 * maxPair);

      // --- Score 5: Structural match ---
      const uniqDigits = new Set(digits).size;
      const oddCnt = digits.filter((d) => d % 2 !== 0).length;
      const highCnt = digits.filter((d) => d >= 5).length;
      const structScore =
        (structProfile.uniqueDigits[uniqDigits] || 0) * 0.4 +
        (structProfile.oddCount[oddCnt] || 0) * 0.3 +
        (structProfile.highCount[highCnt] || 0) * 0.3;

      // --- Score 6: Bayesian probability ---
      const bayesScore = bayesMap.get(number) || 0;

      // --- Score 7: Markov chain score ---
      const markovScore = markovMap.get(number) || 0;

      // --- Score 8: Cycle prediction score ---
      const cycleScore = cycleMap.get(number) || 0;

      // --- Score 9: Migration score ---
      const migScore = migrationMap.get(number) || 0;

      // --- Score 10: Migration neighbor proximity ---
      const neighborScore = migrationNeighbors.get(number) || 0;

      // --- Score 11: Anomaly bonus ---
      const anomalyScore =
        (anomalyReport.bonusScores && anomalyReport.bonusScores[number]) || 0;

      // ===== Weighted Ensemble — tuned for STARTER+ hit rate =====
      const weights = {
        positional: 0.14,
        transition: 0.12,
        sumFit: 0.1,
        pairCorr: 0.08,
        structural: 0.08,
        bayesian: 0.12,
        markov: 0.08,
        cycle: 0.04,
        migration: 0.06,
        neighbor: 0.1,
        anomaly: 0.04,
        base: 0.04,
      };

      // Normalize baseScore to [0, 1] range roughly
      const normBase = Math.min(baseScore / 5, 1);

      const ensembleScore =
        posScore * weights.positional +
        transScore * weights.transition +
        sumFit * weights.sumFit +
        pairScore * weights.pairCorr +
        structScore * weights.structural +
        bayesScore * weights.bayesian +
        markovScore * weights.markov +
        cycleScore * weights.cycle +
        migScore * weights.migration +
        neighborScore * weights.neighbor +
        anomalyScore * weights.anomaly +
        normBase * weights.base;

      // Tier score breakdown for UI
      const tierScores = {
        frequency: posScore,
        markov: markovScore,
        cycles: cycleScore,
        migration: migScore,
        bayesian: bayesScore,
        anomaly: anomalyScore,
      };

      // Count how many scoring dimensions contributed
      const contributing = [
        posScore,
        transScore,
        sumFit,
        pairScore,
        bayesScore,
        markovScore,
        cycleScore,
        migScore,
        neighborScore,
      ].filter((v) => v > 0.01).length;

      // Consensus bonus: more agreement = more reliable
      const consensusBonus = contributing >= 6 ? (contributing - 5) * 0.01 : 0;

      candidates.push({
        number,
        score: ensembleScore + consensusBonus,
        tierScores,
        confidence: this._calculateConfidence(tierScores, contributing),
        digitSum,
        neighborBoost: neighborScore > 0,
        migrationCandidate: migScore > 0,
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // ===== Phase 12: Diversity-Aware Selection =====
    const predictions = [];
    for (const c of candidates) {
      if (predictions.length >= count) break;
      // Reject if 3+ digits in same positions match any already selected
      const tooSimilar = predictions.some((p) => {
        let matching = 0;
        for (let pos = 0; pos < 4; pos++) {
          if (p.number[pos] === c.number[pos]) matching++;
        }
        return matching >= 3;
      });
      if (!tooSimilar) predictions.push(c);
    }

    // If we couldn't fill enough predictions, relax diversity constraint
    if (predictions.length < count) {
      for (const c of candidates) {
        if (predictions.length >= count) break;
        if (!predictions.some((p) => p.number === c.number)) {
          predictions.push(c);
        }
      }
    }

    const elapsed = performance.now() - t0;

    return {
      predictions,
      stats: {
        drawsAnalyzed: draws.length,
        candidatePoolSize: candidatePool.size,
        elapsedMs: Math.round(elapsed),
        latestDraw: draws[0],
        recentExcluded: recentNumbers.size,
        sumSweetSpot: `${sumDist.sweetSpotLow}-${sumDist.sweetSpotHigh}`,
      },
      analysis: {
        hotCold,
        sums: sumDist,
        ratios,
        anomalyReport,
        cycleResults,
      },
      weights: {
        tier1_frequency: 0.14,
        tier2_markov: 0.08,
        tier3_cycles: 0.04,
        tier4_migration: 0.16,
        tier5_bayesian: 0.12,
        tier6_structural: 0.08,
        transition: 0.12,
        sumFit: 0.1,
        pairCorr: 0.08,
        anomaly: 0.04,
        base: 0.04,
      },
    };
  },

  // Generate candidates using conditional digit probabilities with transition coherence
  _generateConditionalCandidates(
    pool,
    posProb,
    transitions,
    sumDist,
    count,
    scoreWeight,
  ) {
    for (let i = 0; i < count; i++) {
      const digits = [];

      // Pick first digit from positional probability
      digits.push(this._weightedPick(posProb[0]));

      // Pick remaining digits using BOTH positional probability AND transition from previous
      for (let p = 1; p < 4; p++) {
        const posDist = posProb[p];
        const transDist = transitions[p - 1][digits[p - 1]];

        // Blend: 40% positional, 60% transition (transition captures internal structure)
        const blended = [];
        for (let d = 0; d < 10; d++) {
          blended.push(posDist[d] * 0.4 + transDist[d] * 0.6);
        }
        // Normalize
        const total = blended.reduce((s, v) => s + v, 0);
        const normalized = blended.map((v) => v / total);
        digits.push(this._weightedPick(normalized));
      }

      const num = digits.join("");
      const digitSum = digits.reduce((s, d) => s + d, 0);

      // Only add if digit sum is in sweet spot or close to it
      const sumDist_ = Math.abs(
        digitSum - (sumDist.sweetSpotLow + sumDist.sweetSpotHigh) / 2,
      );
      const range = (sumDist.sweetSpotHigh - sumDist.sweetSpotLow) / 2;
      if (sumDist_ <= range * 1.5) {
        pool.set(num, (pool.get(num) || 0) + scoreWeight);
      }
    }
  },

  // Weighted random pick from a probability distribution
  _weightedPick(probs) {
    const r = Math.random();
    let cum = 0;
    for (let d = 0; d < probs.length; d++) {
      cum += probs[d];
      if (r <= cum) return d;
    }
    return probs.length - 1;
  },

  // Confidence score based on tier agreement and coverage
  _calculateConfidence(tierScores, contributing) {
    const vals = Object.values(tierScores).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance =
      vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const agreement = 1 / (1 + Math.sqrt(variance));
    const coverage = Math.min(contributing / 7, 1);
    return Math.min(1, agreement * 0.5 + coverage * 0.5);
  },

  // Legacy alias
  calculateConfidence(tierScores) {
    const vals = Object.values(tierScores).filter((v) => v > 0);
    return this._calculateConfidence(tierScores, vals.length);
  },
};
