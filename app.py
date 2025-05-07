import streamlit as st
import os
from datetime import datetime
import matplotlib.pyplot as plt
from main import (
    Config,
    calculate_dollar_rates_annual,
    calculate_dollar_rates_monthly,
    calculate_annual_payment_usd,
    calculate_monthly_payment_usd,
    calculate_cumulative_payment_usd,
    calculate_usd_salaries,
    calculate_total_credit_amount,
    calculate_monthly_payment_tl,
    make_plots
)

# Set page config with sidebar initially collapsed
st.set_page_config(
    page_title="🏠 Real Estate Projection",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Sidebar - Theme
with st.sidebar:
    st.markdown("### 🎨 Theme Settings")
    theme = st.selectbox("Choose Theme", ["Dark", "Light"], index=0)

# Apply theme styles
if theme == "Dark":
    plt.style.use('dark_background')
    st.markdown("""
        <style>
        .stApp {
            background-color: #0E1117;
            color: #FAFAFA;
        }
        .stButton>button {
            background-color: #262730;
            color: #FAFAFA;
        }
        </style>
    """, unsafe_allow_html=True)
else:
    plt.style.use('default')
    st.markdown("""
        <style>
        .stApp {
            background-color: #FFFFFF;
            color: #262730;
        }
        .stButton>button {
            background-color: #F0F2F6;
            color: #262730;
        }
        </style>
    """, unsafe_allow_html=True)

st.title("🏠 Real Estate Projection")

# Layout: Columns
col1, col2, col_group = st.columns([1, 1, 4])

with col1:
    st.markdown("### 📊 Basic Parameters")
    years = st.number_input("Years", min_value=1, max_value=30, value=10)
    interest_rate = st.number_input("Interest Rate (%)", min_value=0.0, max_value=100.0, value=2.89)
    start_dollar_tl = st.number_input("Start Dollar/TL Rate", min_value=1.0, value=38.6)
    dollar_growth_rate = st.number_input("Dollar Growth Rate (%)", min_value=0.0, value=35.0)
    
    st.markdown("### 💼 Salary Parameters")
    salary_currency = st.selectbox("Salary Currency", ["EUR", "USD", "TL"], index=0)
    start_salary_base = st.number_input("Start Salary", min_value=0, value=32000)
    salary_growth = st.number_input("Salary Growth Rate (%)", min_value=0.0, value=6.0)
    euro_dollar_rate = st.number_input("Euro/Dollar Rate", min_value=0.0, value=1.15)
pass

with col2:
    st.markdown("### 🏠 Property Parameters")
    initial_noncredit_amount = st.number_input("Initial Non-Credit Amount (TL)", min_value=0, value=1000000)
    value_of_house_tl = st.number_input("Value of House (TL)", min_value=0, value=2500000)
    price_rent_ratio = st.number_input("Price/Rent Ratio (Years)", min_value=1, value=15)
    
    with st.expander("📈 Advanced Inflation Parameters"):
        usa_inflation = st.number_input("USA Inflation Rate (%)", min_value=0.0, value=3.0)
        turkey_inflation = st.number_input("Turkey Inflation Rate (%)", min_value=0.0, value=35.0)
        include_inflation = st.checkbox("Include Inflation in Calculations", value=False)
    
    st.markdown("### 📊 Plot Options")
    use_months = st.checkbox("Use Monthly View", value=False)
    save_plots = st.checkbox("Save Plots to File", value=False)
    
    st.markdown("### 📌 Select Plots")
    plot_annual_payment = st.checkbox("Annual Payment (USD)", value=False)
    plot_dollar_rates = st.checkbox("Dollar Rates", value=False)
    plot_dollar_salaries = st.checkbox("Dollar Salaries", value=False)
    plot_cumulative_payment = st.checkbox("Cumulative Payment (USD)", value=False)
    plot_total_credit = st.checkbox("Total Credit Amount", value=False)
    plot_value_of_house = st.checkbox("Value of House (USD)", value=False)
    plot_monthly_payment = st.checkbox("Monthly Payment (USD)", value=False)
pass

# Generate button with spinner
if st.button("🚀 Generate Plot"):
    with st.spinner("Calculating and generating plot..."):
        try:
            monthly_tl_payment = calculate_monthly_payment_tl(
                value_of_house_tl - initial_noncredit_amount,
                interest_rate,
                years
            )

            config = Config(
                years=years,
                monthly_tl_payment=monthly_tl_payment,
                annual_tl_payment=monthly_tl_payment * 12,
                start_dollar_tl=start_dollar_tl,
                dollar_growth_rate_annual=dollar_growth_rate / 100,
                dollar_growth_rate_monthly=dollar_growth_rate / 1200,
                start_salary_base=start_salary_base,
                salary_growth_annual=salary_growth / 100,
                euro_dollar_rate=euro_dollar_rate,
                initial_noncredit_amount=initial_noncredit_amount,
                initial_noncredit_amount_usd=initial_noncredit_amount / start_dollar_tl,
                value_of_house_tl=value_of_house_tl,
                value_of_house_usd=value_of_house_tl / start_dollar_tl,
                save_plots=save_plots,
                usa_inflation_rate=usa_inflation / 100,
                turkey_inflation_rate=turkey_inflation / 100,
                price_rent_ratio_yearly=price_rent_ratio,
                salary_currency=salary_currency,
                include_inflation=include_inflation
            )

            dollar_rates_annual = calculate_dollar_rates_annual(config.start_dollar_tl, config.dollar_growth_rate_annual, config.years)
            dollar_rates_monthly = calculate_dollar_rates_monthly(config.start_dollar_tl, config.dollar_growth_rate_monthly, config.years)
            annual_payment_usd = calculate_annual_payment_usd(config.annual_tl_payment, dollar_rates_annual)
            monthly_payment_usd = calculate_monthly_payment_usd(config.monthly_tl_payment, dollar_rates_monthly)
            cumulative_payment_usd_annual = calculate_cumulative_payment_usd(annual_payment_usd)
            cumulative_payment_usd_monthly = calculate_cumulative_payment_usd(monthly_payment_usd)
            dollar_salaries = calculate_usd_salaries(
                config.start_salary_base,
                config.salary_growth_annual,
                config.years,
                config.euro_dollar_rate,
                config.salary_currency,
                dollar_rates_annual
            )

            data = {
                'dollar_rates_annual': dollar_rates_annual,
                'dollar_rates_monthly': dollar_rates_monthly,
                'annual_payment_usd': annual_payment_usd,
                'monthly_payment_usd': monthly_payment_usd,
                'cumulative_payment_usd_annual': cumulative_payment_usd_annual,
                'cumulative_payment_usd_monthly': cumulative_payment_usd_monthly,
                'dollar_salaries': dollar_salaries
            }

            class Args:
                def __init__(self):
                    self.plot_annual_payment_usd = plot_annual_payment
                    self.plot_dollar_rates = plot_dollar_rates
                    self.plot_dollar_salaries = plot_dollar_salaries
                    self.plot_cumulative_payment_usd = plot_cumulative_payment
                    self.plot_total_credit_amount_with_initial_noncredit_amount = plot_total_credit
                    self.plot_value_of_house_usd = plot_value_of_house
                    self.plot_monthly_payment_usd = plot_monthly_payment
                    self.use_months = use_months

            args = Args()

            make_plots(config, data, args)
            
            plot_filename = "monthly_dollar_house_credit_cumulative_salary.png" if use_months else "annual_dollar_house_credit_cumulative_salary.png"
            
            if os.path.exists(plot_filename):
                # Display plot in columns 3-6
                with col_group:
                    st.image(plot_filename, caption=f"Generated Plot ({'Monthly' if use_months else 'Annual'})", use_container_width=True)
                
                # If save_plots is not selected, remove the file after displaying
                if not save_plots:
                    try:
                        os.remove(plot_filename)
                    except:
                        pass
                
        except Exception as e:
            st.error(f"❌ An error occurred: {str(e)}")

# Footer tips
with st.expander("💡 How to Use"):
    st.markdown("""
    1. Adjust the parameters in the control panel
    2. Select your salary currency (EUR, USD, or TL)
    3. Choose whether to include inflation in calculations
    4. Select which plots you want to display
    5. Click "Generate Plot" to create the visualization
    6. The plot will appear in the right columns and optionally be saved

    **Tips:**
    - Use the monthly view for more detailed analysis
    - Adjust the dollar growth rate to simulate different scenarios
    - Compare property values and initial payments for investment insights
    - Enable "Save Plots to File" if you want to keep the generated plots
    """)
