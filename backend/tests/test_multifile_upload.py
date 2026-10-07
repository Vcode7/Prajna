import os
import io
import json
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_multifile_upload_as_sheets():
    # 1. Create two sample CSVs
    users_df = pd.DataFrame({
        "user_id": [1, 2, 3, 4],
        "name": ["Alice", "Bob", "Charlie", "David"],
        "country": ["USA", "UK", "Canada", "USA"]
    })
    users_buf = io.StringIO()
    users_df.to_csv(users_buf, index=False)
    users_bytes = users_buf.getvalue().encode("utf-8")

    tx_df = pd.DataFrame({
        "tx_id": [101, 102, 103, 104, 105],
        "user_id": [1, 2, 1, 3, 2],
        "amount": [250.0, 120.5, 45.0, 890.0, 310.0]
    })
    tx_buf = io.StringIO()
    tx_df.to_csv(tx_buf, index=False)
    tx_bytes = tx_buf.getvalue().encode("utf-8")

    # 2. Upload both files in a single request as 'files'
    upload_files = [
        ("files", ("users.csv", users_bytes, "text/csv")),
        ("files", ("transactions.csv", tx_bytes, "text/csv"))
    ]
    data = {"name": "Multi-File ERP Dataset"}

    res = client.post("/api/datasets/upload", files=upload_files, data=data)
    assert res.status_code == 200, res.text
    dataset = res.json()
    dataset_id = dataset["id"]

    # Verify sheet names are detected from the two files
    sheets = dataset.get("available_sheets") or []
    assert len(sheets) == 2, f"Expected 2 sheets, got: {sheets}"
    assert "Users" in sheets or "users" in sheets
    assert "Transactions" in sheets or "transactions" in sheets

    active_sheet = dataset.get("active_sheet")
    assert active_sheet in sheets

    # 3. Test Preview for active sheet
    preview_res = client.get(f"/api/datasets/{dataset_id}/preview")
    assert preview_res.status_code == 200
    preview = preview_res.json()
    assert len(preview["rows"]) > 0

    # 4. Test Switching Sheet
    target_sheet = [s for s in sheets if s != active_sheet][0]
    switch_res = client.post(
        f"/api/datasets/{dataset_id}/switch-sheet",
        json={"sheet_name": target_sheet}
    )
    assert switch_res.status_code == 200, switch_res.text
    switched = switch_res.json()
    assert switched["active_sheet"] == target_sheet

    # Verify preview reflects switched sheet
    switched_preview_res = client.get(f"/api/datasets/{dataset_id}/preview")
    assert switched_preview_res.status_code == 200
    switched_preview = switched_preview_res.json()
    assert len(switched_preview["rows"]) > 0

    # 5. Test SQLite Cross-Sheet Query (Joins across the two uploaded sheets)
    join_query = "SELECT u.name, SUM(t.amount) as total_spend FROM users u JOIN transactions t ON u.user_id = t.user_id GROUP BY u.name"
    query_res = client.post(
        f"/api/projects/{dataset_id}/query",
        json={"query": join_query, "limit": 10}
    )
    assert query_res.status_code == 200, query_res.text
    query_data = query_res.json()
    assert len(query_data["rows"]) > 0
    names = [r["name"] for r in query_data["rows"]]
    assert "Alice" in names

    # Clean up dataset
    client.delete(f"/api/datasets/{dataset_id}")

def test_upload_with_mixed_numbers_and_text():
    # 1. Create a CSV with mixed columns
    mixed_df = pd.DataFrame({
        "order_id": ["101", 102, "103-B", 104],
        "status_code": [200, "ERR_404", 500, "OK"],
        "price": [19.99, 29.50, 10.00, 45.00],
        "notes": ["Standard shipping", "Express air", "Ground parcel", "Freight"]
    })
    buf = io.StringIO()
    mixed_df.to_csv(buf, index=False)
    csv_bytes = buf.getvalue().encode("utf-8")

    upload_files = [
        ("files", ("mixed_orders.csv", csv_bytes, "text/csv"))
    ]
    data = {"name": "Mixed Orders Dataset"}

    res = client.post("/api/datasets/upload", files=upload_files, data=data)
    assert res.status_code == 200, res.text
    dataset = res.json()
    dataset_id = dataset["id"]

    # 2. Check preview endpoint
    preview_res = client.get(f"/api/datasets/{dataset_id}/preview")
    assert preview_res.status_code == 200
    preview = preview_res.json()

    # Column types in preview should report text
    assert preview["column_types"]["order_id"] == "text"
    assert preview["column_types"]["status_code"] == "text"
    assert preview["column_types"]["price"] == "numerical"

    # SQL types in preview should report TEXT
    assert preview["sql_types"]["order_id"] == "TEXT"
    assert preview["sql_types"]["status_code"] == "TEXT"

    # Mixed columns should be identified
    assert "order_id" in preview.get("mixed_columns", [])
    assert "status_code" in preview.get("mixed_columns", [])

    # 3. Check schema endpoint
    schema_res = client.get(f"/api/datasets/{dataset_id}/schema")
    assert schema_res.status_code == 200
    schema_data = schema_res.json()
    assert "tables" in schema_data
    assert "column_metadata" in schema_data

    # Verify column metadata in dataset table schema
    dataset_cols = schema_data["tables"]["dataset"]["columns"]
    assert "order_id" in dataset_cols
    assert "status_code" in dataset_cols
    assert dataset_cols["order_id"]["data_type"] == "text"
    assert dataset_cols["order_id"]["sql_type"] == "TEXT"
    assert dataset_cols["order_id"]["has_mixed_types"] is True

    assert dataset_cols["status_code"]["data_type"] == "text"
    assert dataset_cols["status_code"]["sql_type"] == "TEXT"
    assert dataset_cols["status_code"]["has_mixed_types"] is True

    # Also verify top-level column_metadata
    assert schema_data["column_metadata"]["order_id"]["data_type"] == "text"
    assert schema_data["column_metadata"]["order_id"]["sql_type"] == "TEXT"
    assert schema_data["column_metadata"]["order_id"]["has_mixed_types"] is True

    # 4. Check SQLite execution - types stored in SQLite
    query_res = client.post(
        f"/api/projects/{dataset_id}/query",
        json={"query": "SELECT typeof(order_id) as t_order, typeof(status_code) as t_status FROM dataset LIMIT 1"}
    )
    assert query_res.status_code == 200, query_res.text
    q_rows = query_res.json()["rows"]
    assert len(q_rows) > 0
    assert q_rows[0]["t_order"] == "text"
    assert q_rows[0]["t_status"] == "text"

    # Clean up dataset
    client.delete(f"/api/datasets/{dataset_id}")

