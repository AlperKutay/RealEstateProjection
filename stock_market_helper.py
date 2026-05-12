"""yfinance wrapper with on-disk caching (1-year TTL)."""
from __future__ import annotations

import argparse
import os
import warnings
from datetime import datetime
from typing import Optional

import pandas as pd
import yfinance as yf

warnings.filterwarnings("ignore")

CACHE_FILE = "cached_returns.csv"

_SYMBOL_TABLE: dict[str, tuple[str, str]] = {
    "XAUUSD": ("GC=F", "yfinance"),
    "XAGUSD": ("SI=F", "yfinance"),
    "BTC": ("BTC-USD", "yfinance"),
    "ETH": ("ETH-USD", "yfinance"),
    "XRP": ("XRP-USD", "yfinance"),
    "NASDAQ": ("^IXIC", "yfinance"),
    "S&P": ("^GSPC", "yfinance"),
    "XU100": ("XU100.IS", "yfinance"),
    "XU30": ("XU030.IS", "yfinance"),
}


def get_symbol_and_source(asset: str) -> tuple[Optional[str], Optional[str]]:
    return _SYMBOL_TABLE.get(asset.upper(), (None, None))


def supported_assets() -> list[str]:
    """List of asset symbols this module knows how to fetch."""
    return list(_SYMBOL_TABLE.keys())


def calculate_yearly_returns(df: pd.DataFrame) -> pd.Series:
    df = df.dropna().copy()
    df["Year"] = df.index.year
    grouped = df.groupby("Year").agg(first_close=("Close", "first"), last_close=("Close", "last"))
    return (grouped["last_close"] / grouped["first_close"] - 1) * 100


def calculate_monthly_returns(df: pd.DataFrame) -> pd.Series:
    df = df.dropna().copy()
    df["Month"] = df.index.to_period("M")
    grouped = df.groupby("Month").agg(first_close=("Close", "first"), last_close=("Close", "last"))
    return (grouped["last_close"] / grouped["first_close"] - 1) * 100


def adjust_for_usd(index_df: pd.DataFrame) -> pd.DataFrame:
    fx_df = yf.download("USDTRY=X", start=index_df.index[0], end=index_df.index[-1],
                        auto_adjust=False, progress=False)
    if fx_df.empty:
        raise ValueError("USD/TRY rate could not be fetched.")
    if isinstance(fx_df.columns, pd.MultiIndex):
        fx_df.columns = fx_df.columns.droplevel(1)
    if "Close" not in fx_df.columns and "Adj Close" in fx_df.columns:
        fx_df["Close"] = fx_df["Adj Close"]
    fx_series = fx_df["Close"].rename("USDTRY")

    combined = pd.concat([index_df["Close"], fx_series], axis=1).dropna()
    combined["Close"] = combined["Close"] / combined["USDTRY"]
    return combined[["Close"]]


def fetch_and_calculate(asset: str, use_months: bool = False) -> Optional[tuple[float, float]]:
    """Return (average_return_pct, current_price_usd) or None if asset is unknown / data missing.

    Reads/writes `cached_returns.csv` with a 365-day TTL keyed on (asset, use_months).
    """
    symbol, _ = get_symbol_and_source(asset)
    if not symbol:
        print(f"Unknown asset: {asset}")
        return None

    today = datetime.today()
    today_str = today.strftime("%Y-%m-%d")
    use_months_flag = int(use_months)

    cache_df = pd.DataFrame()
    if os.path.exists(CACHE_FILE):
        cache_df = pd.read_csv(CACHE_FILE)
        cache_df["date"] = pd.to_datetime(cache_df["date"], errors="coerce").dt.normalize()

        match = cache_df[
            (cache_df["asset"] == asset)
            & (cache_df["use_months"] == use_months_flag)
        ]
        if not match.empty:
            last_entry = match.sort_values("date", ascending=False).iloc[0]
            age = today - last_entry["date"]
            if age.days <= 365:
                return float(last_entry["avg_return"]), float(last_entry["current_price"])
            cache_df = cache_df[
                ~((cache_df["asset"] == asset) & (cache_df["use_months"] == use_months_flag))
            ]

    end = today
    start = datetime(end.year - 30, end.month, end.day)
    data = yf.download(symbol, start=start, end=end, auto_adjust=False, progress=False)

    if data.empty:
        print(f"No data found for {asset}.")
        return None

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)
    if "Close" not in data.columns and "Adj Close" in data.columns:
        data["Close"] = data["Adj Close"]

    data = data.dropna()
    data.index = pd.to_datetime(data.index)

    if asset in ("XU100", "XU30"):
        data = adjust_for_usd(data)

    current_price = float(data["Close"].iloc[-1])
    avg_return = float(
        calculate_monthly_returns(data).mean() if use_months else calculate_yearly_returns(data).mean()
    )

    new_row = pd.DataFrame([{
        "asset": asset,
        "date": today_str,
        "use_months": use_months_flag,
        "avg_return": avg_return,
        "current_price": current_price,
    }])
    updated = pd.concat([cache_df, new_row], ignore_index=True)
    updated.to_csv(CACHE_FILE, index=False, date_format="%Y-%m-%d")

    return avg_return, current_price


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and calculate returns for a given asset")
    parser.add_argument("--asset", type=str, required=True,
                        help="Asset symbol (XAUUSD, BTC, NASDAQ, S&P, XU100, XU30, ...)")
    parser.add_argument("--months", action="store_true", help="Calculate monthly returns")
    args = parser.parse_args()

    result = fetch_and_calculate(args.asset, use_months=args.months)
    if result is None:
        raise SystemExit(1)
    returns, current_price = result
    print(f"{args.asset} average {'monthly' if args.months else 'yearly'} return: {returns:.2f}%")
    print(f"{args.asset} current price: {current_price:.2f} USD")
