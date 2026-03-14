// Anomaly Detection: Chi-square, Entropy, and Randomness Tests
const AnomalyEngine = {
  // Chi-square goodness-of-fit against uniform distribution
  chiSquareTest(observed, expected) {
    let chiSq = 0;
    for (let i = 0; i < observed.length; i++) {
      const e = expected[i] || expected;
      chiSq += (observed[i] - e) ** 2 / e;
    }
    return chiSq;
  },

  // Test if 4D digit positions are uniformly distributed
  test4DUniformity(draws) {
    const posFreq = Array.from({ length: 4 }, () => Array(10).fill(0));
    for (const draw of draws) {
      const allNums = [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ];
      for (const num of allNums) {
        const str = num.padStart(4, "0");
        for (let p = 0; p < 4; p++) {
          posFreq[p][parseInt(str[p])]++;
        }
      }
    }

    const results = [];
    for (let p = 0; p < 4; p++) {
      const total = posFreq[p].reduce((s, v) => s + v, 0);
      const expected = total / 10;
      const chiSq = this.chiSquareTest(posFreq[p], expected);
      // df = 9, critical value at 0.05 = 16.92
      const significant = chiSq > 16.92;
      const anomalies = [];

      for (let d = 0; d < 10; d++) {
        const deviation = (posFreq[p][d] - expected) / Math.sqrt(expected);
        if (Math.abs(deviation) > 2) {
          anomalies.push({
            digit: d,
            observed: posFreq[p][d],
            expected: Math.round(expected),
            deviation,
            type: deviation > 0 ? "overrepresented" : "underrepresented",
          });
        }
      }

      results.push({
        position: p,
        chiSquare: chiSq,
        significant,
        anomalies,
        freq: posFreq[p],
      });
    }
    return results;
  },

  // Test if TOTO numbers are uniformly distributed
  testTotoUniformity(draws) {
    const freq = Array(50).fill(0);
    for (const draw of draws) {
      for (const n of draw.winning) freq[n]++;
    }

    const totalDrawn = draws.length * 6;
    const expected = totalDrawn / 49;
    const observed = freq.slice(1);
    const chiSq = this.chiSquareTest(observed, expected);
    // df = 48, critical value at 0.05 ≈ 65.17
    const significant = chiSq > 65.17;

    const anomalies = [];
    for (let n = 1; n <= 49; n++) {
      const deviation = (freq[n] - expected) / Math.sqrt(expected);
      if (Math.abs(deviation) > 2) {
        anomalies.push({
          num: n,
          observed: freq[n],
          expected: Math.round(expected),
          deviation,
          type: deviation > 0 ? "overrepresented" : "underrepresented",
        });
      }
    }

    return { chiSquare: chiSq, significant, anomalies, freq: freq.slice(1) };
  },

  // Shannon entropy calculation
  entropy(probabilities) {
    return -probabilities
      .filter((p) => p > 0)
      .reduce((s, p) => s + p * Math.log2(p), 0);
  },

  // Calculate entropy for 4D digit positions
  entropy4D(draws) {
    const posFreq = Array.from({ length: 4 }, () => Array(10).fill(0));
    for (const draw of draws) {
      const top3 = [draw.first, draw.second, draw.third];
      for (const num of top3) {
        const str = num.padStart(4, "0");
        for (let p = 0; p < 4; p++) posFreq[p][parseInt(str[p])]++;
      }
    }

    const maxEntropy = Math.log2(10); // 3.32 bits for uniform 0-9
    return posFreq.map((freq, pos) => {
      const total = freq.reduce((s, v) => s + v, 0);
      const probs = freq.map((f) => (total > 0 ? f / total : 0.1));
      const ent = this.entropy(probs);
      return {
        position: pos,
        entropy: ent,
        maxEntropy,
        normalized: ent / maxEntropy, // 1 = perfectly random, <1 = exploitable
        bias: 1 - ent / maxEntropy,
      };
    });
  },

  // Entropy for TOTO
  entropyToto(draws) {
    const freq = Array(50).fill(0);
    for (const draw of draws) {
      for (const n of draw.winning) freq[n]++;
    }
    const total = freq.slice(1).reduce((s, v) => s + v, 0);
    const probs = freq.slice(1).map((f) => (total > 0 ? f / total : 1 / 49));
    const ent = this.entropy(probs);
    const maxEntropy = Math.log2(49);
    return {
      entropy: ent,
      maxEntropy,
      normalized: ent / maxEntropy,
      bias: 1 - ent / maxEntropy,
    };
  },

  // Runs test: detect non-randomness in sequential appearances
  runsTest(series) {
    const n = series.length;
    const n1 = series.filter((v) => v === 1).length;
    const n0 = n - n1;
    if (n1 === 0 || n0 === 0) return { zScore: 0, significant: false };

    // Count runs
    let runs = 1;
    for (let i = 1; i < n; i++) {
      if (series[i] !== series[i - 1]) runs++;
    }

    // Expected runs and variance
    const expectedRuns = 1 + (2 * n1 * n0) / n;
    const variance = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1));
    const zScore =
      variance > 0 ? (runs - expectedRuns) / Math.sqrt(variance) : 0;

    return {
      runs,
      expectedRuns: Math.round(expectedRuns * 100) / 100,
      zScore: Math.round(zScore * 100) / 100,
      significant: Math.abs(zScore) > 1.96, // 95% confidence
    };
  },

  // Comprehensive anomaly scan — returns bonus scores for numbers with anomalies
  scan4D(draws) {
    const uniformity = this.test4DUniformity(draws);
    const entropyResults = this.entropy4D(draws);
    const bonusScores = {};

    // Numbers with overrepresented digits get a bonus
    for (const posResult of uniformity) {
      for (const anomaly of posResult.anomalies) {
        if (anomaly.type === "overrepresented") {
          // Boost all numbers with this digit at this position
          for (let n = 0; n < 10000; n++) {
            const str = n.toString().padStart(4, "0");
            if (parseInt(str[posResult.position]) === anomaly.digit) {
              const key = str;
              bonusScores[key] =
                (bonusScores[key] || 0) + Math.abs(anomaly.deviation) * 0.02;
            }
          }
        }
      }
    }

    return { uniformity, entropy: entropyResults, bonusScores };
  },

  // Comprehensive anomaly scan for TOTO
  scanToto(draws) {
    const uniformity = this.testTotoUniformity(draws);
    const entropyResult = this.entropyToto(draws);
    const bonusScores = {};

    for (const anomaly of uniformity.anomalies) {
      if (anomaly.type === "overrepresented") {
        bonusScores[anomaly.num] = Math.abs(anomaly.deviation) * 0.03;
      }
    }

    return { uniformity, entropy: entropyResult, bonusScores };
  },
};
