// Tier 1: 4D Foundational Statistical Analysis
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

  // Frequency of digits 0-9 at each of the 4 positions
  positionalFrequency(draws) {
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
    // Normalize to probabilities
    const posProb = posFreq.map((pos) => {
      const total = pos.reduce((s, v) => s + v, 0);
      return pos.map((v) => (total > 0 ? v / total : 0.1));
    });
    return { posFreq, posProb };
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
    // Sort by most overdue
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

  // Sum of digits distribution
  sumDistribution(draws) {
    const sums = {};
    for (const draw of draws) {
      const top3 = [draw.first, draw.second, draw.third];
      for (const num of top3) {
        const str = num.padStart(4, "0");
        const sum = str.split("").reduce((s, d) => s + parseInt(d), 0);
        sums[sum] = (sums[sum] || 0) + 1;
      }
    }
    // Find most common sum range
    const entries = Object.entries(sums).map(([k, v]) => [parseInt(k), v]);
    entries.sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    return {
      distribution: Object.fromEntries(entries),
      mostCommon: entries.slice(0, 5),
      mean: entries.reduce((s, e) => s + e[0] * e[1], 0) / total,
    };
  },

  // Odd/Even and High/Low ratio analysis
  ratioAnalysis(draws) {
    const oddEvenCounts = { odd: 0, even: 0 };
    const highLowCounts = { high: 0, low: 0 }; // high = digits 5-9, low = 0-4
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

  // Score a single 4D number based on Tier 1 analysis
  scoreNumber(num, draws, window = 50) {
    const str = num.padStart(4, "0");
    const recentDraws = draws.slice(0, window);
    const { posProb } = this.positionalFrequency(recentDraws);
    const hotCold = this.hotColdNumbers(draws, window);
    const { lastSeen } = this.overdueAnalysis(draws);
    const pairCorr = this.digitPairCorrelation(recentDraws);
    const sumDist = this.sumDistribution(recentDraws);

    // Positional frequency score
    let posScore = 1;
    for (let p = 0; p < 4; p++) posScore *= posProb[p][parseInt(str[p])];
    posScore = Math.pow(posScore, 0.25); // Geometric mean

    // Hot number score
    const hotScore = (hotCold.all[num] || 0) / (window || 1);

    // Overdue score (higher = more overdue = higher score)
    const overdueVal =
      lastSeen[num] !== undefined ? lastSeen[num] : draws.length;
    const overdueScore = Math.min(overdueVal / (draws.length * 0.5), 1);

    // Pair correlation score
    let pairScore = 0;
    for (let i = 0; i < 3; i++) {
      const pair = str[i] + str[i + 1];
      pairScore += pairCorr[pair] || 0;
    }
    const maxPair = Math.max(...Object.values(pairCorr), 1);
    pairScore = pairScore / (3 * maxPair);

    // Sum fit score - how close this number's digit sum is to historical mean
    const digitSum = str.split("").reduce((s, d) => s + parseInt(d), 0);
    const sumFit = 1 - Math.min(Math.abs(digitSum - sumDist.mean) / 18, 1);

    return { posScore, hotScore, overdueScore, pairScore, sumFit };
  },
};
