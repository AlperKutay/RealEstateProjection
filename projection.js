// =============================================================
// Pure projection engine — browser port of projection.py
//
// Same outputs as ProjectionResult.to_dict() so the rest of app.js
// (SERIES_MAP, asset_projections, etc.) works unchanged.
// =============================================================

const SUPPORTED_ASSETS = [
  "XAUUSD", "XAGUSD", "BTC", "ETH", "XU100", "XU30", "NASDAQ", "S&P",
];

// Tunable constants for the random-path generator.
//   YEARLY_JITTER: each year's growth is sampled uniformly within
//     [target*LO, target*HI] before being rescaled to hit the target.
//   MONTHLY_JITTER: the 12 within-year multipliers are sampled in
//     [LO, HI] then normalized so their product matches the year's.
const YEARLY_JITTER_LO = 0.7;
const YEARLY_JITTER_HI = 1.3;
const MONTHLY_JITTER_LO = 0.98;
const MONTHLY_JITTER_HI = 1.05;

// ---------------- primitives ----------------

function compoundSeries(start, rate, steps) {
  const out = new Array(steps + 1);
  out[0] = start;
  for (let i = 1; i <= steps; i++) out[i] = out[i - 1] * (1 + rate);
  return out;
}

function amortizedMonthlyPayment(principal, monthlyRate, nMonths) {
  if (nMonths <= 0) throw new Error("n_months must be positive");
  if (monthlyRate === 0) return principal / nMonths;
  const factor = Math.pow(1 + monthlyRate, nMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function uniform(a, b) { return a + Math.random() * (b - a); }

function randomYearlyPath(initial, years, targetAvgPct) {
  const target = targetAvgPct / 100;
  const raw = Array.from({ length: years }, () => uniform(target * YEARLY_JITTER_LO, target * YEARLY_JITTER_HI));
  // Rescale so that the *geometric* mean of (1+r_i) equals (1+target).
  // That guarantees prod(1+adjusted_i) = (1+target)^years exactly, so the
  // compounded final value matches the deterministic compound series.
  // The previous version rescaled by arithmetic mean of r_i, which left
  // a volatility-drag gap (final value systematically below target).
  let adjusted;
  const factors = raw.map(r => 1 + r);
  if (factors.every(f => f > 0) && 1 + target > 0) {
    const logSum = factors.reduce((s, f) => s + Math.log(f), 0);
    const geoMean = Math.exp(logSum / years);
    const k = (1 + target) / geoMean;
    adjusted = factors.map(f => f * k - 1);
  } else {
    // Extreme negatives (1+r ≤ 0) — log is undefined. Fall back to the old
    // arithmetic rescale; this path is rarely hit for plausible inputs.
    const mean = raw.reduce((s, x) => s + x, 0) / years;
    adjusted = mean !== 0 ? raw.map(r => r * (target / mean)) : raw;
  }
  const path = [initial];
  for (const r of adjusted) path.push(path[path.length - 1] * (1 + r));
  return { path, adjusted };
}

function randomMonthlyPath(initial, years, targetAvgPct) {
  const { path: yearlyPath, adjusted } = randomYearlyPath(initial, years, targetAvgPct);
  const monthly = [initial];
  for (let y = 0; y < years; y++) {
    const yearMul = 1 + adjusted[y];
    const rawM = Array.from({ length: 12 }, () => uniform(MONTHLY_JITTER_LO, MONTHLY_JITTER_HI));
    const productPow = Math.pow(rawM.reduce((p, x) => p * x, 1), 1 / 12);
    const yearMulPow = Math.pow(yearMul, 1 / 12);
    const norm = rawM.map(x => (x * yearMulPow) / productPow);
    for (let m = 0; m < 12; m++) monthly.push(monthly[monthly.length - 1] * norm[m]);
  }
  return { yearlyPath, adjusted, monthly };
}

// element-wise array helpers (numpy-ish)
const div = (a, b) => a.map((x, i) => x / b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, s) => a.map(x => x * s);
function cumsum(a) {
  const out = new Array(a.length);
  let s = 0;
  for (let i = 0; i < a.length; i++) { s += a[i]; out[i] = s; }
  return out;
}
// Exclusive prefix sum, same length as input. out[0] = 0; out[i] = sum of a[0..i-1].
// Use for "cumulative paid through period i" — at i=0 nothing has been paid yet.
function prefixSum(a) {
  const out = new Array(a.length);
  out[0] = 0;
  for (let i = 1; i < a.length; i++) out[i] = out[i - 1] + a[i - 1];
  return out;
}

// ---------------- intermediate helpers ----------------

// Nominal dollar growth. Real-USD deflation is NOT applied here — when
// `deflate_dollar_by_us_inflation` is on we instead deflate every USD-
// denominated output series consistently (see `fxConv*` in runProjection),
// rather than quietly shrinking the FX growth rate.
function effectiveDollarGrowth(inp) {
  const annual = inp.dollar_growth_rate / 100;
  const monthly = Math.pow(1 + annual, 1 / 12) - 1;
  return { annual, monthly };
}

// Build annual + monthly compound paths for a value starting at `start` and
// growing each year. Supports three modes:
//   - flat:   single annual percent (back-compat with the original engine)
//   - yearly: per-year array of percents (the new rate-editor mode)
//   - random: deterministic flat path replaced by randomMonthlyPath when
//             allowRandom + inp.generate_random
// Always returns { annual: length years+1, monthly: length years*12+1,
// annualMean, monthlyMean } so downstream USD-conversion code stays uniform.
function buildCompoundPaths(start, inp, opts) {
  const { mode, perYear, flatPct, allowRandom } = opts;
  if (mode === "yearly" && Array.isArray(perYear) && perYear.length === inp.years) {
    const annual = [start];
    for (const r of perYear) annual.push(annual[annual.length - 1] * (1 + r / 100));
    const monthly = [start];
    if (allowRandom && inp.generate_random) {
      // Yearly target locked from the per-year array, but jitter the 12
      // monthly multipliers within each year so the path looks like a
      // realistic random walk (anchors back to the year-end value).
      for (let y = 0; y < inp.years; y++) {
        const yearMul = 1 + perYear[y] / 100;
        const rawM = Array.from({ length: 12 }, () => uniform(MONTHLY_JITTER_LO, MONTHLY_JITTER_HI));
        const productPow = Math.pow(rawM.reduce((p, x) => p * x, 1), 1 / 12);
        const yearMulPow = Math.pow(yearMul, 1 / 12);
        const norm = rawM.map((x) => (x * yearMulPow) / productPow);
        for (let m = 0; m < 12; m++) monthly.push(monthly[monthly.length - 1] * norm[m]);
      }
    } else {
      for (let y = 0; y < inp.years; y++) {
        const mRate = Math.pow(1 + perYear[y] / 100, 1 / 12) - 1;
        for (let m = 0; m < 12; m++) monthly.push(monthly[monthly.length - 1] * (1 + mRate));
      }
    }
    const totalMul = annual[annual.length - 1] / start;
    const annualMean = Math.pow(totalMul, 1 / inp.years) - 1;
    const monthlyMean = Math.pow(1 + annualMean, 1 / 12) - 1;
    return { annual, monthly, annualMean, monthlyMean };
  }
  const annualPct = (flatPct ?? 0) / 100;
  const monthlyRate = Math.pow(1 + annualPct, 1 / 12) - 1;
  if (allowRandom && inp.generate_random) {
    const r = randomMonthlyPath(start, inp.years, flatPct ?? 0);
    return { annual: r.yearlyPath, monthly: r.monthly, annualMean: annualPct, monthlyMean: monthlyRate };
  }
  return {
    annual: compoundSeries(start, annualPct, inp.years),
    monthly: compoundSeries(start, monthlyRate, inp.years * 12),
    annualMean: annualPct,
    monthlyMean: monthlyRate,
  };
}

function monthlyFromYearlySalary(yearlyArr, monthsToIncrease, dollarRatesMonthly, euroDollarRate, salaryCurrency) {
  const monthly = [];
  for (let i = 0; i < monthsToIncrease; i++) monthly.push(yearlyArr[0] / 12);
  for (let i = 1; i < yearlyArr.length - 1; i++) {
    for (let j = 0; j < 12; j++) monthly.push(yearlyArr[i] / 12);
  }
  for (let i = 0; i < 13 - monthsToIncrease; i++) monthly.push(yearlyArr[yearlyArr.length - 1] / 12);

  if (salaryCurrency === "EUR") return monthly.map(x => x * euroDollarRate);
  if (salaryCurrency === "USD") return monthly;
  if (salaryCurrency === "TL") {
    const m = Math.min(monthly.length, dollarRatesMonthly.length);
    return monthly.slice(0, m).map((x, i) => x / dollarRatesMonthly[i]);
  }
  throw new Error(`unknown salary currency: ${salaryCurrency}`);
}

function projectAsset(asset, inp) {
  const startPrice = inp.project_initial_money_with_asset
    ? inp.initial_noncredit_amount_tl / inp.start_dollar_tl
    : asset.current_price;
  const growthPct = asset.average_growth;
  if (inp.generate_random) {
    const { yearlyPath, monthly } = randomMonthlyPath(startPrice, inp.years, growthPct);
    return { yearly: yearlyPath, monthly };
  }
  const yearly = compoundSeries(startPrice, growthPct / 100, inp.years);
  const monthlyRate = Math.pow(1 + growthPct / 100, 1 / 12) - 1;
  const monthly = compoundSeries(startPrice, monthlyRate, inp.years * 12);
  return { yearly, monthly };
}

// ---------------- main entry ----------------

function runProjection(inp) {
  const nMonths = inp.years * 12;

  // Loan term can be shorter than the projection horizon. After the loan
  // is paid off the borrower stops paying (monthly payment drops to 0) but
  // the rest of the model (house value, rent, carry, salary, assets) keeps
  // running until the horizon. loan_term_years defaults to years for
  // backward compatibility.
  const loanTermYears = Math.max(1, Math.min(inp.years, inp.loan_term_years ?? inp.years));
  const loanMonths = loanTermYears * 12;

  // Loan
  const loan = inp.value_of_house_tl - inp.initial_noncredit_amount_tl;

  // Early prepayment: an optional lump sum paid on a year boundary. It is
  // applied to the balance *before* that year's re-amortization, so it lowers
  // every later installment (it shortens cost, not the term). The amount is
  // folded back into monthlyPaymentTlArr after the balance series is built, so
  // total_paid_tl and the USD outlay series count it as cash spent that month.
  const prepayAmtReq = Math.max(0, inp.prepayment_amount_tl ?? 0);
  const prepayMonth = prepayAmtReq > 0 ? Math.round(inp.prepayment_year ?? 0) * 12 : -1;
  const prepayActive = prepayMonth > 0 && prepayMonth < loanMonths;
  let prepayApplied = 0; // actual reduction, capped at the outstanding balance

  // Variable interest rate: each year may carry a different monthly rate.
  // At every year boundary the payment is recomputed using the current
  // balance, remaining months, and that year's rate (matches how Turkish
  // variable-rate mortgages reset on the anniversary).
  const interestPerYear =
    inp.interest_rate_mode === "yearly" &&
    Array.isArray(inp.interest_rate_per_year) &&
    inp.interest_rate_per_year.length === loanTermYears
      ? inp.interest_rate_per_year
      : null;
  const monthlyRateAt = (m) => {
    if (!interestPerYear) return (inp.interest_rate ?? 0) / 100;
    const y = Math.min(loanTermYears - 1, Math.floor(m / 12));
    return (interestPerYear[y] ?? 0) / 100;
  };

  // Per-month payment array: 0 outside the loan period; within, payment is
  // re-amortized at each year boundary.
  const monthlyPaymentTlArr = new Array(nMonths).fill(0);
  let balance = loan;
  let firstMonthPayment = 0;
  for (let m = 0; m < loanMonths; m++) {
    if (m % 12 === 0) {
      if (prepayActive && m === prepayMonth) {
        prepayApplied = Math.min(prepayAmtReq, balance);
        balance -= prepayApplied;
      }
      const r = monthlyRateAt(m);
      const remMonths = loanMonths - m;
      const newPayment = amortizedMonthlyPayment(balance, r, remMonths);
      if (m === 0) firstMonthPayment = newPayment;
      for (let mm = m; mm < m + 12 && mm < loanMonths; mm++) {
        monthlyPaymentTlArr[mm] = newPayment;
      }
    }
    const r = monthlyRateAt(m);
    const interest = balance * r;
    const principal = monthlyPaymentTlArr[m] - interest;
    balance = Math.max(0, balance - principal);
  }
  const monthlyTlPayment = firstMonthPayment;
  const annualTlPayment = monthlyTlPayment * 12;

  // ---- Dollar growth (flat or per-year) — always nominal here.
  const dollarPerYear =
    inp.dollar_growth_mode === "yearly" &&
    Array.isArray(inp.dollar_growth_per_year) &&
    inp.dollar_growth_per_year.length === inp.years
      ? inp.dollar_growth_per_year
      : null;

  let dollarRatesAnnual, dollarRatesMonthly, dollarGrowthAnnual, dollarGrowthMonthly;
  if (dollarPerYear) {
    const dp = buildCompoundPaths(inp.start_dollar_tl, inp, {
      mode: "yearly", perYear: dollarPerYear, flatPct: 0, allowRandom: true,
    });
    dollarRatesAnnual = dp.annual;
    dollarRatesMonthly = dp.monthly;
    dollarGrowthAnnual = dp.annualMean;
    dollarGrowthMonthly = dp.monthlyMean;
  } else {
    const eff = effectiveDollarGrowth(inp);
    dollarGrowthAnnual = eff.annual;
    dollarGrowthMonthly = eff.monthly;
    if (inp.generate_random) {
      const r = randomMonthlyPath(inp.start_dollar_tl, inp.years, dollarGrowthAnnual * 100);
      dollarRatesAnnual = r.yearlyPath;
      dollarRatesMonthly = r.monthly;
    } else {
      dollarRatesAnnual = compoundSeries(inp.start_dollar_tl, dollarGrowthAnnual, inp.years);
      dollarRatesMonthly = compoundSeries(inp.start_dollar_tl, dollarGrowthMonthly, nMonths);
    }
  }

  // ---- Turkey inflation (flat or per-year)
  const trPerYear =
    inp.turkey_inflation_mode === "yearly" &&
    Array.isArray(inp.turkey_inflation_per_year) &&
    inp.turkey_inflation_per_year.length === inp.years
      ? inp.turkey_inflation_per_year
      : null;
  const trMode = trPerYear ? "yearly" : "flat";
  // Effective scalar TR inflation — geometric mean when per-year, flat otherwise.
  let turkeyInflationAnnual, turkeyInflationMonthly;
  if (trPerYear) {
    const mul = trPerYear.reduce((p, r) => p * (1 + r / 100), 1);
    turkeyInflationAnnual = Math.pow(mul, 1 / inp.years) - 1;
  } else {
    turkeyInflationAnnual = (inp.turkey_inflation ?? 0) / 100;
  }
  turkeyInflationMonthly = Math.pow(1 + turkeyInflationAnnual, 1 / 12) - 1;

  // ---- Real-USD conversion rate.
  // `dollar_rates_*` stay nominal (TL/USD) for output. For TL→USD conversion
  // we use `fxConv*` instead: when `deflate_dollar_by_us_inflation` is on it
  // is the nominal rate multiplied by the US-CPI deflator, so dividing TL by
  // it yields *real* (today's-purchasing-power) USD. Real USD = TL / nominalFX
  // / (1+usInf)^t = TL / (nominalFX·(1+usInf)^t). The deflator is 1 at t=0, so
  // every USD series stays consistent and the toggle now means one thing.
  const usInfAnnual = inp.deflate_dollar_by_us_inflation ? (inp.usa_inflation ?? 0) / 100 : 0;
  const usInfMonthly = Math.pow(1 + usInfAnnual, 1 / 12) - 1;
  const fxConvAnnual = inp.deflate_dollar_by_us_inflation
    ? dollarRatesAnnual.map((fx, y) => fx * Math.pow(1 + usInfAnnual, y))
    : dollarRatesAnnual;
  const fxConvMonthly = inp.deflate_dollar_by_us_inflation
    ? dollarRatesMonthly.map((fx, m) => fx * Math.pow(1 + usInfMonthly, m))
    : dollarRatesMonthly;

  // Remaining loan balance per month (standard amortization), nominal TL.
  // Uses the per-month rate (constant in flat mode, year-step in yearly mode)
  // and the per-month regular payment built above. After loan_months the
  // balance stays exactly 0. The prepayment lump lands on its year boundary,
  // mirroring the payment-building loop, so the two stay consistent.
  const remainingLoanTlMonthly = new Array(nMonths + 1);
  remainingLoanTlMonthly[0] = loan;
  for (let m = 1; m <= nMonths; m++) {
    if (m <= loanMonths) {
      const r = monthlyRateAt(m - 1);
      const interest = remainingLoanTlMonthly[m - 1] * r;
      const principalPart = monthlyPaymentTlArr[m - 1] - interest;
      remainingLoanTlMonthly[m] = Math.max(0, remainingLoanTlMonthly[m - 1] - principalPart);
    } else {
      remainingLoanTlMonthly[m] = 0;
    }
    if (prepayActive && m === prepayMonth) {
      remainingLoanTlMonthly[m] = Math.max(0, remainingLoanTlMonthly[m] - prepayApplied);
    }
  }
  const remainingLoanTlYearly = Array.from({ length: inp.years + 1 }, (_, y) => remainingLoanTlMonthly[y * 12]);
  const remainingLoanUsdMonthly = div(remainingLoanTlMonthly, fxConvMonthly);
  const remainingLoanUsdYearly = div(remainingLoanTlYearly, fxConvAnnual);

  // Fold the prepayment lump into the payment array now that the balance
  // series is built — so total_paid_tl and every USD payment/outlay series
  // count it as cash actually spent in the prepayment month.
  if (prepayActive) monthlyPaymentTlArr[prepayMonth] += prepayApplied;

  // Payment in USD — zero after the loan is paid off.
  const monthlyPaymentUsd = monthlyPaymentTlArr.map((p, i) => p / fxConvMonthly[i + 1]);
  // Annual TL payment for year y is the sum of that year's 12 monthly payments
  // (so the partial year when the loan ends gets a partial amount).
  const annualPaymentUsd = Array.from({ length: inp.years }, (_, y) => {
    let tlSum = 0;
    for (let m = y * 12; m < (y + 1) * 12; m++) tlSum += monthlyPaymentTlArr[m];
    return tlSum / fxConvAnnual[y + 1];
  });
  const cumPaymentUsdAnnual = cumsum(annualPaymentUsd);
  const cumPaymentUsdMonthly = cumsum(monthlyPaymentUsd);

  const initialNoncreditUsd = inp.initial_noncredit_amount_tl / inp.start_dollar_tl;
  // One-time closing cost on purchase (tapu harcı + komisyon + taşınma):
  // folded into the t=0 outlay so all downstream "cost of ownership" series include it.
  const buyTxTl = inp.value_of_house_tl * ((inp.transaction_cost_buy_pct ?? 0) / 100);
  const buyTxUsd = buyTxTl / inp.start_dollar_tl;
  const initialOutlayUsd = initialNoncreditUsd + buyTxUsd;
  const totalCreditUsdMonthly = [initialOutlayUsd, ...cumPaymentUsdMonthly.map(x => x + initialOutlayUsd)];
  // Yearly cumulative outlay sampled from monthly so per-month FX averages are
  // preserved (yearly-only USD conversion overestimates dollar value of early
  // payments because it uses the year-start rate for the whole year).
  const totalCreditUsdAnnual = Array.from(
    { length: inp.years + 1 }, (_, y) => totalCreditUsdMonthly[y * 12],
  );

  // House value — grows by TR inflation (flat scalar, per-year array, or random walk).
  const houseTlPaths = buildCompoundPaths(inp.value_of_house_tl, inp, {
    mode: trMode, perYear: trPerYear,
    flatPct: inp.turkey_inflation ?? 0, allowRandom: true,
  });
  const houseTlYearly = houseTlPaths.annual;
  const houseTlMonthly = houseTlPaths.monthly;
  const houseUsdYearly = div(houseTlYearly, fxConvAnnual);
  const houseUsdMonthly = div(houseTlMonthly, fxConvMonthly);

  // Selling cost (komisyon + masraflar) — what the seller pays at exit.
  // Net sale value = house_value × (1 − sell_pct).
  const sellPct = (inp.transaction_cost_sell_pct ?? 0) / 100;
  const sellTxUsdYearly = houseUsdYearly.map(h => h * sellPct);
  const sellTxUsdMonthly = houseUsdMonthly.map(h => h * sellPct);
  const netSaleValueUsdYearly = houseUsdYearly.map(h => h * (1 - sellPct));
  const netSaleValueUsdMonthly = houseUsdMonthly.map(h => h * (1 - sellPct));

  // Rent — annual starting figure grows by the same TR-inflation path as the
  // house, supporting flat / per-year / random just like house value.
  const annualRentTlStart = inp.initial_monthly_rent_tl * 12;
  const rentTlPaths = buildCompoundPaths(annualRentTlStart, inp, {
    mode: trMode, perYear: trPerYear,
    flatPct: inp.turkey_inflation ?? 0, allowRandom: true,
  });
  const rentTlYearly = rentTlPaths.annual;
  const rentTlMonthly = [];
  for (let i = 0; i < rentTlYearly.length - 1; i++) {
    for (let j = 0; j < 12; j++) rentTlMonthly.push(rentTlYearly[i] / 12);
  }
  rentTlMonthly.push(rentTlYearly[rentTlYearly.length - 1] / 12);

  // Rent-it-out: when the buyer lets the property instead of living in it,
  // the rent line stops being "rent you avoid paying" and becomes "net rental
  // income you receive" — gross rent reduced by vacancy and income tax. The
  // factor is 1 in the normal live-in case, so every downstream series
  // (cum_rent, total_credit_minus_rent, net_buy_position, breakeven) is
  // unchanged unless `rent_it_out` is on.
  const rentalNetFactor = inp.rent_it_out
    ? Math.max(0, 1 - (inp.vacancy_rate ?? 0) / 100) *
      Math.max(0, 1 - (inp.rental_income_tax_rate ?? 0) / 100)
    : 1;
  const rentUsdYearly = div(rentTlYearly, fxConvAnnual).map(x => x * rentalNetFactor);
  const rentUsdMonthly = div(rentTlMonthly, fxConvMonthly).map(x => x * rentalNetFactor);
  // prefixSum so that cumRent[i] = rent paid through period i, with [0] = 0.
  // Yearly sampled from monthly for cross-resolution consistency.
  const cumRentUsdMonthly = prefixSum(rentUsdMonthly);
  const cumRentUsdYearly = Array.from(
    { length: inp.years + 1 }, (_, y) => cumRentUsdMonthly[y * 12],
  );
  const housePlusRentYearly = add(houseUsdYearly, cumRentUsdYearly);
  const housePlusRentMonthly = add(houseUsdMonthly, cumRentUsdMonthly);

  // Property carrying costs: property tax + HOA + DASK + maintenance
  // Property tax & maintenance scale with house value; HOA & DASK with inflation.
  const propTaxRate = (inp.annual_property_tax_rate ?? 0) / 100;
  const maintRate = (inp.annual_maintenance_rate ?? 0) / 100;
  const hoaTlYearly = compoundSeries((inp.monthly_hoa_tl ?? 0) * 12, turkeyInflationAnnual, inp.years);
  const daskTlYearly = compoundSeries(inp.annual_dask_tl ?? 0, turkeyInflationAnnual, inp.years);
  const carryingTlYearly = houseTlYearly.map((h, i) =>
    h * propTaxRate + h * maintRate + hoaTlYearly[i] + daskTlYearly[i],
  );
  const carryingTlMonthly = [];
  for (let i = 0; i < carryingTlYearly.length - 1; i++) {
    for (let j = 0; j < 12; j++) carryingTlMonthly.push(carryingTlYearly[i] / 12);
  }
  carryingTlMonthly.push(carryingTlYearly[carryingTlYearly.length - 1] / 12);
  const carryingUsdYearly = div(carryingTlYearly, fxConvAnnual);
  const carryingUsdMonthly = div(carryingTlMonthly, fxConvMonthly);
  const cumCarryingUsdMonthly = prefixSum(carryingUsdMonthly);
  const cumCarryingUsdYearly = Array.from(
    { length: inp.years + 1 }, (_, y) => cumCarryingUsdMonthly[y * 12],
  );

  // Net ownership cost = (down + paid + carrying) − rent saved
  const totalCreditMinusRentYearly = sub(
    add(totalCreditUsdAnnual, cumCarryingUsdYearly),
    cumRentUsdYearly,
  );
  const totalCreditMinusRentMonthly = sub(
    add(totalCreditUsdMonthly, cumCarryingUsdMonthly),
    cumRentUsdMonthly,
  );

  // Salary
  let salariesUsdYearly = null, salariesUsdMonthly = null;
  let paymentSalaryRatioYearly = null, paymentSalaryRatioMonthly = null;
  let paymentMinusRentSalaryYearly = null, paymentMinusRentSalaryMonthly = null;

  if (inp.start_salary_base > 0) {
    let sameCurrencyYearly;
    if (inp.generate_random) {
      const r = randomYearlyPath(inp.start_salary_base, inp.years, inp.salary_growth);
      sameCurrencyYearly = r.path;
    } else {
      sameCurrencyYearly = compoundSeries(inp.start_salary_base, inp.salary_growth / 100, inp.years);
    }

    if (inp.salary_currency === "EUR") salariesUsdYearly = scale(sameCurrencyYearly, inp.euro_dollar_rate);
    else if (inp.salary_currency === "USD") salariesUsdYearly = [...sameCurrencyYearly];
    else if (inp.salary_currency === "TL") salariesUsdYearly = div(sameCurrencyYearly, fxConvAnnual);

    salariesUsdMonthly = monthlyFromYearlySalary(
      sameCurrencyYearly, inp.months_to_increase, fxConvMonthly, inp.euro_dollar_rate, inp.salary_currency,
    );

    const salY = salariesUsdYearly.slice(1);
    paymentSalaryRatioYearly = annualPaymentUsd.map((p, i) => p / salY[i]);
    paymentMinusRentSalaryYearly = annualPaymentUsd.map((p, i) => (p - rentUsdYearly[i + 1]) / salY[i]);

    const salM = salariesUsdMonthly.slice(0, nMonths);
    const len = Math.min(monthlyPaymentUsd.length, salM.length);
    paymentSalaryRatioMonthly = Array.from({ length: len }, (_, i) => monthlyPaymentUsd[i] / salM[i]);
    paymentMinusRentSalaryMonthly = Array.from(
      { length: len },
      (_, i) => (monthlyPaymentUsd[i] - rentUsdMonthly[i + 1]) / salM[i],
    );
  }

  // Net position from buying vs renting at month m, assuming you sold today:
  //   (sale proceeds − remaining loan) − net cash spent vs renting
  // Positive → buying has paid off. Break-even is the first month it crosses 0.
  const netBuyPositionMonthly = netSaleValueUsdMonthly.map(
    (sv, i) => sv - remainingLoanUsdMonthly[i] - totalCreditMinusRentMonthly[i],
  );
  const netBuyPositionYearly = netSaleValueUsdYearly.map(
    (sv, i) => sv - remainingLoanUsdYearly[i] - totalCreditMinusRentYearly[i],
  );
  let breakevenMonth = null;
  for (let m = 1; m < netBuyPositionMonthly.length; m++) {
    if (netBuyPositionMonthly[m] >= 0) {
      breakevenMonth = m;
      break;
    }
  }

  // Assets
  const assetProjections = {};
  for (const [symbol, params] of Object.entries(inp.assets || {})) {
    const { yearly, monthly } = projectAsset(params, inp);
    assetProjections[symbol] = {
      yearly, monthly,
      average_growth: params.average_growth,
      current_price: params.current_price,
    };
  }

  return {
    monthly_tl_payment: monthlyTlPayment,
    annual_tl_payment: annualTlPayment,
    total_paid_tl: monthlyPaymentTlArr.reduce((s, x) => s + x, 0),
    loan_amount_tl: loan,
    initial_noncredit_amount_usd: initialNoncreditUsd,
    buy_transaction_cost_tl: buyTxTl,
    buy_transaction_cost_usd: buyTxUsd,
    value_of_house_usd: inp.value_of_house_tl / inp.start_dollar_tl,
    effective_dollar_growth_annual: dollarGrowthAnnual,
    effective_dollar_growth_monthly: dollarGrowthMonthly,
    effective_turkey_inflation_annual: turkeyInflationAnnual,
    effective_turkey_inflation_monthly: turkeyInflationMonthly,
    years_axis: Array.from({ length: inp.years + 1 }, (_, i) => i),
    months_axis: Array.from({ length: nMonths + 1 }, (_, i) => i),
    dollar_rates_annual: dollarRatesAnnual,
    dollar_rates_monthly: dollarRatesMonthly,
    annual_payment_usd: annualPaymentUsd,
    monthly_payment_usd: monthlyPaymentUsd,
    cumulative_payment_usd_annual: cumPaymentUsdAnnual,
    cumulative_payment_usd_monthly: cumPaymentUsdMonthly,
    total_credit_amount_usd_annual: totalCreditUsdAnnual,
    total_credit_amount_usd_monthly: totalCreditUsdMonthly,
    value_of_house_usd_yearly: houseUsdYearly,
    value_of_house_usd_monthly: houseUsdMonthly,
    rent_price_usd_yearly: rentUsdYearly,
    rent_price_usd_monthly: rentUsdMonthly,
    cumulative_rent_price_usd_yearly: cumRentUsdYearly,
    cumulative_rent_price_usd_monthly: cumRentUsdMonthly,
    house_plus_rent_yearly: housePlusRentYearly,
    house_plus_rent_monthly: housePlusRentMonthly,
    total_credit_minus_rent_usd_yearly: totalCreditMinusRentYearly,
    total_credit_minus_rent_usd_monthly: totalCreditMinusRentMonthly,
    ownership_cost_usd_yearly: carryingUsdYearly,
    ownership_cost_usd_monthly: carryingUsdMonthly,
    cumulative_ownership_cost_usd_yearly: cumCarryingUsdYearly,
    cumulative_ownership_cost_usd_monthly: cumCarryingUsdMonthly,
    sell_transaction_cost_usd_yearly: sellTxUsdYearly,
    sell_transaction_cost_usd_monthly: sellTxUsdMonthly,
    net_sale_value_usd_yearly: netSaleValueUsdYearly,
    net_sale_value_usd_monthly: netSaleValueUsdMonthly,
    remaining_loan_usd_yearly: remainingLoanUsdYearly,
    remaining_loan_usd_monthly: remainingLoanUsdMonthly,
    net_buy_position_usd_yearly: netBuyPositionYearly,
    net_buy_position_usd_monthly: netBuyPositionMonthly,
    breakeven_month: breakevenMonth,
    salaries_usd_yearly: salariesUsdYearly,
    salaries_usd_monthly: salariesUsdMonthly,
    payment_salary_ratio_yearly: paymentSalaryRatioYearly,
    payment_salary_ratio_monthly: paymentSalaryRatioMonthly,
    payment_minus_rent_over_salary_yearly: paymentMinusRentSalaryYearly,
    payment_minus_rent_over_salary_monthly: paymentMinusRentSalaryMonthly,
    asset_projections: assetProjections,
  };
}

// ----- Monte Carlo wrapper -----------------------------------------
// When generate_random is on, instead of giving the user a single noisy
// path we run the projection N times and produce a P10/P50/P90 envelope
// per period for the series the UI plots. Engine output is the same shape
// as runProjection (so back-compat callers still work) plus a new
// `envelopes` field keyed by series name.

const MC_SERIES_KEYS = [
  "dollar_rates_annual", "dollar_rates_monthly",
  "value_of_house_usd_yearly", "value_of_house_usd_monthly",
  "rent_price_usd_yearly", "rent_price_usd_monthly",
  "cumulative_rent_price_usd_yearly", "cumulative_rent_price_usd_monthly",
  "total_credit_amount_usd_annual", "total_credit_amount_usd_monthly",
  "house_plus_rent_yearly", "house_plus_rent_monthly",
  "total_credit_minus_rent_usd_yearly", "total_credit_minus_rent_usd_monthly",
  "annual_payment_usd", "monthly_payment_usd",
  "net_buy_position_usd_yearly", "net_buy_position_usd_monthly",
  "remaining_loan_usd_yearly", "remaining_loan_usd_monthly",
  "payment_salary_ratio_yearly", "payment_salary_ratio_monthly",
  "payment_minus_rent_over_salary_yearly", "payment_minus_rent_over_salary_monthly",
];

function pickPercentile(sorted, pct) {
  // sorted[] is ascending; pct in (0, 1). Linear pick — good enough.
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * pct)));
  return sorted[idx];
}

function runMonteCarlo(inp, n = 400) {
  const trials = Math.max(2, n | 0);
  // Force random mode so each call samples a different path even if the
  // caller forgot to flip the flag.
  const monteInput = { ...inp, generate_random: true };
  const runs = new Array(trials);
  for (let i = 0; i < trials; i++) runs[i] = runProjection(monteInput);

  // Representative run = the one whose final FX is the median across trials.
  const finalFx = runs.map((r) => r.dollar_rates_annual.at(-1));
  const sortIdx = finalFx
    .map((v, i) => [v, i])
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i);
  const medianRun = runs[sortIdx[Math.floor(trials / 2)]];

  const envelopes = {};
  for (const key of MC_SERIES_KEYS) {
    const sample = medianRun[key];
    if (!Array.isArray(sample) || !sample.length) continue;
    const len = sample.length;
    const p10 = new Array(len);
    const p50 = new Array(len);
    const p90 = new Array(len);
    const column = new Array(trials);
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < trials; j++) {
        const arr = runs[j][key];
        column[j] = arr ? arr[i] : 0;
      }
      column.sort((a, b) => a - b);
      p10[i] = pickPercentile(column, 0.10);
      p50[i] = pickPercentile(column, 0.50);
      p90[i] = pickPercentile(column, 0.90);
    }
    envelopes[key] = { p10, p50, p90 };
  }

  return { ...medianRun, envelopes, monte_carlo_trials: trials };
}
