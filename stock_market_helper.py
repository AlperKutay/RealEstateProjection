import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import warnings
import argparse
import os

warnings.filterwarnings("ignore")

CACHE_FILE = "cached_returns.csv"

def get_symbol_and_source(asset):
    asset = asset.upper()
    symbols = {
        'XAUUSD': ('GC=F', 'yfinance'),
        'XAGUSD': ('SI=F', 'yfinance'),
        'BTC': ('BTC-USD', 'yfinance'),
        'ETH': ('ETH-USD', 'yfinance'),
        'XRP': ('XRP-USD', 'yfinance'),
        'NASDAQ': ('^IXIC', 'yfinance'),
        'S&P': ('^GSPC', 'yfinance'),
        'XU100': ('XU100.IS', 'yfinance'),
        'XU30': ('XU030.IS', 'yfinance'),
    }
    return symbols.get(asset, (None, None))

def calculate_yearly_returns(df):
    df = df.dropna()
    df['Year'] = df.index.year
    yearly_close = df.groupby('Year').agg(first_close=('Close', 'first'), last_close=('Close', 'last'))
    return (yearly_close['last_close'] / yearly_close['first_close'] - 1) * 100

def calculate_monthly_returns(df):
    df = df.dropna()
    df['Month'] = df.index.to_period('M')
    monthly_close = df.groupby('Month').agg(first_close=('Close', 'first'), last_close=('Close', 'last'))
    return (monthly_close['last_close'] / monthly_close['first_close'] - 1) * 100

def adjust_for_usd(index_df):
    fx_df = yf.download("USDTRY=X", start=index_df.index[0], end=index_df.index[-1], auto_adjust=False, progress=False)
    if fx_df.empty:
        raise ValueError("USD/TRY kuru alınamadı.")
    if isinstance(fx_df.columns, pd.MultiIndex):
        fx_df.columns = fx_df.columns.droplevel(1)
    if 'Close' not in fx_df.columns and 'Adj Close' in fx_df.columns:
        fx_df['Close'] = fx_df['Adj Close']
    fx_df = fx_df['Close'].rename("USDTRY")

    combined = pd.concat([index_df['Close'], fx_df], axis=1).dropna()
    combined['Close'] = combined['Close'] / combined['USDTRY']
    return combined[['Close']]

def fetch_and_calculate(asset, use_months=False):
    symbol, source = get_symbol_and_source(asset)
    if not symbol:
        print("Geçersiz varlık adı.")
        return

    today = datetime.today()
    today_str = today.strftime("%Y-%m-%d")
    use_months_flag = int(use_months)

    cache_df = pd.DataFrame()
    if os.path.exists(CACHE_FILE):
        cache_df = pd.read_csv(CACHE_FILE)
        cache_df["date"] = pd.to_datetime(cache_df["date"], errors='coerce').dt.normalize()

        match = cache_df[
            (cache_df["asset"] == asset) &
            (cache_df["use_months"] == use_months_flag)
        ]

        if not match.empty:
            last_entry = match.sort_values("date", ascending=False).iloc[0]
            age = today - last_entry["date"]
            if age.days <= 365:
                return last_entry["avg_return"], last_entry["current_price"]
            else:
                # Remove expired row
                cache_df = cache_df[
                    ~((cache_df["asset"] == asset) & (cache_df["use_months"] == use_months_flag))
                ]

    # Download fresh data
    end = today
    start = datetime(end.year - 30, end.month, end.day)
    data = yf.download(symbol, start=start, end=end, auto_adjust=False, progress=False)

    if data.empty:
        print(f"{asset} için veri bulunamadı.")
        return

    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.droplevel(1)

    if 'Close' not in data.columns and 'Adj Close' in data.columns:
        data['Close'] = data['Adj Close']

    data = data.dropna()
    data.index = pd.to_datetime(data.index)

    # USD bazına çevir (XU100, XU30 için)
    if asset in ["XU100", "XU30"]:
        data = adjust_for_usd(data)

    current_price = data['Close'].iloc[-1]
    avg_return = calculate_monthly_returns(data).mean() if use_months else calculate_yearly_returns(data).mean()

    # Save to cache
    new_row = pd.DataFrame([{
        "asset": asset,
        "date": today_str,
        "use_months": use_months_flag,
        "avg_return": avg_return,
        "current_price": current_price
    }])
    updated_cache = pd.concat([cache_df, new_row], ignore_index=True)
    updated_cache.to_csv(CACHE_FILE, index=False, date_format="%Y-%m-%d")

    return avg_return, current_price

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and calculate returns for a given asset")
    parser.add_argument("--asset", type=str, help="Asset symbol (e.g. XAUUSD, BTC, NASDAQ, S&P, XU100, XU30)")
    parser.add_argument("--months", action="store_true", help="Calculate monthly returns")
    args = parser.parse_args()

    result = fetch_and_calculate(args.asset, use_months=args.months)
    if result:
        returns, current_price = result
        print(f"{args.asset} için ortalama {'aylık' if args.months else 'yıllık'} yükseliş: {returns:.2f}%")
        print(f"{args.asset} güncel fiyatı: {current_price:.2f} USD")
