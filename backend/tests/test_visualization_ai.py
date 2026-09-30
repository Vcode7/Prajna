import pytest
import os
import pandas as pd
from unittest.mock import AsyncMock, patch
from backend.services.visualization_service import visualization_service
from backend.models.models import DatasetSession, SavedVisualization
from backend.database.session import SessionLocal
from backend.llm.client import groq_client

@pytest.fixture
def sample_dataset(tmp_path):
    db = SessionLocal()
    prod_csv = tmp_path / "production.csv"

    prod_df = pd.DataFrame({
        "machine_id": ["M1", "M2", "M3", "M1", "M2"],
        "plant": ["Plant A", "Plant A", "Plant B", "Plant B", "Plant A"],
        "units_produced": [100, 150, 120, 110, 130],
        "defect_count": [2, 5, 1, 3, 4]
    })
    prod_df.to_csv(prod_csv, index=False)

    session_record = DatasetSession(
        id="test_ai_dataset_123",
        name="production",
        original_filename="production.csv",
        file_path=str(prod_csv),
        processed_file_path=str(prod_csv),
        row_count=5,
        column_metadata={
            "machine_id": {"data_type": "categorical", "unique_count": 3},
            "plant": {"data_type": "categorical", "unique_count": 2},
            "units_produced": {"data_type": "numerical", "unique_count": 5},
            "defect_count": {"data_type": "numerical", "unique_count": 4}
        }
    )
    db.merge(session_record)
    db.commit()

    yield session_record, db

    # Cleanup
    db.query(SavedVisualization).filter(SavedVisualization.dataset_id == "test_ai_dataset_123").delete()
    db.query(DatasetSession).filter(DatasetSession.id == "test_ai_dataset_123").delete()
    db.commit()
    db.close()

def test_get_dataset_multi_table_schema(sample_dataset):
    dataset, db = sample_dataset
    schema_info = visualization_service.get_dataset_multi_table_schema(dataset.id, db)
    
    assert "tables" in schema_info
    assert len(schema_info["tables"]) >= 1
    prod_table = next((t for t in schema_info["tables"] if t["table_name"] in ("production", "dataset")), None)
    assert prod_table is not None
    col_names = [c["name"] for c in prod_table["columns"]]
    assert "machine_id" in col_names
    assert "units_produced" in col_names
    assert prod_table["row_count"] == 5

@pytest.mark.asyncio
async def test_generate_ai_important_visualizations(sample_dataset):
    dataset, db = sample_dataset

    mock_llm_json = """{
        "visualizations": [
            {
                "title": "Machine Units Produced",
                "category": "single_variable",
                "chart_type": "Bar",
                "x_variable": "machine_id",
                "y_variable": "units_produced",
                "aggregation": "sum",
                "description": "Total units by machine",
                "sql": "SELECT machine_id, SUM(units_produced) as units_produced FROM dataset GROUP BY machine_id",
                "reasoning": "Primary manufacturing output indicator"
            },
            {
                "title": "Defects by Plant",
                "category": "bi_variable",
                "chart_type": "Bar",
                "x_variable": "plant",
                "y_variable": "defect_count",
                "aggregation": "sum",
                "description": "Defect breakdown across plants",
                "sql": "SELECT plant, SUM(defect_count) as defect_count FROM dataset GROUP BY plant",
                "reasoning": "Quality assurance monitoring"
            }
        ]
    }"""

    with patch.object(groq_client, "get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_json
        saved_list = await visualization_service.generate_ai_important_visualizations(
            dataset_id=dataset.id,
            db=db
        )
        assert len(saved_list) == 2
        titles = [v["title"] for v in saved_list]
        assert "Machine Units Produced" in titles
        assert "Defects by Plant" in titles

@pytest.mark.asyncio
async def test_chat_with_data_and_visualization_data_question(sample_dataset):
    dataset, db = sample_dataset

    mock_llm_stage1 = """{
        "request_type": "data",
        "sql": "SELECT plant, SUM(defect_count) as total_defects FROM dataset GROUP BY plant ORDER BY total_defects DESC LIMIT 1",
        "tables_used": ["dataset"],
        "intent_summary": "Find plant with highest defect count"
    }"""

    mock_llm_stage2 = "Plant A has the highest defect rate with 11 total defects across all production batches."

    with patch.object(groq_client, "get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = [mock_llm_stage1, mock_llm_stage2]
        res = await visualization_service.chat_with_data_and_visualization(
            dataset_id=dataset.id,
            user_prompt="Which plant has the highest defect rate?",
            db=db
        )
        assert res["type"] == "data"
        assert "Plant A" in res["answer"]
        assert res["sql"] is not None

@pytest.mark.asyncio
async def test_chat_with_data_and_visualization_chart_request(sample_dataset):
    dataset, db = sample_dataset

    mock_llm_stage1 = """{
        "request_type": "visualization",
        "chart_type": "Bar",
        "category": "bi_variable",
        "title": "Production Quantity by Machine",
        "x_variable": "machine_id",
        "y_variable": "units_produced",
        "aggregation": "sum",
        "sql": "SELECT machine_id, SUM(units_produced) as units_produced FROM dataset GROUP BY machine_id",
        "tables_used": ["dataset"],
        "explanation": "Compares production quantity across individual machines."
    }"""

    with patch.object(groq_client, "get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_llm_stage1
        res = await visualization_service.chat_with_data_and_visualization(
            dataset_id=dataset.id,
            user_prompt="Generate a chart showing production quantity by machine",
            db=db
        )
        assert res["type"] == "visualization"
        assert res["chart"] is not None
        assert res["chart"]["chart_type"] == "Bar"
        assert len(res["chart"]["rows"]) > 0

def test_visualization_ai_chat_endpoint_with_user_prompt(sample_dataset):
    from fastapi.testclient import TestClient
    from backend.main import app

    dataset, db = sample_dataset
    client = TestClient(app)

    mock_llm_stage1 = """{
        "request_type": "data",
        "sql": "SELECT machine_id, AVG(defect_count) as avg_defects FROM dataset GROUP BY machine_id",
        "tables_used": ["dataset"],
        "intent_summary": "Calculate average defects per machine"
    }"""
    mock_llm_stage2 = "Machine M2 has the highest average defect count."

    with patch.object(groq_client, "get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = [mock_llm_stage1, mock_llm_stage2]
        res = client.post("/api/visualizations/ai-chat", json={
            "dataset_id": dataset.id,
            "user_prompt": "What is the average downtime of each machine?",
            "conversation_history": [],
            "current_chart_spec": None,
            "model": "openai/gpt-oss-120b"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["type"] == "data"
        assert "M2" in data["answer"]

@pytest.mark.asyncio
async def test_stream_visualization_generation(sample_dataset):
    dataset, db = sample_dataset
    import json

    mock_planner_single = json.dumps({
        "visualizations": [{
            "title": "Total Units Produced",
            "chart_type": "Metric",
            "fields": ["units_produced"],
            "description": "Total output volume",
            "category": "single_variable"
        }]
    })
    mock_planner_bi = json.dumps({
        "visualizations": [{
            "title": "Defects by Plant",
            "chart_type": "Bar",
            "fields": ["plant", "defect_count"],
            "description": "Defect breakdown across plants",
            "category": "bi_variable"
        }]
    })
    mock_planner_multi = json.dumps({
        "visualizations": [{
            "title": "Machine Output by Plant",
            "chart_type": "Stacked Bar",
            "fields": ["plant", "machine_id", "units_produced"],
            "description": "Units produced by plant and machine",
            "category": "multi_variable"
        }]
    })

    # Stage 2 responses for each
    mock_spec_1 = json.dumps({
        "title": "Total Units Produced",
        "chart_type": "Metric",
        "x_variable": "units_produced",
        "y_variable": "units_produced",
        "sql": "SELECT SUM(units_produced) AS units_produced FROM dataset LIMIT 1;",
        "calculations": "Sum of units produced"
    })
    mock_spec_2 = json.dumps({
        "title": "Defects by Plant",
        "chart_type": "Bar",
        "x_variable": "plant",
        "y_variable": "defect_count",
        "sql": "SELECT plant, SUM(defect_count) AS defect_count FROM dataset GROUP BY plant LIMIT 20;",
        "calculations": "Total defects grouped by plant"
    })
    mock_spec_3 = json.dumps({
        "title": "Machine Output by Plant",
        "chart_type": "Stacked Bar",
        "x_variable": "plant",
        "y_variable": "units_produced",
        "group_variable": "machine_id",
        "sql": "SELECT plant, machine_id, SUM(units_produced) AS units_produced FROM dataset GROUP BY plant, machine_id LIMIT 20;",
        "calculations": "Output by plant and machine"
    })

    with patch.object(groq_client, "get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = [
            mock_planner_single, mock_planner_bi, mock_planner_multi,
            mock_spec_1, mock_spec_2, mock_spec_3
        ]

        events = []
        async for chunk in visualization_service.stream_visualization_generation(dataset_id=dataset.id, db=db):
            for line in chunk.strip().split("\n"):
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))

        event_types = [e["type"] for e in events]
        assert "generation_started" in event_types
        assert "stage1_progress" in event_types
        assert "stage1_completed" in event_types
        assert "visualization_started" in event_types
        assert "visualization_completed" in event_types
        assert "generation_completed" in event_types

        # Verify completed visualizations count
        completed_events = [e for e in events if e["type"] == "visualization_completed"]
        assert len(completed_events) == 3
        titles = [e["title"] for e in completed_events]
        assert "Total Units Produced" in titles
        assert "Defects by Plant" in titles
        assert "Machine Output by Plant" in titles

