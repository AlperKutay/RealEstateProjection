import streamlit as st
import os
from datetime import datetime
import matplotlib.pyplot as plt
from io import BytesIO
import numpy as np
from stock_market_helper import fetch_and_calculate

from main import (
    Config,
    calculate_with_annual_growth_rate,
    calculate_with_monthly_growth_rate,
    calculate_annual_payment_usd,
    calculate_monthly_payment_usd,
    calculate_cumulative_payment_usd,
    calculate_usd_salaries,
    calculate_total_credit_amount,
    calculate_monthly_payment_tl,
    make_plots,
    generate_random_values_yearly,
    generate_random_values_monthly,
    generate_monthly_salaries_from_yearly,
    calculate_rent_price_usd,
    generate_rent_price_usd_monthly,
    calculate_cumulative_rent_price_usd,
    calculate_cumulative_rent_price_usd_monthly

)

# Initialize session state for storing the last generated plot and language
if 'last_plot' not in st.session_state:
    st.session_state.last_plot = None
if 'last_plot_caption' not in st.session_state:
    st.session_state.last_plot_caption = None
if 'language' not in st.session_state:
    st.session_state.language = 'English'
if 'last_fig' not in st.session_state:
    st.session_state.last_fig = None

# Set page config with sidebar initially collapsed
st.set_page_config(
    page_title="🏠 Real Estate Projection",
    layout="wide",
    initial_sidebar_state="collapsed"
)
# Mobil görünüm için responsive ayarlar
st.markdown("""
    <style>
        .stApp {
            overflow-x: hidden;
        }
        @media (max-width: 768px) {
            .stButton > button {
                width: 100%;
            }
            .stDownloadButton > button {
                width: 100%;
            }
        }
    </style>
""", unsafe_allow_html=True)

# Sidebar - Theme and Language
with st.sidebar:
    st.markdown("### 🎨 Theme Settings")
    theme = st.selectbox("Choose Theme", ["Dark"], index=0) #, "Light"
    
    st.markdown("### 🌍 Language / Dil")
    language = st.radio("Select Language / Dil Seçin", ["English", "Türkçe"], index=0 if st.session_state.language == 'English' else 1)
    st.session_state.language = language


    # Footer tips based on language
    if language == "English":
        st.markdown("""
        ### **How to Use:**
        1. Adjust the parameters in the control panel
        2. Select your salary currency (For now only USD)
        3. Choose whether to include inflation in calculations
        4. Select which plots you want to display
        5. Click "Generate Plot" to create the visualization
        6. The plot will appear in the right columns and optionally be saved

        **Tips:**
        - Use the monthly view for more detailed analysis
        - Adjust the dollar growth rate to simulate different scenarios
        - Compare property values and initial payments for investment insights
        - Enable "Download Plot" if you want to keep the generated plots
        """)
    else:
        st.markdown("""
        ### **Kullanım:**
        1. Kontrol panelinden parametreleri ayarlayın
        2. Maaş para biriminizi seçin (Simdilik sadece USD)
        3. Hesaplamalarda enflasyonu dahil etmek isteyip istemediğinizi seçin
        4. Gösterilecek grafikleri seçin
        5. Görselleştirmeyi oluşturmak için "Grafik Oluştur" düğmesine tıklayın
        6. Grafik sağ sütunlarda görünecek ve isteğe bağlı olarak kaydedilebilecek

        **İpuçları:**
        - Daha detaylı analiz için aylık görünümü kullanın
        - Farklı senaryoları simüle etmek için dolar artış oranını ayarlayın
        - Yatırım içgörüleri için mülk değerlerini ve başlangıç ödemelerini karşılaştırın
        - Oluşturulan grafikleri saklamak istiyorsanız "Grafikleri İndir"i etkinleştirin
        """)

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

st.title("🏠 Real Estate Projection" if language == "English" else "🏠 Gayrimenkul Projeksiyonu")

st.markdown("### " + ("Create Custom X-Y Plot" if language == "English" else "Özel X-Y Grafik Oluştur"))

plot_dollar_rates = False
plot_annual_payment = False
plot_dollar_salaries = False
plot_payment_salary_ratio = False
plot_payment_and_rent_ratio_with_salary = False
plot_cumulative_payment = False
plot_total_credit = False
plot_value_of_house = False
plot_rent_price = False
plot_cumulative_rent_price = False
plot_value_of_house_with_rent_price = False

plot_gold_price = False
plot_silver_price = False
plot_btc_price = False
plot_eth_price = False
plot_xu100_price = False
plot_xu30_price = False
plot_nasdaq_price = False
plot_sp_price = False

average_gold_growth = None
average_silver_growth = None
average_btc_growth = None
average_eth_growth = None
average_xu100_growth = None
average_xu30_growth = None
average_nasdaq_growth = None
average_sp_growth = None

current_gold_price = None
current_silver_price = None
current_btc_price = None
current_eth_price = None
current_xu100_price = None
current_xu30_price = None
current_nasdaq_price = None
current_sp_price = None
# Define available plot options and mapping to data dictionary keys
available_plot_keys_en = [
    "Years",
    "Months"
]

available_plot_keys_tr = [
    "Yıllık",
    "Aylık"
]

plot_key_map_en = {
    "Dollar Rate": "plot_dollar_rates",
    "Mortgage Payment": "plot_annual_payment",
    "Base Salary": "plot_dollar_salaries",
    "Mortgage Payment / Salary Ratio": "plot_payment_salary_ratio",
    "Mortgage Payment - Rent Price / Salary Ratio": "plot_payment_and_rent_ratio_with_salary",
    "Cumulative Mortgage Payment": "plot_cumulative_payment",
    "Total Paid Mortgage with Initial Non-Credit Amount": "plot_total_credit",
    "Price of the House": "plot_value_of_house",
    "Rent Price": "plot_rent_price",
    "Cumulative Rent Price": "plot_cumulative_rent_price",
    "Initial Price of the House with Rent Price": "plot_value_of_house_with_rent_price"
}

plot_key_map_tr = {
    "Dolar TL": "plot_dollar_rates",
    "Kredi Ödemesi": "plot_annual_payment",
    "Maaş": "plot_dollar_salaries",
    "Kredi Ödemesi / Maaş Oranı": "plot_payment_salary_ratio",
    "Kredi Ödemesi - Kira Fiyatı / Maaş Oranı": "plot_payment_and_rent_ratio_with_salary",
    "Toplam Ödenen Kredi": "plot_cumulative_payment",
    "Toplam Ödenen Kredi - Başlangıç Peşinat": "plot_total_credit",
    "Ev Fiyatı": "plot_value_of_house",
    "Kira Fiyatı": "plot_rent_price",
    "Toplam Elde Edilen Kira Fiyatı": "plot_cumulative_rent_price",
    "Ev Fiyatı - Kira Fiyatı": "plot_value_of_house_with_rent_price"
}

plot_stock_market = {
    "XAUUSD": "plot_gold_price",
    "XAGUSD": "plot_silver_price",
    "BTC": "plot_btc_price",
    "ETH": "plot_eth_price",
    "XU100": "plot_xu100_price",
    "XU30": "plot_xu30_price",
    "NASDAQ": "plot_nasdaq_price",
    "S&P": "plot_sp_price"
}

# Create dropdown selectors for X and Y axes
col_x, col_y1, col_y2, col_z = st.columns(4)
with col_x:
    x_axis = st.selectbox("Time Period" if language == "English" else "Zaman Periyodu", available_plot_keys_en if language == "English" else available_plot_keys_tr, index=0)
with col_y1:
    y_axis = st.multiselect("Select Plot" if language == "English" else "Grafik Seçin", list(plot_key_map_en.keys()) if language == "English" else list(plot_key_map_tr.keys()), default=["Dollar Rate"] if language == "English" else ["Dolar TL"])
with col_y2:
    y_axis2 = st.multiselect("Select Stock Market Plot" if language == "English" else "Hisse Senedi Grafiği Seçin", list(plot_stock_market.keys()), default=[])
with col_z:
    z_axis = st.selectbox("Currency", ["USD"], index=0)#"USD", "TL", "EUR"

if x_axis == "Months" or x_axis == "Aylık":
    use_months = True
else:
    use_months = False

# Use the correct key maps based on language
plot_key_map = plot_key_map_en if language == "English" else plot_key_map_tr

# Process y_axis selections using the appropriate language map
for y_item in y_axis:
    if y_item in plot_key_map:
        plot_var_name = plot_key_map[y_item]
        globals()[plot_var_name] = True

# Process stock market selections
for y_item in y_axis2:
    if y_item in plot_stock_market:
        globals()[plot_stock_market[y_item]] = True
        if y_item == "XAUUSD":
            average_gold_growth, current_gold_price = fetch_and_calculate("XAUUSD", False)
        elif y_item == "XAGUSD":
            average_silver_growth, current_silver_price = fetch_and_calculate("XAGUSD", False)
        elif y_item == "BTC":
            average_btc_growth, current_btc_price = fetch_and_calculate("BTC", False)
        elif y_item == "ETH":
            average_eth_growth, current_eth_price = fetch_and_calculate("ETH", False)
        elif y_item == "XU100":
            average_xu100_growth, current_xu100_price = fetch_and_calculate("XU100", False)
        elif y_item == "XU30":
            average_xu30_growth, current_xu30_price = fetch_and_calculate("XU30", False)
        elif y_item == "NASDAQ":
            average_nasdaq_growth, current_nasdaq_price = fetch_and_calculate("NASDAQ", False)
        elif y_item == "S&P":
            average_sp_growth, current_sp_price = fetch_and_calculate("S&P", False)

# Layout: Columns
col1, col2, col_group = st.columns([1, 1, 4])

with col1:
    st.markdown("### 📊 " + ("Basic Parameters" if language == "English" else "Temel Parametreler"))
    years = st.number_input("Loan Period (Years)" if language == "English" else "Kredi Vadesi (Yıl)", min_value=1, max_value=30, value=10)
    interest_rate = st.number_input("Mortgage Interest Rate (%)" if language == "English" else "Mortgage Faiz Oranı (%)", min_value=0.0, max_value=100.0, value=2.89)
    start_dollar_tl = st.number_input("Initial Dollar/TL Rate" if language == "English" else "Başlangıç Dolar/TL Kuru", min_value=1.0, value=38.6)
    dollar_growth_rate = st.number_input("Dollar Increase Rate Yearly(%)" if language == "English" else "Yıllık Dolar Artış Oranı(%)", min_value=0.0, value=35.0)
    
    st.markdown("### 💼 " + ("Salary Parameters" if language == "English" else "Maaş Parametreleri"))
    salary_currency = st.selectbox("Salary Currency" if language == "English" else "Maaş Para Birimi", ["EUR", "USD", "TL"], index=0)
    salary_type = st.selectbox("Salary Type" if language == "English" else "Maaş Tipi", ["Yearly", "Monthly"] if language == "English" else ["Yıllık", "Aylık"], index=0)
    start_salary_base = st.number_input("Start Salary (Net)" if language == "English" else "Başlangıç Maaşı (Net)", min_value=0, value=0)
    salary_growth = st.number_input("Salary Increase Rate (%)" if language == "English" else "Maaş Artış Oranı (%)", min_value=0.0, value=0.0)
    euro_dollar_rate = st.number_input("Euro/Dollar Rate" if language == "English" else "Euro/Dolar Kuru", min_value=0.0, value=1.15)
    months_to_increase = st.number_input("Months to Increase Salary" if language == "English" else "Maaş Artışına Kalan Ay Sayısı", min_value=0,max_value=12, value=12)
with col2:
    st.markdown("### 🏠 " + ("Property Parameters" if language == "English" else "Mülk Parametreleri"))
    initial_noncredit_amount = st.number_input("Initial Non-Credit Amount (Million TL)" if language == "English" else "Başlangıç Peşinat (Milyon TL)", min_value=0.0, value=1.0)
    value_of_house_tl = st.number_input("Value of House (Million TL)" if language == "English" else "Ev Değeri (Milyon TL)", min_value=0.0, value=2.5)
    price_rent_ratio = st.number_input("Price/Rent Ratio (Years)" if language == "English" else "Fiyat/Kira Oranı (Yıl)", min_value=1, value=15)
    
    st.markdown("### 📈 " + ("Advanced Parameters" if language == "English" else "Gelişmiş Parametreler"))
    usa_inflation = st.number_input("USA Inflation Rate (%)" if language == "English" else "ABD Enflasyon Oranı (%)", min_value=0.0, value=3.0)
    turkey_inflation = st.number_input("Turkey Inflation Rate (%)" if language == "English" else "Türkiye Enflasyon Oranı (%)", min_value=0.0, value=35.0)
    include_inflation = st.checkbox("Include Inflation in Calculations" if language == "English" else "Hesaplamalarda Enflasyonu Dahil Et", value=False)
    generate_random_values = st.checkbox("Generate Random Values" if language == "English" else "Rastgele Değerler Oluştur", value=False)
    project_initial_money_with_selected_stock_market = st.checkbox("Project Initial Money with Selected Financial Asset" if language == "English" else "Başlangıç Parasıyla Seçilen Finansal Varlığı Satın Al", value=False)
    #generate_random_inflation_values = st.checkbox("Generate Random Inflation Values" if language == "English" else "Rastgele Enflasyon Değerleri Oluştur", value=False)
        #use_months = st.checkbox("Use Monthly View" if language == "English" else "Aylık Görünüm Kullan", value=False)
    #st.markdown("### 📊 Plot Options")
    
    save_plots = False #st.checkbox("Save Plots to File", value=False)
    


with col2:
    # Generate button with spinner
    if st.button("🚀 " + ("Generate Plot" if language == "English" else "Grafik Oluştur")):
        with st.spinner("Calculating and generating plot..." if language == "English" else "Hesaplanıyor ve grafik oluşturuluyor..."):
            try:
                initial_noncredit_amount = initial_noncredit_amount * 1000000
                value_of_house_tl = value_of_house_tl * 1000000
                monthly_tl_payment = calculate_monthly_payment_tl(
                    value_of_house_tl - initial_noncredit_amount,
                    interest_rate,
                    years
                )
                initial_rent_price = value_of_house_tl / (price_rent_ratio * 12)
                start_salary_base = start_salary_base if salary_type == "Yearly" else start_salary_base * 12
                config = Config(
                    years=years,
                    monthly_tl_payment=monthly_tl_payment,
                    annual_tl_payment=monthly_tl_payment * 12,
                    start_dollar_tl=start_dollar_tl,
                    dollar_growth_rate_annual=dollar_growth_rate / 100,
                    dollar_growth_rate_monthly=(((dollar_growth_rate / 100) + 1) ** (1/12)) - 1,
                    start_salary_base=start_salary_base,
                    salary_growth_annual=salary_growth / 100,
                    euro_dollar_rate=euro_dollar_rate,
                    initial_noncredit_amount=initial_noncredit_amount,
                    initial_noncredit_amount_usd=initial_noncredit_amount / start_dollar_tl,
                    value_of_house_tl=value_of_house_tl,
                    value_of_house_usd=value_of_house_tl / start_dollar_tl,
                    save_plots=save_plots,
                    usa_inflation_rate=usa_inflation / 100,
                    usa_inflation_rate_monthly=(((usa_inflation / 100) + 1) ** (1/12)) - 1,
                    turkey_inflation_rate=turkey_inflation / 100,
                    turkey_inflation_rate_monthly=(((turkey_inflation / 100) + 1) ** (1/12)) - 1,
                    price_rent_ratio_yearly=price_rent_ratio,
                    salary_currency=salary_currency,
                    include_inflation=include_inflation,
                    language=language,
                    months_to_increase=months_to_increase,
                    initial_rent_price_tl=initial_rent_price,
                    interest_rate=interest_rate
                )
                dollar_rates_annual = None
                dollar_rates_monthly = None
                annual_payment_usd = None
                monthly_payment_usd = None
                cumulative_payment_usd_annual = None
                cumulative_payment_usd_monthly = None
                dollar_salaries = None
                rent_price_usd_yearly = None
                rent_price_usd_monthly = None
                cumulative_rent_price_usd_yearly = None
                cumulative_rent_price_usd_monthly = None
                value_of_house_usd_yearly = None
                value_of_house_usd_monthly = None
                
                gold_price = None
                silver_price = None
                btc_price = None
                eth_price = None
                xu100_price = None
                xu30_price = None
                nasdaq_price = None
                sp_price = None

                if not include_inflation:
                    config.turkey_inflation_rate = 0.001
                    config.usa_inflation_rate = 0.001
                    config.usa_inflation_rate_monthly = 0.000001
                    config.turkey_inflation_rate_monthly = 0.000001
                
                if generate_random_values and not use_months:
                    if include_inflation:
                        dollar_rates_annual, adjusted_yearly_dollar_increases = generate_random_values_yearly(config.start_dollar_tl, config.years, dollar_growth_rate - config.usa_inflation_rate)
                    else:
                        dollar_rates_annual, adjusted_yearly_dollar_increases = generate_random_values_yearly(config.start_dollar_tl, config.years, dollar_growth_rate)

                elif generate_random_values and use_months:

                    if include_inflation:
                        dollar_rates_annual, adjusted_yearly_dollar_increases, dollar_rates_monthly = generate_random_values_monthly(config.start_dollar_tl, config.years, dollar_growth_rate - config.usa_inflation_rate)
                    else:
                        dollar_rates_annual, adjusted_yearly_dollar_increases, dollar_rates_monthly = generate_random_values_monthly(config.start_dollar_tl, config.years, dollar_growth_rate)
                else:
                    if include_inflation:
                        dollar_rates_annual = calculate_with_annual_growth_rate(config.start_dollar_tl, config.dollar_growth_rate_annual - config.usa_inflation_rate, config.years)
                        dollar_rates_monthly = calculate_with_monthly_growth_rate(config.start_dollar_tl, config.dollar_growth_rate_monthly - config.usa_inflation_rate_monthly, config.years)
                    else:
                        dollar_rates_annual = calculate_with_annual_growth_rate(config.start_dollar_tl, config.dollar_growth_rate_annual, config.years)
                        dollar_rates_monthly = calculate_with_monthly_growth_rate(config.start_dollar_tl, config.dollar_growth_rate_monthly, config.years)
                
                dollar_rates_annual_np = np.array(dollar_rates_annual)
                dollar_rates_monthly_np = np.array(dollar_rates_monthly)

                if use_months:
                    monthly_payment_usd = calculate_monthly_payment_usd(config.monthly_tl_payment, dollar_rates_monthly)
                    cumulative_payment_usd_monthly = calculate_cumulative_payment_usd(monthly_payment_usd)
                    if generate_random_values:
                        same_currency_salaries , _ = generate_random_values_yearly(config.start_salary_base, config.years, config.salary_growth_annual * 100)
                        dollar_salaries = generate_monthly_salaries_from_yearly(same_currency_salaries, months_to_increase, dollar_rates_monthly, config.euro_dollar_rate, config.salary_currency)
                    else:
                        dollar_salaries,same_currency_salaries = calculate_usd_salaries(config.start_salary_base, config.salary_growth_annual, config.years, config.euro_dollar_rate, config.salary_currency, dollar_rates_annual) 
                        dollar_salaries = generate_monthly_salaries_from_yearly(same_currency_salaries, months_to_increase, dollar_rates_monthly, config.euro_dollar_rate, config.salary_currency)
                    
                else:
                    annual_payment_usd = calculate_annual_payment_usd(config.annual_tl_payment, dollar_rates_annual)
                    cumulative_payment_usd_annual = calculate_cumulative_payment_usd(annual_payment_usd)
                    if generate_random_values:
                        dollar_salaries , _ = generate_random_values_yearly(config.start_salary_base, config.years, config.salary_growth_annual * 100)
                    else:
                        dollar_salaries, _  = calculate_usd_salaries(config.start_salary_base, config.salary_growth_annual, config.years, config.euro_dollar_rate, config.salary_currency, dollar_rates_annual) 
                
                if generate_random_values:
                    rent_price_yearly_tl,adjusted_yearly_turkey_inflation_rates = generate_random_values_yearly(config.initial_rent_price_tl*12, config.years, turkey_inflation)
                    value_of_house_tl_yearly, _ = generate_random_values_yearly(config.value_of_house_tl, config.years, turkey_inflation)
                    rent_price_yearly_tl_np = np.array(rent_price_yearly_tl)
                    rent_price_usd_yearly = rent_price_yearly_tl_np / dollar_rates_annual_np
                    value_of_house_usd_yearly = value_of_house_tl_yearly / dollar_rates_annual_np
                    if use_months:
                        # Use the initial rent price, not the array
                        rent_price_monthly_tl = generate_monthly_salaries_from_yearly(rent_price_yearly_tl_np, 12, dollar_rates_monthly, config.euro_dollar_rate, "USD")#Çalışsın dıye boyle yazdım 
                        _, _, value_of_house_tl_monthly = generate_random_values_monthly(config.value_of_house_tl, config.years, turkey_inflation)
                        rent_price_monthly_tl_np = np.array(rent_price_monthly_tl)
                        dollar_rates_monthly_np = np.array(dollar_rates_monthly)
                        value_of_house_tl_monthly_np = np.array(value_of_house_tl_monthly)
                        rent_price_usd_monthly = rent_price_monthly_tl_np / dollar_rates_monthly_np
                        value_of_house_usd_monthly = value_of_house_tl_monthly_np / dollar_rates_monthly_np
                else:
                    rent_price_usd_yearly,rent_price_tl_yearly = calculate_rent_price_usd(config.initial_rent_price_tl, config.turkey_inflation_rate, dollar_rates_annual)
                    if use_months:
                        rent_price_usd_monthly = generate_rent_price_usd_monthly(rent_price_tl_yearly, config.turkey_inflation_rate, dollar_rates_monthly)
                        value_of_house_tl_monthly = calculate_with_monthly_growth_rate(config.value_of_house_tl, config.turkey_inflation_rate_monthly, config.years)
                        value_of_house_tl_monthly_np = np.array(value_of_house_tl_monthly)
                        value_of_house_usd_monthly = value_of_house_tl_monthly_np / dollar_rates_monthly_np
                    else:
                        value_of_house_usd_yearly = calculate_with_annual_growth_rate(config.value_of_house_tl, config.turkey_inflation_rate, config.years)
                        value_of_house_usd_yearly_np = np.array(value_of_house_usd_yearly)
                        value_of_house_usd_yearly = value_of_house_usd_yearly_np / dollar_rates_annual_np
                
                if current_gold_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_gold_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, gold_price = generate_random_values_monthly(current_gold_price, config.years, average_gold_growth)
                    elif not generate_random_values and use_months:
                        gold_price = calculate_with_monthly_growth_rate(current_gold_price, (((average_gold_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        gold_price = calculate_with_annual_growth_rate(current_gold_price, average_gold_growth / 100, config.years)
                    else:
                        gold_price , _ = generate_random_values_yearly(current_gold_price, config.years, average_gold_growth)
                    
                    

                if current_silver_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_silver_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, silver_price = generate_random_values_monthly(current_silver_price, config.years, average_silver_growth)
                    elif not generate_random_values and use_months:
                        silver_price = calculate_with_monthly_growth_rate(current_silver_price, (((average_silver_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        silver_price = calculate_with_annual_growth_rate(current_silver_price, average_silver_growth / 100, config.years)
                    else:
                        silver_price , _  = generate_random_values_yearly(current_silver_price, config.years, average_silver_growth)

  

                if current_btc_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_btc_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, btc_price = generate_random_values_monthly(current_btc_price, config.years, average_btc_growth)
                    elif not generate_random_values and use_months:
                        btc_price = calculate_with_monthly_growth_rate(current_btc_price, (((average_btc_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        btc_price = calculate_with_annual_growth_rate(current_btc_price, average_btc_growth / 100, config.years)
                    else:
                        btc_price , _  = generate_random_values_yearly(current_btc_price, config.years, average_btc_growth)

                if current_eth_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_eth_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, eth_price = generate_random_values_monthly(current_eth_price, config.years, average_eth_growth)
                    elif not generate_random_values and use_months:
                        eth_price = calculate_with_monthly_growth_rate(current_eth_price, (((average_eth_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        eth_price = calculate_with_annual_growth_rate(current_eth_price, average_eth_growth / 100, config.years)
                    else:
                        eth_price , _  = generate_random_values_yearly(current_eth_price, config.years, average_eth_growth)


                if current_xu100_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_xu100_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, xu100_price = generate_random_values_monthly(current_xu100_price, config.years, average_xu100_growth)
                    elif not generate_random_values and use_months:
                        xu100_price = calculate_with_monthly_growth_rate(current_xu100_price, (((average_xu100_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        xu100_price = calculate_with_annual_growth_rate(current_xu100_price, average_xu100_growth / 100, config.years)
                    else:
                        xu100_price , _  = generate_random_values_yearly(current_xu100_price, config.years, average_xu100_growth)

                if current_xu30_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_xu30_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, xu30_price = generate_random_values_monthly(current_xu30_price, config.years, average_xu30_growth)
                    elif not generate_random_values and use_months:
                        xu30_price = calculate_with_monthly_growth_rate(current_xu30_price, (((average_xu30_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        xu30_price = calculate_with_annual_growth_rate(current_xu30_price, average_xu30_growth / 100, config.years)
                    else:
                        xu30_price , _  = generate_random_values_yearly(current_xu30_price, config.years, average_xu30_growth)


                if current_nasdaq_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_nasdaq_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, nasdaq_price = generate_random_values_monthly(current_nasdaq_price, config.years, average_nasdaq_growth)
                    elif not generate_random_values and use_months:
                        nasdaq_price = calculate_with_monthly_growth_rate(current_nasdaq_price, (((average_nasdaq_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        nasdaq_price = calculate_with_annual_growth_rate(current_nasdaq_price, average_nasdaq_growth / 100, config.years)
                    else:
                        nasdaq_price , _  = generate_random_values_yearly(current_nasdaq_price, config.years, average_nasdaq_growth)


                if current_sp_price is not None:
                    if project_initial_money_with_selected_stock_market:
                        current_sp_price = config.initial_noncredit_amount_usd 
                    if use_months and generate_random_values:
                        _, _, sp_price = generate_random_values_monthly(current_sp_price, config.years, average_sp_growth)
                    elif not generate_random_values and use_months:
                        sp_price = calculate_with_monthly_growth_rate(current_sp_price, (((average_sp_growth / 100) + 1) ** (1/12)) - 1, config.years)
                    elif not generate_random_values and not use_months:
                        sp_price = calculate_with_annual_growth_rate(current_sp_price, average_sp_growth / 100, config.years)
                    else:
                        sp_price , _  = generate_random_values_yearly(current_sp_price, config.years, average_sp_growth)


                cumulative_rent_price_usd_yearly = calculate_cumulative_rent_price_usd(rent_price_usd_yearly)
                cumulative_rent_price_usd_monthly = calculate_cumulative_rent_price_usd_monthly(rent_price_usd_monthly)

                data = {
                    'dollar_rates_annual': dollar_rates_annual,
                    'dollar_rates_monthly': dollar_rates_monthly,
                    'annual_payment_usd': annual_payment_usd,
                    'monthly_payment_usd': monthly_payment_usd,
                    'cumulative_payment_usd_annual': cumulative_payment_usd_annual,
                    'cumulative_payment_usd_monthly': cumulative_payment_usd_monthly,
                    'dollar_salaries': dollar_salaries,
                    'rent_price_usd_yearly': rent_price_usd_yearly,
                    'rent_price_usd_monthly': rent_price_usd_monthly,
                    'cumulative_rent_price_usd_yearly': cumulative_rent_price_usd_yearly,
                    'cumulative_rent_price_usd_monthly': cumulative_rent_price_usd_monthly,
                    'value_of_house_usd_yearly': value_of_house_usd_yearly,
                    'value_of_house_usd_monthly': value_of_house_usd_monthly,
                    'gold_price': gold_price,
                    'silver_price': silver_price,
                    'btc_price': btc_price,
                    'eth_price': eth_price,
                    'xu100_price': xu100_price,
                    'xu30_price': xu30_price,
                    'nasdaq_price': nasdaq_price,
                    'sp_price': sp_price,
                    'average_gold_growth': average_gold_growth,
                    'average_silver_growth': average_silver_growth,
                    'average_btc_growth': average_btc_growth,
                    'average_eth_growth': average_eth_growth,
                    'average_xu100_growth': average_xu100_growth,
                    'average_xu30_growth': average_xu30_growth,
                    'average_nasdaq_growth': average_nasdaq_growth,
                    'average_sp_growth': average_sp_growth,
                }

                class Args:
                    def __init__(self):
                        self.plot_annual_payment_usd = plot_annual_payment
                        self.plot_dollar_rates = plot_dollar_rates
                        self.plot_dollar_salaries = plot_dollar_salaries
                        self.plot_cumulative_payment_usd = plot_cumulative_payment
                        self.plot_total_credit_amount_with_initial_noncredit_amount = plot_total_credit
                        self.plot_value_of_house_usd = plot_value_of_house
                        self.plot_payment_salary_ratio = plot_payment_salary_ratio
                        self.plot_monthly_payment_usd = 0 #plot_monthly_payment
                        self.use_months = use_months
                        self.plot_rent_price_usd = plot_rent_price
                        self.plot_cumulative_rent_price_usd = plot_cumulative_rent_price
                        self.plot_value_of_house_with_rent_price = plot_value_of_house_with_rent_price
                        self.plot_payment_and_rent_ratio_with_salary = plot_payment_and_rent_ratio_with_salary
                        self.plot_gold_price = plot_gold_price
                        self.plot_silver_price = plot_silver_price
                        self.plot_btc_price = plot_btc_price
                        self.plot_eth_price = plot_eth_price
                        self.plot_xu100_price = plot_xu100_price
                        self.plot_xu30_price = plot_xu30_price
                        self.plot_nasdaq_price = plot_nasdaq_price
                        self.plot_sp_price = plot_sp_price
                        
                args = Args()

                fig = make_plots(config, data, args)
                st.session_state.last_fig = fig
                
                # Save plot to bytes in memory
                buf = BytesIO()
                fig.savefig(buf, format='png', bbox_inches='tight', dpi=300)
                buf.seek(0)
                img_bytes = buf.getvalue()
                st.session_state.last_plot = img_bytes
                st.session_state.last_plot_caption = f"Generated Plot ({'Monthly' if use_months else 'Annual'})" if language == "English" else f"Oluşturulan Grafik ({'Aylık' if use_months else 'Yıllık'})"
                
            except Exception as e:
                st.error(f"❌ An error occurred: {str(e)}" if language == "English" else f"❌ Bir hata oluştu: {str(e)}")

# Display the last generated plot if it exists
if st.session_state.last_fig is not None:
    with col_group:
        st.pyplot(st.session_state.last_fig, use_container_width=True)
        
        # Only show download button if there's a plot
        if st.session_state.last_plot is not None:
            with col2:
                st.download_button(
                    label="📥 " + ("Download Plot" if language == "English" else "Grafiği İndir"),
                    data=st.session_state.last_plot,
                    file_name=f"real_estate_projection_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png",
                    mime="image/png"
                )