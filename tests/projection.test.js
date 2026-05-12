// Unit tests for projection.js (the pure math engine).
// Loaded via eval so we don't have to modify projection.js (which is
// global-scope, no module.exports — designed for <script> tags).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "projection.js"), "utf8");
// eslint-disable-next-line no-eval
eval(src); // exposes runProjection, SUPPORTED_ASSETS in this scope

function baseInput(overrides = {}) {
  return {
    years: 10,
    interest_rate: 2.74,
    initial_noncredit_amount_tl: 350_000,
    value_of_house_tl: 2_100_000,
    start_dollar_tl: 45.0,
    dollar_growth_rate: 35.0,
    turkey_inflation: 25.0,
    usa_inflation: 3.0,
    initial_monthly_rent_tl: 20_000,
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
    assets: {},
    ...overrides,
  };
}

test("array lengths match years/months axis convention", () => {
  const r = runProjection(baseInput());
  const years = 10;
  const nMonths = years * 12;
  assert.equal(r.years_axis.length, years + 1);
  assert.equal(r.months_axis.length, nMonths + 1);
  assert.equal(r.annual_payment_usd.length, years);
  assert.equal(r.monthly_payment_usd.length, nMonths);
  assert.equal(r.total_credit_amount_usd_annual.length, years + 1);
  assert.equal(r.total_credit_amount_usd_monthly.length, nMonths + 1);
  assert.equal(r.dollar_rates_annual.length, years + 1);
  assert.equal(r.dollar_rates_monthly.length, nMonths + 1);
  assert.equal(r.remaining_loan_usd_yearly.length, years + 1);
  assert.equal(r.remaining_loan_usd_monthly.length, nMonths + 1);
  assert.equal(r.net_buy_position_usd_yearly.length, years + 1);
  assert.equal(r.net_buy_position_usd_monthly.length, nMonths + 1);
});

test("remaining loan at month 0 in TL equals loan_amount_tl", () => {
  const inp = baseInput();
  const r = runProjection(inp);
  // remaining_loan_usd_monthly[0] * start_dollar_tl should equal loan_amount_tl
  const loanTlReconstructed = r.remaining_loan_usd_monthly[0] * inp.start_dollar_tl;
  assert.ok(Math.abs(loanTlReconstructed - r.loan_amount_tl) < 1e-6);
});

test("remaining loan at end of term is essentially zero", () => {
  const r = runProjection(baseInput());
  // Tiny floating-point slop allowed; in USD terms this is fractions of a cent.
  assert.ok(Math.abs(r.remaining_loan_usd_yearly[10]) < 1e-6);
});

test("dollar_rates_annual[1] = start * (1 + growth/100) for deterministic path", () => {
  const inp = baseInput({ generate_random: false });
  const r = runProjection(inp);
  const expected = inp.start_dollar_tl * (1 + inp.dollar_growth_rate / 100);
  assert.ok(Math.abs(r.dollar_rates_annual[1] - expected) < 1e-9);
});

test("monthly dollar rate at index 12 equals annual at index 1", () => {
  const r = runProjection(baseInput());
  assert.ok(Math.abs(r.dollar_rates_monthly[12] - r.dollar_rates_annual[1]) < 1e-9);
});

test("zeroing all carry inputs zeros ownership_cost arrays", () => {
  const inp = baseInput({
    annual_property_tax_rate: 0,
    monthly_hoa_tl: 0,
    annual_dask_tl: 0,
    annual_maintenance_rate: 0,
  });
  const r = runProjection(inp);
  for (const v of r.ownership_cost_usd_yearly) assert.ok(Math.abs(v) < 1e-12);
  for (const v of r.cumulative_ownership_cost_usd_yearly) assert.ok(Math.abs(v) < 1e-12);
});

test("with zero carry, total_credit_minus_rent equals total_credit - cum_rent", () => {
  const inp = baseInput({
    annual_property_tax_rate: 0,
    monthly_hoa_tl: 0,
    annual_dask_tl: 0,
    annual_maintenance_rate: 0,
  });
  const r = runProjection(inp);
  for (let y = 0; y <= inp.years; y++) {
    const expected = r.total_credit_amount_usd_annual[y] - r.cumulative_rent_price_usd_yearly[y];
    assert.ok(Math.abs(r.total_credit_minus_rent_usd_yearly[y] - expected) < 1e-9);
  }
});

test("buy_transaction_cost_tl = value_of_house_tl * buy_pct/100", () => {
  const r = runProjection(baseInput({
    transaction_cost_buy_pct: 6,
    value_of_house_tl: 2_100_000,
  }));
  assert.equal(r.buy_transaction_cost_tl, 126_000);
});

test("buy_transaction_cost shifts total_credit_amount_usd_annual[0] by exact amount", () => {
  const withTx = runProjection(baseInput({ transaction_cost_buy_pct: 6 }));
  const noTx = runProjection(baseInput({ transaction_cost_buy_pct: 0 }));
  const diff = withTx.total_credit_amount_usd_annual[0] - noTx.total_credit_amount_usd_annual[0];
  assert.ok(Math.abs(diff - withTx.buy_transaction_cost_usd) < 1e-9);
});

test("net_sale_value_usd_yearly[10] = (1 - sell_pct) * house_value_usd_yearly[10]", () => {
  const r = runProjection(baseInput({ transaction_cost_sell_pct: 2 }));
  const expected = 0.98 * r.value_of_house_usd_yearly[10];
  assert.ok(Math.abs(r.net_sale_value_usd_yearly[10] - expected) < 1e-9);
});

test("buy-wins scenario: breakeven within first year", () => {
  // No FX drift, no interest, high rent, no carrying or transaction costs.
  // House value stays flat in USD. Each month rent > payment, so net buy
  // position turns positive almost immediately.
  const r = runProjection(baseInput({
    interest_rate: 0,
    dollar_growth_rate: 0,
    turkey_inflation: 0,
    initial_monthly_rent_tl: 200_000, // huge rent
    annual_property_tax_rate: 0,
    monthly_hoa_tl: 0,
    annual_dask_tl: 0,
    annual_maintenance_rate: 0,
    transaction_cost_buy_pct: 0,
    transaction_cost_sell_pct: 0,
  }));
  assert.ok(r.breakeven_month !== null, "expected a finite breakeven");
  assert.ok(r.breakeven_month >= 1 && r.breakeven_month <= 12,
    `expected breakeven in 1..12, got ${r.breakeven_month}`);
});

test("rent-wins scenario: never breaks even", () => {
  const r = runProjection(baseInput({
    interest_rate: 5.0,         // very high monthly rate
    dollar_growth_rate: 50.0,   // big FX devaluation
    initial_monthly_rent_tl: 100, // ~nothing
    annual_property_tax_rate: 5.0,
    monthly_hoa_tl: 10_000,
    annual_dask_tl: 50_000,
    annual_maintenance_rate: 5.0,
    transaction_cost_buy_pct: 10,
    transaction_cost_sell_pct: 10,
  }));
  assert.equal(r.breakeven_month, null);
});

test("Phase 1 default scenario does not break even", () => {
  const r = runProjection(baseInput());
  assert.equal(r.breakeven_month, null);
});

test("yearly/monthly consistency at indices y*12", () => {
  const r = runProjection(baseInput());
  const years = 10;
  for (let y = 1; y <= years; y++) {
    const m = y * 12;
    assert.ok(Math.abs(r.cumulative_rent_price_usd_yearly[y] - r.cumulative_rent_price_usd_monthly[m]) < 1e-9,
      `cumulative_rent mismatch at y=${y}`);
    assert.ok(Math.abs(r.cumulative_ownership_cost_usd_yearly[y] - r.cumulative_ownership_cost_usd_monthly[m]) < 1e-9,
      `cumulative_ownership_cost mismatch at y=${y}`);
    assert.ok(Math.abs(r.total_credit_amount_usd_annual[y] - r.total_credit_amount_usd_monthly[m]) < 1e-9,
      `total_credit_amount mismatch at y=${y}`);
    assert.ok(Math.abs(r.total_credit_minus_rent_usd_yearly[y] - r.total_credit_minus_rent_usd_monthly[m]) < 1e-9,
      `total_credit_minus_rent mismatch at y=${y}`);
    assert.ok(Math.abs(r.net_buy_position_usd_yearly[y] - r.net_buy_position_usd_monthly[m]) < 1e-9,
      `net_buy_position mismatch at y=${y}`);
  }
});

test("prefix-sum cumulative arrays start at zero", () => {
  const r = runProjection(baseInput());
  assert.equal(r.cumulative_rent_price_usd_yearly[0], 0);
  assert.equal(r.cumulative_ownership_cost_usd_yearly[0], 0);
  assert.equal(r.cumulative_rent_price_usd_monthly[0], 0);
  assert.equal(r.cumulative_ownership_cost_usd_monthly[0], 0);
});

test("salary fields are null when start_salary_base = 0", () => {
  const r = runProjection(baseInput({ start_salary_base: 0 }));
  assert.equal(r.salaries_usd_yearly, null);
  assert.equal(r.salaries_usd_monthly, null);
  assert.equal(r.payment_salary_ratio_yearly, null);
  assert.equal(r.payment_salary_ratio_monthly, null);
});

test("salary fields populated with correct lengths when start_salary_base > 0", () => {
  const inp = baseInput({
    start_salary_base: 30_000,
    salary_currency: "USD",
    salary_growth: 5,
  });
  const r = runProjection(inp);
  assert.ok(Array.isArray(r.salaries_usd_yearly));
  assert.equal(r.salaries_usd_yearly.length, inp.years + 1);
  assert.equal(r.payment_salary_ratio_yearly.length, inp.years);
});

test("asset projection: yearly[0] = current_price, yearly[10] = price * (1+g)^10", () => {
  const r = runProjection(baseInput({
    assets: { BTC: { average_growth: 20, current_price: 100_000 } },
    generate_random: false,
  }));
  const btc = r.asset_projections.BTC;
  assert.ok(btc, "BTC asset projection missing");
  assert.equal(btc.yearly[0], 100_000);
  const expected = 100_000 * Math.pow(1.2, 10);
  assert.ok(Math.abs(btc.yearly[10] - expected) < 1e-6,
    `expected ${expected}, got ${btc.yearly[10]}`);
});

// --- Phase 2.2: geometric rescale in random paths --------------------

// Deterministic PRNG (mulberry32) for reproducible random-path tests.
function withSeed(seed, fn) {
  const orig = Math.random;
  let s = seed | 0;
  Math.random = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

test("random yearly path: compounded final value matches (1+target)^N", () => {
  withSeed(42, () => {
    const initial = 100;
    const years = 20;
    const targetPct = 25;
    const { path } = randomYearlyPath(initial, years, targetPct);
    const expected = initial * Math.pow(1 + targetPct / 100, years);
    // Geometric rescale → equality holds to floating-point precision.
    assert.ok(Math.abs(path[years] - expected) / expected < 1e-12,
      `final ${path[years]} != expected ${expected}`);
  });
});

test("random monthly path: compounded final value matches (1+target)^N", () => {
  withSeed(99, () => {
    const initial = 100;
    const years = 10;
    const targetPct = 35;
    const { monthly } = randomMonthlyPath(initial, years, targetPct);
    const expected = initial * Math.pow(1 + targetPct / 100, years);
    assert.ok(Math.abs(monthly[years * 12] - expected) / expected < 1e-12,
      `final ${monthly[years * 12]} != expected ${expected}`);
  });
});

test("random yearly adjusted rates: geometric mean of (1+r) equals (1+target)", () => {
  withSeed(123, () => {
    const targetPct = 15;
    const years = 30;
    const { adjusted } = randomYearlyPath(100, years, targetPct);
    const logSum = adjusted.reduce((s, r) => s + Math.log(1 + r), 0);
    const geoMean = Math.exp(logSum / years);
    assert.ok(Math.abs(geoMean - (1 + targetPct / 100)) < 1e-12,
      `geomean ${geoMean} != 1.15`);
  });
});

test("random yearly path with target=0 yields flat path", () => {
  withSeed(7, () => {
    const { path } = randomYearlyPath(100, 10, 0);
    for (const x of path) assert.equal(x, 100);
  });
});

test("end-to-end: random_generate matches deterministic at horizon (engine-level)", () => {
  // Whole-engine smoke: with generate_random=true, dollar_rates_monthly.at(-1)
  // should match the deterministic compound exactly thanks to geometric rescale.
  withSeed(2026, () => {
    const r = runProjection(baseInput({ generate_random: true }));
    const start = 45;
    const years = 10;
    const expected = start * Math.pow(1 + 35 / 100, years);
    const got = r.dollar_rates_monthly.at(-1);
    assert.ok(Math.abs(got - expected) / expected < 1e-12,
      `final FX ${got} != deterministic ${expected}`);
  });
});
