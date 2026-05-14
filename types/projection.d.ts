/**
 * Type definitions for the projection engine result shape.
 *
 * OPTIONAL DEVELOPER AID — nothing in the app loads or compiles this file.
 * The app has no build step (CDN + in-browser Babel; see CLAUDE.md). This
 * `.d.ts` exists purely so editors / a future TS migration can stop typing
 * `_result` as `any`. It mirrors the object literal returned by
 * `runProjection` (and the extra fields added by `runMonteCarlo`) in
 * `projection.js`. If you change that return object, update this file too.
 *
 * Conventions (see CLAUDE.md "Math conventions"):
 *  - `*_axis` and `dollar_rates_*` arrays have length `years + 1` /
 *    `years*12 + 1`. Payment arrays have length `years` / `years*12`.
 *  - Salary-derived fields are `null` unless a salary was supplied.
 *  - `breakeven_month` is `null` when buying never breaks even in term.
 */

/** A numeric time series. Length depends on the field (see header). */
export type Series = number[];

/** Per-period P10/P50/P90 band, produced by Monte Carlo mode. */
export interface Envelope {
  p10: Series;
  p50: Series;
  p90: Series;
}

/** One entry in `asset_projections`, keyed by asset symbol. */
export interface AssetProjection {
  /** USD value of the asset over time, yearly resolution (length years+1). */
  yearly: Series;
  /** USD value of the asset over time, monthly resolution (length years*12+1). */
  monthly: Series;
  /** Yearly average growth %, echoed from the input asset params. */
  average_growth: number;
  /** Current USD price, echoed from the input asset params. */
  current_price: number;
}

/** Result object returned by `window.runProjection(input)`. */
export interface ProjectionResult {
  // --- Loan / up-front (scalars, TRY or USD as named) ---
  /** First-month TRY payment (the amortization anchor). */
  monthly_tl_payment: number;
  /** `monthly_tl_payment * 12`. */
  annual_tl_payment: number;
  /** Sum of every monthly TRY payment over the full term. */
  total_paid_tl: number;
  /** Financed principal in TRY. */
  loan_amount_tl: number;
  /** Down payment / non-credit cash, converted to USD at t=0. */
  initial_noncredit_amount_usd: number;
  /** Buy-side transaction cost (tapu, komisyon, …) in TRY. */
  buy_transaction_cost_tl: number;
  /** Buy-side transaction cost in USD. */
  buy_transaction_cost_usd: number;
  /** House value at t=0 in USD. */
  value_of_house_usd: number;

  // --- Effective rates (after deflation toggles), as fractions or % per engine ---
  effective_dollar_growth_annual: number;
  effective_dollar_growth_monthly: number;
  effective_turkey_inflation_annual: number;
  effective_turkey_inflation_monthly: number;

  // --- Axes ---
  /** `[0, 1, …, years]`. */
  years_axis: Series;
  /** `[0, 1, …, years*12]`. */
  months_axis: Series;

  // --- FX path ---
  /** TRY-per-USD path, length years+1. */
  dollar_rates_annual: Series;
  /** TRY-per-USD path, length years*12+1. */
  dollar_rates_monthly: Series;

  // --- Payments in USD ---
  annual_payment_usd: Series;
  monthly_payment_usd: Series;
  cumulative_payment_usd_annual: Series;
  cumulative_payment_usd_monthly: Series;
  /** Cumulative loan outlay incl. up-front costs, USD. */
  total_credit_amount_usd_annual: Series;
  total_credit_amount_usd_monthly: Series;

  // --- House value (USD) ---
  value_of_house_usd_yearly: Series;
  value_of_house_usd_monthly: Series;

  // --- Rent (USD) ---
  rent_price_usd_yearly: Series;
  rent_price_usd_monthly: Series;
  cumulative_rent_price_usd_yearly: Series;
  cumulative_rent_price_usd_monthly: Series;

  // --- Combined / comparative series (USD) ---
  house_plus_rent_yearly: Series;
  house_plus_rent_monthly: Series;
  /** Net cash spent buying vs renting (incl. carrying costs), USD. */
  total_credit_minus_rent_usd_yearly: Series;
  total_credit_minus_rent_usd_monthly: Series;

  // --- Carrying / ownership costs (USD) ---
  ownership_cost_usd_yearly: Series;
  ownership_cost_usd_monthly: Series;
  cumulative_ownership_cost_usd_yearly: Series;
  cumulative_ownership_cost_usd_monthly: Series;

  // --- Sale-side (USD) ---
  sell_transaction_cost_usd_yearly: Series;
  sell_transaction_cost_usd_monthly: Series;
  net_sale_value_usd_yearly: Series;
  net_sale_value_usd_monthly: Series;
  remaining_loan_usd_yearly: Series;
  remaining_loan_usd_monthly: Series;

  // --- Break-even ---
  /** Net position from buying vs renting if sold at month m, USD. */
  net_buy_position_usd_yearly: Series;
  net_buy_position_usd_monthly: Series;
  /** First month `net_buy_position` crosses >= 0, or `null` if never in term. */
  breakeven_month: number | null;

  // --- Salary-derived (null unless a salary was supplied) ---
  salaries_usd_yearly: Series | null;
  salaries_usd_monthly: Series | null;
  payment_salary_ratio_yearly: Series | null;
  payment_salary_ratio_monthly: Series | null;
  payment_minus_rent_over_salary_yearly: Series | null;
  payment_minus_rent_over_salary_monthly: Series | null;

  // --- Assets ---
  /** Map of asset symbol -> projected value series. Empty if no assets selected. */
  asset_projections: Record<string, AssetProjection>;
}

/**
 * Result returned by `runMonteCarlo(input, n)`. It is a representative
 * (median-FX) `ProjectionResult` plus per-series P10/P50/P90 envelopes and
 * the trial count. `envelopes` is keyed by series field name (a subset of
 * the array fields above — see `MC_SERIES_KEYS` in projection.js).
 */
export interface MonteCarloResult extends ProjectionResult {
  envelopes: Record<string, Envelope>;
  monte_carlo_trials: number;
}
