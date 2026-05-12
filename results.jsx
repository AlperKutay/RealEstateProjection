// =============================================================
// Results screen — insight cards, verdict, chart with curated views,
// details table.
// =============================================================

const { useEffect, useRef, useMemo, useState: useState_R } = React;
const HelpIcon = window.HelpIcon;

const CHART_COLORS = [
  "oklch(0.58 0.13 50)",
  "oklch(0.58 0.13 230)",
  "oklch(0.58 0.13 155)",
  "oklch(0.58 0.13 290)",
  "oklch(0.62 0.13 80)",
  "oklch(0.55 0.13 350)",
  "oklch(0.50 0.08 70)",
  "oklch(0.70 0.10 200)",
];

// Each view describes: which series to plot, axis style, optional secondary axis.
function buildChartViews(t) {
  return {
    decision: {
      label: t("view_decision"),
      subtitle: t("view_decision_sub"),
      title: t("view_decision"),
      series: [
        { key: "total_credit", color: 0, dash: false, label: t("view_decision") + " — " + (t === window.tFor ? "" : "") }, // placeholder; we set labels below
      ],
    },
  };
}

// We hand-tune the views here for control. labels filled in build.
const VIEW_DEFS = {
  decision: {
    titleKey: "view_decision", subKey: "view_decision_sub", methodKey: "view_decision_method",
    series: [
      { key: "total_credit_amount_usd", labelKey: "i_total_paid", formulaKey: "sf_total_paid", color: 4, dash: true },
      { key: "value_of_house_usd", labelKey: "f_value", formulaKey: "sf_house_value", color: 0 },
      { key: "house_plus_rent", labelKey: "view_rent_vs", formulaKey: "sf_house_plus_rent", color: 2 },
    ],
    includeAssets: true,
    unit: "USD",
  },
  payment: {
    titleKey: "view_payment", subKey: "view_payment_sub", methodKey: "view_payment_method",
    series: [
      { key: "monthly_payment_usd", labelKey: "i_monthly_payment", formulaKey: "sf_monthly_pay", color: 0, offset: 1 },
      { key: "rent_price_usd", labelKey: "f_rent", formulaKey: "sf_rent_monthly", color: 6, dash: true },
    ],
    unit: "USD/ay",
  },
  rent_vs: {
    titleKey: "view_rent_vs", subKey: "view_rent_vs_sub", methodKey: "view_rent_vs_method",
    series: [
      { key: "house_plus_rent", labelKey: "view_rent_vs", formulaKey: "sf_house_plus_rent", color: 2 },
      { key: "total_credit_amount_usd", labelKey: "i_total_paid", formulaKey: "sf_total_paid", color: 0, dash: true },
      { key: "total_credit_minus_rent", labelKey: "i_net_payment", formulaKey: "sf_net_payment", color: 3 },
      { key: "cumulative_rent", labelKey: "f_rent", formulaKey: "sf_cum_rent", color: 5 },
    ],
    includeAssets: true,
    unit: "USD",
  },
  salary: {
    titleKey: "view_salary", subKey: "view_salary_sub", methodKey: "view_salary_method",
    series: [
      { key: "payment_salary_ratio", labelKey: "view_salary", formulaKey: "sf_salary_ratio", color: 0, offset: 1, isRatio: true },
    ],
    unit: "%",
    needsSalary: true,
  },
  macro: {
    titleKey: "view_macro", subKey: "view_macro_sub", methodKey: "view_macro_method",
    series: [
      { key: "dollar_rates", labelKey: "f_start_dollar", formulaKey: "sf_fx", color: 1 },
    ],
    unit: "TL",
  },
};

// Maps short series keys to projection.js result fields (yearly/monthly).
const SERIES_FIELDS = {
  total_credit_amount_usd: ["total_credit_amount_usd_annual", "total_credit_amount_usd_monthly"],
  value_of_house_usd: ["value_of_house_usd_yearly", "value_of_house_usd_monthly"],
  house_plus_rent: ["house_plus_rent_yearly", "house_plus_rent_monthly"],
  monthly_payment_usd: ["annual_payment_usd", "monthly_payment_usd"],
  rent_price_usd: ["rent_price_usd_yearly", "rent_price_usd_monthly"],
  cumulative_rent: ["cumulative_rent_price_usd_yearly", "cumulative_rent_price_usd_monthly"],
  total_credit_minus_rent: ["total_credit_minus_rent_usd_yearly", "total_credit_minus_rent_usd_monthly"],
  payment_salary_ratio: ["payment_salary_ratio_yearly", "payment_salary_ratio_monthly"],
  dollar_rates: ["dollar_rates_annual", "dollar_rates_monthly"],
};

// ---------------------------------------------------------------
function fmtUSD(n) {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(0);
}
function fmtTLShort(n) {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M ₺";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "k ₺";
  return n.toFixed(0) + " ₺";
}
function fmtTLFull(n) {
  if (n == null || !isFinite(n)) return "—";
  return Math.round(n).toLocaleString("tr-TR") + " ₺";
}
function fmtPct(n) {
  if (n == null || !isFinite(n)) return "—";
  return (n * 100).toFixed(1) + "%";
}

// Convert engine breakeven_month (or null) to display year (1-indexed) or -1 for "never".
// breakeven_month is the first month where net_buy_position >= 0 — i.e. the
// month where selling at today's price would cover everything you spent more
// than rent, including remaining loan, carrying costs and transaction costs.
function breakevenYear(result) {
  const m = result.breakeven_month;
  if (m == null) return -1;
  if (m <= 0) return 0;
  return Math.ceil(m / 12);
}

// Best asset gain at end vs initial price
function bestAlternative(result, downPaymentUsd) {
  const proj = result.asset_projections || {};
  let best = null;
  for (const [sym, data] of Object.entries(proj)) {
    const arr = data.yearly;
    if (!arr || arr.length < 2) continue;
    const start = arr[0];
    const end = arr[arr.length - 1];
    const gainPct = (end / start - 1) * 100;
    const finalValue = downPaymentUsd ? downPaymentUsd * (end / start) : end;
    if (!best || gainPct > best.gainPct) {
      best = { sym, gainPct, end, start, finalValue };
    }
  }
  return best;
}

// ---------------- Components ----------------

function InsightCards({ result, form, t, lang }) {
  const breakeven = breakevenYear(result);
  const houseUsd = result.value_of_house_usd_yearly;
  const startHouse = houseUsd[0];
  const endHouse = houseUsd[houseUsd.length - 1];
  const appreciation = ((endHouse / startHouse) - 1) * 100;
  const downUsd = result.initial_noncredit_amount_usd;
  const bestAlt = bestAlternative(result, downUsd);
  const realCostUsd = result.total_credit_amount_usd_annual.at(-1);
  const netPaymentUsd = result.total_credit_minus_rent_usd_yearly
    ? result.total_credit_minus_rent_usd_yearly.at(-1)
    : null;

  return (
    <div className="insights">
      <div className="insight accent">
        <div className="insight-label">
          {t("i_monthly_payment")}
          <HelpIcon text={lang === "tr"
            ? "Sabit TL taksit. Banka kredisinin aylık geri ödemesi."
            : "Fixed TL installment. Monthly mortgage repayment."} />
        </div>
        <div className="insight-value">{fmtTLShort(result.monthly_tl_payment)}</div>
        <div className="insight-note">
          ≈ {fmtUSD(result.monthly_payment_usd[0])} {lang === "tr" ? "bugün" : "today"}
        </div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_total_paid")}
          <HelpIcon text={lang === "tr"
            ? "Aylık taksit × ay sayısı. Vade sonunda bankaya ödediğin toplam TL."
            : "Monthly installment × number of months. Total TL paid by end of term."} />
        </div>
        <div className="insight-value">{fmtTLShort(result.total_paid_tl)}</div>
        <div className="insight-note">
          {t("year")} {form.years} · {form.years * 12} {t("month")}
        </div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_real_cost")}
          <HelpIcon text={lang === "tr"
            ? "Peşinatın USD karşılığı + tüm taksitlerin o günkü kurla USD karşılığı, toplamı."
            : "Down payment in USD + each installment in same-month USD, summed."} />
        </div>
        <div className="insight-value">{fmtUSD(realCostUsd)}</div>
        <div className="insight-note">
          {fmtUSD(downUsd)} {lang === "tr" ? "peşinat" : "down"} + {fmtUSD(realCostUsd - downUsd)} {lang === "tr" ? "kredi" : "loan"}
        </div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_net_payment")}
          <HelpIcon text={lang === "tr"
            ? "Reel maliyetten, kiracı kalsaydınız ödeyeceğiniz biriken kira tutarı düşülür. Ev sahibi olmanın kira karşısındaki net cep maliyeti (USD)."
            : "Real cost minus the cumulative rent you'd pay as a renter. Net out-of-pocket USD cost of owning vs renting."} />
        </div>
        <div className="insight-value">{fmtUSD(netPaymentUsd)}</div>
        <div className="insight-note">{t("i_net_payment_note")}</div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_breakeven")}
          <HelpIcon text={lang === "tr"
            ? "Evi bugünkü fiyatla satıp kalan krediyi kapatıp, ödediğiniz net tutarı çıkardıktan sonra elinizde artı kaldığı ilk yıl. Kira tasarrufu, kalan kredi ve giderler hesaba katılır."
            : "First year where selling the home at today's price, paying off the remaining loan, and netting against what you spent vs renting leaves you positive. Accounts for rent saved, remaining loan, and carry costs."} />
        </div>
        <div className="insight-value">
          {breakeven === -1 ? "—" : breakeven === 0 ? "Y1" : `Y${breakeven}`}
        </div>
        <div className="insight-note">
          {breakeven === -1
            ? t("i_breakeven_no")
            : breakeven === 0
              ? t("i_breakeven_immediate")
              : t("i_breakeven_yes").replace("{n}", breakeven)}
        </div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_house_appreciation")}
          <HelpIcon text={lang === "tr"
            ? "Vade sonunda evin USD değerinin, bugünkü USD değerine oranı."
            : "Final USD home value divided by today's USD home value."} />
        </div>
        <div className="insight-value">+{appreciation.toFixed(0)}<small>%</small></div>
        <div className="insight-note">
          {fmtUSD(startHouse)} → {fmtUSD(endHouse)}
        </div>
      </div>

      <div className="insight">
        <div className="insight-label">
          {t("i_best_alt")}
          <HelpIcon text={lang === "tr"
            ? "Karşılaştırdığın varlıklar arasında en yüksek USD getiriye ulaşan. (Alternatif Yatırımlar sekmesinden ekle.)"
            : "Among the assets you compared, the one with the highest USD return. (Add from Alternatives tab.)"} />
        </div>
        <div className="insight-value">
          {bestAlt ? bestAlt.sym : "—"}
          {bestAlt ? <small>  +{bestAlt.gainPct.toFixed(0)}%</small> : null}
        </div>
        <div className="insight-note">
          {bestAlt
            ? `${fmtUSD(bestAlt.start)} → ${fmtUSD(bestAlt.end)}`
            : t("i_best_alt_none")}
        </div>
      </div>
    </div>
  );
}

function Verdict({ result, t }) {
  const hpr = result.house_plus_rent_yearly;
  const tot = result.total_credit_amount_usd_annual;
  if (!hpr || !tot) return null;
  const houseNet = hpr.at(-1) - tot.at(-1);
  // closeness threshold: ±10% of total cost
  const baseline = Math.abs(tot.at(-1));
  const ratio = houseNet / baseline;

  let kind, title, body;
  if (ratio > 0.1) {
    kind = "positive";
    title = t("verdict_house");
    body = t("verdict_house_p");
  } else if (ratio < -0.1) {
    kind = "negative";
    title = t("verdict_invest");
    body = t("verdict_invest_p");
  } else {
    kind = "";
    title = t("verdict_close");
    body = t("verdict_close_p").replace("{p}", (Math.abs(ratio) * 100).toFixed(1));
  }

  return (
    <div className={`verdict ${kind}`}>
      <div className="verdict-icon">
        {kind === "positive" ? "✓" : kind === "negative" ? "↗" : "≈"}
      </div>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

// ---------------- Chart ----------------

function ProjectionChart({ result, form, t, lang, view, granularity, isDark }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!result || !canvasRef.current || !window.Chart) return;
    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch (_) {}
      chartRef.current = null;
    }

    const def = VIEW_DEFS[view];
    const useMonths = granularity === "monthly";
    const labels = Array.from(useMonths ? result.months_axis : result.years_axis);

    const datasets = [];
    let colorIdx = 0;

    for (const s of def.series) {
      const fields = SERIES_FIELDS[s.key];
      if (!fields) continue;
      const arr = useMonths ? result[fields[1]] : result[fields[0]];
      if (!arr) continue;
      const offset = s.offset || 0;
      const data = new Array(labels.length);
      for (let i = 0; i < labels.length; i++) {
        const idx = i - offset;
        let v = idx >= 0 && idx < arr.length ? arr[idx] : null;
        if (v != null && s.isRatio) v = v * 100;
        data[i] = v;
      }
      const color = CHART_COLORS[s.color != null ? s.color : colorIdx++];
      datasets.push({
        label: t(s.labelKey),
        data,
        borderColor: color,
        backgroundColor: color,
        borderDash: s.dash ? [6, 4] : [],
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
      });
    }

    if (def.includeAssets && result.asset_projections) {
      for (const sym of Object.keys(result.asset_projections)) {
        const proj = result.asset_projections[sym];
        const arr = useMonths ? proj.monthly : proj.yearly;
        if (!arr) continue;
        const data = new Array(labels.length);
        for (let i = 0; i < labels.length; i++) data[i] = i < arr.length ? arr[i] : null;
        const color = CHART_COLORS[(2 + colorIdx++) % CHART_COLORS.length];
        datasets.push({
          label: sym + ` (+${proj.average_growth.toFixed(1)}%/yr)`,
          data,
          borderColor: color,
          backgroundColor: color,
          borderDash: [4, 3],
          borderWidth: 1.5,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
        });
      }
    }

    const ink = isDark ? "oklch(0.78 0.01 75)" : "oklch(0.44 0.012 70)";
    const grid = isDark ? "oklch(0.32 0.012 75)" : "oklch(0.91 0.008 80)";
    const surface = isDark ? "oklch(0.245 0.012 75)" : "oklch(0.995 0.004 80)";
    const border = isDark ? "oklch(0.40 0.014 75)" : "oklch(0.85 0.01 80)";

    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: ink,
              boxWidth: 10,
              boxHeight: 10,
              padding: 14,
              usePointStyle: true,
              pointStyle: "rectRounded",
              font: { family: "Geist, system-ui", size: 12 },
            },
          },
          tooltip: {
            backgroundColor: isDark ? "oklch(0.18 0.01 75)" : "oklch(0.22 0.015 70)",
            titleColor: "#fff",
            bodyColor: "oklch(0.85 0.01 75)",
            borderColor: border,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            titleFont: { family: "Geist, system-ui", size: 12, weight: "600" },
            bodyFont: { family: "Geist Mono, monospace", size: 12 },
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const label = items[0].label;
                return (useMonths ? t("month") + " " : t("year") + " ") + label;
              },
              label: (item) => {
                const v = item.parsed.y;
                if (v == null) return item.dataset.label + ": —";
                const fmt =
                  def.unit === "%"
                    ? v.toFixed(1) + "%"
                    : def.unit === "TL"
                      ? v.toFixed(2) + " ₺"
                      : def.unit === "USD/ay"
                        ? "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 })
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
            ticks: {
              color: ink,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: useMonths ? 12 : 11,
              font: { family: "Geist Mono, monospace", size: 11 },
            },
          },
          y: {
            grid: { color: grid, drawBorder: false },
            border: { display: false },
            ticks: {
              color: ink,
              font: { family: "Geist Mono, monospace", size: 11 },
              callback: (val) => {
                if (def.unit === "%") return val.toFixed(0) + "%";
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

    return () => {
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch (_) {}
        chartRef.current = null;
      }
    };
  }, [result, view, granularity, t, lang, isDark]);

  return <canvas ref={canvasRef}></canvas>;
}

// ---------------- Chart panel wrapper ----------------

function ChartPanel({ result, form, t, lang, hasSalary, isDark, onSave }) {
  const allViews = [
    { id: "decision", available: true },
    { id: "rent_vs", available: true },
    { id: "payment", available: true },
    { id: "salary", available: hasSalary },
    { id: "macro", available: true },
  ].filter((v) => v.available);

  const [view, setView] = useState_R("decision");
  const [granularity, setGranularity] = useState_R(form.use_months ? "monthly" : "yearly");
  const def = VIEW_DEFS[view];

  return (
    <div className="chart-panel">
      <div className="chart-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="chart-title">
            {t(def.titleKey)}
            {def.methodKey ? <HelpIcon text={t(def.methodKey)} /> : null}
          </h2>
          <p className="chart-sub">{t(def.subKey)}</p>
        </div>
        <div className="view-switch" role="tablist">
          {allViews.map((v) => (
            <button
              key={v.id}
              className={v.id === view ? "active" : ""}
              onClick={() => setView(v.id)}
            >
              {t(VIEW_DEFS[v.id].titleKey)}
            </button>
          ))}
        </div>
      </div>

      <SeriesGlossary def={def} result={result} t={t} />

      <div className="chart-wrap">
        <ProjectionChart
          result={result}
          form={form}
          t={t}
          lang={lang}
          view={view}
          granularity={granularity}
          isDark={isDark}
        />
      </div>
      <div className="chart-foot">
        <div className="granularity">
          <button className={granularity === "yearly" ? "active" : ""} onClick={() => setGranularity("yearly")}>
            {t("yearly")}
          </button>
          <button className={granularity === "monthly" ? "active" : ""} onClick={() => setGranularity("monthly")}>
            {t("monthly")}
          </button>
        </div>
        <button className="btn btn-ghost" onClick={onSave}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {t("save_chart")}
        </button>
      </div>
    </div>
  );
}

// ---------------- Series glossary (formula card) ----------------

function SeriesGlossary({ def, result, t }) {
  const items = def.series.map((s, i) => ({
    color: CHART_COLORS[s.color != null ? s.color : i],
    dash: !!s.dash,
    label: t(s.labelKey),
    formula: s.formulaKey ? t(s.formulaKey) : null,
  }));
  // Append asset projection series so each gets explained too
  if (def.includeAssets && result.asset_projections) {
    let idx = 2;
    for (const sym of Object.keys(result.asset_projections)) {
      const proj = result.asset_projections[sym];
      items.push({
        color: CHART_COLORS[(2 + idx) % CHART_COLORS.length],
        dash: true,
        label: `${sym} (+${proj.average_growth.toFixed(1)}%/yr)`,
        formula: t("sf_asset"),
      });
      idx += 1;
    }
  }
  if (!items.length) return null;
  return (
    <div className="glossary">
      {items.map((it, i) => (
        <div key={i} className="glossary-row">
          <span className="glossary-mark" style={{
            background: it.dash
              ? `repeating-linear-gradient(90deg, ${it.color} 0 6px, transparent 6px 10px)`
              : it.color,
          }} />
          <span className="glossary-label">{it.label}</span>
          {it.formula ? <span className="glossary-formula">— {it.formula}</span> : null}
        </div>
      ))}
    </div>
  );
}

// ---------------- Details accordion ----------------

function Details({ result, form, t }) {
  const rows = [
    [t("f_years"), form.years + " " + t("f_years_unit")],
    [t("f_interest"), form.interest_rate.toFixed(2) + " %"],
    [t("i_monthly_payment") + " (₺)", fmtTLFull(result.monthly_tl_payment)],
    [t("i_total_paid") + " (₺)", fmtTLFull(result.total_paid_tl)],
    [t("f_loan_amount"), fmtTLFull(result.loan_amount_tl)],
    [t("f_start_dollar"), result.dollar_rates_annual[0].toFixed(2) + " ₺"],
    ["USD/TL Y" + form.years, result.dollar_rates_annual.at(-1).toFixed(2) + " ₺"],
    [t("f_dollar_growth"), (result.effective_dollar_growth_annual * 100).toFixed(2) + " %"],
    [t("f_tr_inflation"), (result.effective_turkey_inflation_annual * 100).toFixed(2) + " %"],
    [t("f_value") + " (USD bugün)", fmtUSD(result.value_of_house_usd)],
    [t("f_value") + " Y" + form.years + " (USD)", fmtUSD(result.value_of_house_usd_yearly.at(-1))],
    [t("f_rent") + " Y" + form.years + " (USD)", fmtUSD(result.cumulative_rent_price_usd_yearly.at(-1))],
  ];
  return (
    <details className="details">
      <summary>{t("details")}</summary>
      <div className="details-grid">
        {rows.map((r, i) => (
          <div key={i} className="details-row">
            <span>{r[0]}</span>
            <span>{r[1]}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

window.InsightCards = InsightCards;
window.Verdict = Verdict;
window.ChartPanel = ChartPanel;
window.Details = Details;
