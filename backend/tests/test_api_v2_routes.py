import os
import io
import json
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

@pytest.fixture
def sample_csv_bytes():
    df = pd.DataFrame({
        "age": [25, 30, 45, 35, 50, 23, 40, 60, 28, 38],
        "income": [50000, 65000, 95000, 72000, 110000, 48000, 85000, 130000, 58000, 80000],
        "department": ["Sales", "Engineering", "Management", "Engineering", "Management", "Sales", "Engineering", "Management", "Sales", "Engineering"],
        "churn": [0, 0, 1, 0, 1, 0, 0, 1, 0, 0]
    })
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False)
    return csv_buf.getvalue().encode("utf-8")

def test_full_api_v2_pipeline(sample_csv_bytes):
    # 1. Upload Dataset
    files = {"file": ("employees.csv", sample_csv_bytes, "text/csv")}
    data = {"name": "Test Employees"}
    upload_res = client.post("/api/datasets/upload", files=files, data=data)
    assert upload_res.status_code == 200, upload_res.text
    dataset = upload_res.json()
    dataset_id = dataset["id"]
    assert dataset["name"] == "Test Employees"
    assert dataset["row_count"] == 10
    assert dataset["column_count"] >= 4

    # 2. Get Dataset & Preview
    get_res = client.get(f"/api/datasets/{dataset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dataset_id

    preview_res = client.get(f"/api/datasets/{dataset_id}/preview?limit=5")
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert len(preview_data["rows"]) == 5
    assert len(preview_data["columns"]) >= 4

    # 3. List Visualizations & Query Data
    vis_res = client.get(f"/api/visualizations?dataset_id={dataset_id}")
    assert vis_res.status_code == 200
    vis_list = vis_res.json()
    # Visualizations start clean without auto-generating random charts
    assert isinstance(vis_list, list)

    # Create a custom visualization
    create_vis_res = client.post("/api/visualizations", json={
        "dataset_id": dataset_id,
        "category": "bi_variable",
        "chart_type": "Bar",
        "x_variable": "department",
        "y_variable": "income",
        "aggregation": "mean",
        "title": "Income by Department"
    })
    assert create_vis_res.status_code == 200

    # Query chart data
    query_data_res = client.post("/api/visualizations/query-data", json={
        "dataset_id": dataset_id,
        "chart_type": "Bar",
        "x_variable": "department",
        "y_variable": "income",
        "aggregation": "mean"
    })
    assert query_data_res.status_code == 200
    chart_data = query_data_res.json()
    assert "rows" in chart_data
    assert "columns" in chart_data

    # 4. Detect Problem Type (The endpoint that had NameError pd)
    detect_res = client.post("/api/ml/detect-problem", json={
        "dataset_id": dataset_id,
        "target_column": "churn"
    })
    assert detect_res.status_code == 200, detect_res.text
    detection = detect_res.json()
    assert detection["problem_type"] == "classification"
    assert "classes" in detection
    assert detection["sub_type"] == "binary"

    # Test regression problem detection
    detect_reg = client.post("/api/ml/detect-problem", json={
        "dataset_id": dataset_id,
        "target_column": "income"
    })
    assert detect_reg.status_code == 200
    assert detect_reg.json()["problem_type"] == "regression"

    # 5. List ML Techniques
    tech_res = client.get("/api/ml/techniques?problem_type=classification")
    assert tech_res.status_code == 200
    techniques = tech_res.json()
    assert len(techniques) > 0
    assert any(t["id"] == "random_forest" for t in techniques)

    # 6. Train Model
    train_res = client.post("/api/ml/train", json={
        "dataset_id": dataset_id,
        "model_name": "Employee Churn Classifier",
        "problem_type": "classification",
        "target_column": "churn",
        "feature_columns": ["age", "income", "department"],
        "algorithm": "random_forest",
        "hyperparameters": {"n_estimators": 10},
        "train_config": {"test_size": 0.2, "random_state": 42, "scaling": "standard"}
    })
    assert train_res.status_code == 200, train_res.text
    experiment = train_res.json()
    exp_id = experiment["id"]
    assert experiment["status"] == "completed"
    assert "accuracy" in experiment["metrics"]

    # 7. Test Model Predict with Records
    predict_res = client.post(f"/api/testing/{exp_id}/predict", data={
        "raw_data": json.dumps([
            {"age": 29, "income": 60000, "department": "Sales", "churn": 0},
            {"age": 55, "income": 120000, "department": "Management", "churn": 1}
        ])
    })
    assert predict_res.status_code == 200, predict_res.text
    pred_result = predict_res.json()
    assert len(pred_result["rows"]) == 2
    assert "__ml_prediction" in pred_result["rows"][0]
    assert pred_result["evaluation_metrics"]["mode"] == "evaluation_mode"

    # 8. Deploy Model
    deploy_res = client.post("/api/deployments", json={
        "experiment_id": exp_id,
        "deployment_name": "Live Churn Predictor",
        "version": "v1.0",
        "description": "Production Churn Risk Model",
        "tags": ["prod", "churn"]
    })
    assert deploy_res.status_code == 200, deploy_res.text
    deployment = deploy_res.json()
    dep_id = deployment["id"]
    assert deployment["status"] == "active"

    # 9. Run Live Inference against Deployment
    infer_res = client.post(f"/api/deployments/{dep_id}/predict", json={
        "records": [
            {"age": 32, "income": 70000, "department": "Engineering"},
            {"age": 49, "income": 105000, "department": "Management"}
        ]
    })
    assert infer_res.status_code == 200, infer_res.text
    infer_data = infer_res.json()
    assert len(infer_data["rows"]) == 2
    assert "__ml_prediction" in infer_data["rows"][0]

    # 10. Dashboard Stats
    stats_res = client.get("/api/dashboard/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["stats"]["total_datasets"] >= 1
    assert stats["stats"]["total_trained_models"] >= 1
    assert stats["stats"]["total_deployed_models"] >= 1

    # 11. Project Tree
    tree_res = client.get("/api/projects/tree")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert len(tree) >= 1

    # 12. Cleanup
    del_dep = client.delete(f"/api/deployments/{dep_id}")
    assert del_dep.status_code == 200

    del_exp = client.delete(f"/api/ml/experiments/{exp_id}")
    assert del_exp.status_code == 200

    del_ds = client.delete(f"/api/datasets/{dataset_id}")
    assert del_ds.status_code == 200
