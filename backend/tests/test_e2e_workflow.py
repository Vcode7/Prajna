import pytest
import os
import json
import pandas as pd
from backend.services.dataset_service import dataset_service
from backend.services.visualization_service import visualization_service
from backend.services.ml_service import ml_service
from backend.services.training_engine import training_engine
from backend.services.testing_service import testing_service
from backend.services.deployment_service import deployment_service

def test_complete_e2e_platform_workflow(tmp_path):
    """
    End-to-End Workflow Verification:
    CSV Upload -> Profiling -> Recommendations -> Slicing -> Problem Detection ->
    Training -> Testing -> Deployment -> Inference.
    """
    # 1. Simulate Raw CSV Dataset
    csv_path = tmp_path / "customer_analytics.csv"
    raw_df = pd.DataFrame({
        "customer_id": [f"CUST_{i:03d}" for i in range(1, 41)],
        "age": [25, 32, 45, 29, 52, 41, 36, 28, 59, 34, 48, 22, 61, 39, 44, 31, 55, 26, 67, 33] * 2,
        "monthly_charges": [45.5, 78.2, 89.0, 35.0, 110.5, 65.0, 72.4, 40.0, 95.0, 60.5, 85.0, 30.0, 115.0, 70.0, 80.0, 50.0, 100.0, 38.0, 120.0, 55.0] * 2,
        "contract_type": ["Month-to-Month", "One-Year", "Two-Year", "Month-to-Month", "Month-to-Month"] * 8,
        "region": ["North", "South", "East", "West"] * 10,
        "signup_date": pd.date_range("2022-01-01", periods=40, freq="W"),
        "churn": ["Yes", "No", "No", "Yes", "Yes", "No", "No", "Yes", "Yes", "No"] * 4
    })
    raw_df.to_csv(csv_path, index=False)

    # 2. Step 1 - Dataset Profiling & Preprocessing
    df = dataset_service.read_csv_robust(str(csv_path))
    assert len(df) == 40
    col_meta, data_quality = dataset_service.profile_dataset(df)
    assert col_meta["age"]["data_type"] == "numerical"
    assert col_meta["churn"]["data_type"] == "categorical"
    assert col_meta["signup_date"]["data_type"] == "datetime"

    df_processed, derived_features = dataset_service.generate_derived_features(df, col_meta)
    assert "signup_date_year" in df_processed.columns
    assert len(derived_features) >= 2

    # 3. Step 2 - Visualization Recommendations & Data Slicing
    recs = visualization_service.generate_recommendations("cust_session", col_meta, df_processed)
    assert len(recs) >= 6

    # Test data aggregation for a Bar chart
    proc_csv = tmp_path / "customer_analytics_proc.csv"
    df_processed.to_csv(proc_csv, index=False)
    chart_data = visualization_service.compute_visualization_data(
        file_path=str(proc_csv),
        chart_type="Bar",
        x_variable="contract_type",
        y_variable="monthly_charges",
        aggregation="avg"
    )
    assert len(chart_data["rows"]) == 3
    assert "contract_type" in chart_data["columns"]

    # 4. Step 3 - ML Problem Type Detection & Training
    detection = ml_service.detect_problem_type(df_processed, "churn", col_meta)
    assert detection["problem_type"] == "classification"
    assert detection["sub_type"] == "binary"

    train_res = training_engine.train_model(
        experiment_id="exp_churn_prod",
        file_path=str(proc_csv),
        model_name="Customer Churn Predictor",
        problem_type="classification",
        target_column="churn",
        feature_columns=["age", "monthly_charges", "contract_type", "region"],
        algorithm="Random Forest",
        hyperparameters={"n_estimators": 20, "max_depth": 5},
        train_config={"test_size": 0.25, "random_state": 42}
    )
    assert train_res["status"] == "completed"
    assert "accuracy" in train_res["metrics"]
    artifact_path = train_res["model_artifact_path"]
    assert os.path.exists(artifact_path)

    # 5. Step 4 - Testing on Sample Data
    test_df = pd.DataFrame({
        "age": [27, 58, 35],
        "monthly_charges": [42.0, 118.0, 68.5],
        "contract_type": ["Month-to-Month", "Month-to-Month", "Two-Year"],
        "region": ["North", "East", "West"],
        "churn": ["Yes", "Yes", "No"]
    })
    test_res = testing_service.evaluate_and_predict(artifact_path, test_df)
    assert test_res["has_ground_truth"] is True
    assert len(test_res["rows"]) == 3
    assert "__ml_prediction" in test_res["columns"]

    # 6. Step 5 - Deployment & Live Inference
    inference_res = deployment_service.run_inference(
        artifact_path=artifact_path,
        records=[
            {"age": 30, "monthly_charges": 85.0, "contract_type": "Month-to-Month", "region": "South"},
            {"age": 62, "monthly_charges": 35.0, "contract_type": "Two-Year", "region": "North"}
        ]
    )
    assert len(inference_res["rows"]) == 2
    assert inference_res["rows"][0]["__ml_prediction"] in ["Yes", "No"]
