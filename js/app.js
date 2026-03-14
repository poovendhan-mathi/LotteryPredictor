// Main Application Controller
const App = {
  last4DResult: null,
  lastTotoResult: null,

  async init() {
    UI.initTabs();
    UI.initLogFilters();
    this.bindEvents();

    try {
      await DataLoader.load();
      this.renderDashboard();
      UI.toast("Data loaded successfully", "success");
    } catch (err) {
      console.error("Init error:", err);
      UI.toast("Failed to load data: " + err.message, "error");
    }
  },

  bindEvents() {
    // Refresh
    document
      .getElementById("btnRefreshData")
      .addEventListener("click", () => this.reload());

    // Quick generate
    document.getElementById("btnQuick4D").addEventListener("click", () => {
      UI.switchTab("predict4d");
      this.generate4D();
    });
    document.getElementById("btnQuickToto").addEventListener("click", () => {
      UI.switchTab("predictToto");
      this.generateToto();
    });

    // Generate buttons
    document
      .getElementById("btnGenerate4D")
      .addEventListener("click", () => this.generate4D());
    document
      .getElementById("btnGenerateToto")
      .addEventListener("click", () => this.generateToto());

    // Save buttons
    document
      .getElementById("btnSave4D")
      .addEventListener("click", () => this.save4D());
    document
      .getElementById("btnSaveToto")
      .addEventListener("click", () => this.saveToto());

    // Log actions
    document
      .getElementById("btnExportLogs")
      .addEventListener("click", () => this.exportLogs());
    document.getElementById("btnImportLogs").addEventListener("click", () => {
      document.getElementById("importModal").classList.add("visible");
    });
    document
      .getElementById("closeImportModal")
      .addEventListener("click", () => {
        document.getElementById("importModal").classList.remove("visible");
      });
    document
      .getElementById("btnDoImport")
      .addEventListener("click", () => this.doImport());
    document.getElementById("btnClearLogs").addEventListener("click", () => {
      if (confirm("Clear all prediction logs? This cannot be undone.")) {
        PredictionLogger.clearAll();
        UI.renderLogs();
        UI.toast("Logs cleared", "info");
      }
    });

    // Result modal close
    document
      .getElementById("closeResultModal")
      .addEventListener("click", () => {
        document.getElementById("resultModal").classList.remove("visible");
      });

    // Tab change: render charts lazily
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "analysis") this.renderAnalysis();
        if (btn.dataset.tab === "logs") UI.renderLogs();
      });
    });
  },

  renderDashboard() {
    const latest4D = DataLoader.getLatest4D();
    const latestToto = DataLoader.getLatestToto();
    UI.renderLatest4D(latest4D);
    UI.renderLatestToto(latestToto);
    UI.renderDataStats(DataLoader.getDataInfo());
  },

  renderAnalysis() {
    const draws4D = DataLoader.get4DDraws(50);
    const drawsToto = DataLoader.getTotoDraws(40);
    UI.renderCharts(draws4D, drawsToto);
  },

  async generate4D() {
    const count = parseInt(document.getElementById("count4D").value);
    const historyLimit = parseInt(document.getElementById("history4D").value);
    const btn = document.getElementById("btnGenerate4D");

    btn.disabled = true;
    btn.innerHTML =
      '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing...';
    document.getElementById("results4D").innerHTML =
      '<div class="loading-overlay"><div class="spinner"></div><span>Running 6-tier analysis engine...</span></div>';

    try {
      this.last4DResult = await Predictor4D.generate(count, { historyLimit });
      UI.render4DPredictions(this.last4DResult);
      UI.toast(`Generated ${count} 4D predictions`, "success");
    } catch (err) {
      console.error("4D generation error:", err);
      document.getElementById("results4D").innerHTML =
        `<div class="empty-state"><p style="color:var(--accent-red)">Error: ${err.message}</p></div>`;
      UI.toast("Generation failed: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "🚀 Generate Predictions";
    }
  },

  async generateToto() {
    const setsCount = parseInt(document.getElementById("countToto").value);
    const historyLimit = parseInt(document.getElementById("historyToto").value);
    const btn = document.getElementById("btnGenerateToto");

    btn.disabled = true;
    btn.innerHTML =
      '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Analyzing...';
    document.getElementById("resultsToto").innerHTML =
      '<div class="loading-overlay"><div class="spinner"></div><span>Running 6-tier analysis engine...</span></div>';

    try {
      this.lastTotoResult = await PredictorToto.generate(setsCount, {
        historyLimit,
      });
      UI.renderTotoPredictions(this.lastTotoResult);
      UI.toast(`Generated ${setsCount} TOTO sets`, "success");
    } catch (err) {
      console.error("TOTO generation error:", err);
      document.getElementById("resultsToto").innerHTML =
        `<div class="empty-state"><p style="color:var(--accent-red)">Error: ${err.message}</p></div>`;
      UI.toast("Generation failed: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "🚀 Generate Predictions";
    }
  },

  save4D() {
    if (!this.last4DResult) return;
    PredictionLogger.log({
      game: "4d",
      predictions: this.last4DResult.predictions,
      weights: this.last4DResult.weights,
      stats: this.last4DResult.stats,
    });
    UI.toast("4D predictions saved to log", "success");
    document.getElementById("btnSave4D").style.display = "none";
  },

  saveToto() {
    if (!this.lastTotoResult) return;
    PredictionLogger.log({
      game: "toto",
      predictions: this.lastTotoResult.predictions,
      weights: this.lastTotoResult.weights,
      stats: this.lastTotoResult.stats,
    });
    UI.toast("TOTO predictions saved to log", "success");
    document.getElementById("btnSaveToto").style.display = "none";
  },

  toggleBet(logId) {
    const entry = PredictionLogger.toggleBet(logId);
    if (entry) {
      UI.toast(entry.betPlaced ? "Marked as bet placed 🎫" : "Bet removed", entry.betPlaced ? "success" : "info");
      UI.renderLogs();
    }
  },

  checkResult(logId) {
    const logs = PredictionLogger.getAll();
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const modal = document.getElementById("resultModal");
    const body = document.getElementById("resultModalBody");

    if (log.game === "4d") {
      body.innerHTML = `
        <p style="margin-bottom:1rem;color:var(--text-secondary)">Enter the actual 4D results for draw comparison:</p>
        <div style="display:grid;gap:0.5rem">
          <label>1st Prize: <input type="text" id="res1st" maxlength="4" pattern="[0-9]{4}" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:80px;font-family:monospace"></label>
          <label>2nd Prize: <input type="text" id="res2nd" maxlength="4" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:80px;font-family:monospace"></label>
          <label>3rd Prize: <input type="text" id="res3rd" maxlength="4" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:80px;font-family:monospace"></label>
          <label>Starters (comma-separated): <input type="text" id="resStarters" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:100%;font-family:monospace"></label>
          <label>Consolation (comma-separated): <input type="text" id="resConsolation" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:100%;font-family:monospace"></label>
        </div>
        <div style="margin-top:1rem;text-align:right">
          <button class="btn btn-primary btn-sm" onclick="App.submitResult4D('${logId}')">Submit</button>
        </div>
      `;
    } else {
      body.innerHTML = `
        <p style="margin-bottom:1rem;color:var(--text-secondary)">Enter the actual TOTO results:</p>
        <div style="display:grid;gap:0.5rem">
          <label>Winning numbers (6, comma-separated): <input type="text" id="resWinning" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:100%;font-family:monospace" placeholder="3, 12, 18, 25, 33, 47"></label>
          <label>Additional number: <input type="number" id="resAdditional" min="1" max="49" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.4rem;border-radius:4px;width:80px"></label>
        </div>
        <div style="margin-top:1rem;text-align:right">
          <button class="btn btn-primary btn-sm" onclick="App.submitResultToto('${logId}')">Submit</button>
        </div>
      `;
    }

    modal.classList.add("visible");
  },

  submitResult4D(logId) {
    const first = document.getElementById("res1st").value.trim();
    const second = document.getElementById("res2nd").value.trim();
    const third = document.getElementById("res3rd").value.trim();
    const starters = document
      .getElementById("resStarters")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const consolation = document
      .getElementById("resConsolation")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!first || !second || !third) {
      UI.toast("Please enter at least the top 3 prizes", "error");
      return;
    }

    PredictionLogger.updateResult(logId, {
      first,
      second,
      third,
      starters,
      consolation,
    });
    document.getElementById("resultModal").classList.remove("visible");
    UI.renderLogs();
    UI.toast("Results recorded and accuracy calculated", "success");
  },

  submitResultToto(logId) {
    const winningStr = document.getElementById("resWinning").value;
    const additional = parseInt(document.getElementById("resAdditional").value);
    const winning = winningStr
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    if (winning.length !== 6 || isNaN(additional)) {
      UI.toast(
        "Please enter 6 winning numbers and 1 additional number",
        "error",
      );
      return;
    }

    PredictionLogger.updateResult(logId, { winning, additional });
    document.getElementById("resultModal").classList.remove("visible");
    UI.renderLogs();
    UI.toast("Results recorded and accuracy calculated", "success");
  },

  viewLogDetail(logId) {
    const logs = PredictionLogger.getAll();
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const modal = document.getElementById("resultModal");
    const body = document.getElementById("resultModalBody");

    let html = `<p style="color:var(--text-muted);margin-bottom:0.5rem">${new Date(log.timestamp).toLocaleString()} · ${log.game.toUpperCase()}</p>`;
    html += `<p style="margin-bottom:0.5rem">Draws analyzed: ${log.drawsAnalyzed}</p>`;
    html += `<p style="margin-bottom:0.75rem">Bet status: ${log.betPlaced ? '<span class="badge badge-bet">🎫 BET PLACED</span>' : '<span class="badge badge-nobet">Not bet</span>'}</p>`;

    html += '<div style="margin-top:0.75rem">';
    for (const tb of log.tierBreakdown) {
      html += `<div style="margin-bottom:0.5rem;padding:0.5rem;background:var(--bg-secondary);border-radius:4px">
        <strong style="font-family:monospace">${Array.isArray(tb.value) ? tb.value.join(", ") : tb.value}</strong>
        <span style="color:var(--text-muted);margin-left:0.5rem">Score: ${tb.score.toFixed(3)} · Conf: ${(tb.confidence * 100).toFixed(0)}%</span>
        <div class="tier-breakdown" style="margin-top:0.25rem">
          ${Object.entries(tb.tierScores || {})
            .map(
              ([t, s]) =>
                `<span class="tier-chip ${s > 0.5 ? "strong" : ""}">${t}: ${s.toFixed(2)}</span>`,
            )
            .join("")}
        </div>
      </div>`;
    }
    html += "</div>";

    if (log.accuracy) {
      html +=
        '<div style="margin-top:1rem;padding:0.75rem;background:var(--bg-secondary);border-radius:4px">';
      html += "<strong>Accuracy Report</strong><br>";
      if (log.game === "4d") {
        html += `Hits: ${log.accuracy.hits}/${log.accuracy.total} (${(log.accuracy.hitRate * 100).toFixed(1)}%)<br>`;
        html += `Top3: ${log.accuracy.top3Hits} · Starter: ${log.accuracy.starterHits} · Consolation: ${log.accuracy.consolationHits}`;
      } else {
        html += `Best match: ${log.accuracy.bestMatch}<br>`;
        html += `Avg matches: ${log.accuracy.avgMatches.toFixed(1)}`;
      }
      html += "</div>";
    }

    body.innerHTML = html;
    modal.classList.add("visible");
  },

  exportLogs() {
    const json = PredictionLogger.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottery-predictions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("Logs exported", "success");
  },

  doImport() {
    const text = document.getElementById("importData").value.trim();
    if (!text) {
      UI.toast("No data to import", "error");
      return;
    }
    try {
      const added = PredictionLogger.importJSON(text);
      document.getElementById("importModal").classList.remove("visible");
      UI.renderLogs();
      UI.toast(`Imported ${added} new entries`, "success");
    } catch (err) {
      UI.toast("Import failed: " + err.message, "error");
    }
  },

  async reload() {
    try {
      await DataLoader.load();
      this.renderDashboard();
      UI.toast("Data reloaded", "success");
    } catch (err) {
      UI.toast("Reload failed: " + err.message, "error");
    }
  },
};

// Boot
document.addEventListener("DOMContentLoaded", () => App.init());
