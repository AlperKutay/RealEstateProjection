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
├── index.html        Markup (Alpine.js + Tailwind, CDN-loaded)
├── app.js            Alpine component: form state, translations, chart
├── projection.js     Pure math engine — single source of truth
├── style.css         Custom styles on top of Tailwind
├── assets.json       Snapshot of yfinance returns for the asset list
├── README.md
├── ROADMAP.md
└── CLAUDE.md         Notes for AI assistants
```

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
