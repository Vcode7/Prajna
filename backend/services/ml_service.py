import json
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

TECHNIQUE_REGISTRY = {
    "classification": [
        {
            "id": "random_forest",
            "name": "Random Forest",
            "category": "Ensemble",
            "description": "High accuracy bagging ensemble of decision trees. Resilient to overfitting and handles non-linear interactions.",
            "default_hyperparameters": {"n_estimators": 100, "max_depth": 10, "min_samples_split": 2},
            "pros": ["High accuracy", "Feature importance built-in", "Handles outliers well"],
            "cons": ["Slower on massive datasets", "Less interpretable than single tree"]
        },
        {
            "id": "gradient_boosting",
            "name": "Gradient Boosting",
            "category": "Boosting",
            "description": "Sequential boosting model that minimizes residual error. Often achieves state-of-the-art predictive performance.",
            "default_hyperparameters": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3},
            "pros": ["Top-tier accuracy", "Handles mixed feature types"],
            "cons": ["Sensitive to noisy data / learning rate tuning"]
        },
        {
            "id": "logistic_regression",
            "name": "Logistic Regression",
            "category": "Linear Model",
            "description": "Probabilistic linear classifier. Fast, highly interpretable, and effective for linearly separable decision boundaries.",
            "default_hyperparameters": {"C": 1.0, "max_iter": 500, "solver": "lbfgs"},
            "pros": ["Very fast training", "Probability outputs", "High interpretability"],
            "cons": ["Assumes linear relationship"]
        },
        {
            "id": "decision_tree",
            "name": "Decision Tree",
            "category": "Tree",
            "description": "Intuitive rule-based decision tree with visual tree splits and high interpretability.",
            "default_hyperparameters": {"max_depth": 5, "min_samples_split": 5},
            "pros": ["Simple to understand", "No feature scaling required"],
            "cons": ["Prone to overfitting without depth limits"]
        },
        {
            "id": "svm",
            "name": "Support Vector Machine (SVM)",
            "category": "Kernel Method",
            "description": "Maximum-margin hyperplane classifier with RBF kernel for complex multidimensional boundaries.",
            "default_hyperparameters": {"C": 1.0, "kernel": "rbf"},
            "pros": ["Effective in high-dimensional spaces", "Robust to outliers"],
            "cons": ["Requires feature scaling", "Slower on large sample sizes"]
        },
        {
            "id": "knn",
            "name": "K-Nearest Neighbors (KNN)",
            "category": "Instance-Based",
            "description": "Classifies observations based on the majority class of closest spatial neighbors.",
            "default_hyperparameters": {"n_neighbors": 5, "weights": "uniform"},
            "pros": ["Non-parametric", "Simple and intuitive"],
            "cons": ["Sensitive to feature scale and irrelevant features"]
        },
        {
            "id": "naive_bayes",
            "name": "Gaussian Naive Bayes",
            "category": "Probabilistic",
            "description": "Fast probabilistic classifier based on Bayes theorem with conditional independence assumptions.",
            "default_hyperparameters": {},
            "pros": ["Extremely fast", "Works well with small data"],
            "cons": ["Assumes feature independence"]
        },
        {
            "id": "mlp",
            "name": "Neural Network (MLP Classifier)",
            "category": "Deep Learning",
            "description": "Multi-layer perceptron neural network capable of learning non-linear feature representations.",
            "default_hyperparameters": {"hidden_layer_sizes": [64, 32], "max_iter": 300, "alpha": 0.0001},
            "pros": ["High expressive capacity", "Learns non-linear representations"],
            "cons": ["Requires scaled features", "Longer training time"]
        }
    ],
    "regression": [
        {
            "id": "random_forest_regressor",
            "name": "Random Forest Regressor",
            "category": "Ensemble",
            "description": "Ensemble of regression trees that averages predictions to minimize variance and avoid overfitting.",
            "default_hyperparameters": {"n_estimators": 100, "max_depth": 10, "min_samples_split": 2},
            "pros": ["High predictive power", "Handles non-linear numeric trends"],
            "cons": ["Cannot extrapolate beyond training target range"]
        },
        {
            "id": "gradient_boosting_regressor",
            "name": "Gradient Boosting Regressor",
            "category": "Boosting",
            "description": "Additive boosting regression that iteratively fits trees to residual errors.",
            "default_hyperparameters": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3},
            "pros": ["Excellent precision and low error", "Strong on complex tabular data"],
            "cons": ["Hyperparameter sensitive"]
        },
        {
            "id": "linear_regression",
            "name": "Linear Regression (OLS)",
            "category": "Linear Model",
            "description": "Classic ordinary least squares regression. High interpretability and coefficient analysis.",
            "default_hyperparameters": {"fit_intercept": True},
            "pros": ["Fastest training", "Coefficients directly measure feature impact"],
            "cons": ["Vulnerable to multicollinearity and non-linear patterns"]
        },
        {
            "id": "ridge",
            "name": "Ridge Regression (L2 Regularization)",
            "category": "Regularized Linear",
            "description": "Linear regression with L2 penalty to shrink coefficients and prevent overfitting.",
            "default_hyperparameters": {"alpha": 1.0},
            "pros": ["Stabilizes regression under multicollinearity"],
            "cons": ["Retains all features"]
        },
        {
            "id": "lasso",
            "name": "Lasso Regression (L1 Regularization)",
            "category": "Regularized Linear",
            "description": "Linear regression with L1 penalty that forces coefficients of irrelevant features to zero.",
            "default_hyperparameters": {"alpha": 0.1},
            "pros": ["Automatic feature selection", "Sparse models"],
            "cons": ["Can arbitrarily pick one of correlated features"]
        },
        {
            "id": "decision_tree_regressor",
            "name": "Decision Tree Regressor",
            "category": "Tree",
            "description": "Piecewise constant regression tree split by variance reduction.",
            "default_hyperparameters": {"max_depth": 5, "min_samples_split": 5},
            "pros": ["Clear visual decision logic", "Handles non-linear patterns"],
            "cons": ["High variance"]
        },
        {
            "id": "svr",
            "name": "Support Vector Regressor (SVR)",
            "category": "Kernel Method",
            "description": "Epsilon-insensitive loss support vector regressor robust against outliers.",
            "default_hyperparameters": {"C": 1.0, "epsilon": 0.1, "kernel": "rbf"},
            "pros": ["Robust against measurement noise"],
            "cons": ["Requires feature normalization"]
        },
        {
            "id": "knn_regressor",
            "name": "K-Nearest Neighbors Regressor",
            "category": "Instance-Based",
            "description": "Predicts continuous target by averaging the target values of the K nearest observations.",
            "default_hyperparameters": {"n_neighbors": 5},
            "pros": ["Local non-parametric fitting"],
            "cons": ["Slow on large datasets"]
        },
        {
            "id": "mlp_regressor",
            "name": "Neural Network (MLP Regressor)",
            "category": "Deep Learning",
            "description": "Multi-layer perceptron neural network for continuous function approximation.",
            "default_hyperparameters": {"hidden_layer_sizes": [64, 32], "max_iter": 300},
            "pros": ["Captures complex non-linear curves"],
            "cons": ["Requires scaled features"]
        }
    ],
    "segmentation": [
        {
            "id": "kmeans",
            "name": "K-Means Clustering",
            "category": "Centroid-Based",
            "description": "Partitions data into K distinct clusters minimizing within-cluster variance.",
            "default_hyperparameters": {"n_clusters": 3, "random_state": 42},
            "pros": ["Fast and scalable", "Well-defined cluster centers"],
            "cons": ["Requires specifying K in advance", "Assumes spherical clusters"]
        },
        {
            "id": "dbscan",
            "name": "DBSCAN",
            "category": "Density-Based",
            "description": "Finds core samples of high density and expands clusters, automatically flagging outliers as noise.",
            "default_hyperparameters": {"eps": 0.5, "min_samples": 5},
            "pros": ["Finds arbitrary shaped clusters", "No need to specify K", "Identifies outliers"],
            "cons": ["Sensitive to distance metric and scale"]
        },
        {
            "id": "agglomerative",
            "name": "Hierarchical Agglomerative",
            "category": "Hierarchical",
            "description": "Bottom-up hierarchical clustering that merges closest clusters iteratively.",
            "default_hyperparameters": {"n_clusters": 3, "linkage": "ward"},
            "pros": ["Produces hierarchy", "No random initialization"],
            "cons": ["Computationally intensive for large datasets"]
        },
        {
            "id": "gaussian_mixture",
            "name": "Gaussian Mixture Model (GMM)",
            "category": "Probabilistic",
            "description": "Soft probabilistic clustering modeling clusters as mixtures of Gaussian distributions.",
            "default_hyperparameters": {"n_components": 3, "random_state": 42},
            "pros": ["Soft cluster probabilities", "Flexible elliptical cluster shapes"],
            "cons": ["Sensitive to initialization"]
        }
    ],
    "anomaly_detection": [
        {
            "id": "isolation_forest",
            "name": "Isolation Forest",
            "category": "Tree Ensemble",
            "description": "Isolates anomalies by randomly partitioning features. Outliers require fewer recursive splits to isolate.",
            "default_hyperparameters": {"n_estimators": 100, "contamination": 0.05},
            "pros": ["Top benchmark outlier detection", "Scales linearly with data", "Handles high dimensions"],
            "cons": ["Assumes anomalies are rare and distinct"]
        },
        {
            "id": "one_class_svm",
            "name": "One-Class SVM",
            "category": "Kernel Boundary",
            "description": "Learns a tight non-linear decision boundary around normal data points using an RBF kernel.",
            "default_hyperparameters": {"nu": 0.05, "kernel": "rbf"},
            "pros": ["Effective on complex non-linear normal distributions"],
            "cons": ["Requires feature scaling", "Sensitive to hyperparameter nu"]
        },
        {
            "id": "local_outlier_factor",
            "name": "Local Outlier Factor (LOF)",
            "category": "Density-Based",
            "description": "Measures local density deviation of an observation with respect to its nearest neighbors.",
            "default_hyperparameters": {"n_neighbors": 20, "contamination": 0.05},
            "pros": ["Detects local anomalies within variable density regions"],
            "cons": ["Computationally intensive for large datasets"]
        },
        {
            "id": "elliptic_envelope",
            "name": "Elliptic Envelope",
            "category": "Robust Covariance",
            "description": "Fits a robust Gaussian covariance ellipse to clean data, flagging points outside the confidence ellipse.",
            "default_hyperparameters": {"contamination": 0.05},
            "pros": ["Fast and accurate for normally distributed features"],
            "cons": ["Assumes elliptical/Gaussian distributed features"]
        }
    ],
    "forecasting": [
        {
            "id": "random_forest_forecast",
            "name": "Random Forest Forecaster",
            "category": "Ensemble",
            "description": "Tree ensemble with sliding-window lag features for robust multi-step time series prediction.",
            "default_hyperparameters": {"n_estimators": 100, "max_depth": 10},
            "pros": ["Handles non-linear trends & seasonality", "No strict stationarity requirement"],
            "cons": ["Cannot extrapolate beyond historical value ranges"]
        },
        {
            "id": "gradient_boosting_forecast",
            "name": "Gradient Boosting Forecaster",
            "category": "Boosting",
            "description": "Sequential boosting model that iteratively fits trees to residual time-series errors.",
            "default_hyperparameters": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3},
            "pros": ["Top-tier precision on complex sequential series"],
            "cons": ["Sensitive to tuning learning rate"]
        },
        {
            "id": "linear_trend",
            "name": "Linear Trend Forecaster",
            "category": "Linear Model",
            "description": "Ordinary least squares trend model on chronological time index with calendar features.",
            "default_hyperparameters": {"fit_intercept": True},
            "pros": ["Extremely fast", "Ideal for steady growth/decline trends"],
            "cons": ["Cannot model non-linear seasonal cycles"]
        },
        {
            "id": "ridge_trend",
            "name": "Ridge Regression (Lag Features)",
            "category": "Regularized Linear",
            "description": "L2-regularized linear model on autoregressive lags to stabilize multi-collinear time dependencies.",
            "default_hyperparameters": {"alpha": 1.0},
            "pros": ["Stable against collinear lag predictors"],
            "cons": ["Assumes linear relationships"]
        },
        {
            "id": "knn_forecast",
            "name": "K-Nearest Neighbors Forecaster",
            "category": "Instance-Based",
            "description": "Forecasts values based on historical periods with the most similar temporal patterns.",
            "default_hyperparameters": {"n_neighbors": 5},
            "pros": ["Captures recurring cyclical patterns"],
            "cons": ["Sensitive to feature scale"]
        },
        {
            "id": "mlp_forecast",
            "name": "Neural Network (MLP) Forecaster",
            "category": "Deep Learning",
            "description": "Multi-layer perceptron neural network capturing non-linear temporal dynamics.",
            "default_hyperparameters": {"hidden_layer_sizes": [64, 32], "max_iter": 300},
            "pros": ["Learns non-linear interactions"],
            "cons": ["Requires feature scaling"]
        },
        {
            "id": "lstm_forecast",
            "name": "Long Short-Term Memory (LSTM)",
            "category": "Recurrent Neural Network",
            "description": "Deep sequential memory cells designed for long-range temporal dependencies.",
            "default_hyperparameters": {"hidden_dim": 32, "num_layers": 1, "epochs": 50},
            "pros": ["Captures long-range temporal dependencies"],
            "cons": ["Requires larger sample size"]
        },
        {
            "id": "moving_average",
            "name": "Weighted Moving Average",
            "category": "Smoothing",
            "description": "Exponentially weighted moving average baseline for stable or noisy time series.",
            "default_hyperparameters": {},
            "pros": ["Simple and robust baseline"],
            "cons": ["Lags behind sudden shifts"]
        }
    ]
}

# Aliases for backward compatibility
TECHNIQUE_REGISTRY["clustering"] = TECHNIQUE_REGISTRY["segmentation"]
TECHNIQUE_REGISTRY["time_series"] = TECHNIQUE_REGISTRY["forecasting"]

class MLService:
    def detect_problem_type(self, df: pd.DataFrame, target_column: Optional[str], col_meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Auto-detects whether the problem is Classification, Regression, Clustering/Segmentation, or Time Series/Forecasting.
        """
        if not target_column or target_column not in df.columns:
            return {
                "problem_type": "clustering",
                "target_column": None,
                "reason": "No target column specified. Segmentation / Clustering will discover natural groupings in the data.",
                "classes": []
            }

        target_meta = col_meta.get(target_column, {})
        target_series = df[target_column].dropna()
        dtype = target_meta.get("data_type")
        if not dtype:
            if pd.api.types.is_numeric_dtype(target_series):
                dtype = "numerical"
            elif pd.api.types.is_datetime64_any_dtype(target_series):
                dtype = "datetime"
            elif pd.api.types.is_bool_dtype(target_series):
                dtype = "boolean"
            else:
                dtype = "categorical"
        unique_cnt = int(target_series.nunique())

        # Check datetime target
        if dtype == "datetime":
            return {
                "problem_type": "time_series",
                "target_column": target_column,
                "reason": f"Target column '{target_column}' is a datetime variable suitable for time-series forecasting.",
                "classes": []
            }

        # Check categorical / boolean / text
        if dtype in ("categorical", "boolean", "text"):
            classes = [str(c) for c in target_series.unique()[:20]]
            is_binary = unique_cnt == 2
            return {
                "problem_type": "classification",
                "sub_type": "binary" if is_binary else "multiclass",
                "target_column": target_column,
                "unique_classes_count": unique_cnt,
                "classes": classes,
                "reason": f"Target column '{target_column}' is categorical with {unique_cnt} classes ({'Binary' if is_binary else 'Multi-class'} Classification)."
            }

        # Check binary 0/1 integer
        if dtype == "numerical" and unique_cnt == 2 and set(target_series.unique()).issubset({0, 1, 0.0, 1.0}):
            return {
                "problem_type": "classification",
                "sub_type": "binary",
                "target_column": target_column,
                "unique_classes_count": 2,
                "classes": ["0", "1"],
                "reason": f"Target column '{target_column}' is a binary numeric flag (Binary Classification)."
            }

        # Continuous numeric target -> Regression
        return {
            "problem_type": "regression",
            "target_column": target_column,
            "min_val": float(target_series.min()) if not target_series.empty else 0.0,
            "max_val": float(target_series.max()) if not target_series.empty else 0.0,
            "unique_values_count": unique_cnt,
            "reason": f"Target column '{target_column}' is a continuous numerical variable (Regression)."
        }

    def get_techniques_for_problem(self, problem_type: str) -> List[Dict[str, Any]]:
        """Returns the algorithm library for the specified problem type (regression, classification, forecasting, segmentation, anomaly_detection)."""
        norm = (problem_type or "classification").lower().replace("-", "_").replace(" ", "_")
        if norm in ("clustering", "segmentation", "cohorts"):
            return TECHNIQUE_REGISTRY["segmentation"]
        elif norm in ("time_series", "forecasting", "forecast"):
            return TECHNIQUE_REGISTRY["forecasting"]
        elif norm in ("anomaly_detection", "anomaly", "outlier", "outliers"):
            return TECHNIQUE_REGISTRY["anomaly_detection"]
        elif norm in ("regression", "regressor"):
            return TECHNIQUE_REGISTRY["regression"]
        elif norm in ("classification", "classifier"):
            return TECHNIQUE_REGISTRY["classification"]
        return TECHNIQUE_REGISTRY.get(norm, TECHNIQUE_REGISTRY["classification"])

    async def recommend_best_training_method(
        self,
        dataset_name: str,
        row_count: int,
        col_count: int,
        problem_type: str,
        target_column: Optional[str],
        feature_columns: List[str],
        col_meta: Dict[str, Any],
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calls LLM to provide ranked recommendation, suitability %, and rationale for algorithm selection.
        """
        available_algos = [t["name"] for t in self.get_techniques_for_problem(problem_type)]
        
        feature_summaries = []
        for f in feature_columns[:15]:
            m = col_meta.get(f, {})
            feature_summaries.append(f"- {f}: type={m.get('data_type')}, unique={m.get('unique_count')}, null_pct={m.get('null_pct')}%")

        prompt = f"""You are a Principal Machine Learning Engineer. Analyze the following dataset characteristics and recommend the best training algorithm for this task.

DATASET METADATA:
- Dataset Name: {dataset_name}
- Total Rows: {row_count}
- Total Features Selected: {len(feature_columns)}
- Problem Type: {problem_type.upper()}
- Target Column: {target_column or 'None (Clustering)'}

FEATURE SAMPLE:
{chr(10).join(feature_summaries)}

AVAILABLE ALGORITHMS IN PLATFORM:
{', '.join(available_algos)}

INSTRUCTIONS:
1. Rank the top 3 most suitable algorithms from the available list with suitability percentage (e.g. 92%, 85%, 74%).
2. Clearly declare the #1 Recommended Algorithm.
3. Provide concise engineering reasoning explaining why this model fits the data size, feature composition, and target.
4. Mention any trade-offs or limitations.
5. Provide actionable preprocessing recommendations (e.g. scaling, encoding, class weighting).
6. Return JSON ONLY matching this structure:
{{
  "recommendation": "Name of Top Recommended Algorithm",
  "suitability_score": 92,
  "ranked_methods": [
    {{"algorithm": "Algorithm 1", "suitability": 92, "summary": "Key strength for this data"}},
    {{"algorithm": "Algorithm 2", "suitability": 86, "summary": "Key strength"}},
    {{"algorithm": "Algorithm 3", "suitability": 75, "summary": "Key strength"}}
  ],
  "reasoning": "Detailed explanation of why the top algorithm was chosen...",
  "limitations": "Possible limitations to keep in mind...",
  "recommended_preprocessing": ["Apply One-Hot Encoding on categorical features", "Scale continuous numeric features", "Check for class balance"]
}}
"""
        messages = [
            {"role": "system", "content": "You are a professional machine learning advisor. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        try:
            resp = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.2,
                max_tokens=settings.chat_max_tokens,
                json_mode=True,
                task_name="ML Recommendation"
            )
            return json.loads(resp)
        except Exception as e:
            logger.error(f"Failed to generate ML recommendation: {e}")
            top_algo = available_algos[0] if available_algos else "Random Forest"
            return {
                "recommendation": top_algo,
                "suitability_score": 90,
                "ranked_methods": [
                    {"algorithm": top_algo, "suitability": 90, "summary": "Standard robust baseline for tabular data"}
                ],
                "reasoning": f"{top_algo} provides strong baseline accuracy and handles tabular features effectively without severe overfitting.",
                "limitations": "May require hyperparameter tuning for optimal performance.",
                "recommended_preprocessing": ["Standardize numerical variables", "One-hot encode categorical features"]
            }

    def compute_correlation_matrix(
        self,
        df: pd.DataFrame,
        target_column: Optional[str] = None,
        col_meta: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Computes pairwise correlation matrix for all eligible fields, and target-to-field correlations
        sorted by absolute correlation strength (|r| descending).
        Eligible columns include numeric, boolean, and low-cardinality categorical fields.
        """
        if col_meta is None:
            col_meta = {}

        if df.empty or len(df.columns) < 2:
            return {
                "target_column": target_column,
                "target_type": None,
                "correlations": [],
                "pairwise_matrix": {"columns": [], "matrix": []},
                "eligible_columns": []
            }

        # Subsample if dataset is very large for computational efficiency
        sample_df = df.sample(n=min(5000, len(df)), random_state=42) if len(df) > 5000 else df

        # Determine eligible columns and encode them numerically
        eligible_cols = []
        encoded_data = {}

        for col in sample_df.columns:
            s = sample_df[col].dropna()
            if s.empty or s.nunique() <= 1:
                # Constant or all NaN -> ineligible
                continue

            meta = col_meta.get(col, {})
            dtype = meta.get("data_type")

            # Numeric columns
            if pd.api.types.is_numeric_dtype(sample_df[col]) or dtype == "numerical":
                numeric_s = pd.to_numeric(sample_df[col], errors='coerce')
                if numeric_s.nunique() > 1:
                    median_val = float(numeric_s.median()) if not numeric_s.dropna().empty else 0.0
                    encoded_data[col] = numeric_s.fillna(median_val)
                    eligible_cols.append(col)

            # Boolean columns
            elif pd.api.types.is_bool_dtype(sample_df[col]) or dtype == "boolean":
                encoded_data[col] = sample_df[col].astype(float).fillna(0.0)
                eligible_cols.append(col)

            # Categorical / Text columns with reasonable cardinality (<= 30 distinct values, not IDs)
            elif dtype in ("categorical", "text") or pd.api.types.is_object_dtype(sample_df[col]):
                nunique = s.nunique()
                # Exclude high-cardinality identifiers or text blobs
                if 1 < nunique <= 30 and nunique < len(sample_df) * 0.7:
                    codes, _ = pd.factorize(sample_df[col].astype(str))
                    encoded_data[col] = pd.Series(codes, index=sample_df.index, dtype=float)
                    eligible_cols.append(col)

        if not eligible_cols or len(eligible_cols) < 2:
            return {
                "target_column": target_column,
                "target_type": col_meta.get(target_column, {}).get("data_type") if target_column else None,
                "correlations": [],
                "pairwise_matrix": {"columns": eligible_cols, "matrix": []},
                "eligible_columns": eligible_cols
            }

        clean_df = pd.DataFrame(encoded_data, index=sample_df.index)

        # Ensure target_column is evaluated if it was somehow skipped but present in df
        target = target_column if (target_column and target_column in clean_df.columns) else None
        if target_column and target_column in sample_df.columns and target_column not in clean_df.columns:
            s_target = sample_df[target_column]
            if s_target.nunique() > 1:
                if pd.api.types.is_numeric_dtype(s_target):
                    clean_df[target_column] = pd.to_numeric(s_target, errors='coerce').fillna(0.0)
                else:
                    codes, _ = pd.factorize(s_target.astype(str))
                    clean_df[target_column] = pd.Series(codes, index=sample_df.index, dtype=float)
                if target_column not in eligible_cols:
                    eligible_cols.append(target_column)
                target = target_column

        # Pairwise Pearson correlation
        corr_matrix = clean_df.corr(method="pearson").fillna(0.0)
        corr_matrix = corr_matrix.clip(lower=-1.0, upper=1.0).round(4)
        cols_list = list(corr_matrix.columns)
        matrix_2d = corr_matrix.values.tolist()

        # Compute target correlations sorted by absolute strength
        correlations = []
        if target and target in corr_matrix.columns:
            for feat in cols_list:
                if feat == target:
                    continue
                r_val = float(corr_matrix.loc[feat, target])
                if np.isnan(r_val):
                    r_val = 0.0
                abs_r = round(abs(r_val), 4)
                r_val = round(r_val, 4)

                if abs_r >= 0.7:
                    strength = "Very Strong"
                elif abs_r >= 0.5:
                    strength = "Strong"
                elif abs_r >= 0.3:
                    strength = "Moderate"
                elif abs_r >= 0.1:
                    strength = "Weak"
                else:
                    strength = "Very Weak"

                direction = "positive" if r_val > 0 else ("negative" if r_val < 0 else "neutral")
                feat_meta = col_meta.get(feat, {})
                feat_type = feat_meta.get("data_type", "numerical")

                correlations.append({
                    "feature": feat,
                    "correlation": r_val,
                    "abs_correlation": abs_r,
                    "strength": strength,
                    "direction": direction,
                    "data_type": feat_type
                })

            # Sort descending by absolute correlation strength
            correlations.sort(key=lambda x: x["abs_correlation"], reverse=True)

        return {
            "target_column": target,
            "target_type": col_meta.get(target, {}).get("data_type") if target else None,
            "correlations": correlations,
            "pairwise_matrix": {
                "columns": cols_list,
                "matrix": matrix_2d
            },
            "eligible_columns": cols_list
        }

    def ai_decide_ml_build(
        self,
        df: pd.DataFrame,
        dataset_name: str,
        col_meta: Dict[str, Any],
        target_column: Optional[str] = None,
        target_mode: str = "ai",
        feature_mode: str = "ai",
        feature_columns: Optional[List[str]] = None,
        category_mode: str = "ai",
        ml_category: Optional[str] = None,
        algorithm_mode: str = "ai",
        algorithm: Optional[str] = None,
        user_instructions: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes the 'Build using AI' workflow:
        1. Selects the optimal target column (if in AI mode or not provided).
        2. Computes correlation matrix between target and eligible input fields.
        3. Automatically selects the most relevant input features based on correlation strength.
        4. Detects or respects the ML problem paradigm (regression, classification, forecasting, segmentation, anomaly_detection).
        5. Selects the best algorithm and hyperparameters.
        6. Formulates transparent engineering reasoning for all selections.
        """
        available_cols = list(df.columns)
        if not available_cols:
            raise ValueError("Dataset has no columns available.")

        # Determine problem type first if manually chosen
        req_category = (ml_category or "").lower().replace("-", "_").replace(" ", "_")
        is_unsupervised = req_category in ("segmentation", "clustering", "anomaly_detection")

        # 1. Target Column Selection
        target = target_column if (target_column and target_column in available_cols) else None
        target_reason = ""

        if is_unsupervised and not target_column:
            target = None
            target_reason = f"No target required for unsupervised {req_category.replace('_', ' ').title()}."
        elif not target or target_mode == "ai":
            # Search for high-probability target columns
            target_keywords = [
                'churn', 'target', 'label', 'class', 'status', 'fraud', 'default',
                'price', 'sales', 'revenue', 'salary', 'outcome', 'total', 'profit',
                'cost', 'rating', 'score', 'loss', 'converted', 'attrition', 'delay', 'is_'
            ]
            matched_col = None
            for kw in target_keywords:
                matched_col = next((c for c in available_cols if kw in c.lower()), None)
                if matched_col:
                    break

            if matched_col:
                target = matched_col
                target_reason = f"Identified '{target}' as primary predictive target based on key business outcome domain patterns."
            else:
                # Check for categorical / text outcome with 2-10 unique classes
                cat_target = next((c for c in reversed(available_cols) if col_meta.get(c, {}).get("data_type") in ("categorical", "boolean", "text") and 2 <= df[c].nunique() <= 10), None)
                if cat_target:
                    target = cat_target
                    target_reason = f"Selected '{target}' as target category ({df[target].nunique()} distinct classes)."
                else:
                    # Check for continuous numeric column with high variance
                    num_target = next((c for c in reversed(available_cols) if col_meta.get(c, {}).get("data_type") == "numerical"), None)
                    if num_target:
                        target = num_target
                        target_reason = f"Selected numeric metric '{target}' as continuous regression target."
                    else:
                        target = available_cols[-1]
                        target_reason = f"Defaulted to '{target}' as target outcome."
        else:
            target_reason = f"Using user-specified target column '{target}'."

        # 2. Compute Correlation Matrix
        corr_data = self.compute_correlation_matrix(df, target_column=target, col_meta=col_meta)
        corrs = corr_data.get("correlations", [])

        # 3. Feature Selection based on correlation
        selected_features = []
        feature_reason = ""

        if feature_mode == "ai" or not feature_columns:
            if corrs:
                # Filter out near-perfect clones (|r| > 0.999) to prevent target leakage
                non_leakage_corrs = [c for c in corrs if c["abs_correlation"] < 0.999]

                # Meaningful correlation threshold (|r| >= 0.05)
                signal_features = [c for c in non_leakage_corrs if c["abs_correlation"] >= 0.05]

                # If too few meet threshold, take top 3-8 features
                if len(signal_features) < 3:
                    chosen = non_leakage_corrs[:min(8, len(non_leakage_corrs))]
                else:
                    # Cap at top 10 features to keep model clean and avoid overfitting
                    chosen = signal_features[:10]

                selected_features = [c["feature"] for c in chosen]

                top_corrs_desc = ", ".join([f"{c['feature']} (r={c['correlation']:+.2f})" for c in chosen[:4]])
                feature_reason = (
                    f"Automatically selected {len(selected_features)} most relevant input features sorted by correlation strength with '{target}' "
                    f"(including {top_corrs_desc}). Low-correlation noise features were filtered out."
                )
            else:
                # Fallback if no correlations could be computed
                selected_features = [c for c in available_cols if c != target][:10]
                feature_reason = f"Selected {len(selected_features)} features from available dataset columns."
        else:
            # User manually specified features
            selected_features = [c for c in feature_columns if c in available_cols and c != target]
            feature_reason = f"Using {len(selected_features)} manually designated feature columns."

        # 4. Problem Type Detection
        if category_mode == "manual" and req_category:
            problem_type = req_category
        else:
            detection = self.detect_problem_type(df, target, col_meta)
            problem_type = detection.get("problem_type", "classification")

        # 5. Algorithm & Hyperparameter Selection
        tech_list = self.get_techniques_for_problem(problem_type)

        if algorithm_mode == "manual" and algorithm:
            matched_algo = next((t for t in tech_list if t["name"].lower() == algorithm.lower() or t["id"].lower() == algorithm.lower()), None)
            selected_algo = matched_algo or tech_list[0]
            algo_reason = f"Configured user-selected algorithm: {selected_algo['name']}."
        elif problem_type == "classification":
            selected_algo = next((t for t in tech_list if "Random Forest" in t["name"]), tech_list[0])
            algo_reason = f"Selected {selected_algo['name']} for balanced ensemble classification with built-in feature importance."
        elif problem_type == "regression":
            selected_algo = next((t for t in tech_list if "Random Forest Regressor" in t["name"]), tech_list[0])
            algo_reason = f"Selected {selected_algo['name']} to model non-linear numerical dependencies and resist overfitting."
        elif problem_type in ("forecasting", "time_series"):
            selected_algo = next((t for t in tech_list if "Random Forest" in t["name"]), tech_list[0])
            algo_reason = f"Selected {selected_algo['name']} with lag window features for multi-step time series forecasting."
        elif problem_type == "anomaly_detection":
            selected_algo = next((t for t in tech_list if "Isolation Forest" in t["name"]), tech_list[0])
            algo_reason = f"Selected {selected_algo['name']} for benchmark outlier isolation across feature space."
        else:
            selected_algo = tech_list[0]
            algo_reason = f"Selected {selected_algo['name']} for unsupervised segmentation & cohort clustering."

        hyperparameters = selected_algo.get("default_hyperparameters", {})

        # 6. Overall Reasoning Summary
        reasoning = {
            "target_reason": target_reason,
            "feature_reason": feature_reason,
            "algorithm_reason": algo_reason,
            "summary": (
                f"AI Model configured: Predicting '{target}' ({problem_type}) using {selected_algo['name']} "
                f"trained on {len(selected_features)} correlated features."
            )
        }

        return {
            "target_column": target,
            "feature_columns": selected_features,
            "ml_category": problem_type,
            "algorithm": selected_algo["name"],
            "hyperparameters": hyperparameters,
            "reasoning": reasoning,
            "correlations": corrs,
            "pairwise_matrix": corr_data.get("pairwise_matrix"),
            "eligible_columns": corr_data.get("eligible_columns", [])
        }


ml_service = MLService()
