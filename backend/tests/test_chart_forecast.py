import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.forecasting_service import forecasting_service, FORECASTING_TECHNIQUES
from backend.models.models import DatasetSession, SavedVisualization, MLExperiment
from backend.database.session import SessionLocal

client = TestClient(app)

def test_detect_chart_time_series():
    dates = [datetime(2024, 1, 1) + timedelta(days=i) for i in range(30)]
    df = pd.DataFrame({
        "order_date": dates,
        "revenue": [100.0 + i * 2.5 for i in range(30)],
        "category": ["A" if i % 2 == 0 else "B" for i in range(30)]
    })
    
    chart_meta = {
        "x_variable": "order_date",
        "y_variable": "revenue",
        "chart_type": "Line"
    }
    col_meta = {
        "order_date": {"data_type": "datetime"},
        "revenue": {"data_type": "float64"},
        "category": {"data_type": "object"}
    }
    
    result = forecasting_service.detect_chart_time_series(df, chart_meta, col_meta)
    assert result["is_suitable"] is True
    assert result["date_column"] == "order_date"
    assert result["target_column"] == "revenue"
    assert result["row_count"] == 30

def test_train_forecast_model_techniques():
    dates = [datetime(2023, 1, 1) + timedelta(days=i) for i in range(60)]
    values = [50.0 + i * 0.8 + np.sin(i / 3.0) * 5.0 for i in range(60)]
    df = pd.DataFrame({"timestamp": dates, "value": values})
    
    # Test Gradient Boosting
    res_gb = forecasting_service.train_forecast_model(
        experiment_id="test_exp_gb",
        df=df,
        date_column="timestamp",
        target_column="value",
        technique_id="gradient_boosting_forecast",
        hyperparameters={"lag_window": 5},
        forecast_horizon=6
    )
    assert res_gb["status"] == "completed"
    assert "mae" in res_gb["metrics"]
    assert "rmse" in res_gb["metrics"]
    assert len(res_gb["forecast_data"]["future_predictions"]) == 6

    # Test Ridge Trend
    res_ridge = forecasting_service.train_forecast_model(
        experiment_id="test_exp_ridge",
        df=df,
        date_column="timestamp",
        target_column="value",
        technique_id="ridge_trend",
        hyperparameters={"lag_window": 3},
        forecast_horizon=4
    )
    assert res_ridge["status"] == "completed"
    assert len(res_ridge["forecast_data"]["future_predictions"]) == 4

def test_chart_forecast_endpoints():
    db = SessionLocal()
    try:
        # Create test dataset session
        csv_content = "date,sales\n" + "\n".join([f"2024-01-{i+1:02d},{100 + i * 10}" for i in range(25)])
        dataset = DatasetSession(
            name="Forecast Test Dataset",
            original_filename="forecast_test.csv",
            file_path="forecast_test.csv",
            column_metadata={"date": {"data_type": "datetime"}, "sales": {"data_type": "int64"}}
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        # Write dummy CSV file so route can read it
        import os
        with open("forecast_test.csv", "w", encoding="utf-8") as f:
            f.write(csv_content)

        # Create chart
        chart = SavedVisualization(
            dataset_id=dataset.id,
            title="Daily Sales Forecast Chart",
            chart_type="Line",
            x_variable="date",
            y_variable="sales",
            category="bi_variable"
        )
        db.add(chart)
        db.commit()
        db.refresh(chart)

        # Train Chart Forecast via API
        response = client.post("/api/ml/chart-forecast/train", json={
            "dataset_id": dataset.id,
            "chart_id": chart.id,
            "forecast_horizon": 5
        })
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["workflow_type"] == "chart_forecast"
        assert data["chart_id"] == chart.id
        assert data["is_active_for_chart"] is True
        assert "metrics" in data
        assert "forecast_data" in data
        exp_id_1 = data["id"]

        # Train a second forecast model for the same chart to test history & active switching
        response2 = client.post("/api/ml/chart-forecast/train", json={
            "dataset_id": dataset.id,
            "chart_id": chart.id,
            "forecast_horizon": 3
        })
        assert response2.status_code == 200
        data2 = response2.json()
        exp_id_2 = data2["id"]
        assert data2["is_active_for_chart"] is True

        # Test GET history
        hist_resp = client.get(f"/api/ml/chart-forecast/history/{chart.id}")
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()
        assert hist_data["chart_id"] == chart.id
        assert hist_data["total_models"] == 2
        assert hist_data["active_model_id"] == exp_id_2

        # Test switching active model back to exp_id_1
        act_resp = client.post("/api/ml/chart-forecast/activate", json={
            "experiment_id": exp_id_1,
            "chart_id": chart.id
        })
        assert act_resp.status_code == 200

        # Verify active model is now exp_id_1
        active_resp = client.get(f"/api/ml/chart-forecast/active/{chart.id}")
        assert active_resp.status_code == 200
        active_data = active_resp.json()
        assert active_data["active_model"]["id"] == exp_id_1

        # Clean up dummy CSV
        if os.path.exists("forecast_test.csv"):
            os.remove("forecast_test.csv")
    finally:
        db.close()
