// Tier 4: Prize Migration Tracking (4D only)
// Tracks how numbers move between prize tiers across draws
const MigrationEngine = {
  // Prize tier states
  STATES: { NONE: 0, CONSOLATION: 1, STARTER: 2, TOP3: 3 },
  STATE_NAMES: ["none", "consolation", "starter", "top3"],

  // Determine which tier a number appeared in for a given draw
  getNumberState(num, draw) {
    if ([draw.first, draw.second, draw.third].includes(num))
      return this.STATES.TOP3;
    if (draw.starters.includes(num)) return this.STATES.STARTER;
    if (draw.consolation.includes(num)) return this.STATES.CONSOLATION;
    return this.STATES.NONE;
  },

  // Build state transition history for all numbers across all draws
  buildStateHistory(draws) {
    const history = {}; // {num: [{drawNo, state}]}

    for (const draw of draws) {
      const allNums = [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ];
      for (const num of allNums) {
        if (!history[num]) history[num] = [];
        history[num].push({
          drawNo: draw.drawNo,
          date: draw.date,
          state: this.getNumberState(num, draw),
        });
      }
    }
    return history;
  },

  // Build global state transition probability matrix
  buildTransitionMatrix(draws) {
    // matrix[from][to] = count of transitions
    const matrix = Array.from({ length: 4 }, () => Array(4).fill(0));
    const numStates = {}; // Track current state of each number

    // Process draws in chronological order (reverse of default)
    const chronological = [...draws].reverse();

    for (const draw of chronological) {
      const currentStates = {};
      const allNums = [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ];

      for (const num of allNums) {
        currentStates[num] = this.getNumberState(num, draw);
      }

      // Record transitions from previous state
      for (const [num, state] of Object.entries(currentStates)) {
        const prevState = numStates[num] || this.STATES.NONE;
        matrix[prevState][state]++;
        numStates[num] = state;
      }

      // Numbers not in this draw transition to NONE
      for (const [num, prevState] of Object.entries(numStates)) {
        if (!currentStates[num] && prevState !== this.STATES.NONE) {
          matrix[prevState][this.STATES.NONE]++;
          numStates[num] = this.STATES.NONE;
        }
      }
    }

    // Normalize to probabilities
    const probMatrix = matrix.map((row) => {
      const total = row.reduce((s, v) => s + v, 0);
      return total > 0 ? row.map((v) => v / total) : row.map(() => 0.25);
    });

    return { matrix, probMatrix };
  },

  // Detect promotion patterns: numbers that climbed tiers
  detectPromotions(draws) {
    const history = this.buildStateHistory(draws);
    const promotions = [];

    for (const [num, events] of Object.entries(history)) {
      // Sort events chronologically
      const chronEvents = [...events].reverse();

      for (let i = 1; i < chronEvents.length; i++) {
        if (chronEvents[i].state > chronEvents[i - 1].state) {
          promotions.push({
            num,
            from: this.STATE_NAMES[chronEvents[i - 1].state],
            to: this.STATE_NAMES[chronEvents[i].state],
            fromDraw: chronEvents[i - 1].drawNo,
            toDraw: chronEvents[i].drawNo,
            gap: Math.abs(chronEvents[i].drawNo - chronEvents[i - 1].drawNo),
          });
        }
      }
    }

    // Calculate typical promotion windows
    const gapsByType = {};
    for (const p of promotions) {
      const key = `${p.from}->${p.to}`;
      if (!gapsByType[key]) gapsByType[key] = [];
      gapsByType[key].push(p.gap);
    }

    const avgGaps = {};
    for (const [key, gaps] of Object.entries(gapsByType)) {
      avgGaps[key] = {
        mean: gaps.reduce((s, v) => s + v, 0) / gaps.length,
        min: Math.min(...gaps),
        max: Math.max(...gaps),
        count: gaps.length,
      };
    }

    return { promotions, avgGaps };
  },

  // Score numbers based on migration potential
  scoreMigration(draws) {
    const history = this.buildStateHistory(draws);
    const { probMatrix } = this.buildTransitionMatrix(draws);
    const { avgGaps } = this.detectPromotions(draws);
    const scores = {};

    // For each number that has appeared, calculate promotion probability
    for (const [num, events] of Object.entries(history)) {
      const latestEvent = events[0]; // Most recent (draws sorted desc)
      const currentState = latestEvent.state;
      const drawsSinceLast = draws[0].drawNo - latestEvent.drawNo;

      // Probability of promotion from current state
      let promoProb = 0;
      if (currentState < this.STATES.TOP3) {
        promoProb = probMatrix[currentState][currentState + 1] || 0;
      }

      // Is this number in a typical promotion window?
      let windowScore = 0;
      if (currentState === this.STATES.CONSOLATION) {
        const key = "consolation->starter";
        if (avgGaps[key]) {
          const { mean, min, max } = avgGaps[key];
          if (drawsSinceLast >= min && drawsSinceLast <= max) {
            windowScore = 1 - Math.abs(drawsSinceLast - mean) / (max - min + 1);
          }
        }
      } else if (currentState === this.STATES.STARTER) {
        const key = "starter->top3";
        if (avgGaps[key]) {
          const { mean, min, max } = avgGaps[key];
          if (drawsSinceLast >= min && drawsSinceLast <= max) {
            windowScore = 1 - Math.abs(drawsSinceLast - mean) / (max - min + 1);
          }
        }
      }

      // Combined migration score
      const tierBonus = currentState / 3; // Higher current tier = higher base
      scores[num] = {
        currentState: this.STATE_NAMES[currentState],
        drawsSinceLast,
        promoProb,
        windowScore,
        tierBonus,
        combinedScore: promoProb * 0.4 + windowScore * 0.35 + tierBonus * 0.25,
      };
    }

    // Sort by combined score
    const ranked = Object.entries(scores)
      .sort((a, b) => b[1].combinedScore - a[1].combinedScore)
      .map(([num, score]) => ({ num, ...score }));

    return ranked;
  },

  // Get migration flow data for visualization
  getMigrationFlow(draws) {
    const { matrix, probMatrix } = this.buildTransitionMatrix(draws);
    return {
      states: this.STATE_NAMES,
      counts: matrix,
      probabilities: probMatrix,
    };
  },
};
