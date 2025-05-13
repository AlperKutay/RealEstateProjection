import unittest
import numpy as np
from main import (
    calculate_with_annual_growth_rate,
    calculate_with_monthly_growth_rate,
    calculate_annual_payment_usd,
    calculate_monthly_payment_usd,
    calculate_usd_salaries,
    calculate_total_credit_amount
)

class TestMainFunctions(unittest.TestCase):
    
    def test_annual_growth_rate(self):
        start = 100
        rate = 0.1
        years = 3
        expected = [100, 110, 121, 133.1]
        result = calculate_with_annual_growth_rate(start, rate, years)
        np.testing.assert_allclose(result, expected, rtol=1e-3)

    def test_monthly_growth_rate(self):
        start = 100
        rate = 0.05 / 12  # Monthly rate
        years = 1
        result = calculate_with_monthly_growth_rate(start, rate, years)
        self.assertEqual(len(result), 13)  # 12 months + initial value

    def test_annual_payment_usd(self):
        annual_tl_payment = 120000
        dollar_rates = np.array([0, 30, 40, 60])  # first item will be removed
        expected = [120000 / 30, 120000 / 40, 120000 / 60]
        result = calculate_annual_payment_usd(annual_tl_payment, dollar_rates)
        np.testing.assert_allclose(result, expected, rtol=1e-5)

    def test_monthly_payment_usd(self):
        monthly_tl_payment = 10000
        dollar_rates = np.array([0, 40, 50])
        expected = [10000 / 40, 10000 / 50]
        result = calculate_monthly_payment_usd(monthly_tl_payment, dollar_rates)
        np.testing.assert_allclose(result, expected, rtol=1e-5)

    def test_usd_salary_calculation(self):
        salaries = calculate_usd_salaries(10000, 0.1, 3, 1.2, 'EUR', np.array([40, 50, 60, 70]))
        expected = np.array([10000, 11000, 12100, 13310]) * 1.2
        np.testing.assert_allclose(salaries, expected, rtol=1e-5)

    def test_total_credit_amount(self):
        payments = np.array([10000, 11000, 12000])
        initial_credit = 50000
        expected = np.array([60000, 61000, 62000])
        result = calculate_total_credit_amount(payments, initial_credit)
        np.testing.assert_array_equal(result, expected)

if __name__ == '__main__':
    unittest.main()
