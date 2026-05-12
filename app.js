// =============================================================
// Real Estate Projection — Alpine.js app
// =============================================================

const TRANSLATIONS = {
  tr: {
    title: "Gayrimenkul Projeksiyonu",
    subtitle: "Kredi · enflasyon · döviz · alternatif yatırımlar",
    loan: "Kredi",
    years: "Vade (yıl)",
    interest_rate: "Aylık Faiz (%)",
    value_of_house: "Ev Değeri (Milyon TL)",
    down_payment: "Peşinat (Milyon TL)",
    loan_amount: "Kredi Tutarı",
    macro: "Makro",
    start_dollar: "Başlangıç USD/TL",
    dollar_growth: "Yıllık Dolar Artışı (%)",
    turkey_inflation: "Türkiye Enflasyonu (%)",
    usa_inflation: "ABD Enflasyonu (%)",
    rent_section: "Kira",
    monthly_rent: "Aylık Kira (TL)",
    salary: "Maaş",
    salary_currency: "Para Birimi",
    salary_annual: "Yıllık Başlangıç Maaşı (Net)",
    salary_growth: "Yıllık Maaş Artışı (%)",
    euro_dollar: "EUR/USD Kuru",
    options: "Seçenekler",
    use_months: "Aylık görünüm",
    deflate_us: "Doları ABD enflasyonu ile düşür (reel USD)",
    random: "Rastgele yıllık dalgalanma",
    project_initial: "Peşinatı varlığa yatır",
    property_costs: "Ev Giderleri",
    annual_property_tax_rate: "Yıllık Emlak Vergisi (%)",
    monthly_hoa_tl: "Aylık Aidat (TL)",
    annual_dask_tl: "Yıllık DASK (TL)",
    annual_maintenance_rate: "Yıllık Bakım (%)",
    transaction_cost_buy_pct: "Alış Giderleri (%)",
    transaction_cost_sell_pct: "Satış Giderleri (%)",
    closing_cost: "Alış Giderleri",
    plots: "Grafikler",
    assets: "Finansal Varlıklar",
    fetching_asset: "Varlık verisi alınıyor...",
    generate: "🚀 Grafik Oluştur",
    calculating: "Hesaplanıyor...",
    save_chart: "Grafiği Kaydet",
    summary_monthly_tl: "Aylık TL Ödeme",
    summary_total_tl: "Toplam Ödenen TL",
    summary_loan: "Kredi",
    summary_house_usd: "Başlangıç Ev (USD)",
    summary_breakeven: "Başa Baş",
    breakeven_never: "Vade içinde yok",
    year_short: "y",
    month_short: "ay",
    details: "Detaylar",
    hint: "Sol panelden parametreleri ayarlayıp Grafik Oluştur'a basın.",
    // plots
    monthly_payment_usd: "Aylık Ödeme (USD)",
    dollar_rates: "Dolar Kuru (TL)",
    total_credit_amount: "Toplam Yatırım (Peşinat + Ödeme) USD",
    total_credit_minus_rent: "Net Sahiplik Maliyeti (Peşinat + Ödeme + Giderler − Kira) USD",
    cumulative_ownership_cost: "Kümülatif Ev Gideri (USD)",
    net_sale_value_usd: "Net Satış Değeri (Komisyon sonrası) USD",
    net_buy_position: "Almanın Net Pozisyonu (USD)",
    remaining_loan: "Kalan Kredi (USD)",
    cumulative_payment: "Kümülatif Ödeme (USD)",
    house_value_usd: "Ev Değeri (USD)",
    rent_price_usd: "Aylık Kira (USD)",
    cumulative_rent: "Kümülatif Kira (USD)",
    house_plus_rent: "Ev + Kümülatif Kira (USD)",
    salaries_usd: "Maaş (USD)",
    payment_salary_ratio: "Ödeme / Maaş Oranı",
    payment_minus_rent_salary: "(Ödeme − Kira) / Maaş",
  },
  en: {
    title: "Real Estate Projection",
    subtitle: "Mortgage · inflation · FX · alternative investments",
    loan: "Loan",
    years: "Loan period (years)",
    interest_rate: "Monthly Interest (%)",
    value_of_house: "House Value (M TL)",
    down_payment: "Down Payment (M TL)",
    loan_amount: "Loan Amount",
    macro: "Macro",
    start_dollar: "Initial USD/TL",
    dollar_growth: "Annual Dollar Growth (%)",
    turkey_inflation: "Turkey Inflation (%)",
    usa_inflation: "USA Inflation (%)",
    rent_section: "Rent",
    monthly_rent: "Monthly Rent (TL)",
    salary: "Salary",
    salary_currency: "Currency",
    salary_annual: "Annual Starting Salary (Net)",
    salary_growth: "Annual Salary Growth (%)",
    euro_dollar: "EUR/USD Rate",
    options: "Options",
    use_months: "Monthly view",
    deflate_us: "Deflate dollar by US inflation (real USD)",
    random: "Random yearly fluctuations",
    project_initial: "Invest down payment in asset",
    property_costs: "Property Costs",
    annual_property_tax_rate: "Annual Property Tax (%)",
    monthly_hoa_tl: "Monthly HOA (TL)",
    annual_dask_tl: "Annual DASK (TL)",
    annual_maintenance_rate: "Annual Maintenance (%)",
    transaction_cost_buy_pct: "Buying Costs (%)",
    transaction_cost_sell_pct: "Selling Costs (%)",
    closing_cost: "Closing Cost",
    plots: "Plots",
    assets: "Financial Assets",
    fetching_asset: "Fetching asset data...",
    generate: "🚀 Generate Plot",
    calculating: "Calculating...",
    save_chart: "Save Chart",
    summary_monthly_tl: "Monthly TL Payment",
    summary_total_tl: "Total Paid TL",
    summary_loan: "Loan",
    summary_house_usd: "Initial House (USD)",
    summary_breakeven: "Break-even",
    breakeven_never: "Not within term",
    year_short: "y",
    month_short: "m",
    details: "Details",
    hint: "Set parameters on the left and click Generate.",
    monthly_payment_usd: "Monthly Payment (USD)",
    dollar_rates: "Dollar Rate (TL)",
    total_credit_amount: "Total Investment (Down + Paid) USD",
    total_credit_minus_rent: "Net Ownership Cost (Down + Paid + Carry − Rent) USD",
    cumulative_ownership_cost: "Cumulative Carry Cost (USD)",
    net_sale_value_usd: "Net Sale Value (after commission) USD",
    net_buy_position: "Net Buy Position (USD)",
    remaining_loan: "Remaining Loan (USD)",
    cumulative_payment: "Cumulative Payment (USD)",
    house_value_usd: "House Value (USD)",
    rent_price_usd: "Monthly Rent (USD)",
    cumulative_rent: "Cumulative Rent (USD)",
    house_plus_rent: "House + Cumulative Rent (USD)",
    salaries_usd: "Salary (USD)",
    payment_salary_ratio: "Payment / Salary Ratio",
    payment_minus_rent_salary: "(Payment − Rent) / Salary",
  },
};

const PLOT_ORDER = [
  "monthly_payment_usd",
  "total_credit_amount",
  "total_credit_minus_rent",
  "cumulative_ownership_cost",
  "net_buy_position",
  "house_value_usd",
  "net_sale_value_usd",
  "remaining_loan",
  "house_plus_rent",
  "dollar_rates",
  "rent_price_usd",
  "cumulative_rent",
  "cumulative_payment",
  "salaries_usd",
  "payment_salary_ratio",
  "payment_minus_rent_salary",
];

// Series accessor: maps plot key -> {yearlyKey, monthlyKey, paymentOffset?}
const SERIES_MAP = {
  monthly_payment_usd: { yearly: "annual_payment_usd", monthly: "monthly_payment_usd", offset: 1 },
  dollar_rates: { yearly: "dollar_rates_annual", monthly: "dollar_rates_monthly" },
  total_credit_amount: { yearly: "total_credit_amount_usd_annual", monthly: "total_credit_amount_usd_monthly" },
  total_credit_minus_rent: { yearly: "total_credit_minus_rent_usd_yearly", monthly: "total_credit_minus_rent_usd_monthly" },
  cumulative_ownership_cost: { yearly: "cumulative_ownership_cost_usd_yearly", monthly: "cumulative_ownership_cost_usd_monthly" },
  net_sale_value_usd: { yearly: "net_sale_value_usd_yearly", monthly: "net_sale_value_usd_monthly" },
  net_buy_position: { yearly: "net_buy_position_usd_yearly", monthly: "net_buy_position_usd_monthly" },
  remaining_loan: { yearly: "remaining_loan_usd_yearly", monthly: "remaining_loan_usd_monthly" },
  cumulative_payment: { yearly: "cumulative_payment_usd_annual", monthly: "cumulative_payment_usd_monthly", offset: 1 },
  house_value_usd: { yearly: "value_of_house_usd_yearly", monthly: "value_of_house_usd_monthly" },
  rent_price_usd: { yearly: "rent_price_usd_yearly", monthly: "rent_price_usd_monthly" },
  cumulative_rent: { yearly: "cumulative_rent_price_usd_yearly", monthly: "cumulative_rent_price_usd_monthly", offset: 1 },
  house_plus_rent: { yearly: "house_plus_rent_yearly", monthly: "house_plus_rent_monthly" },
  salaries_usd: { yearly: "salaries_usd_yearly", monthly: "salaries_usd_monthly" },
  payment_salary_ratio: { yearly: "payment_salary_ratio_yearly", monthly: "payment_salary_ratio_monthly", offset: 1 },
  payment_minus_rent_salary: { yearly: "payment_minus_rent_over_salary_yearly", monthly: "payment_minus_rent_over_salary_monthly", offset: 1 },
};

const COLORS = [
  "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
  "#a855f7", "#eab308", "#22d3ee", "#fb7185", "#4ade80",
];

function projectionApp() {
  // Non-reactive storage — Alpine would otherwise wrap the Chart instance and
  // the deep result object in Proxies, which causes Chart.js's internal updates
  // to recurse through Alpine's reactivity (Maximum call stack size exceeded).
  let _chart = null;
  let _result = null;
  let _useMonthsForChart = true;

  return {
    lang: "tr",
    loading: false,
    loadingAsset: false,
    error: "",
    hasResult: false,
    summary: null,  // small reactive object for UI bindings only

    plotOrder: PLOT_ORDER,

    selectedPlots: ["monthly_payment_usd", "total_credit_amount", "house_value_usd", "house_plus_rent"],
    selectedAssets: [],
    supportedAssets: [],
    assetInfo: {}, // symbol -> {average_growth, current_price}

    // Inputs in "millions of TL" for convenience
    houseValueM: 2.1,
    downPaymentM: 0.35,

    form: {
      years: 10,
      interest_rate: 2.74,
      initial_noncredit_amount_tl: 350_000,
      value_of_house_tl: 2_100_000,
      start_dollar_tl: 45.0,
      dollar_growth_rate: 35.0,
      turkey_inflation: 25.0,
      usa_inflation: 3.0,
      initial_monthly_rent_tl: 20000,
      salary_currency: "USD",
      start_salary_base: 0,
      salary_growth: 0,
      euro_dollar_rate: 1.15,
      months_to_increase: 12,
      use_months: true,
      deflate_dollar_by_us_inflation: false,
      generate_random: false,
      project_initial_money_with_asset: false,
      annual_property_tax_rate: 0.2,
      monthly_hoa_tl: 1500,
      annual_dask_tl: 2000,
      annual_maintenance_rate: 1.0,
      transaction_cost_buy_pct: 6.0,
      transaction_cost_sell_pct: 2.0,
    },

    infoRows: [],

    t(key) {
      return TRANSLATIONS[this.lang][key] || key;
    },

    fmt(n) {
      if (n == null || isNaN(n)) return "—";
      return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    },

    fmtBreakeven(months) {
      if (months == null) return this.t("breakeven_never");
      const y = Math.floor(months / 12);
      const m = months % 12;
      const yPart = y > 0 ? `${y}${this.t("year_short")}` : "";
      const mPart = m > 0 ? `${m}${this.t("month_short")}` : "";
      return [yPart, mPart].filter(Boolean).join(" ") || `0${this.t("month_short")}`;
    },

    async init() {
      // Watch M-TL inputs and sync the underlying TL values
      this.$watch("houseValueM", v => { this.form.value_of_house_tl = Math.round(v * 1_000_000); });
      this.$watch("downPaymentM", v => { this.form.initial_noncredit_amount_tl = Math.round(v * 1_000_000); });

      // Load static asset metadata bundled with the frontend
      try {
        const r = await fetch("assets.json");
        const j = await r.json();
        this.supportedAssets = j.supported_assets;
        this._assetData = j.data || {};
      } catch (e) {
        this.error = "assets.json yüklenemedi";
        this.supportedAssets = SUPPORTED_ASSETS;
        this._assetData = {};
      }

      // When an asset is checked, look it up in the bundled data
      this.$watch("selectedAssets", (newList, oldList) => {
        const added = newList.filter(x => !oldList.includes(x));
        for (const sym of added) {
          if (this.assetInfo[sym]) continue;
          const data = this._assetData[sym];
          if (data) {
            this.assetInfo[sym] = data;
          } else {
            this.error = `${sym} için varlık verisi yok (manuel girin veya yeniden kalibre edin)`;
            this.selectedAssets = this.selectedAssets.filter(x => x !== sym);
          }
        }
      });
    },

    saveChart() {
      if (!_chart) return;
      const src = _chart.canvas;
      const tmp = document.createElement("canvas");
      tmp.width = src.width;
      tmp.height = src.height;
      const ctx = tmp.getContext("2d");
      ctx.fillStyle = "#0f172a"; // matches bg-slate-900 so the dark theme exports cleanly
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.drawImage(src, 0, 0);
      const a = document.createElement("a");
      a.href = tmp.toDataURL("image/png");
      const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
      a.download = `projection-${ts}.png`;
      a.click();
    },

    _buildChart(labels, datasets) {
      // Destroy any prior instance — bulletproof against partial-state bugs.
      if (_chart) {
        try { _chart.destroy(); } catch (_) {}
        _chart = null;
      }
      const canvas = document.getElementById("mainChart");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      _chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: true, position: "bottom", labels: { color: "#cbd5e1", boxWidth: 14, padding: 12 } },
            tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1 },
          },
          scales: {
            x: {
              grid: { color: "#1e293b" },
              ticks: {
                color: "#94a3b8",
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: _useMonthsForChart ? 12 : 11,
              },
            },
            y: {
              grid: { color: "#1e293b" },
              ticks: { color: "#94a3b8" },
            },
          },
        },
      });
    },

    runProjection() {
      this.loading = true;
      this.error = "";
      try {
        const input = { ...this.form };
        input.assets = {};
        for (const sym of this.selectedAssets) {
          if (this.assetInfo[sym]) {
            input.assets[sym] = {
              average_growth: this.assetInfo[sym].average_growth,
              current_price: this.assetInfo[sym].current_price,
            };
          }
        }

        // Run the projection entirely in the browser
        _result = runProjection(input);

        // Build a small reactive summary for the UI
        this.summary = {
          monthly_tl_payment: _result.monthly_tl_payment,
          total_paid_tl: _result.total_paid_tl,
          loan_amount_tl: _result.loan_amount_tl,
          value_of_house_usd: _result.value_of_house_usd,
          breakeven_month: _result.breakeven_month,
        };
        this.hasResult = true;
        this.renderChart();
        this.buildInfoRows();
      } catch (e) {
        console.error(e);
        this.error = String(e.message || e);
      } finally {
        this.loading = false;
      }
    },

    renderChart() {
      if (!_result) return;
      const useMonths = this.form.use_months;
      _useMonthsForChart = useMonths;
      const datasets = [];

      // x-axis labels — copy to a plain array
      const labels = Array.from(useMonths ? _result.months_axis : _result.years_axis);

      let colorIdx = 0;
      // Regular plots
      for (const key of this.selectedPlots) {
        const map = SERIES_MAP[key];
        if (!map) continue;
        const seriesKey = useMonths ? map.monthly : map.yearly;
        const arr = _result[seriesKey];
        if (!arr || arr.length === 0) continue;
        const offset = map.offset || 0;
        const data = new Array(labels.length);
        for (let i = 0; i < labels.length; i++) {
          const idx = i - offset;
          data[i] = idx >= 0 && idx < arr.length ? arr[idx] : null;
        }
        const color = COLORS[colorIdx++ % COLORS.length];
        datasets.push({
          label: this.t(key),
          data,
          borderColor: color,
          backgroundColor: color + "33",
          tension: 0.15,
          pointRadius: useMonths ? 0 : 3,
          pointHoverRadius: 5,
        });
      }

      // Asset projections
      const assetProj = _result.asset_projections || {};
      for (const sym of Object.keys(assetProj)) {
        const proj = assetProj[sym];
        const arr = useMonths ? proj.monthly : proj.yearly;
        if (!arr) continue;
        const data = new Array(labels.length);
        for (let i = 0; i < labels.length; i++) {
          data[i] = i < arr.length ? arr[i] : null;
        }
        const color = COLORS[colorIdx++ % COLORS.length];
        datasets.push({
          label: `${sym} (${proj.average_growth.toFixed(1)}%/yr)`,
          data,
          borderColor: color,
          backgroundColor: color + "33",
          borderDash: [6, 4],
          tension: 0.15,
          pointRadius: useMonths ? 0 : 3,
        });
      }

      // Build (or rebuild) the chart with the new data — bulletproof against
      // Chart.js layout-state edge cases.
      this._buildChart(labels, datasets);
    },

    buildInfoRows() {
      if (!_result) return;
      const r = _result;
      this.infoRows = [
        { label: this.t("years"), value: this.form.years },
        { label: this.t("interest_rate"), value: this.form.interest_rate.toFixed(2) + " %" },
        { label: this.t("summary_monthly_tl"), value: this.fmt(r.monthly_tl_payment) + " TL" },
        { label: this.t("summary_total_tl"), value: this.fmt(r.total_paid_tl) + " TL" },
        { label: this.t("summary_loan"), value: this.fmt(r.loan_amount_tl) + " TL" },
        { label: this.t("start_dollar"), value: r.dollar_rates_annual[0].toFixed(2) },
        { label: this.t("dollar_growth"), value: (r.effective_dollar_growth_annual * 100).toFixed(2) + " %" },
        { label: this.t("turkey_inflation"), value: (r.effective_turkey_inflation_annual * 100).toFixed(2) + " %" },
        { label: this.t("summary_house_usd"), value: this.fmt(r.value_of_house_usd) + " USD" },
        { label: this.t("house_value_usd") + " (Y" + this.form.years + ")", value: this.fmt(r.value_of_house_usd_yearly.at(-1)) + " USD" },
        { label: this.t("cumulative_rent") + " (Y" + this.form.years + ")", value: this.fmt(r.cumulative_rent_price_usd_yearly.at(-1)) + " USD" },
      ];
    },
  };
}
