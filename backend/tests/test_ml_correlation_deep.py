import os
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.ml_service import ml_service
from backend.models.models import DatasetSession, MLExperiment
from backend.database.session import get_db

client = TestClient(app)

@pytest.fixture
def complex_df():
    """
    Dataset with mixed types:
    - Multiple numeric features (strongly, moderately, and weakly correlated with target)
    - Categorical features with low cardinality
    - Boolean features
    - High-cardinality ID column (should be excluded as ineligible)
    - Zero-variance constant column (should be excluded)
    - Target column 'sales' (numerical) and 'churn' (binary categorical)
    """
    np.random.seed(123)
    n = 200
    units_sold = np.random.randint(10, 500, size=n)
    unit_price = np.random.uniform(5, 50, size=n)
    # Sales is strongly correlated with units_sold * unit_price
    sales = units_sold * unit_price + np.random.normal(0, 100, size=n)
    # Marketing spend is moderately correlated with sales
    marketing_spend = sales * 0.15 + np.random.normal(0, 300, size=n)
    # Noise column: random noise, uncorrelated with sales
    random_noise = np.random.normal(0, 1, size=n)
    # Store category: 3 categories
    store_type = np.random.choice(["Retail", "Online", "Wholesale"], size=n)
    # Boolean promo flag
    is_holiday = np.random.choice([True, False], size=n)
    # Churn binary target: depends on units_sold
    churn = np.where(units_sold < 150, "Yes", "No")
    # Ineligible column: unique UUIDs
    unique_ids = [f"ID_{i}" for i in range(n)]
    # Ineligible column: constant value
    zero_var = [42.0] * n

    return pd.DataFrame({
        "unique_ids": unique_ids,
        "units_sold": units_sold,
        "unit_price": unit_price,
        "marketing_spend": marketing_spend,
        "random_noise": random_noise,
        "store_type": store_type,
        "is_holiday": is_holiday,
        "zero_var": zero_var,
        "sales": sales,
        "churn": churn
    })

def test_correlation_matrix_numerical_target(complex_df):
    col_meta = {
        "unique_ids": {"data_type": "categorical"},
        "units_sold": {"data_type": "numerical"},
        "unit_price": {"data_type": "numerical"},
        "marketing_spend": {"data_type": "numerical"},
        "random_noise": {"data_type": "numerical"},
        "store_type": {"data_type": "categorical"},
        "is_holiday": {"data_type": "boolean"},
        "zero_var": {"data_type": "numerical"},
        "sales": {"data_type": "numerical"},
        "churn": {"data_type": "categorical"}
    }

    res = ml_service.compute_correlation_matrix(
        df=complex_df,
        target_column="sales",
        col_meta=col_meta
    )

    assert res["target_column"] == "sales"
    assert res["target_type"] == "numerical"
    
    # Ineligible columns should not be in eligible_columns
    assert "unique_ids" not in res["eligible_columns"]
    assert "zero_var" not in res["eligible_columns"]
    
    # Target itself should not be in the 'correlations' list
    feature_names = [c["feature"] for c in res["correlations"]]
    assert "sales" not in feature_names
    
    # Strict sorting check: |r| must be descending
    correlations = res["correlations"]
    abs_corrs = [c["abs_correlation"] for c in correlations]
    assert abs_corrs == sorted(abs_corrs, reverse=True)
    
    # Highest correlated features with sales should be marketing_spend / units_sold / unit_price
    top_features = [c["feature"] for c in correlations[:3]]
    assert "marketing_spend" in top_features or "units_sold" in top_features
    
    # Pairwise matrix checks
    pw = res["pairwise_matrix"]
    assert pw is not None
    cols = pw["columns"]
    mat = pw["matrix"]
    assert len(cols) == len(mat)
    for i in range(len(cols)):
        assert len(mat[i]) == len(cols)
        # Diagonal must be 1.0
        assert pytest.approx(mat[i][i], 0.01) == 1.0
        # Symmetry check
        for j in range(len(cols)):
            assert pytest.approx(mat[i][j], 0.01) == mat[j][i]

def test_correlation_matrix_categorical_target(complex_df):
    col_meta = {
        "units_sold": {"data_type": "numerical"},
        "unit_price": {"data_type": "numerical"},
        "marketing_spend": {"data_type": "numerical"},
        "churn": {"data_type": "categorical"}
    }

    res = ml_service.compute_correlation_matrix(
        df=complex_df,
        target_column="churn",
        col_meta=col_meta
    )

    assert res["target_column"] == "churn"
    assert len(res["correlations"]) > 0
    correlations = res["correlations"]
    abs_corrs = [c["abs_correlation"] for c in correlations]
    assert abs_corrs == sorted(abs_corrs, reverse=True)

def test_ai_decide_auto_target_and_feature_selection(complex_df):
    col_meta = {
        "units_sold": {"data_type": "numerical"},
        "unit_price": {"data_type": "numerical"},
        "marketing_spend": {"data_type": "numerical"},
        "random_noise": {"data_type": "numerical"},
        "churn": {"data_type": "categorical"}
    }

    # Test 1: AI auto-identifies 'churn' as target
    decision = ml_service.ai_decide_ml_build(
        df=complex_df,
        dataset_name="Retail Telemetry",
        col_meta=col_meta,
        target_column=None,
        target_mode="ai",
        feature_mode="ai"
    )

    assert decision["target_column"] == "churn"
    assert decision["ml_category"] == "classification"
    assert len(decision["feature_columns"]) >= 2
    assert "churn" not in decision["feature_columns"]
    # Check reasoning
    assert "churn" in decision["reasoning"]["target_reason"]
    assert "correlations" in decision
    assert decision["pairwise_matrix"] is not None

    # Test 2: AI with user-specified numerical target 'sales'
    decision_sales = ml_service.ai_decide_ml_build(
        df=complex_df,
        dataset_name="Retail Telemetry",
        col_meta=col_meta,
        target_column="sales",
        target_mode="manual",
        feature_mode="ai"
    )

    assert decision_sales["target_column"] == "sales"
    assert decision_sales["ml_category"] == "regression"
    assert "sales" not in decision_sales["feature_columns"]
    assert "Random Forest Regressor" in decision_sales["algorithm"]

def test_end_to_end_api_endpoints(tmp_path):
    """
    Test full live cycle:
    1. Upload / create session
    2. Call /api/ml/target-correlation
    3. Call /api/ml/ai-decide
    4. Call /api/ml/train with the AI decision
    """
    csv_file = tmp_path / "retail_live_test.csv"
    df = pd.DataFrame({
        "customer_age": [25, 45, 35, 50, 23, 60, 40, 30, 55, 38] * 4,
        "tenure_months": [12, 60, 24, 72, 6, 80, 36, 18, 64, 40] * 4,
        "monthly_charges": [50.0, 90.0, 70.0, 110.0, 45.0, 105.0, 80.0, 65.0, 95.0, 75.0] * 4,
        "churn": ["No", "No", "No", "No", "Yes", "No", "No", "Yes", "No", "No"] * 4
    })
    df.to_csv(csv_file, index=False)

    db = next(get_db())
    session = DatasetSession(
        name="Retail Telemetry Live",
        original_filename="retail_live_test.csv",
        file_path=str(csv_file),
        row_count=len(df),
        column_count=4,
        column_metadata={
            "customer_age": {"data_type": "numerical"},
            "tenure_months": {"data_type": "numerical"},
            "monthly_charges": {"data_type": "numerical"},
            "churn": {"data_type": "categorical"}
        }
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    try:
        # Step A: Test /api/ml/target-correlation
        res_corr = client.post("/api/ml/target-correlation", json={
            "dataset_id": session.id,
            "target_column": "churn"
        })
        assert res_corr.status_code == 200, res_corr.text
        data_corr = res_corr.json()
        assert data_corr["target_column"] == "churn"
        assert len(data_corr["correlations"]) == 3
        # Strict descending order by abs_correlation
        vals = [c["abs_correlation"] for c in data_corr["correlations"]]
        assert vals == sorted(vals, reverse=True)

        # Step B: Test /api/ml/ai-decide
        res_ai = client.post("/api/ml/ai-decide", json={
            "dataset_id": session.id,
            "target_mode": "ai"
        })
        assert res_ai.status_code == 200, res_ai.text
        data_ai = res_ai.json()
        assert data_ai["target_column"] == "churn"
        assert data_ai["ml_category"] == "classification"
        assert len(data_ai["feature_columns"]) >= 1

        # Step C: Train model using the exact AI-chosen configuration
        res_train = client.post("/api/ml/train", json={
            "dataset_id": session.id,
            "model_name": "AI Churn Classifier Test",
            "problem_type": data_ai["ml_category"],
            "target_column": data_ai["target_column"],
            "feature_columns": data_ai["feature_columns"],
            "algorithm": data_ai["algorithm"],
            "hyperparameters": data_ai["hyperparameters"] or {},
            "train_config": {"test_size": 0.25, "random_state": 42}
        })
        assert res_train.status_code == 200, res_train.text
        train_data = res_train.json()
        assert train_data["status"] == "completed"
        assert "metrics" in train_data
        assert "accuracy" in train_data["metrics"]

    finally:
        # Clean up database
        experiments = db.query(MLExperiment).filter(MLExperiment.dataset_id == session.id).all()
        for exp in experiments:
            if exp.model_artifact_path and os.path.exists(exp.model_artifact_path):
                try: os.remove(exp.model_artifact_path)
                except Exception: pass
            db.delete(exp)
        db.delete(session)
        db.commit()
