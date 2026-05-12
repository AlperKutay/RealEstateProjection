"""Streamlit UI — thin shell over projection.run_projection().

Run with:
    streamlit run app.py
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO

import matplotlib.pyplot as plt
import numpy as np
import streamlit as st

from main import Config, make_plots
from projection import AssetParams, ProjectionInput, run_projection
from stock_market_helper import fetch_and_calculate, supported_assets

# ---------------------------------------------------------------------------
# Plot key catalog — UI label -> internal flag name
# ---------------------------------------------------------------------------

PLOT_KEYS = {
    "en": {
        "Monthly Payment (USD)": "annual_payment",
        "Dollar Rate (TL)": "dollar_rates",
        "Salary (USD)": "dollar_salaries",
        "Payment/Salary Ratio": "payment_salary_ratio",
        "(Payment-Rent)/Salary Ratio": "payment_and_rent_ratio_with_salary",
        "Cumulative Payment (USD)": "cumulative_payment",
        "Total Investment (USD)": "total_credit",
        "House Value (USD)": "value_of_house",
        "Rent Price (USD)": "rent_price",
        "Cumulative Rent (USD)": "cumulative_rent_price",
        "House + Cumulative Rent (USD)": "value_of_house_with_rent_price",
    },
    "tr": {
        "Aylık Ödeme (USD)": "annual_payment",
        "Dolar Kuru (TL)": "dollar_rates",
        "Maaş (USD)": "dollar_salaries",
        "Ödeme/Maaş Oranı": "payment_salary_ratio",
        "(Ödeme-Kira)/Maaş Oranı": "payment_and_rent_ratio_with_salary",
        "Kümülatif Ödeme (USD)": "cumulative_payment",
        "Toplam Yatırım (USD)": "total_credit",
        "Ev Değeri (USD)": "value_of_house",
        "Aylık Kira (USD)": "rent_price",
        "Kümülatif Kira (USD)": "cumulative_rent_price",
        "Ev + Kümülatif Kira (USD)": "value_of_house_with_rent_price",
    },
}


# ---------------------------------------------------------------------------
# Adapter: ProjectionResult -> legacy data dict & Args expected by make_plots
# ---------------------------------------------------------------------------

@dataclass
class _PlotArgs:
    plot_annual_payment_usd: bool = False
    plot_dollar_rates: bool = False
    plot_dollar_salaries: bool = False
    plot_cumulative_payment_usd: bool = False
    plot_total_credit_amount_with_initial_noncredit_amount: bool = False
    plot_value_of_house_usd: bool = False
    plot_payment_salary_ratio: bool = False
    plot_monthly_payment_usd: bool = False
    plot_rent_price_usd: bool = False
    plot_cumulative_rent_price_usd: bool = False
    plot_value_of_house_with_rent_price: bool = False
    plot_payment_and_rent_ratio_with_salary: bool = False
    plot_gold_price: bool = False
    plot_silver_price: bool = False
    plot_btc_price: bool = False
    plot_eth_price: bool = False
    plot_xu100_price: bool = False
    plot_xu30_price: bool = False
    plot_nasdaq_price: bool = False
    plot_sp_price: bool = False
    use_months: bool = False


_FLAG_FOR_PLOT_KEY = {
    "annual_payment": "plot_annual_payment_usd",
    "dollar_rates": "plot_dollar_rates",
    "dollar_salaries": "plot_dollar_salaries",
    "payment_salary_ratio": "plot_payment_salary_ratio",
    "payment_and_rent_ratio_with_salary": "plot_payment_and_rent_ratio_with_salary",
    "cumulative_payment": "plot_cumulative_payment_usd",
    "total_credit": "plot_total_credit_amount_with_initial_noncredit_amount",
    "value_of_house": "plot_value_of_house_usd",
    "rent_price": "plot_rent_price_usd",
    "cumulative_rent_price": "plot_cumulative_rent_price_usd",
    "value_of_house_with_rent_price": "plot_value_of_house_with_rent_price",
}

_ASSET_FLAG = {
    "XAUUSD": ("plot_gold_price", "gold_price", "average_gold_growth"),
    "XAGUSD": ("plot_silver_price", "silver_price", "average_silver_growth"),
    "BTC":    ("plot_btc_price", "btc_price", "average_btc_growth"),
    "ETH":    ("plot_eth_price", "eth_price", "average_eth_growth"),
    "XU100":  ("plot_xu100_price", "xu100_price", "average_xu100_growth"),
    "XU30":   ("plot_xu30_price", "xu30_price", "average_xu30_growth"),
    "NASDAQ": ("plot_nasdaq_price", "nasdaq_price", "average_nasdaq_growth"),
    "S&P":    ("plot_sp_price", "sp_price", "average_sp_growth"),
}


def _build_legacy_payload(result, inp: ProjectionInput, language: str,
                          plot_keys: set[str], asset_keys: set[str]) -> tuple[Config, dict, _PlotArgs]:
    """Translate the new ProjectionResult into (Config, data, Args) expected by make_plots."""
    config = Config(
        years=inp.years,
        monthly_tl_payment=result.monthly_tl_payment,
        annual_tl_payment=result.annual_tl_payment,
        start_dollar_tl=inp.start_dollar_tl,
        dollar_growth_rate_annual=result.effective_dollar_growth_annual,
        dollar_growth_rate_monthly=result.effective_dollar_growth_monthly,
        start_salary_base=inp.start_salary_base,
        salary_growth_annual=inp.salary_growth / 100,
        euro_dollar_rate=inp.euro_dollar_rate,
        initial_noncredit_amount=inp.initial_noncredit_amount_tl,
        initial_noncredit_amount_usd=result.initial_noncredit_amount_usd,
        value_of_house_tl=inp.value_of_house_tl,
        value_of_house_usd=result.value_of_house_usd,
        save_plots=False,
        usa_inflation_rate=(inp.usa_inflation / 100) if inp.deflate_dollar_by_us_inflation else 0.0,
        usa_inflation_rate_monthly=(((inp.usa_inflation / 100) + 1) ** (1 / 12)) - 1 if inp.deflate_dollar_by_us_inflation else 0.0,
        turkey_inflation_rate=inp.turkey_inflation / 100,
        turkey_inflation_rate_monthly=result.effective_turkey_inflation_monthly,
        price_rent_ratio_yearly=inp.value_of_house_tl / max(inp.initial_monthly_rent_tl * 12, 1),
        salary_currency=inp.salary_currency,
        include_inflation=inp.deflate_dollar_by_us_inflation,
        language=language,
        months_to_increase=inp.months_to_increase,
        initial_rent_price_tl=inp.initial_monthly_rent_tl,
        interest_rate=inp.interest_rate,
    )

    def _arr(lst):
        return np.array(lst) if lst is not None else None

    data = {
        "dollar_rates_annual": _arr(result.dollar_rates_annual),
        "dollar_rates_monthly": _arr(result.dollar_rates_monthly),
        "annual_payment_usd": _arr(result.annual_payment_usd),
        "monthly_payment_usd": _arr(result.monthly_payment_usd),
        "cumulative_payment_usd_annual": _arr(result.cumulative_payment_usd_annual),
        "cumulative_payment_usd_monthly": _arr(result.cumulative_payment_usd_monthly),
        "dollar_salaries": _arr(
            result.salaries_usd_monthly if inp.use_months else result.salaries_usd_yearly
        ),
        "rent_price_usd_yearly": _arr(result.rent_price_usd_yearly),
        "rent_price_usd_monthly": _arr(result.rent_price_usd_monthly),
        "cumulative_rent_price_usd_yearly": _arr(result.cumulative_rent_price_usd_yearly),
        "cumulative_rent_price_usd_monthly": _arr(result.cumulative_rent_price_usd_monthly),
        "value_of_house_usd_yearly": _arr(result.value_of_house_usd_yearly),
        "value_of_house_usd_monthly": _arr(result.value_of_house_usd_monthly),
        # Asset slots — populated below
        "gold_price": None, "silver_price": None, "btc_price": None, "eth_price": None,
        "xu100_price": None, "xu30_price": None, "nasdaq_price": None, "sp_price": None,
        "average_gold_growth": None, "average_silver_growth": None, "average_btc_growth": None,
        "average_eth_growth": None, "average_xu100_growth": None, "average_xu30_growth": None,
        "average_nasdaq_growth": None, "average_sp_growth": None,
    }

    args = _PlotArgs(use_months=inp.use_months)
    for key in plot_keys:
        flag = _FLAG_FOR_PLOT_KEY.get(key)
        if flag:
            setattr(args, flag, True)

    for sym in asset_keys:
        if sym not in result.asset_projections:
            continue
        proj = result.asset_projections[sym]
        flag, series_key, growth_key = _ASSET_FLAG[sym]
        setattr(args, flag, True)
        data[series_key] = _arr(proj["monthly"] if inp.use_months else proj["yearly"])
        data[growth_key] = proj["average_growth"]

    return config, data, args


# ---------------------------------------------------------------------------
# Streamlit UI
# ---------------------------------------------------------------------------

def _init_session_state() -> None:
    defaults = {
        "last_fig": None,
        "last_plot": None,
        "language": "English",
        "asset_cache": {},   # symbol -> (avg_growth, current_price)
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def main() -> None:
    st.set_page_config(
        page_title="🏠 Real Estate Projection",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    _init_session_state()

    with st.sidebar:
        st.markdown("### 🌍 Language / Dil")
        st.session_state.language = st.radio(
            "Select Language",
            ["English", "Türkçe"],
            index=0 if st.session_state.language == "English" else 1,
        )
        st.markdown(
            "### 💡 Tip\n"
            "Yeni JS arayüz için `uvicorn api:app --reload` ile API'yi başlatıp "
            "`http://127.0.0.1:8000/` adresini ziyaret edin."
        )

    lang = st.session_state.language
    is_tr = lang == "Türkçe"
    plt.style.use("dark_background")

    st.title("🏠 " + ("Gayrimenkul Projeksiyonu" if is_tr else "Real Estate Projection"))

    plot_label_map = PLOT_KEYS["tr" if is_tr else "en"]
    plot_labels = list(plot_label_map.keys())
    default_plots = [plot_labels[0], plot_labels[6], plot_labels[7], plot_labels[10]]

    col_x, col_y1, col_y2 = st.columns(3)
    with col_x:
        time_period = st.selectbox(
            "Zaman Periyodu" if is_tr else "Time Period",
            ["Aylık" if is_tr else "Months", "Yıllık" if is_tr else "Years"],
            index=0,
        )
        use_months = time_period in ("Aylık", "Months")
    with col_y1:
        selected_plot_labels = st.multiselect(
            "Grafik Seçin" if is_tr else "Select Plots",
            plot_labels,
            default=default_plots,
        )
    with col_y2:
        selected_assets = st.multiselect(
            "Finansal Varlık" if is_tr else "Financial Assets",
            supported_assets(),
            default=[],
        )

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("### 📊 " + ("Temel Parametreler" if is_tr else "Basic Parameters"))
        years = st.number_input("Vade (yıl)" if is_tr else "Loan Period (Years)", 1, 30, 10)
        interest_rate = st.number_input("Aylık Faiz (%)" if is_tr else "Monthly Interest (%)", 0.0, 100.0, 2.74)
        start_dollar_tl = st.number_input("Başlangıç USD/TL" if is_tr else "Initial USD/TL", 1.0, value=45.0)
        dollar_growth_rate = st.number_input("Yıllık Dolar Artışı (%)" if is_tr else "Annual Dollar Growth (%)", 0.0, value=35.0)

        st.markdown("### 💼 " + ("Maaş" if is_tr else "Salary"))
        salary_currency = st.selectbox("Para Birimi" if is_tr else "Salary Currency", ["USD", "EUR", "TL"])
        salary_type = st.selectbox(
            "Maaş Tipi" if is_tr else "Salary Type",
            ["Yıllık", "Aylık"] if is_tr else ["Yearly", "Monthly"],
        )
        start_salary_base = st.number_input("Başlangıç Maaşı" if is_tr else "Start Salary (Net)", 0, value=0)
        salary_growth = st.number_input("Maaş Artışı (%)" if is_tr else "Salary Growth (%)", 0.0, value=0.0)
        euro_dollar_rate = st.number_input("EUR/USD", 0.0, value=1.15)
        months_to_increase = st.number_input(
            "Maaş Artışına Kalan Ay" if is_tr else "Months to Salary Increase", 0, 12, 12,
        )

    with col2:
        st.markdown("### 🏠 " + ("Mülk Parametreleri" if is_tr else "Property Parameters"))
        initial_noncredit_amount_m = st.number_input(
            "Peşinat (Milyon TL)" if is_tr else "Down Payment (M TL)", 0.0, value=0.35,
        )
        value_of_house_m = st.number_input(
            "Ev Değeri (Milyon TL)" if is_tr else "House Value (M TL)", 0.0, value=2.1,
        )
        monthly_rent_tl = st.number_input(
            "Aylık Kira (TL)" if is_tr else "Monthly Rent (TL)", 0.0, value=20_000.0,
        )

        st.markdown("### 📈 " + ("Gelişmiş" if is_tr else "Advanced"))
        usa_inflation = st.number_input(
            "ABD Enflasyonu (%)" if is_tr else "USA Inflation (%)", 0.0, value=3.0,
        )
        turkey_inflation = st.number_input(
            "TR Enflasyonu (%)" if is_tr else "Turkey Inflation (%)", 0.0, value=25.0,
        )
        deflate_dollar = st.checkbox(
            "Doları ABD enflasyonu ile düşür" if is_tr else "Deflate dollar by US inflation",
            value=False,
        )
        generate_random = st.checkbox(
            "Rastgele Değerler" if is_tr else "Random Values", value=False,
        )
        project_initial_with_asset = st.checkbox(
            "Peşinatı varlığa yatır" if is_tr else "Invest down payment in asset",
            value=False,
        )

        if st.button("🚀 " + ("Grafik Oluştur" if is_tr else "Generate Plot")):
            _render(
                years=years,
                interest_rate=interest_rate,
                start_dollar_tl=start_dollar_tl,
                dollar_growth_rate=dollar_growth_rate,
                salary_currency=salary_currency,
                start_salary_base=int(start_salary_base) * (12 if salary_type in ("Aylık", "Monthly") else 1),
                salary_growth=salary_growth,
                euro_dollar_rate=euro_dollar_rate,
                months_to_increase=int(months_to_increase),
                initial_noncredit_amount_tl=initial_noncredit_amount_m * 1_000_000,
                value_of_house_tl=value_of_house_m * 1_000_000,
                monthly_rent_tl=monthly_rent_tl,
                usa_inflation=usa_inflation,
                turkey_inflation=turkey_inflation,
                deflate_dollar=deflate_dollar,
                generate_random=generate_random,
                project_initial_with_asset=project_initial_with_asset,
                use_months=use_months,
                language=lang,
                selected_plot_keys={plot_label_map[k] for k in selected_plot_labels},
                selected_assets=set(selected_assets),
            )

    if st.session_state.last_fig is not None:
        st.pyplot(st.session_state.last_fig, use_container_width=True)
        if st.session_state.last_plot is not None:
            st.download_button(
                "📥 " + ("Grafiği İndir" if is_tr else "Download Plot"),
                data=st.session_state.last_plot,
                file_name=f"projection_{datetime.now():%Y%m%d_%H%M%S}.png",
                mime="image/png",
            )


def _render(*, years, interest_rate, start_dollar_tl, dollar_growth_rate,
            salary_currency, start_salary_base, salary_growth, euro_dollar_rate, months_to_increase,
            initial_noncredit_amount_tl, value_of_house_tl, monthly_rent_tl,
            usa_inflation, turkey_inflation, deflate_dollar, generate_random,
            project_initial_with_asset, use_months, language,
            selected_plot_keys, selected_assets):
    # Fetch asset data with session-level cache
    assets: dict[str, AssetParams] = {}
    for sym in selected_assets:
        if sym not in st.session_state.asset_cache:
            res = fetch_and_calculate(sym, use_months=False)
            if res is None:
                st.warning(f"{sym} verisi alınamadı / data unavailable")
                continue
            st.session_state.asset_cache[sym] = res
        avg, price = st.session_state.asset_cache[sym]
        assets[sym] = AssetParams(average_growth=avg, current_price=price)

    inp = ProjectionInput(
        years=int(years),
        interest_rate=interest_rate,
        initial_noncredit_amount_tl=initial_noncredit_amount_tl,
        value_of_house_tl=value_of_house_tl,
        start_dollar_tl=start_dollar_tl,
        dollar_growth_rate=dollar_growth_rate,
        turkey_inflation=turkey_inflation,
        usa_inflation=usa_inflation,
        initial_monthly_rent_tl=monthly_rent_tl,
        salary_currency=salary_currency,
        start_salary_base=float(start_salary_base),
        salary_growth=salary_growth,
        euro_dollar_rate=euro_dollar_rate,
        months_to_increase=months_to_increase,
        use_months=use_months,
        deflate_dollar_by_us_inflation=deflate_dollar,
        generate_random=generate_random,
        project_initial_money_with_asset=project_initial_with_asset,
        assets=assets,
    )

    try:
        result = run_projection(inp)
    except Exception as exc:  # noqa: BLE001
        st.error(f"❌ {exc}")
        return

    config, data, args = _build_legacy_payload(
        result, inp, language, selected_plot_keys, set(assets.keys()),
    )
    fig = make_plots(config, data, args)
    st.session_state.last_fig = fig

    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=200)
    buf.seek(0)
    st.session_state.last_plot = buf.getvalue()


if __name__ == "__main__":
    main()
