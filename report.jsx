// =============================================================
// Report generation — print-ready PDF reports for single scenario
// and scenario comparison. Renders Chart.js charts off-screen,
// embeds as PNG into a styled HTML report, opens in a new window,
// triggers print → user saves as PDF via browser dialog.
// =============================================================

const REPORT_COLORS = [
  "rgb(178, 102, 64)",   // terracotta
  "rgb(60, 110, 175)",   // blue
  "rgb(70, 145, 95)",    // green
  "rgb(135, 95, 175)",   // purple
  "rgb(180, 145, 65)",   // amber
  "rgb(170, 70, 110)",   // rose
  "rgb(110, 100, 95)",   // taupe
  "rgb(85, 145, 175)",   // teal
];

const REPORT_INK = "#2a241d";
const REPORT_INK_MUTE = "#76695b";
const REPORT_GRID = "rgba(42, 36, 29, 0.08)";
const REPORT_BG_SOFT = "#faf6ef";
const REPORT_BORDER = "#e8dfd2";

// ----- formatting helpers -----
function fmtUSD_R(n) {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}
function fmtTL_R(n) {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M ₺";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "k ₺";
  return Math.round(n).toLocaleString("tr-TR") + " ₺";
}
function fmtTLFull_R(n) {
  if (n == null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("tr-TR") + " ₺";
}
function fmtPct_R(n) {
  if (n == null || !isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
}
function fmtYear_R(v) {
  if (v == null) return "—";
  if (v === -1) return "—";
  if (v === 0) return "Y1";
  return "Y" + v;
}
function todayStr(lang) {
  const d = new Date();
  if (lang === "tr") {
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ----- core: render Chart.js to off-screen PNG -----
async function renderChartImage(config, width = 1600, height = 720) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;left:-99999px;top:-99999px;width:" + width + "px;height:" + height + "px;background:#fff;";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    const merged = {
      ...config,
      options: {
        ...(config.options || {}),
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2,
      },
    };
    let chart;
    try {
      chart = new Chart(canvas.getContext("2d"), merged);
    } catch (e) {
      console.warn("Chart render failed", e);
      wrap.remove();
      resolve(null);
      return;
    }

    setTimeout(() => {
      let img = null;
      try {
        img = chart.toBase64Image("image/png", 1);
      } catch (e) {
        console.warn("toBase64Image failed", e);
      }
      try { chart.destroy(); } catch (_) {}
      wrap.remove();
      resolve(img);
    }, 120);
  });
}

// ----- baseline chart options used across the report -----
function commonChartOpts(unit, t) {
  return {
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          color: REPORT_INK,
          boxWidth: 12,
          boxHeight: 12,
          padding: 16,
          usePointStyle: true,
          pointStyle: "rectRounded",
          font: { family: "Geist, system-ui, sans-serif", size: 14 },
        },
      },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        grid: { color: REPORT_GRID, drawBorder: false },
        border: { display: false },
        ticks: {
          color: REPORT_INK_MUTE,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
          font: { family: "Geist Mono, ui-monospace, monospace", size: 12 },
        },
      },
      y: {
        grid: { color: REPORT_GRID, drawBorder: false },
        border: { display: false },
        ticks: {
          color: REPORT_INK_MUTE,
          font: { family: "Geist Mono, ui-monospace, monospace", size: 12 },
          callback: (val) => {
            if (unit === "%") return val.toFixed(0) + "%";
            if (unit === "TL") return val.toFixed(0);
            if (Math.abs(val) >= 1_000_000) return "$" + (val / 1_000_000).toFixed(1) + "M";
            if (Math.abs(val) >= 1_000) return "$" + (val / 1_000).toFixed(0) + "k";
            return "$" + val.toFixed(0);
          },
        },
      },
    },
  };
}

// ===== Single-scenario chart builders =====
async function buildDecisionChart(result, t) {
  const labels = Array.from(result.years_axis);
  const datasets = [
    {
      label: t("i_total_paid"),
      data: result.total_credit_amount_usd_annual,
      borderColor: REPORT_COLORS[4],
      backgroundColor: REPORT_COLORS[4],
      borderDash: [8, 5],
      borderWidth: 2.4,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("f_value"),
      data: result.value_of_house_usd_yearly,
      borderColor: REPORT_COLORS[0],
      backgroundColor: REPORT_COLORS[0],
      borderWidth: 2.8,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("view_rent_vs"),
      data: result.house_plus_rent_yearly,
      borderColor: REPORT_COLORS[2],
      backgroundColor: REPORT_COLORS[2],
      borderWidth: 2.4,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
  ];
  if (result.asset_projections) {
    let i = 0;
    for (const sym of Object.keys(result.asset_projections)) {
      const proj = result.asset_projections[sym];
      datasets.push({
        label: `${sym} (+${proj.average_growth.toFixed(1)}%/yr)`,
        data: proj.yearly,
        borderColor: REPORT_COLORS[(3 + i) % REPORT_COLORS.length],
        backgroundColor: REPORT_COLORS[(3 + i) % REPORT_COLORS.length],
        borderDash: [4, 4],
        borderWidth: 1.8,
        tension: 0.2,
        pointRadius: 0,
        fill: false,
      });
      i++;
    }
  }
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts("USD", t),
  });
}

async function buildNetPaymentChart(result, t) {
  const labels = Array.from(result.years_axis);
  const netLine = result.total_credit_minus_rent_usd_yearly || [];
  const totalLine = result.total_credit_amount_usd_annual || [];
  const cumRent = result.cumulative_rent_price_usd_yearly || [];
  const datasets = [
    {
      label: t("i_net_payment"),
      data: netLine,
      borderColor: REPORT_COLORS[3],
      backgroundColor: REPORT_COLORS[3],
      borderWidth: 2.8,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("i_total_paid"),
      data: totalLine,
      borderColor: REPORT_COLORS[0],
      backgroundColor: REPORT_COLORS[0],
      borderDash: [6, 4],
      borderWidth: 2.2,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("f_cum_rent"),
      data: cumRent,
      borderColor: REPORT_COLORS[5],
      backgroundColor: REPORT_COLORS[5],
      borderDash: [4, 4],
      borderWidth: 2.2,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
  ];
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts("USD", t),
  });
}

async function buildPaymentChart(result, t) {
  const labels = Array.from(result.years_axis);
  const monthlyAnnual = result.annual_payment_usd || result.monthly_payment_usd?.filter((_, i) => i % 12 === 0);
  const rentAnnual = result.rent_price_usd_yearly;
  const datasets = [
    {
      label: t("i_monthly_payment"),
      data: monthlyAnnual,
      borderColor: REPORT_COLORS[0],
      backgroundColor: REPORT_COLORS[0],
      borderWidth: 2.6,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("f_rent"),
      data: rentAnnual,
      borderColor: REPORT_COLORS[5],
      backgroundColor: REPORT_COLORS[5],
      borderDash: [8, 5],
      borderWidth: 2.4,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
  ];
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts("USD/ay", t),
  });
}

async function buildRentVsChart(result, t) {
  const labels = Array.from(result.years_axis);
  const datasets = [
    {
      label: t("view_rent_vs"),
      data: result.house_plus_rent_yearly,
      borderColor: REPORT_COLORS[2],
      backgroundColor: REPORT_COLORS[2],
      borderWidth: 2.8,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("i_total_paid"),
      data: result.total_credit_amount_usd_annual,
      borderColor: REPORT_COLORS[0],
      backgroundColor: REPORT_COLORS[0],
      borderDash: [8, 5],
      borderWidth: 2.4,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
    {
      label: t("f_rent"),
      data: result.cumulative_rent_price_usd_yearly,
      borderColor: REPORT_COLORS[5],
      backgroundColor: REPORT_COLORS[5],
      borderWidth: 2.4,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
  ];
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts("USD", t),
  });
}

async function buildMacroChart(result, t) {
  const labels = Array.from(result.years_axis);
  const datasets = [
    {
      label: t("f_start_dollar"),
      data: result.dollar_rates_annual,
      borderColor: REPORT_COLORS[1],
      backgroundColor: REPORT_COLORS[1],
      borderWidth: 2.6,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    },
  ];
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts("TL", t),
  }, 1600, 600);
}

// ===== Compare chart builder =====
function hueToRgb(hue) {
  // approximate oklch(0.58 0.13 hue) → rgb using HSL fallback
  // we only need print-friendly distinct colors
  return `hsl(${hue}, 55%, 45%)`;
}

async function buildCompareChart(scenarios, results, seriesKey, unit, t) {
  let labels = [];
  for (const r of results) {
    if (!r) continue;
    const isMonthly = seriesKey === "monthly_payment_usd";
    const axis = isMonthly ? r.months_axis : r.years_axis;
    if (axis && axis.length > labels.length) labels = Array.from(axis);
  }
  const datasets = [];
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const r = results[i];
    if (!r) continue;
    const arr = r[seriesKey];
    if (!arr) continue;
    const color = hueToRgb(s.hue);
    datasets.push({
      label: s.name,
      data: arr,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2.6,
      tension: 0.2,
      pointRadius: 0,
      fill: false,
    });
  }
  return renderChartImage({
    type: "line",
    data: { labels, datasets },
    options: commonChartOpts(unit, t),
  });
}

// ===== Insight calculations (mirrors results.jsx) =====
function findBreakeven_R(result) {
  const a = result.house_plus_rent_yearly;
  const b = result.total_credit_amount_usd_annual;
  if (!a || !b) return null;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] > b[i]) return i;
  return -1;
}

function bestAlternative_R(result, downPaymentUsd) {
  const proj = result.asset_projections || {};
  let best = null;
  for (const [sym, data] of Object.entries(proj)) {
    const arr = data.yearly;
    if (!arr || arr.length < 2) continue;
    const start = arr[0];
    const end = arr[arr.length - 1];
    const gainPct = (end / start - 1) * 100;
    const finalValue = downPaymentUsd ? downPaymentUsd * (end / start) : end;
    if (!best || gainPct > best.gainPct) best = { sym, gainPct, end, start, finalValue };
  }
  return best;
}

function computeVerdict(result, t) {
  const hpr = result.house_plus_rent_yearly;
  const tot = result.total_credit_amount_usd_annual;
  if (!hpr || !tot) return null;
  const houseNet = hpr.at(-1) - tot.at(-1);
  const baseline = Math.abs(tot.at(-1));
  const ratio = houseNet / baseline;
  if (ratio > 0.1) return { kind: "positive", title: t("verdict_house"), body: t("verdict_house_p") };
  if (ratio < -0.1) return { kind: "negative", title: t("verdict_invest"), body: t("verdict_invest_p") };
  return { kind: "neutral", title: t("verdict_close"), body: t("verdict_close_p").replace("{p}", (Math.abs(ratio) * 100).toFixed(1)) };
}

// ===== Shared print stylesheet =====
const REPORT_CSS = `
  @page { size: A4 portrait; margin: 14mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: ${REPORT_INK};
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    padding: 0;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1.5px solid ${REPORT_INK};
    margin-bottom: 22px;
  }
  .brand {
    display: flex; align-items: center; gap: 12px;
  }
  .brand-mark {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: ${REPORT_COLORS[0]};
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 20px;
    font-family: Geist Mono, ui-monospace, monospace;
  }
  .brand-text { line-height: 1.1; }
  .brand-text strong { font-size: 14pt; display: block; font-weight: 600; }
  .brand-text small { font-size: 9pt; color: ${REPORT_INK_MUTE}; }
  .header-meta { text-align: right; font-size: 9pt; color: ${REPORT_INK_MUTE}; line-height: 1.5; font-family: Geist Mono, monospace; }
  .header-meta strong { font-family: Geist, sans-serif; font-weight: 600; color: ${REPORT_INK}; font-size: 10pt; }

  h1.report-title {
    font-size: 24pt;
    line-height: 1.15;
    margin: 0 0 6px 0;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  h1.report-title em { font-style: normal; color: ${REPORT_COLORS[0]}; }
  .report-sub {
    font-size: 11pt; color: ${REPORT_INK_MUTE};
    margin: 0 0 22px 0;
    max-width: 90%;
    line-height: 1.45;
  }

  h2.section-title {
    font-size: 14pt;
    font-weight: 600;
    margin: 18px 0 10px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid ${REPORT_BORDER};
    letter-spacing: -0.005em;
  }
  h2.section-title small { display: block; font-size: 9pt; color: ${REPORT_INK_MUTE}; font-weight: 400; margin-top: 2px; }

  /* Verdict */
  .verdict {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 14px 16px;
    border-radius: 12px;
    background: ${REPORT_BG_SOFT};
    border: 1px solid ${REPORT_BORDER};
    margin-bottom: 18px;
  }
  .verdict.positive { background: #ecf3e9; border-color: #cdddc4; }
  .verdict.negative { background: #fbeee2; border-color: #f0d9bd; }
  .verdict-mark {
    width: 32px; height: 32px; flex: 0 0 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: ${REPORT_COLORS[0]}; color: #fff;
    font-weight: 700; font-size: 16pt;
  }
  .verdict.positive .verdict-mark { background: ${REPORT_COLORS[2]}; }
  .verdict.negative .verdict-mark { background: ${REPORT_COLORS[1]}; }
  .verdict h3 { margin: 0 0 4px 0; font-size: 13pt; font-weight: 600; }
  .verdict p { margin: 0; font-size: 10pt; color: ${REPORT_INK_MUTE}; line-height: 1.5; }

  /* Insights grid */
  .insights {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 18px;
  }
  .insight {
    border: 1px solid ${REPORT_BORDER};
    border-radius: 10px;
    padding: 12px 14px;
    background: #fff;
  }
  .insight.accent { border-color: ${REPORT_COLORS[0]}; background: #faf3ec; }
  .insight-label {
    font-size: 8.5pt; color: ${REPORT_INK_MUTE};
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-bottom: 4px;
  }
  .insight-value {
    font-size: 17pt; font-weight: 600; line-height: 1.1;
    font-family: Geist Mono, ui-monospace, monospace;
    letter-spacing: -0.01em;
  }
  .insight-value small { font-size: 11pt; font-weight: 500; color: ${REPORT_INK_MUTE}; margin-left: 2px; }
  .insight-note { font-size: 8.5pt; color: ${REPORT_INK_MUTE}; margin-top: 4px; font-family: Geist Mono, monospace; }

  /* Chart cards */
  .chart-card {
    border: 1px solid ${REPORT_BORDER};
    border-radius: 12px;
    padding: 14px 16px 12px;
    margin-bottom: 16px;
    background: #fff;
    page-break-inside: avoid;
  }
  .chart-card h3 {
    margin: 0 0 2px 0;
    font-size: 12pt;
    font-weight: 600;
  }
  .chart-card .chart-sub {
    margin: 0 0 10px 0;
    font-size: 9pt;
    color: ${REPORT_INK_MUTE};
    line-height: 1.45;
  }
  .chart-card .chart-method {
    margin: 8px 0 0 0;
    font-size: 8.5pt;
    color: ${REPORT_INK_MUTE};
    line-height: 1.45;
    border-top: 1px dashed ${REPORT_BORDER};
    padding-top: 8px;
  }
  .chart-card img { width: 100%; height: auto; display: block; }

  /* Assumptions table */
  .assumptions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    border: 1px solid ${REPORT_BORDER};
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .assumptions .row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid ${REPORT_BORDER};
    font-size: 9.5pt;
  }
  .assumptions .row:nth-child(odd) { border-right: 1px solid ${REPORT_BORDER}; }
  .assumptions .row:nth-last-child(-n+2) { border-bottom: none; }
  .assumptions .row span:first-child { color: ${REPORT_INK_MUTE}; }
  .assumptions .row span:last-child { font-family: Geist Mono, monospace; font-weight: 500; }

  /* Grouped inputs (single report) */
  .assumptions-grouped {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    border: 0;
  }
  .assumptions-grouped .input-group {
    border: 1px solid ${REPORT_BORDER};
    border-radius: 10px;
    overflow: hidden;
  }
  .assumptions-grouped .input-group-title {
    background: #f4ede2;
    padding: 6px 12px;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: ${REPORT_INK_MUTE};
    text-transform: uppercase;
  }
  .assumptions-grouped .row { border-right: 0; padding: 7px 12px; }
  .assumptions-grouped .row:last-child { border-bottom: none; }

  /* Side-by-side inputs table (compare report) */
  table.inputs-table {
    width: 100%; border-collapse: collapse; font-size: 9.5pt;
    border: 1px solid ${REPORT_BORDER}; border-radius: 10px; overflow: hidden;
    margin-bottom: 16px;
  }
  table.inputs-table th, table.inputs-table td {
    border-bottom: 1px solid ${REPORT_BORDER};
    padding: 7px 10px; text-align: left; vertical-align: top;
  }
  table.inputs-table thead th {
    background: #f4ede2; font-size: 9pt; font-weight: 600;
    color: ${REPORT_INK};
  }
  table.inputs-table th.group-row {
    background: #faf5ec; color: ${REPORT_INK_MUTE};
    font-size: 8.5pt; letter-spacing: 0.06em; text-transform: uppercase;
    font-weight: 600;
  }
  table.inputs-table td.metric { color: ${REPORT_INK_MUTE}; }
  table.inputs-table td.val { font-family: Geist Mono, monospace; font-weight: 500; }
  table.inputs-table tr:last-child td { border-bottom: none; }

  /* Per-year rate table */
  table.rate-table {
    width: 100%; border-collapse: collapse; font-size: 9pt;
    border: 1px solid ${REPORT_BORDER}; border-radius: 10px; overflow: hidden;
    margin-bottom: 16px;
  }
  table.rate-table th, table.rate-table td {
    border-bottom: 1px solid ${REPORT_BORDER};
    padding: 6px 10px; text-align: left;
  }
  table.rate-table thead th {
    background: #f4ede2; font-size: 8.5pt; font-weight: 600;
    color: ${REPORT_INK_MUTE}; text-transform: uppercase; letter-spacing: 0.04em;
  }
  table.rate-table td:first-child {
    color: ${REPORT_INK_MUTE}; font-family: Geist Mono, monospace; width: 50px;
  }
  table.rate-table td.val { font-family: Geist Mono, monospace; font-weight: 500; }
  table.rate-table tr:last-child td { border-bottom: none; }

  /* Per-scenario rate-block wrapper (compare report) */
  .rate-block { margin-bottom: 18px; break-inside: avoid; }
  .rate-block-head {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 6px; font-size: 10pt;
  }
  .rate-block-dot {
    width: 10px; height: 10px; border-radius: 50%;
    display: inline-block; flex-shrink: 0;
  }
  .rate-block-name { font-weight: 600; color: ${REPORT_INK}; }
  .rate-block-meta {
    font-family: Geist Mono, monospace; font-size: 9pt;
    color: ${REPORT_INK_MUTE};
  }

  /* Compare table */
  table.cmp-table {
    width: 100%; border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  table.cmp-table th, table.cmp-table td {
    padding: 8px 10px;
    border-bottom: 1px solid ${REPORT_BORDER};
    text-align: left;
  }
  table.cmp-table thead th {
    background: ${REPORT_BG_SOFT};
    font-weight: 600;
    font-size: 9pt;
    border-bottom: 1.5px solid ${REPORT_INK};
  }
  table.cmp-table tbody td {
    font-family: Geist Mono, monospace;
    font-weight: 500;
  }
  table.cmp-table tbody td:first-child {
    font-family: Geist, sans-serif;
    font-weight: 500;
    color: ${REPORT_INK};
  }
  table.cmp-table tbody td .dir {
    display: block;
    font-family: Geist, sans-serif;
    font-size: 8pt;
    color: ${REPORT_INK_MUTE};
    font-weight: 400;
    margin-top: 1px;
  }
  td.winner {
    background: #ecf3e9;
    color: ${REPORT_COLORS[2]};
    font-weight: 700;
    position: relative;
  }
  td.winner::after {
    content: "✓";
    margin-left: 6px;
    font-weight: 700;
  }
  .cmp-header-cell {
    display: flex; align-items: center; gap: 6px;
  }
  .cmp-header-dot {
    width: 10px; height: 10px; border-radius: 50%;
    display: inline-block;
  }

  /* Scenario legend strip */
  .scn-legend {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .scn-legend-card {
    border: 1px solid ${REPORT_BORDER};
    border-left: 4px solid var(--c);
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
  }
  .scn-legend-card .name {
    font-weight: 600; font-size: 11pt;
    margin-bottom: 4px;
  }
  .scn-legend-card .meta {
    font-size: 8.5pt; color: ${REPORT_INK_MUTE};
    font-family: Geist Mono, monospace;
    line-height: 1.55;
  }
  .scn-legend-card .meta span { display: inline-block; margin-right: 12px; }

  /* Footer */
  .footer {
    margin-top: 22px;
    padding-top: 12px;
    border-top: 1px solid ${REPORT_BORDER};
    font-size: 8pt;
    color: ${REPORT_INK_MUTE};
    line-height: 1.5;
  }
  .page-number {
    position: fixed;
    bottom: 6mm;
    right: 10mm;
    font-size: 8pt;
    color: ${REPORT_INK_MUTE};
    font-family: Geist Mono, monospace;
  }

  /* No-print toolbar shown only on screen */
  .toolbar {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    background: ${REPORT_INK}; color: #fff;
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 13px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: Geist, sans-serif;
  }
  .toolbar button {
    background: #fff; color: ${REPORT_INK};
    border: none; border-radius: 999px;
    padding: 6px 14px; cursor: pointer;
    font-weight: 600; font-size: 13px;
    font-family: inherit;
  }
  .toolbar button.ghost {
    background: transparent; color: #fff;
    border: 1px solid rgba(255,255,255,0.35);
  }
  @media print {
    .toolbar { display: none !important; }
  }
`;

// ===== Inputs helpers — surface every form value explicitly so the printed
// report can stand alone =====

// The app's t() returns the key itself when a translation is missing, so
// `t(k) || fallback` is a trap (the key string is truthy). Use this guard
// whenever falling back to inline TR/EN strings.
function tt(t, key, fb) {
  const v = t(key);
  return (v && v !== key) ? v : fb;
}

function inputRows(form, result, t, lang) {
  const perMonth = tt(t, "rpt_per_month", lang === "tr" ? "/ay" : "/mo");
  const perYear = tt(t, "rpt_per_year", lang === "tr" ? "/yıl" : "/yr");
  const yearlyBadge = lang === "tr" ? " (yıl yıl)" : " (yearly)";
  const fxStart = (form.start_dollar_tl ?? 0).toFixed(2) + " ₺";
  const loanAmount = result && result.loan_amount_tl != null
    ? result.loan_amount_tl
    : (form.value_of_house_tl - form.initial_noncredit_amount_tl);
  const groups = [];

  const loan = [
    [t("f_years"), `${form.years} ${t("f_years_unit")}`],
    [t("f_loan_term_years"), `${form.loan_term_years ?? form.years} ${t("f_years_unit")}`],
    [t("f_interest"), `${(form.interest_rate ?? 0).toFixed(2)} %`],
    [t("f_value"), fmtTLFull_R(form.value_of_house_tl)],
    [t("f_down"), fmtTLFull_R(form.initial_noncredit_amount_tl)],
    [t("f_loan_amount"), fmtTLFull_R(loanAmount)],
  ];
  groups.push({ title: tt(t, "rpt_group_loan", lang === "tr" ? "Kredi" : "Loan"), rows: loan });

  const macro = [
    [t("f_start_dollar"), fxStart],
    [t("f_dollar_growth") + (form.dollar_growth_mode === "yearly" ? yearlyBadge : ""),
      `${(form.dollar_growth_rate ?? 0).toFixed(2)} %`],
    [t("f_tr_inflation") + (form.turkey_inflation_mode === "yearly" ? yearlyBadge : ""),
      `${(form.turkey_inflation ?? 0).toFixed(2)} %`],
    [t("f_us_inflation"), `${(form.usa_inflation ?? 0).toFixed(2)} %`],
  ];
  groups.push({ title: tt(t, "rpt_group_macro", lang === "tr" ? "Makro" : "Macro"), rows: macro });

  const life = [
    [t("f_rent"), `${fmtTLFull_R(form.initial_monthly_rent_tl)}${perMonth}`],
  ];
  if (form.start_salary_base > 0) {
    // Salary inherits whatever currency the user picked — don't append "₺"
    // when the figure is actually USD or EUR.
    const cur = form.salary_currency || "TL";
    const num = Math.round(form.start_salary_base).toLocaleString("tr-TR");
    const salaryStr = cur === "TL" ? `${num} ₺`
      : cur === "USD" ? `${num} $`
      : cur === "EUR" ? `${num} €`
      : `${num} ${cur}`;
    life.push([t("f_salary_amount"), salaryStr]);
    life.push([t("f_salary_growth"), `${(form.salary_growth ?? 0).toFixed(2)} %`]);
  }
  groups.push({ title: tt(t, "rpt_group_life", lang === "tr" ? "Kira & Maaş" : "Rent & Salary"), rows: life });

  const costs = [];
  if (form.annual_property_tax_rate > 0) costs.push([t("f_annual_property_tax_rate"), `${form.annual_property_tax_rate} %`]);
  if (form.monthly_hoa_tl > 0) costs.push([t("f_monthly_hoa_tl"), `${fmtTLFull_R(form.monthly_hoa_tl)}${perMonth}`]);
  if (form.annual_dask_tl > 0) costs.push([t("f_annual_dask_tl"), `${fmtTLFull_R(form.annual_dask_tl)}${perYear}`]);
  if (form.annual_maintenance_rate > 0) costs.push([t("f_annual_maintenance_rate"), `${form.annual_maintenance_rate} %`]);
  if (form.transaction_cost_buy_pct > 0) costs.push([t("f_transaction_cost_buy_pct"), `${form.transaction_cost_buy_pct} %`]);
  if (form.transaction_cost_sell_pct > 0) costs.push([t("f_transaction_cost_sell_pct"), `${form.transaction_cost_sell_pct} %`]);
  if (costs.length) groups.push({ title: tt(t, "rpt_group_costs", lang === "tr" ? "Giderler" : "Costs"), rows: costs });

  return groups;
}

function renderInputGroupsHtml(form, result, t, lang) {
  const groups = inputRows(form, result, t, lang);
  return groups.map((g) => `
    <div class="input-group">
      <div class="input-group-title">${escapeHtml(g.title)}</div>
      ${g.rows.map(([k, v]) => `
        <div class="row"><span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></div>
      `).join("")}
    </div>
  `).join("");
}

// Per-year FX growth + TR inflation, exactly as fed to the engine. In flat
// mode every year repeats the scalar; in yearly mode we pull from the per-year
// array. The year-end FX comes from the engine output (so deflate-by-US and
// rebalancing are reflected automatically).
function perYearRateTableRows(form, result) {
  const years = form.years;
  const rows = [];
  for (let y = 0; y < years; y++) {
    const usd = form.dollar_growth_mode === "yearly" &&
      Array.isArray(form.dollar_growth_per_year) &&
      form.dollar_growth_per_year.length === years
        ? form.dollar_growth_per_year[y]
        : (form.dollar_growth_rate ?? 0);
    const tr = form.turkey_inflation_mode === "yearly" &&
      Array.isArray(form.turkey_inflation_per_year) &&
      form.turkey_inflation_per_year.length === years
        ? form.turkey_inflation_per_year[y]
        : (form.turkey_inflation ?? 0);
    const fx = result && result.dollar_rates_annual
      ? result.dollar_rates_annual[y + 1]
      : null;
    rows.push({ year: y + 1, usd, tr, fx });
  }
  return rows;
}

function renderYearlyRateTableHtml(form, result, t, lang) {
  const rows = perYearRateTableRows(form, result);
  const usdMode = form.dollar_growth_mode === "yearly" ? "yearly" : "flat";
  const trMode = form.turkey_inflation_mode === "yearly" ? "yearly" : "flat";
  const yearlyTag = tt(t, "re_mode_yearly", lang === "tr" ? "Yıl yıl" : "Yearly").toLowerCase();
  const usdHeader = t("f_dollar_growth") + (usdMode === "yearly" ? ` (${yearlyTag})` : "");
  const trHeader = t("f_tr_inflation") + (trMode === "yearly" ? ` (${yearlyTag})` : "");
  const yearHeader = tt(t, "re_year_label", lang === "tr" ? "Yıl" : "Year");
  const fxHeader = "USD/TL";
  return `
    <table class="rate-table">
      <thead>
        <tr>
          <th>${escapeHtml(yearHeader)}</th>
          <th>${escapeHtml(usdHeader)}</th>
          <th>${escapeHtml(trHeader)}</th>
          <th>${escapeHtml(fxHeader)}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.year}</td>
            <td class="val">${(r.usd).toFixed(2)} %</td>
            <td class="val">${(r.tr).toFixed(2)} %</td>
            <td class="val">${r.fx != null ? r.fx.toFixed(2) + " ₺" : "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ===== Page-wrapping helpers =====
function renderHeader(t, lang, kind, scenarioName) {
  return `
    <div class="header">
      <div class="brand">
        <div class="brand-mark">₺</div>
        <div class="brand-text">
          <strong>${escapeHtml(t("brand_name"))}</strong>
          <small>${escapeHtml(t("brand_sub"))}</small>
        </div>
      </div>
      <div class="header-meta">
        <strong>${escapeHtml(
          kind === "compare"
            ? t("rpt_kind_compare")
            : scenarioName
              ? t("rpt_kind_single_named").replace("{n}", scenarioName)
              : t("rpt_kind_single")
        )}</strong>
        <div>${escapeHtml(todayStr(lang))}</div>
      </div>
    </div>
  `;
}

function renderToolbar(t) {
  return `
    <div class="toolbar">
      <span>${escapeHtml(t("rpt_toolbar_hint"))}</span>
      <button onclick="window.print()">${escapeHtml(t("rpt_print"))}</button>
      <button class="ghost" onclick="window.close()">${escapeHtml(t("rpt_close"))}</button>
    </div>
  `;
}

// ===== Single-scenario report HTML =====
// chart-key sets — drive both the picker UI and the report builder.
const SINGLE_CHART_KEYS = ["net_payment", "decision", "rent_vs", "payment", "macro"];
const COMPARE_CHART_KEYS = ["decision", "total_paid", "rent_vs", "fx"];

async function buildSingleReportHTML({ result, form, lang, t, scenarioName, allAssetData, chartKeys }) {
  // If the caller didn't pass a selection, render every chart (back-compat).
  const selected = Array.isArray(chartKeys) && chartKeys.length
    ? new Set(chartKeys)
    : new Set(SINGLE_CHART_KEYS);

  // Build images in parallel — but skip the ones the user excluded so we
  // don't waste off-screen canvas time on a chart that won't be embedded.
  const buildIf = (key, fn) => selected.has(key) ? fn(result, t) : Promise.resolve(null);
  const [decisionImg, rentVsImg, netPaymentImg, paymentImg, macroImg] = await Promise.all([
    buildIf("decision", buildDecisionChart),
    buildIf("rent_vs", buildRentVsChart),
    buildIf("net_payment", buildNetPaymentChart),
    buildIf("payment", buildPaymentChart),
    buildIf("macro", buildMacroChart),
  ]);

  // insights
  const breakeven = findBreakeven_R(result);
  const houseUsd = result.value_of_house_usd_yearly;
  const startHouse = houseUsd[0];
  const endHouse = houseUsd[houseUsd.length - 1];
  const appreciation = ((endHouse / startHouse) - 1) * 100;
  const downUsd = result.initial_noncredit_amount_usd;
  const bestAlt = bestAlternative_R(result, downUsd);
  const realCostUsd = result.total_credit_amount_usd_annual.at(-1);

  const verdict = computeVerdict(result, t);
  const verdictMark = verdict.kind === "positive" ? "✓" : verdict.kind === "negative" ? "↗" : "≈";

  // assumptions
  const fxStart = result.dollar_rates_annual[0];
  const fxEnd = result.dollar_rates_annual.at(-1);
  const usdGrowth = (result.effective_dollar_growth_annual * 100).toFixed(2);
  const trInf = (result.effective_turkey_inflation_annual * 100).toFixed(2);

  const assets = Object.keys(result.asset_projections || {});
  const assetLine = assets.length
    ? assets.map((s) => {
        const p = result.asset_projections[s];
        return `${s} (+${p.average_growth.toFixed(1)}%/yr)`;
      }).join(", ")
    : "—";

  // page 1: header + verdict + insights + assumptions
  const page1 = `
    <div class="page">
      ${renderHeader(t, lang, "single", scenarioName)}
      <h1 class="report-title">${escapeHtml(t("rpt_single_title"))}</h1>
      <p class="report-sub">${escapeHtml(t("rpt_single_sub"))}</p>

      <div class="verdict ${verdict.kind}">
        <div class="verdict-mark">${verdictMark}</div>
        <div>
          <h3>${escapeHtml(verdict.title)}</h3>
          <p>${escapeHtml(verdict.body)}</p>
        </div>
      </div>

      <h2 class="section-title">${escapeHtml(t("rpt_kpis"))}<small>${escapeHtml(t("rpt_kpis_sub"))}</small></h2>
      <div class="insights">
        <div class="insight accent">
          <div class="insight-label">${escapeHtml(t("i_monthly_payment"))}</div>
          <div class="insight-value">${fmtTL_R(result.monthly_tl_payment)}</div>
          <div class="insight-note">≈ ${fmtUSD_R(result.monthly_payment_usd[0])} ${lang === "tr" ? "bugün" : "today"}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("i_total_paid"))}</div>
          <div class="insight-value">${fmtTL_R(result.total_paid_tl)}</div>
          <div class="insight-note">${form.years} ${escapeHtml(t("f_years_unit"))} · ${form.years * 12} ${escapeHtml(t("month"))}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("i_real_cost"))}</div>
          <div class="insight-value">${fmtUSD_R(realCostUsd)}</div>
          <div class="insight-note">${fmtUSD_R(downUsd)} ${lang === "tr" ? "peşinat" : "down"} + ${fmtUSD_R(realCostUsd - downUsd)} ${lang === "tr" ? "kredi" : "loan"}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("i_breakeven"))}</div>
          <div class="insight-value">${breakeven === -1 ? "—" : breakeven === 0 ? "Y1" : "Y" + breakeven}</div>
          <div class="insight-note">${escapeHtml(
            breakeven === -1
              ? t("i_breakeven_no")
              : breakeven === 0
                ? t("i_breakeven_immediate")
                : t("i_breakeven_yes").replace("{n}", breakeven)
          )}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("i_house_appreciation"))}</div>
          <div class="insight-value">+${appreciation.toFixed(0)}<small>%</small></div>
          <div class="insight-note">${fmtUSD_R(startHouse)} → ${fmtUSD_R(endHouse)}</div>
        </div>
        <div class="insight">
          <div class="insight-label">${escapeHtml(t("i_best_alt"))}</div>
          <div class="insight-value">${bestAlt ? escapeHtml(bestAlt.sym) : "—"}${bestAlt ? `<small>  +${bestAlt.gainPct.toFixed(0)}%</small>` : ""}</div>
          <div class="insight-note">${bestAlt ? `${fmtUSD_R(bestAlt.start)} → ${fmtUSD_R(bestAlt.end)}` : escapeHtml(t("i_best_alt_none"))}</div>
        </div>
      </div>

      <h2 class="section-title">${escapeHtml(t("rpt_assumptions"))}<small>${escapeHtml(t("rpt_assumptions_sub"))}</small></h2>
      <div class="assumptions assumptions-grouped">
        ${renderInputGroupsHtml(form, result, t, lang)}
        <div class="input-group">
          <div class="input-group-title">USD/TL · ${escapeHtml(t("rpt_compared_assets"))}</div>
          <div class="row"><span>USD/TL ${lang === "tr" ? "(Y" + form.years + ")" : "(Y" + form.years + ")"}</span><span>${fxEnd.toFixed(2)} ₺</span></div>
          <div class="row"><span>${escapeHtml(t("rpt_compared_assets"))}</span><span>${escapeHtml(assetLine)}</span></div>
        </div>
      </div>
      <div class="page-number">1</div>
    </div>
  `;

  // page 2: decision + rent_vs charts
  // Each chart-card is rendered only if the user picked it. Pages whose
  // entire chart set is excluded get skipped (handled below when stitching
  // pages together).
  const cardDecision = selected.has("decision") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_decision"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_decision_sub"))}</p>
        ${decisionImg ? `<img src="${decisionImg}" alt="decision chart" />` : ""}
        <p class="chart-method">${escapeHtml(t("view_decision_method"))}</p>
      </div>` : "";

  const cardRentVs = selected.has("rent_vs") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_rent_vs"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_rent_vs_sub"))}</p>
        ${rentVsImg ? `<img src="${rentVsImg}" alt="rent vs chart" />` : ""}
        <p class="chart-method">${escapeHtml(t("view_rent_vs_method"))}</p>
      </div>` : "";

  const cardNetPayment = selected.has("net_payment") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("i_net_payment"))}</h3>
        <p class="chart-sub">${escapeHtml(tt(t, "sf_net_payment", lang === "tr"
          ? "Toplam ödediğiniz (peşinat + taksit + giderler) eksi kiracı kalsaydınız ödeyeceğiniz kira."
          : "Total you paid minus the rent you would have paid as a renter."))}</p>
        ${netPaymentImg ? `<img src="${netPaymentImg}" alt="net payment chart" />` : ""}
      </div>` : "";

  const cardPayment = selected.has("payment") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_payment"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_payment_sub"))}</p>
        ${paymentImg ? `<img src="${paymentImg}" alt="payment chart" />` : ""}
        <p class="chart-method">${escapeHtml(t("view_payment_method"))}</p>
      </div>` : "";

  const cardMacro = selected.has("macro") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_macro"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_macro_sub"))}</p>
        ${macroImg ? `<img src="${macroImg}" alt="macro chart" />` : ""}
        <p class="chart-method">${escapeHtml(t("view_macro_method"))}</p>
      </div>` : "";

  const page2 = (cardDecision || cardRentVs) ? `
    <div class="page">
      ${renderHeader(t, lang, "single", scenarioName)}
      <h2 class="section-title">${escapeHtml(t("rpt_charts"))}<small>${escapeHtml(t("rpt_charts_sub"))}</small></h2>
      ${cardDecision}
      ${cardRentVs}
    </div>
  ` : "";

  // page 3: net-payment + monthly-payment charts (the "what does this cost me?" pair)
  const page3 = (cardNetPayment || cardPayment) ? `
    <div class="page">
      ${renderHeader(t, lang, "single", scenarioName)}
      ${cardNetPayment}
      ${cardPayment}
    </div>
  ` : "";

  // page 4: macro chart + footer (footer always shows if any chart appears
  // — otherwise the report ends after the assumptions/rates pages)
  const anyChart = cardDecision || cardRentVs || cardNetPayment || cardPayment || cardMacro;
  const page4 = (cardMacro || anyChart) ? `
    <div class="page">
      ${renderHeader(t, lang, "single", scenarioName)}
      ${cardMacro}
      <div class="footer">${escapeHtml(t("footer"))}</div>
    </div>
  ` : "";

  // page 1.5: per-year FX + inflation table
  const pageRates = `
    <div class="page">
      ${renderHeader(t, lang, "single", scenarioName)}
      <h2 class="section-title">${escapeHtml(tt(t, "rpt_per_year_rates", lang === "tr" ? "Yıl yıl kur ve enflasyon" : "Year-by-year FX & inflation"))}<small>${escapeHtml(tt(t, "rpt_per_year_rates_sub", lang === "tr" ? "Modelin her yıl uyguladığı USD artışı, TR enflasyonu ve USD/TL kuru." : "The USD growth, TR inflation, and USD/TL rate the model applies each year."))}</small></h2>
      ${renderYearlyRateTableHtml(form, result, t, lang)}
      <div class="page-number">2</div>
    </div>
  `;

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t("rpt_single_title"))} — ${escapeHtml(scenarioName || t("scn_draft"))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>${REPORT_CSS}</style>
</head>
<body>
  ${renderToolbar(t)}
  ${page1}
  ${pageRates}
  ${page2}
  ${page3}
  ${page4}
</body>
</html>`;
}

// ===== Compare report =====
const RPT_COMPARE_METRICS = [
  { key: "monthly_payment_tl", label: "i_monthly_payment", fmt: "tl", dir: "lower",
    get: (r) => r.monthly_tl_payment },
  { key: "total_paid_tl", label: "i_total_paid", fmt: "tl", dir: "lower",
    get: (r) => r.total_paid_tl },
  { key: "real_cost_usd", label: "i_real_cost", fmt: "usd", dir: "lower",
    get: (r) => r.total_credit_amount_usd_annual.at(-1) },
  { key: "house_final_usd", label: "cmp_house_final", fmt: "usd", dir: "higher",
    get: (r) => r.value_of_house_usd_yearly.at(-1) },
  { key: "house_plus_rent", label: "view_rent_vs", fmt: "usd", dir: "higher",
    get: (r) => r.house_plus_rent_yearly.at(-1) },
  { key: "house_appreciation", label: "i_house_appreciation", fmt: "pct", dir: "higher",
    get: (r) => (r.value_of_house_usd_yearly.at(-1) / r.value_of_house_usd_yearly[0] - 1) },
  { key: "breakeven", label: "i_breakeven", fmt: "year", dir: "lower",
    get: (r) => {
      const a = r.house_plus_rent_yearly, b = r.total_credit_amount_usd_annual;
      const n = Math.min(a.length, b.length);
      for (let i = 0; i < n; i++) if (a[i] > b[i]) return i;
      return -1;
    } },
  { key: "fx_final", label: "cmp_fx_final", fmt: "tl_short", dir: "neutral",
    get: (r) => r.dollar_rates_annual.at(-1) },
];

function fmtMetric_R(v, kind) {
  if (v == null || !isFinite(v)) return "—";
  if (kind === "tl") {
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M ₺";
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + "k ₺";
    return Math.round(v).toLocaleString("tr-TR") + " ₺";
  }
  if (kind === "tl_short") return v.toFixed(2) + " ₺";
  if (kind === "usd") {
    if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (Math.abs(v) >= 1_000) return "$" + (v / 1_000).toFixed(1) + "k";
    return "$" + Math.round(v);
  }
  if (kind === "pct") return (v >= 0 ? "+" : "") + (v * 100).toFixed(0) + "%";
  if (kind === "year") return v === -1 ? "—" : v === 0 ? "Y1" : "Y" + v;
  return String(v);
}

async function buildCompareReportHTML({ scenarios, allAssetData, t, lang, chartKeys }) {
  // computeScenarioResult in scenarios.jsx returns { result, originalYears };
  // the report only needs the bare projection result. We also extend all
  // scenarios to the longest horizon so they share an x-axis in the overlay
  // charts (mirrors what CompareView does on-screen).
  const maxYears = scenarios.reduce((m, s) => Math.max(m, s.form.years || 0), 0);
  // Same seed as CompareView (scenarios.jsx) so the printed report shows the
  // same random shapes the user sees on screen.
  const COMPARE_SEED = 42;
  const results = scenarios.map((s) => {
    const out = window.computeScenarioResult(s, allAssetData, maxYears, COMPARE_SEED);
    return out && typeof out === "object" && "result" in out ? out.result : out;
  });

  const selected = Array.isArray(chartKeys) && chartKeys.length
    ? new Set(chartKeys)
    : new Set(COMPARE_CHART_KEYS);
  const compareIf = (key, field, unit) =>
    selected.has(key) ? buildCompareChart(scenarios, results, field, unit, t) : Promise.resolve(null);
  const [decisionImg, totalPaidImg, rentVsImg, netPaymentImg, monthlyPaymentImg, fxImg] = await Promise.all([
    compareIf("decision", "value_of_house_usd_monthly", "USD"),
    compareIf("total_paid", "total_credit_amount_usd_monthly", "USD"),
    compareIf("rent_vs", "house_plus_rent_monthly", "USD"),
    compareIf("net_payment", "total_credit_minus_rent_usd_monthly", "USD"),
    compareIf("monthly_payment", "monthly_payment_usd", "USD/ay"),
    compareIf("fx", "dollar_rates_monthly", "TL"),
  ]);

  // determine winner per metric
  const winners = {};
  for (const m of RPT_COMPARE_METRICS) {
    if (m.dir === "neutral") continue;
    let bestIdx = -1, bestVal = null;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      let v;
      try { v = m.get(r); } catch (_) { v = null; }
      if (v == null || !isFinite(v)) continue;
      if (m.key === "breakeven" && v === -1) continue;
      if (bestVal == null) { bestVal = v; bestIdx = i; continue; }
      if (m.dir === "lower" && v < bestVal) { bestVal = v; bestIdx = i; }
      if (m.dir === "higher" && v > bestVal) { bestVal = v; bestIdx = i; }
    }
    winners[m.key] = bestIdx;
  }

  // legend cards
  const legendHtml = scenarios.map((s) => {
    const r = results[scenarios.indexOf(s)];
    const color = hueToRgb(s.hue);
    return `
      <div class="scn-legend-card" style="--c:${color}">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="meta">
          <span>${s.form.years}${escapeHtml(t("f_years_unit"))}</span>
          <span>${s.form.interest_rate}%</span>
          <span>${fmtTL_R(s.form.value_of_house_tl)}</span>
          <span>${(s.form.initial_noncredit_amount_tl / s.form.value_of_house_tl * 100).toFixed(0)}% ${lang === "tr" ? "peşinat" : "down"}</span>
          ${r ? `<span style="color:${REPORT_INK};font-weight:600">${fmtUSD_R(r.value_of_house_usd_yearly.at(-1))} ${lang === "tr" ? "ev değeri" : "home"}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  // Side-by-side INPUTS table — every form parameter across scenarios.
  // Union of group structures across scenarios so the table covers all inputs,
  // even if one scenario doesn't set a particular cost field.
  const perScenarioGroups = scenarios.map((s) => inputRows(s.form, results[scenarios.indexOf(s)], t, lang));
  const groupOrder = [];
  const groupRows = {}; // title -> Set of metric keys
  for (const groups of perScenarioGroups) {
    for (const g of groups) {
      if (!groupRows[g.title]) { groupOrder.push(g.title); groupRows[g.title] = new Set(); }
      for (const [k] of g.rows) groupRows[g.title].add(k);
    }
  }
  const inputsTableHtml = `
    <table class="inputs-table">
      <thead>
        <tr>
          <th style="width: 22%">${escapeHtml(t("rpt_assumptions"))}</th>
          ${scenarios.map((s) => `
            <th>
              <div class="cmp-header-cell">
                <span class="cmp-header-dot" style="background:${hueToRgb(s.hue)}"></span>
                ${escapeHtml(s.name)}
              </div>
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${groupOrder.map((gtitle) => {
          const metrics = Array.from(groupRows[gtitle]);
          const groupHeaderRow = `<tr><th class="group-row" colspan="${scenarios.length + 1}">${escapeHtml(gtitle)}</th></tr>`;
          const metricRows = metrics.map((mkey) => {
            const cells = scenarios.map((s, i) => {
              const grp = perScenarioGroups[i].find((g) => g.title === gtitle);
              const row = grp ? grp.rows.find(([k]) => k === mkey) : null;
              return `<td class="val">${escapeHtml(row ? row[1] : "—")}</td>`;
            }).join("");
            return `<tr><td class="metric">${escapeHtml(mkey)}</td>${cells}</tr>`;
          }).join("");
          return groupHeaderRow + metricRows;
        }).join("")}
      </tbody>
    </table>
  `;

  // metric table
  const tableHtml = `
    <table class="cmp-table">
      <thead>
        <tr>
          <th>${escapeHtml(t("scn_metric"))}</th>
          ${scenarios.map((s) => `
            <th>
              <div class="cmp-header-cell">
                <span class="cmp-header-dot" style="background:${hueToRgb(s.hue)}"></span>
                ${escapeHtml(s.name)}
              </div>
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${RPT_COMPARE_METRICS.map((m) => `
          <tr>
            <td>
              ${escapeHtml(t(m.label))}
              ${m.dir !== "neutral" ? `<span class="dir">${escapeHtml(m.dir === "lower" ? t("scn_lower_better") : t("scn_higher_better"))}</span>` : ""}
            </td>
            ${results.map((r, i) => {
              if (!r) return `<td>—</td>`;
              let v;
              try { v = m.get(r); } catch (_) { v = null; }
              const isWin = winners[m.key] === i;
              return `<td class="${isWin ? "winner" : ""}">${fmtMetric_R(v, m.fmt)}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="footer" style="margin-top:6px;border-top:none">
      ✓ = ${escapeHtml(t("scn_winner_note"))}
    </div>
  `;

  const page1 = `
    <div class="page">
      ${renderHeader(t, lang, "compare")}
      <h1 class="report-title">${escapeHtml(t("rpt_compare_title"))} <em>×${scenarios.length}</em></h1>
      <p class="report-sub">${escapeHtml(t("rpt_compare_sub").replace("{n}", String(scenarios.length)))}</p>

      <h2 class="section-title">${escapeHtml(t("rpt_compare_scenarios"))}<small>${escapeHtml(t("rpt_compare_scenarios_sub"))}</small></h2>
      <div class="scn-legend">
        ${legendHtml}
      </div>

      <h2 class="section-title">${escapeHtml(t("rpt_assumptions"))}<small>${escapeHtml(tt(t, "rpt_inputs_table", lang === "tr" ? "Tüm girdilerin senaryolar arası karşılaştırması." : "Side-by-side comparison of every input."))}</small></h2>
      ${inputsTableHtml}

      <h2 class="section-title">${escapeHtml(t("rpt_compare_metrics"))}<small>${escapeHtml(t("scn_metrics_sub"))}</small></h2>
      ${tableHtml}
      <div class="page-number">1</div>
    </div>
  `;

  // Per-scenario rate tables — one compact block per scenario so the reader
  // can see exactly which FX / inflation each scenario used each year.
  const perYearTablesHtml = scenarios.map((s, i) => {
    const r = results[i];
    const color = hueToRgb(s.hue);
    return `
      <div class="rate-block">
        <div class="rate-block-head" style="--c:${color}">
          <span class="rate-block-dot" style="background:${color}"></span>
          <span class="rate-block-name">${escapeHtml(s.name)}</span>
          <span class="rate-block-meta">${s.form.years}${escapeHtml(t("f_years_unit"))}</span>
        </div>
        ${renderYearlyRateTableHtml(s.form, r, t, lang)}
      </div>
    `;
  }).join("");

  const pageRates = `
    <div class="page">
      ${renderHeader(t, lang, "compare")}
      <h2 class="section-title">${escapeHtml(tt(t, "rpt_per_year_rates", lang === "tr" ? "Yıl yıl kur ve enflasyon" : "Year-by-year FX & inflation"))}<small>${escapeHtml(tt(t, "rpt_per_year_rates_sub", lang === "tr" ? "Modelin her yıl uyguladığı USD artışı, TR enflasyonu ve USD/TL kuru." : "The USD growth, TR inflation, and USD/TL rate the model applies each year."))}</small></h2>
      ${perYearTablesHtml}
      <div class="page-number">2</div>
    </div>
  `;

  const cmpCardDecision = selected.has("decision") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("f_value"))} — ${escapeHtml(t("view_decision"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_decision_sub"))}</p>
        ${decisionImg ? `<img src="${decisionImg}" />` : ""}
      </div>` : "";

  const cmpCardTotalPaid = selected.has("total_paid") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("i_total_paid"))}</h3>
        <p class="chart-sub">${escapeHtml(t("cmp_total_paid_sub"))}</p>
        ${totalPaidImg ? `<img src="${totalPaidImg}" />` : ""}
      </div>` : "";

  const cmpCardRentVs = selected.has("rent_vs") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_rent_vs"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_rent_vs_sub"))}</p>
        ${rentVsImg ? `<img src="${rentVsImg}" />` : ""}
      </div>` : "";

  const cmpCardNetPayment = selected.has("net_payment") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("i_net_payment"))}</h3>
        <p class="chart-sub">${escapeHtml(tt(t, "cmp_net_payment_sub", lang === "tr"
          ? "Toplam ödediğinizden, kiracı kalsaydınız ödeyeceğiniz kirayı çıkar — net cep maliyeti."
          : "Subtract the rent you would have paid from your total outlay — net out-of-pocket cost."))}</p>
        ${netPaymentImg ? `<img src="${netPaymentImg}" />` : ""}
      </div>` : "";

  const cmpCardMonthlyPayment = selected.has("monthly_payment") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_payment"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_payment_sub"))}</p>
        ${monthlyPaymentImg ? `<img src="${monthlyPaymentImg}" />` : ""}
      </div>` : "";

  const cmpCardFx = selected.has("fx") ? `
      <div class="chart-card">
        <h3>${escapeHtml(t("view_macro"))}</h3>
        <p class="chart-sub">${escapeHtml(t("view_macro_sub"))}</p>
        ${fxImg ? `<img src="${fxImg}" />` : ""}
      </div>` : "";

  // Build the chart pages dynamically: take whatever cards the user
  // selected (in canonical order), drop the empty ones, and pair them
  // two-per-page. This keeps the report tight when the user picks 2 or 3
  // charts and expands gracefully when they want all 6.
  const cardSlots = [
    cmpCardDecision, cmpCardRentVs,
    cmpCardTotalPaid, cmpCardNetPayment,
    cmpCardMonthlyPayment, cmpCardFx,
  ].filter(Boolean);
  const chartPagesHtml = [];
  for (let i = 0; i < cardSlots.length; i += 2) {
    const pair = cardSlots.slice(i, i + 2).join("");
    const isFirst = i === 0;
    const isLast = i + 2 >= cardSlots.length;
    chartPagesHtml.push(`
      <div class="page">
        ${renderHeader(t, lang, "compare")}
        ${isFirst ? `<h2 class="section-title">${escapeHtml(t("rpt_compare_overlays"))}<small>${escapeHtml(t("rpt_compare_overlays_sub"))}</small></h2>` : ""}
        ${pair}
        ${isLast ? `<div class="footer">${escapeHtml(t("footer"))}</div>` : ""}
      </div>
    `);
  }
  const page2 = chartPagesHtml[0] || "";
  const page3 = chartPagesHtml.slice(1).join("");

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t("rpt_compare_title"))} — ${scenarios.length} ${escapeHtml(lang === "tr" ? "senaryo" : "scenarios")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>${REPORT_CSS}</style>
</head>
<body>
  ${renderToolbar(t)}
  ${page1}
  ${pageRates}
  ${page2}
  ${page3}
</body>
</html>`;
}

// ===== Public API: open new window with the report =====
// Pop-up blockers reject window.open() once the user-gesture chain has been
// broken by an await. So we open the window synchronously up front with a
// loading placeholder, then async-build the HTML and write into the same
// window. Also drop the "noopener" feature — Chromium returns null for the
// reference under noopener, which would defeat the whole flow.
function openPlaceholderWindow(loadingLabel) {
  const w = window.open("about:blank", "_blank");
  if (!w) return null;
  try {
    w.document.open();
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${loadingLabel}</title>` +
      `<style>body{font-family:Geist,system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#76695b;background:#fbf8f3;}` +
      `.spinner{width:38px;height:38px;border:3px solid #e8ddd0;border-top-color:#b26640;border-radius:50%;animation:s 0.9s linear infinite;margin-bottom:14px;}` +
      `@keyframes s{to{transform:rotate(360deg)}}` +
      `.label{font-size:14px;letter-spacing:0.02em;}</style></head>` +
      `<body><div><div class="spinner"></div><div class="label">${loadingLabel}</div></div></body></html>`,
    );
    w.document.close();
  } catch (_) {}
  return w;
}

function writeReportAndPrint(w, html) {
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try { w.focus(); w.print(); } catch (_) {}
    }, 900);
  } catch (e) {
    console.error("Failed to write report into popup", e);
  }
}

async function generateSingleReport(args) {
  const loading = args.t ? args.t("rpt_busy") : "Rapor hazırlanıyor…";
  const w = openPlaceholderWindow(loading);
  if (!w) {
    alert("Pop-up engellendi — bu site için pop-up'lara izin verin / Pop-up blocked.");
    return;
  }
  try {
    const html = await buildSingleReportHTML(args);
    writeReportAndPrint(w, html);
  } catch (e) {
    console.error("Report generation failed", e);
    try { w.document.body.innerText = "Rapor oluşturulamadı: " + (e.message || e); } catch (_) {}
  }
}

async function generateCompareReport(args) {
  const loading = args.t ? args.t("rpt_busy") : "Rapor hazırlanıyor…";
  const w = openPlaceholderWindow(loading);
  if (!w) {
    alert("Pop-up engellendi — bu site için pop-up'lara izin verin / Pop-up blocked.");
    return;
  }
  try {
    const html = await buildCompareReportHTML(args);
    writeReportAndPrint(w, html);
  } catch (e) {
    console.error("Compare report failed", e);
    try { w.document.body.innerText = "Rapor oluşturulamadı: " + (e.message || e); } catch (_) {}
  }
}

// ===== Button component =====
function ReportButton({ onClick, label, busy, variant }) {
  const cls = "btn " + (variant === "primary" ? "btn-primary" : "btn-ghost");
  return (
    <button className={cls} onClick={onClick} disabled={busy}>
      {busy ? (
        <>
          <span className="spinner"></span>
          {label}…
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ===== Launcher with chart picker =====
// Wraps ReportButton with a small popover whose checkboxes drive which
// charts the generator embeds. Selection persists in localStorage so the
// next report respects the last choice.
const { useState: useState_RP, useRef: useRef_RP, useEffect: useEffect_RP } = React;

const REPORT_CHART_DEFS = {
  single: [
    { key: "net_payment", labelKey: "i_net_payment" },
    { key: "decision", labelKey: "view_decision" },
    { key: "rent_vs", labelKey: "view_rent_vs" },
    { key: "payment", labelKey: "view_payment" },
    { key: "macro", labelKey: "view_macro" },
  ],
  compare: [
    { key: "decision", labelKey: "view_decision" },
    { key: "total_paid", labelKey: "i_total_paid" },
    { key: "rent_vs", labelKey: "view_rent_vs" },
    { key: "net_payment", labelKey: "i_net_payment" },
    { key: "monthly_payment", labelKey: "view_payment" },
    { key: "fx", labelKey: "view_macro" },
  ],
};

function ReportLauncher({ onGenerate, busy, variant, kind, t, lang }) {
  const defs = REPORT_CHART_DEFS[kind] || REPORT_CHART_DEFS.single;
  const storeKey = `rep:report_charts:${kind}`;
  const [selected, setSelected] = useState_RP(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (_) {}
    return defs.map((d) => d.key);
  });
  const [open, setOpen] = useState_RP(false);
  const wrapRef = useRef_RP(null);

  useEffect_RP(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const persist = (next) => {
    setSelected(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch (_) {}
  };
  const toggle = (key) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    persist(next);
  };
  const selectAll = () => persist(defs.map((d) => d.key));
  const selectNone = () => persist([]);
  const handleGo = () => {
    setOpen(false);
    onGenerate(selected.length ? selected : defs.map((d) => d.key));
  };
  const label = busy ? tt(t, "rpt_busy", "Hazırlanıyor") : tt(t, "rpt_button", "Rapor");
  const optsLabel = tt(t, "rpt_pick_charts", lang === "tr" ? "Grafik seç" : "Pick charts");
  const allLabel = tt(t, "rpt_pick_all", lang === "tr" ? "Hepsi" : "All");
  const noneLabel = tt(t, "rpt_pick_none", lang === "tr" ? "Hiçbiri" : "None");
  const goLabel = tt(t, "rpt_generate", lang === "tr" ? "Oluştur" : "Generate");

  return (
    <div className="report-launcher" ref={wrapRef} style={{ position: "relative", display: "inline-flex", gap: 0 }}>
      <ReportButton onClick={handleGo} label={label} busy={busy} variant={variant} />
      <button
        type="button"
        className={"btn " + (variant === "primary" ? "btn-primary" : "btn-ghost")}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title={optsLabel}
        style={{ padding: "0 8px", marginLeft: 1 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open ? (
        <div className="report-popover" role="dialog" aria-label={optsLabel}>
          <div className="report-popover-head">{optsLabel}</div>
          <div className="report-popover-list">
            {defs.map((d) => (
              <label key={d.key} className="report-popover-row">
                <input
                  type="checkbox"
                  checked={selected.includes(d.key)}
                  onChange={() => toggle(d.key)}
                />
                <span>{t(d.labelKey)}</span>
              </label>
            ))}
          </div>
          <div className="report-popover-foot">
            <button type="button" className="link" onClick={selectAll}>{allLabel}</button>
            <span className="sep">·</span>
            <button type="button" className="link" onClick={selectNone}>{noneLabel}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleGo} disabled={busy || !selected.length}>
              {goLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

window.generateSingleReport = generateSingleReport;
window.generateCompareReport = generateCompareReport;
window.ReportButton = ReportButton;
window.ReportLauncher = ReportLauncher;
