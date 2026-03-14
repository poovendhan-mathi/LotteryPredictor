// Tier 1: TOTO Foundational Statistical Analysis
const AnalysisToto = {
  // Frequency of each number 1-49 in winning draws
  numberFrequency(draws) {
    const freq = Array(50).fill(0); // index 0 unused, 1-49
    for (const draw of draws) {
      for (const n of draw.winning) freq[n]++;
      if (draw.additional) freq[draw.additional]++;
    }
    return freq;
  },

  // Hot/Cold numbers within window
  hotColdNumbers(draws, window = 30) {
    const recent = draws.slice(0, window);
    const freq = this.numberFrequency(recent);
    const ranked = [];
    for (let i = 1; i <= 49; i++) ranked.push({ num: i, freq: freq[i] });
    ranked.sort((a, b) => b.freq - a.freq);
    return {
      hot: ranked.slice(0, 15),
      cold: ranked.slice(-15).reverse(),
      freq,
    };
  },

  // Draws since last appearance for each number 1-49
  overdueAnalysis(draws) {
    const lastSeen = Array(50).fill(draws.length);
    for (let i = 0; i < draws.length; i++) {
      for (const n of draws[i].winning) {
        if (lastSeen[n] === draws.length) lastSeen[n] = i;
      }
      if (
        draws[i].additional &&
        lastSeen[draws[i].additional] === draws.length
      ) {
        lastSeen[draws[i].additional] = i;
      }
    }
    return lastSeen;
  },

  // Average gap between appearances
  gapAnalysis(draws) {
    const appearances = Array.from({ length: 50 }, () => []);
    for (let i = 0; i < draws.length; i++) {
      for (const n of draws[i].winning) appearances[n].push(i);
    }
    const avgGaps = Array(50).fill(0);
    for (let n = 1; n <= 49; n++) {
      const app = appearances[n];
      if (app.length < 2) {
        avgGaps[n] = draws.length;
        continue;
      }
      let totalGap = 0;
      for (let i = 1; i < app.length; i++) totalGap += app[i] - app[i - 1];
      avgGaps[n] = totalGap / (app.length - 1);
    }
    return { appearances, avgGaps };
  },

  // Delta analysis: differences between consecutive winning numbers
  deltaAnalysis(draws) {
    const deltaCounts = {};
    for (const draw of draws) {
      const sorted = [...draw.winning].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const delta = sorted[i] - sorted[i - 1];
        deltaCounts[delta] = (deltaCounts[delta] || 0) + 1;
      }
    }
    const entries = Object.entries(deltaCounts).map(([k, v]) => [
      parseInt(k),
      v,
    ]);
    entries.sort((a, b) => b[1] - a[1]);
    return {
      deltaCounts,
      mostCommon: entries.slice(0, 10),
      mean:
        entries.reduce((s, e) => s + e[0] * e[1], 0) /
        entries.reduce((s, e) => s + e[1], 0),
    };
  },

  // Pair frequency: which pairs of numbers co-occur most
  pairAnalysis(draws) {
    const pairCount = {};
    for (const draw of draws) {
      const w = draw.winning;
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j < w.length; j++) {
          const key = Math.min(w[i], w[j]) + "-" + Math.max(w[i], w[j]);
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    }
    const sorted = Object.entries(pairCount).sort((a, b) => b[1] - a[1]);
    return { pairCount, topPairs: sorted.slice(0, 30) };
  },

  // Triplet frequency
  tripletAnalysis(draws) {
    const tripCount = {};
    for (const draw of draws) {
      const w = draw.winning;
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j < w.length; j++) {
          for (let k = j + 1; k < w.length; k++) {
            const nums = [w[i], w[j], w[k]].sort((a, b) => a - b);
            const key = nums.join("-");
            tripCount[key] = (tripCount[key] || 0) + 1;
          }
        }
      }
    }
    const sorted = Object.entries(tripCount).sort((a, b) => b[1] - a[1]);
    return { tripCount, topTriplets: sorted.slice(0, 20) };
  },

  // Sum range analysis
  sumAnalysis(draws) {
    const sums = [];
    for (const draw of draws) {
      const sum = draw.winning.reduce((s, n) => s + n, 0);
      sums.push(sum);
    }
    sums.sort((a, b) => a - b);
    const mean = sums.reduce((s, v) => s + v, 0) / sums.length;
    const variance =
      sums.reduce((s, v) => s + (v - mean) ** 2, 0) / sums.length;
    const stdDev = Math.sqrt(variance);
    return {
      sums,
      mean,
      stdDev,
      min: sums[0],
      max: sums[sums.length - 1],
      q25: sums[Math.floor(sums.length * 0.25)],
      q75: sums[Math.floor(sums.length * 0.75)],
      idealRange: [Math.round(mean - stdDev), Math.round(mean + stdDev)],
    };
  },

  // Odd/Even distribution in winning sets
  oddEvenDistribution(draws) {
    const dist = {};
    for (const draw of draws) {
      const oddCount = draw.winning.filter((n) => n % 2 !== 0).length;
      const key = `${oddCount}odd-${6 - oddCount}even`;
      dist[key] = (dist[key] || 0) + 1;
    }
    return dist;
  },

  // High (25-49) vs Low (1-24) distribution
  highLowDistribution(draws) {
    const dist = {};
    for (const draw of draws) {
      const highCount = draw.winning.filter((n) => n >= 25).length;
      const key = `${highCount}high-${6 - highCount}low`;
      dist[key] = (dist[key] || 0) + 1;
    }
    return dist;
  },

  // Consecutive number frequency
  consecutiveAnalysis(draws) {
    let withConsecutive = 0;
    for (const draw of draws) {
      const sorted = [...draw.winning].sort((a, b) => a - b);
      let hasConsec = false;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] === 1) {
          hasConsec = true;
          break;
        }
      }
      if (hasConsec) withConsecutive++;
    }
    return {
      withConsecutive,
      total: draws.length,
      rate: withConsecutive / (draws.length || 1),
    };
  },

  // Score a single number (1-49) based on Tier 1 analysis
  scoreNumber(num, draws, window = 40) {
    const recentDraws = draws.slice(0, window);
    const freq = this.numberFrequency(recentDraws);
    const lastSeen = this.overdueAnalysis(draws);
    const totalDraws = recentDraws.length;

    // Frequency score (normalized)
    const maxFreq = Math.max(...freq.slice(1));
    const freqScore = maxFreq > 0 ? freq[num] / maxFreq : 0;

    // Overdue score
    const overdueScore = Math.min(lastSeen[num] / (draws.length * 0.3), 1);

    return { freqScore, overdueScore };
  },

  // Score affinity between a number and a set of already-chosen numbers
  pairAffinityScore(num, chosenNums, pairCount) {
    let score = 0;
    for (const c of chosenNums) {
      const key = Math.min(num, c) + "-" + Math.max(num, c);
      score += pairCount[key] || 0;
    }
    return chosenNums.length > 0 ? score / chosenNums.length : 0;
  },
};
