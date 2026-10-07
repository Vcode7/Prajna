import os
import io
import json
import pytest
import pandas as pd
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.database.session import SessionLocal
from backend.models.models import (
    DatasetSession, SavedVisualization, MLExperiment, DeployedModel, SavedDashboard, init_app_db
)
from backend.models.history import QueryHistory, init_history_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def prepare_databases():
    init_app_db()
    init_history_db()

@pytest.fixture
def sample_csv():
    df = pd.DataFrame({
        "order_id": [101, 102, 103, 104, 105],
        "customer": ["Alice", "Bob\t", "Charlie\r\n", "Diana", "Evan"],
        "region": ["North", "South", "East", "West", "North"],
        "sales": [250.0, 180.5, 320.0, 450.0, 150.0],
        "quantity": [2, 1, 3, 5, 1],
        "status": ["Completed", "Pending", "Completed", "Cancelled", "Completed"]
    })
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8")

# ============================================================================
# 1. ROOT & SETTINGS ENDPOINTS
# ============================================================================

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "version" in data

def test_settings_endpoints():
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    data = get_res.json()
    assert "default_model" in data
    assert "temperature" in data
    assert "max_tokens" in data

    # Update settings
    post_res = client.post("/api/settings", json={
        "temperature": 0.2,
        "max_tokens": 2048,
        "query_planner_max_tokens": 600
    })
    assert post_res.status_code == 200
    updated = post_res.json()
    assert updated["temperature"] == 0.2
    assert updated["max_tokens"] == 2048
    assert updated["query_planner_max_tokens"] == 600

# ============================================================================
# 2. CORE SCHEMA & SQL GENERATION ENDPOINTS
# ============================================================================

def test_schema_endpoint():
    res = client.get("/api/schema")
    assert res.status_code == 200
    data = res.json()
    assert "tables" in data
    assert len(data["tables"]) > 0

def test_generate_sql_endpoint():
    mock_plan = {
        "mode": "generator",
        "is_multi_query": False,
        "executive_title": "Order Sales Analysis",
        "plan": [{"id": "q1", "title": "Total Sales", "sql_instructions": "Get total sales"}]
    }
    mock_llm_sql = json.dumps({
        "reasoning": "Sum sales column",
        "sql": "SELECT SUM(total_amount) as total_sales FROM sales_orders",
        "explanation": "Calculates total sales revenue"
    })
    mock_summary = "Total revenue is healthy."

    with patch("backend.services.query_planner.groq_client.get_chat_completion", new_callable=AsyncMock) as m_plan, \
         patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as m_sql:
        m_plan.return_value = json.dumps(mock_plan)
        m_sql.side_effect = [mock_llm_sql, mock_summary]

        res = client.post("/api/generate-sql", json={
            "prompt": "Show total sales revenue",
            "conversation_id": "test_conv_1"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "sql" in data
        assert "history_id" in data

def test_execute_sql_endpoint():
    res = client.post("/api/execute", json={
        "prompt": "Select orders",
        "sql": "SELECT order_id, status FROM orders LIMIT 5"
    })
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert "columns" in data["data"]
    assert "rows" in data["data"]
    assert data["data"]["row_count"] <= 5

def test_execute_sql_invalid():
    res = client.post("/api/execute", json={
        "prompt": "Invalid SQL",
        "sql": "DROP TABLE orders"
    })
    assert res.status_code == 400

def test_repair_sql_endpoint():
    mock_repair = json.dumps({
        "reasoning": "Fixed table name",
        "sql": "SELECT * FROM orders LIMIT 3",
        "explanation": "Repaired query"
    })
    with patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as m_rep:
        m_rep.return_value = mock_repair
        res = client.post("/api/repair", json={
            "sql": "SELECT * FROM orders_fake",
            "error": "no such table: orders_fake"
        })
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert "SELECT * FROM orders" in res.json()["sql"]

def test_chart_endpoint():
    res = client.post("/api/chart", json={
        "prompt": "Sales by Region",
        "columns": ["region", "sales"],
        "rows": [{"region": "North", "sales": 100}, {"region": "South", "sales": 200}]
    })
    assert res.status_code == 200
    data = res.json()
    assert "chart_type" in data
    assert "series" in data or "x_axis" in data

def test_insights_and_widget_insights_endpoints():
    with patch("backend.services.insight_service.groq_client.get_chat_completion", new_callable=AsyncMock) as m_ins:
        m_ins.return_value = "Key finding: North region generated the highest sales."

        res_ins = client.post("/api/insights", json={
            "prompt": "Analyze sales by region",
            "sql": "SELECT region, sales FROM dataset",
            "columns": ["region", "sales"],
            "rows": [{"region": "North", "sales": 100}]
        })
        assert res_ins.status_code == 200
        assert "North region" in res_ins.json()["insights"]

        res_w_ins = client.post("/api/widget-insights", json={
            "widget_id": "widget_1",
            "user_query": "Sales breakdown",
            "sql": "SELECT * FROM dataset",
            "columns": ["region", "sales"],
            "rows": [{"region": "North", "sales": 100}],
            "row_count": 1
        })
        assert res_w_ins.status_code == 200
        assert res_w_ins.json()["widget_id"] == "widget_1"

# ============================================================================
# 3. QUERY HISTORY ENDPOINTS (CRUD)
# ============================================================================

def test_history_crud():
    # Create History
    save_res = client.post("/api/history", json={
        "conversation_id": "hist_conv_1",
        "prompt": "Test query history",
        "generated_sql": "SELECT 1",
        "execution_time_ms": 12.5,
        "rows_count": 1,
        "database_name": "test.db",
        "model_used": "qwen"
    })
    assert save_res.status_code == 200
    h_item = save_res.json()
    h_id = h_item["id"]

    # List History
    list_res = client.get("/api/history")
    assert list_res.status_code == 200
    assert any(h["id"] == h_id for h in list_res.json())

    # Update History
    put_res = client.put(f"/api/history/{h_id}", json={
        "is_favorite": True,
        "is_pinned": True,
        "session_name": "Updated Test Session"
    })
    assert put_res.status_code == 200
    assert put_res.json()["is_favorite"] is True
    assert put_res.json()["session_name"] == "Updated Test Session"

    # Delete History
    del_res = client.delete(f"/api/history/{h_id}")
    assert del_res.status_code == 200

    # 404 on deleting non-existent history
    del_res_404 = client.delete(f"/api/history/999999")
    assert del_res_404.status_code == 404

# ============================================================================
# 4. DATASETS, MULTI-SHEET & FIX FORMATTING ENDPOINTS
# ============================================================================

def test_datasets_full_lifecycle(sample_csv):
    # Upload
    files = {"file": ("sales_data.csv", sample_csv, "text/csv")}
    upload_res = client.post("/api/datasets/upload", files=files, data={"name": "Sales Records"})
    assert upload_res.status_code == 200
    ds = upload_res.json()
    ds_id = ds["id"]

    # List & Get
    assert client.get("/api/datasets").status_code == 200
    get_res = client.get(f"/api/datasets/{ds_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Sales Records"

    # Preview & Schema
    preview_res = client.get(f"/api/datasets/{ds_id}/preview?limit=3")
    assert preview_res.status_code == 200
    assert len(preview_res.json()["rows"]) == 3

    schema_res = client.get(f"/api/datasets/{ds_id}/schema")
    assert schema_res.status_code == 200

    # Column Unique Values
    uniq_res = client.get(f"/api/datasets/{ds_id}/column-unique-values/region")
    assert uniq_res.status_code == 200
    assert "values" in uniq_res.json()
    assert "North" in uniq_res.json()["values"]

    # Fix Formatting
    fix_res = client.post(f"/api/datasets/{ds_id}/fix-formatting")
    assert fix_res.status_code == 200
    assert fix_res.json()["status"] == "success"

    # Sheets info
    sheets_res = client.get(f"/api/datasets/{ds_id}/sheets")
    assert sheets_res.status_code == 200

    # Export CSV file download
    export_res = client.get(f"/api/datasets/{ds_id}/export")
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers.get("content-type", "")

    # Clean up dataset
    del_res = client.delete(f"/api/datasets/{ds_id}")
    assert del_res.status_code == 200

    # 404 on deleted
    assert client.get(f"/api/datasets/{ds_id}").status_code == 404

# ============================================================================
# 5. PROJECTS TREE & WORKSPACE ENDPOINTS
# ============================================================================

def test_projects_workspace_endpoints(sample_csv):
    # 1. Create Empty Project
    create_res = client.post("/api/projects", json={"name": "Analytics Project Alpha"})
    assert create_res.status_code == 200
    p_id = create_res.json()["id"]

    # 2. Update Project Name
    put_res = client.put(f"/api/projects/{p_id}", json={"name": "Analytics Project Renamed"})
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "Analytics Project Renamed"

    # 3. Upload dataset attached to this project
    files = {"file": ("records.csv", sample_csv, "text/csv")}
    upload_res = client.post("/api/datasets/upload", files=files, data={"project_id": p_id})
    assert upload_res.status_code == 200

    # 4. Project Tree
    tree_res = client.get("/api/projects/tree")
    assert tree_res.status_code == 200
    assert any(p["id"] == p_id for p in tree_res.json())

    # 5. Project Schema
    pschema_res = client.get(f"/api/projects/{p_id}/schema")
    assert pschema_res.status_code == 200

    # 6. Project Query
    q_res = client.post(f"/api/projects/{p_id}/query", json={
        "query": "SELECT region, COUNT(*) as cnt FROM dataset GROUP BY region",
        "limit": 10
    })
    assert q_res.status_code == 200
    assert "rows" in q_res.json()

    # 7. Project Transform
    tf_res = client.post(f"/api/projects/{p_id}/transform", json={
        "transformation_type": "filter_rows",
        "params": {"condition": "sales > 200"}
    })
    assert tf_res.status_code == 200

    # 8. Project Chat
    with patch("backend.services.project_service.groq_client.get_chat_completion", new_callable=AsyncMock) as m_chat:
        m_chat.return_value = json.dumps({
            "response": "Here is the sales query.",
            "sql_query": "SELECT * FROM dataset WHERE sales > 200",
            "suggested_visualization": {"chart_type": "Bar", "x_variable": "region", "y_variable": "sales"}
        })
        chat_res = client.post(f"/api/projects/{p_id}/chat", json={
            "message": "Which regions had sales over 200?"
        })
        assert chat_res.status_code == 200
        assert "explanation" in chat_res.json() or "reply" in chat_res.json()

    # Clean up project
    client.delete(f"/api/datasets/{p_id}")

# ============================================================================
# 6. ML, TESTING & DEPLOYMENT ENDPOINTS
# ============================================================================

def test_ml_testing_and_deployment_lifecycle(sample_csv):
    # Upload dataset
    files = {"file": ("data.csv", sample_csv, "text/csv")}
    ds_res = client.post("/api/datasets/upload", files=files, data={"name": "ML Data"})
    ds_id = ds_res.json()["id"]

    # Problem Detection
    p_det = client.post("/api/ml/detect-problem", json={
        "dataset_id": ds_id,
        "target_column": "status"
    })
    assert p_det.status_code == 200
    assert p_det.json()["problem_type"] == "classification"

    # Target Correlation
    corr_res = client.post("/api/ml/target-correlation", json={
        "dataset_id": ds_id,
        "target_column": "sales"
    })
    assert corr_res.status_code == 200
    assert "correlations" in corr_res.json()

    # AI Decide
    decide_res = client.post("/api/ml/ai-decide", json={
        "dataset_id": ds_id,
        "target_column": "sales"
    })
    assert decide_res.status_code == 200
    assert "algorithm" in decide_res.json()

    # Recommend ML
    with patch("backend.services.ml_service.groq_client.get_chat_completion", new_callable=AsyncMock) as m_rec:
        m_rec.return_value = json.dumps({
            "problem_type": "regression",
            "recommended_technique": "random_forest_regressor",
            "reasoning": "Resilient ensemble model",
            "ranked_techniques": [{"id": "random_forest_regressor", "rank": 1, "score": 95}]
        })
        rec_res = client.post("/api/ml/recommend", json={
            "dataset_id": ds_id,
            "target_column": "sales",
            "problem_type": "regression"
        })
        assert rec_res.status_code == 200
        assert "recommended_technique" in rec_res.json()

    # Train Model
    train_res = client.post("/api/ml/train", json={
        "dataset_id": ds_id,
        "model_name": "Sales Regressor",
        "problem_type": "regression",
        "target_column": "sales",
        "feature_columns": ["quantity"],
        "algorithm": "linear_regression",
        "hyperparameters": {},
        "train_config": {"test_size": 0.2, "random_state": 42}
    })
    assert train_res.status_code == 200
    exp = train_res.json()
    exp_id = exp["id"]

    # Experiments List & Get
    exp_list = client.get("/api/ml/experiments")
    assert exp_list.status_code == 200
    assert any(e["id"] == exp_id for e in exp_list.json())

    exp_get = client.get(f"/api/ml/experiments/{exp_id}")
    assert exp_get.status_code == 200
    assert exp_get.json()["id"] == exp_id

    # Testing Predict
    t_pred = client.post(f"/api/testing/{exp_id}/predict", data={
        "raw_data": json.dumps([{"quantity": 3, "sales": 300.0}])
    })
    assert t_pred.status_code == 200
    assert "__ml_prediction" in t_pred.json()["rows"][0]

    # Testing Insights
    with patch("backend.services.testing_service.groq_client.get_chat_completion", new_callable=AsyncMock) as m_tins:
        m_tins.return_value = "Predictions show linear increase with quantity."
        t_ins = client.post("/api/testing/insights", json={
            "model_id": exp_id,
            "prediction_summary": {"sample_count": 1}
        })
        assert t_ins.status_code == 200
        assert "insights" in t_ins.json()

    # Deploy Model
    dep_res = client.post("/api/deployments", json={
        "experiment_id": exp_id,
        "deployment_name": "Sales Predictor Prod",
        "version": "1.0.0",
        "description": "Production sales estimator"
    })
    assert dep_res.status_code == 200
    dep = dep_res.json()
    dep_id = dep["id"]

    # List & Get Deployments
    assert client.get("/api/deployments").status_code == 200
    assert client.get(f"/api/deployments/{dep_id}").status_code == 200

    # Update Deployment
    up_dep = client.put(f"/api/deployments/{dep_id}", json={
        "description": "Updated sales estimator"
    })
    assert up_dep.status_code == 200
    assert up_dep.json()["description"] == "Updated sales estimator"

    # Run Deployed Inference
    inf_res = client.post(f"/api/deployments/{dep_id}/predict", json={
        "records": [{"quantity": 4}]
    })
    assert inf_res.status_code == 200
    assert len(inf_res.json()["rows"]) == 1

    # Deployment Insights
    with patch("backend.services.testing_service.groq_client.get_chat_completion", new_callable=AsyncMock) as m_dins:
        m_dins.return_value = "Live inference results look normal."
        d_ins = client.post(f"/api/deployments/{dep_id}/insights", json={
            "predictions_summary": {"count": 1}
        })
        assert d_ins.status_code == 200

    # Download Model Bundle
    dl_res = client.get(f"/api/deployments/{dep_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.headers.get("content-type") == "application/octet-stream"

    # Clean up deployment, experiment, and dataset
    assert client.delete(f"/api/deployments/{dep_id}").status_code == 200
    assert client.delete(f"/api/ml/experiments/{exp_id}").status_code == 200
    assert client.delete(f"/api/datasets/{ds_id}").status_code == 200
