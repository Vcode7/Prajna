import os
import io
import json
import joblib
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime
from backend.services.testing_service import testing_service

logger = logging.getLogger(__name__)

class DeploymentService:
    def run_inference(
        self,
        artifact_path: str,
        records: List[Dict[str, Any]],
        column_mapping: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Executes live inference on new input records, mapping columns if specified.
        """
        if not records:
            raise ValueError("No input records provided for inference.")

        df = pd.DataFrame(records)

        # Apply column mapping if provided
        if column_mapping:
            df = df.rename(columns=column_mapping)

        return testing_service.evaluate_and_predict(artifact_path, df)

deployment_service = DeploymentService()
