// UI Controller — DOM rendering, Chart.js, and view updates
const UI = {
  chartInstances: {},

  // ===== Toast Notifications =====
  toast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // ===== Tab Switching =====
  initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".tab-panel")
          .forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document
          .getElementById(`panel-${btn.dataset.tab}`)
          .classList.add("active");
      });
    });
  },

  switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${tabId}`);
    });
  },

  // ===== Dashboard Rendering =====
  renderLatest4D(draw) {
    const el = document.getElementById("latest4D");
    if (!draw) {
      el.innerHTML = '<div class="empty-state"><p>No 4D data loaded</p></div>';
      return;
    }
    el.innerHTML = `
      <div class="draw-date">Draw #${draw.drawNo} — ${draw.date}</div>
      <div style="margin-bottom:0.75rem">
        <div class="prize-label">1st Prize</div>
        <div class="draw-numbers"><div class="number-ball gold">${draw.first}</div></div>
      </div>
      <div style="margin-bottom:0.75rem">
        <div class="prize-label">2nd Prize</div>
        <div class="draw-numbers"><div class="number-ball red">${draw.second}</div></div>
      </div>
      <div style="margin-bottom:0.75rem">
        <div class="prize-label">3rd Prize</div>
        <div class="draw-numbers"><div class="number-ball blue">${draw.third}</div></div>
      </div>
      <div style="margin-bottom:0.5rem">
        <div class="prize-label">Starter (${draw.starters.length})</div>
        <div class="draw-numbers">${draw.starters.map((n) => `<div class="number-ball gray" style="width:40px;height:40px;font-size:0.85rem">${n}</div>`).join("")}</div>
      </div>
      <div>
        <div class="prize-label">Consolation (${draw.consolation.length})</div>
        <div class="draw-numbers">${draw.consolation.map((n) => `<div class="number-ball gray" style="width:40px;height:40px;font-size:0.85rem">${n}</div>`).join("")}</div>
      </div>
    `;
  },

  renderLatestToto(draw) {
    const el = document.getElementById("latestToto");
    if (!draw) {
      el.innerHTML =
        '<div class="empty-state"><p>No TOTO data loaded</p></div>';
      return;
    }
    el.innerHTML = `
      <div class="draw-date">Draw #${draw.drawNo} — ${draw.date}</div>
      <div style="margin-bottom:0.75rem">
        <div class="prize-label">Winning Numbers</div>
        <div class="draw-numbers">${draw.winning.map((n) => `<div class="number-ball gold">${n}</div>`).join("")}</div>
      </div>
      <div>
        <div class="prize-label">Additional Number</div>
        <div class="draw-numbers"><div class="number-ball additional">${draw.additional}</div></div>
      </div>
    `;
  },

  renderDataStats(info) {
    document.getElementById("stat4DCount").textContent = info.total4D || 0;
    document.getElementById("statTotoCount").textContent = info.totalToto || 0;
    const logs = PredictionLogger.getAll();
    document.getElementById("statPredictions").textContent = logs.length;
    const stats4D = PredictionLogger.getAccuracyStats("4d");
    document.getElementById("statHitRate").textContent = stats4D
      ? (stats4D.hitRate * 100).toFixed(1) + "%"
      : "—";
  },

  // ===== 4D Prediction Rendering =====
  render4DPredictions(result) {
    const el = document.getElementById("results4D");
    if (!result || !result.predictions.length) {
      el.innerHTML =
        '<div class="empty-state"><p>No predictions generated</p></div>';
      return;
    }

    let html = `<div class="prediction-results">`;
    result.predictions.forEach((pred, i) => {
      const confPct = (pred.confidence * 100).toFixed(0);
      const confColor =
        pred.confidence > 0.6
          ? "var(--accent-green)"
          : pred.confidence > 0.3
            ? "var(--accent-gold)"
            : "var(--accent-red)";
      html += `
        <div class="prediction-item fade-in" style="animation-delay:${i * 0.05}s">
          <div class="prediction-rank">${i + 1}</div>
          <div class="prediction-number">${pred.number}</div>
          <div class="tier-breakdown">
            ${Object.entries(pred.tierScores)
              .map(
                ([tier, score]) =>
                  `<span class="tier-chip ${score > 0.5 ? "strong" : ""}">${tier}: ${score.toFixed(2)}</span>`,
              )
              .join("")}
          </div>
          <div class="prediction-meta">
            <div class="prediction-score">Score: ${pred.score.toFixed(3)}</div>
            <div class="confidence-bar"><div class="confidence-fill" style="width:${confPct}%;background:${confColor}"></div></div>
            <div class="prediction-score">${confPct}% confidence</div>
          </div>
        </div>`;
    });
    html += `</div>
      <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted)">
        ⏱ Generated in ${result.stats.elapsedMs}ms · Analyzed ${result.stats.drawsAnalyzed} draws · Pool: ${result.stats.candidatePoolSize} candidates
      </div>`;
    el.innerHTML = html;

    // Show save button
    document.getElementById("btnSave4D").style.display = "inline-flex";

    // Show analysis summary
    this.render4DAnalysisSummary(result.analysis);
  },

  render4DAnalysisSummary(analysis) {
    const card = document.getElementById("analysis4DCard");
    const el = document.getElementById("analysis4DSummary");
    card.style.display = "block";

    const hc = analysis.hotCold;
    const anom = analysis.anomalyReport;

    // hc.hot/cold are [numStr, freq] tuples — extract just the number strings
    const hotNums = hc.hot.slice(0, 5).map((e) => e[0]);
    const coldNums = hc.cold.slice(0, 5).map((e) => e[0]);
    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:1rem">
        <div class="stat-box">
          <div class="stat-value">${hotNums.join(", ")}</div>
          <div class="stat-label">🔥 Hottest Numbers</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${coldNums.join(", ")}</div>
          <div class="stat-label">🧊 Coldest Numbers</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${analysis.sums.mean ? analysis.sums.mean.toFixed(1) : "—"}</div>
          <div class="stat-label">Avg 4D Sum</div>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-secondary)">
        Anomaly: ${Array.isArray(anom.uniformity) && anom.uniformity.some((p) => p.significant) ? "⚠️ Non-uniform pattern" : "✅ Uniform"}
      </div>
    `;
  },

  // ===== TOTO Prediction Rendering =====
  renderTotoPredictions(result) {
    const el = document.getElementById("resultsToto");
    if (!result || !result.predictions.length) {
      el.innerHTML =
        '<div class="empty-state"><p>No predictions generated</p></div>';
      return;
    }

    let html = `<div class="prediction-results">`;
    result.predictions.forEach((set, i) => {
      const confPct = (set.confidence * 100).toFixed(0);
      const confColor =
        set.confidence > 0.6
          ? "var(--accent-green)"
          : set.confidence > 0.3
            ? "var(--accent-gold)"
            : "var(--accent-red)";
      html += `
        <div class="prediction-item fade-in" style="animation-delay:${i * 0.05}s">
          <div class="prediction-rank">${i + 1}</div>
          <div class="prediction-toto-numbers">
            ${set.numbers.map((n) => `<div class="ball">${n}</div>`).join("")}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">
            Sum: ${set.sum} · Odd: ${set.oddCount} · High: ${set.highCount}
          </div>
          <div class="prediction-meta">
            <div class="prediction-score">Score: ${set.score.toFixed(3)}</div>
            <div class="confidence-bar"><div class="confidence-fill" style="width:${confPct}%;background:${confColor}"></div></div>
            <div class="prediction-score">${confPct}% confidence</div>
          </div>
        </div>`;
    });
    html += `</div>
      <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted)">
        ⏱ Generated in ${result.stats.elapsedMs}ms · Analyzed ${result.stats.drawsAnalyzed} draws
      </div>`;
    el.innerHTML = html;

    document.getElementById("btnSaveToto").style.display = "inline-flex";

    // Show rankings
    this.renderTotoRankings(result.numberRankings);
  },

  renderTotoRankings(rankings) {
    const card = document.getElementById("totoRankCard");
    const el = document.getElementById("totoRankings");
    card.style.display = "block";

    let html = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">';
    rankings.forEach((r, i) => {
      const heat = Math.min(1, r.score / (rankings[0].score || 1));
      const hue = 45 * heat; // gold at top, darker at bottom
      html += `<div style="background:hsla(${hue},80%,50%,0.2);border:1px solid hsla(${hue},80%,50%,0.4);
        border-radius:var(--radius-sm);padding:0.4rem 0.6rem;text-align:center;min-width:50px">
        <div style="font-weight:700;font-size:1.1rem">${r.number}</div>
        <div style="font-size:0.65rem;color:var(--text-muted)">${r.score.toFixed(2)}</div>
      </div>`;
    });
    html += "</div>";
    el.innerHTML = html;
  },

  // ===== Charts =====
  renderCharts(data4D, dataToto) {
    const draws4D = data4D || DataLoader.get4DDraws(50);
    const drawsToto = dataToto || DataLoader.getTotoDraws(40);

    this.renderChart4DHotCold(draws4D);
    this.renderChartTotoFreq(drawsToto);
    this.renderChart4DSum(draws4D);
    this.renderChartTotoSum(drawsToto);
    this.renderChartTotoOverdue(drawsToto);
    this.renderAnomalyReport(draws4D, drawsToto);
  },

  renderChart4DHotCold(draws) {
    const hotCold = Analysis4D.hotColdNumbers(draws);
    // hotCold.hot/cold are [numStr, freq] tuples from Object.entries
    const hotEntries = hotCold.hot.slice(0, 10);
    const coldEntries = hotCold.cold.slice(0, 10);
    const labels = [
      ...hotEntries.map((e) => e[0]),
      ...coldEntries.map((e) => e[0]),
    ];
    const data = [
      ...hotEntries.map((e) => e[1]),
      ...coldEntries.map((e) => e[1]),
    ];
    const colors = labels.map((_, i) =>
      i < 10 ? "rgba(240, 180, 41, 0.7)" : "rgba(88, 166, 255, 0.5)",
    );

    this.destroyChart("chart4DHotCold");
    this.chartInstances["chart4DHotCold"] = new Chart(
      document.getElementById("chart4DHotCold"),
      {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Frequency",
              data,
              backgroundColor: colors,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: "#8b949e" } },
            x: { ticks: { color: "#8b949e", maxRotation: 45 } },
          },
        },
      },
    );
  },

  renderChartTotoFreq(draws) {
    const freq = AnalysisToto.numberFrequency(draws);
    const labels = Array.from({ length: 49 }, (_, i) => i + 1);
    const data = labels.map((n) => freq[n] || 0);

    this.destroyChart("chartTotoFreq");
    this.chartInstances["chartTotoFreq"] = new Chart(
      document.getElementById("chartTotoFreq"),
      {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Frequency",
              data,
              backgroundColor: "rgba(63, 185, 80, 0.6)",
              borderRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: "#8b949e" } },
            x: { ticks: { color: "#8b949e", font: { size: 9 } } },
          },
        },
      },
    );
  },

  renderChart4DSum(draws) {
    const sums = Analysis4D.sumDistribution(draws);
    if (!sums.distribution) return;
    const entries = Object.entries(sums.distribution).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0]),
    );
    const labels = entries.map((e) => e[0]);
    const data = entries.map((e) => e[1]);

    this.destroyChart("chart4DSum");
    this.chartInstances["chart4DSum"] = new Chart(
      document.getElementById("chart4DSum"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "4D Digit Sum Frequency",
              data,
              borderColor: "#f0b429",
              backgroundColor: "rgba(240,180,41,0.1)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: "#8b949e" } },
            x: { ticks: { color: "#8b949e" } },
          },
        },
      },
    );
  },

  renderChartTotoSum(draws) {
    const sumData = AnalysisToto.sumAnalysis(draws);
    if (!sumData.sums || sumData.sums.length === 0) return;
    // Build frequency distribution from sums array
    const dist = {};
    for (const s of sumData.sums) dist[s] = (dist[s] || 0) + 1;
    const entries = Object.entries(dist).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0]),
    );
    const labels = entries.map((e) => e[0]);
    const data = entries.map((e) => e[1]);

    this.destroyChart("chartTotoSum");
    this.chartInstances["chartTotoSum"] = new Chart(
      document.getElementById("chartTotoSum"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "TOTO Sum Frequency",
              data,
              borderColor: "#3fb950",
              backgroundColor: "rgba(63,185,80,0.1)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: "#8b949e" } },
            x: { ticks: { color: "#8b949e", font: { size: 9 } } },
          },
        },
      },
    );
  },

  renderChartTotoOverdue(draws) {
    const overdue = AnalysisToto.overdueAnalysis(draws);
    // overdue is Array(50), index 0 unused, 1-49 = draws since last seen
    const entries = [];
    for (let n = 1; n <= 49; n++) entries.push([String(n), overdue[n]]);
    entries.sort((a, b) => b[1] - a[1]);
    const top20 = entries.slice(0, 20);
    const labels = top20.map((e) => e[0]);
    const data = top20.map((e) => e[1]);

    this.destroyChart("chartTotoOverdue");
    this.chartInstances["chartTotoOverdue"] = new Chart(
      document.getElementById("chartTotoOverdue"),
      {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Draws Since Last Seen",
              data,
              backgroundColor: "rgba(248, 129, 102, 0.6)",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { color: "#8b949e" } },
            y: { ticks: { color: "#8b949e" } },
          },
        },
      },
    );
  },

  renderAnomalyReport(draws4D, drawsToto) {
    const el = document.getElementById("anomalyReport");
    const anom4D = AnomalyEngine.scan4D(draws4D);
    const anomToto = AnomalyEngine.scanToto(drawsToto);

    // 4D: uniformity is array of 4 positions; entropy is array of 4 position objects
    const chi4D = Array.isArray(anom4D.uniformity)
      ? anom4D.uniformity.reduce((s, p) => s + p.chiSquare, 0) /
        anom4D.uniformity.length
      : 0;
    const any4DSig =
      Array.isArray(anom4D.uniformity) &&
      anom4D.uniformity.some((p) => p.significant);
    const ent4D = Array.isArray(anom4D.entropy)
      ? anom4D.entropy.reduce((s, e) => s + e.normalized, 0) /
        anom4D.entropy.length
      : 0;

    // TOTO: uniformity is single object; entropy is single object
    const chiToto = anomToto.uniformity ? anomToto.uniformity.chiSquare : 0;
    const totoSig = anomToto.uniformity
      ? anomToto.uniformity.significant
      : false;
    const entToto = anomToto.entropy ? anomToto.entropy.normalized || 0 : 0;

    el.innerHTML = `
      <div class="grid-2">
        <div>
          <h4 style="color:var(--accent-gold);margin-bottom:0.5rem">4D Anomalies</h4>
          <div style="font-size:0.85rem">
            <p>Avg Chi²: ${chi4D.toFixed(2)}
              (${any4DSig ? "⚠️ Non-uniform pattern detected" : "✅ Uniform"})</p>
            <p>Avg Normalized Entropy: ${ent4D.toFixed(3)}</p>
          </div>
        </div>
        <div>
          <h4 style="color:var(--accent-green);margin-bottom:0.5rem">TOTO Anomalies</h4>
          <div style="font-size:0.85rem">
            <p>Chi²: ${chiToto.toFixed(2)}
              (${totoSig ? "⚠️ Non-uniform" : "✅ Uniform"})</p>
            <p>Normalized Entropy: ${entToto.toFixed(3)}</p>
          </div>
        </div>
      </div>
    `;
  },

  // ===== Logs Rendering =====
  renderLogs() {
    const logs = PredictionLogger.getAll();
    const el = document.getElementById("logTableWrap");

    // Update stats
    const logs4D = logs.filter((l) => l.game === "4d");
    const logsToto = logs.filter((l) => l.game === "toto");
    document.getElementById("logTotal4D").textContent = logs4D.length;
    document.getElementById("logTotalToto").textContent = logsToto.length;

    const stats4D = PredictionLogger.getAccuracyStats("4d");
    document.getElementById("logHits4D").textContent = stats4D
      ? stats4D.totalHits
      : 0;

    const statsToto = PredictionLogger.getAccuracyStats("toto");
    document.getElementById("logBestToto").textContent = statsToto
      ? statsToto.bestMatch
      : 0;

    if (logs.length === 0) {
      el.innerHTML =
        '<div class="empty-state"><div class="icon">📋</div><p>No predictions logged yet.</p></div>';
      return;
    }

    let html = `<table class="log-table"><thead><tr>
      <th>Date</th><th>Game</th><th>Predictions</th><th>Result</th><th>Actions</th>
    </tr></thead><tbody>`;

    for (const log of logs) {
      const date = new Date(log.timestamp).toLocaleDateString();
      const game =
        log.game === "4d"
          ? '<span class="tag tag-gold">4D</span>'
          : '<span class="tag tag-green">TOTO</span>';
      let predSummary;
      if (log.game === "4d") {
        predSummary = log.tierBreakdown
          .slice(0, 3)
          .map((t) => t.value)
          .join(", ");
        if (log.tierBreakdown.length > 3)
          predSummary += ` +${log.tierBreakdown.length - 3}`;
      } else {
        predSummary = log.tierBreakdown.length + " sets";
      }

      let resultCol = '<span style="color:var(--text-muted)">Pending</span>';
      if (log.accuracy) {
        if (log.game === "4d") {
          const hits = log.accuracy.hits;
          resultCol =
            hits > 0
              ? `<span class="tag tag-green">${hits} hit${hits > 1 ? "s" : ""}</span>`
              : '<span class="tag tag-red">No hits</span>';
        } else {
          resultCol = `Best: ${log.accuracy.bestMatch} match${log.accuracy.bestMatch !== 1 ? "es" : ""}`;
        }
      }

      html += `<tr>
        <td>${date}</td>
        <td>${game}</td>
        <td style="font-family:monospace;font-size:0.8rem">${predSummary}</td>
        <td>${resultCol}</td>
        <td>
          ${!log.accuracy ? `<button class="btn btn-secondary btn-sm" onclick="App.checkResult('${log.id}')">✅ Check</button>` : ""}
          <button class="btn btn-secondary btn-sm" onclick="App.viewLogDetail('${log.id}')">👁</button>
        </td>
      </tr>`;
    }

    html += "</tbody></table>";
    el.innerHTML = html;
  },

  // ===== Utility =====
  destroyChart(id) {
    if (this.chartInstances[id]) {
      this.chartInstances[id].destroy();
      delete this.chartInstances[id];
    }
  },
};
