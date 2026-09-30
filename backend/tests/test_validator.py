import pytest
from backend.services.sql_validator import sql_validator

def test_sql_validator_safe_queries():
    # Valid SELECT query
    ok, err = sql_validator.validate("SELECT * FROM customers LIMIT 10")
    assert ok is True
    assert err == ""

    # Valid CTE query
    cte_sql = """
    WITH monthly_sales AS (
        SELECT strftime('%Y-%m', order_date) AS month, SUM(quantity) as qty
        FROM orders
        GROUP BY month
    )
    SELECT * FROM monthly_sales ORDER BY month ASC
    """
    ok, err = sql_validator.validate(cte_sql)
    assert ok is True

def test_sql_validator_forbidden_keywords():
    # Attempting to delete
    ok, err = sql_validator.validate("DELETE FROM customers")
    assert ok is False
    assert "DELETE" in err

    # Attempting to drop table
    ok, err = sql_validator.validate("DROP TABLE orders")
    assert ok is False
    assert "DROP" in err

    # Attempting inline updates
    ok, err = sql_validator.validate("UPDATE products SET unit_price = 1000 WHERE product_id = 1")
    assert ok is False
    assert "UPDATE" in err

    # Attempting insert
    ok, err = sql_validator.validate("INSERT INTO customers (first_name, last_name) VALUES ('Jane', 'Doe')")
    assert ok is False
    assert "INSERT" in err

def test_sql_validator_syntax_and_types():
    # Empty query
    ok, err = sql_validator.validate("   ")
    assert ok is False
    assert "empty" in err

    # Non-select query
    ok, err = sql_validator.validate("SHOW TABLES")
    assert ok is False
    assert "SELECT" in err or "Only SELECT" in err

def test_sql_validator_dynamic_dataset_schema():
    # Dynamic schema from uploaded multi-sheet workbook
    custom_schema = {
        "table_names": ["manufacturing_production", "supply_chain_logistics"],
        "tables": [
            {
                "table_name": "manufacturing_production",
                "columns": [{"name": "machine_id"}, {"name": "downtime_hours"}]
            },
            {
                "table_name": "supply_chain_logistics",
                "columns": [{"name": "supplier_id"}, {"name": "lead_time_days"}]
            }
        ]
    }

    # Query targeting dynamic sheet table
    ok, err = sql_validator.validate("SELECT machine_id, AVG(downtime_hours) FROM manufacturing_production GROUP BY machine_id", schema=custom_schema)
    assert ok is True
    assert err == ""

    # Query targeting virtual dataset alias
    ok, err = sql_validator.validate("SELECT * FROM dataset LIMIT 10", schema=custom_schema)
    assert ok is True
    assert err == ""

    # Query targeting unknown table not in schema
    ok, err = sql_validator.validate("SELECT * FROM non_existent_table", schema=custom_schema)
    assert ok is False
    assert "non_existent_table" in err

    # Query with column validation on dotted reference
    ok, err = sql_validator.validate("SELECT manufacturing_production.invalid_col FROM manufacturing_production", schema=custom_schema)
    assert ok is False
    assert "invalid_col" in err
