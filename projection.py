"""Pure projection engine — no plotting, no UI, fully JSON-serializable.

Used by both the Streamlit UI (app.py) and the FastAPI backend (api.py).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional

import numpy as np


# ---------------------------------------------------------------------------
# Constants & asset metadata
# ---------------------------------------------------------------------------

SUPPORTED_ASSETS: list[str] = [
    "XAUUSD", "XAGUSD", "BTC", "ETH", "XU100", "XU30", "NASDAQ", "S&P",
]


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

@dataclass
class AssetParams:
    """Per-asset macro params (sourced from yfinance via stock_market_helper)."""
    average_growth: float  # yearly % (e.g. 12.3 for 12.3%/yr)
    current_price: float   # USD


@dataclass
class ProjectionInput:
    # Loan
    years: int = 10
    interest_rate: float = 2.74                # monthly %, e.g. 2.74
    initial_noncredit_amount_tl: float = 350_000
    value_of_house_tl: float = 2_100_000

    # Macro
    start_dollar_tl: float = 45.0
    dollar_growth_rate: float = 35.0           # yearly %, nominal
    turkey_inflation: float = 25.0             # yearly %
    usa_inflation: float = 3.0                 # yearly %

    # Rent
    initial_monthly_rent_tl: float = 20_000.0

    # Salary
    salary_currency: str = "USD"               # one of {EUR, USD, TL}
    start_salary_base: float = 0.0             # annual figure
    salary_growth: float = 0.0                 # yearly %
    euro_dollar_rate: float = 1.15
    months_to_increase: int = 12

    # Toggles
    use_months: bool = True
    deflate_dollar_by_us_inflation: bool = False  # subtract USA inflation from dollar growth
    generate_random: bool = False
    project_initial_money_with_asset: bool = False

    # Assets — symbol -> params; presence means "include in projection"
    assets: dict[str, AssetParams] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Core financial primitives
# ---------------------------------------------------------------------------

def compound_series(start: float, rate: float, steps: int) -> np.ndarray:
    """Return array of length steps+1: [start, start*(1+r), start*(1+r)^2, ...]."""
    return start * np.power(1.0 + rate, np.arange(steps + 1))


def amortized_monthly_payment(principal: float, monthly_rate: float, n_months: int) -> float:
    """Standard mortgage amortization formula. Returns the fixed monthly payment.

    M = P * r(1+r)^n / ((1+r)^n - 1)

    Zero-interest edge case: M = P / n.
    """
    if n_months <= 0:
        raise ValueError("n_months must be positive")
    if monthly_rate == 0:
        return principal / n_months
    factor = (1 + monthly_rate) ** n_months
    return principal * monthly_rate * factor / (factor - 1)


def random_yearly_path(initial: float, years: int, target_avg_pct: float) -> tuple[np.ndarray, np.ndarray]:
    """Generate a yearly path with random jitter that scales to hit the target average."""
    target = target_avg_pct / 100.0
    raw = np.random.uniform(target * 0.7, target * 1.3, years)
    adjusted = raw * (target / np.mean(raw)) if np.mean(raw) != 0 else raw
    path = [initial]
    for r in adjusted:
        path.append(path[-1] * (1 + r))
    return np.array(path), adjusted


def random_monthly_path(initial: float, years: int, target_avg_pct: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate yearly + monthly paths where monthly multipliers normalize to yearly target."""
    yearly_path, adjusted_yearly = random_yearly_path(initial, years, target_avg_pct)
    monthly = [initial]
    for y_idx in range(years):
        year_multiplier = 1 + adjusted_yearly[y_idx]
        raw_monthly = np.random.uniform(0.98, 1.05, 12)
        # normalize so product = year_multiplier
        normalized = raw_monthly * (year_multiplier ** (1 / 12)) / (np.prod(raw_monthly) ** (1 / 12))
        for m in range(12):
            monthly.append(monthly[-1] * normalized[m])
    return yearly_path, adjusted_yearly, np.array(monthly)


# ---------------------------------------------------------------------------
# Projection
# ---------------------------------------------------------------------------

def _effective_dollar_growth(inp: ProjectionInput) -> tuple[float, float]:
    """Return (annual_decimal, monthly_decimal) growth rate after optional US-inflation deflation."""
    annual_pct = inp.dollar_growth_rate
    if inp.deflate_dollar_by_us_inflation:
        annual_pct -= inp.usa_inflation
    annual = annual_pct / 100.0
    monthly = (1 + annual) ** (1 / 12) - 1
    return annual, monthly


def _build_salary_series_yearly(inp: ProjectionInput, dollar_rates_annual: np.ndarray) -> np.ndarray:
    """Yearly salary series, converted to USD."""
    salaries = [inp.start_salary_base]
    for _ in range(1, len(dollar_rates_annual)):
        salaries.append(salaries[-1] * (1 + inp.salary_growth / 100))
    arr = np.array(salaries)
    if inp.salary_currency == "EUR":
        return arr * inp.euro_dollar_rate
    if inp.salary_currency == "USD":
        return arr
    if inp.salary_currency == "TL":
        return arr / dollar_rates_annual
    raise ValueError(f"unknown salary currency: {inp.salary_currency}")


def _monthly_from_yearly_salary(yearly_arr: np.ndarray, months_to_increase: int,
                                dollar_rates_monthly: np.ndarray,
                                euro_dollar_rate: float, salary_currency: str) -> np.ndarray:
    """Spread a yearly salary array into a monthly array honouring months_to_increase offset."""
    monthly: list[float] = []
    monthly.extend([yearly_arr[0] / 12] * months_to_increase)
    for y in yearly_arr[1:-1]:
        monthly.extend([y / 12] * 12)
    monthly.extend([yearly_arr[-1] / 12] * (13 - months_to_increase))

    arr = np.array(monthly)
    if salary_currency == "EUR":
        return arr * euro_dollar_rate
    if salary_currency == "USD":
        return arr
    if salary_currency == "TL":
        # truncate / extend to dollar_rates_monthly length to match shape
        m = min(len(arr), len(dollar_rates_monthly))
        return arr[:m] / dollar_rates_monthly[:m]
    raise ValueError(f"unknown salary currency: {salary_currency}")


def _project_asset(asset: AssetParams, inp: ProjectionInput) -> tuple[np.ndarray, np.ndarray]:
    """Return (yearly_path, monthly_path) for one asset given its growth rate."""
    start_price = (
        inp.initial_noncredit_amount_tl / inp.start_dollar_tl
        if inp.project_initial_money_with_asset
        else asset.current_price
    )
    growth_pct = asset.average_growth
    if inp.generate_random:
        yearly, _, monthly = random_monthly_path(start_price, inp.years, growth_pct)
    else:
        yearly = compound_series(start_price, growth_pct / 100, inp.years)
        monthly_rate = (1 + growth_pct / 100) ** (1 / 12) - 1
        monthly = compound_series(start_price, monthly_rate, inp.years * 12)
    return yearly, monthly


@dataclass
class ProjectionResult:
    # Metadata
    monthly_tl_payment: float
    annual_tl_payment: float
    total_paid_tl: float                       # monthly_tl_payment * years * 12
    loan_amount_tl: float
    initial_noncredit_amount_usd: float
    value_of_house_usd: float

    # Effective rates used
    effective_dollar_growth_annual: float      # decimal (e.g. 0.32)
    effective_dollar_growth_monthly: float
    effective_turkey_inflation_annual: float
    effective_turkey_inflation_monthly: float

    # Yearly series (length years+1)
    years_axis: list[int]
    dollar_rates_annual: list[float]
    annual_payment_usd: list[float]            # length years
    cumulative_payment_usd_annual: list[float] # length years
    total_credit_amount_usd_annual: list[float]  # cumulative + initial_noncredit_usd, length years+1
    value_of_house_usd_yearly: list[float]
    rent_price_usd_yearly: list[float]
    cumulative_rent_price_usd_yearly: list[float]
    house_plus_rent_yearly: list[float]
    salaries_usd_yearly: Optional[list[float]] = None
    payment_salary_ratio_yearly: Optional[list[float]] = None
    payment_minus_rent_over_salary_yearly: Optional[list[float]] = None

    # Monthly series (length years*12 + 1)
    months_axis: list[int] = field(default_factory=list)
    dollar_rates_monthly: list[float] = field(default_factory=list)
    monthly_payment_usd: list[float] = field(default_factory=list)
    cumulative_payment_usd_monthly: list[float] = field(default_factory=list)
    total_credit_amount_usd_monthly: list[float] = field(default_factory=list)
    value_of_house_usd_monthly: list[float] = field(default_factory=list)
    rent_price_usd_monthly: list[float] = field(default_factory=list)
    cumulative_rent_price_usd_monthly: list[float] = field(default_factory=list)
    house_plus_rent_monthly: list[float] = field(default_factory=list)
    salaries_usd_monthly: Optional[list[float]] = None
    payment_salary_ratio_monthly: Optional[list[float]] = None
    payment_minus_rent_over_salary_monthly: Optional[list[float]] = None

    # Asset projections: {symbol: {"yearly": [...], "monthly": [...], "average_growth": x, "current_price": y}}
    asset_projections: dict[str, dict] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def run_projection(inp: ProjectionInput) -> ProjectionResult:
    n_months = inp.years * 12

    # --- Loan
    loan = inp.value_of_house_tl - inp.initial_noncredit_amount_tl
    monthly_tl_payment = amortized_monthly_payment(loan, inp.interest_rate / 100, n_months)
    annual_tl_payment = monthly_tl_payment * 12

    # --- Effective rates
    dollar_growth_annual, dollar_growth_monthly = _effective_dollar_growth(inp)
    turkey_inflation_annual = inp.turkey_inflation / 100
    turkey_inflation_monthly = (1 + turkey_inflation_annual) ** (1 / 12) - 1

    # --- Dollar rate paths
    if inp.generate_random:
        dollar_rates_annual, _, dollar_rates_monthly = random_monthly_path(
            inp.start_dollar_tl, inp.years, dollar_growth_annual * 100,
        )
    else:
        dollar_rates_annual = compound_series(inp.start_dollar_tl, dollar_growth_annual, inp.years)
        dollar_rates_monthly = compound_series(inp.start_dollar_tl, dollar_growth_monthly, n_months)

    # --- Payment in USD
    annual_payment_usd = np.full(inp.years, annual_tl_payment) / dollar_rates_annual[1:]
    monthly_payment_usd = np.full(n_months, monthly_tl_payment) / dollar_rates_monthly[1:]
    cum_payment_usd_annual = np.cumsum(annual_payment_usd)
    cum_payment_usd_monthly = np.cumsum(monthly_payment_usd)

    initial_noncredit_usd = inp.initial_noncredit_amount_tl / inp.start_dollar_tl
    total_credit_usd_annual = np.insert(cum_payment_usd_annual, 0, 0) + initial_noncredit_usd
    total_credit_usd_monthly = np.insert(cum_payment_usd_monthly, 0, 0) + initial_noncredit_usd

    # --- House value
    if inp.generate_random:
        house_tl_yearly, _, house_tl_monthly = random_monthly_path(
            inp.value_of_house_tl, inp.years, inp.turkey_inflation,
        )
    else:
        house_tl_yearly = compound_series(inp.value_of_house_tl, turkey_inflation_annual, inp.years)
        house_tl_monthly = compound_series(inp.value_of_house_tl, turkey_inflation_monthly, n_months)
    house_usd_yearly = house_tl_yearly / dollar_rates_annual
    house_usd_monthly = house_tl_monthly / dollar_rates_monthly

    # --- Rent
    annual_rent_tl_start = inp.initial_monthly_rent_tl * 12
    if inp.generate_random:
        rent_tl_yearly, _, rent_tl_monthly_year_grouped = random_monthly_path(
            annual_rent_tl_start, inp.years, inp.turkey_inflation,
        )
        # Monthly rent: divide each year's annual rent by 12, repeat 12 times
        rent_tl_monthly: list[float] = []
        for y in rent_tl_yearly[:-1]:
            rent_tl_monthly.extend([y / 12] * 12)
        rent_tl_monthly.append(rent_tl_yearly[-1] / 12)
        rent_tl_monthly_arr = np.array(rent_tl_monthly)
    else:
        rent_tl_yearly = compound_series(annual_rent_tl_start, turkey_inflation_annual, inp.years)
        rent_tl_monthly_list: list[float] = []
        for y in rent_tl_yearly[:-1]:
            rent_tl_monthly_list.extend([y / 12] * 12)
        rent_tl_monthly_list.append(rent_tl_yearly[-1] / 12)
        rent_tl_monthly_arr = np.array(rent_tl_monthly_list)
    rent_usd_yearly = rent_tl_yearly / dollar_rates_annual
    rent_usd_monthly = rent_tl_monthly_arr / dollar_rates_monthly
    cum_rent_usd_yearly = np.cumsum(rent_usd_yearly)
    cum_rent_usd_monthly = np.cumsum(rent_usd_monthly)
    house_plus_rent_yearly = house_usd_yearly + cum_rent_usd_yearly
    house_plus_rent_monthly = house_usd_monthly + cum_rent_usd_monthly

    # --- Salary
    salaries_usd_yearly_arr = None
    salaries_usd_monthly_arr = None
    pay_sal_ratio_yearly = None
    pay_sal_ratio_monthly = None
    pay_minus_rent_yearly = None
    pay_minus_rent_monthly = None

    if inp.start_salary_base > 0:
        if inp.generate_random:
            same_currency_yearly, _ = random_yearly_path(
                inp.start_salary_base, inp.years, inp.salary_growth,
            )
        else:
            same_currency_yearly = compound_series(
                inp.start_salary_base, inp.salary_growth / 100, inp.years,
            )

        # Convert yearly to USD (length years+1)
        if inp.salary_currency == "EUR":
            salaries_usd_yearly_arr = same_currency_yearly * inp.euro_dollar_rate
        elif inp.salary_currency == "USD":
            salaries_usd_yearly_arr = same_currency_yearly.copy()
        elif inp.salary_currency == "TL":
            salaries_usd_yearly_arr = same_currency_yearly / dollar_rates_annual

        # Monthly
        salaries_usd_monthly_arr = _monthly_from_yearly_salary(
            same_currency_yearly, inp.months_to_increase,
            dollar_rates_monthly, inp.euro_dollar_rate, inp.salary_currency,
        )

        # Ratios (skip first salary entry which is t=0)
        sal_y = salaries_usd_yearly_arr[1:]
        pay_sal_ratio_yearly = annual_payment_usd / sal_y
        pay_minus_rent_yearly = (annual_payment_usd - rent_usd_yearly[1:]) / sal_y

        sal_m = salaries_usd_monthly_arr[:n_months]
        # Align lengths
        pay_sal_ratio_monthly = monthly_payment_usd[:len(sal_m)] / sal_m
        pay_minus_rent_monthly = (
            (monthly_payment_usd[:len(sal_m)] - rent_usd_monthly[1:len(sal_m) + 1])
            / sal_m
        )

    # --- Assets
    asset_projections: dict[str, dict] = {}
    for symbol, params in inp.assets.items():
        yearly_path, monthly_path = _project_asset(params, inp)
        asset_projections[symbol] = {
            "yearly": yearly_path.tolist(),
            "monthly": monthly_path.tolist(),
            "average_growth": params.average_growth,
            "current_price": params.current_price,
        }

    return ProjectionResult(
        monthly_tl_payment=float(monthly_tl_payment),
        annual_tl_payment=float(annual_tl_payment),
        total_paid_tl=float(monthly_tl_payment * n_months),
        loan_amount_tl=float(loan),
        initial_noncredit_amount_usd=float(initial_noncredit_usd),
        value_of_house_usd=float(inp.value_of_house_tl / inp.start_dollar_tl),
        effective_dollar_growth_annual=float(dollar_growth_annual),
        effective_dollar_growth_monthly=float(dollar_growth_monthly),
        effective_turkey_inflation_annual=float(turkey_inflation_annual),
        effective_turkey_inflation_monthly=float(turkey_inflation_monthly),
        years_axis=list(range(inp.years + 1)),
        months_axis=list(range(n_months + 1)),
        dollar_rates_annual=dollar_rates_annual.tolist(),
        dollar_rates_monthly=dollar_rates_monthly.tolist(),
        annual_payment_usd=annual_payment_usd.tolist(),
        monthly_payment_usd=monthly_payment_usd.tolist(),
        cumulative_payment_usd_annual=cum_payment_usd_annual.tolist(),
        cumulative_payment_usd_monthly=cum_payment_usd_monthly.tolist(),
        total_credit_amount_usd_annual=total_credit_usd_annual.tolist(),
        total_credit_amount_usd_monthly=total_credit_usd_monthly.tolist(),
        value_of_house_usd_yearly=house_usd_yearly.tolist(),
        value_of_house_usd_monthly=house_usd_monthly.tolist(),
        rent_price_usd_yearly=rent_usd_yearly.tolist(),
        rent_price_usd_monthly=rent_usd_monthly.tolist(),
        cumulative_rent_price_usd_yearly=cum_rent_usd_yearly.tolist(),
        cumulative_rent_price_usd_monthly=cum_rent_usd_monthly.tolist(),
        house_plus_rent_yearly=house_plus_rent_yearly.tolist(),
        house_plus_rent_monthly=house_plus_rent_monthly.tolist(),
        salaries_usd_yearly=salaries_usd_yearly_arr.tolist() if salaries_usd_yearly_arr is not None else None,
        salaries_usd_monthly=salaries_usd_monthly_arr.tolist() if salaries_usd_monthly_arr is not None else None,
        payment_salary_ratio_yearly=pay_sal_ratio_yearly.tolist() if pay_sal_ratio_yearly is not None else None,
        payment_salary_ratio_monthly=pay_sal_ratio_monthly.tolist() if pay_sal_ratio_monthly is not None else None,
        payment_minus_rent_over_salary_yearly=pay_minus_rent_yearly.tolist() if pay_minus_rent_yearly is not None else None,
        payment_minus_rent_over_salary_monthly=pay_minus_rent_monthly.tolist() if pay_minus_rent_monthly is not None else None,
        asset_projections=asset_projections,
    )
