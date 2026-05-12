# Real Estate Projection

Interactive web tool that projects a Turkish real-estate mortgage scenario
against currency devaluation, inflation, salaries, and alternative
investments (gold, BTC, NASDAQ, S&P 500, etc.). Runs entirely in the
browser — no backend, no build step.

## Running locally

Any static file server works. The simplest:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Project layout

```
/
├── index.html        Markup; loads React + Babel + Chart.js from CDN
├── app.jsx           Top-level <App/>: lang, presets, view router (setup ↔ results)
├── setup.jsx         Setup screen: preset picker + tabbed form with tooltips
├── results.jsx       Results screen: insight cards, verdict, chart views, details
├── tweaks-panel.jsx  Floating tweaks panel (theme, accent, toggles) — host protocol
├── i18n.js           TR/EN translations + PRESETS + PRESET_META
├── projection.js     Pure math engine — single source of truth (window.runProjection)
├── styles.css        Custom CSS (Geist font, OKLCH palette, light/dark themes)
├── assets.json       Snapshot of yfinance returns for the asset list
├── README.md
├── ROADMAP.md
└── CLAUDE.md         Notes for AI assistants
```

JSX files are compiled in the browser by `@babel/standalone`. There is
still **no build step** — every file is served as-is and the browser does
the JSX → JS transform on load. Slower than a bundler, fine for a small
client-side app, and keeps GitHub Pages deploys instant.

## Supported asset list

| Symbol | Description             |
| ------ | ----------------------- |
| XAUUSD | Gold (USD)              |
| XAGUSD | Silver (USD)            |
| BTC    | Bitcoin                 |
| ETH    | Ethereum                |
| NASDAQ | Nasdaq Composite        |
| S&P    | S&P 500                 |
| XU100  | BIST 100 (USD-adjusted) |
| XU30   | BIST 30  (USD-adjusted) |

Yearly returns and current prices live in `assets.json` and were sourced
from yfinance via the old Python helper. To refresh, edit `assets.json`
manually (see `_meta.as_of`).

## Deployment

GitHub Pages from `master` branch root. No CI step required.

## License

MIT.
