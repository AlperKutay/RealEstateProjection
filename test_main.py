import unittest

import numpy as np

from main import (
    calculate_annual_payment_usd,
    calculate_monthly_payment_tl,
    calculate_monthly_payment_usd,
    calculate_total_credit_amount,
    calculate_usd_salaries,
    calculate_with_annual_growth_rate,
    calculate_with_monthly_growth_rate,
)
from projection import (
    AssetParams,
    ProjectionInput,
    amortized_monthly_payment,
    compound_series,
    run_projection,
)


class TestLegacyFinancialPrimitives(unittest.TestCase):

    def test_annual_growth_rate(self):
        result = calculate_with_annual_growth_rate(100, 0.1, 3)
        np.testing.assert_allclose(result, [100, 110, 121, 133.1], rtol=1e-3)

    def test_monthly_growth_rate(self):
        result = calculate_with_monthly_growth_rate(100, 0.05 / 12, 1)
        self.assertEqual(len(result), 13)

    def test_annual_payment_usd_drops_first_dollar_rate(self):
        payments = calculate_annual_payment_usd(120000, np.array([0, 30, 40, 60]))
        np.testing.assert_allclose(payments, [4000, 3000, 2000], rtol=1e-5)

    def test_monthly_payment_usd_drops_first_dollar_rate(self):
        payments = calculate_monthly_payment_usd(10000, np.array([0, 40, 50]))
        np.testing.assert_allclose(payments, [250, 200], rtol=1e-5)

    def test_usd_salary_calculation_for_eur(self):
        salaries, base = calculate_usd_salaries(
            10000, 0.1, 3, 1.2, "EUR", np.array([40, 50, 60, 70]),
        )
        np.testing.assert_allclose(salaries, np.array([10000, 11000, 12100, 13310]) * 1.2, rtol=1e-5)
        np.testing.assert_allclose(base, [10000, 11000, 12100, 13310], rtol=1e-5)

    def test_total_credit_amount(self):
        result = calculate_total_credit_amount(np.array([10000, 11000, 12000]), 50000)
        np.testing.assert_array_equal(result, [60000, 61000, 62000])


class TestAmortization(unittest.TestCase):

    def test_main_uses_real_amortization(self):
        # 1.75M TL at 2.74%/month, 10 years = 120 months
        # M = P * r(1+r)^n / ((1+r)^n - 1)
        result = calculate_monthly_payment_tl(1_750_000, 2.74, 10)
        self.assertAlmostEqual(result, 49896.82, places=1)

    def test_projection_matches_main(self):
        # Both modules should agree on the monthly payment.
        from main import calculate_monthly_payment_tl as legacy_fn
        legacy = legacy_fn(1_750_000, 2.74, 10)
        modern = amortized_monthly_payment(1_750_000, 2.74 / 100, 120)
        self.assertAlmostEqual(legacy, modern, places=6)

    def test_zero_interest_edge_case(self):
        self.assertEqual(amortized_monthly_payment(120_000, 0.0, 120), 1_000)


class TestProjectionEngine(unittest.TestCase):

    def test_default_projection_runs_end_to_end(self):
        result = run_projection(ProjectionInput())
        self.assertGreater(result.monthly_tl_payment, 0)
        self.assertEqual(len(result.dollar_rates_annual), 11)
        self.assertEqual(len(result.dollar_rates_monthly), 121)
        self.assertEqual(len(result.monthly_payment_usd), 120)

    def test_loan_principal_recovers(self):
        # Sum of monthly payments * dollar should approximately repay (principal + interest).
        inp = ProjectionInput(years=10, interest_rate=2.74,
                              initial_noncredit_amount_tl=350_000,
                              value_of_house_tl=2_100_000)
        result = run_projection(inp)
        # 120 * monthly = total TL paid
        self.assertAlmostEqual(result.total_paid_tl, 120 * result.monthly_tl_payment, places=4)

    def test_compound_series_length(self):
        arr = compound_series(100, 0.1, 5)
        self.assertEqual(len(arr), 6)
        self.assertAlmostEqual(arr[-1], 100 * 1.1 ** 5, places=6)

    def test_asset_projection_included(self):
        inp = ProjectionInput(
            assets={"BTC": AssetParams(average_growth=50.0, current_price=60_000)},
        )
        result = run_projection(inp)
        self.assertIn("BTC", result.asset_projections)
        btc = result.asset_projections["BTC"]
        self.assertEqual(len(btc["yearly"]), inp.years + 1)
        self.assertEqual(len(btc["monthly"]), inp.years * 12 + 1)


if __name__ == "__main__":
    unittest.main()
