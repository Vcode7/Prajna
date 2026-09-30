import pytest
import os
import pandas as pd
from backend.services.training_engine import training_engine
from backend.services.testing_service import testing_service
from backend.services.deployment_service import deployment_service

def test_testing_and_deployment_workflow(tmp_path):
    train_file = tmp_path / "housing_train.csv"
    train_df = pd.DataFrame({
        "sqft": [1000, 1500, 2000, 2500, 3000, 1200, 1800, 2200, 2800, 3200, 1100, 1600, 2100, 2600, 3100],
        "bedrooms": [2, 3, 3, 4, 4, 2, 3, 3, 4, 5, 2, 3, 4, 4, 5],
        "location": ["Urban", "Suburban", "Suburban", "Rural", "Urban", "Urban", "Suburban", "Rural", "Suburban", "Urban", "Rural", "Urban", "Suburban", "Urban", "Suburban"],
        "price": [200000, 300000, 400000, 480000, 600000, 240000, 360000, 420000, 540000, 650000, 220000, 320000, 410000, 500000, 620000]
    })
    train_df.to_csv(train_file, index=False)
    
    # Train regressor
    train_res = training_engine.train_model(
        experiment_id="exp_house_reg",
        file_path=str(train_file),
        model_name="House Price Regressor",
        problem_type="regression",
        target_column="price",
        feature_columns=["sqft", "bedrooms", "location"],
        algorithm="Linear Regression",
        hyperparameters={},
        train_config={"test_size": 0.2, "random_state": 42}
    )
    
    artifact_path = train_res["model_artifact_path"]
    assert os.path.exists(artifact_path)
    
    # Test evaluation with target present
    test_df = pd.DataFrame({
        "sqft": [1400, 2700],
        "bedrooms": [3, 4],
        "location": ["Urban", "Rural"],
        "price": [280000, 510000]
    })
    
    eval_res = testing_service.evaluate_and_predict(artifact_path, test_df)
    assert eval_res["has_ground_truth"] is True
    assert "mae" in eval_res["evaluation_metrics"]
    assert len(eval_res["rows"]) == 2
    assert "__ml_prediction" in eval_res["columns"]
    
    # Run deployed inference with side-by-side output
    inference_res = deployment_service.run_inference(
        artifact_path=artifact_path,
        records=[
            {"sqft": 1750, "bedrooms": 3, "location": "Suburban"},
            {"sqft": 2900, "bedrooms": 4, "location": "Urban"}
        ]
    )
    assert len(inference_res["rows"]) == 2
    assert inference_res["rows"][0]["__ml_prediction"] is not None
