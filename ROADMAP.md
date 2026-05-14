# Roadmap

Plan for evolving the Real Estate Projection tool from a "kredi vs. yatırım"
calculator into a real buy-vs-rent decision tool. Items are roughly ordered
by impact × effort — pick from the top.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Decision Tool Essentials (high impact, low effort)

Goal: turn the tool from "interesting chart" into "actually helps decide".

- [x] **Property carrying costs** — emlak vergisi, aidat, DASK, bakım rezervi
  - Engine inputs: `annual_property_tax_rate`, `monthly_hoa_tl`,
    `annual_dask_tl`, `annual_maintenance_rate`. Produces
    `ownership_cost_usd_*` and `cumulative_ownership_cost_usd_*`.
    Folded into `total_credit_minus_rent_usd_*` (commits 1a39be1).

- [x] **Transaction costs** — tapu harcı, komisyon, taşınma, satışta vergi
  - `transaction_cost_buy_pct` flows into the t=0 outlay;
    `transaction_cost_sell_pct` produces `net_sale_value_usd_*`
    (commit 3a158c4).

- [x] **Break-even** computed engine-side as `breakeven_month`
  - Uses remaining loan amortization + net sale value + net cash spent.
    `null` if never within term. Includes `net_buy_position_usd_*`
    series whose zero-crossing visualizes break-even (commit 2e4b0ce).
  - Also fixed cum_rent/cum_carry yearly/monthly alignment
    (ROADMAP Phase 2.3 knocked out as side benefit).

- [x] **Tooltips & presets** — landed via UI swap (commit f9ca154).
  Tooltip strings live in `i18n.js` as `f_*_help` keys; presets
  (`balanced` / `conservative` / `optimistic` / `custom`) live in
  `window.PRESETS` and `window.PRESET_META`.

- [x] **Phase 1.6: Wire engine features into the React UI** — closed.
  - 'Giderler' / 'Costs' tab in FormTabs with all 6 Phase 1 inputs
    (vergi / aidat / DASK / bakım / alış / satış), help icons, units,
    preset values for all four presets (commit 4c3e626).
  - '+ Alış Giderleri' read-only line under loan amount in House tab.
  - Break-even insight card now uses engine's `breakeven_month`
    (commit 897b73c).
  - Chart series wired for `total_credit_minus_rent` (in rent_vs view),
    `net_buy_position_usd` (new 'Almak kazandırıyor mu?' view),
    `remaining_loan_usd` (new 'Kalan kredi yükü' view), and the
    salary view now shows gross + net-of-rent ratios side by side
    (commits 897b73c, 4c3e626, 794818c, 14810a6).
  - New 'Net ödeme (kira düşülmüş)' insight card.
  - `cumulative_ownership_cost_*` and `net_sale_value_*` series are
    still produced by the engine but not yet plotted (could go in
    a future 'Sahiplik maliyeti detayı' view if user demand emerges).

---

## Phase 2 — Math Correctness & Honesty

Goal: the numbers we show should be defensible.

- [x] **Test coverage for `projection.js`**
  - 18 tests in `tests/projection.test.js` using `node:test`. Covers
    array shapes, loan amortization, compound rates, carrying-cost
    zeroing, transaction cost folding, break-even direction in three
    sanity scenarios, yearly/monthly consistency, prefixSum semantics,
    salary path, and asset projection. Run with
    `node --test tests/projection.test.js` (commit 1e2d976).

- [x] **Geometric vs arithmetic returns in random paths** — fixed.
  `randomYearlyPath` now rescales by the *geometric* mean of `(1+r_i)`,
  guaranteeing `prod(1+adjusted_i) = (1+target)^years` exactly. Random
  paths no longer suffer volatility drag — the compounded final value
  matches the deterministic compound series to floating-point precision.
  Five new tests in `tests/projection.test.js` lock this in: yearly,
  monthly, geomean property, target=0 edge case, and end-to-end engine
  smoke (commit pending).

- [x] **`cum_rent_usd_yearly` alignment** — fixed in commit 2e4b0ce.
  Cumulative arrays now use `prefixSum` (0 at index 0, sum-through-period-i
  at index i). Yearly cumulative arrays are sampled from monthly so the
  two resolutions agree exactly at indices `y*12`.

- [ ] **Monte Carlo / fan chart**
  - When `generate_random=true`, run N (≥500) projections in the browser.
  - Show P10/P50/P90 envelopes instead of a single noisy path.
  - Chart.js can render filled bands; the math is already vectorized.

---

## Phase 3 — Useful Comparisons (domain)

- [x] **Rent-it-out scenario** — `rent_it_out` toggle + `vacancy_rate` +
  `rental_income_tax_rate`.
  - When on, the engine scales the USD rent series by
    `(1−vacancy)·(1−tax)`, so "rent" becomes net rental income received and
    flows through `cum_rent` / `total_credit_minus_rent` /
    `net_buy_position` / `breakeven` unchanged. Factor is 1 in the live-in
    case, so existing behaviour is untouched. UI lives in the Rent & Salary
    tab; presets carry the three new fields.

- [x] **Early prepayment** — `prepayment_amount_tl` + `prepayment_year`.
  - A lump sum applied to the balance on its year boundary, *before* that
    year's re-amortization, in both the payment-building and remaining-loan
    loops (kept consistent). It lowers later installments (shortens cost,
    not term) and is folded back into `monthlyPaymentTlArr` so
    `total_paid_tl` and the USD outlay series count it as cash spent.
    Refinance (rate change) is already covered by the rate editor below.

- [x] **Loan rate change scenario** — already shipped via `rate-editor.jsx`.
  - The engine supports `interest_rate_mode: "yearly"` +
    `interest_rate_per_year[]`, re-amortizing at each anniversary; the
    yearly rate editor UI drives it.

- [x] **Real-USD consistency** — deflate everything, consistently.
  - The old hack quietly shrank the FX growth rate (and *raised* USD house
    values — backwards). Now `dollar_rates_*` stay nominal for output, and
    a `fxConv*` rate (nominal × US-CPI deflator) is used for every TL→USD
    conversion, so when the toggle is on every USD series is real
    (today's-purchasing-power) USD, consistently. Deflator is 1 at t=0.

---

## Phase 4 — UX Polish

- [x] **Shareable URL state** — done in `app.jsx`.
  - `encodeState` / `decodeState` pack `form` + `selectedAssets` + `lang`
    into a versioned (`s1=`) base64 URL hash; `history.replaceState` keeps
    it in sync (debounced), and the hash is hydrated on first mount. A
    share button in the topbar copies the link to the clipboard.

- [x] **Multi-axis or faceted chart** — secondary y-axis support.
  - `ProjectionChart` now honours a per-series `axis: "y1"` and a view-level
    `unit2`; a right-hand `y1` scale is added only when a series uses it
    (`grid.drawOnChartArea: false` so it doesn't clutter). The `payment`
    view overlays the payment/salary ratio (%) on `y1` when a salary is set
    — the salary-dependent series is gated by `needsSalary` in both the
    chart loop and the glossary.

- [x] **Plot annotations** — `chartjs-plugin-annotation` (CDN).
  - Dashed line at the loan-end year (only drawn when the loan term is
    shorter than the projection horizon) and a green break-even marker
    from `result.breakeven_month`. Both adapt to yearly/monthly granularity.

- [x] **Mobile layout** — expanded the `max-width: 720px` media query.
  - Insights pack two-up (smaller `minmax`), chart panel uses tighter
    padding + a shorter canvas, the view switcher scrolls horizontally
    instead of wrapping, and the foot/action rows wrap with stretched
    tap targets.

- [x] **CSV / PDF export** — both done.
  - PDF: `report.jsx` (`generateSingleReport` / `ReportLauncher`,
    print-to-PDF). CSV: `downloadCSV` in `app.jsx` dumps every
    yearly-resolution series to a BOM-prefixed CSV; button sits in the
    results action row.

---

## Phase 5 — Code Quality & Ops

- [x] **CI on GitHub Actions** — `.github/workflows/ci.yml`.
  - Runs on push + pull_request: `node --check projection.js i18n.js`
    then `node --test tests/projection.test.js`. No install step (tests
    load the engine via `eval`).

- [x] **TypeScript for frontend** — `types/projection.d.ts`.
  - A standalone `.d.ts` typing the `runProjection` result shape
    (`ProjectionResult`) and the Monte Carlo extension
    (`MonteCarloResult` with `envelopes`). Optional aid — nothing compiles
    against it, no build step added.

- [x] **Magic-number config** — extracted in `projection.js`.
  - `YEARLY_JITTER_LO/HI` (0.7/1.3) and `MONTHLY_JITTER_LO/HI`
    (0.98/1.05) now live in a named constants block at the top.

- [x] **GH Action to refresh `assets.json`** — already shipped.
  - `.github/workflows/refresh-assets.yml` runs a weekly cron +
    `workflow_dispatch`, refreshing `assets.json` from yfinance. (Currently
    commits directly to the branch rather than opening a PR — a future
    tweak could switch it to `create-pull-request`.)

---

## Phase 6 — alalimmi.com (multi-asset expansion)

Goal: grow from a buy-vs-rent *house* tool into a general "alalım mı?"
decision tool — same engine philosophy (buy vs. invest the money
instead), applied to other big purchases. Domain: `alalimmi.com`.

This is a scope shift, not just features — it reshapes the engine and
the navigation. Sequenced so each step ships something usable.

- [ ] **Custom domain** — point `alalimmi.com` at GitHub Pages
  - Add a `CNAME` file to the repo root; configure DNS (A records or
    `CNAME` to `<user>.github.io`). No build-step change. Low effort,
    can land first.

- [ ] **Asset-class abstraction** — generalize `runProjection`
  - Today the engine is house-specific (appreciation, rent, mortgage).
    Introduce an "asset class" concept distinguishing *appreciating*
    (house) vs *depreciating* (car, electronics) assets, each with its
    own carrying-cost and resale model. Keep the core "buy vs. invest
    the down payment instead" comparison shared across classes.
  - Builds on the existing `SUPPORTED_ASSETS` notion but one level up.

- [ ] **Car module** — first new asset class
  - Depreciation curve instead of appreciation.
  - Carrying costs: MTV, kasko/sigorta, yakıt, bakım, lastik.
  - Financing options: taşıt kredisi vs. nakit vs. operasyonel kiralama
    (common in TR — worth a first-class comparison).

- [ ] **SEO landing pages** — one page per calculator
  - Dedicated, indexable pages ("araba kredisi mi nakit mi",
    "kiralık mı satılık mı") so the domain gets organic traffic.
  - Still static; no build step required.

- [ ] **Pull "Shareable URL state" (Phase 4) forward**
  - Shareable scenario links are the cheapest growth lever for a public
    site — prioritize alongside this phase rather than waiting for the
    Phase 4 UX-polish pass.

---

## Out of scope (for now)

- Multi-user accounts / saved scenarios on a backend
- Localization beyond TR/EN
- Native mobile app

Note: "other asset classes" left this list as of Phase 6 — the tool is
no longer house-only.
