// =============================================================
// Scenarios — save / compare multiple "what if" runs side by side
// =============================================================

const { useState: useState_S, useEffect: useEffect_S, useRef: useRef_S, useMemo: useMemo_S } = React;
const HelpIcon_S = window.HelpIcon;

// Color palette for scenario identity (8 distinct hues, shared chroma).
// Each scenario picks the first unused hue when saved.
const SCENARIO_HUES = [50, 230, 155, 290, 80, 350, 200, 25];
const hueToColor = (h) => `oklch(0.58 0.13 ${h})`;
const hueToColorSoft = (h) => `oklch(0.92 0.04 ${h})`;
const hueToColorSoftDark = (h) => `oklch(0.34 0.04 ${h})`;

const STORE_KEY = "rep:scenarios:v2";

// ---------- Storage hook ----------

function useScenarios() {
  const [scenarios, setScenarios] = useState_S(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });

  useEffect_S(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(scenarios));
    } catch (_) {}
  }, [scenarios]);

  const nextHue = () => {
    const used = new Set(scenarios.map((s) => s.hue));
    for (const h of SCENARIO_HUES) if (!used.has(h)) return h;
    return SCENARIO_HUES[scenarios.length % SCENARIO_HUES.length];
  };

  const add = (scn) => {
    const item = {
      id: "s_" + Math.random().toString(36).slice(2, 9),
      hue: nextHue(),
      createdAt: Date.now(),
      ...scn,
    };
    setScenarios((arr) => [...arr, item]);
    return item;
  };

  const update = (id, patch) =>
    setScenarios((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id) =>
    setScenarios((arr) => arr.filter((s) => s.id !== id));

  const clear = () => setScenarios([]);

  return { scenarios, add, update, remove, clear };
}
window.useScenarios = useScenarios;

// ---------- Compute helper ----------

// If `extendToYears` is greater than the scenario's own horizon, the projection
// is re-run on that longer horizon while pinning the loan term to the original
// (so the user's "5y mortgage" becomes "5y mortgage + N extra credit-free
// years"). The original horizon is returned so the chart can render the tail
// as dashed.
function computeResult(scn, allAssetData, extendToYears = null) {
  const input = { ...scn.form };
  const originalYears = input.years;
  if (extendToYears != null && extendToYears > originalYears) {
    const origLoanTerm = input.loan_term_years ?? originalYears;
    input.loan_term_years = Math.min(origLoanTerm, originalYears);
    input.years = extendToYears;
  }
  input.assets = {};
  for (const sym of scn.assets || []) {
    if (allAssetData[sym]) {
      input.assets[sym] = {
        average_growth: allAssetData[sym].average_growth,
        current_price: allAssetData[sym].current_price,
      };
    }
  }
  try {
    const result = runProjection(input);
    return { result, originalYears };
  } catch (e) {
    console.warn("Scenario compute failed", scn.name, e);
    return { result: null, originalYears };
  }
}
window.computeScenarioResult = computeResult;

// ---------- Scenario Bar ----------

function ScenarioBar({
  scenarios,
  activeId,
  draftDirty,
  onLoad,
  onSave,
  onRename,
  onDelete,
  onOpenCompare,
  hasResult,
  t,
}) {
  const empty = scenarios.length === 0;
  const canCompare = scenarios.length >= 1; // 1 saved + draft, or 2+ saved
  const [renamingId, setRenamingId] = useState_S(null);

  return (
    <div className="scn-bar">
      <div className="scn-bar-head">
        <div className="scn-bar-title">
          <span className="scn-bar-dot" aria-hidden="true"></span>
          {t("scn_bar_title")}
          {!empty ? <span className="scn-bar-count">{scenarios.length}</span> : null}
        </div>
        <div className="scn-bar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSave}
            disabled={!hasResult}
            title={!hasResult ? t("scn_save_need_calc") : ""}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            {draftDirty && !empty ? t("scn_save_as_new") : t("scn_save_current")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenCompare}
            disabled={!canCompare}
            title={!canCompare ? t("scn_compare_need_two") : ""}
          >
            {t("scn_compare")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="scn-bar-list">
        {/* Draft / current chip */}
        <div className={`scn-chip scn-chip-draft ${activeId == null ? "active" : ""}`}>
          <span className="scn-chip-dot" style={{ background: "var(--ink-mute)" }}></span>
          <span className="scn-chip-name">
            {t("scn_draft")}
            {draftDirty ? <span className="scn-chip-dirty" title={t("scn_dirty")}>•</span> : null}
          </span>
          <span className="scn-chip-meta">{t("scn_draft_sub")}</span>
        </div>

        {scenarios.map((s) => {
          const isActive = s.id === activeId;
          const color = hueToColor(s.hue);
          return (
            <div
              key={s.id}
              className={`scn-chip ${isActive ? "active" : ""}`}
              style={{ "--scn-color": color, "--scn-color-soft": hueToColorSoft(s.hue) }}
              onClick={(e) => {
                if (renamingId === s.id) return;
                if (e.target.closest(".scn-chip-x")) return;
                onLoad(s);
              }}
            >
              <span className="scn-chip-dot" style={{ background: color }}></span>
              {renamingId === s.id ? (
                <input
                  className="scn-chip-rename"
                  defaultValue={s.name}
                  autoFocus
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) onRename(s.id, v);
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") { e.target.value = s.name; e.target.blur(); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="scn-chip-name"
                  onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(s.id); }}
                  title={t("scn_double_to_rename")}
                >
                  {s.name}
                </span>
              )}
              <span className="scn-chip-meta">{s.form.years}{t("f_years_unit")} · {s.form.interest_rate}%</span>
              <button
                className="scn-chip-x"
                title={t("scn_delete")}
                onClick={(e) => { e.stopPropagation(); if (confirm(t("scn_delete_confirm").replace("{n}", s.name))) onDelete(s.id); }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/>
                  <line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/>
                </svg>
              </button>
            </div>
          );
        })}

        {empty ? (
          <div className="scn-bar-empty">{t("scn_empty_hint")}</div>
        ) : null}
      </div>
    </div>
  );
}
window.ScenarioBar = ScenarioBar;

// ---------- Compare view ----------

// metric definitions for compare table: how to pull a single number from a result
const COMPARE_METRICS = [
  { key: "monthly_payment_tl", label: "i_monthly_payment", fmt: "tl",
    get: (r) => r.monthly_tl_payment },
  { key: "total_paid_tl",      label: "i_total_paid",      fmt: "tl",
    get: (r) => r.total_paid_tl },
  { key: "real_cost_usd",      label: "i_real_cost",       fmt: "usd",
    get: (r) => r.total_credit_amount_usd_annual.at(-1) },
  { key: "net_payment_usd",    label: "i_net_payment",     fmt: "usd",
    get: (r) => r.total_credit_minus_rent_usd_yearly
      ? r.total_credit_minus_rent_usd_yearly.at(-1)
      : null },
  { key: "house_final_usd",    label: "cmp_house_final",   fmt: "usd",
    get: (r) => r.value_of_house_usd_yearly.at(-1) },
  { key: "house_plus_rent",    label: "view_rent_vs",      fmt: "usd",
    get: (r) => r.house_plus_rent_yearly.at(-1) },
  { key: "house_appreciation", label: "i_house_appreciation", fmt: "pct",
    get: (r) => (r.value_of_house_usd_yearly.at(-1) / r.value_of_house_usd_yearly[0] - 1) },
  { key: "breakeven",          label: "i_breakeven",       fmt: "year",
    get: (r) => (r.breakeven_month == null ? -1 : Math.ceil(r.breakeven_month / 12)) },
  { key: "fx_final",           label: "cmp_fx_final",      fmt: "tl_short",
    get: (r) => r.dollar_rates_annual.at(-1) },
];

// "higher is better" / "lower is better" map — drives the winner highlight + arrow direction.
const METRIC_DIR = {
  monthly_payment_tl: "lower",
  total_paid_tl: "lower",
  real_cost_usd: "lower",
  net_payment_usd: "lower",
  house_final_usd: "higher",
  house_plus_rent: "higher",
  house_appreciation: "higher",
  breakeven: "lower",   // earlier breakeven = better (but -1 = never)
  fx_final: "neutral",
};

// What to plot in compare overlay
const OVERLAY_VIEWS = {
  decision: { titleKey: "view_decision", subKey: "view_decision_sub",
    series: { key: "value_of_house_usd_yearly", labelKey: "f_value" }, unit: "USD" },
  total_paid: { titleKey: "i_total_paid", subKey: "cmp_total_paid_sub",
    series: { key: "total_credit_amount_usd_annual", labelKey: "i_total_paid" }, unit: "USD" },
  rent_vs:    { titleKey: "view_rent_vs", subKey: "view_rent_vs_sub",
    series: { key: "house_plus_rent_yearly", labelKey: "view_rent_vs" }, unit: "USD" },
  net_payment: { titleKey: "i_net_payment", subKey: "cmp_net_payment_sub",
    series: { key: "total_credit_minus_rent_usd_yearly", labelKey: "i_net_payment" }, unit: "USD" },
  monthly_payment: { titleKey: "view_payment", subKey: "view_payment_sub",
    series: { key: "monthly_payment_usd", labelKey: "i_monthly_payment" }, unit: "USD/ay" },
  fx: { titleKey: "view_macro", subKey: "view_macro_sub",
    series: { key: "dollar_rates_annual", labelKey: "f_start_dollar" }, unit: "TL" },
};

function fmtMetric(v, kind) {
  if (v == null || !isFinite(v)) return "—";
  if (kind === "tl") {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M ₺";
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + "k ₺";
    return Math.round(v).toLocaleString("tr-TR") + " ₺";
  }
  if (kind === "tl_short") {
    if (Math.abs(v) >= 1_000) return v.toFixed(2) + " ₺";
    return v.toFixed(2) + " ₺";
  }
  if (kind === "usd") {
    if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (Math.abs(v) >= 1_000) return "$" + (v / 1_000).toFixed(1) + "k";
    return "$" + Math.round(v);
  }
  if (kind === "pct") return (v >= 0 ? "+" : "") + (v * 100).toFixed(0) + "%";
  if (kind === "year") return v === -1 ? "—" : v === 0 ? "Y1" : "Y" + v;
  return String(v);
}

// ---------- Overlay chart ----------

function CompareChart({ scenarios, results, originalYearsByIdx = [], view, t, isDark }) {
  const canvasRef = useRef_S(null);
  const chartRef = useRef_S(null);

  useEffect_S(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) { try { chartRef.current.destroy(); } catch (_) {} chartRef.current = null; }
    const def = OVERLAY_VIEWS[view];
    const isMonthly = def.series.key === "monthly_payment_usd";

    // Build labels: use the longest axis among scenarios for x.
    let labelsArr = [];
    for (const r of results) {
      if (!r) continue;
      const axis = isMonthly ? r.months_axis : r.years_axis;
      if (axis && axis.length > labelsArr.length) labelsArr = Array.from(axis);
    }

    const datasets = [];
    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      const r = results[i];
      if (!r) continue;
      const arr = r[def.series.key];
      if (!arr) continue;
      const color = hueToColor(s.hue);
      // Boundary index between "scenario's own horizon" and "auto-extended
      // credit-free tail". Past this point the engine has zero monthly
      // payment; visualize as a dashed segment so the eye can tell the
      // genuine vs the implied region apart.
      const origYears = originalYearsByIdx[i] ?? s.form.years;
      const boundary = isMonthly ? origYears * 12 : origYears;
      datasets.push({
        label: s.name,
        data: arr,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.2,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        fill: false,
        segment: {
          borderDash: (ctx) => (ctx.p1DataIndex > boundary ? [6, 4] : undefined),
        },
      });
    }

    const ink = isDark ? "oklch(0.78 0.01 75)" : "oklch(0.44 0.012 70)";
    const grid = isDark ? "oklch(0.32 0.012 75)" : "oklch(0.91 0.008 80)";
    const border = isDark ? "oklch(0.40 0.014 75)" : "oklch(0.85 0.01 80)";

    chartRef.current = new Chart(canvasRef.current.getContext("2d"), {
      type: "line",
      data: { labels: labelsArr, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true, position: "bottom",
            labels: { color: ink, boxWidth: 10, boxHeight: 10, padding: 14,
              usePointStyle: true, pointStyle: "rectRounded",
              font: { family: "Geist, system-ui", size: 12 } },
          },
          tooltip: {
            backgroundColor: isDark ? "oklch(0.18 0.01 75)" : "oklch(0.22 0.015 70)",
            titleColor: "#fff", bodyColor: "oklch(0.85 0.01 75)",
            borderColor: border, borderWidth: 1, padding: 10, cornerRadius: 8,
            titleFont: { family: "Geist, system-ui", size: 12, weight: "600" },
            bodyFont: { family: "Geist Mono, monospace", size: 12 },
            callbacks: {
              label: (item) => {
                const v = item.parsed.y;
                if (v == null) return item.dataset.label + ": —";
                const fmt = def.unit === "TL"
                  ? v.toFixed(2) + " ₺"
                  : "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
                return "  " + item.dataset.label + "   " + fmt;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: grid, drawBorder: false },
            border: { display: false },
            ticks: { color: ink, maxRotation: 0, autoSkip: true, maxTicksLimit: 11,
              font: { family: "Geist Mono, monospace", size: 11 } },
          },
          y: {
            grid: { color: grid, drawBorder: false },
            border: { display: false },
            ticks: { color: ink, font: { family: "Geist Mono, monospace", size: 11 },
              callback: (val) => {
                if (def.unit === "TL") return val.toFixed(0);
                if (Math.abs(val) >= 1_000_000) return "$" + (val / 1_000_000).toFixed(1) + "M";
                if (Math.abs(val) >= 1_000) return "$" + (val / 1_000).toFixed(0) + "k";
                return "$" + val.toFixed(0);
              },
            },
          },
        },
      },
    });

    return () => { if (chartRef.current) { try { chartRef.current.destroy(); } catch (_) {} chartRef.current = null; } };
  }, [scenarios, results, view, t, isDark]);

  return <canvas ref={canvasRef}></canvas>;
}

function CompareView({ scenarios, allAssetData, t, lang, isDark, onClose }) {
  const [view, setView] = useState_S("decision");
  const [hidden, setHidden] = useState_S(new Set()); // ids hidden from comparison
  const [saving, setSaving] = useState_S(false);
  const [rptBusy, setRptBusy] = useState_S(false);
  const compareRef = useRef_S(null);

  const saveCompare = async () => {
    if (!compareRef.current || !window.html2canvas || saving) return;
    setSaving(true);
    try {
      // Pick a background that matches the current theme so the exported
      // PNG isn't a transparent rectangle on light viewers.
      const cssBg = getComputedStyle(document.body).backgroundColor || (isDark ? "#1c1917" : "#fafaf9");
      const canvas = await window.html2canvas(compareRef.current, {
        backgroundColor: cssBg,
        scale: window.devicePixelRatio > 1 ? 2 : 1,
        useCORS: true,
        // Don't try to rasterize the floating tweaks panel or any other
        // overlay that lives outside the compare panel.
        ignoreElements: (el) => el.classList && el.classList.contains("tweaks-panel"),
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
      a.download = `compare-${ts}.png`;
      a.click();
    } catch (e) {
      console.warn("Compare save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const activeScns = useMemo_S(
    () => scenarios.filter((s) => !hidden.has(s.id)),
    [scenarios, hidden]
  );

  // All scenarios are computed to the longest horizon so they can be drawn
  // on a shared x-axis. Each entry remembers its original horizon so the
  // chart can render the "credit-free tail" as a dashed segment.
  const maxYears = useMemo_S(
    () => activeScns.reduce((m, s) => Math.max(m, s.form.years), 0),
    [activeScns]
  );
  const computed = useMemo_S(
    () => activeScns.map((s) => computeResult(s, allAssetData, maxYears)),
    [activeScns, allAssetData, maxYears]
  );
  const results = useMemo_S(() => computed.map((c) => c.result), [computed]);
  const originalYearsByIdx = useMemo_S(
    () => computed.map((c) => c.originalYears),
    [computed]
  );

  const toggleHide = (id) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Determine winner per metric
  const winners = useMemo_S(() => {
    const out = {};
    for (const m of COMPARE_METRICS) {
      const vals = results.map((r) => r ? m.get(r) : null);
      const dir = METRIC_DIR[m.key];
      if (dir === "neutral") continue;
      let bestIdx = -1, bestVal = null;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v == null || !isFinite(v)) continue;
        // breakeven -1 means never; treat as worst
        if (m.key === "breakeven" && v === -1) continue;
        if (bestVal == null) { bestVal = v; bestIdx = i; continue; }
        if (dir === "lower" && v < bestVal) { bestVal = v; bestIdx = i; }
        if (dir === "higher" && v > bestVal) { bestVal = v; bestIdx = i; }
      }
      out[m.key] = bestIdx;
    }
    return out;
  }, [results]);

  const overlay = OVERLAY_VIEWS[view];

  return (
    <div className="compare" data-screen-label="03 Compare" ref={compareRef}>
      <div className="compare-head">
        <div>
          <h2 className="compare-title">{t("scn_compare_title")}</h2>
          <p className="compare-sub">{t("scn_compare_sub").replace("{n}", String(scenarios.length))}</p>
        </div>
        <div className="cmp-head-actions">
          <button className="btn btn-ghost" onClick={saveCompare} disabled={saving} title={t("cmp_save_title")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {saving ? t("cmp_save_saving") : t("cmp_save")}
          </button>
          {window.ReportLauncher ? (
            <window.ReportLauncher
              kind="compare"
              onGenerate={async (chartKeys) => {
                if (!window.generateCompareReport) return;
                setRptBusy(true);
                try {
                  await window.generateCompareReport({ scenarios: activeScns, allAssetData, t, lang, chartKeys });
                } finally {
                  setTimeout(() => setRptBusy(false), 600);
                }
              }}
              busy={rptBusy}
              variant="primary"
              t={t}
              lang={lang}
            />
          ) : window.ReportButton ? (
            <window.ReportButton
              onClick={async () => {
                if (!window.generateCompareReport) return;
                setRptBusy(true);
                try {
                  await window.generateCompareReport({ scenarios: activeScns, allAssetData, t, lang });
                } finally {
                  setTimeout(() => setRptBusy(false), 600);
                }
              }}
              label={rptBusy ? t("rpt_busy") : t("rpt_button_compare")}
              busy={rptBusy}
              variant="primary"
            />
          ) : null}
          <button className="btn btn-ghost" onClick={onClose}>
            ← {t("scn_back_to_results")}
          </button>
        </div>
      </div>

      {/* Scenario legend / toggles */}
      <div className="cmp-legend">
        {scenarios.map((s) => {
          const isHidden = hidden.has(s.id);
          return (
            <button
              key={s.id}
              className={`cmp-legend-item ${isHidden ? "hidden" : ""}`}
              style={{ "--scn-color": hueToColor(s.hue) }}
              onClick={() => toggleHide(s.id)}
              title={isHidden ? t("scn_show") : t("scn_hide")}
            >
              <span className="cmp-legend-dot"></span>
              <span className="cmp-legend-name">{s.name}</span>
              <span className="cmp-legend-meta">
                {s.form.years}{t("f_years_unit")} · {s.form.value_of_house_tl >= 1_000_000
                  ? "₺" + (s.form.value_of_house_tl / 1_000_000).toFixed(1) + "M"
                  : "₺" + s.form.value_of_house_tl}
              </span>
            </button>
          );
        })}
      </div>

      {/* Overlay chart */}
      <div className="cmp-chart-panel">
        <div className="cmp-chart-head">
          <div>
            <h3 className="cmp-chart-title">{t(overlay.titleKey)}</h3>
            <p className="cmp-chart-sub">{t(overlay.subKey)}</p>
          </div>
          <div className="view-switch" role="tablist">
            {Object.keys(OVERLAY_VIEWS).map((id) => (
              <button
                key={id}
                className={id === view ? "active" : ""}
                onClick={() => setView(id)}
              >
                {t(OVERLAY_VIEWS[id].titleKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="cmp-chart-wrap">
          <CompareChart scenarios={activeScns} results={results} originalYearsByIdx={originalYearsByIdx} view={view} t={t} isDark={isDark} />
        </div>
      </div>

      {/* Metric matrix */}
      <div className="cmp-table-panel">
        <div className="cmp-table-head">
          <h3>{t("scn_metrics_title")}</h3>
          <p>{t("scn_metrics_sub")}</p>
        </div>
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th className="cmp-th-metric">{t("scn_metric")}</th>
                {activeScns.map((s) => (
                  <th key={s.id} className="cmp-th-scn" style={{ "--scn-color": hueToColor(s.hue) }}>
                    <span className="cmp-th-dot"></span>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((m) => {
                const winnerIdx = winners[m.key];
                return (
                  <tr key={m.key}>
                    <td className="cmp-td-metric">
                      {t(m.label)}
                      {METRIC_DIR[m.key] !== "neutral" ? (
                        <span className="cmp-td-dir">
                          {METRIC_DIR[m.key] === "lower" ? t("scn_lower_better") : t("scn_higher_better")}
                        </span>
                      ) : null}
                    </td>
                    {results.map((r, i) => {
                      if (!r) return <td key={i} className="cmp-td-val">—</td>;
                      const v = m.get(r);
                      const isWin = winnerIdx === i;
                      return (
                        <td key={i} className={`cmp-td-val ${isWin ? "winner" : ""}`}>
                          {fmtMetric(v, m.fmt)}
                          {isWin ? <span className="cmp-win">✓</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cmp-table-note">
          ✓ = {t("scn_winner_note")}
        </div>
      </div>
    </div>
  );
}
window.CompareView = CompareView;
