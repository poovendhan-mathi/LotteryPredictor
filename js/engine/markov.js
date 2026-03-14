// Tier 2: Markov Chain Transition Modeling
const MarkovEngine = {
  // Build positional digit transition matrix for 4D
  // Tracks P(digit at pos i+1 | digit at pos i) across all numbers in draws
  build4DPositionalMatrix(draws) {
    // 4 transition matrices: pos0->pos1, pos1->pos2, pos2->pos3
    const matrices = Array.from({ length: 3 }, () =>
      Array.from({ length: 10 }, () => Array(10).fill(0)),
    );
    const decay = 0.98; // Recency weighting

    for (let d = 0; d < draws.length; d++) {
      const weight = Math.pow(decay, d);
      const allNums = [
        draws[d].first,
        draws[d].second,
        draws[d].third,
        ...draws[d].starters,
        ...draws[d].consolation,
      ];
      for (const num of allNums) {
        const str = num.padStart(4, "0");
        for (let p = 0; p < 3; p++) {
          const from = parseInt(str[p]);
          const to = parseInt(str[p + 1]);
          matrices[p][from][to] += weight;
        }
      }
    }

    // Normalize rows to probabilities
    for (const mat of matrices) {
      for (let i = 0; i < 10; i++) {
        const rowSum = mat[i].reduce((s, v) => s + v, 0);
        if (rowSum > 0) mat[i] = mat[i].map((v) => v / rowSum);
        else mat[i] = Array(10).fill(0.1); // Uniform if no data
      }
    }
    return matrices;
  },

  // Build cross-draw transition matrix for 4D
  // Tracks which numbers in draw N predict numbers in draw N+1
  build4DCrossDrawMatrix(draws) {
    const transitions = {}; // {fromNum: {toNum: count}}
    const decay = 0.97;

    for (let d = 0; d < draws.length - 1; d++) {
      const weight = Math.pow(decay, d);
      const currentNums = [draws[d].first, draws[d].second, draws[d].third];
      const nextNums = [
        draws[d + 1].first,
        draws[d + 1].second,
        draws[d + 1].third,
      ];
      for (const from of currentNums) {
        if (!transitions[from]) transitions[from] = {};
        for (const to of nextNums) {
          transitions[from][to] = (transitions[from][to] || 0) + weight;
        }
      }
    }
    return transitions;
  },

  // Build 49x49 transition matrix for TOTO
  buildTotoMatrix(draws) {
    const matrix = Array.from({ length: 50 }, () => Array(50).fill(0));
    const decay = 0.97;

    for (let d = 0; d < draws.length - 1; d++) {
      const weight = Math.pow(decay, d);
      const current = draws[d].winning;
      const next = draws[d + 1].winning;
      for (const from of current) {
        for (const to of next) {
          matrix[from][to] += weight;
        }
      }
    }

    // Normalize
    for (let i = 1; i <= 49; i++) {
      const rowSum = matrix[i].reduce((s, v) => s + v, 0);
      if (rowSum > 0) {
        for (let j = 1; j <= 49; j++) matrix[i][j] /= rowSum;
      } else {
        for (let j = 1; j <= 49; j++) matrix[i][j] = 1 / 49;
      }
    }
    return matrix;
  },

  // Predict next 4D numbers using Markov chain
  predict4D(draws, topN = 20) {
    const posMatrices = this.build4DPositionalMatrix(draws);
    const crossDraw = this.build4DCrossDrawMatrix(draws);
    const lastDraw = draws[0];
    const lastTop3 = [lastDraw.first, lastDraw.second, lastDraw.third];

    const scores = {};

    // Score all 10000 numbers using positional transitions
    for (let n = 0; n < 10000; n++) {
      const str = n.toString().padStart(4, "0");
      // Positional chain probability
      let chainProb = 1;
      for (let p = 0; p < 3; p++) {
        const from = parseInt(str[p]);
        const to = parseInt(str[p + 1]);
        chainProb *= posMatrices[p][from][to];
      }

      // Cross-draw transition boost
      let crossBoost = 0;
      for (const prevNum of lastTop3) {
        if (crossDraw[prevNum] && crossDraw[prevNum][str]) {
          crossBoost += crossDraw[prevNum][str];
        }
      }

      scores[str] = {
        chainProb,
        crossBoost,
        combined: chainProb * 0.7 + crossBoost * 0.3,
      };
    }

    // Rank and return top N
    const ranked = Object.entries(scores)
      .sort((a, b) => b[1].combined - a[1].combined)
      .slice(0, topN)
      .map(([num, s]) => ({ num, score: s.combined, detail: s }));

    return ranked;
  },

  // Predict TOTO numbers using transition matrix
  predictToto(draws, topN = 15) {
    const matrix = this.buildTotoMatrix(draws);
    const lastWinning = draws[0]?.winning || [];

    // For each number 1-49, sum transition probabilities from last draw's numbers
    const scores = Array(50).fill(0);
    for (const prev of lastWinning) {
      for (let n = 1; n <= 49; n++) {
        scores[n] += matrix[prev][n];
      }
    }

    // Normalize
    const maxScore = Math.max(...scores.slice(1));
    const normalized = scores.map((s) => (maxScore > 0 ? s / maxScore : 0));

    const ranked = [];
    for (let n = 1; n <= 49; n++) {
      ranked.push({ num: n, score: normalized[n] });
    }
    ranked.sort((a, b) => b.score - a.score);

    return ranked.slice(0, topN);
  },

  // Get the full transition matrix for visualization
  getTransitionHeatmap(draws, game = "4d") {
    if (game === "toto") {
      return this.buildTotoMatrix(draws);
    }
    return this.build4DPositionalMatrix(draws);
  },
};
