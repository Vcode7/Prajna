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

