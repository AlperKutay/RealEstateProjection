# Roadmap

Plan for evolving the Real Estate Projection tool from a "kredi vs. yatırım"
calculator into a real buy-vs-rent decision tool. Items are roughly ordered
by impact × effort — pick from the top.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Decision Tool Essentials (high impact, low effort)

Goal: turn the tool from "interesting chart" into "actually helps decide".

- [ ] **Property carrying costs** — emlak vergisi, aidat, DASK, bakım rezervi
  - Add inputs: `annual_property_tax_rate` (% of house value),
    `monthly_hoa_tl`, `annual_dask_tl`, `annual_maintenance_rate` (% of value).
  - Roll them into a new `ownership_costs_usd_{yearly,monthly}` series.
  - Update "Net Total Payment" to include these costs (currently only subtracts rent).
  - Done when: form has the new fields, computed series shows up as an opt-in plot.

- [ ] **Transaction costs** — tapu harcı, komisyon, taşınma, satışta vergi
  - Add `transaction_cost_buy_pct` (default 6%) and `transaction_cost_sell_pct`
    (default 2%) to inputs.
  - Reflect in the initial outlay (one-time at t=0) and in any exit-value
    computation (year-N).
  - Done when: down-payment summary shows "+ X TL kapanış maliyetleri".

- [ ] **Break-even summary card**
  - Compute the first year where `value_of_house_usd + cum_rent_usd >
    total_credit_minus_rent_usd + transaction_costs`. Show "Y. yılda başa
    baş geliyorsunuz" (or "bu vade içinde başa baş gelmiyor").
  - Add to the four-card summary row above the chart.

- [ ] **Tooltips on form fields**
  - Each parameter gets a `?` icon with a 1–2 sentence explanation (e.g.
    "ABD enflasyonu ile düşür" → "Dolar büyüme oranından ABD enflasyonunu
    çıkarır; sonuç reel USD getirisidir.").
  - Add `*_tooltip` keys to `TRANSLATIONS` in `app.js`.

- [ ] **Preset scenarios**
  - "İstanbul 1+1 ortalama", "Lüks", "Konservatif kira", "Yüksek enflasyon".
  - Stored as JSON in a `presets.js`, applied with one click.

---

## Phase 2 — Math Correctness & Honesty

Goal: the numbers we show should be defensible.

- [ ] **Test coverage for `projection.js`**
  - No tests currently. Add a small test harness (Vitest or plain Node-runnable
    asserts) covering:
    - `runProjection` returns expected series lengths.
    - Deterministic dollar/rent paths match analytic compound formula.
    - Random paths' yearly geometric mean ≈ target growth (with seeded RNG).
    - `total_credit_minus_rent` math sanity-check.
  - Done when: 15+ tests covering happy path and edge cases.

- [ ] **Geometric vs arithmetic returns in random paths**
  - `randomYearlyPath` rescales by *arithmetic* mean. For long-horizon
    compounding, the geometric mean is what matches the analytic compound
    series. Write the test first to expose the gap, then fix.

- [ ] **`cum_rent_usd_yearly` alignment**
  - First element currently includes a full year of rent at t=0. This makes
    `total_credit_minus_rent[0] = peşinat − 1_year_rent` which is half a step
    off. Decide on the convention (probably: rent accumulates from year 1
    onward to match `cumulative_payment_usd_annual`) and update.

- [ ] **Monte Carlo / fan chart**
  - When `generate_random=true`, run N (≥500) projections in the browser.
  - Show P10/P50/P90 envelopes instead of a single noisy path.
  - Chart.js can render filled bands; the math is already vectorized.

---

## Phase 3 — Useful Comparisons (domain)

- [ ] **Rent-it-out scenario**
  - Toggle "evi kiraya ver" — assumes the user lives elsewhere, evaluates the
    rental yield + capital gain vs. mortgage cost.
  - Adds `vacancy_rate`, `rental_income_tax_rate`, and reuses house value
    projection.

- [ ] **Early prepayment / refinance**
  - New input: lump-sum extra payment at year X.
  - Recompute amortization with shorter remaining term.

- [ ] **Loan rate change scenario**
  - Variable-rate loan: input a schedule of rates by year.
  - Useful for Turkey's recent rate volatility.

- [ ] **Real-USD consistency**
  - `deflate_dollar_by_us_inflation` only adjusts the dollar growth rate,
    but other USD series (house value, rent) aren't deflated. Make the toggle
    consistent — either deflate everything to real USD, or remove the toggle
    and let the user enter real-USD growth directly.

---

## Phase 4 — UX Polish

- [ ] **Shareable URL state**
  - Serialize `form` + `selectedAssets` + `selectedPlots` to URL hash.
  - Restore on page load. Lets users share scenarios.

- [ ] **Multi-axis or faceted chart**
  - Ratio plots (Payment/Salary) on a secondary y-axis, or split into
    a small-multiple panel below the main chart.
  - Today, putting a 0–1 ratio next to USD figures makes both unreadable.

- [ ] **Plot annotations**
  - Vertical line at "kredi bitiş yılı".
  - Marker at break-even year.

- [ ] **Mobile layout**
  - Current top-layout looks fine on desktop but the 3-col grid stacks
    vertically on mobile → 6 panels tall. Collapse into accordion / tabs.

- [ ] **CSV / PDF export**
  - "Sonuçları indir" → downloads a CSV of all series, or a PDF report
    with chart + summary.

---

## Phase 5 — Code Quality & Ops

- [ ] **CI on GitHub Actions**
  - Lint JS (eslint or just `node --check`), syntax-check HTML, run JS tests
    once Phase 2 lands.

- [ ] **TypeScript for frontend**
  - Add a TS definition for the projection result shape so `_result` isn't
    typed `any`. Optional — only if `app.js` grows.

- [ ] **Magic-number config**
  - `randomYearlyPath` jitter range (0.7..1.3), monthly jitter (0.98..1.05) —
    extract to a constants block.

- [ ] **GH Action to refresh `assets.json`**
  - Optional: weekly cron that hits yfinance (in CI), updates `assets.json`,
    opens a PR. Restores the live-data feature without bringing back a runtime
    backend.

---

## Out of scope (for now)

- Multi-user accounts / saved scenarios on a backend
- Localization beyond TR/EN
- Native mobile app
