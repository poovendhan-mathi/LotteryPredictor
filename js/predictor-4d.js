// 4D Prediction Orchestrator — calls all tiers → ensemble → anomaly → output
const Predictor4D = {
  async generate(count = 10, options = {}) {
    const draws = DataLoader.get4DDraws(options.historyLimit || 100);
    if (draws.length < 10)
      throw new Error("Need at least 10 draws for analysis");

    const t0 = performance.now();

    // ===== Tier 1: Foundational Statistics =====
    const freq = Analysis4D.numberFrequency(draws);
    const posFreq = Analysis4D.positionalFrequency(draws);
    const hotCold = Analysis4D.hotColdNumbers(draws);
    const overdue = Analysis4D.overdueAnalysis(draws);
    const gaps = Analysis4D.gapAnalysis(draws);
    const pairs = Analysis4D.digitPairCorrelation(draws);
    const sums = Analysis4D.sumDistribution(draws);
    const ratios = Analysis4D.ratioAnalysis(draws);

    // ===== Tier 2: Markov Chains =====
    const markovPredictions = MarkovEngine.predict4D(draws, 50);

    // ===== Tier 3: Cycle Detection =====
    const cycleResults = CycleEngine.analyze4DCycles(draws);

    // ===== Tier 4: Migration Tracking =====
    const migrationScores = MigrationEngine.scoreMigration(draws);

    // ===== Tier 5: Bayesian Posteriors =====
    const bayesianScores = BayesianEngine.score4D(draws);

    // ===== Tier 6: Anomaly Scan =====
    const anomalyReport = AnomalyEngine.scan4D(draws);

    // ===== Candidate Generation =====
    // Generate a large pool of candidate numbers
    const candidatePool = new Map();

    // Add from Markov predictions
    for (const mp of markovPredictions) {
      candidatePool.set(
        mp.num,
        (candidatePool.get(mp.num) || 0) + mp.score * 2,
      );
    }

    // Add from cycle predictions
    if (Array.isArray(cycleResults)) {
      for (const cp of cycleResults) {
        candidatePool.set(
          cp.num,
          (candidatePool.get(cp.num) || 0) + cp.combinedScore * 1.5,
        );
      }
    }

    // Add from migration engine (promoted numbers)
    if (Array.isArray(migrationScores)) {
      for (const ms of migrationScores.slice(0, 30)) {
        candidatePool.set(
          ms.num,
          (candidatePool.get(ms.num) || 0) + ms.combinedScore * 1.5,
        );
      }
    }

    // Add hot numbers from Tier 1 (hotCold.hot are [numStr, freq] tuples)
    for (const entry of hotCold.hot.slice(0, 30)) {
      const num = entry[0];
      candidatePool.set(num, (candidatePool.get(num) || 0) + 1);
    }

    // Add overdue numbers
    const overdueEntries = Object.entries(overdue.lastSeen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
    for (const [num, drawsAgo] of overdueEntries) {
      candidatePool.set(
        num,
        (candidatePool.get(num) || 0) + drawsAgo / draws.length,
      );
    }

    // Add random high-positional-probability numbers
    for (let i = 0; i < 200; i++) {
      let num = "";
      for (let p = 0; p < 4; p++) {
        const probs = posFreq.posProb[p];
        const r = Math.random();
        let cum = 0;
        for (let d = 0; d <= 9; d++) {
          cum += probs[d];
          if (r <= cum) {
            num += d;
            break;
          }
        }
      }
      num = num.padEnd(4, "0").slice(0, 4);
      candidatePool.set(num, (candidatePool.get(num) || 0) + 0.5);
    }

    // ===== Ensemble Scoring =====
    const candidates = [];
    for (const [number, baseScore] of candidatePool) {
      const scoreResult = Analysis4D.scoreNumber(number, draws);
      const freqScore =
        (scoreResult.posScore +
          scoreResult.hotScore +
          scoreResult.overdueScore +
          scoreResult.pairScore +
          scoreResult.sumFit) /
        5;
      const tierScores = {
        frequency: freqScore,
        markov: 0,
        cycles: 0,
        migration: 0,
        bayesian: 0,
        anomaly: 0,
      };

      // Markov score
      const mp = markovPredictions.find((p) => p.num === number);
      tierScores.markov = mp ? mp.score : 0;

      // Bayesian score
      const bs = bayesianScores.find((s) => s.num === number);
      tierScores.bayesian = bs ? bs.score : 0;

      // Migration score
      if (Array.isArray(migrationScores)) {
        const ms = migrationScores.find((s) => s.num === number);
        tierScores.migration = ms ? ms.combinedScore : 0;
      }

      // Anomaly bonus (per-number bonus from overrepresented patterns)
      tierScores.anomaly =
        (anomalyReport.bonusScores && anomalyReport.bonusScores[number]) || 0;

      // Inline weighted sum (matches simple tierScores format)
      const w = {
        frequency: 0.15,
        markov: 0.2,
        cycles: 0.15,
        migration: 0.15,
        bayesian: 0.2,
        anomaly: 0.15,
      };
      let ensembleScore = 0;
      for (const [k, wt] of Object.entries(w))
        ensembleScore += (tierScores[k] || 0) * wt;

      candidates.push({
        number,
        score: ensembleScore,
        tierScores,
        confidence: this.calculateConfidence(tierScores),
      });
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Diversity filter: ensure predictions aren't too similar
    const predictions = [];
    for (const c of candidates) {
      if (predictions.length >= count) break;
      // Reject if 3+ digits match any already selected
      const tooSimilar = predictions.some((p) => {
        let matching = 0;
        for (let pos = 0; pos < 4; pos++) {
          if (p.number[pos] === c.number[pos]) matching++;
        }
        return matching >= 3;
      });
      if (!tooSimilar) predictions.push(c);
    }

    const elapsed = performance.now() - t0;

    return {
      predictions,
      stats: {
        drawsAnalyzed: draws.length,
        candidatePoolSize: candidatePool.size,
        elapsedMs: Math.round(elapsed),
        latestDraw: draws[0],
      },
      analysis: {
        hotCold,
        sums,
        ratios,
        anomalyReport,
        cycleResults,
      },
      weights: EnsembleEngine.defaultWeights4D,
    };
  },

  // Confidence score 0-1 based on tier agreement
  calculateConfidence(tierScores) {
    const vals = Object.values(tierScores).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance =
      vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    // Lower variance = higher confidence (more tiers agree)
    const agreement = 1 / (1 + Math.sqrt(variance));
    // Also factor in how many tiers contributed
    const coverage = vals.length / 6;
    return Math.min(1, agreement * 0.6 + coverage * 0.4);
  },
};
