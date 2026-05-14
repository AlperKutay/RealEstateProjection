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
