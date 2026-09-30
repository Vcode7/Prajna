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
