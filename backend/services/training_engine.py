import os
import time
import json
import joblib
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

# Scikit-Learn Imports
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler, OneHotEncoder, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    classification_report, roc_auc_score, mean_absolute_error, mean_squared_error,
    r2_score, silhouette_score
)

# Classifiers
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.neural_network import MLPClassifier

# Regressors
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor

# Clustering
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, bool):
        return obj
    elif isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (int, np.integer)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    elif isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(v) for v in obj]
    return obj

class TrainingEngine:
    def get_estimator_instance(self, algorithm: str, problem_type: str, hyperparameters: Dict[str, Any]):
        """
        Instantiates appropriate scikit-learn model with sanitized hyperparameters.
        """
        norm_algo = algorithm.lower().replace("-", "_").replace(" ", "_")
        params = {k: v for k, v in hyperparameters.items() if v is not None}

        if problem_type == "classification":
            if "random_forest" in norm_algo:
                n_est = int(params.get("n_estimators", 100))
                max_d = int(params["max_depth"]) if params.get("max_depth") else None
                return RandomForestClassifier(n_estimators=n_est, max_depth=max_d, random_state=42)
            elif "gradient_boosting" in norm_algo:
                n_est = int(params.get("n_estimators", 100))
                lr = float(params.get("learning_rate", 0.1))
                return GradientBoostingClassifier(n_estimators=n_est, learning_rate=lr, random_state=42)
            elif "logistic" in norm_algo:
                c_val = float(params.get("C", 1.0))
                return LogisticRegression(C=c_val, max_iter=1000, random_state=42)
            elif "decision_tree" in norm_algo:
                max_d = int(params["max_depth"]) if params.get("max_depth") else None
                return DecisionTreeClassifier(max_depth=max_d, random_state=42)
            elif "svm" in norm_algo or "svc" in norm_algo:
                return SVC(probability=True, random_state=42)
            elif "knn" in norm_algo or "k_nearest" in norm_algo:
                n_neighbors = int(params.get("n_neighbors", 5))
                return KNeighborsClassifier(n_neighbors=n_neighbors)
            elif "naive_bayes" in norm_algo:
                return GaussianNB()
            elif "mlp" in norm_algo or "neural" in norm_algo:
                return MLPClassifier(max_iter=500, random_state=42)
            else:
                return RandomForestClassifier(n_estimators=100, random_state=42)

        elif problem_type == "regression":
            if "random_forest" in norm_algo:
                n_est = int(params.get("n_estimators", 100))
                max_d = int(params["max_depth"]) if params.get("max_depth") else None
                return RandomForestRegressor(n_estimators=n_est, max_depth=max_d, random_state=42)
            elif "gradient_boosting" in norm_algo:
                n_est = int(params.get("n_estimators", 100))
                lr = float(params.get("learning_rate", 0.1))
                return GradientBoostingRegressor(n_estimators=n_est, learning_rate=lr, random_state=42)
            elif "ridge" in norm_algo:
                alpha = float(params.get("alpha", 1.0))
                return Ridge(alpha=alpha, random_state=42)
            elif "lasso" in norm_algo:
                alpha = float(params.get("alpha", 0.1))
                return Lasso(alpha=alpha, random_state=42)
            elif "linear" in norm_algo:
                return LinearRegression()
            elif "decision_tree" in norm_algo:
                max_d = int(params["max_depth"]) if params.get("max_depth") else None
                return DecisionTreeRegressor(max_depth=max_d, random_state=42)
            elif "svr" in norm_algo:
                return SVR()
            elif "knn" in norm_algo:
                n_neighbors = int(params.get("n_neighbors", 5))
                return KNeighborsRegressor(n_neighbors=n_neighbors)
            elif "mlp" in norm_algo:
                return MLPRegressor(max_iter=500, random_state=42)
            else:
                return RandomForestRegressor(n_estimators=100, random_state=42)

        elif problem_type == "clustering":
            n_clusters = int(params.get("n_clusters", 3))
            if "kmeans" in norm_algo or "k_means" in norm_algo:
                return KMeans(n_clusters=n_clusters, random_state=42)
            elif "dbscan" in norm_algo:
                eps = float(params.get("eps", 0.5))
                return DBSCAN(eps=eps)
            elif "agglomerative" in norm_algo:
                return AgglomerativeClustering(n_clusters=n_clusters)
            elif "gaussian" in norm_algo or "gmm" in norm_algo:
                return GaussianMixture(n_components=n_clusters, random_state=42)
            else:
                return KMeans(n_clusters=n_clusters, random_state=42)

        raise ValueError(f"Unsupported algorithm '{algorithm}' for problem type '{problem_type}'")

    def build_preprocessing_pipeline(
        self,
        df: pd.DataFrame,
        feature_columns: List[str],
        scaling: str = "standard"
    ) -> Tuple[ColumnTransformer, List[str], List[str]]:
        """
        Constructs a Scikit-Learn ColumnTransformer handling numerical & categorical features.
        """
        num_features = []
        cat_features = []

        for f in feature_columns:
            if f not in df.columns:
                continue
            if pd.api.types.is_numeric_dtype(df[f]):
                num_features.append(f)
            else:
                cat_features.append(f)

        transformers = []

        # Numerical pipeline
        if num_features:
            scaler = StandardScaler() if scaling == "standard" else (RobustScaler() if scaling == "robust" else MinMaxScaler())
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", scaler)
            ])
            transformers.append(("num", num_pipe, num_features))

        # Categorical pipeline
        if cat_features:
            cat_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
            ])
            transformers.append(("cat", cat_pipe, cat_features))

        preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
        return preprocessor, num_features, cat_features

    def train_model(
        self,
        experiment_id: str,
        file_path: str,
        model_name: str,
        problem_type: str,
        target_column: Optional[str],
        feature_columns: List[str],
        algorithm: str,
        hyperparameters: Dict[str, Any],
        train_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Executes end-to-end reproducible training, validation, and evaluation pipeline.
        """
        start_time = time.perf_counter()
        logger.info(f"Starting ML training for experiment '{model_name}' ({algorithm} - {problem_type})")

        try:
            df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='latin-1', on_bad_lines='skip')
        if len(df) < 5:
            raise ValueError("Dataset has too few rows for ML training (minimum 5 required).")

        # 2. Filter feature columns
        valid_features = [f for f in feature_columns if f in df.columns]
        if not valid_features:
            raise ValueError("None of the selected feature columns exist in the dataset.")

        scaling_type = train_config.get("scaling", "standard")
        test_size = float(train_config.get("test_size", 0.2))
        random_state = int(train_config.get("random_state", 42))

        # 3. Setup Preprocessing Pipeline
        preprocessor, num_cols, cat_cols = self.build_preprocessing_pipeline(df, valid_features, scaling=scaling_type)

        X = df[valid_features]
        estimator = self.get_estimator_instance(algorithm, problem_type, hyperparameters)

        model_artifact_filename = f"{experiment_id}_{algorithm.lower().replace(' ', '_')}.joblib"
        model_artifact_path = os.path.join(MODELS_DIR, model_artifact_filename)

        metrics = {}
        feature_importances = []

        # ----------------------------------------------------
        # CLASSIFICATION PIPELINE
        # ----------------------------------------------------
        if problem_type == "classification":
            if not target_column or target_column not in df.columns:
                raise ValueError(f"Target column '{target_column}' is required for classification.")

            # Filter valid target rows
            valid_mask = df[target_column].notna()
            X_clean = X[valid_mask]
            y_raw = df.loc[valid_mask, target_column]

            # Label Encode Target
            target_encoder = LabelEncoder()
            y = target_encoder.fit_transform(y_raw.astype(str))
            classes = [str(c) for c in target_encoder.classes_]

            if len(classes) < 2:
                raise ValueError("Target column must contain at least 2 distinct classes.")

            # Stratified split if possible
            stratify = y if min(np.bincount(y)) >= 2 else None
            X_train, X_test, y_train, y_test = train_test_split(
                X_clean, y, test_size=test_size, random_state=random_state, stratify=stratify
            )

            # Full reproducible pipeline
            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("classifier", estimator)
            ])

            full_pipeline.fit(X_train, y_train)

            # Evaluate
            y_pred = full_pipeline.predict(X_test)
            acc = float(accuracy_score(y_test, y_pred))
            prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
            rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
            f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
            cm = confusion_matrix(y_test, y_pred).tolist()
            cls_report = classification_report(y_test, y_pred, target_names=classes, output_dict=True, zero_division=0)

            roc_auc = None
            if hasattr(full_pipeline, "predict_proba") and len(classes) == 2:
                try:
                    y_prob = full_pipeline.predict_proba(X_test)[:, 1]
                    roc_auc = float(roc_auc_score(y_test, y_prob))
                except Exception:
                    pass

            metrics = {
                "accuracy": round(acc, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
                "confusion_matrix": cm,
                "classes": classes,
                "classification_report": cls_report,
                "train_samples": len(X_train),
                "test_samples": len(X_test)
            }

            # Save bundle (pipeline + target_encoder + metadata)
            bundle = {
                "pipeline": full_pipeline,
                "target_encoder": target_encoder,
                "problem_type": "classification",
                "target_column": target_column,
                "feature_columns": valid_features,
                "classes": classes,
                "algorithm": algorithm,
                "hyperparameters": hyperparameters,
                "train_config": train_config,
                "metrics": metrics,
                "trained_at": datetime.utcnow().isoformat()
            }
            joblib.dump(bundle, model_artifact_path)

            # Extract feature importances if available
            feature_importances = self._extract_feature_importances(full_pipeline, valid_features, num_cols, cat_cols, df)

        # ----------------------------------------------------
        # REGRESSION PIPELINE
        # ----------------------------------------------------
        elif problem_type == "regression":
            if not target_column or target_column not in df.columns:
                raise ValueError(f"Target column '{target_column}' is required for regression.")

            # Drop missing targets and cast to numeric
            valid_mask = pd.to_numeric(df[target_column], errors='coerce').notna()
            X_clean = X[valid_mask]
            y = pd.to_numeric(df.loc[valid_mask, target_column], errors='coerce').values

            X_train, X_test, y_train, y_test = train_test_split(
                X_clean, y, test_size=test_size, random_state=random_state
            )

            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("regressor", estimator)
            ])

            full_pipeline.fit(X_train, y_train)

            y_pred = full_pipeline.predict(X_test)
            mae = float(mean_absolute_error(y_test, y_pred))
            mse = float(mean_squared_error(y_test, y_pred))
            rmse = float(np.sqrt(mse))
            r2 = float(r2_score(y_test, y_pred))

            # Residual sample for visualization
            residuals = (y_test - y_pred).tolist()[:50]
            pred_vs_actual = [{"actual": float(a), "predicted": float(p)} for a, p in zip(y_test[:40], y_pred[:40])]

            metrics = {
                "mae": round(mae, 4),
                "mse": round(mse, 4),
                "rmse": round(rmse, 4),
                "r2_score": round(r2, 4),
                "train_samples": len(X_train),
                "test_samples": len(X_test),
                "pred_vs_actual_sample": pred_vs_actual,
                "residuals_sample": residuals
            }

            bundle = {
                "pipeline": full_pipeline,
                "problem_type": "regression",
                "target_column": target_column,
                "feature_columns": valid_features,
                "algorithm": algorithm,
                "hyperparameters": hyperparameters,
                "train_config": train_config,
                "metrics": metrics,
                "trained_at": datetime.utcnow().isoformat()
            }
            joblib.dump(bundle, model_artifact_path)
            feature_importances = self._extract_feature_importances(full_pipeline, valid_features, num_cols, cat_cols, df)

        # ----------------------------------------------------
        # CLUSTERING PIPELINE
        # ----------------------------------------------------
        elif problem_type == "clustering":
            full_pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("clusterer", estimator)
            ])

            X_transformed = full_pipeline.named_steps["preprocessor"].fit_transform(X)
            cluster_labels = estimator.fit_predict(X_transformed)

            unique_clusters = np.unique(cluster_labels)
            sil_score = None
            if len(unique_clusters) > 1 and len(X) >= 5:
                try:
                    sil_score = float(silhouette_score(X_transformed, cluster_labels))
                except Exception:
                    pass

            cluster_counts = {f"Cluster {c}": int((cluster_labels == c).sum()) for c in unique_clusters}

            metrics = {
                "silhouette_score": round(sil_score, 4) if sil_score is not None else None,
                "num_clusters": len(unique_clusters),
                "cluster_distribution": cluster_counts,
                "total_samples": len(X)
            }

            bundle = {
                "pipeline": full_pipeline,
                "problem_type": "clustering",
                "target_column": None,
                "feature_columns": valid_features,
                "algorithm": algorithm,
                "hyperparameters": hyperparameters,
                "train_config": train_config,
                "metrics": metrics,
                "trained_at": datetime.utcnow().isoformat()
            }
            joblib.dump(bundle, model_artifact_path)

        duration = round(time.perf_counter() - start_time, 2)

        return {
            "status": "completed",
            "model_name": model_name,
            "problem_type": problem_type,
            "target_column": target_column,
            "feature_columns": valid_features,
            "algorithm": algorithm,
            "hyperparameters": hyperparameters,
            "train_config": train_config,
            "metrics": sanitize_for_json(metrics),
            "feature_importances": sanitize_for_json(feature_importances),
            "model_artifact_path": model_artifact_path,
            "training_time_seconds": duration
        }

    def _extract_feature_importances(self, pipeline: Pipeline, features: List[str], num_cols: List[str], cat_cols: List[str], df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Extracts and maps feature importance scores or linear coefficients.
        """
        try:
            model = pipeline.steps[-1][1]
            raw_importances = None

            if hasattr(model, "feature_importances_"):
                raw_importances = model.feature_importances_
            elif hasattr(model, "coef_"):
                coef = model.coef_
                raw_importances = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)

            if raw_importances is None:
                return []

            # Match with transformed column names
            preprocessor = pipeline.named_steps.get("preprocessor")
            all_feature_names = []
            if preprocessor and hasattr(preprocessor, "get_feature_names_out"):
                try:
                    all_feature_names = list(preprocessor.get_feature_names_out())
                except Exception:
                    pass

            if not all_feature_names or len(all_feature_names) != len(raw_importances):
                all_feature_names = [f"Feature {i+1}" for i in range(len(raw_importances))]

            # Clean prefixes (e.g. num__ or cat__)
            clean_names = [n.replace("num__", "").replace("cat__", "") for n in all_feature_names]

            results = []
            for name, imp in zip(clean_names, raw_importances):
                results.append({
                    "feature": name,
                    "importance": round(float(imp), 4)
                })

            results.sort(key=lambda x: x["importance"], reverse=True)
            return results[:20]
        except Exception as e:
            logger.debug(f"Could not extract feature importances: {e}")
            return []

training_engine = TrainingEngine()
