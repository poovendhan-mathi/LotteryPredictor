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

  // Build cross-draw DIGIT transition matrix for 4D
  // Instead of exact number→number (too sparse), track digit-level transitions
  // across draws: what digit at pos P in draw N predicts digit at pos P in draw N+1
  build4DCrossDrawMatrix(draws) {
    // 4 position-specific 10×10 matrices
    const matrices = Array.from({ length: 4 }, () =>
      Array.from({ length: 10 }, () => Array(10).fill(0)),
    );
    const decay = 0.97;

    for (let d = 0; d < draws.length - 1; d++) {
      const weight = Math.pow(decay, d);
      const currentNums = [
        draws[d].first,
        draws[d].second,
        draws[d].third,
        ...draws[d].starters,
      ];
      const nextNums = [
        draws[d + 1].first,
        draws[d + 1].second,
        draws[d + 1].third,
        ...draws[d + 1].starters,
      ];
      for (const from of currentNums) {
        const fromStr = from.padStart(4, "0");
        for (const to of nextNums) {
          const toStr = to.padStart(4, "0");
          for (let p = 0; p < 4; p++) {
            matrices[p][parseInt(fromStr[p])][parseInt(toStr[p])] += weight;
          }
        }
      }
    }
    // Normalize
    for (const mat of matrices) {
      for (let i = 0; i < 10; i++) {
        const rowSum = mat[i].reduce((s, v) => s + v, 0);
        if (rowSum > 0) mat[i] = mat[i].map((v) => v / rowSum);
        else mat[i] = Array(10).fill(0.1);
      }
    }
    return matrices;
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

  // Predict next 4D numbers using Markov chain (v2 — digit-level cross-draw)
  predict4D(draws, topN = 20) {
    const posMatrices = this.build4DPositionalMatrix(draws);
    const crossDrawMatrices = this.build4DCrossDrawMatrix(draws);
    const lastDraw = draws[0];
    const lastNums = [
      lastDraw.first,
      lastDraw.second,
      lastDraw.third,
      ...lastDraw.starters,
    ];

    // Compute cross-draw digit predictions: for each position,
    // average the transition probabilities from all last-draw digits at that position
    const crossDrawProbs = Array.from({ length: 4 }, () => Array(10).fill(0));
    for (const num of lastNums) {
      const str = num.padStart(4, "0");
      for (let p = 0; p < 4; p++) {
        const fromDigit = parseInt(str[p]);
        for (let d = 0; d < 10; d++) {
          crossDrawProbs[p][d] += crossDrawMatrices[p][fromDigit][d];
        }
      }
    }
    // Normalize
    for (let p = 0; p < 4; p++) {
      const total = crossDrawProbs[p].reduce((s, v) => s + v, 0);
      if (total > 0)
        crossDrawProbs[p] = crossDrawProbs[p].map((v) => v / total);
      else crossDrawProbs[p] = Array(10).fill(0.1);
    }

    const scores = {};

    // Score all 10000 numbers using positional chain + cross-draw digit probs
    for (let n = 0; n < 10000; n++) {
      const str = n.toString().padStart(4, "0");
      // Positional chain probability (internal structure)
      let chainProb = 1;
      for (let p = 0; p < 3; p++) {
        const from = parseInt(str[p]);
        const to = parseInt(str[p + 1]);
        chainProb *= posMatrices[p][from][to];
      }

      // Cross-draw digit probability (what digits are predicted at each position)
      let crossProb = 1;
      for (let p = 0; p < 4; p++) {
        crossProb *= crossDrawProbs[p][parseInt(str[p])];
      }
      crossProb = Math.pow(crossProb, 0.25); // geometric mean

      scores[str] = {
        chainProb,
        crossProb,
        combined: chainProb * 0.5 + crossProb * 0.5,
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
