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

  // Odd/Even distribution in winning sets — with ideal split extraction
  oddEvenDistribution(draws) {
    const dist = {};
    for (const draw of draws) {
      const oddCount = draw.winning.filter((n) => n % 2 !== 0).length;
      const key = `${oddCount}odd-${6 - oddCount}even`;
      dist[key] = (dist[key] || 0) + 1;
    }
    // Find most common split
    let bestKey = null,
      bestCount = 0;
    for (const [k, v] of Object.entries(dist)) {
      if (v > bestCount) {
        bestCount = v;
        bestKey = k;
      }
    }
    const mostCommonSplit = bestKey
      ? {
          odd: parseInt(bestKey),
          even: 6 - parseInt(bestKey),
        }
      : { odd: 3, even: 3 };
    return { ...dist, mostCommonSplit };
  },

  // High (25-49) vs Low (1-24) distribution — with ideal split extraction
  highLowDistribution(draws) {
    const dist = {};
    for (const draw of draws) {
      const highCount = draw.winning.filter((n) => n >= 25).length;
      const key = `${highCount}high-${6 - highCount}low`;
      dist[key] = (dist[key] || 0) + 1;
    }
    let bestKey = null,
      bestCount = 0;
    for (const [k, v] of Object.entries(dist)) {
      if (v > bestCount) {
        bestCount = v;
        bestKey = k;
      }
    }
    const mostCommonSplit = bestKey
      ? {
          high: parseInt(bestKey),
          low: 6 - parseInt(bestKey),
        }
      : { high: 3, low: 3 };
    return { ...dist, mostCommonSplit };
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

  // Score a single number (1-49) — Multi-dimensional scoring (v2)
  scoreNumber(num, draws, window = 40) {
    const recentDraws = draws.slice(0, window);
    const freq = this.numberFrequency(recentDraws);
    const lastSeen = this.overdueAnalysis(draws);
    const gaps = this.gapAnalysis(draws);
    const totalDraws = recentDraws.length;

    // 1. Frequency score (recency-weighted)
    const maxFreq = Math.max(...freq.slice(1));
    const freqScore = maxFreq > 0 ? freq[num] / maxFreq : 0;

    // 2. Overdue score — numbers due for a return
    const overdueScore = Math.min(lastSeen[num] / (draws.length * 0.3), 1);

    // 3. Gap rhythm score — if number has a regular cycle, is it due?
    const avgGap = gaps.avgGaps[num];
    const drawsSince = lastSeen[num];
    let gapScore = 0;
    if (avgGap > 0 && avgGap < draws.length) {
      // How close to the expected re-appearance?
      const ratio = drawsSince / avgGap;
      // Peak at ratio=1 (exactly due), still good at 0.8-1.5
      gapScore = Math.exp((-0.5 * Math.pow(ratio - 1, 2)) / 0.25);
    }

    // 4. Trend score — is frequency increasing in recent draws?
    const recentHalf = draws.slice(0, Math.floor(window / 2));
    const olderHalf = draws.slice(Math.floor(window / 2), window);
    const recentFreq = this.numberFrequency(recentHalf);
    const olderFreq = this.numberFrequency(olderHalf);
    const recentRate = recentFreq[num] / (recentHalf.length || 1);
    const olderRate = olderFreq[num] / (olderHalf.length || 1);
    const trendScore =
      olderRate > 0
        ? Math.min(recentRate / olderRate, 2) / 2
        : recentRate > 0
          ? 0.6
          : 0.3;

    // 5. Decade balance score — numbers from underrepresented decades are favored
    // (decades: 1-9, 10-19, 20-29, 30-39, 40-49)
    const decadeCounts = [0, 0, 0, 0, 0];
    for (const draw of recentDraws) {
      for (const n of draw.winning) {
        decadeCounts[Math.floor((n - 1) / 10)]++;
      }
    }
    const totalDecade = decadeCounts.reduce((s, v) => s + v, 0);
    const decadeIdx = Math.floor((num - 1) / 10);
    const decadeRatio = decadeCounts[decadeIdx] / (totalDecade / 5);
    // Favor slightly underrepresented decades
    const decadeScore = decadeRatio < 0.8 ? 0.8 : decadeRatio > 1.2 ? 0.4 : 0.6;

    return { freqScore, overdueScore, gapScore, trendScore, decadeScore };
  },

  // Number co-occurrence transition: which numbers tend to follow each other draw-to-draw
  numberTransitions(draws, decay = 0.95) {
    // For each number, track which numbers appear in the NEXT draw
    const transitions = {};
    for (let i = 0; i < draws.length - 1; i++) {
      const weight = Math.pow(decay, i);
      const currentNums = draws[i].winning;
      const nextNums = draws[i + 1].winning;
      for (const n of currentNums) {
        if (!transitions[n]) transitions[n] = Array(50).fill(0);
        for (const m of nextNums) {
          transitions[n][m] += weight;
        }
      }
    }
    // Normalize rows
    for (const n of Object.keys(transitions)) {
      const row = transitions[n];
      const total = row.reduce((s, v) => s + v, 0);
      if (total > 0) {
        for (let i = 0; i < row.length; i++) row[i] /= total;
      }
    }
    return transitions;
  },

  // Structural constraints: ideal odd/even, high/low, consecutive, sum profiles
  structuralProfile(draws) {
    const oddCounts = {};
    const highCounts = {};
    const sumBuckets = {};
    const spreadBuckets = {};
    for (const draw of draws) {
      const w = draw.winning;
      const oddC = w.filter((n) => n % 2 !== 0).length;
      const highC = w.filter((n) => n >= 25).length;
      const sum = w.reduce((s, n) => s + n, 0);
      const sorted = [...w].sort((a, b) => a - b);
      const spread = sorted[5] - sorted[0];
      oddCounts[oddC] = (oddCounts[oddC] || 0) + 1;
      highCounts[highC] = (highCounts[highC] || 0) + 1;
      const sumBucket = Math.floor(sum / 20) * 20;
      sumBuckets[sumBucket] = (sumBuckets[sumBucket] || 0) + 1;
      const spreadBucket = Math.floor(spread / 10) * 10;
      spreadBuckets[spreadBucket] = (spreadBuckets[spreadBucket] || 0) + 1;
    }
    // Convert to probabilities
    const total = draws.length;
    for (const k of Object.keys(oddCounts)) oddCounts[k] /= total;
    for (const k of Object.keys(highCounts)) highCounts[k] /= total;
    for (const k of Object.keys(sumBuckets)) sumBuckets[k] /= total;
    for (const k of Object.keys(spreadBuckets)) spreadBuckets[k] /= total;
    return { oddCounts, highCounts, sumBuckets, spreadBuckets };
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
