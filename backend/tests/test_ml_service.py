import pytest
import os
import pandas as pd
from backend.services.ml_service import ml_service
from backend.services.training_engine import training_engine

def test_detect_problem_type():
    df_cls = pd.DataFrame({
        "churn": ["Yes", "No", "No", "Yes", "No"] * 5,
        "age": [25, 30, 45, 22, 60] * 5
    })
    col_meta_cls = {
        "churn": {"data_type": "categorical", "unique_count": 2},
        "age": {"data_type": "numerical", "unique_count": 5}
    }
    
    det_cls = ml_service.detect_problem_type(df_cls, "churn", col_meta_cls)
    assert det_cls["problem_type"] == "classification"
    assert det_cls["sub_type"] == "binary"
    
    det_reg = ml_service.detect_problem_type(df_cls, "age", col_meta_cls)
    assert det_reg["problem_type"] == "regression"
    
    det_clust = ml_service.detect_problem_type(df_cls, None, col_meta_cls)
    assert det_clust["problem_type"] == "clustering"

def test_train_classification_model(tmp_path):
    csv_file = tmp_path / "test_churn.csv"
    df = pd.DataFrame({
        "age": [20, 25, 35, 45, 55, 60, 22, 33, 44, 55, 66, 28, 38, 48, 58],
        "income": [30000, 40000, 60000, 80000, 100000, 120000, 32000, 52000, 72000, 92000, 112000, 45000, 65000, 85000, 105000],
        "contract": ["Monthly", "Yearly", "Monthly", "TwoYear", "Yearly", "TwoYear", "Monthly", "Yearly", "Monthly", "TwoYear", "Yearly", "Monthly", "Yearly", "TwoYear", "Monthly"],
        "churn": ["Yes", "No", "Yes", "No", "No", "No", "Yes", "No", "Yes", "No", "No", "Yes", "No", "No", "Yes"]
    })
    df.to_csv(csv_file, index=False)
    
    result = training_engine.train_model(
        experiment_id="exp_test_123",
        file_path=str(csv_file),
        model_name="Customer Churn Classifier",
        problem_type="classification",
        target_column="churn",
        feature_columns=["age", "income", "contract"],
        algorithm="Random Forest",
        hyperparameters={"n_estimators": 10},
        train_config={"test_size": 0.2, "random_state": 42}
    )
    
    assert result["status"] == "completed"
    assert "accuracy" in result["metrics"]
    assert os.path.exists(result["model_artifact_path"])

def test_technique_registry_categories():
    categories = ["regression", "classification", "forecasting", "segmentation", "anomaly_detection"]
    for cat in categories:
        techniques = ml_service.get_techniques_for_problem(cat)
        assert len(techniques) >= 3, f"Expected at least 3 models for {cat}"
        assert all("name" in t and "id" in t for t in techniques)

def test_train_regression_model(tmp_path):
    csv_file = tmp_path / "test_reg.csv"
    df = pd.DataFrame({
        "sqft": [1000, 1500, 2000, 2500, 3000, 1200, 1800, 2200, 2800, 3200],
        "bedrooms": [2, 3, 3, 4, 4, 2, 3, 3, 4, 5],
        "price": [200000, 280000, 350000, 420000, 500000, 230000, 310000, 370000, 460000, 530000]
    })
    df.to_csv(csv_file, index=False)

    result = training_engine.train_model(
        experiment_id="exp_reg_1",
        file_path=str(csv_file),
        model_name="House Price Regressor",
        problem_type="regression",
        target_column="price",
        feature_columns=["sqft", "bedrooms"],
        algorithm="Linear Regression",
        hyperparameters={},
        train_config={"test_size": 0.2, "random_state": 42}
    )
    assert result["status"] == "completed"
    assert "r2_score" in result["metrics"]
    assert "mae" in result["metrics"]

def test_train_segmentation_model(tmp_path):
    csv_file = tmp_path / "test_seg.csv"
    df = pd.DataFrame({
        "annual_spend": [100, 150, 200, 5000, 5500, 6000, 20000, 22000, 25000, 300],
        "visit_frequency": [1, 2, 1, 15, 18, 12, 45, 50, 42, 3]
    })
    df.to_csv(csv_file, index=False)

    result = training_engine.train_model(
        experiment_id="exp_seg_1",
        file_path=str(csv_file),
        model_name="Customer Segmentation",
        problem_type="segmentation",
        target_column=None,
        feature_columns=["annual_spend", "visit_frequency"],
        algorithm="K-Means Clustering",
        hyperparameters={"n_clusters": 3},
        train_config={"scaling": "standard"}
    )
    assert result["status"] == "completed"
    assert "cluster_distribution" in result["metrics"]
    assert "segment_profiles" in result["metrics"]
    assert result["metrics"]["num_clusters"] == 3

def test_train_anomaly_detection_model(tmp_path):
    csv_file = tmp_path / "test_anom.csv"
    df = pd.DataFrame({
        "amount": [10, 12, 11, 15, 14, 13, 9, 12, 11, 5000],  # 5000 is an outlier
        "duration": [5, 6, 5, 7, 6, 5, 4, 6, 5, 120]
    })
    df.to_csv(csv_file, index=False)

    result = training_engine.train_model(
        experiment_id="exp_anom_1",
        file_path=str(csv_file),
        model_name="Fraud Anomaly Detector",
        problem_type="anomaly_detection",
        target_column=None,
        feature_columns=["amount", "duration"],
        algorithm="Isolation Forest",
        hyperparameters={"contamination": 0.1},
        train_config={"scaling": "robust", "contamination": 0.1}
    )
    assert result["status"] == "completed"
    assert "anomaly_count" in result["metrics"]
    assert "top_anomalies" in result["metrics"]
    assert result["metrics"]["anomaly_count"] >= 1
