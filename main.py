import numpy as np
import matplotlib
matplotlib.use('Agg')  # Set the backend to non-interactive 'Agg'
import matplotlib.pyplot as plt
import argparse
from dataclasses import dataclass
import os
from datetime import datetime
# === Config sınıfı ===
@dataclass
class Config:
    years: int
    monthly_tl_payment: int
    annual_tl_payment: int
    start_dollar_tl: float
    dollar_growth_rate_annual: float
    dollar_growth_rate_monthly: float
    start_salary_base: int
    salary_growth_annual: float
    euro_dollar_rate: float
    initial_noncredit_amount: int
    initial_noncredit_amount_usd: float
    value_of_house_tl: int
    value_of_house_usd: float
    save_plots: bool
    usa_inflation_rate: float
    turkey_inflation_rate: float
    price_rent_ratio_yearly: int
    salary_currency: str
    include_inflation: bool

# === Hesaplamalar ===
def calculate_dollar_rates_annual(start_dollar_tl, dollar_growth_rate_annual, years):
    rates = [start_dollar_tl]
    for _ in range(0, years):
        rates.append(rates[-1] * (1 + dollar_growth_rate_annual))
    return np.array(rates)

def calculate_dollar_rates_monthly(start_dollar_tl, dollar_growth_rate_monthly, years):
    rates = [start_dollar_tl]
    for _ in range(0, years * 12):
        rates.append(rates[-1] * (1 + dollar_growth_rate_monthly))
    return np.array(rates)

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

def generate_monthly_salaries_from_yearly(yearly_salaries,months_to_increase = 12):
    monthly_salaries = []
    monthly = yearly_salaries[0] / 12
    monthly_salaries.extend([monthly] * months_to_increase)
    for yearly in yearly_salaries[1:-1]:
        monthly = yearly / 12
        monthly_salaries.extend([monthly] * 12)  # repeat for 12 months
    monthly = yearly_salaries[-1] / 12
    monthly_salaries.extend([monthly] * (13 - months_to_increase))
    return np.array(monthly_salaries)

def calculate_usd_salaries(start_salary, salary_growth, years, euro_dollar_rate, salary_currency,dollar_rates):
    salaries = [start_salary]
    for _ in range(1, len(dollar_rates)):
        salaries.append(salaries[-1] * (1 + salary_growth))
    if salary_currency == 'EUR':
        return np.array(salaries) * euro_dollar_rate
    elif salary_currency == 'USD':
        return np.array(salaries)
    elif salary_currency == 'TL':
        return np.array(salaries) / dollar_rates


def calculate_total_credit_amount(cumulative_payment_usd, initial_credit_usd):
    return cumulative_payment_usd + initial_credit_usd

def calculate_monthly_payment_tl(total_credit_amount, interest_rate_of_credit, years):
    monthly_payment_tl = interest_rate_of_credit * total_credit_amount / 100
    return monthly_payment_tl


def make_plots(config, data, args):
    plt.figure(figsize=(12 , 6))
    years = config.years
    use_months = args.use_months
    dollar_growth_rate = config.dollar_growth_rate_annual if not use_months else config.dollar_growth_rate_monthly
    total_steps = years * 12 if use_months else years
    title, saving_title = '', ''
    info_text = (
        f"VADE: {config.years}\n"
        f"Başlangıç Dolar Kuru: {config.start_dollar_tl}\n"
        f"Dolar Kuru Artış Oranı: %{dollar_growth_rate*100:.2f}\n"
    )
    if args.plot_annual_payment_usd:
        y_data = data['monthly_payment_usd'] if use_months else data['annual_payment_usd']
        plt.plot(range(1, total_steps + 1), y_data, marker='o', label='Aylık Ödeme (USD)' if use_months else 'Yıllık Ödeme (USD)')
        title += 'Aylık Ödeme (USD) ' if use_months else 'Yıllık Ödeme (USD) '
        saving_title += 'monthly_' if use_months else 'annual_'
        info_text += f"Aylık Ödeme (USD): {y_data[0]:.2f} USD\n" if use_months else f"Yıllık Ödeme (USD): {y_data[0]:.2f} USD\n"

    if args.plot_dollar_rates:
        y_data = data['dollar_rates_monthly'] if use_months else data['dollar_rates_annual']
        plt.plot(range(0, total_steps + 1), y_data, marker='o', label='Dolar Kuru (TL)')
        title += 'Dolar Kuru (TL) '
        saving_title += 'dollar_'

    if args.plot_dollar_salaries:
        y_data = data['dollar_salaries']
        plt.plot(range(0, len(y_data)), y_data, marker='o', label='Aylık Maaş (USD)')
        if use_months:
            title += 'Aylık Maaş (USD) '
        else:
            title += 'Yıllık Maaş (USD) '
        saving_title += 'salary_'
        info_text += f"Euro/$ Kuru: {config.euro_dollar_rate}\n"

    if args.plot_cumulative_payment_usd:
        y_data = data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual']
        y_data = np.insert(y_data, 0, 0)
        plt.plot(range(0, total_steps + 1 ), y_data, marker='o', label='Kümülatif Ödeme (USD)')
        title += 'Kümülatif Ödeme (USD) '
        saving_title += 'cumulative_'
        info_text += f"Aylık Kredi Ödemesi (TL): {config.monthly_tl_payment} TL\n"

    if args.plot_total_credit_amount_with_initial_noncredit_amount:
        y_data = calculate_total_credit_amount(data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual'], config.initial_noncredit_amount_usd)
        y_data = np.insert(y_data, 0, config.initial_noncredit_amount_usd)
        plt.plot(range(0, total_steps + 1), y_data, marker='o', label='Toplam Kredi Miktarı (USD)')
        title += 'Kredi Miktarı (USD) '
        saving_title += 'credit_'
        info_text += f"Toplam Kredi Miktarı (USD): {y_data[-1]:.2f} USD\n"
    
    if args.plot_value_of_house_usd:
        plt.plot(0, config.value_of_house_usd, marker='o', label='Ev Değeri (USD)')
        title += 'Ev Değeri (USD) '
        saving_title += 'house_'
        info_text += f"Ev Değeri Başlangıç Değeri (USD): {config.value_of_house_usd:.2f} USD\n"
        info_text += f"Ev Değeri Başlangıç Değeri (TL): {config.value_of_house_tl:.2f} TL\n"
    
    if args.plot_monthly_payment_usd:
        y_data = data['monthly_payment_usd']
        plt.plot(range(0, total_steps + 1), y_data, marker='o', label='Aylık Ödeme (USD)')
        title += 'Aylık Ödeme (USD) '
        saving_title += 'monthly_'
    
    if args.plot_payment_salary_ratio:
        dollar_salaries = data['dollar_salaries']
        dollar_salaries = np.delete(dollar_salaries, 0)
        if use_months:
            y_data = data['monthly_payment_usd'] / dollar_salaries  # monthly salary ratio
        else:
            y_data = data['annual_payment_usd'] / dollar_salaries
        plt.plot(range(1, len(y_data) + 1), y_data, marker='o', label='Payment / Salary Ratio')
        title += 'Payment/Salary Ratio '
        saving_title += 'payment_salary_ratio_'

    plt.xticks(range(0, total_steps + 1, 12 if use_months else 1))
    plt.title(title.strip())
    plt.xlabel('Ay' if use_months else 'Yıl')
    plt.ylabel('USD')
    plt.legend(loc='lower center', bbox_to_anchor=(0.5, -0.1), ncol=2)
    plt.grid(True)
    plt.tight_layout()

    plt.gcf().text(0.98, 0.02, info_text, fontsize=9, verticalalignment='bottom', horizontalalignment='right',
                   bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.4))

    if config.save_plots:
        saving_title = saving_title.rstrip('_')
        if os.path.exists(saving_title+ '.png'):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            saving_title = saving_title.rstrip('_') + '_' + timestamp + '.png'
            plt.savefig(saving_title)
        else:
            plt.savefig(saving_title)
        print(f"Plot saved as {saving_title}")
    
    # Always save the plot for Streamlit to display
    plot_filename = "monthly_dollar_house_credit_cumulative_salary.png" if use_months else "annual_dollar_house_credit_cumulative_salary.png"
    plt.savefig(plot_filename)
    plt.close()

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
    dollar_values = [initial_rate]
    for rate in adjusted_yearly_increases:
        new_value = dollar_values[-1] * (1 + rate)
        dollar_values.append(new_value)

    return dollar_values, adjusted_yearly_increases

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

    monthly_dollar_values = [initial_rate]
    yearly_dollar_values = [initial_rate]

    for year_idx in range(years):
        year_start_value = yearly_dollar_values[-1]
        year_multiplier = 1 + adjusted_yearly_increases[year_idx]

        # Step 1: Generate random monthly multipliers around neutral (1.0)
        raw_monthly_multipliers = np.random.uniform(0.98, 1.05, 12)

        # Step 2: Normalize so their product equals yearly multiplier
        product_raw = np.prod(raw_monthly_multipliers)
        normalized_monthly_multipliers = raw_monthly_multipliers * (year_multiplier ** (1/12)) / (product_raw ** (1/12))

        # Step 3: Apply month by month
        for m in range(12):
            new_value = monthly_dollar_values[-1] * normalized_monthly_multipliers[m]
            monthly_dollar_values.append(new_value)

        yearly_dollar_values.append(monthly_dollar_values[-1])

    return yearly_dollar_values, adjusted_yearly_increases, monthly_dollar_values

# === Main ===
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--years', type=int, default=10)
    parser.add_argument('--interest_rate_of_credit', type=float, default=2.89)
    parser.add_argument('--start_dollar_tl', type=float, default=38.6)
    parser.add_argument('--dollar_growth_rate_annual', type=float, default=0.35)
    parser.add_argument('--start_salary_base', type=int, default=32000)
    parser.add_argument('--salary_growth_annual', type=float, default=0.06)
    parser.add_argument('--euro_dollar_rate', type=float, default=1.15)
    parser.add_argument('--initial_noncredit_amount', type=int, default=1000000)
    parser.add_argument('--value_of_house_tl', type=int, default=2500000)
    parser.add_argument('--save_plots', action='store_true')
    parser.add_argument('--usa_inflation_rate', type=float, default=0.03)
    parser.add_argument('--turkey_inflation_rate', type=float, default=0.35)
    parser.add_argument('--price_rent_ratio_yearly', type=int, default=15)
    parser.add_argument('--salary_currency', type=str, default='EUR')
    parser.add_argument('--include_inflation', action='store_true')
    parser.add_argument('--months_to_increase', type=int, default=12)
    parser.add_argument('--plot_annual_payment_usd', action='store_true')
    parser.add_argument('--plot_dollar_rates', action='store_true')
    parser.add_argument('--plot_dollar_salaries', action='store_true')
    parser.add_argument('--plot_cumulative_payment_usd', action='store_true')
    parser.add_argument('--plot_total_credit_amount_with_initial_noncredit_amount', action='store_true')
    parser.add_argument('--plot_value_of_house_usd', action='store_true')
    parser.add_argument('--plot_monthly_payment_usd', action='store_true')
    parser.add_argument('--use_months', action='store_true')
    args = parser.parse_args()

    monthly_tl_payment = calculate_monthly_payment_tl(args.value_of_house_tl - args.initial_noncredit_amount, args.interest_rate_of_credit, args.years)

    config = Config(
        years=args.years,
        monthly_tl_payment=monthly_tl_payment,
        annual_tl_payment=monthly_tl_payment * 12,
        start_dollar_tl=args.start_dollar_tl,
        dollar_growth_rate_annual=args.dollar_growth_rate_annual,
        dollar_growth_rate_monthly=(((args.dollar_growth_rate / 100) + 1) ** (1/12)) - 1,
        start_salary_base=args.start_salary_base,
        salary_growth_annual=args.salary_growth_annual,
        euro_dollar_rate=args.euro_dollar_rate,
        initial_noncredit_amount=args.initial_noncredit_amount,
        initial_noncredit_amount_usd=args.initial_noncredit_amount / args.start_dollar_tl,
        value_of_house_tl=args.value_of_house_tl,
        value_of_house_usd=args.value_of_house_tl / args.start_dollar_tl,
        save_plots=args.save_plots,
        usa_inflation_rate=args.usa_inflation_rate,
        turkey_inflation_rate=args.turkey_inflation_rate,
        price_rent_ratio_yearly=args.price_rent_ratio_yearly,
        salary_currency=args.salary_currency,
        include_inflation=args.include_inflation,
        months_to_increase=args.months_to_increase
    )

    dollar_rates_annual = calculate_dollar_rates_annual(config.start_dollar_tl, config.dollar_growth_rate_annual, config.years)
    dollar_rates_monthly = calculate_dollar_rates_monthly(config.start_dollar_tl, config.dollar_growth_rate_monthly, config.years)
    annual_payment_usd = calculate_annual_payment_usd(config.annual_tl_payment, dollar_rates_annual)
    monthly_payment_usd = calculate_monthly_payment_usd(config.monthly_tl_payment, dollar_rates_monthly)
    cumulative_payment_usd_annual = calculate_cumulative_payment_usd(annual_payment_usd)
    cumulative_payment_usd_monthly = calculate_cumulative_payment_usd(monthly_payment_usd)
    dollar_salaries = calculate_usd_salaries(config.start_salary_base, config.salary_growth_annual, config.years, config.euro_dollar_rate, config.salary_currency, dollar_rates_annual)
    if config.use_months:
        dollar_salaries = generate_monthly_salaries_from_yearly(dollar_salaries, config.months_to_increase)

    data = {
        'dollar_rates_annual': dollar_rates_annual,
        'dollar_rates_monthly': dollar_rates_monthly,
        'annual_payment_usd': annual_payment_usd,
        'monthly_payment_usd': monthly_payment_usd,
        'cumulative_payment_usd_annual': cumulative_payment_usd_annual,
        'cumulative_payment_usd_monthly': cumulative_payment_usd_monthly,
        'dollar_salaries': dollar_salaries
    }

    make_plots(
        config, data, args
    )


