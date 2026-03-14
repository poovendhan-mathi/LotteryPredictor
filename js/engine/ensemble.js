// Ensemble Scoring Engine
// Combines predictions from all tiers into a unified ranking
const EnsembleEngine = {
  // Default weights for each tier
  defaultWeights4D: {
    tier1_frequency: 0.15,
    tier2_markov: 0.2,
    tier3_cycles: 0.15,
    tier4_migration: 0.15,
    tier5_bayesian: 0.2,
    tier6_genetic: 0.15,
  },

  defaultWeightsToto: {
    tier1_frequency: 0.2,
    tier2_markov: 0.2,
    tier3_cycles: 0.15,
    tier5_bayesian: 0.25,
    tier6_genetic: 0.2,
  },

  // Normalize scores to [0, 1] range
  normalize(scores) {
    if (scores.length === 0) return [];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;
    return scores.map((s) => (range > 0 ? (s - min) / range : 0.5));
  },

  // Method A: Weighted Sum Ensemble for 4D
  weightedSum4D(tierResults, weights = null) {
    const w = weights || this.defaultWeights4D;
    const combined = {};

    // Tier 1: Frequency-based scores
    if (tierResults.tier1) {
      for (const item of tierResults.tier1) {
        if (!combined[item.num]) combined[item.num] = { scores: {}, raw: {} };
        combined[item.num].scores.tier1 = item.score || 0;
        combined[item.num].raw.tier1 = item;
      }
    }

    // Tier 2: Markov
    if (tierResults.tier2) {
      for (const item of tierResults.tier2) {
        if (!combined[item.num]) combined[item.num] = { scores: {}, raw: {} };
        combined[item.num].scores.tier2 = item.score || 0;
        combined[item.num].raw.tier2 = item;
      }
    }

    // Tier 3: Cycles
    if (tierResults.tier3) {
      for (const item of tierResults.tier3) {
        if (!combined[item.num]) combined[item.num] = { scores: {}, raw: {} };
        combined[item.num].scores.tier3 = item.combinedScore || 0;
        combined[item.num].raw.tier3 = item;
      }
    }

    // Tier 4: Migration
    if (tierResults.tier4) {
      for (const item of tierResults.tier4) {
        if (!combined[item.num]) combined[item.num] = { scores: {}, raw: {} };
        combined[item.num].scores.tier4 = item.combinedScore || 0;
        combined[item.num].raw.tier4 = item;
      }
    }

    // Tier 5: Bayesian
    if (tierResults.tier5) {
      for (const item of tierResults.tier5) {
        if (!combined[item.num]) combined[item.num] = { scores: {}, raw: {} };
        combined[item.num].scores.tier5 = item.score || 0;
        combined[item.num].raw.tier5 = item;
      }
    }

    // Tier 6: Genetic
    if (tierResults.tier6?.bestStrategy) {
      for (const num of tierResults.tier6.bestStrategy.numbers) {
        if (!combined[num]) combined[num] = { scores: {}, raw: {} };
        combined[num].scores.tier6 = 1.0; // GA-selected numbers get max score
        combined[num].raw.tier6 = { selected: true };
      }
    }

    // Calculate weighted final scores
    const results = [];
    for (const [num, data] of Object.entries(combined)) {
      let finalScore = 0;
      let tierCount = 0;
      const tierBreakdown = {};

      for (const [tier, tierWeight] of Object.entries(w)) {
        const key = tier
          .replace("_frequency", "")
          .replace("_markov", "")
          .replace("_cycles", "")
          .replace("_migration", "")
          .replace("_bayesian", "")
          .replace("_genetic", "");
        const tKey = tier.split("_")[0];
        const score = data.scores[tKey] || 0;
        finalScore += score * tierWeight;
        tierBreakdown[tier] = score;
        if (score > 0) tierCount++;
      }

      // Consensus bonus: if multiple tiers agree, boost the score
      const consensusBonus = tierCount > 3 ? (tierCount - 3) * 0.05 : 0;

      results.push({
        num,
        finalScore: finalScore + consensusBonus,
        tierBreakdown,
        tierCount,
        consensus: tierCount,
        raw: data.raw,
      });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results;
  },

  // Method A: Weighted Sum for TOTO
  weightedSumToto(tierResults, weights = null) {
    const w = weights || this.defaultWeightsToto;
    const scores = Array.from({ length: 50 }, () => ({
      scores: {},
      raw: {},
      tierCount: 0,
    }));

    // Tier 1
    if (tierResults.tier1) {
      for (const item of tierResults.tier1) {
        scores[item.num].scores.tier1 = item.freqScore || 0;
        scores[item.num].raw.tier1 = item;
      }
    }

    // Tier 2
    if (tierResults.tier2) {
      for (const item of tierResults.tier2) {
        scores[item.num].scores.tier2 = item.score || 0;
        scores[item.num].raw.tier2 = item;
      }
    }

    // Tier 3
    if (tierResults.tier3) {
      for (const item of tierResults.tier3) {
        scores[item.num].scores.tier3 = item.combinedScore || 0;
        scores[item.num].raw.tier3 = item;
      }
    }

    // Tier 5
    if (tierResults.tier5) {
      for (const item of tierResults.tier5) {
        scores[item.num].scores.tier5 = item.score || 0;
        scores[item.num].raw.tier5 = item;
      }
    }

    // Tier 6
    if (tierResults.tier6?.bestStrategy) {
      for (const num of tierResults.tier6.bestStrategy.numbers) {
        scores[num].scores.tier6 = 1.0;
        scores[num].raw.tier6 = { selected: true };
      }
    }

    const results = [];
    for (let n = 1; n <= 49; n++) {
      let finalScore = 0;
      let tierCount = 0;
      const tierBreakdown = {};

      for (const [tier, tierWeight] of Object.entries(w)) {
        const tKey = tier.split("_")[0];
        const score = scores[n].scores[tKey] || 0;
        finalScore += score * tierWeight;
        tierBreakdown[tier] = score;
        if (score > 0) tierCount++;
      }

      const consensusBonus = tierCount > 3 ? (tierCount - 3) * 0.05 : 0;

      results.push({
        num: n,
        finalScore: finalScore + consensusBonus,
        tierBreakdown,
        tierCount,
        consensus: tierCount,
        raw: scores[n].raw,
      });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results;
  },

  // Method B: Voting Ensemble
  votingEnsemble(tierResults, game, topNPerTier = 10) {
    const votes = {};

    const tiers =
      game === "4d"
        ? ["tier1", "tier2", "tier3", "tier4", "tier5"]
        : ["tier1", "tier2", "tier3", "tier5"];

    for (const tier of tiers) {
      if (!tierResults[tier]) continue;
      const topN = tierResults[tier].slice(0, topNPerTier);
      for (const item of topN) {
        const num = item.num;
        if (!votes[num]) votes[num] = { count: 0, tiers: [] };
        votes[num].count++;
        votes[num].tiers.push(tier);
      }
    }

    // GA votes separately
    if (tierResults.tier6?.bestStrategy) {
      for (const num of tierResults.tier6.bestStrategy.numbers) {
        if (!votes[num]) votes[num] = { count: 0, tiers: [] };
        votes[num].count++;
        votes[num].tiers.push("tier6");
      }
    }

    const results = Object.entries(votes)
      .map(([num, data]) => ({
        num: game === "toto" ? parseInt(num) : num,
        ...data,
      }))
      .sort((a, b) => b.count - a.count);

    return results;
  },

  // Method C: Adaptive — uses logged accuracy to adjust weights
  adaptiveWeights(predictionLog, game) {
    const logs = predictionLog.filter(
      (l) => l.game === game && l.result !== null,
    );
    if (logs.length < 5)
      return game === "4d" ? this.defaultWeights4D : this.defaultWeightsToto;

    // Calculate per-tier accuracy from logs
    const tierAccuracy = {};
    for (const log of logs) {
      if (!log.tierScores) continue;
      for (const [tier, _] of Object.entries(log.tierScores)) {
        if (!tierAccuracy[tier]) tierAccuracy[tier] = { hits: 0, total: 0 };
        tierAccuracy[tier].total++;
        // Check if any top-10 from this tier were in actual results
        if (log.result?.hits > 0) tierAccuracy[tier].hits++;
      }
    }

    // Convert accuracy to weights
    const weights = {};
    let totalAcc = 0;
    const defaultW =
      game === "4d" ? this.defaultWeights4D : this.defaultWeightsToto;

    for (const [tier, data] of Object.entries(tierAccuracy)) {
      const acc = data.total > 0 ? data.hits / data.total : 0;
      weights[tier] = acc + 0.1; // Minimum weight
      totalAcc += weights[tier];
    }

    // Fill missing tiers with defaults
    for (const tier of Object.keys(defaultW)) {
      if (!weights[tier]) {
        weights[tier] = defaultW[tier];
        totalAcc += weights[tier];
      }
    }

    // Normalize
    for (const tier of Object.keys(weights)) {
      weights[tier] /= totalAcc;
    }

    return weights;
  },

  // Diversity filter: remove numbers too similar to already selected ones
  diversityFilter(rankedNumbers, count, game) {
    const selected = [];
    for (const item of rankedNumbers) {
      if (selected.length >= count) break;

      if (game === "4d") {
        // For 4D: reject if 3+ digits match any already selected
        const tooSimilar = selected.some((s) => {
          let matching = 0;
          for (let p = 0; p < 4; p++) {
            if (s.num[p] === item.num[p]) matching++;
          }
          return matching >= 3;
        });
        if (!tooSimilar) selected.push(item);
      } else {
        selected.push(item);
      }
    }
    return selected;
  },
};
