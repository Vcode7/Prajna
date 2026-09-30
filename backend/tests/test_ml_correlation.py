import os
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.ml_service import ml_service
from backend.models.models import DatasetSession
from backend.database.session import get_db

client = TestClient(app)

@pytest.fixture
def sample_df():
    np.random.seed(42)
    n = 100
    age = np.random.randint(18, 70, size=n)
    income = age * 1200 + np.random.normal(0, 5000, size=n)
    tenure = np.random.randint(1, 10, size=n)
    # Target churn is strongly negatively correlated with tenure and positively with age
    churn_prob = 1 / (1 + np.exp(-(0.05 * age - 0.4 * tenure)))
    churn = np.where(churn_prob > 0.5, "Yes", "No")
    contract = np.random.choice(["Monthly", "OneYear", "TwoYear"], size=n)
    constant_col = ["Constant"] * n

    return pd.DataFrame({
        "age": age,
        "income": income,
        "tenure": tenure,
        "contract": contract,
        "churn": churn,
        "constant_col": constant_col
    })

def test_compute_correlation_matrix(sample_df):
    col_meta = {
        "age": {"data_type": "numerical"},
        "income": {"data_type": "numerical"},
        "tenure": {"data_type": "numerical"},
        "contract": {"data_type": "categorical"},
        "churn": {"data_type": "categorical"},
        "constant_col": {"data_type": "categorical"}
    }

    res = ml_service.compute_correlation_matrix(
        df=sample_df,
        target_column="churn",
        col_meta=col_meta
    )

    assert res["target_column"] == "churn"
    assert "constant_col" not in res["eligible_columns"]
    assert "pairwise_matrix" in res
    assert len(res["pairwise_matrix"]["columns"]) == len(res["eligible_columns"])
    
    correlations = res["correlations"]
    assert len(correlations) > 0
    # Verify sorted strictly descending by abs_correlation
    abs_values = [c["abs_correlation"] for c in correlations]
    assert abs_values == sorted(abs_values, reverse=True)
    
    # Verify each correlation has required keys
    for c in correlations:
        assert "feature" in c
        assert "correlation" in c
        assert "abs_correlation" in c
        assert "strength" in c
        assert "direction" in c
        assert -1.0 <= c["correlation"] <= 1.0

def test_ai_decide_ml_build(sample_df):
    col_meta = {
        "age": {"data_type": "numerical"},
        "income": {"data_type": "numerical"},
        "tenure": {"data_type": "numerical"},
        "contract": {"data_type": "categorical"},
        "churn": {"data_type": "categorical"},
        "constant_col": {"data_type": "categorical"}
    }

    res = ml_service.ai_decide_ml_build(
        df=sample_df,
        dataset_name="Customer Telemetry",
        col_meta=col_meta,
        target_column=None,
        target_mode="ai",
        feature_mode="ai"
    )

    assert res["target_column"] == "churn"
    assert res["ml_category"] == "classification"
    assert len(res["feature_columns"]) > 0
    assert "churn" not in res["feature_columns"]
    assert "constant_col" not in res["feature_columns"]
    assert "reasoning" in res
    assert "target_reason" in res["reasoning"]
    assert "feature_reason" in res["reasoning"]
    assert "correlations" in res
    assert res["pairwise_matrix"] is not None

def test_api_endpoints_live(tmp_path):
    # Create a test dataset session and file
    csv_path = tmp_path / "test_api_churn.csv"
    df = pd.DataFrame({
        "age": [20, 30, 40, 50, 60, 25, 35, 45, 55, 65],
        "balance": [1000, 2000, 3000, 4000, 5000, 1500, 2500, 3500, 4500, 5500],
        "churn": ["No", "No", "No", "Yes", "Yes", "No", "No", "Yes", "Yes", "Yes"]
    })
    df.to_csv(csv_path, index=False)

    db = next(get_db())
    session = DatasetSession(
        name="Test API Churn",
        original_filename="test_api_churn.csv",
        file_path=str(csv_path),
        row_count=10,
        column_count=3,
        column_metadata={
            "age": {"data_type": "numerical"},
            "balance": {"data_type": "numerical"},
            "churn": {"data_type": "categorical"}
        }
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    try:
        # Test 1: Target correlation endpoint
        corr_res = client.post("/api/ml/target-correlation", json={
            "dataset_id": session.id,
            "target_column": "churn"
        })
        assert corr_res.status_code == 200
        corr_json = corr_res.json()
        assert corr_json["target_column"] == "churn"
        assert len(corr_json["correlations"]) == 2
        assert corr_json["correlations"][0]["abs_correlation"] >= corr_json["correlations"][1]["abs_correlation"]

        # Test 2: AI decide endpoint
        ai_res = client.post("/api/ml/ai-decide", json={
            "dataset_id": session.id,
            "target_mode": "ai"
        })
        assert ai_res.status_code == 200
        ai_json = ai_res.json()
        assert ai_json["target_column"] == "churn"
        assert ai_json["ml_category"] == "classification"
        assert len(ai_json["feature_columns"]) >= 1
        assert "churn" not in ai_json["feature_columns"]

    finally:
        db.delete(session)
        db.commit()
