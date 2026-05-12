# CLAUDE.md

Notes for AI assistants working in this repo.

## What this is

Static client-side web app. React + Chart.js, all CDN-loaded. JSX is
transformed in the browser by `@babel/standalone` — there is **no build
step**. The whole thing runs in the browser and is hosted on GitHub
Pages from `master`.

## File map

```
index.html         Loads React + ReactDOM + Babel + Chart.js from CDN, then
                   our scripts. Script order matters: projection.js and
                   i18n.js first (plain JS), then tweaks-panel.jsx (exposes
                   window.TweaksPanel/useTweaks), then setup.jsx, then
                   results.jsx, then app.jsx (mounts <App/> to #root).

app.jsx            Top-level <App/>:
                     - language (tr/en) + preset state
                     - form state + selected assets
                     - view router (setup ↔ results)
                     - theme + accent (via useTweaks)
                     - calls window.runProjection(input)

setup.jsx          Setup screen pieces: PresetPicker, FormTabs (House &
                   Loan, Economy, Rent & Salary, Alternatives, Advanced),
                   HelpIcon, NumInput, Select, ToggleCard, AssetChip.
                   Exposes window.HelpIcon, window.PresetPicker,
                   window.FormTabs.

results.jsx        Results screen: InsightCards, Verdict, ChartPanel
                   (curated chart views — decision / payment / rent_vs /
                   salary / macro), Details accordion.
                   VIEW_DEFS + SERIES_FIELDS map view ids → series →
                   projection.js result fields.

tweaks-panel.jsx   Floating tweaks panel + useTweaks hook + form-control
                   helpers (TweakRadio, TweakColor, TweakToggle, …).
                   Owns the host edit-mode protocol (postMessage).
                   Exposes everything on window.

i18n.js            window.I18N (tr/en tables) + window.PRESETS (balanced,
                   conservative, optimistic, custom) + window.PRESET_META.
                   Tooltip strings live here too (f_*_help keys).

projection.js      Pure math engine (no DOM). Plain JS — uses global
                   scope. Entry point: window.runProjection(input) →
                   result dict. Owns SUPPORTED_ASSETS list.

styles.css         Hand-rolled CSS. OKLCH palette, Geist + Geist Mono,
                   light/dark themes via [data-theme="dark"]. NOTE the
                   plural filename — earlier code used style.css.

assets.json        {supported_assets: [...], data: {SYM: {average_growth,
                   current_price}}}
```

## Running

```bash
python -m http.server 8000     # any static server works
```

## Adding a new chart view

1. If you need a new series, add the field to the return object in
   `runProjection` (`projection.js`).
2. In `results.jsx`, add an entry to `SERIES_FIELDS` mapping a short key
   to `[yearlyField, monthlyField]`, and an entry to `VIEW_DEFS`
   describing the view (`titleKey`, `subKey`, `series[]`, `unit`).
3. Add the new view id to the `allViews` list in `ChartPanel`.
4. Add `view_<id>` and `view_<id>_sub` translations in `i18n.js`.

## Adding a new form field

1. Add input to the appropriate tab in `FormTabs` (`setup.jsx`). Use
   `<Field>` + `<NumInput>` / `<Select>` / `<ToggleCard>`.
2. Add `f_<key>`, `f_<key>_help`, `f_<key>_unit` translations in
   `i18n.js`.
3. If the field belongs in presets, add it to every PRESETS entry in
   `i18n.js` (balanced / conservative / optimistic / custom).

## Adding a new asset

1. Add the symbol to `supported_assets` in `assets.json`.
2. Add a `data.<SYM>` entry with `average_growth` (yearly %, e.g. 10.24)
   and `current_price` (USD).

## Adding a new preset

1. Add a `<key>` entry in `window.PRESETS` (`i18n.js`) with all fields.
2. Add `window.PRESET_META.<key> = { icon, hue }`.
3. Add to the `keys` array in `PresetPicker` (`setup.jsx`).
4. Add `preset_<key>` and `preset_<key>_sub` translations.

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
- Phase 1 fields (`annual_property_tax_rate`, `monthly_hoa_tl`,
  `annual_dask_tl`, `annual_maintenance_rate`, `transaction_cost_buy_pct`,
  `transaction_cost_sell_pct`) all default to 0 via `?? 0` in the engine.
  The current React UI doesn't expose them as inputs yet — engine output
  for those series will be zeros until presets/forms wire them up.

## What to NOT do

- Don't reintroduce a backend unless the user asks. The math is in JS now.
- Don't add a build step (webpack/vite). The CDN + in-browser Babel setup
  is intentional — keeps GitHub Pages deploys instant and the project
  hackable in any editor.
- Don't rename `styles.css` back to `style.css` — `index.html` references
  the plural form.
- Don't put long multi-paragraph comments in code. The codebase is small;
  good names should suffice.
