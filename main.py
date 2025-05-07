import numpy as np
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
    start_euro_salary: int
    euro_salary_growth_annual: float
    euro_dollar_rate: float
    initial_credit_amount: int
    initial_credit_amount_usd: float
    value_of_house_tl: int
    value_of_house_usd: float
    save_plots: bool

# === Hesaplamalar ===
def calculate_dollar_rates_annual(start_dollar_tl, dollar_growth_rate_annual, years):
    rates = [start_dollar_tl]
    for _ in range(1, years):
        rates.append(rates[-1] * (1 + dollar_growth_rate_annual))
    return np.array(rates)

def calculate_dollar_rates_monthly(start_dollar_tl, dollar_growth_rate_monthly, years):
    rates = [start_dollar_tl]
    for _ in range(1, years * 12):
        rates.append(rates[-1] * (1 + dollar_growth_rate_monthly))
    return np.array(rates)

def calculate_annual_payment_usd(annual_tl_payment, dollar_rates):
    return np.array([annual_tl_payment] * len(dollar_rates)) / dollar_rates

def calculate_monthly_payment_usd(monthly_tl_payment, dollar_rates):
    return np.array([monthly_tl_payment] * len(dollar_rates)) / dollar_rates

def calculate_cumulative_payment_usd(payment_usd):
    return np.cumsum(payment_usd)

def calculate_usd_salaries(start_salary, salary_growth, years, euro_dollar_rate):
    salaries = [start_salary]
    for _ in range(1, years):
        salaries.append(salaries[-1] * (1 + salary_growth))
    return np.array(salaries) * euro_dollar_rate * 12

def calculate_total_credit_amount(cumulative_payment_usd, initial_credit_usd):
    return cumulative_payment_usd + initial_credit_usd

def make_plots(config, data, args):
    plt.figure(figsize=(10, 6))
    years = config.years
    use_months = args.use_months
    dollar_growth_rate = config.dollar_growth_rate_annual if not use_months else config.dollar_growth_rate_monthly
    total_steps = years * 12 if use_months else years
    title, saving_title = '', ''

    if args.plot_annual_payment_usd:
        y_data = data['monthly_payment_usd'] if use_months else data['annual_payment_usd']
        plt.plot(range(1, total_steps + 1), y_data, marker='o', label='Aylık Ödeme (USD)' if use_months else 'Yıllık Ödeme (USD)')
        title += 'Aylık Ödeme (USD) ' if use_months else 'Yıllık Ödeme (USD) '
        saving_title += 'monthly_' if use_months else 'annual_'

    if args.plot_dollar_rates:
        y_data = data['dollar_rates_monthly'] if use_months else data['dollar_rates_annual']
        plt.plot(range(1, total_steps + 1), y_data, marker='o', label='Dolar Kuru (TL)')
        title += 'Dolar Kuru (TL) '
        saving_title += 'dollar_'

    if args.plot_dollar_salaries and not use_months:
        plt.plot(range(1, years + 1), data['dollar_salaries'], marker='o', label='Yıllık Maaş (USD)')
        title += 'Yıllık Maaş (USD) '
        saving_title += 'salary_'

    if args.plot_cumulative_payment_usd:
        y_data = data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual']
        plt.plot(range(1, total_steps + 1), y_data, marker='o', label='Kümülatif Ödeme (USD)')
        title += 'Kümülatif Ödeme (USD) '
        saving_title += 'cumulative_'

    if args.plot_total_credit_amount_with_initial_credit_amount:
        y_data = calculate_total_credit_amount(data['cumulative_payment_usd_monthly'] if use_months else data['cumulative_payment_usd_annual'], config.initial_credit_amount_usd)
        plt.plot(range(1, total_steps + 1), y_data, marker='o', label='Toplam Kredi Miktarı (USD)')
        title += 'Kredi Miktarı (USD) '
        saving_title += 'credit_'

    if args.plot_value_of_house_usd:
        plt.plot(1, config.value_of_house_usd, marker='o', label='Ev Değeri (USD)')
        title += 'Ev Değeri (USD) '
        saving_title += 'house_'

    plt.xticks(range(0, total_steps + 1, 12 if use_months else 1))
    plt.title(title.strip())
    plt.xlabel('Ay' if use_months else 'Yıl')
    plt.ylabel('USD')
    plt.legend(loc='lower center', bbox_to_anchor=(0.5, -0.1), ncol=2)
    plt.grid(True)
    plt.tight_layout()

    info_text = (
        f"VADE: {config.years}\n"
        f"Evin Başlangıç Değeri TL: {config.value_of_house_tl} TL\n"
        f"Evin Başlangıç Değeri USD: {config.value_of_house_usd:.2f} USD\n"
        f"Kredi Miktarı TL: {config.initial_credit_amount} TL\n"
        f"Aylık TL Ödeme: {config.monthly_tl_payment} TL\n"
        f"Başlangıç Dolar Kuru: {config.start_dollar_tl}\n"
        f"Euro/$ Kuru: {config.euro_dollar_rate}\n"
        f"Dolar Kuru Artış Oranı: %{dollar_growth_rate*100:.2f}")
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
    else:
        plt.show()
    plt.close()


# === Main ===
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--years', type=int, default=10)
    parser.add_argument('--monthly_tl_payment', type=int, default=45000)
    parser.add_argument('--start_dollar_tl', type=float, default=38.6)
    parser.add_argument('--dollar_growth_rate_annual', type=float, default=0.35)
    parser.add_argument('--start_euro_salary', type=int, default=2000)
    parser.add_argument('--euro_salary_growth_annual', type=float, default=0.06)
    parser.add_argument('--euro_dollar_rate', type=float, default=1.15)
    parser.add_argument('--initial_credit_amount', type=int, default=1000000)
    parser.add_argument('--value_of_house_tl', type=int, default=2500000)
    parser.add_argument('--save_plots', action='store_true')

    parser.add_argument('--plot_annual_payment_usd', action='store_true')
    parser.add_argument('--plot_dollar_rates', action='store_true')
    parser.add_argument('--plot_dollar_salaries', action='store_true')
    parser.add_argument('--plot_cumulative_payment_usd', action='store_true')
    parser.add_argument('--plot_total_credit_amount_with_initial_credit_amount', action='store_true')
    parser.add_argument('--plot_value_of_house_usd', action='store_true')
    parser.add_argument('--plot_monthly_payment_usd', action='store_true')
    parser.add_argument('--use_months', action='store_true')
    args = parser.parse_args()


    config = Config(
        years=args.years,
        monthly_tl_payment=args.monthly_tl_payment,
        annual_tl_payment=args.monthly_tl_payment * 12,
        start_dollar_tl=args.start_dollar_tl,
        dollar_growth_rate_annual=args.dollar_growth_rate_annual,
        dollar_growth_rate_monthly=args.dollar_growth_rate_annual / 12,
        start_euro_salary=args.start_euro_salary,
        euro_salary_growth_annual=args.euro_salary_growth_annual,
        euro_dollar_rate=args.euro_dollar_rate,
        initial_credit_amount=args.initial_credit_amount,
        initial_credit_amount_usd=args.initial_credit_amount / args.start_dollar_tl,
        value_of_house_tl=args.value_of_house_tl,
        value_of_house_usd=args.value_of_house_tl / args.start_dollar_tl,
        save_plots=args.save_plots
    )

    dollar_rates_annual = calculate_dollar_rates_annual(config.start_dollar_tl, config.dollar_growth_rate_annual, config.years)
    dollar_rates_monthly = calculate_dollar_rates_monthly(config.start_dollar_tl, config.dollar_growth_rate_monthly, config.years)
    annual_payment_usd = calculate_annual_payment_usd(config.annual_tl_payment, dollar_rates_annual)
    monthly_payment_usd = calculate_monthly_payment_usd(config.monthly_tl_payment, dollar_rates_monthly)
    cumulative_payment_usd_annual = calculate_cumulative_payment_usd(annual_payment_usd)
    cumulative_payment_usd_monthly = calculate_cumulative_payment_usd(monthly_payment_usd)
    dollar_salaries = calculate_usd_salaries(config.start_euro_salary, config.euro_salary_growth_annual, config.years, config.euro_dollar_rate)

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


