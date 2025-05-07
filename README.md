# Real Estate Projection App

A Streamlit application for real estate investment projections and analysis.

## Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the app:
```bash
streamlit run app.py
```

## Deploying to Streamlit Cloud

1. Create a GitHub repository and push your code:
   - app.py
   - main.py
   - requirements.txt
   - .streamlit/config.toml
   - README.md

2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Sign in with your GitHub account
4. Click "New app"
5. Select your repository, branch, and main file (app.py)
6. Click "Deploy"

## Features

- Real estate investment projections
- Multiple currency support (EUR, USD, TL)
- Inflation calculations
- Price/Rent ratio analysis
- Interactive plots and visualizations
- Monthly and annual views
- Customizable parameters

## File Structure

- `app.py`: Streamlit interface
- `main.py`: Core calculation logic
- `requirements.txt`: Python dependencies
- `.streamlit/config.toml`: Streamlit configuration
