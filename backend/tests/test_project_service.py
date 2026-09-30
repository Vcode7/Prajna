import pytest
import os
import json
import pandas as pd
from backend.database.session import SessionLocal
from backend.models.models import init_app_db, DatasetSession, SavedVisualization
from backend.services.project_service import project_service
from backend.services.training_engine import training_engine

@pytest.fixture(scope="module")
def db_session():
    init_app_db()
    db = SessionLocal()
    yield db
    db.close()

def test_project_crud_and_tree(db_session):
    # Create empty project
    proj = project_service.create_empty_project("Test Alpha Project", db_session)
    assert proj.id is not None
    assert proj.name == "Test Alpha Project"

    # Add a visualization under this project
    vis = SavedVisualization(
        dataset_id=proj.id,
        category="single_variable",
        chart_type="Bar",
        x_variable="category",
        y_variable="sales",
        title="Sales by Category"
    )
    db_session.add(vis)
    db_session.commit()

    # Get project tree
    tree = project_service.get_project_tree(db_session)
    found = next((p for p in tree if p["id"] == proj.id), None)
    assert found is not None
    assert len(found["visualizations"]) >= 1
    assert found["visualizations"][0]["title"] == "Sales by Category"

def test_project_data_transformations(db_session, tmp_path):
    csv_file = tmp_path / "orders.csv"
    proc_file = tmp_path / "orders_proc.csv"
    df = pd.DataFrame({
        "price": [10.0, 20.0, 30.0, None, 50.0],
        "quantity": [2, 3, 1, 4, 2],
        "category": ["A", "B", "A", "C", "B"]
    })
    df.to_csv(csv_file, index=False)
    df.to_csv(proc_file, index=False)

    proj = DatasetSession(
        name="Orders Project",
        original_filename="orders.csv",
        file_path=str(csv_file),
        processed_file_path=str(proc_file),
        row_count=5,
        column_count=3,
        column_metadata={"price": {"data_type": "numerical"}, "quantity": {"data_type": "numerical"}, "category": {"data_type": "categorical"}}
    )
    db_session.add(proj)
    db_session.commit()

    # 1. Fill missing price with mean
    res_fill = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="fill_missing",
        params={"column": "price", "strategy": "mean"},
        db=db_session
    )
    assert res_fill["status"] == "success"

    # 2. Add calculated column: total_amount = price * quantity
    res_add = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="add_column",
        params={"new_column": "total_amount", "formula": "price * quantity"},
        db=db_session
    )
    assert res_add["status"] == "success"
    assert "total_amount" in res_add["preview"]["columns"]

    # 3. Rename column category -> product_category
    res_rename = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="rename_column",
        params={"old_name": "category", "new_name": "product_category"},
        db=db_session
    )
    assert res_rename["status"] == "success"
    assert "product_category" in res_rename["preview"]["columns"]

    # 4. Drop NA rows
    res_drop_na = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="drop_na_rows",
        params={"columns": ["price"]},
        db=db_session
    )
    assert res_drop_na["status"] == "success"
    assert res_drop_na["preview"]["total_rows"] == 5

    # 5. Type conversion
    res_cast = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="cast_type",
        params={"column": "quantity", "target_type": "float"},
        db=db_session
    )
    assert res_cast["status"] == "success"

    # 6. Replace values
    res_replace = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="replace_values",
        params={"column": "product_category", "to_replace": "A", "value": "Alpha"},
        db=db_session
    )
    assert res_replace["status"] == "success"

    # 7. Drop duplicates
    res_dedup = project_service.transform_project_data(
        project_id=proj.id,
        transformation_type="drop_duplicates",
        params={"columns": ["product_category"]},
        db=db_session
    )
    assert res_dedup["status"] == "success"

    # 8. SQL Query on dataset
    query_res = project_service.query_project_data(
        project_id=proj.id,
        query_str="SELECT product_category, SUM(total_amount) as sum_total FROM dataset GROUP BY product_category",
        db=db_session
    )
    assert len(query_res["rows"]) >= 1
    assert "sum_total" in query_res["columns"]

@pytest.mark.asyncio
async def test_project_data_chat_llm_flow(db_session, tmp_path, monkeypatch):
    csv_file = tmp_path / "sales.csv"
    proc_file = tmp_path / "sales_proc.csv"
    df = pd.DataFrame({
        "Revenue": [100.0, None, 300.0, 400.0],
        "Cost": [50.0, 60.0, 150.0, 200.0],
        "Product_ID": ["P1", "P2", None, "P4"]
    })
    df.to_csv(csv_file, index=False)
    df.to_csv(proc_file, index=False)

    proj = DatasetSession(
        name="Sales Analytics",
        original_filename="sales.csv",
        file_path=str(csv_file),
        processed_file_path=str(proc_file),
        row_count=4,
        column_count=3,
        column_metadata={"Revenue": {"data_type": "numerical"}, "Cost": {"data_type": "numerical"}, "Product_ID": {"data_type": "categorical"}}
    )
    db_session.add(proj)
    db_session.commit()

    # Scenario 1: User asks to fill missing Revenue
    mock_fill_response = json.dumps({
        "is_executable": True,
        "explanation": "Fill all missing values in the Revenue column using the column median.",
        "transformation_type": "fill_missing",
        "params": {"column": "Revenue", "strategy": "median"},
        "clarification_needed": False
    })

    from unittest.mock import AsyncMock
    monkeypatch.setattr(project_service.llm_client, "get_chat_completion", AsyncMock(return_value=mock_fill_response))

    chat_res = await project_service.project_data_chat(
        project_id=proj.id,
        user_message="Fill missing Revenue with median",
        db=db_session
    )
    assert chat_res["is_executable"] is True
    assert "Fill all missing values in the Revenue column" in chat_res["explanation"]
    assert chat_res["operation"]["transformation_type"] == "fill_missing"
    assert chat_res["operation"]["params"]["column"] == "Revenue"
    assert chat_res["clarification_needed"] is False

    # Scenario 2: User request is ambiguous
    mock_ambiguous_response = json.dumps({
        "is_executable": False,
        "explanation": "The dataset contains null values in both 'Revenue' (1 missing) and 'Product_ID' (1 missing). Would you like to drop rows or fill missing values?",
        "transformation_type": None,
        "params": None,
        "clarification_needed": True
    })
    monkeypatch.setattr(project_service.llm_client, "get_chat_completion", AsyncMock(return_value=mock_ambiguous_response))

    ambiguous_res = await project_service.project_data_chat(
        project_id=proj.id,
        user_message="Clean missing data",
        db=db_session
    )
    assert ambiguous_res["is_executable"] is False
    assert ambiguous_res["clarification_needed"] is True
    assert "Product_ID" in ambiguous_res["explanation"]

def test_persistent_project_sqlite_db(db_session, tmp_path):
    csv_file = tmp_path / "persistent_test.csv"
    df = pd.DataFrame({
        "item_id": [1, 2, 3],
        "quantity": [10, 20, 30]
    })
    df.to_csv(csv_file, index=False)

    proj = DatasetSession(
        name="Persistent DB Test Project",
        original_filename="persistent_test.csv",
        file_path=str(csv_file),
        processed_file_path=str(csv_file),
        row_count=3,
        column_count=2
    )
    db_session.add(proj)
    db_session.commit()

    # 1. Build and verify file created
    db_path = project_service.get_or_create_project_sqlite_db(proj)
    assert os.path.exists(db_path)

    # 2. Query executes against persistent DB
    res = project_service.query_project_data(proj.id, "SELECT SUM(quantity) AS total_qty FROM dataset", db_session)
    assert res["row_count"] == 1
    assert res["rows"][0]["total_qty"] == 60

    # 3. Verify subsequent call uses existing fresh DB without error
    db_path_2 = project_service.get_or_create_project_sqlite_db(proj)
    assert db_path_2 == db_path

    # 4. Clean up persistent DB
    project_service.delete_project_sqlite_db(proj.id)
    assert not os.path.exists(db_path)
