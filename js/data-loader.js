// Data Loader - Fetches and parses historical 4D and TOTO results
const DataLoader = {
  data4D: null,
  dataToto: null,

  async load() {
    const [res4D, resToto] = await Promise.all([
      fetch("data/4d-results.json"),
      fetch("data/toto-results.json"),
    ]);
    this.data4D = await res4D.json();
    this.dataToto = await resToto.json();
    // Sort draws by drawNo descending (most recent first)
    this.data4D.draws.sort((a, b) => b.drawNo - a.drawNo);
    this.dataToto.draws.sort((a, b) => b.drawNo - a.drawNo);
    return { data4D: this.data4D, dataToto: this.dataToto };
  },

  get4DDraws(limit) {
    const draws = this.data4D?.draws || [];
    return limit ? draws.slice(0, limit) : draws;
  },

  getTotoDraws(limit) {
    const draws = this.dataToto?.draws || [];
    return limit ? draws.slice(0, limit) : draws;
  },

  getLatest4D() {
    return this.data4D?.draws?.[0] || null;
  },

  getLatestToto() {
    return this.dataToto?.draws?.[0] || null;
  },

  // Extract all winning numbers from a 4D draw (all tiers)
  getAll4DNumbers(draw) {
    return {
      top3: [draw.first, draw.second, draw.third],
      starters: draw.starters,
      consolation: draw.consolation,
      all: [
        draw.first,
        draw.second,
        draw.third,
        ...draw.starters,
        ...draw.consolation,
      ],
    };
  },

  // Get all individual digits from 4D results for positional analysis
  get4DDigits(draws) {
    const positions = [[], [], [], []]; // pos 0-3
    for (const draw of draws) {
      const allNums = this.getAll4DNumbers(draw).all;
      for (const num of allNums) {
        const str = num.padStart(4, "0");
        for (let i = 0; i < 4; i++) {
          positions[i].push(parseInt(str[i]));
        }
      }
    }
    return positions;
  },

  getDataInfo() {
    return {
      total4D: this.data4D?.draws?.length || 0,
      totalToto: this.dataToto?.draws?.length || 0,
      last4DUpdate: this.data4D?.lastUpdated || "N/A",
      lastTotoUpdate: this.dataToto?.lastUpdated || "N/A",
      latest4DDraw: this.data4D?.draws?.[0]?.drawNo || "N/A",
      latestTotoDraw: this.dataToto?.draws?.[0]?.drawNo || "N/A",
    };
  },
};
