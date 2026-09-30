import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.session import Base, engine, SessionLocal
from backend.models.models import init_app_db, DatasetSession, SavedVisualization, MLExperiment, SavedDashboard

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_app_db()
    db = SessionLocal()
    # Clean test dashboards
    db.query(SavedDashboard).delete()
    db.commit()
    db.close()

def test_dashboard_crud_and_widgets():
    # 1. Create Dashboard
    create_res = client.post("/api/dashboards", json={
        "title": "Revenue & Operations Dashboard",
        "description": "Executive tracking",
        "settings": {"columns": 12, "theme": "dark"}
    })
    assert create_res.status_code == 200
    dash_data = create_res.json()
    dash_id = dash_data["id"]
    assert dash_data["title"] == "Revenue & Operations Dashboard"
    assert len(dash_data["tabs"]) == 1
    tab_id = dash_data["tabs"][0]["id"]

    # 2. Get Dashboard by ID
    get_res = client.get(f"/api/dashboards/{dash_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == dash_id

    # 3. Add visualization widget to dashboard
    add_vis_res = client.post(f"/api/dashboards/{dash_id}/add-visualization", json={
        "tab_id": tab_id,
        "visualization_config": {
            "title": "Monthly Profit Trend",
            "chart_type": "Line",
            "x_variable": "month",
            "y_variable": "profit",
            "aggregation": "sum",
            "sql_query": "SELECT month, SUM(profit) FROM dataset GROUP BY month"
        },
        "col_span": 8,
        "height": 400
    })
    assert add_vis_res.status_code == 200
    updated_dash = add_vis_res.json()
    assert len(updated_dash["tabs"][0]["layout"]) == 1
    widget = updated_dash["tabs"][0]["layout"][0]
    assert widget["title"] == "Monthly Profit Trend"
    assert widget["col_span"] == 8
    assert widget["height"] == 400

    # 4. Update Dashboard (reorder, rename tab, etc.)
    tabs = updated_dash["tabs"]
    tabs.append({"id": "tab-finance", "name": "Financials", "layout": []})
    update_res = client.put(f"/api/dashboards/{dash_id}", json={
        "title": "Updated Executive Dashboard",
        "tabs": tabs
    })
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Executive Dashboard"
    assert len(update_res.json()["tabs"]) == 2

    # 5. List Dashboards
    list_res = client.get("/api/dashboards")
    assert list_res.status_code == 200
    assert any(d["id"] == dash_id for d in list_res.json())

    # 6. Delete Dashboard
    del_res = client.delete(f"/api/dashboards/{dash_id}")
    assert del_res.status_code == 200
    get_del = client.get(f"/api/dashboards/{dash_id}")
    assert get_del.status_code == 404

def test_dashboard_ml_forecast_endpoint():
    db = SessionLocal()
    # Create dummy experiment
    exp = MLExperiment(
        model_name="Profit Regressor",
        problem_type="regression",
        target_column="profit",
        algorithm="Random Forest Regressor",
        feature_columns=["month", "units_sold"],
        metrics={"r2": 0.92},
        status="completed"
    )
    dataset = DatasetSession(
        name="Mock Dataset",
        original_filename="mock.csv",
        file_path="mock.csv",
        row_count=100,
        column_count=2
    )
    db.add(dataset)
    db.commit()
    exp.dataset_id = dataset.id
    db.add(exp)
    db.commit()
    db.refresh(exp)
    model_id = exp.id
    db.close()

    # Call forecast endpoint with historical data up to August
    hist_data = [
        {"month": "January", "profit": 12000},
        {"month": "February", "profit": 14500},
        {"month": "March", "profit": 13800},
        {"month": "April", "profit": 15600},
        {"month": "May", "profit": 17200},
        {"month": "June", "profit": 19000},
        {"month": "July", "profit": 20400},
        {"month": "August", "profit": 22100}
    ]

    forecast_res = client.post("/api/dashboards/forecast", json={
        "model_id": model_id,
        "x_variable": "month",
        "y_variable": "profit",
        "horizon": 3,
        "historical_data": hist_data
    })
    assert forecast_res.status_code == 200
    f_data = forecast_res.json()
    assert f_data["model_id"] == model_id
    assert f_data["horizon"] == 3
    assert f_data["legend_actual"] == "Actual"
    assert "ML Prediction" in f_data["legend_prediction"]
    assert f_data["color_prediction"] == "#f97316"
    assert len(f_data["historical_points"]) == 8
    assert len(f_data["prediction_points"]) == 3
    # Check that predictions are for September, October, November
    assert f_data["prediction_points"][0]["x"] == "September"
    assert f_data["prediction_points"][1]["x"] == "October"
    assert f_data["prediction_points"][2]["x"] == "November"

def test_dashboard_session_update_and_ai_layout_validation():
    from backend.services.dashboard_service import dashboard_service

    # 1. Create a dashboard
    create_res = client.post("/api/dashboards", json={
        "title": "Session Test Dashboard",
        "project_id": "session-init-123"
    })
    assert create_res.status_code == 200
    dash_id = create_res.json()["id"]
    assert create_res.json()["project_id"] == "session-init-123"

    # 2. Update dashboard session / data source
    update_res = client.put(f"/api/dashboards/{dash_id}", json={
        "project_id": "session-new-456",
        "title": "Renamed Session Dashboard"
    })
    assert update_res.status_code == 200
    assert update_res.json()["project_id"] == "session-new-456"
    assert update_res.json()["title"] == "Renamed Session Dashboard"

    # 3. Test AI dashboard layout validation with width and height
    mock_ai_config = {
        "title": "AI Executive Overview",
        "tabs": [
            {
                "name": "KPIs & Overview",
                "layout": [
                    {
                        "title": "Total Revenue",
                        "chart_type": "Metric",
                        "x_variable": "revenue",
                        "aggregation": "sum",
                        "width": 3,
                        "height": 140,
                        "sql_query": "SELECT SUM(revenue) as total FROM dataset"
                    },
                    {
                        "title": "Sales by Region",
                        "chart_type": "Bar",
                        "x_variable": "region",
                        "y_variable": "revenue",
                        "aggregation": "sum",
                        "width": 7,
                        "height": 380,
                        "sql_query": "SELECT region, SUM(revenue) as total FROM dataset GROUP BY region"
                    }
                ]
            }
        ]
    }

    validated = dashboard_service._validate_ai_dashboard_config(
        mock_ai_config,
        valid_columns=["revenue", "region"]
    )
    assert len(validated) == 1
    tab = validated[0]
    assert tab["name"] == "KPIs & Overview"
    assert len(tab["layout"]) == 2

    kpi_card = tab["layout"][0]
    assert kpi_card["chart_type"] == "Metric"
    assert kpi_card["width"] == 3
    assert kpi_card["col_span"] == 3
    assert kpi_card["height"] == 140

    chart_card = tab["layout"][1]
    assert chart_card["chart_type"] == "Bar"
    assert chart_card["width"] == 7
    assert chart_card["col_span"] == 7
    assert chart_card["height"] == 380

    # Cleanup
    client.delete(f"/api/dashboards/{dash_id}")


def test_ask_ai_card_modification(monkeypatch):
    from unittest.mock import AsyncMock
    from backend.llm.client import groq_client

    db = SessionLocal()
    # Create dataset session
    session = DatasetSession(
        name="Sales Data",
        original_filename="sales.csv",
        file_path="sales.csv",
        row_count=500,
        column_count=4,
        column_metadata={
            "region": {"data_type": "string", "sample_values": ["North", "South", "East"]},
            "revenue": {"data_type": "float", "sample_values": [1200.5, 3400.0, 560.25]},
            "month": {"data_type": "string", "sample_values": ["Jan", "Feb", "Mar"]},
            "sales": {"data_type": "float", "sample_values": [100.0, 250.0, 180.0]}
        }
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Create a dashboard with a card
    card_id = "card-test-123"
    create_res = client.post("/api/dashboards", json={
        "title": "Operations Dashboard",
        "project_id": session.id,
        "tabs": [
            {
                "id": "tab-1",
                "name": "Overview",
                "layout": [
                    {
                        "id": card_id,
                        "title": "Monthly Sales",
                        "chart_type": "Line",
                        "x_variable": "month",
                        "y_variable": "sales",
                        "aggregation": "sum",
                        "width": 6,
                        "col_span": 6,
                        "height": 360,
                        "order": 0,
                        "sql_query": "SELECT month, SUM(sales) as total FROM dataset GROUP BY month"
                    },
                    {
                        "id": "card-untouched",
                        "title": "Untouched KPI",
                        "chart_type": "Metric",
                        "width": 3,
                        "col_span": 3,
                        "height": 140,
                        "order": 1
                    }
                ]
            }
        ]
    })
    assert create_res.status_code == 200
    dash_id = create_res.json()["id"]

    # Mock LLM to return modified bar chart with yearly sales
    mock_llm_response = """
    {
      "title": "Yearly Sales",
      "chart_type": "Bar",
      "x_variable": "year",
      "y_variable": "sales",
      "aggregation": "sum",
      "sql_query": "SELECT strftime('%Y', month) as year, SUM(sales) as total FROM dataset GROUP BY year",
      "width": 6,
      "height": 360,
      "explanation": "Converted to bar chart and grouped sales by year."
    }
    """
    monkeypatch.setattr(groq_client, "get_chat_completion", AsyncMock(return_value=mock_llm_response))

    # Call /dashboards/modify-card-ai
    modify_res = client.post("/api/dashboards/modify-card-ai", json={
        "dashboard_id": dash_id,
        "card_id": card_id,
        "user_prompt": "Convert this line chart to a bar chart and change monthly sales to yearly sales",
        "project_id": session.id,
        "current_card": {
            "id": card_id,
            "title": "Monthly Sales",
            "chart_type": "Line",
            "x_variable": "month",
            "y_variable": "sales",
            "aggregation": "sum",
            "width": 6,
            "col_span": 6,
            "height": 360,
            "order": 0
        },
        "conversation_history": [
            {"role": "user", "content": "Initial prompt"}
        ]
    })

    assert modify_res.status_code == 200
    res_data = modify_res.json()
    assert res_data["card"]["id"] == card_id
    assert res_data["card"]["chart_type"] == "Bar"
    assert res_data["card"]["title"] == "Yearly Sales"
    # Sizing and layout preserved
    assert res_data["card"]["width"] == 6
    assert res_data["card"]["height"] == 360
    assert "explanation" in res_data

    # Check that the untouched card in the dashboard was NOT modified
    dash_after = client.get(f"/api/dashboards/{dash_id}").json()
    layout = dash_after["tabs"][0]["layout"]
    assert len(layout) == 2
    untouched = next(c for c in layout if c["id"] == "card-untouched")
    assert untouched["title"] == "Untouched KPI"
    assert untouched["chart_type"] == "Metric"

    modified = next(c for c in layout if c["id"] == card_id)
    assert modified["chart_type"] == "Bar"
    assert modified["title"] == "Yearly Sales"

    # Cleanup
    client.delete(f"/api/dashboards/{dash_id}")
    db.delete(session)
    db.commit()
    db.close()


