"""FastAPI backend — single source of truth for projection calculations.

Run with:
    uvicorn api:app --reload

Endpoints:
    GET  /api/assets                  -> list of supported asset symbols
    GET  /api/asset/{symbol}          -> {average_growth, current_price} (cached)
    POST /api/project                 -> full projection result (JSON)
    GET  /                            -> serves frontend/index.html
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from projection import (
    AssetParams,
    ProjectionInput,
    run_projection,
)
from stock_market_helper import fetch_and_calculate, supported_assets

ROOT = Path(__file__).parent
FRONTEND_DIR = ROOT / "frontend"

app = FastAPI(title="Real Estate Projection API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AssetParamsBody(BaseModel):
    average_growth: float
    current_price: float


class ProjectionRequest(BaseModel):
    years: int = 10
    interest_rate: float = 2.74
    initial_noncredit_amount_tl: float = 350_000
    value_of_house_tl: float = 2_100_000

    start_dollar_tl: float = 45.0
    dollar_growth_rate: float = 35.0
    turkey_inflation: float = 25.0
    usa_inflation: float = 3.0

    initial_monthly_rent_tl: float = 20_000.0

    salary_currency: str = "USD"
    start_salary_base: float = 0.0
    salary_growth: float = 0.0
    euro_dollar_rate: float = 1.15
    months_to_increase: int = 12

    use_months: bool = True
    deflate_dollar_by_us_inflation: bool = False
    generate_random: bool = False
    project_initial_money_with_asset: bool = False

    # Symbol -> params. Client can include 0..N assets; presence means "project this".
    assets: dict[str, AssetParamsBody] = Field(default_factory=dict)


class AssetResponse(BaseModel):
    symbol: str
    average_growth: float
    current_price: float


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/assets")
def list_assets() -> dict:
    return {"assets": supported_assets()}


@app.get("/api/asset/{symbol}", response_model=AssetResponse)
def get_asset(symbol: str, use_months: bool = False) -> AssetResponse:
    result = fetch_and_calculate(symbol, use_months=use_months)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Unknown or unavailable asset: {symbol}")
    avg_return, current_price = result
    return AssetResponse(symbol=symbol, average_growth=avg_return, current_price=current_price)


@app.post("/api/project")
def project(req: ProjectionRequest) -> dict:
    inp = ProjectionInput(
        years=req.years,
        interest_rate=req.interest_rate,
        initial_noncredit_amount_tl=req.initial_noncredit_amount_tl,
        value_of_house_tl=req.value_of_house_tl,
        start_dollar_tl=req.start_dollar_tl,
        dollar_growth_rate=req.dollar_growth_rate,
        turkey_inflation=req.turkey_inflation,
        usa_inflation=req.usa_inflation,
        initial_monthly_rent_tl=req.initial_monthly_rent_tl,
        salary_currency=req.salary_currency,
        start_salary_base=req.start_salary_base,
        salary_growth=req.salary_growth,
        euro_dollar_rate=req.euro_dollar_rate,
        months_to_increase=req.months_to_increase,
        use_months=req.use_months,
        deflate_dollar_by_us_inflation=req.deflate_dollar_by_us_inflation,
        generate_random=req.generate_random,
        project_initial_money_with_asset=req.project_initial_money_with_asset,
        assets={
            sym: AssetParams(average_growth=p.average_growth, current_price=p.current_price)
            for sym, p in req.assets.items()
        },
    )
    return run_projection(inp).to_dict()


# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(FRONTEND_DIR / "index.html")
