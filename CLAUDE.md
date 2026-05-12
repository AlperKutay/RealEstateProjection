# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the FastAPI backend + JS frontend (primary modern entrypoint):
```bash
uvicorn api:app --reload
```
Then visit `http://127.0.0.1:8000/` for the JS UI. Auto-generated OpenAPI docs at `/docs`.

Run the legacy Streamlit UI:
```bash
streamlit run app.py
```
Both UIs share the same calculation engine — there is no duplicated math.

Fetch / cache an asset return:
```bash
python stock_market_helper.py --asset BTC
python stock_market_helper.py --asset XU100 --months
```

Run unit tests:
```bash
python -m unittest test_main.py
```

Run a single test:
```bash
python -m unittest test_main.TestAmortization.test_main_uses_real_amortization
```

Deployment metadata: `runtime.txt` (Python 3.11) and `packages.txt` are for Streamlit Cloud only.

## Architecture

Five-layer pipeline, with **`projection.py` as the single source of truth** for all financial math:

```
                ┌─────────────┐
                │ projection  │  ← pure functions, JSON-serializable
                │     .py     │     (no UI, no plotting)
                └──────┬──────┘
              ┌────────┴────────┐
              │                 │
      ┌───────▼──────┐   ┌──────▼─────┐
      │   api.py     │   │  app.py    │
      │  (FastAPI)   │   │ (Streamlit)│
      └──────┬───────┘   └─────┬──────┘
             │                  │
      ┌──────▼─────┐     ┌──────▼──────┐
      │  frontend/ │     │   main.py   │
      │ (Alpine+JS)│     │ (make_plots)│
      └────────────┘     └─────────────┘
                              ↑
                     stock_market_helper.py
                       (yfinance + cache)
```

### Module roles

- **`projection.py`** — single source of truth. Exposes `ProjectionInput` (dataclass), `AssetParams`, and `run_projection() -> ProjectionResult`. `ProjectionResult.to_dict()` is JSON-ready. NO matplotlib, NO Streamlit, NO HTTP.
- **`api.py`** — FastAPI app: `GET /api/assets`, `GET /api/asset/{symbol}`, `POST /api/project`. Serves `frontend/` at `/` and `/static/...`. Pydantic models mirror `ProjectionInput`.
- **`frontend/`** — Vanilla HTML + Alpine.js + Chart.js + Tailwind (all via CDN, zero build step). `index.html` is the markup, `app.js` is the Alpine component with translation table + `SERIES_MAP` (plot key → result field).
- **`app.py`** — Streamlit shell. Collects form input, builds a `ProjectionInput`, calls `run_projection`, then `_build_legacy_payload()` translates the modern result into the legacy `(Config, data, args)` triple that `main.make_plots` consumes.
- **`main.py`** — matplotlib plotting (`make_plots`) + legacy financial primitives kept for backward compat and unit tests. `calculate_monthly_payment_tl` now uses real amortization (was simplified interest-only — see "Known prior bugs").
- **`stock_market_helper.py`** — yfinance wrapper with on-disk cache (`cached_returns.csv`, 365-day TTL keyed on `(asset, use_months)`). XU100/XU30 are USD-adjusted via USDTRY=X.

### Data flow (modern path)

1. User fills form in JS frontend → POSTs JSON to `/api/project`.
2. `api.py` constructs `ProjectionInput` (including any pre-fetched `AssetParams` per selected symbol).
3. `projection.run_projection()` computes deterministic or random paths for: dollar rates, payments (USD), house value, rent, salaries, and each asset's projection. Returns `ProjectionResult`.
4. Result is `asdict()`'d to JSON and returned.
5. Frontend's `SERIES_MAP` translates user's plot-key selections into result fields, then Chart.js renders.

### Data flow (Streamlit path)

Same `run_projection` is called. The result is then adapted via `_build_legacy_payload()` in `app.py` into the dict-shape that `main.make_plots` expects. `np.array()` conversion happens here — `make_plots` uses element-wise `+`, which means lists would silently concatenate. **If you add new series to the data dict, wrap them with `_arr()`.**

### Known prior bugs (now fixed)

- `calculate_monthly_payment_tl` used `interest × principal / 100` (interest-only) instead of standard amortization `M = P·r(1+r)ⁿ / ((1+r)ⁿ−1)`. Underestimated payment by ~4% at typical rates. Tests in `TestAmortization` lock this in.
- `Config` dataclass had two fields named `usa_inflation_rate` and two named `turkey_inflation_rate` (duplicates).
- The `if __name__ == "__main__"` block in `main.py` referenced `calculate_dollar_rates_annual` / `_monthly` — renamed long ago to `calculate_with_*`. Block has been removed (use `projection.run_projection()` for scripted runs).
- `stock_market_helper.fetch_and_calculate()` could return `None` (implicit) on unknown asset while callers unpacked it as a tuple. Now returns `Optional[tuple[float, float]]`.

### Conventions to know

- **TL → USD conversion**: `dollar_rates_annual` has length `years+1`. Payment series have length `years` (the start rate is never used for a payment), so the engine slices `dollar_rates_annual[1:]` rather than `np.delete(..., 0)`.
- **Inflation toggle semantics**: `deflate_dollar_by_us_inflation=True` subtracts USA inflation from the dollar growth rate (yields real-USD). `turkey_inflation` is **always** applied to rent and house value — to keep them flat, set it to 0 explicitly. (The old `include_inflation` flag conflated these.)
- **Random vs deterministic paths**: `generate_random=True` jitters yearly growth ±30% around the target average, then rescales to hit the exact target. Monthly random paths normalize 12 monthly multipliers so their product equals the year's multiplier.
- **`project_initial_money_with_asset`**: when `True`, each asset's `current_price` is overwritten with `initial_noncredit_amount_tl / start_dollar_tl` so the projection answers "what if I had bought this asset with my down payment instead."
- **Salary currency** (USD/EUR/TL) is converted to USD inside the engine. EUR multiplies by `euro_dollar_rate`; TL divides by `dollar_rates`.
- `matplotlib.use('Agg')` is set at `main.py` import — required for headless rendering. Don't switch backends.
- **Bilingual UI**: Streamlit and frontend both maintain TR/EN translation tables. Frontend's lives in `frontend/app.js` (`TRANSLATIONS`).

### Adding a new asset

1. Add the yfinance symbol to `_SYMBOL_TABLE` in `stock_market_helper.py`.
2. (Streamlit only) Add an entry to `_ASSET_FLAG` in `app.py` mapping the symbol to `(plot_flag, series_key, growth_key)` so `make_plots` knows where to read it. Also add the corresponding `plot_*_price` field to `_PlotArgs` and a matching block in `main.make_plots`.
3. JS frontend auto-discovers the asset via `GET /api/assets` — no frontend code change needed.

### Adding a new plot

1. Add the field to `ProjectionResult` in `projection.py` and populate it in `run_projection`.
2. JS frontend: add an entry to `PLOT_ORDER`, `TRANSLATIONS[tr/en]`, and `SERIES_MAP` in `frontend/app.js`.
3. Streamlit: add a UI label → key entry in `PLOT_KEYS` in `app.py`, an `_FLAG_FOR_PLOT_KEY` entry, a `plot_*` field on `_PlotArgs`, and a rendering block in `main.make_plots`.
