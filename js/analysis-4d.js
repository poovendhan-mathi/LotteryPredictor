// Tier 1: 4D Foundational Statistical Analysis (Redesigned v2)
const Analysis4D = {
  // Count frequency of each 4-digit number across all prize tiers
  numberFrequency(draws, tier = "all") {
    const freq = {};
    for (const draw of draws) {
      let nums;
      if (tier === "top3") nums = [draw.first, draw.second, draw.third];
      else if (tier === "starters") nums = draw.starters;
      else if (tier === "consolation") nums = draw.consolation;
      else
        nums = [
          draw.first,
          draw.second,
          draw.third,
          ...draw.starters,
          ...draw.consolation,
        ];
      for (const n of nums) {
        freq[n] = (freq[n] || 0) + 1;
      }
    }
    return freq;
  },

  // Frequency of digits 0-9 at each of the 4 positions with recency-weighted decay
  positionalFrequency(draws, decay = 0.97) {
    const posFreq = Array.from({ length: 4 }, () => Array(10).fill(0));
    for (let d = 0; d < draws.length; d++) {
      const weight = Math.pow(decay, d);
      const draw = draws[d];
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
          posFreq[p][parseInt(str[p])] += weight;
        }
      }
    }
    // Normalize to probabilities
    const posProb = posFreq.map((pos) => {
      const total = pos.reduce((s, v) => s + v, 0);
      return pos.map((v) => (total > 0 ? v / total : 0.1));
    });
    return { posFreq, posProb };
  },

  // Conditional digit transition probabilities: P(digit at pos p+1 | digit at pos p)
  // This captures internal structure of winning numbers
  digitTransitionProbs(draws, decay = 0.97) {
    // 3 transition matrices: pos0→pos1, pos1→pos2, pos2→pos3
    const matrices = Array.from({ length: 3 }, () =>
      Array.from({ length: 10 }, () => Array(10).fill(0)),
    );
    for (let d = 0; d < draws.length; d++) {
      const weight = Math.pow(decay, d);
      const draw = draws[d];
      const allNums = [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ];
      for (const num of allNums) {
        const str = num.padStart(4, "0");
        for (let p = 0; p < 3; p++) {
          matrices[p][parseInt(str[p])][parseInt(str[p + 1])] += weight;
        }
      }
    }
    // Normalize each row
    for (const mat of matrices) {
      for (let i = 0; i < 10; i++) {
        const rowSum = mat[i].reduce((s, v) => s + v, 0);
        if (rowSum > 0) mat[i] = mat[i].map((v) => v / rowSum);
        else mat[i] = Array(10).fill(0.1);
      }
    }
    return matrices;
  },

  // Hot and cold numbers within a configurable window
  hotColdNumbers(draws, window = 30) {
    const recent = draws.slice(0, window);
    const freq = this.numberFrequency(recent);
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return {
      hot: sorted.slice(0, 20),
      cold: sorted.slice(-20).reverse(),
      all: freq,
    };
  },

  // Draws since last appearance for every number seen
  overdueAnalysis(draws) {
    const lastSeen = {};
    for (let i = 0; i < draws.length; i++) {
      const allNums = [
        draws[i].first,
        draws[i].second,
        draws[i].third,
        ...draws[i].starters,
        ...draws[i].consolation,
      ];
      for (const n of allNums) {
        if (!(n in lastSeen)) lastSeen[n] = i; // i = draws ago
      }
    }
    const sorted = Object.entries(lastSeen).sort((a, b) => b[1] - a[1]);
    return { lastSeen, sorted };
  },

  // Average gap between appearances of each number
  gapAnalysis(draws) {
    const appearances = {};
    for (let i = 0; i < draws.length; i++) {
      const allNums = [
        draws[i].first,
        draws[i].second,
        draws[i].third,
        ...draws[i].starters,
        ...draws[i].consolation,
      ];
      for (const n of allNums) {
        if (!appearances[n]) appearances[n] = [];
        appearances[n].push(i);
      }
    }
    const avgGaps = {};
    for (const [num, indices] of Object.entries(appearances)) {
      if (indices.length < 2) {
        avgGaps[num] = draws.length;
        continue;
      }
      let totalGap = 0;
      for (let i = 1; i < indices.length; i++)
        totalGap += indices[i] - indices[i - 1];
      avgGaps[num] = totalGap / (indices.length - 1);
    }
    return { appearances, avgGaps };
  },

  // 2-digit pair correlation: which pairs of digits appear together
  digitPairCorrelation(draws) {
    const pairCount = {};
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
        for (let i = 0; i < 3; i++) {
          const pair = str[i] + str[i + 1];
          pairCount[pair] = (pairCount[pair] || 0) + 1;
        }
      }
    }
    return pairCount;
  },

  // Sum of digits distribution — now analyzes ALL tiers, not just top3
  sumDistribution(draws) {
    const sums = {};
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
        const sum = str.split("").reduce((s, d) => s + parseInt(d), 0);
        sums[sum] = (sums[sum] || 0) + 1;
      }
    }
    const entries = Object.entries(sums).map(([k, v]) => [parseInt(k), v]);
    entries.sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    const mean = entries.reduce((s, e) => s + e[0] * e[1], 0) / total;
    // Compute standard deviation for sum targeting
    const variance =
      entries.reduce((s, e) => s + e[1] * (e[0] - mean) ** 2, 0) / total;
    const stdDev = Math.sqrt(variance);
    return {
      distribution: Object.fromEntries(entries),
      mostCommon: entries.slice(0, 5),
      mean,
      stdDev,
      // Sweet spot: mean ± 1 stddev covers ~68% of winners
      sweetSpotLow: Math.max(0, Math.round(mean - stdDev)),
      sweetSpotHigh: Math.min(36, Math.round(mean + stdDev)),
    };
  },

  // Odd/Even and High/Low ratio analysis
  ratioAnalysis(draws) {
    const oddEvenCounts = { odd: 0, even: 0 };
    const highLowCounts = { high: 0, low: 0 };
    let totalDigits = 0;
    for (const draw of draws) {
      const top3 = [draw.first, draw.second, draw.third];
      for (const num of top3) {
        const str = num.padStart(4, "0");
        for (const d of str) {
          const digit = parseInt(d);
          totalDigits++;
          if (digit % 2 === 0) oddEvenCounts.even++;
          else oddEvenCounts.odd++;
          if (digit >= 5) highLowCounts.high++;
          else highLowCounts.low++;
        }
      }
    }
    return {
      oddEvenRatio: oddEvenCounts.odd / (totalDigits || 1),
      highLowRatio: highLowCounts.high / (totalDigits || 1),
      oddEvenCounts,
      highLowCounts,
      idealOddEven: 0.5,
      idealHighLow: 0.5,
    };
  },

  // ===== NEW: Structural pattern profiling =====
  // Analyzes the "shape" of winning numbers: unique digits, odd/even per position, etc.
  structuralProfile(draws) {
    const profiles = {
      uniqueDigits: {},
      oddCount: {},
      highCount: {},
      patterns: {},
    };
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
        const digits = str.split("").map(Number);
        // Unique digit count
        const uniq = new Set(digits).size;
        profiles.uniqueDigits[uniq] = (profiles.uniqueDigits[uniq] || 0) + 1;
        // Odd digit count
        const oddCnt = digits.filter((d) => d % 2 !== 0).length;
        profiles.oddCount[oddCnt] = (profiles.oddCount[oddCnt] || 0) + 1;
        // High digit count (5-9)
        const highCnt = digits.filter((d) => d >= 5).length;
        profiles.highCount[highCnt] = (profiles.highCount[highCnt] || 0) + 1;
        // Pattern type (ascending, descending, mixed)
        let asc = 0,
          desc = 0;
        for (let i = 1; i < 4; i++) {
          if (digits[i] > digits[i - 1]) asc++;
          if (digits[i] < digits[i - 1]) desc++;
        }
        const pat = asc >= 2 ? "ascending" : desc >= 2 ? "descending" : "mixed";
        profiles.patterns[pat] = (profiles.patterns[pat] || 0) + 1;
      }
    }
    // Convert to probability distributions
    for (const key of Object.keys(profiles)) {
      const obj = profiles[key];
      const total = Object.values(obj).reduce((s, v) => s + v, 0);
      for (const k of Object.keys(obj)) obj[k] = obj[k] / total;
    }
    return profiles;
  },

  // ===== Build exclusion set — ALL historical winners =====
  // 4D numbers are 93%+ unique — almost no number wins twice
  // So we exclude EVERY number that has ever appeared in any prize tier
  getAllHistoricalNumbers(draws) {
    const all = new Set();
    for (const draw of draws) {
      [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ].forEach((n) => all.add(n));
    }
    return all;
  },

  // Recent numbers only (for backtest/short lookback scenarios)
  getRecentNumbers(draws, lookback = 5) {
    const recent = new Set();
    for (let i = 0; i < Math.min(lookback, draws.length); i++) {
      const draw = draws[i];
      [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ].forEach((n) => recent.add(n));
    }
    return recent;
  },

  // ===== NEW: Migration proximity — numbers "near" recent consolation/starter winners =====
  // Generates neighbor numbers by shifting each digit by ±1
  getMigrationNeighbors(draws, lookback = 3) {
    const neighbors = new Map(); // num → score
    const recentNums = [];
    for (let i = 0; i < Math.min(lookback, draws.length); i++) {
      const draw = draws[i];
      const recencyWeight = 1 / (i + 1); // More recent = higher weight
      // Consolation numbers that might "promote"
      for (const num of draw.consolation) {
        recentNums.push({
          num,
          weight: recencyWeight * 0.8,
          tier: "consolation",
        });
      }
      // Starter numbers that might shift
      for (const num of draw.starters) {
        recentNums.push({ num, weight: recencyWeight * 1.0, tier: "starter" });
      }
      // Top3 numbers — their neighbors might appear
      for (const num of [draw.first, draw.second, draw.third]) {
        recentNums.push({ num, weight: recencyWeight * 0.6, tier: "top3" });
      }
    }

    for (const { num, weight } of recentNums) {
      const str = num.padStart(4, "0");
      const digits = str.split("").map(Number);
      // Shift each digit position by ±1 and ±2
      for (let pos = 0; pos < 4; pos++) {
        for (const delta of [-2, -1, 1, 2]) {
          const newDigit = (digits[pos] + delta + 10) % 10;
          const newDigits = [...digits];
          newDigits[pos] = newDigit;
          const newNum = newDigits.join("");
          const shiftWeight = Math.abs(delta) === 1 ? weight : weight * 0.5;
          neighbors.set(newNum, (neighbors.get(newNum) || 0) + shiftWeight);
        }
        // Double shift: change 2 positions at once
        for (let pos2 = pos + 1; pos2 < 4; pos2++) {
          for (const d1 of [-1, 1]) {
            for (const d2 of [-1, 1]) {
              const newDigits = [...digits];
              newDigits[pos] = (digits[pos] + d1 + 10) % 10;
              newDigits[pos2] = (digits[pos2] + d2 + 10) % 10;
              const newNum = newDigits.join("");
              neighbors.set(
                newNum,
                (neighbors.get(newNum) || 0) + weight * 0.3,
              );
            }
          }
        }
      }
    }
    return neighbors;
  },

  // ===== NEW: Tier-specific positional frequency =====
  // Separate frequency analysis for starters vs consolation vs top3
  tierPositionalFrequency(draws, tier = "starters", decay = 0.97) {
    const posFreq = Array.from({ length: 4 }, () => Array(10).fill(0));
    for (let d = 0; d < draws.length; d++) {
      const weight = Math.pow(decay, d);
      const draw = draws[d];
      let nums;
      if (tier === "top3") nums = [draw.first, draw.second, draw.third];
      else if (tier === "starters") nums = draw.starters;
      else nums = draw.consolation;
      for (const num of nums) {
        const str = num.padStart(4, "0");
        for (let p = 0; p < 4; p++) {
          posFreq[p][parseInt(str[p])] += weight;
        }
      }
    }
    const posProb = posFreq.map((pos) => {
      const total = pos.reduce((s, v) => s + v, 0);
      return pos.map((v) => (total > 0 ? v / total : 0.1));
    });
    return { posFreq, posProb };
  },

  // Score a single 4D number (v2 — precomputed stats passed in)
  scoreNumber(num, draws, window = 50) {
    const str = num.padStart(4, "0");
    const recentDraws = draws.slice(0, window);
    const { posProb } = this.positionalFrequency(recentDraws);
    const hotCold = this.hotColdNumbers(draws, window);
    const { lastSeen } = this.overdueAnalysis(draws);
    const pairCorr = this.digitPairCorrelation(recentDraws);
    const sumDist = this.sumDistribution(recentDraws);

    let posScore = 1;
    for (let p = 0; p < 4; p++) posScore *= posProb[p][parseInt(str[p])];
    posScore = Math.pow(posScore, 0.25);

    const hotScore = (hotCold.all[num] || 0) / (window || 1);
    const overdueVal =
      lastSeen[num] !== undefined ? lastSeen[num] : draws.length;
    const overdueScore = Math.min(overdueVal / (draws.length * 0.5), 1);

    let pairScore = 0;
    for (let i = 0; i < 3; i++) {
      const pair = str[i] + str[i + 1];
      pairScore += pairCorr[pair] || 0;
    }
    const maxPair = Math.max(...Object.values(pairCorr), 1);
    pairScore = pairScore / (3 * maxPair);

    const digitSum = str.split("").reduce((s, d) => s + parseInt(d), 0);
    const sumFit = 1 - Math.min(Math.abs(digitSum - sumDist.mean) / 18, 1);

    return { posScore, hotScore, overdueScore, pairScore, sumFit };
  },
};
