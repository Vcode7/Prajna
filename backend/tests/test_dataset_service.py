import pytest
import io
import pandas as pd
from backend.services.dataset_service import dataset_service

def test_read_csv_robust():
    csv_data = b"id,name,age,salary,join_date\n1,Alice,28,75000.5,2022-01-15\n2,Bob,34,82000.0,2021-06-20\n3,Charlie,42,105000.0,2019-11-05\n"
    df = dataset_service.read_csv_robust(csv_data)
    assert len(df) == 3
    assert "name" in df.columns
    assert "salary" in df.columns

def test_profile_dataset():
    df = pd.DataFrame({
        "customer_id": [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
        "age": [25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
        "segment": ["SMB", "Enterprise", "SMB", "Mid-Market", "Enterprise", "SMB", "SMB", "Enterprise", "Mid-Market", "Enterprise"],
        "signup_date": ["2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01", "2023-05-01", "2023-06-01", "2023-07-01", "2023-08-01", "2023-09-01", "2023-10-01"],
        "churned": [False, True, False, False, True, False, False, True, False, True]
    })
    
    col_meta, data_quality = dataset_service.profile_dataset(df)
    assert col_meta["age"]["data_type"] == "numerical"
    assert col_meta["segment"]["data_type"] == "categorical"
    assert col_meta["signup_date"]["data_type"] == "datetime"
    assert col_meta["churned"]["data_type"] == "boolean"
    assert data_quality["duplicate_rows"] == 0

def test_generate_derived_features():
    df = pd.DataFrame({
        "order_date": pd.date_range("2023-01-01", periods=30, freq="D"),
        "revenue": [100 + i * 25 for i in range(30)]
    })
    col_meta, _ = dataset_service.profile_dataset(df)
    df_derived, derived_list = dataset_service.generate_derived_features(df, col_meta)
    
    assert "order_date_year" in df_derived.columns
    assert "order_date_month" in df_derived.columns
    assert len(derived_list) >= 2

def test_mixed_number_and_text_detection_and_conversion():
    # 1. Row-level mixed: some rows numbers, some rows text strings
    mixed_s1 = pd.Series([100, "Pending", 250, "N/A", 300])
    assert dataset_service.is_mixed_number_and_text(mixed_s1) is True

    # 2. Cell-level mixed: alphanumeric codes like "A102", "INV-99"
    mixed_s2 = pd.Series(["A102", "B204", "C305", "D406"])
    assert dataset_service.is_mixed_number_and_text(mixed_s2) is True

    # 3. Pure numbers should NOT be detected as mixed
    pure_num = pd.Series([10, 20, 30.5, None, 40])
    assert dataset_service.is_mixed_number_and_text(pure_num) is False

    # 4. Pure text words should NOT be detected as mixed
    pure_text = pd.Series(["apple", "banana", "cherry", None])
    assert dataset_service.is_mixed_number_and_text(pure_text) is False

    # 5. Pure dates should NOT be detected as mixed
    pure_dates = pd.Series(["2024-01-01", "2024-01-02", "2024-01-03"])
    assert dataset_service.is_mixed_number_and_text(pure_dates) is False

    # Test conversion to clean text
    converted_s1 = dataset_service.convert_column_to_text(mixed_s1)
    assert converted_s1.dtype == object
    assert converted_s1.tolist() == ["100", "Pending", "250", "N/A", "300"]

def test_spaces_preserved_without_formatting_on_conversion():
    # String values with leading/trailing spaces and internal spacing
    spaced_series = pd.Series(["  Alice  ", "   100   ", "  ORD 99  ", "Bob  Marley"])
    converted = dataset_service.convert_column_to_text(spaced_series)
    assert converted.tolist() == ["  Alice  ", "   100   ", "  ORD 99  ", "Bob  Marley"]

    # In DataFrame preprocessing
    df = pd.DataFrame({
        "name": ["  Alice  ", "  Bob  "],
        "mixed_code": ["  A1  ", 2]
    })
    preprocessed = dataset_service.preprocess_dataset(df)
    assert preprocessed["name"].tolist() == ["  Alice  ", "  Bob  "]
    assert preprocessed["mixed_code"].tolist() == ["  A1  ", "2"]

def test_identify_and_convert_mixed_columns_dataframe():
    df = pd.DataFrame({
        "order_code": ["ORD-101", "ORD-102", "ORD-103", "ORD-104"], # mixed (alpha + numeric)
        "mixed_status": [1, "Completed", 2, "Failed"],                # mixed (row-level number + text)
        "pure_numeric": [10, 20, 30, 40],                             # pure numbers
        "category": ["A", "B", "A", "B"]                              # pure categorical
    })

    cleaned_df, mixed_cols = dataset_service.identify_and_convert_mixed_columns(df)
    assert "order_code" in mixed_cols
    assert "mixed_status" in mixed_cols
    assert "pure_numeric" not in mixed_cols
    assert "category" not in mixed_cols

    # Ensure types are object/str and numbers are cleanly preserved
    assert cleaned_df["mixed_status"].tolist() == ["1", "Completed", "2", "Failed"]

def test_profile_dataset_mixed_columns():
    df = pd.DataFrame({
        "invoice_id": [101, "INV-102", 103, "INV-104", 105],
        "amount": [1500.5, 2500.0, 3000.75, 1200.0, 4500.2],
        "customer": ["Acme Corp", "Beta LLC", "Gamma Inc", "Delta Co", "Echo Ltd"]
    })

    col_meta, data_quality = dataset_service.profile_dataset(df)

    # invoice_id should be identified as mixed, converted to text, with TEXT sql_type
    assert col_meta["invoice_id"]["data_type"] == "text"
    assert col_meta["invoice_id"]["sql_type"] == "TEXT"
    assert col_meta["invoice_id"]["has_mixed_types"] is True
    assert col_meta["invoice_id"]["converted_to_text"] is True

    # Amount should be numerical / REAL
    assert col_meta["amount"]["data_type"] == "numerical"
    assert col_meta["amount"]["sql_type"] in ["REAL", "NUMERIC", "INTEGER"]

    # Customer should be categorical / TEXT
    assert col_meta["customer"]["data_type"] == "categorical"
    assert col_meta["customer"]["sql_type"] == "TEXT"

    # Data quality should register converted mixed columns
    assert "invoice_id" in data_quality.get("converted_mixed_columns", [])

