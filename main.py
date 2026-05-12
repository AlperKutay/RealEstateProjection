import os
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import matplotlib
matplotlib.use('Agg')  # non-interactive backend, required for headless Streamlit
import matplotlib.pyplot as plt
# === Config sınıfı ===
@dataclass
class Config:
    years: int
    monthly_tl_payment: float
    annual_tl_payment: float
    start_dollar_tl: float
    dollar_growth_rate_annual: float
    dollar_growth_rate_monthly: float
    start_salary_base: float
    salary_growth_annual: float
    euro_dollar_rate: float
    initial_noncredit_amount: float
    initial_noncredit_amount_usd: float
    value_of_house_tl: float
    value_of_house_usd: float
    save_plots: bool
    usa_inflation_rate: float
    usa_inflation_rate_monthly: float
    turkey_inflation_rate: float
    turkey_inflation_rate_monthly: float
    price_rent_ratio_yearly: float
    salary_currency: str
    include_inflation: bool
    months_to_increase: int
    initial_rent_price_tl: float
    language: str
    interest_rate: float
# === Hesaplamalar ===
def calculate_with_annual_growth_rate(start_value, growth_rate, years):
    values = [start_value]
    for _ in range(0, years):
        values.append(values[-1] * (1 + growth_rate))
    return np.array(values)

def calculate_with_monthly_growth_rate(start_value, growth_rate, years):
    values = [start_value]
    for _ in range(0, years * 12):
        values.append(values[-1] * (1 + growth_rate))
    return np.array(values)

def calculate_annual_payment_usd(annual_tl_payment, dollar_rates):
    dollar_rates = np.delete(dollar_rates, 0)
    payments = np.array([annual_tl_payment] * len(dollar_rates)) / dollar_rates
    return payments

def calculate_monthly_payment_usd(monthly_tl_payment, dollar_rates):
    dollar_rates = np.delete(dollar_rates, 0)
    payments = np.array([monthly_tl_payment] * len(dollar_rates)) / dollar_rates
    return payments

def calculate_cumulative_payment_usd(payment_usd):
    return np.cumsum(payment_usd)

def generate_monthly_salaries_from_yearly(yearly_salaries,months_to_increase,dollar_rates,euro_dollar_rate,salary_currency):
    monthly_salaries = []
    monthly = yearly_salaries[0] / 12
    monthly_salaries.extend([monthly] * months_to_increase)
    for yearly in yearly_salaries[1:-1]:
        monthly = yearly / 12
        monthly_salaries.extend([monthly] * 12)  # repeat for 12 months
    monthly = yearly_salaries[-1] / 12
    monthly_salaries.extend([monthly] * (13 - months_to_increase))
    if salary_currency == 'EUR':
        return np.array(monthly_salaries) * euro_dollar_rate
    elif salary_currency == 'USD':
        return np.array(monthly_salaries)
    elif salary_currency == 'TL':
        return np.array(monthly_salaries) / dollar_rates

def calculate_usd_salaries(start_salary, salary_growth, years, euro_dollar_rate, salary_currency,dollar_rates):
    salaries = [start_salary]
    for _ in range(1, len(dollar_rates)):
        salaries.append(salaries[-1] * (1 + salary_growth))
    if salary_currency == 'EUR':
        return (np.array(salaries) * euro_dollar_rate),np.array(salaries)
    elif salary_currency == 'USD':
        return np.array(salaries),np.array(salaries)
    elif salary_currency == 'TL':
        return (np.array(salaries) / dollar_rates),np.array(salaries)


def calculate_total_credit_amount(cumulative_payment_usd, initial_credit_usd):
    return cumulative_payment_usd + initial_credit_usd

def calculate_monthly_payment_tl(total_credit_amount, interest_rate_of_credit, years):
    """Standard mortgage amortization: M = P * r(1+r)^n / ((1+r)^n - 1).

    interest_rate_of_credit is the monthly rate as a percentage (e.g. 2.74).
    """
    r = interest_rate_of_credit / 100.0
    n = years * 12
    if r == 0:
        return total_credit_amount / n
    factor = (1 + r) ** n
    return total_credit_amount * r * factor / (factor - 1)

def calculate_rent_price_usd(rent_price_tl, turkish_inflation_rate, dollar_rates):
    #dollar_rates = np.delete(dollar_rates, 0)
    
    rent_price_yearly_tl = [rent_price_tl*12]
    for _ in range(1, len(dollar_rates)):
        rent_price_yearly_tl.append(rent_price_yearly_tl[-1] * (1 + turkish_inflation_rate))
    rent_price_yearly_usd = np.array(rent_price_yearly_tl)/ dollar_rates
    return rent_price_yearly_usd,rent_price_yearly_tl

def generate_rent_price_usd_monthly(rent_price_tl_yearly, turkish_inflation_rate, dollar_rates):
    monthly_rent_prices = []
    for yearly in rent_price_tl_yearly[:-1]:
        monthly = yearly / 12
        monthly_rent_prices.extend([monthly] * 12)
    monthly_rent_prices.append(rent_price_tl_yearly[-1] / 12)

    return np.array(monthly_rent_prices) / dollar_rates

def calculate_cumulative_rent_price_usd(rent_price_usd):
    return np.cumsum(rent_price_usd)

def calculate_cumulative_rent_price_usd_monthly(rent_price_usd_monthly):
    return np.cumsum(rent_price_usd_monthly)

def make_plots(config, data, args):
    import matplotlib.pyplot as plt
    import numpy as np
    import os
    from datetime import datetime

    def annotate_y_values(y_data, x_start=0):
        for i, y in enumerate(y_data):
            x = i + x_start
            if not use_months or (use_months and x % 12 == 0) or (x == len(y_data) - 1) or (i == 0):
                plt.annotate(f'{y:,.2f}', (x, y), textcoords="offset points", xytext=(0, 10), ha='center')

    plt.figure(figsize=(12, 7))
    years = config.years
    use_months = args.use_months
    total_steps = years * 12 if use_months else years
    initial_dollar_rate = data['dollar_rates_monthly'][0] if use_months else data['dollar_rates_annual'][0]
    lang = config.language

    title = []
    saving_title = []
    info_lines_en = [
        ("Loan Period", config.years),
        ("Average Dollar Increase (%)", (config.dollar_growth_rate_monthly if use_months else config.dollar_growth_rate_annual) * 100),
        ("Initial Dollar Rate (TL)", initial_dollar_rate),
        ("Turkey Average Inflation (%)", config.turkey_inflation_rate * 100),
        ("USA Average Inflation (%)", config.usa_inflation_rate * 100)
    ]
    info_lines_tr = [
        ("Vade", config.years),
        ("Ortalama Dolar Artışı (%)", (config.dollar_growth_rate_monthly if use_months else config.dollar_growth_rate_annual) * 100),
        ("Başlangıç Dolar / TL Fiyatı", initial_dollar_rate),
        ("Türkiye Ortalama Enflasyon (%)", config.turkey_inflation_rate * 100),
        ("ABD Ortalama Enflasyonu (%)", config.usa_inflation_rate * 100)
    ]
    def label(name_tr, name_en):
        if lang == 'Türkçe' and name_tr:
            return name_tr
        elif lang == 'English' and name_en:
            return name_en
        else:
            return name_en or name_tr or "Unnamed"


    def plot_series(name, y_data, x_start=0):
        plt.plot(range(x_start, x_start + len(y_data)), y_data, marker='o', label=name)
        annotate_y_values(y_data, x_start)

    if args.plot_annual_payment_usd:
        y = data['monthly_payment_usd'] if use_months else data['annual_payment_usd']
        plot_series(label('Aylık Ödeme (USD)', 'Monthly Payment (USD)'), y, 1)
        title.append(label('Aylık Ödeme (USD)', 'Monthly Payment (USD)'))
        saving_title.append('monthly_' if use_months else 'annual_')

    if args.plot_dollar_rates:
        y = data['dollar_rates_monthly'] if use_months else data['dollar_rates_annual']
        plot_series(label('Dolar Kuru (TL)', 'Dollar Rate (TL)'), y)
        title.append(label('Dolar Kuru (TL)', 'Dollar Rate (TL)'))
        saving_title.append('dollar_')

    if args.plot_dollar_salaries:
        y = data['dollar_salaries']
        plot_series(label('Aylık Maaş (USD)', 'Monthly Salary (USD)'), y)
        title.append(label('Aylık Maaş (USD)', 'Monthly Salary (USD)' if use_months else 'Annual Salary (USD)'))
        saving_title.append('salary_')
        info_lines_en.append(("Euro/$ Rate", config.euro_dollar_rate))
        info_lines_en.append(("Initial Salary (USD)", y[0]))
        info_lines_tr.append(("Euro/$ Oranı", config.euro_dollar_rate))
        info_lines_tr.append(("Başlangıç Maaş (USD)", y[0]))
        info_lines_en.append(("Average Salary Increase Rate (Yearly) %", config.salary_growth_annual * 100))
        info_lines_tr.append(("Ortalama Maaş Artış Oranı (Yıllık) %", config.salary_growth_annual * 100))

    if args.plot_cumulative_payment_usd:
        y = np.insert(data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual'], 0, 0)
        plot_series(label('Kümülatif Ödeme (USD)', 'Cumulative Payment (USD)'), y)
        title.append(label('Kümülatif Ödeme (USD)', 'Cumulative Payment (USD)'))
        saving_title.append('cumulative_')
        info_lines_en.append(("Monthly Credit Payment (TL)", config.monthly_tl_payment))
        info_lines_tr.append(("Aylık Kredi Ödemesi (TL)", config.monthly_tl_payment))

    if args.plot_total_credit_amount_with_initial_noncredit_amount:
        base = config.initial_noncredit_amount_usd
        y = np.insert(data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual'], 0, 0) + base
        plot_series(label('Toplam Kredi Miktarı (USD)', 'Total Credit Amount (USD)'), y)
        title.append(label('Kredi Miktarı (USD)', 'Total Credit Amount (USD)'))
        saving_title.append('credit_')
        info_lines_en.append(("Total Credit Amount (USD)", y[-1]))
        info_lines_tr.append(("Toplam Kredi Miktarı (USD)", y[-1]))
        info_lines_en.append(("Down Payment Amount (USD)", base))
        info_lines_tr.append(("Peşinat Miktarı (USD)", base))
        info_lines_en.append(("Mortgage Rate (%)", config.interest_rate))
        info_lines_tr.append(("Mortgage Rate (%)", config.interest_rate))

    if args.plot_value_of_house_usd:
        y = data['value_of_house_usd_monthly'] if use_months else data['value_of_house_usd_yearly']
        plot_series(label('Ev Değeri (USD)', 'House Value (USD)'), y)
        title.append(label('Ev Değeri (USD)', 'House Value (USD)'))
        saving_title.append('house_')
        info_lines_en.append(("Initial House Value (USD)", config.value_of_house_usd))
        info_lines_tr.append(("Başlangıç Ev Değeri (USD)", config.value_of_house_usd))

    if args.plot_payment_salary_ratio:
        sal = np.delete(data['dollar_salaries'], 0)
        y = (data['monthly_payment_usd'] if use_months else data['annual_payment_usd']) / sal
        plot_series(label('Ödeme/Maaş Oranı', 'Payment/Salary Ratio'), y, 1)
        title.append(label('Ödeme/Maaş Oranı', 'Payment/Salary Ratio'))
        saving_title.append('payment_salary_ratio_')
        info_lines_en.append(("Initial Payment (USD)", y[0] * sal[0] ))
        info_lines_tr.append(("Başlangıç Ödeme (USD)", y[0] * sal[0]))
        info_lines_en.append(("Initial Salary (USD)", sal[0]))
        info_lines_tr.append(("Başlangıç Maaş (USD)", sal[0]))
        

    if args.plot_rent_price_usd:
        y = data['rent_price_usd_monthly'] if use_months else data['rent_price_usd_yearly']
        plot_series(label('Kira Fiyatı (USD)', 'Rent Price (USD)'), y)
        title.append(label('Kira Fiyatı (USD)', 'Rent Price (USD)'))
        saving_title.append('rent_price_')
        info_lines_en.append(("Initial Rent Price (TL)", y[0] * initial_dollar_rate))
        info_lines_tr.append(("Başlangıç Kira Fiyatı (TL)", y[0] * initial_dollar_rate))

    if args.plot_cumulative_rent_price_usd:
        y = data['cumulative_rent_price_usd_monthly'] if use_months else data['cumulative_rent_price_usd_yearly']
        plot_series(label('Kümülatif Kira Fiyatı (USD)', 'Cumulative Rent Price (USD)'), y)
        title.append(label('Kümülatif Kira Fiyatı (USD)', 'Cumulative Rent Price (USD)'))
        saving_title.append('cumulative_rent_price_')
        info_lines_en.append(("Initial Rent Price (TL)", y[0] * initial_dollar_rate))
        info_lines_tr.append(("Başlangıç Kira Fiyatı (TL)", y[0] * initial_dollar_rate))

    if args.plot_payment_and_rent_ratio_with_salary:
        sal = np.delete(data['dollar_salaries'], 0)
        rent = np.delete(data['rent_price_usd_monthly'] if use_months else data['rent_price_usd_yearly'], 0)
        pay = data['monthly_payment_usd'] if use_months else data['annual_payment_usd']
        y = (pay[:len(sal)] - rent[:len(sal)]) / sal
        plot_series(label('Ödeme-Kira/Maaş Oranı', 'Payment-Rent/Salary Ratio'), y, 1)
        title.append(label('Ödeme-Kira/Maaş Oranı', 'Payment-Rent/Salary Ratio'))
        saving_title.append('payment_and_rent_ratio_')
        info_lines_en.append(("Price-to-Rent Ratio (Year)", config.price_rent_ratio_yearly))
        info_lines_tr.append(("Fiyat-Kira Oranı (Yıl)", config.price_rent_ratio_yearly))
        info_lines_en.append(("Initial House Value (USD)", config.value_of_house_usd))
        info_lines_tr.append(("Başlangıç Ev Değeri (USD)", config.value_of_house_usd))
        info_lines_en.append(("Average Salary Increase Rate (Yearly)", config.salary_growth_annual * 100))
        info_lines_tr.append(("Ortalama Maaş Artış Oranı (Yıllık)", config.salary_growth_annual * 100))

    if args.plot_value_of_house_with_rent_price:
        house = data['value_of_house_usd_monthly'] if use_months else data['value_of_house_usd_yearly']
        rent = data['cumulative_rent_price_usd_monthly'] if use_months else data['cumulative_rent_price_usd_yearly']
        y = house + rent
        plot_series(label('Ev Değeri (USD) (Kira Fiyatı Dahil)', 'House Value (USD) (Rent Price Included)'), y)
        title.append(label('Ev Değeri (USD) (Kira Fiyatı Dahil)', 'House Value (USD) (Rent Price Included)'))
        saving_title.append('value_of_house_with_rent_price_')
        info_lines_en.append(("Price-to-Rent Ratio (Year)", config.price_rent_ratio_yearly))
        info_lines_tr.append(("Fiyat-Kira Oranı (Yıl)", config.price_rent_ratio_yearly))
    
    if args.plot_gold_price:
        y = data['gold_price']
        plot_series(label('Altın Fiyatı (USD)', 'Gold Price (USD)'), y)
        title.append(label('Altın Fiyatı (USD)', 'Gold Price (USD)'))
        saving_title.append('gold_price_')
        info_lines_en.append(("Average Gold Growth Yearly (%)", data['average_gold_growth']))
        info_lines_tr.append(("Ortalama Altın Artış Yıllık (%)", data['average_gold_growth']))

    if args.plot_silver_price:
        y = data['silver_price']
        plot_series(label('Gümüş Fiyatı (USD)', 'Silver Price (USD)'), y)
        title.append(label('Gümüş Fiyatı (USD)', 'Silver Price (USD)'))
        saving_title.append('silver_price_')
        info_lines_en.append(("Average Silver Growth Yearly (%)", data['average_silver_growth']))
        info_lines_tr.append(("Ortalama Gümüş Artış Yıllık (%)", data['average_silver_growth']))

    if args.plot_eth_price:
        y = data['eth_price']
        plot_series(label('ETH Fiyatı (USD)', 'ETH Price (USD)'), y)
        title.append(label('ETH Fiyatı (USD)', 'ETH Price (USD)'))
        saving_title.append('eth_price_')
        info_lines_en.append(("Average ETH Growth Yearly (%)", data['average_eth_growth']))
        info_lines_tr.append(("Ortalama ETH Artış Yıllık (%)", data['average_eth_growth']))

    if args.plot_btc_price:
        y = data['btc_price']
        plot_series(label('BTC Fiyatı (USD)', 'BTC Price (USD)'), y)
        title.append(label('BTC Fiyatı (USD)', 'BTC Price (USD)'))
        saving_title.append('btc_price_')
        info_lines_en.append(("Average BTC Growth Yearly (%)", data['average_btc_growth']))
        info_lines_tr.append(("Ortalama BTC Artış Yıllık (%)", data['average_btc_growth']))

    if args.plot_nasdaq_price:
        y = data['nasdaq_price']
        plot_series(label('NASDAQ Fiyatı (USD)', 'NASDAQ Price (USD)'), y)
        title.append(label('NASDAQ Fiyatı (USD)', 'NASDAQ Price (USD)'))
        saving_title.append('nasdaq_price_')
        info_lines_en.append(("Average NASDAQ Growth Yearly (%)", data['average_nasdaq_growth']))

    if args.plot_sp_price:
        y = data['sp_price']
        plot_series(label('S&P 500 Fiyatı (USD)', 'S&P 500 Price (USD)'), y)
        title.append(label('S&P 500 Fiyatı (USD)', 'S&P 500 Price (USD)'))
        saving_title.append('sp_price_')
        info_lines_en.append(("Average S&P 500 Growth Yearly (%)", data['average_sp_growth']))

    if args.plot_xu100_price:
        y = data['xu100_price']
        plot_series(label('XU100 Fiyatı (USD)', 'XU100 Price (USD)'), y)
        title.append(label('XU100 Fiyatı (USD)', 'XU100 Price (USD)'))
        saving_title.append('xu100_price_')
        info_lines_en.append(("Average XU100 Growth Yearly (%)", data['average_xu100_growth']))

    if args.plot_xu30_price:
        y = data['xu30_price']
        plot_series(label('XU30 Fiyatı (USD)', 'XU30 Price (USD)'), y)
        title.append(label('XU30 Fiyatı (USD)', 'XU30 Price (USD)'))
        saving_title.append('xu30_price_')
        info_lines_en.append(("Average XU30 Growth Yearly (%)", data['average_xu30_growth']))
        
    plt.xticks(range(0, total_steps + 1, 12 if use_months else 1))
    plt.title(' '.join(title))
    plt.xlabel(label('Ay', 'Month') if use_months else label('Yıl', 'Year'))
    plt.ylabel('USD')
    plt.legend(loc='upper center', bbox_to_anchor=(0.5, -0.1), ncol=2)
    plt.grid(True)
    plt.tight_layout()
    if lang == 'Türkçe':    
        info_text = '\n'.join([f"{label(k, k)}: {v:,.2f}" for k, v in info_lines_tr])
    else:
        info_text = '\n'.join([f"{label(k, k)}: {v:,.2f}" for k, v in info_lines_en])
    plt.gcf().text(0.9, -0.1, info_text, fontsize=9, va='bottom', ha='center', bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.4))

    if config.save_plots:
        filename = ''.join(saving_title).rstrip('_') + '.png'
        if os.path.exists(filename):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = filename.rstrip('.png') + f"_{timestamp}.png"
        plt.savefig(filename)
        print(f"Plot saved as {filename}")

    fig = plt.gcf()
    plt.close()
    return fig

def generate_random_values_yearly(initial_rate, years, target_avg_increase_pct):
    target_avg_increase = target_avg_increase_pct / 100
    # np.random.seed(42)  # REMOVE for random results each time

    # Step 1: Generate random yearly increases around the target
    yearly_random_increases = np.random.uniform(
        target_avg_increase * 0.7,
        target_avg_increase * 1.3,
        years
    )

    # Step 2: Scale to match exact target average
    scaling_factor = target_avg_increase / np.mean(yearly_random_increases)
    adjusted_yearly_increases = yearly_random_increases * scaling_factor

    # Step 3: Calculate yearly dollar values
    values = [initial_rate]
    for rate in adjusted_yearly_increases:
        new_value = values[-1] * (1 + rate)
        values.append(new_value)

    return values, adjusted_yearly_increases

def generate_random_values_monthly(initial_rate, years, target_avg_increase_pct):
    target_avg_increase = target_avg_increase_pct / 100
    # np.random.seed(42)  # REMOVE for random results each time

    yearly_random_increases = np.random.uniform(
        target_avg_increase * 0.7,
        target_avg_increase * 1.3,
        years
    )
    scaling_factor = target_avg_increase / np.mean(yearly_random_increases)
    adjusted_yearly_increases = yearly_random_increases * scaling_factor

    monthly_values = [initial_rate]
    yearly_values = [initial_rate]

    for year_idx in range(years):
        year_start_value = yearly_values[-1]
        year_multiplier = 1 + adjusted_yearly_increases[year_idx]

        # Step 1: Generate random monthly multipliers around neutral (1.0)
        raw_monthly_multipliers = np.random.uniform(0.98, 1.05, 12)

        # Step 2: Normalize so their product equals yearly multiplier
        product_raw = np.prod(raw_monthly_multipliers)
        normalized_monthly_multipliers = raw_monthly_multipliers * (year_multiplier ** (1/12)) / (product_raw ** (1/12))

        # Step 3: Apply month by month
        for m in range(12):
            new_value = monthly_values[-1] * normalized_monthly_multipliers[m]
            monthly_values.append(new_value)

        yearly_values.append(monthly_values[-1])

    return yearly_values, adjusted_yearly_increases, monthly_values

# The CLI entrypoint was removed — it called non-existent helpers and is
# superseded by `streamlit run app.py` and `uvicorn api:app`. For ad-hoc
# scripted runs, use projection.run_projection() directly.


