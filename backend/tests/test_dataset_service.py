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
