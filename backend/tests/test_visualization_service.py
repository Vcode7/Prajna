import pytest
import os
import pandas as pd
from backend.services.visualization_service import visualization_service

def test_generate_recommendations():
    df = pd.DataFrame({
        "category": ["Electronics", "Clothing", "Home", "Sports"] * 5,
        "region": ["North", "South", "East", "West"] * 5,
        "sales": [120, 250, 80, 310] * 5,
        "profit": [30, 45, 12, 60] * 5,
        "order_date": pd.date_range("2023-01-01", periods=20, freq="D")
    })
    
    col_meta = {
        "category": {"data_type": "categorical", "unique_count": 4},
        "region": {"data_type": "categorical", "unique_count": 4},
        "sales": {"data_type": "numerical", "unique_count": 4},
        "profit": {"data_type": "numerical", "unique_count": 4},
        "order_date": {"data_type": "datetime", "unique_count": 20}
    }
    
    recs = visualization_service.generate_recommendations("test_dataset", col_meta, df)
    categories = {r["category"] for r in recs}
    
    assert "single_variable" in categories
    assert "bi_variable" in categories
    assert "multi_variable" in categories
    assert len(recs) >= 6

def test_compute_visualization_data(tmp_path):
    csv_file = tmp_path / "test_sales.csv"
    df = pd.DataFrame({
        "region": ["North", "North", "South", "South", "East"],
        "sales": [100, 200, 150, 250, 300],
        "category": ["A", "B", "A", "B", "A"]
    })
    df.to_csv(csv_file, index=False)
    
    res = visualization_service.compute_visualization_data(
        file_path=str(csv_file),
        chart_type="Bar",
        x_variable="region",
        y_variable="sales",
        aggregation="sum"
    )
    
    assert len(res["rows"]) == 3
    # North sum is 300, South is 400, East is 300
    sales_map = {r["region"]: r["sales"] for r in res["rows"]}
    assert sales_map["North"] == 300
    assert sales_map["South"] == 400

@pytest.mark.asyncio
async def test_chat_to_visualization_spec_with_multisheet_meta():
    col_meta = {
        "product_name": {"data_type": "categorical", "unique_count": 8},
        "units_manufactured": {"data_type": "numerical", "unique_count": 50},
        "_sheets": ["Manufacturing_Production", "Supply_Chain_Logistics"],
        "_active_sheet": "Manufacturing_Production"
    }
    
    spec = await visualization_service.chat_to_visualization_spec(
        user_prompt="show units manufactured by product",
        col_meta=col_meta
    )
    assert spec is not None
    assert "chart_type" in spec
    assert "x_variable" in spec
    assert spec["x_variable"] != "_sheets"


@pytest.mark.asyncio
async def test_generate_visualization_insights():
    aggregated_data = [
        {"department": "Engineering", "headcount": 120, "budget": 500000},
        {"department": "Marketing", "headcount": 45, "budget": 200000},
        {"department": "Sales", "headcount": 80, "budget": 350000},
        {"department": "HR", "headcount": 15, "budget": 60000}
    ]
    columns = ["department", "headcount", "budget"]
    
    result = await visualization_service.generate_visualization_insights(
        title="Department Budget Overview",
        chart_type="Bar",
        x_variable="department",
        y_variable="budget",
        aggregated_data=aggregated_data,
        columns=columns
    )
    
    assert isinstance(result, str)
    assert len(result) > 50
    # Must contain markdown sections or takeaways
    assert "Key Findings" in result or "Takeaways" in result or "Department" in result


@pytest.mark.asyncio
async def test_generate_visualization_insights_heuristic_fallback(monkeypatch):
    from unittest.mock import AsyncMock
    from backend.llm.client import groq_client

    async def mock_fail(*args, **kwargs):
        raise ConnectionError("LLM offline")

    monkeypatch.setattr(groq_client, "get_chat_completion", mock_fail)

    aggregated_data = [
        {"month": "Jan", "revenue": 10000},
        {"month": "Feb", "revenue": 15000},
        {"month": "Mar", "revenue": 22000},
        {"month": "Apr", "revenue": 18000}
    ]
    columns = ["month", "revenue"]

    result = await visualization_service.generate_visualization_insights(
        title="Monthly Revenue Trend",
        chart_type="Line",
        x_variable="month",
        y_variable="revenue",
        aggregated_data=aggregated_data,
        columns=columns
    )

    assert isinstance(result, str)
    assert "Monthly Revenue Trend" in result
    assert "Mar" in result or "22,000" in result
    assert "Takeaways" in result



