// Main Application Controller
const App = {
  last4DResult: null,
  lastTotoResult: null,
  _lastLogId4D: null,
  _lastLogIdToto: null,

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

    // Bet modal (legacy — modal no longer opened, predictions auto-logged)
    document.getElementById("closeBetModal").addEventListener("click", () => {
      document.getElementById("betModal").classList.remove("visible");
    });
    document.getElementById("btnBetYes").addEventListener("click", () => {
      document.getElementById("betModal").classList.remove("visible");
    });
    document.getElementById("btnBetNo").addEventListener("click", () => {
      document.getElementById("betModal").classList.remove("visible");
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

      // Auto-log every prediction immediately
      const record = PredictionLogger.log({
        game: "4d",
        predictions: this.last4DResult.predictions,
        weights: this.last4DResult.weights,
        stats: this.last4DResult.stats,
        betPlaced: false,
      });
      this._lastLogId4D = record.id;
      const saveBtn = document.getElementById("btnSave4D");
      saveBtn.style.display = "inline-flex";
      saveBtn.innerHTML = "🎫 Mark Bet Placed";
      saveBtn.classList.remove("bet-marked");

      UI.toast(`Generated ${count} 4D predictions (auto-logged)`, "success");
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

      // Auto-log every prediction immediately
      const record = PredictionLogger.log({
        game: "toto",
        predictions: this.lastTotoResult.predictions,
        weights: this.lastTotoResult.weights,
        stats: this.lastTotoResult.stats,
        betPlaced: false,
      });
      this._lastLogIdToto = record.id;
      const saveBtn = document.getElementById("btnSaveToto");
      saveBtn.style.display = "inline-flex";
      saveBtn.innerHTML = "🎫 Mark Bet Placed";
      saveBtn.classList.remove("bet-marked");

      UI.toast(`Generated ${setsCount} TOTO sets (auto-logged)`, "success");
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
    if (!this._lastLogId4D) return;
    const entry = PredictionLogger.toggleBet(this._lastLogId4D);
    const btn = document.getElementById("btnSave4D");
    if (entry && entry.betPlaced) {
      btn.innerHTML = "✅ Bet Marked";
      btn.classList.add("bet-marked");
      UI.toast("Marked as bet placed 🎫", "success");
    } else if (entry) {
      btn.innerHTML = "🎫 Mark Bet Placed";
      btn.classList.remove("bet-marked");
      UI.toast("Bet unmarked", "info");
    }
  },

  saveToto() {
    if (!this._lastLogIdToto) return;
    const entry = PredictionLogger.toggleBet(this._lastLogIdToto);
    const btn = document.getElementById("btnSaveToto");
    if (entry && entry.betPlaced) {
      btn.innerHTML = "✅ Bet Marked";
      btn.classList.add("bet-marked");
      UI.toast("Marked as bet placed 🎫", "success");
    } else if (entry) {
      btn.innerHTML = "🎫 Mark Bet Placed";
      btn.classList.remove("bet-marked");
      UI.toast("Bet unmarked", "info");
    }
  },

  toggleBet(logId) {
    const entry = PredictionLogger.toggleBet(logId);
    if (entry) {
      UI.toast(
        entry.betPlaced ? "Marked as bet placed 🎫" : "Bet removed",
        entry.betPlaced ? "success" : "info",
      );
      UI.renderLogs();
    }
  },

  checkResult(logId) {
    const logs = PredictionLogger.getAll();
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    const modal = document.getElementById("resultModal");
    const body = document.getElementById("resultModalBody");
    document.getElementById("resultModalTitle").textContent =
      "Check Against Draw";

    if (log.game === "4d") {
      const draws = DataLoader.get4DDraws();
      if (!draws || draws.length === 0) {
        UI.toast("No 4D draw data available", "error");
        return;
      }
      let options = draws
        .map(
          (d) =>
            `<option value="${d.drawNo}">Draw #${d.drawNo} — ${d.date} (1st: ${d.first})</option>`,
        )
        .join("");

      body.innerHTML = `
        <div style="padding:0.5rem 0">
          <p style="margin-bottom:1rem;color:var(--text-secondary)">Select the draw to check your predictions against:</p>
          <select id="resDrawSelect" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.5rem;border-radius:4px;width:100%;font-size:0.9rem;margin-bottom:1rem">
            ${options}
          </select>
          <div id="resDrawPreview" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:0.75rem;font-size:0.85rem;color:var(--text-secondary)"></div>
          <div style="margin-top:1rem;text-align:right">
            <button class="btn btn-primary btn-sm" onclick="App.submitAutoResult4D('${logId}')">✅ Check Results</button>
          </div>
        </div>
      `;
      // Preview first draw
      const sel = document.getElementById("resDrawSelect");
      this._preview4DDraw(draws, sel.value);
      sel.addEventListener("change", () =>
        this._preview4DDraw(draws, sel.value),
      );
    } else {
      const draws = DataLoader.getTotoDraws();
      if (!draws || draws.length === 0) {
        UI.toast("No TOTO draw data available", "error");
        return;
      }
      let options = draws
        .map(
          (d) =>
            `<option value="${d.drawNo}">Draw #${d.drawNo} — ${d.date} (${d.winning.join(", ")})</option>`,
        )
        .join("");

      body.innerHTML = `
        <div style="padding:0.5rem 0">
          <p style="margin-bottom:1rem;color:var(--text-secondary)">Select the draw to check your predictions against:</p>
          <select id="resDrawSelect" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);padding:0.5rem;border-radius:4px;width:100%;font-size:0.9rem;margin-bottom:1rem">
            ${options}
          </select>
          <div id="resDrawPreview" style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:0.75rem;font-size:0.85rem;color:var(--text-secondary)"></div>
          <div style="margin-top:1rem;text-align:right">
            <button class="btn btn-primary btn-sm" onclick="App.submitAutoResultToto('${logId}')">✅ Check Results</button>
          </div>
        </div>
      `;
      const sel = document.getElementById("resDrawSelect");
      this._previewTotoDraw(draws, sel.value);
      sel.addEventListener("change", () =>
        this._previewTotoDraw(draws, sel.value),
      );
    }

    modal.classList.add("visible");
  },

  _preview4DDraw(draws, drawNo) {
    const d = draws.find((x) => String(x.drawNo) === String(drawNo));
    const el = document.getElementById("resDrawPreview");
    if (!d) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `
      <div><strong>1st:</strong> <span style="color:var(--accent-gold);font-family:monospace">${d.first}</span>
        <strong style="margin-left:0.5rem">2nd:</strong> <span style="color:var(--accent-red);font-family:monospace">${d.second}</span>
        <strong style="margin-left:0.5rem">3rd:</strong> <span style="color:var(--accent-blue);font-family:monospace">${d.third}</span></div>
      <div style="margin-top:0.3rem"><strong>Starters:</strong> ${d.starters.join(", ")}</div>
      <div style="margin-top:0.3rem"><strong>Consolation:</strong> ${d.consolation.join(", ")}</div>
    `;
  },

  _previewTotoDraw(draws, drawNo) {
    const d = draws.find((x) => String(x.drawNo) === String(drawNo));
    const el = document.getElementById("resDrawPreview");
    if (!d) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `
      <div><strong>Winning:</strong> <span style="color:var(--accent-gold)">${d.winning.join(", ")}</span></div>
      <div style="margin-top:0.3rem"><strong>Additional:</strong> <span style="color:var(--accent-green)">${d.additional}</span></div>
    `;
  },

  submitAutoResult4D(logId) {
    const drawNo = document.getElementById("resDrawSelect").value;
    const draws = DataLoader.get4DDraws();
    const d = draws.find((x) => String(x.drawNo) === String(drawNo));
    if (!d) {
      UI.toast("Draw not found", "error");
      return;
    }

    PredictionLogger.updateResult(logId, {
      first: d.first,
      second: d.second,
      third: d.third,
      starters: d.starters,
      consolation: d.consolation,
    });
    document.getElementById("resultModal").classList.remove("visible");
    UI.renderLogs();
    UI.toast("Results checked against Draw #" + drawNo, "success");
  },

  submitAutoResultToto(logId) {
    const drawNo = document.getElementById("resDrawSelect").value;
    const draws = DataLoader.getTotoDraws();
    const d = draws.find((x) => String(x.drawNo) === String(drawNo));
    if (!d) {
      UI.toast("Draw not found", "error");
      return;
    }

    PredictionLogger.updateResult(logId, {
      winning: d.winning,
      additional: d.additional,
    });
    document.getElementById("resultModal").classList.remove("visible");
    UI.renderLogs();
    UI.toast("Results checked against Draw #" + drawNo, "success");
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
