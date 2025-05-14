# 🏠 Real Estate Projection

A powerful interactive simulation tool for projecting real estate investment performance in Türkiye, considering currency devaluation, inflation, salaries, loan parameters, and financial asset returns — including gold, silver, BTC, ETH, NASDAQ, S\&P, XU100, and XU30 (in USD).

![App Screenshot](preview_image_placeholder.png)

---

## 📦 Features

* 📈 Plot mortgage payments, salary projections, inflation-adjusted house prices, and rent ratios
* 📉 Compare your investment with real asset returns (BTC, Gold, XU100, etc.)
* 🧶 Supports random scenarios or fixed growth rates
* 💾 Caches financial asset returns with auto-expiry (1-year validity)
* 💱 XU100 and XU30 adjusted to USD using USD/TRY exchange rates
* 🌐 English and Turkish interface options

---

## 🧠 How It Works

The app combines mortgage calculations, salary growth, dollar/TRY inflation trends, and financial market performance to simulate long-term payment plans, affordability, and opportunity cost.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note**: You need Python 3.8+ and a stable internet connection for financial data.

### 2. Launch Streamlit app

```bash
streamlit run app.py
```

### 3. Use CLI to test asset return calculations (optional)

```bash
python stock_market_helper.py --asset BTC
python stock_market_helper.py --asset XU100 --months
```

---

## ⚙️ Project Structure

```
├── app.py                   ← Streamlit frontend
├── main.py                  ← Core financial logic and plotting
├── stock_market_helper.py  ← Asset return calculation + caching logic
├── cached_returns.csv       ← Auto-generated cache file
└── README.md
```

---

## 📟 Caching Logic

* Stores average yearly/monthly growth and current price for each asset
* File: `cached_returns.csv`
* Re-used if:

  * Same asset
  * Same frequency (yearly/monthly)
  * Date is **within 1 year**
* Else → fetches fresh data and replaces the old entry

---

## 📉 Supported Assets

| Symbol | Description             |
| ------ | ----------------------- |
| XAUUSD | Gold (USD)              |
| XAGUSD | Silver (USD)            |
| BTC    | Bitcoin                 |
| ETH    | Ethereum                |
| NASDAQ | Nasdaq Index            |
| S\&P   | S\&P 500 Index          |
| XU100  | BIST 100 (USD-adjusted) |
| XU30   | BIST 30 (USD-adjusted)  |

---

## 📊 Sample Use Cases

* "How would my real estate loan behave under high inflation and TL devaluation?"
* "What if I had invested the same down payment in BTC or Gold instead?"
* "Will my TL-based salary keep up with the mortgage in USD terms?"

---

## 🖼️ Example Visualizations

### Monthly View

![Monthly Projection](monthly_dollar_house_credit_cumulative_salary.png)

### Annual View

![Annual Projection](annual_dollar_house_credit_cumulative_salary.png)

---

## 🧑‍💻 Contributing

Pull requests and feedback are welcome. Please ensure your changes align with the project's modular structure.

---

## 🛡️ License

MIT License.
