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

// --- Phase 3.x lite: loan_term_years separate from horizon -----------

test("loan_term_years defaults to years (back-compat)", () => {
  // Two runs with same inputs should produce identical outputs when
  // loan_term_years is omitted vs explicitly equal to years.
  const a = runProjection(baseInput());
  const b = runProjection(baseInput({ loan_term_years: 10 }));
  assert.equal(a.monthly_tl_payment, b.monthly_tl_payment);
  assert.equal(a.total_paid_tl, b.total_paid_tl);
});

test("loan_term_years < years: monthly payment amortizes over the shorter term", () => {
  // Same principal, same rate. Shorter term => higher monthly payment.
  const long = runProjection(baseInput({ years: 10, loan_term_years: 10 }));
  const short = runProjection(baseInput({ years: 10, loan_term_years: 5 }));
  assert.ok(short.monthly_tl_payment > long.monthly_tl_payment,
    `5y payment ${short.monthly_tl_payment} should exceed 10y payment ${long.monthly_tl_payment}`);
});

test("loan_term_years < years: monthly_payment_usd is zero after the loan ends", () => {
  const r = runProjection(baseInput({ years: 10, loan_term_years: 5 }));
  // Months 0..59 should have a payment; months 60..119 should be zero.
  for (let m = 0; m < 60; m++) {
    assert.ok(r.monthly_payment_usd[m] > 0, `month ${m} payment should be positive`);
  }
  for (let m = 60; m < 120; m++) {
    assert.equal(r.monthly_payment_usd[m], 0, `month ${m} payment should be zero`);
  }
});

test("loan_term_years < years: remaining loan is zero after the loan ends", () => {
  const r = runProjection(baseInput({ years: 10, loan_term_years: 5 }));
  // At month 60 the balance is ~0 (FP noise). For m > 60 the engine
  // explicitly assigns 0.
  assert.ok(Math.abs(r.remaining_loan_usd_monthly[60]) < 1e-6,
    `remaining_loan at end of term = ${r.remaining_loan_usd_monthly[60]}, expected ~0`);
  for (let m = 61; m <= 120; m++) {
    assert.equal(r.remaining_loan_usd_monthly[m], 0);
  }
});

test("loan_term_years < years: total_paid_tl reflects only the actual payments", () => {
  const r = runProjection(baseInput({ years: 10, loan_term_years: 5 }));
  // Borrower paid 60 monthly payments, not 120.
  assert.ok(Math.abs(r.total_paid_tl - r.monthly_tl_payment * 60) < 1e-6);
});

// --- Phase 3.3: per-year rate overrides ------------------------------

test("flat mode (default) is back-compat: missing mode keys behave like before", () => {
  const a = runProjection(baseInput());
  const b = runProjection(baseInput({
    dollar_growth_mode: "flat",
    turkey_inflation_mode: "flat",
  }));
  assert.equal(a.dollar_rates_annual[10], b.dollar_rates_annual[10]);
  assert.equal(a.value_of_house_usd_yearly[10], b.value_of_house_usd_yearly[10]);
  assert.equal(a.cumulative_rent_price_usd_yearly.at(-1), b.cumulative_rent_price_usd_yearly.at(-1));
});

test("yearly dollar_growth_per_year drives FX path exactly", () => {
  // 10 years, alternating 50%/20% growth. Final FX = start × prod(1+r_i).
  const perYear = [50, 20, 50, 20, 50, 20, 50, 20, 50, 20];
  const r = runProjection(baseInput({
    dollar_growth_mode: "yearly",
    dollar_growth_per_year: perYear,
  }));
  let expectedFx = 45;
  for (const g of perYear) expectedFx *= 1 + g / 100;
  assert.ok(Math.abs(r.dollar_rates_annual[10] - expectedFx) / expectedFx < 1e-12);
  // The effective_dollar_growth_annual scalar is the geometric mean of the path.
  const geoMean = Math.pow(expectedFx / 45, 1 / 10) - 1;
  assert.ok(Math.abs(r.effective_dollar_growth_annual - geoMean) < 1e-12);
});

test("yearly turkey_inflation_per_year drives house & rent in TL", () => {
  // House nominal TL at end = start_value × prod(1+r_i).
  const perYear = [10, 30, 20, 25, 40, 15, 20, 30, 10, 35];
  const r = runProjection(baseInput({
    turkey_inflation_mode: "yearly",
    turkey_inflation_per_year: perYear,
  }));
  let expectedMul = 1;
  for (const g of perYear) expectedMul *= 1 + g / 100;
  const expectedHouseTl = 2_100_000 * expectedMul;
  const actualHouseTl = r.value_of_house_usd_yearly[10] * r.dollar_rates_annual[10];
  assert.ok(Math.abs(actualHouseTl - expectedHouseTl) / expectedHouseTl < 1e-9);
});

test("yearly mode with wrong-length array falls back to flat", () => {
  // perYear array length must equal years; otherwise the engine ignores it.
  const r = runProjection(baseInput({
    dollar_growth_mode: "yearly",
    dollar_growth_per_year: [50, 20, 50], // length 3 ≠ years (10)
  }));
  const expectedFlat = 45 * Math.pow(1 + 35 / 100, 10);
  assert.ok(Math.abs(r.dollar_rates_annual[10] - expectedFlat) / expectedFlat < 1e-12);
});

// --- Phase 3.3: variable per-year loan rate -----------------------

test("flat interest mode is back-compat: missing keys behave like the scalar", () => {
  const a = runProjection(baseInput());
  const b = runProjection(baseInput({ interest_rate_mode: "flat" }));
  assert.equal(a.monthly_tl_payment, b.monthly_tl_payment);
  assert.equal(a.total_paid_tl, b.total_paid_tl);
});

test("yearly interest: per-year array drives the payment schedule", () => {
  // Step the rate up every year — payment should rise after y1.
  const rates = Array.from({ length: 10 }, (_, y) => 2.74 + 0.1 * y);
  const r = runProjection(baseInput({
    interest_rate_mode: "yearly",
    interest_rate_per_year: rates,
  }));
  // First-year payment should match a flat-mode amortization at rates[0].
  const flat = runProjection(baseInput({ interest_rate: rates[0] }));
  assert.ok(Math.abs(r.monthly_tl_payment - flat.monthly_tl_payment) < 1e-6,
    `first-year payment ${r.monthly_tl_payment} != flat-rate ${flat.monthly_tl_payment}`);
  // Final balance after the term still zero (amortization closes correctly).
  assert.ok(Math.abs(r.remaining_loan_usd_monthly[120]) < 1e-6);
  // total_paid_tl must equal the sum of every month's payment (not the
  // first-year payment × n).
  const flatTotal = flat.monthly_tl_payment * 120;
  assert.ok(r.total_paid_tl > flatTotal,
    `rising rates should produce a higher total: ${r.total_paid_tl} vs flat ${flatTotal}`);
});

test("yearly interest: a flat schedule (all same rate) matches scalar mode", () => {
  const rate = 2.5;
  const rates = Array(10).fill(rate);
  const a = runProjection(baseInput({ interest_rate: rate }));
  const b = runProjection(baseInput({
    interest_rate_mode: "yearly",
    interest_rate_per_year: rates,
  }));
  assert.ok(Math.abs(a.total_paid_tl - b.total_paid_tl) < 1e-6,
    `flat schedule should equal scalar: ${a.total_paid_tl} vs ${b.total_paid_tl}`);
  assert.ok(Math.abs(a.monthly_tl_payment - b.monthly_tl_payment) < 1e-6);
});

test("yearly interest: wrong-length array falls back to flat rate", () => {
  const a = runProjection(baseInput());
  const b = runProjection(baseInput({
    interest_rate_mode: "yearly",
    interest_rate_per_year: [2.74, 3.0, 3.5], // length 3 ≠ loan term (10)
  }));
  assert.equal(a.monthly_tl_payment, b.monthly_tl_payment);
});

test("variable rate + loan_term_years: amortization respects shorter term", () => {
  const rates = [3.0, 3.0, 3.0, 3.0, 3.0]; // 5y loan
  const r = runProjection(baseInput({
    years: 10,
    loan_term_years: 5,
    interest_rate_mode: "yearly",
    interest_rate_per_year: rates,
  }));
  // Payments only run for the first 5 years (60 months).
  for (let m = 0; m < 60; m++) assert.ok(r.monthly_payment_usd[m] > 0);
  for (let m = 60; m < 120; m++) assert.equal(r.monthly_payment_usd[m], 0);
  assert.ok(Math.abs(r.remaining_loan_usd_monthly[60]) < 1e-6);
});

// --- Phase 2.4: Monte Carlo envelopes -------------------------------

test("Monte Carlo: envelopes are monotone (p10 ≤ p50 ≤ p90 at every period)", () => {
  withSeed(2026, () => {
    const r = runMonteCarlo(baseInput({ generate_random: true }), 80);
    assert.ok(r.envelopes, "envelopes missing");
    for (const [key, env] of Object.entries(r.envelopes)) {
      for (let i = 0; i < env.p50.length; i++) {
        assert.ok(env.p10[i] <= env.p50[i] + 1e-9, `${key}[${i}] p10 ${env.p10[i]} > p50 ${env.p50[i]}`);
        assert.ok(env.p50[i] <= env.p90[i] + 1e-9, `${key}[${i}] p50 ${env.p50[i]} > p90 ${env.p90[i]}`);
      }
    }
  });
});

test("Monte Carlo: median FX path matches deterministic compound at the horizon", () => {
  // Geometric rescale guarantees every run lands at (1+target)^N exactly,
  // so all trials share the same final FX — p10/p50/p90 should collapse
  // to one number at the last index.
  withSeed(7, () => {
    const r = runMonteCarlo(baseInput({ generate_random: true }), 50);
    const last = r.envelopes.dollar_rates_annual;
    const expected = 45 * Math.pow(1 + 35 / 100, 10);
    assert.ok(Math.abs(last.p50.at(-1) - expected) / expected < 1e-9);
    // p10 and p90 also exact at the horizon (geometric rescale lands every run)
    assert.ok(Math.abs(last.p10.at(-1) - expected) / expected < 1e-9);
    assert.ok(Math.abs(last.p90.at(-1) - expected) / expected < 1e-9);
  });
});

test("Monte Carlo: envelope spread shows up mid-term (intermediate volatility)", () => {
  withSeed(99, () => {
    const r = runMonteCarlo(baseInput({ generate_random: true }), 80);
    const mid = Math.floor(r.envelopes.dollar_rates_monthly.p50.length / 2);
    const e = r.envelopes.dollar_rates_monthly;
    // p90 − p10 should be > 0 at mid horizon: random paths visibly fan out.
    assert.ok(e.p90[mid] - e.p10[mid] > 0,
      `expected positive spread at month ${mid}, got p10=${e.p10[mid]} p90=${e.p90[mid]}`);
  });
});

test("yearly mode + generate_random: monthly path jitters but lands on the per-year targets", () => {
  // Without random: every month is smooth compound.
  // With random: months should wobble, but each year-end value must still
  // equal the deterministic yearly path so the user's chosen yearly targets
  // are respected.
  const perYear = [10, 30, 20, 25, 40, 15, 20, 30, 10, 35];
  const inpFlat = baseInput({
    turkey_inflation_mode: "yearly",
    turkey_inflation_per_year: perYear,
    generate_random: false,
  });
  const inpRand = baseInput({
    turkey_inflation_mode: "yearly",
    turkey_inflation_per_year: perYear,
    generate_random: true,
  });
  withSeed(1234, () => {
    const a = runProjection(inpFlat);
    const b = runProjection(inpRand);
    // House TL ratio = houseUsd * fx — check the underlying TL series via
    // house_usd × dollar_rates which both engines share. Year boundaries
    // align exactly between flat and random.
    for (let y = 0; y <= 10; y++) {
      const flatTl = a.value_of_house_usd_yearly[y] * a.dollar_rates_annual[y];
      const randTl = b.value_of_house_usd_yearly[y] * b.dollar_rates_annual[y];
      assert.ok(Math.abs(flatTl - randTl) / flatTl < 1e-9,
        `year ${y}: TL house ${flatTl} vs ${randTl}`);
    }
    // Monthly path must NOT be byte-identical to the flat version (otherwise
    // there's no jitter — that was the original bug).
    let differs = false;
    for (let m = 1; m < 60; m++) {
      if (Math.abs(b.value_of_house_usd_monthly[m] - a.value_of_house_usd_monthly[m]) > 1e-9) {
        differs = true; break;
      }
    }
    assert.ok(differs, "expected intra-year monthly variation under random + yearly mode");
  });
});

test("Monte Carlo: result still carries the standard fields (back-compat shape)", () => {
  withSeed(1, () => {
    const r = runMonteCarlo(baseInput({ generate_random: true }), 30);
    assert.ok(typeof r.monthly_tl_payment === "number");
    assert.equal(r.years_axis.length, 11);
    assert.equal(r.months_axis.length, 121);
    assert.ok(Array.isArray(r.dollar_rates_annual));
    assert.equal(r.monte_carlo_trials, 30);
  });
});

test("early-payoff scenario: full-horizon series stay populated past loan-end", () => {
  // The model must not truncate house/rent/carry series when the loan ends.
  // Series lengths and finite values at the final index confirm a clean run.
  const r = runProjection(baseInput({ years: 10, loan_term_years: 5 }));
  assert.equal(r.value_of_house_usd_yearly.length, 11);
  assert.equal(r.cumulative_rent_price_usd_yearly.length, 11);
  assert.equal(r.cumulative_ownership_cost_usd_yearly.length, 11);
  assert.ok(Number.isFinite(r.value_of_house_usd_yearly[10]) && r.value_of_house_usd_yearly[10] > 0);
  // Cumulative rent strictly grows year over year (rent is always positive).
  assert.ok(r.cumulative_rent_price_usd_yearly[10] > r.cumulative_rent_price_usd_yearly[5]);
});

// --- Phase 3: real-USD consistency ----------------------------------

test("real-USD toggle keeps dollar_rates nominal but deflates USD series", () => {
  const nominal = runProjection(baseInput({ deflate_dollar_by_us_inflation: false, usa_inflation: 3 }));
  const real = runProjection(baseInput({ deflate_dollar_by_us_inflation: true, usa_inflation: 3 }));
  // The exchange-rate output is nominal either way — the toggle no longer
  // quietly shrinks the FX growth rate.
  assert.ok(Math.abs(nominal.dollar_rates_annual[10] - real.dollar_rates_annual[10]) < 1e-9,
    "dollar_rates_annual must be identical with the toggle on vs off");
  // Every USD series is deflated by the US-CPI factor at its own index.
  const deflator = Math.pow(1.03, 10);
  assert.ok(Math.abs(real.value_of_house_usd_yearly[10] - nominal.value_of_house_usd_yearly[10] / deflator) < 1e-6);
  // At t=0 the deflator is 1, so values match exactly.
  assert.ok(Math.abs(real.value_of_house_usd_yearly[0] - nominal.value_of_house_usd_yearly[0]) < 1e-9);
});

// --- Phase 3: early prepayment --------------------------------------

test("early prepayment cuts the remaining loan and re-amortizes lower", () => {
  const noPre = runProjection(baseInput({ years: 10, loan_term_years: 10 }));
  const withPre = runProjection(baseInput({
    years: 10, loan_term_years: 10,
    prepayment_amount_tl: 200_000, prepayment_year: 3,
  }));
  // Right after the prepayment year the balance is lower.
  assert.ok(withPre.remaining_loan_usd_yearly[3] < noPre.remaining_loan_usd_yearly[3]);
  // Installments after the prepayment shrink (re-amortized over less principal).
  assert.ok(withPre.monthly_payment_usd[48] < noPre.monthly_payment_usd[48]);
  // The lump is counted as cash spent that month — month 36 spikes above a
  // later regular installment.
  assert.ok(withPre.monthly_payment_usd[36] > withPre.monthly_payment_usd[40]);
  // Paying early saves interest, so total nominal TL paid is lower overall.
  assert.ok(withPre.total_paid_tl < noPre.total_paid_tl);
  // The loan still fully amortizes by the end of the term.
  assert.ok(Math.abs(withPre.remaining_loan_usd_monthly[120]) < 1e-6);
});

// --- Phase 3: rent-it-out -------------------------------------------

test("rent-it-out with zero vacancy + tax leaves the rent series unchanged", () => {
  const off = runProjection(baseInput());
  const onZero = runProjection(baseInput({
    rent_it_out: true, vacancy_rate: 0, rental_income_tax_rate: 0,
  }));
  assert.ok(Math.abs(off.rent_price_usd_yearly[5] - onZero.rent_price_usd_yearly[5]) < 1e-9);
  assert.ok(Math.abs(
    off.cumulative_rent_price_usd_yearly.at(-1) - onZero.cumulative_rent_price_usd_yearly.at(-1),
  ) < 1e-9);
});

test("rent-it-out scales the rent series by (1-vacancy)(1-tax)", () => {
  const gross = runProjection(baseInput({
    rent_it_out: true, vacancy_rate: 0, rental_income_tax_rate: 0,
  }));
  const net = runProjection(baseInput({
    rent_it_out: true, vacancy_rate: 20, rental_income_tax_rate: 25,
  }));
  const factor = 0.8 * 0.75; // (1-0.20)·(1-0.25) = 0.60
  for (const y of [1, 5, 10]) {
    assert.ok(Math.abs(net.rent_price_usd_yearly[y] - gross.rent_price_usd_yearly[y] * factor) < 1e-6,
      `year ${y}: net rent should be gross × ${factor}`);
  }
});
