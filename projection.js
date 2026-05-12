// =============================================================
// Pure projection engine — browser port of projection.py
//
// Same outputs as ProjectionResult.to_dict() so the rest of app.js
// (SERIES_MAP, asset_projections, etc.) works unchanged.
// =============================================================

const SUPPORTED_ASSETS = [
  "XAUUSD", "XAGUSD", "BTC", "ETH", "XU100", "XU30", "NASDAQ", "S&P",
];

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
  const raw = Array.from({ length: years }, () => uniform(target * 0.7, target * 1.3));
  const mean = raw.reduce((s, x) => s + x, 0) / years;
  const adjusted = mean !== 0 ? raw.map(r => r * (target / mean)) : raw;
  const path = [initial];
  for (const r of adjusted) path.push(path[path.length - 1] * (1 + r));
  return { path, adjusted };
}

function randomMonthlyPath(initial, years, targetAvgPct) {
  const { path: yearlyPath, adjusted } = randomYearlyPath(initial, years, targetAvgPct);
  const monthly = [initial];
  for (let y = 0; y < years; y++) {
    const yearMul = 1 + adjusted[y];
    const rawM = Array.from({ length: 12 }, () => uniform(0.98, 1.05));
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

// ---------------- intermediate helpers ----------------

function effectiveDollarGrowth(inp) {
  let annualPct = inp.dollar_growth_rate;
  if (inp.deflate_dollar_by_us_inflation) annualPct -= inp.usa_inflation;
  const annual = annualPct / 100;
  const monthly = Math.pow(1 + annual, 1 / 12) - 1;
  return { annual, monthly };
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

  // Loan
  const loan = inp.value_of_house_tl - inp.initial_noncredit_amount_tl;
  const monthlyTlPayment = amortizedMonthlyPayment(loan, inp.interest_rate / 100, nMonths);
  const annualTlPayment = monthlyTlPayment * 12;

  // Effective rates
  const { annual: dollarGrowthAnnual, monthly: dollarGrowthMonthly } = effectiveDollarGrowth(inp);
  const turkeyInflationAnnual = inp.turkey_inflation / 100;
  const turkeyInflationMonthly = Math.pow(1 + turkeyInflationAnnual, 1 / 12) - 1;

  // Dollar rate paths
  let dollarRatesAnnual, dollarRatesMonthly;
  if (inp.generate_random) {
    const r = randomMonthlyPath(inp.start_dollar_tl, inp.years, dollarGrowthAnnual * 100);
    dollarRatesAnnual = r.yearlyPath;
    dollarRatesMonthly = r.monthly;
  } else {
    dollarRatesAnnual = compoundSeries(inp.start_dollar_tl, dollarGrowthAnnual, inp.years);
    dollarRatesMonthly = compoundSeries(inp.start_dollar_tl, dollarGrowthMonthly, nMonths);
  }

  // Payment in USD
  const annualPaymentUsd = dollarRatesAnnual.slice(1).map(r => annualTlPayment / r);
  const monthlyPaymentUsd = dollarRatesMonthly.slice(1).map(r => monthlyTlPayment / r);
  const cumPaymentUsdAnnual = cumsum(annualPaymentUsd);
  const cumPaymentUsdMonthly = cumsum(monthlyPaymentUsd);

  const initialNoncreditUsd = inp.initial_noncredit_amount_tl / inp.start_dollar_tl;
  const totalCreditUsdAnnual = [initialNoncreditUsd, ...cumPaymentUsdAnnual.map(x => x + initialNoncreditUsd)];
  const totalCreditUsdMonthly = [initialNoncreditUsd, ...cumPaymentUsdMonthly.map(x => x + initialNoncreditUsd)];

  // House value
  let houseTlYearly, houseTlMonthly;
  if (inp.generate_random) {
    const r = randomMonthlyPath(inp.value_of_house_tl, inp.years, inp.turkey_inflation);
    houseTlYearly = r.yearlyPath;
    houseTlMonthly = r.monthly;
  } else {
    houseTlYearly = compoundSeries(inp.value_of_house_tl, turkeyInflationAnnual, inp.years);
    houseTlMonthly = compoundSeries(inp.value_of_house_tl, turkeyInflationMonthly, nMonths);
  }
  const houseUsdYearly = div(houseTlYearly, dollarRatesAnnual);
  const houseUsdMonthly = div(houseTlMonthly, dollarRatesMonthly);

  // Rent
  const annualRentTlStart = inp.initial_monthly_rent_tl * 12;
  let rentTlYearly;
  if (inp.generate_random) {
    const r = randomMonthlyPath(annualRentTlStart, inp.years, inp.turkey_inflation);
    rentTlYearly = r.yearlyPath;
  } else {
    rentTlYearly = compoundSeries(annualRentTlStart, turkeyInflationAnnual, inp.years);
  }
  const rentTlMonthly = [];
  for (let i = 0; i < rentTlYearly.length - 1; i++) {
    for (let j = 0; j < 12; j++) rentTlMonthly.push(rentTlYearly[i] / 12);
  }
  rentTlMonthly.push(rentTlYearly[rentTlYearly.length - 1] / 12);

  const rentUsdYearly = div(rentTlYearly, dollarRatesAnnual);
  const rentUsdMonthly = div(rentTlMonthly, dollarRatesMonthly);
  const cumRentUsdYearly = cumsum(rentUsdYearly);
  const cumRentUsdMonthly = cumsum(rentUsdMonthly);
  const housePlusRentYearly = add(houseUsdYearly, cumRentUsdYearly);
  const housePlusRentMonthly = add(houseUsdMonthly, cumRentUsdMonthly);
  const totalCreditMinusRentYearly = sub(totalCreditUsdAnnual, cumRentUsdYearly);
  const totalCreditMinusRentMonthly = sub(totalCreditUsdMonthly, cumRentUsdMonthly);

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
    else if (inp.salary_currency === "TL") salariesUsdYearly = div(sameCurrencyYearly, dollarRatesAnnual);

    salariesUsdMonthly = monthlyFromYearlySalary(
      sameCurrencyYearly, inp.months_to_increase, dollarRatesMonthly, inp.euro_dollar_rate, inp.salary_currency,
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
    total_paid_tl: monthlyTlPayment * nMonths,
    loan_amount_tl: loan,
    initial_noncredit_amount_usd: initialNoncreditUsd,
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
    salaries_usd_yearly: salariesUsdYearly,
    salaries_usd_monthly: salariesUsdMonthly,
    payment_salary_ratio_yearly: paymentSalaryRatioYearly,
    payment_salary_ratio_monthly: paymentSalaryRatioMonthly,
    payment_minus_rent_over_salary_yearly: paymentMinusRentSalaryYearly,
    payment_minus_rent_over_salary_monthly: paymentMinusRentSalaryMonthly,
    asset_projections: assetProjections,
  };
}
