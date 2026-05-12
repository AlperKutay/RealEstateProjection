# CLAUDE.md

Notes for AI assistants working in this repo.

## What this is

Static client-side web app. Vanilla HTML + Alpine.js + Chart.js + Tailwind,
all CDN-loaded — no build step. The whole thing runs in the browser and is
hosted on GitHub Pages from `master`.

## File map

```
index.html      Markup + Tailwind utility classes
app.js          Alpine component:
                  - TRANSLATIONS (TR/EN tables)
                  - PLOT_ORDER, SERIES_MAP (plot key → result field)
                  - form state, chart rendering, asset selection
projection.js   Pure math engine (no DOM). Exports nothing — uses global
                scope. Entry point: runProjection(input) → result dict.
                Result shape: see end of file (matches the old Python
                ProjectionResult.to_dict()).
style.css       Custom CSS on top of Tailwind
assets.json     {supported_assets: [...], data: {SYM: {average_growth, current_price}}}
```

## Running

```bash
python -m http.server 8000     # any static server works
```

## Adding a new plot

1. Add the field to the return object in `runProjection` (`projection.js`).
2. Add `PLOT_ORDER` entry, `TRANSLATIONS.tr` and `TRANSLATIONS.en` labels,
   and a `SERIES_MAP` entry in `app.js`.

## Adding a new asset

1. Add the symbol to `supported_assets` in `assets.json`.
2. Add a `data.<SYM>` entry with `average_growth` (yearly %, e.g. 10.24)
   and `current_price` (USD).

## Math conventions

- Dollar rate arrays have length `years+1` (or `years*12+1`); payment arrays
  have length `years` (or `years*12`). Engine slices `dollar_rates.slice(1)`
  to align them.
- `deflate_dollar_by_us_inflation` only subtracts USA inflation from the
  dollar growth rate — other USD series are NOT additionally deflated.
  (Roadmap Phase 3 calls this out as a consistency issue.)
- `turkey_inflation` is always applied to rent and house value. To keep
  those flat, set it to 0 explicitly.
- Random paths jitter yearly growth ±30% around the target average and
  rescale to hit the target exactly. Monthly random paths normalize 12
  multipliers so their product equals the year's multiplier.
- `project_initial_money_with_asset=true` swaps each asset's
  `current_price` for `initial_noncredit_amount_tl / start_dollar_tl` —
  "what if I had bought this asset with my down payment instead?"
- Salary currency (USD/EUR/TL) is normalized to USD inside the engine.

## What to NOT do

- Don't reintroduce a backend unless the user asks. The math is in JS now.
- Don't add a build step (webpack/vite). The CDN-only setup is intentional —
  keeps GitHub Pages deploys instant and the project hackable in any editor.
- Don't put long multi-paragraph comments in code. The codebase is small;
  good names should suffice.
