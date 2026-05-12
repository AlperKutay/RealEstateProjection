# Roadmap

Plan for evolving the Real Estate Projection tool from a "kredi vs. yatırım"
calculator into a real buy-vs-rent decision tool. Items are roughly ordered
by impact × effort — pick from the top.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Decision Tool Essentials (höhe impact, low effort)

Goal: turn the tool from "interesting chart" into "actually helps decide".

- [ ] **Property carrying costs** — emlak vergisi, aidat, DASK, bakım rezervi
  - Add fields on `ProjectionInput`: `annual_property_tax_rate` (% of house value),
    `monthly_hoa_tl`, `annual_dask_tl`, `annual_maintenance_rate` (% of value).
  - Roll them into a new `ownership_costs_usd_{yearly,monthly}` series.
  - Update "Net Total Payment" to include these costs (currently only subtracts rent).
  - Done when: form has the new fields, computed series shows up as an opt-in plot,
    and tests cover the math.

- [ ] **Transaction costs** — tapu harcı, komisyon, taşınma, satışta vergi
  - Add `transaction_cost_buy_pct` (default 6%) and `transaction_cost_sell_pct`
    (default 2%) to inputs.
  - Reflect in `initial_noncredit_amount_usd` (one-time at t=0) and in any
    "exit-value" computation (year-N).
  - Done when: down-payment summary shows "+ X TL kapanış maliyetleri".

- [ ] **Break-even summary card**
  - Compute the first year where `value_of_house_usd + cum_rent_usd >
    total_credit_minus_rent_usd + transaction_costs`. Show "Y. yılda başa
    baş geliyorsunuz" (or "bu vade içinde başa baş gelmiyor").
  - Add to the four-card summary row above the chart.
  - Done when: card renders with sensible value across multiple scenarios.

- [ ] **Tooltips on form fields**
  - Each parameter gets a `?` icon with a 1–2 sentence explanation (e.g.
    "ABD enflasyonu ile düşür" → "Dolar büyüme oranından ABD enflasyonunu
    çıkarır; sonuç reel USD getirisidir.").
  - Translation tables in `frontend/app.js` already exist; add `*_tooltip` keys.

- [ ] **Preset scenarios**
  - "İstanbul 1+1 ortalama", "Lüks", "Konservatif kira", "Yüksek enflasyon".
  - Stored as JSON in `frontend/presets.js`, applied with one click.
  - Helps first-time users; lowers friction to play with values.

---

## Phase 2 — Math Correctness & Honesty

Goal: the numbers we show should be defensible.

- [ ] **Test coverage for `projection.py`**
  - Tests exist for `main.py` legacy code only. Add `test_projection.py`:
    - `run_projection` returns expected series lengths.
    - Deterministic dollar/rent paths match analytic compound formula.
    - Random paths' yearly geometric mean ≈ target growth (with seed).
    - `total_credit_minus_rent` math sanity-check.
  - Done when: 15+ tests covering happy path and edge cases.

- [ ] **Geometric vs arithmetic returns in random paths**
  - `random_yearly_path` rescales by *arithmetic* mean. For long-horizon
    compounding, the geometric mean is what matches the analytic compound
    series. Verify and fix if needed (write the test first to expose the gap).

- [ ] **`stock_market_helper.average_growth` semantics**
  - Confirm whether the returned figure is CAGR or arithmetic mean of yearly
    returns. Either is fine, but the projection should use one *consistently*
    (compound_series wants CAGR).

- [ ] **`cum_rent_usd_yearly` alignment**
  - First element currently includes a full year of rent at t=0. This makes
    `total_credit_minus_rent[0] = peşinat − 1_year_rent` which is half a step
    off. Decide on the convention (probably: rent accumulates from year 1
    onward to match `cumulative_payment_usd_annual`) and update.

- [ ] **Monte Carlo / fan chart**
  - Run N (≥500) projections per request when `generate_random=true`.
  - Return P10/P50/P90 envelopes instead of a single path.
  - Frontend draws filled band + median line.
  - Backend: new endpoint `/api/project/montecarlo` or extend existing.

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
  - Run `python -m unittest` on every PR. Optional: `ruff` lint, frontend
    syntax check.

- [ ] **Asset-specific cache TTL**
  - `cached_returns.csv` uses a single 365-day TTL. Crypto changes weekly;
    gold doesn't. Make TTL a per-symbol config in `_SYMBOL_TABLE`.

- [ ] **TypeScript for frontend**
  - Generate TS types from `ProjectionResult` (via OpenAPI export from
    FastAPI). Replaces the `any`-typed `_result` and catches schema drift.
  - Optional — only if frontend grows.

- [ ] **Retire `make_plots` / Streamlit duplication**
  - Either drop the Streamlit shell entirely, or rewire it to render
    `ProjectionResult` directly without `_build_legacy_payload`. Removes the
    "add a series to two places" friction noted in CLAUDE.md.

- [ ] **Magic-number config**
  - `random_yearly_path` jitter range (0.7..1.3), monthly jitter (0.98..1.05),
    cache TTL — extract to a `config.py` or constants block.

---

## Out of scope (for now)

- Multi-user accounts / saved scenarios in a backend DB
- Localization beyond TR/EN
- Native mobile app
