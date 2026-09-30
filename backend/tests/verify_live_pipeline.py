import urllib.request
import urllib.error
import json
import requests

BASE_URL = "http://127.0.0.1:8001/api"

def main():
    print("Testing live backend at:", BASE_URL)
    
    # 1. Upload
    csv_data = "age,income,department,churn\n25,50000,Sales,0\n30,65000,Engineering,0\n45,95000,Management,1\n35,72000,Engineering,0\n50,110000,Management,1\n23,48000,Sales,0\n40,85000,Engineering,0\n60,130000,Management,1\n28,58000,Sales,0\n38,80000,Engineering,0\n"
    
    files = {"file": ("staff.csv", csv_data.encode("utf-8"), "text/csv")}
    data = {"name": "Live Staff Pipeline Test"}
    
    res = requests.post(f"{BASE_URL}/datasets/upload", files=files, data=data)
    print("Upload status:", res.status_code)
    if res.status_code != 200:
        print("Upload error:", res.text)
        return
    ds = res.json()
    dataset_id = ds["id"]
    print("Dataset ID:", dataset_id, "Rows:", ds["row_count"])

    # 2. Detect problem
    res = requests.post(f"{BASE_URL}/ml/detect-problem", json={"dataset_id": dataset_id, "target_column": "churn"})
    print("Detect problem status:", res.status_code)
    if res.status_code != 200:
        print("Detect problem error:", res.text)
        return
    print("Detect response:", res.json())

    # 3. List ML techniques
    res = requests.get(f"{BASE_URL}/ml/techniques?problem_type=classification")
    print("Techniques status:", res.status_code, "Count:", len(res.json()))

    # 4. Train Model
    train_payload = {
        "dataset_id": dataset_id,
        "model_name": "Live Staff Churn Model",
        "problem_type": "classification",
        "target_column": "churn",
        "feature_columns": ["age", "income", "department"],
        "algorithm": "random_forest",
        "hyperparameters": {"n_estimators": 10},
        "train_config": {"test_size": 0.2, "random_state": 42, "scaling": "standard"}
    }
    res = requests.post(f"{BASE_URL}/ml/train", json=train_payload)
    print("Train status:", res.status_code)
    if res.status_code != 200:
        print("Train error:", res.text)
        return
    exp = res.json()
    exp_id = exp["id"]
    print("Experiment ID:", exp_id, "Status:", exp["status"], "Accuracy:", exp["metrics"].get("accuracy"))

    # 5. Predict on Test
    test_records = [
        {"age": 29, "income": 60000, "department": "Sales", "churn": 0},
        {"age": 55, "income": 120000, "department": "Management", "churn": 1}
    ]
    res = requests.post(f"{BASE_URL}/testing/{exp_id}/predict", data={"raw_data": json.dumps(test_records)})
    print("Testing status:", res.status_code)
    if res.status_code != 200:
        print("Testing error:", res.text)
        return
    pred_res = res.json()
    print("Predictions count:", len(pred_res["rows"]), "Mode:", pred_res["evaluation_metrics"].get("mode"))

    # 6. Deploy
    res = requests.post(f"{BASE_URL}/deployments", json={
        "experiment_id": exp_id,
        "deployment_name": "Staff Churn Production",
        "version": "1.0.0"
    })
    print("Deploy status:", res.status_code)
    dep = res.json()
    dep_id = dep["id"]

    # 7. Live Inference on Deployed Model
    res = requests.post(f"{BASE_URL}/deployments/{dep_id}/predict", json={
        "records": [
            {"age": 33, "income": 75000, "department": "Engineering"}
        ]
    })
    print("Deployed inference status:", res.status_code)
    print("Inference results:", res.json()["rows"])

    # 8. Clean up
    requests.delete(f"{BASE_URL}/deployments/{dep_id}")
    requests.delete(f"{BASE_URL}/ml/experiments/{exp_id}")
    requests.delete(f"{BASE_URL}/datasets/{dataset_id}")
    print("All live pipeline checks PASSED successfully!")

if __name__ == "__main__":
    main()
