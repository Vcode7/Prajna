import pytest
from backend.services.schema_service import schema_service

def test_schema_service_tables():
    # Fetch base schema details
    schema = schema_service.get_schema()
    
    assert "tables" in schema
    assert "relationships" in schema
    
    # Check that our seeded tables exist
    tables_list = list(schema["tables"].keys())
    assert "customers" in tables_list
    assert "products" in tables_list
    assert "orders" in tables_list
    assert "order_items" in tables_list
    assert "employees" in tables_list
    
    # Validate column details
    cust_columns = schema["tables"]["customers"]["columns"]
    assert "customer_id" in cust_columns
    assert cust_columns["customer_id"]["primary_key"] is True
    assert cust_columns["company_name"]["nullable"] is False

def test_schema_service_explorer_metadata():
    # Fetch DB explorer detailed tree info
    meta = schema_service.get_database_explorer_metadata()
    
    assert "tables" in meta
    # Verify sample rows are loaded
    assert len(meta["tables"]["products"]["sample_rows"]) > 0
    # Verify uniqueness percentages and null metrics are computed
    prod_meta = meta["tables"]["products"]["columns"]["product_name"]
    assert "null_percentage" in prod_meta
    assert "unique_values_count" in prod_meta
