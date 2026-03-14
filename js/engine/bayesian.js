// Tier 5: Bayesian Probability Engine
// Sequential Bayesian updating using Beta-Binomial conjugate model
const BayesianEngine = {
  // Initialize priors for 4D digits at each position
  init4DPriors() {
    // Beta(alpha, beta) for each digit 0-9 at each position 0-3
    const priors = Array.from(
      { length: 4 },
      () => Array.from({ length: 10 }, () => ({ alpha: 1, beta: 9 })), // Weak prior: ~10% chance
    );
    return priors;
  },

  // Initialize priors for TOTO numbers 1-49
  initTotoPriors() {
    // Beta(alpha, beta) for each number
    // Prior: ~6/49 ≈ 12.2% chance of being in a winning set
    const priors = Array(50)
      .fill(null)
      .map(() => ({ alpha: 1.22, beta: 8.78 }));
    return priors;
  },

  // Update 4D priors with observed draws
  update4DPosteriors(draws) {
    const posteriors = this.init4DPriors();

    // Process draws chronologically (oldest first for proper sequential update)
    const chronological = [...draws].reverse();
    const decay = 0.995; // Slight decay so recent draws matter more

    for (let d = 0; d < chronological.length; d++) {
      const weight = Math.pow(decay, chronological.length - 1 - d); // Recent = higher weight
      const draw = chronological[d];
      const top3 = [draw.first, draw.second, draw.third];

      for (const num of top3) {
        const str = num.padStart(4, "0");
        for (let pos = 0; pos < 4; pos++) {
          const digit = parseInt(str[pos]);
          // Update: observed digit gets alpha++, others get beta++
          posteriors[pos][digit].alpha += weight;
          for (let other = 0; other < 10; other++) {
            if (other !== digit) posteriors[pos][other].beta += weight * 0.1;
          }
        }
      }
    }

    return posteriors;
  },

  // Update TOTO priors with observed draws
  updateTotoPosteriors(draws) {
    const posteriors = this.initTotoPriors();
    const chronological = [...draws].reverse();
    const decay = 0.995;

    for (let d = 0; d < chronological.length; d++) {
      const weight = Math.pow(decay, chronological.length - 1 - d);
      const draw = chronological[d];

      for (let n = 1; n <= 49; n++) {
        if (draw.winning.includes(n)) {
          posteriors[n].alpha += weight;
        } else {
          posteriors[n].beta += weight * 0.15;
        }
      }
    }

    return posteriors;
  },

  // Calculate posterior mean: E[θ] = α / (α + β)
  posteriorMean(posterior) {
    return posterior.alpha / (posterior.alpha + posterior.beta);
  },

  // Calculate posterior variance
  posteriorVariance(posterior) {
    const { alpha, beta } = posterior;
    return (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  },

  // Calculate entropy of posterior: lower = more confident
  posteriorEntropy(posterior) {
    const p = this.posteriorMean(posterior);
    if (p <= 0 || p >= 1) return 0;
    return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  },

  // Score 4D numbers using Bayesian posteriors
  score4D(draws, topN = 50) {
    const posteriors = this.update4DPosteriors(draws);
    const scores = [];

    for (let n = 0; n < 10000; n++) {
      const str = n.toString().padStart(4, "0");
      // Product of posterior means for each digit at its position
      let bayesProb = 1;
      let totalEntropy = 0;
      for (let pos = 0; pos < 4; pos++) {
        const digit = parseInt(str[pos]);
        bayesProb *= this.posteriorMean(posteriors[pos][digit]);
        totalEntropy += this.posteriorEntropy(posteriors[pos][digit]);
      }

      // Confidence: lower entropy = higher confidence
      const avgEntropy = totalEntropy / 4;
      const confidence = 1 - avgEntropy;

      scores.push({
        num: str,
        bayesProb,
        confidence,
        score: bayesProb * (0.5 + 0.5 * confidence),
      });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topN);
  },

  // Score TOTO numbers using Bayesian posteriors
  scoreToto(draws) {
    const posteriors = this.updateTotoPosteriors(draws);
    const scores = [];

    for (let n = 1; n <= 49; n++) {
      const mean = this.posteriorMean(posteriors[n]);
      const variance = this.posteriorVariance(posteriors[n]);
      const entropy = this.posteriorEntropy(posteriors[n]);
      const confidence = 1 - entropy;

      scores.push({
        num: n,
        posteriorMean: mean,
        variance,
        entropy,
        confidence,
        score: mean * (0.5 + 0.5 * confidence),
      });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores;
  },

  // Get posterior distribution data for visualization
  getDistribution(draws, game = "4d") {
    if (game === "toto") {
      const posteriors = this.updateTotoPosteriors(draws);
      return posteriors.slice(1).map((p, i) => ({
        num: i + 1,
        mean: this.posteriorMean(p),
        variance: this.posteriorVariance(p),
        alpha: p.alpha,
        beta: p.beta,
      }));
    }
    const posteriors = this.update4DPosteriors(draws);
    return posteriors.map((pos, p) =>
      pos.map((prior, d) => ({
        position: p,
        digit: d,
        mean: this.posteriorMean(prior),
        variance: this.posteriorVariance(prior),
        alpha: prior.alpha,
        beta: prior.beta,
      })),
    );
  },
};
