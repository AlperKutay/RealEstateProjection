import streamlit as st
import subprocess
import os
from datetime import datetime

st.set_page_config(page_title="Real Estate Projection Control Panel", layout="wide")

st.title("🏠 Real Estate Projection Control Panel")

# Create three columns for inputs
col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Basic Parameters")
    years = st.number_input("Years", min_value=1, max_value=30, value=10)
    interest_rate = st.number_input("Interest Rate (%)", min_value=0.0, max_value=100.0, value=2.89)
    start_dollar_tl = st.number_input("Start Dollar/TL Rate", min_value=1.0, value=38.6)
    dollar_growth_rate = st.number_input("Dollar Growth Rate (%)", min_value=0.0, value=35.0)
    
    st.subheader("Salary Parameters")
    salary_currency = st.selectbox(
        "Salary Currency",
        ["EUR", "USD", "TL"],
        index=0
    )
    start_salary_base = st.number_input("Start Salary", min_value=0, value=32000)
    salary_growth = st.number_input("Salary Growth Rate (%)", min_value=0.0, value=6.0)
    euro_dollar_rate = st.number_input("Euro/Dollar Rate", min_value=0.0, value=1.15)

with col2:
    st.subheader("Property Parameters")
    initial_noncredit_amount = st.number_input("Initial Non-Credit Amount (TL)", min_value=0, value=1000000)
    value_of_house_tl = st.number_input("Value of House (TL)", min_value=0, value=2500000)
    price_rent_ratio = st.number_input("Price/Rent Ratio (Years)", min_value=1, value=15)
    
    st.subheader("Inflation Parameters")
    usa_inflation = st.number_input("USA Inflation Rate (%)", min_value=0.0, value=3.0)
    turkey_inflation = st.number_input("Turkey Inflation Rate (%)", min_value=0.0, value=35.0)
    include_inflation = st.checkbox("Include Inflation in Calculations", value=False)

with col3:
    st.subheader("Plot Options")
    use_months = st.checkbox("Use Monthly View", value=False)
    save_plots = st.checkbox("Save Plots to File", value=False)
    
    st.subheader("Select Plots to Display")
    plot_annual_payment = st.checkbox("Annual Payment (USD)", value=False)
    plot_dollar_rates = st.checkbox("Dollar Rates (USD/TL)", value=False)
    plot_dollar_salaries = st.checkbox("Dollar Salaries (USD)", value=False)
    plot_cumulative_payment = st.checkbox("Cumulative Payment (USD)", value=False)
    plot_total_credit = st.checkbox("Total Credit Amount with Initial Non-Credit Amount (USD)", value=False)
    plot_value_of_house = st.checkbox("Value of House (USD)", value=False)
    plot_monthly_payment = st.checkbox("Monthly Payment (USD)", value=False)

# Create command string
command = [
    "python", "main.py",
    "--years", str(years),
    "--interest_rate_of_credit", str(interest_rate),
    "--start_dollar_tl", str(start_dollar_tl),
    "--dollar_growth_rate_annual", str(dollar_growth_rate/100),
    "--start_salary_base", str(start_salary_base),
    "--salary_growth_annual", str(salary_growth/100),
    "--euro_dollar_rate", str(euro_dollar_rate),
    "--initial_noncredit_amount", str(initial_noncredit_amount),
    "--value_of_house_tl", str(value_of_house_tl),
    "--usa_inflation_rate", str(usa_inflation/100),
    "--turkey_inflation_rate", str(turkey_inflation/100),
    "--price_rent_ratio_yearly", str(price_rent_ratio),
    "--salary_currency", salary_currency
]

# Add save_plots option if selected
if save_plots:
    command.append("--save_plots")

# Add include_inflation option if selected
if include_inflation:
    command.append("--include_inflation")

# Add plot options
if plot_annual_payment:
    command.append("--plot_annual_payment_usd")
if plot_dollar_rates:
    command.append("--plot_dollar_rates")
if plot_dollar_salaries:
    command.append("--plot_dollar_salaries")
if plot_cumulative_payment:
    command.append("--plot_cumulative_payment_usd")
if plot_total_credit:
    command.append("--plot_total_credit_amount_with_initial_noncredit_amount")
if plot_value_of_house:
    command.append("--plot_value_of_house_usd")
if plot_monthly_payment:
    command.append("--plot_monthly_payment_usd")
if use_months:
    command.append("--use_months")

# Create a placeholder for the plot
plot_placeholder = st.empty()

# Add a button to generate the plot
if st.button("Generate Plot"):
    try:
        # Run the command
        result = subprocess.run(command, capture_output=True, text=True)
        
        # Display the plot
        plot_filename = "monthly_dollar_house_credit_cumulative_salary.png" if use_months else "annual_dollar_house_credit_cumulative_salary.png"
        
        if os.path.exists(plot_filename):
            with plot_placeholder.container():
                st.image(plot_filename)
                
                # If save_plots is not selected, remove the file after displaying
                if not save_plots:
                    try:
                        os.remove(plot_filename)
                    except:
                        pass
        
        # Display any output messages
        if result.stdout:
            st.text(result.stdout)
        if result.stderr:
            st.error(result.stderr)
            
    except Exception as e:
        st.error(f"An error occurred: {str(e)}")

# Add some helpful information
st.markdown("""
### How to Use
1. Adjust the parameters in the control panel
2. Select your salary currency (EUR, USD, or TL)
3. Choose whether to include inflation in calculations
4. Select which plots you want to display
5. Choose whether to save plots to file
6. Click "Generate Plot" to create the visualization
7. The plot will be displayed below and optionally saved

### Tips
- Use the monthly view for more detailed analysis
- Adjust the dollar growth rate to see different scenarios
- Compare different property values and initial payments
- Enable "Save Plots to File" if you want to keep the generated plots
- Use the inflation parameters to account for currency devaluation
- The Price/Rent Ratio helps evaluate property investment potential
""") 