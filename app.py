import streamlit as st
import os
from datetime import datetime
import matplotlib.pyplot as plt
from io import BytesIO
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
    make_plots,
    generate_random_values_yearly,
    generate_random_values_monthly,
    generate_monthly_salaries_from_yearly,
    calculate_rent_price_usd,
    generate_rent_price_usd_monthly
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
        2. Select your salary currency (EUR, USD, or TL)
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
        2. Maaş para biriminizi seçin (EUR, USD veya TL)
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
    start_salary_base = st.number_input("Start Salary" if language == "English" else "Başlangıç Maaşı (Brut)", min_value=0, value=0)
    salary_growth = st.number_input("Salary Increase Rate (%)" if language == "English" else "Maaş Artış Oranı (%)", min_value=0.0, value=0.0)
    euro_dollar_rate = st.number_input("Euro/Dollar Rate" if language == "English" else "Euro/Dolar Kuru", min_value=0.0, value=1.15)
    months_to_increase = st.number_input("Months to Increase Salary" if language == "English" else "Maaş Artışına Kalan Ay Sayısı", min_value=0,max_value=12, value=12)
with col2:
    st.markdown("### 🏠 " + ("Property Parameters" if language == "English" else "Mülk Parametreleri"))
    initial_noncredit_amount = st.number_input("Initial Non-Credit Amount (Million TL)" if language == "English" else "Başlangıç Peşinat (Milyon TL)", min_value=0.0, value=1.0)
    value_of_house_tl = st.number_input("Value of House (Million TL)" if language == "English" else "Ev Değeri (Milyon TL)", min_value=0.0, value=2.5)
    price_rent_ratio = st.number_input("Price/Rent Ratio (Years)" if language == "English" else "Fiyat/Kira Oranı (Yıl)", min_value=1, value=15)
    
    with st.expander("📈 " + ("Advanced Parameters" if language == "English" else "Gelişmiş Parametreler")):
        usa_inflation = st.number_input("USA Inflation Rate (%)" if language == "English" else "ABD Enflasyon Oranı (%)", min_value=0.0, value=3.0)
        turkey_inflation = st.number_input("Turkey Inflation Rate (%)" if language == "English" else "Türkiye Enflasyon Oranı (%)", min_value=0.0, value=35.0)
        include_inflation = st.checkbox("Include Inflation in Calculations" if language == "English" else "Hesaplamalarda Enflasyonu Dahil Et", value=False)
        generate_random_dollar_values = st.checkbox("Generate Random Dollar Values" if language == "English" else "Rastgele Dolar Değerleri Oluştur", value=False)
        #generate_random_inflation_values = st.checkbox("Generate Random Inflation Values" if language == "English" else "Rastgele Enflasyon Değerleri Oluştur", value=False)
        use_months = st.checkbox("Use Monthly View" if language == "English" else "Aylık Görünüm Kullan", value=False)
    #st.markdown("### 📊 Plot Options")
    
    save_plots = False #st.checkbox("Save Plots to File", value=False)
    
    st.markdown("### 📌 " + ("Select Plots" if language == "English" else "Grafikleri Seç"))
    plot_annual_payment = st.checkbox("Mortgage Payment (USD)" if language == "English" else "Mortgage Ödemesi (USD)", value=False)
    plot_dollar_rates = st.checkbox("USD/TL Rates" if language == "English" else "USD/TL Kurları", value=False)
    plot_dollar_salaries = st.checkbox("Base Salary (USD)" if language == "English" else "Temel Maaş (USD)", value=False)
    plot_cumulative_payment = st.checkbox("Cumulative Mortgage Payment (USD)" if language == "English" else "Kümülatif Mortgage Ödemesi (USD)", value=False)
    plot_total_credit = st.checkbox("Total Paid Mortgage (USD)" if language == "English" else "Toplam Ödenen Mortgage (USD)", value=False)
    plot_value_of_house = st.checkbox("Price of the House (USD)" if language == "English" else "Ev Fiyatı (USD)", value=False)
    plot_payment_salary_ratio = st.checkbox("Mortgage Payment / Salary Ratio" if language == "English" else "Mortgage Ödemesi / Maaş Oranı", value=False)
    plot_rent_price = st.checkbox("Rent Price (USD)" if language == "English" else "Kira Fiyatı (USD)", value=False)
    #plot_monthly_payment = st.checkbox("Monthly Payment (USD)", value=False)

with col1:
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
                    turkey_inflation_rate=turkey_inflation / 100,
                    price_rent_ratio_yearly=price_rent_ratio,
                    salary_currency=salary_currency,
                    include_inflation=include_inflation,
                    language=language,
                    months_to_increase=months_to_increase,
                    initial_rent_price_tl=initial_rent_price
                )

                
                
                if generate_random_dollar_values and not use_months:
                    dollar_rates_annual, adjusted_yearly_dollar_increases = generate_random_values_yearly(config.start_dollar_tl, config.years, dollar_growth_rate)
                    dollar_rates_monthly = None
                elif generate_random_dollar_values and use_months:
                    annual_payment_usd = None
                    dollar_rates_annual, adjusted_yearly_dollar_increases, dollar_rates_monthly = generate_random_values_monthly(config.start_dollar_tl, config.years, dollar_growth_rate)
                else:
                    dollar_rates_annual = calculate_dollar_rates_annual(config.start_dollar_tl, config.dollar_growth_rate_annual, config.years)
                    dollar_rates_monthly = calculate_dollar_rates_monthly(config.start_dollar_tl, config.dollar_growth_rate_monthly, config.years)

                
                if use_months:
                    monthly_payment_usd = calculate_monthly_payment_usd(config.monthly_tl_payment, dollar_rates_monthly)
                    cumulative_payment_usd_monthly = calculate_cumulative_payment_usd(monthly_payment_usd)
                    dollar_salaries = calculate_usd_salaries(config.start_salary_base, config.salary_growth_annual, config.years, config.euro_dollar_rate, config.salary_currency, dollar_rates_annual) 
                    dollar_salaries = generate_monthly_salaries_from_yearly(dollar_salaries, months_to_increase)
                    annual_payment_usd = None
                    cumulative_payment_usd_annual = None
                    rent_price_usd = None
                else:
                    annual_payment_usd = calculate_annual_payment_usd(config.annual_tl_payment, dollar_rates_annual)
                    cumulative_payment_usd_annual = calculate_cumulative_payment_usd(annual_payment_usd)
                    cumulative_payment_usd_monthly = None
                    monthly_payment_usd = None
                    dollar_salaries = calculate_usd_salaries(config.start_salary_base, config.salary_growth_annual, config.years, config.euro_dollar_rate, config.salary_currency, dollar_rates_annual)                
                    

                rent_price_usd_yearly,rent_price_tl_yearly = calculate_rent_price_usd(config.initial_rent_price_tl, config.turkey_inflation_rate, dollar_rates_annual)
                if use_months:
                    rent_price_usd_monthly = generate_rent_price_usd_monthly(rent_price_tl_yearly, config.turkey_inflation_rate, dollar_rates_monthly)
                else:
                    rent_price_usd_monthly = None

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
        st.pyplot(st.session_state.last_fig)
        
        # Only show download button if there's a plot
        if st.session_state.last_plot is not None:
            with col1:
                st.download_button(
                    label="📥 " + ("Download Plot" if language == "English" else "Grafiği İndir"),
                    data=st.session_state.last_plot,
                    file_name=f"real_estate_projection_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png",
                    mime="image/png"
                )