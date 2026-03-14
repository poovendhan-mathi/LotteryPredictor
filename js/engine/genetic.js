// Tier 6: Genetic Algorithm Optimizer
// Evolves number selection strategies and optimizes ensemble weights
const GeneticEngine = {
  config: {
    populationSize: 80,
    generations: 60,
    mutationRate: 0.12,
    crossoverRate: 0.7,
    elitismRate: 0.1,
    tournamentSize: 5,
  },

  // Generate random 4D chromosome (a number selection strategy)
  random4DChromosome() {
    return {
      numbers: Array.from({ length: 5 }, () =>
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0"),
      ),
      weights: this.randomWeights(6), // 6 tier weights
    };
  },

  // Generate random TOTO chromosome
  randomTotoChromosome() {
    const nums = new Set();
    while (nums.size < 6) nums.add(Math.floor(Math.random() * 49) + 1);
    return {
      numbers: [...nums].sort((a, b) => a - b),
      weights: this.randomWeights(5), // 5 tier weights (no migration for TOTO)
    };
  },

  // Generate random weights that sum to 1
  randomWeights(n) {
    const raw = Array.from({ length: n }, () => Math.random());
    const sum = raw.reduce((s, v) => s + v, 0);
    return raw.map((v) => v / sum);
  },

  // Fitness function for 4D: test against historical draws
  fitness4D(chromosome, testDraws) {
    let score = 0;
    for (const draw of testDraws) {
      const allNums = [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ];
      for (const candidate of chromosome.numbers) {
        if (
          draw.first === candidate ||
          draw.second === candidate ||
          draw.third === candidate
        ) {
          score += 3;
        } else if (draw.starters.includes(candidate)) {
          score += 1;
        } else if (draw.consolation.includes(candidate)) {
          score += 0.5;
        }

        // Partial matches: digits in correct positions
        const candStr = candidate.padStart(4, "0");
        for (const winNum of [draw.first, draw.second, draw.third]) {
          const winStr = winNum.padStart(4, "0");
          let posMatch = 0;
          for (let p = 0; p < 4; p++) {
            if (candStr[p] === winStr[p]) posMatch++;
          }
          if (posMatch >= 3) score += 0.3;
          else if (posMatch >= 2) score += 0.1;
        }
      }
    }
    return score / (testDraws.length || 1);
  },

  // Fitness function for TOTO
  fitnessToto(chromosome, testDraws) {
    let score = 0;
    for (const draw of testDraws) {
      const matches = chromosome.numbers.filter((n) =>
        draw.winning.includes(n),
      ).length;
      const additionalMatch = chromosome.numbers.includes(draw.additional)
        ? 1
        : 0;

      if (matches === 6) score += 100;
      else if (matches === 5 && additionalMatch) score += 50;
      else if (matches === 5) score += 20;
      else if (matches === 4 && additionalMatch) score += 10;
      else if (matches === 4) score += 5;
      else if (matches === 3 && additionalMatch) score += 2;
      else if (matches === 3) score += 1;
      else if (matches === 2) score += 0.2;
    }
    return score / (testDraws.length || 1);
  },

  // Tournament selection
  tournamentSelect(population, fitnesses) {
    const tournament = [];
    for (let i = 0; i < this.config.tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      tournament.push({ idx, fitness: fitnesses[idx] });
    }
    tournament.sort((a, b) => b.fitness - a.fitness);
    return population[tournament[0].idx];
  },

  // Crossover two chromosomes
  crossover(parent1, parent2, game) {
    if (Math.random() > this.config.crossoverRate) {
      return JSON.parse(JSON.stringify(parent1));
    }

    const child = JSON.parse(JSON.stringify(parent1));
    const crossPoint = Math.floor(Math.random() * parent1.numbers.length);

    for (let i = crossPoint; i < child.numbers.length; i++) {
      child.numbers[i] = parent2.numbers[i % parent2.numbers.length];
    }

    // Crossover weights
    for (let i = 0; i < child.weights.length; i++) {
      child.weights[i] =
        Math.random() < 0.5 ? parent1.weights[i] : parent2.weights[i];
    }
    // Renormalize weights
    const wSum = child.weights.reduce((s, v) => s + v, 0);
    child.weights = child.weights.map((v) => v / wSum);

    // Ensure uniqueness for TOTO
    if (game === "toto") {
      const unique = new Set(child.numbers);
      while (unique.size < 6) unique.add(Math.floor(Math.random() * 49) + 1);
      child.numbers = [...unique].slice(0, 6).sort((a, b) => a - b);
    }

    return child;
  },

  // Mutate a chromosome
  mutate(chromosome, game) {
    const mutated = JSON.parse(JSON.stringify(chromosome));

    for (let i = 0; i < mutated.numbers.length; i++) {
      if (Math.random() < this.config.mutationRate) {
        if (game === "4d") {
          mutated.numbers[i] = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0");
        } else {
          mutated.numbers[i] = Math.floor(Math.random() * 49) + 1;
        }
      }
    }

    // Mutate weights
    for (let i = 0; i < mutated.weights.length; i++) {
      if (Math.random() < this.config.mutationRate) {
        mutated.weights[i] += (Math.random() - 0.5) * 0.2;
        mutated.weights[i] = Math.max(0.01, mutated.weights[i]);
      }
    }
    const wSum = mutated.weights.reduce((s, v) => s + v, 0);
    mutated.weights = mutated.weights.map((v) => v / wSum);

    // Ensure uniqueness for TOTO
    if (game === "toto") {
      const unique = new Set(mutated.numbers);
      while (unique.size < 6) unique.add(Math.floor(Math.random() * 49) + 1);
      mutated.numbers = [...unique].slice(0, 6).sort((a, b) => a - b);
    }

    return mutated;
  },

  // Run full GA optimization
  optimize(draws, game = "4d") {
    const trainSize = Math.floor(draws.length * 0.7);
    const trainDraws = draws.slice(0, trainSize);
    const testDraws = draws.slice(trainSize);

    const createChromosome =
      game === "4d"
        ? () => this.random4DChromosome()
        : () => this.randomTotoChromosome();
    const fitnessFunc =
      game === "4d"
        ? (c, d) => this.fitness4D(c, d)
        : (c, d) => this.fitnessToto(c, d);

    // Initialize population
    let population = Array.from(
      { length: this.config.populationSize },
      createChromosome,
    );
    let bestEver = null;
    let bestFitness = -Infinity;
    let stagnation = 0;
    const history = [];

    for (let gen = 0; gen < this.config.generations; gen++) {
      // Evaluate fitness
      const fitnesses = population.map((c) => fitnessFunc(c, trainDraws));

      // Track best
      const maxFit = Math.max(...fitnesses);
      const maxIdx = fitnesses.indexOf(maxFit);
      history.push({
        generation: gen,
        bestFitness: maxFit,
        avgFitness: fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length,
      });

      if (maxFit > bestFitness) {
        bestFitness = maxFit;
        bestEver = JSON.parse(JSON.stringify(population[maxIdx]));
        stagnation = 0;
      } else {
        stagnation++;
      }

      // Early stopping on plateau
      if (stagnation > 15) break;

      // Selection and breeding
      const eliteCount = Math.floor(
        this.config.populationSize * this.config.elitismRate,
      );
      const indexed = fitnesses.map((f, i) => ({ i, f }));
      indexed.sort((a, b) => b.f - a.f);
      const nextGen = indexed
        .slice(0, eliteCount)
        .map((e) => JSON.parse(JSON.stringify(population[e.i])));

      while (nextGen.length < this.config.populationSize) {
        const p1 = this.tournamentSelect(population, fitnesses);
        const p2 = this.tournamentSelect(population, fitnesses);
        let child = this.crossover(p1, p2, game);
        child = this.mutate(child, game);
        nextGen.push(child);
      }

      population = nextGen;
    }

    // Test best on held-out data
    const testFitness = bestEver ? fitnessFunc(bestEver, testDraws) : 0;

    return {
      bestStrategy: bestEver,
      trainFitness: bestFitness,
      testFitness,
      overfitRatio: bestFitness > 0 ? testFitness / bestFitness : 0,
      history,
      optimizedWeights: bestEver?.weights || null,
    };
  },

  // Quick optimization focused on weight tuning only
  optimizeWeights(draws, game = "4d") {
    const result = this.optimize(draws, game);
    return {
      weights: result.optimizedWeights,
      confidence: result.overfitRatio,
      trainFitness: result.trainFitness,
      testFitness: result.testFitness,
    };
  },
};
