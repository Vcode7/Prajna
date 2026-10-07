import os
import io
import re
import csv
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DatasetService:
    def is_excel_file(self, file_content_or_path: Any, filename: Optional[str] = None) -> bool:
        """
        Detects if input is an Excel workbook (.xlsx or .xls).
        """
        if filename and (filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls")):
            return True
        if isinstance(file_content_or_path, str) and (file_content_or_path.lower().endswith(".xlsx") or file_content_or_path.lower().endswith(".xls")):
            return True
        if isinstance(file_content_or_path, (bytes, bytearray)):
            if file_content_or_path.startswith(b'PK\x03\x04') or file_content_or_path.startswith(b'\xd0\xcf\x11\xe0'):
                return True
        return False

    def get_sheet_names(self, file_content_or_path: Any, filename: Optional[str] = None) -> List[str]:
        """
        Extracts available sheet names from an Excel workbook, or returns ['Default'] for CSVs.
        """
        if not self.is_excel_file(file_content_or_path, filename):
            return ["Default"]
        try:
            if isinstance(file_content_or_path, (bytes, bytearray)):
                xl = pd.ExcelFile(io.BytesIO(file_content_or_path))
            elif isinstance(file_content_or_path, str) and os.path.exists(file_content_or_path):
                xl = pd.ExcelFile(file_content_or_path)
            else:
                xl = pd.ExcelFile(file_content_or_path)
            return xl.sheet_names
        except Exception as e:
            logger.warning(f"Failed to read sheet names: {e}")
            return ["Default"]

    def read_excel_sheet(self, file_content_or_path: Any, sheet_name: Optional[Any] = 0) -> pd.DataFrame:
        """
        Reads a specific sheet from an Excel file with column sanitization.
        """
        if isinstance(file_content_or_path, (bytes, bytearray)):
            xl = pd.ExcelFile(io.BytesIO(file_content_or_path))
        elif isinstance(file_content_or_path, str) and os.path.exists(file_content_or_path):
            xl = pd.ExcelFile(file_content_or_path)
        else:
            xl = pd.ExcelFile(file_content_or_path)

        target_sheet = sheet_name if sheet_name is not None else 0
        df = pd.read_excel(xl, sheet_name=target_sheet)
        df.columns = [str(c).strip() for c in df.columns]
        return df

    def read_file_robust(self, file_content_or_path: Any, filename: Optional[str] = None, sheet_name: Optional[Any] = None) -> pd.DataFrame:
        """
        Reads either Excel (.xlsx, .xls) or CSV with automatic format detection and fallback.
        """
        if self.is_excel_file(file_content_or_path, filename):
            return self.read_excel_sheet(file_content_or_path, sheet_name=sheet_name if sheet_name is not None else 0)
        return self.read_csv_robust(file_content_or_path)

    def read_csv_robust(self, file_content_or_path: Any) -> pd.DataFrame:
        """
        Reads CSV with fallback encodings and separator autodetection. Automatically routes Excel files if provided.
        """
        if self.is_excel_file(file_content_or_path):
            return self.read_excel_sheet(file_content_or_path, 0)

        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        df = None
        last_err = None

        for enc in encodings:
            try:
                if isinstance(file_content_or_path, (bytes, bytearray)):
                    sample = file_content_or_path[:4096].decode(enc, errors='ignore')
                    # Detect delimiter
                    try:
                        sniffer = csv.Sniffer()
                        dialect = sniffer.sniff(sample, delimiters=[',', ';', '\t', '|'])
                        sep = dialect.delimiter
                    except Exception:
                        sep = ','
                    
                    df = pd.read_csv(io.BytesIO(file_content_or_path), encoding=enc, sep=sep, on_bad_lines='skip')
                elif isinstance(file_content_or_path, str) and os.path.exists(file_content_or_path):
                    with open(file_content_or_path, 'rb') as f:
                        sample = f.read(4096).decode(enc, errors='ignore')
                    try:
                        sniffer = csv.Sniffer()
                        dialect = sniffer.sniff(sample, delimiters=[',', ';', '\t', '|'])
                        sep = dialect.delimiter
                    except Exception:
                        sep = ','
                    df = pd.read_csv(file_content_or_path, encoding=enc, sep=sep, on_bad_lines='skip')
                else:
                    df = pd.read_csv(file_content_or_path, encoding=enc, on_bad_lines='skip')
                
                if df is not None and not df.empty:
                    break
            except Exception as e:
                last_err = e
                continue
                
        if df is None:
            raise ValueError(f"Unable to parse CSV/Excel file: {last_err}")

        # Clean column names (strip whitespace and special chars)
        df.columns = [str(c).strip() for c in df.columns]
        return df

    def is_mixed_number_and_text(self, series: pd.Series) -> bool:
        """
        Identifies whether a column contains BOTH numbers and text.
        Returns True if:
          1. Some rows are numeric and other rows are non-numeric text strings, OR
          2. The values themselves contain both digits and alphabetic characters (e.g. 'INV001', 'Zone 4'), OR
          3. An object series has a mixture of numeric and string representations.
        Excludes pure numbers (all integers/floats), pure text (no numbers/digits), booleans, and valid datetimes.
        """
        if series is None:
            return False

        non_null = series.dropna()
        if non_null.empty:
            return False

        # Exclude boolean columns
        if pd.api.types.is_bool_dtype(series):
            return False
        unique_vals = set(non_null.unique())
        if unique_vals.issubset({True, False, 0, 1, 'true', 'false', 'True', 'False', '0', '1', 'yes', 'no', 'Y', 'N'}) and len(unique_vals) <= 2:
            return False

        # Exclude datetime columns
        if pd.api.types.is_datetime64_any_dtype(series):
            return False
        sample_first = str(non_null.iloc[0]).strip()
        if len(sample_first) >= 8 and (re.match(r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', sample_first) or re.match(r'^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}', sample_first)):
            try:
                parsed = pd.to_datetime(non_null.iloc[:20], errors='coerce')
                if parsed.notna().sum() >= max(1, int(len(non_null.iloc[:20]) * 0.8)):
                    return False
            except Exception:
                pass

        # If series is already purely numeric and not object
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_object_dtype(series):
            return False

        cleaned_vals = []
        for v in non_null:
            if v is None or pd.isna(v):
                continue
            sv = str(v).strip()
            if sv.lower() in ('', 'nan', 'none', 'null', '<na>'):
                continue
            cleaned_vals.append((v, sv))

        if not cleaned_vals:
            return False

        has_pure_number = False
        has_pure_text = False
        has_alphanumeric_cell = False
        has_digit = False
        has_letter = False

        for orig_val, str_val in cleaned_vals:
            is_num = False
            if isinstance(orig_val, (int, float, np.integer, np.floating)):
                is_num = True
            else:
                try:
                    float(str_val)
                    is_num = True
                except ValueError:
                    is_num = False

            contains_digit = bool(re.search(r'\d', str_val))
            contains_letter = bool(re.search(r'[a-zA-Z]', str_val))

            if contains_digit:
                has_digit = True
            if contains_letter:
                has_letter = True

            if is_num:
                has_pure_number = True
            elif contains_letter and not contains_digit:
                has_pure_text = True
            elif contains_digit and contains_letter:
                has_alphanumeric_cell = True

        if has_pure_number and (has_pure_text or has_letter):
            return True
        if has_alphanumeric_cell:
            return True
        if has_digit and has_letter:
            return True

        return False

    def convert_column_to_text(self, series: pd.Series) -> pd.Series:
        """
        Converts all values in a column to text strings while preserving nulls.
        Integers formatted as floats (e.g. 100.0) are converted to '100'.
        Preserves all whitespace, indentation, spaces, and formatting without stripping.
        """
        def _to_clean_text(val):
            if pd.isna(val) or val is None:
                return None
            if isinstance(val, (int, np.integer)):
                return str(val)
            if isinstance(val, (float, np.floating)):
                if val.is_integer():
                    return str(int(val))
                return str(val)
            raw_s = str(val)
            if raw_s.strip().lower() in ('nan', 'none', 'null', '<na>') and raw_s.strip() != '':
                return None
            return raw_s

        return series.apply(_to_clean_text)

    def identify_and_convert_mixed_columns(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """
        Scans all columns in the DataFrame. If any column contains both numbers and text,
        converts its data type to text (clean strings).
        Returns the modified DataFrame and the list of converted column names.
        """
        df_out = df.copy()
        converted_cols = []
        for col in df_out.columns:
            if self.is_mixed_number_and_text(df_out[col]):
                converted_cols.append(col)
                df_out[col] = self.convert_column_to_text(df_out[col]).astype(object)
                logger.info(f"Column '{col}' identified as containing both numbers and text; converted data type to text.")
        return df_out, converted_cols

    def _detect_sql_type(self, series: pd.Series, detected_type: Optional[str] = None) -> str:
        """
        Returns SQLite SQL column type: INTEGER, REAL, TEXT, DATETIME, or BOOLEAN.
        """
        dtype = detected_type or self._detect_series_type(series)
        if dtype == "boolean":
            return "BOOLEAN"
        elif dtype == "datetime":
            return "DATETIME"
        elif dtype == "numerical":
            numeric_clean = pd.to_numeric(series.dropna(), errors='coerce').dropna()
            if not numeric_clean.empty and (numeric_clean % 1 == 0).all():
                return "INTEGER"
            return "REAL"
        return "TEXT"

    def profile_dataset(self, df: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Computes detailed column statistics, types, missing values, duplicates, and quality warnings.
        Automatically identifies columns containing both numbers and text, converting them to text.
        """
        # Ensure mixed number+text columns are converted
        df_clean, mixed_converted_cols = self.identify_and_convert_mixed_columns(df)

        row_count, col_count = df_clean.shape
        duplicate_count = int(df_clean.duplicated().sum())
        total_missing = int(df_clean.isna().sum().sum())
        
        column_meta = {}
        warnings = []

        if duplicate_count > 0:
            pct_dup = round((duplicate_count / max(1, row_count)) * 100, 1)
            warnings.append(f"Detected {duplicate_count} duplicate rows ({pct_dup}% of dataset).")

        if row_count < 10:
            warnings.append("Dataset has fewer than 10 rows; ML training requires more observations.")

        for col in df_clean.columns:
            series = df_clean[col]
            null_count = int(series.isna().sum())
            null_pct = round((null_count / max(1, row_count)) * 100, 2)
            unique_count = int(series.nunique(dropna=True))
            
            # Detect data type
            is_mixed = (col in mixed_converted_cols) or self.is_mixed_number_and_text(series)
            if is_mixed:
                detected_type = "text"
                sql_type = "TEXT"
                warnings.append(f"Column '{col}' contained both numbers and text; automatically identified and converted data type to text.")
            else:
                detected_type = self._detect_series_type(series)
                sql_type = self._detect_sql_type(series, detected_type)
            
            col_info: Dict[str, Any] = {
                "name": col,
                "data_type": detected_type,
                "sql_type": sql_type,
                "raw_type": str(series.dtype),
                "null_count": null_count,
                "null_pct": null_pct,
                "unique_count": unique_count,
                "has_mixed_types": is_mixed,
                "converted_to_text": is_mixed,
                "sample_values": [str(v) for v in series.dropna().unique()[:5]]
            }

            if null_pct > 40.0:
                warnings.append(f"Column '{col}' has {null_pct}% missing values.")

            if detected_type == "numerical":
                numeric_clean = pd.to_numeric(series.dropna(), errors='coerce').dropna()
                if not numeric_clean.empty:
                    q25 = float(numeric_clean.quantile(0.25))
                    q75 = float(numeric_clean.quantile(0.75))
                    iqr = q75 - q25
                    outliers_cnt = int(((numeric_clean < (q25 - 1.5 * iqr)) | (numeric_clean > (q75 + 1.5 * iqr))).sum())
                    
                    col_info.update({
                        "min": float(numeric_clean.min()),
                        "max": float(numeric_clean.max()),
                        "mean": round(float(numeric_clean.mean()), 2),
                        "std": round(float(numeric_clean.std()), 2) if len(numeric_clean) > 1 else 0.0,
                        "median": round(float(numeric_clean.median()), 2),
                        "q25": round(q25, 2),
                        "q75": round(q75, 2),
                        "outlier_count": outliers_cnt
                    })
            elif detected_type in ("categorical", "text"):
                val_counts = series.value_counts(dropna=True)
                top_val = str(val_counts.index[0]) if not val_counts.empty else "N/A"
                top_freq = int(val_counts.iloc[0]) if not val_counts.empty else 0
                col_info.update({
                    "top_value": top_val,
                    "top_frequency": top_freq,
                    "cardinality_ratio": round(unique_count / max(1, row_count), 4)
                })
                if unique_count > 100 and (unique_count / row_count) > 0.8:
                    warnings.append(f"Column '{col}' has high cardinality ({unique_count} distinct values) and might be an ID or free text.")
            elif detected_type == "datetime":
                dt_clean = pd.to_datetime(series.dropna(), errors='coerce').dropna()
                if not dt_clean.empty:
                    col_info.update({
                        "min_date": dt_clean.min().isoformat(),
                        "max_date": dt_clean.max().isoformat()
                    })

            column_meta[col] = col_info

        data_quality = {
            "duplicate_rows": duplicate_count,
            "total_missing_values": total_missing,
            "missing_cells_pct": round((total_missing / max(1, row_count * col_count)) * 100, 2),
            "warnings": warnings,
            "has_warnings": len(warnings) > 0,
            "converted_mixed_columns": mixed_converted_cols,
            "has_mixed_columns": len(mixed_converted_cols) > 0
        }

        return column_meta, data_quality

    def _detect_series_type(self, series: pd.Series) -> str:
        """
        Infers whether column is numerical, datetime, boolean, text, or categorical.
        """
        non_null = series.dropna()
        if non_null.empty:
            return "categorical"

        # Check boolean
        if series.dtype == bool or set(non_null.unique()).issubset({True, False, 0, 1, 'true', 'false', 'True', 'False', '0', '1', 'yes', 'no', 'Y', 'N'}):
            if len(non_null.unique()) <= 2:
                return "boolean"

        # Check datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"
        
        # Check string date patterns
        sample = str(non_null.iloc[0]).strip()
        if len(sample) >= 8 and (re.match(r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', sample) or re.match(r'^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}', sample)):
            try:
                parsed = pd.to_datetime(non_null.iloc[:10], errors='coerce')
                if parsed.notna().sum() >= 8:
                    return "datetime"
            except Exception:
                pass

        # Check if mixed number and text
        if self.is_mixed_number_and_text(series):
            return "text"

        # Check numeric
        if pd.api.types.is_numeric_dtype(series):
            return "numerical"
            
        try:
            pd.to_numeric(non_null, errors='raise')
            return "numerical"
        except Exception:
            pass

        return "categorical"

    def generate_derived_features(self, df: pd.DataFrame, col_meta: Dict[str, Any]) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        """
        Generates meaningful categorical/grouping features (dates -> year/month, numerical -> group bins)
        with explicit documentation for why each feature was created.
        """
        df_processed = df.copy()
        derived_list = []

        # 1. Date Features
        for col, meta in col_meta.items():
            if meta["data_type"] == "datetime":
                try:
                    dt_series = pd.to_datetime(df_processed[col], errors='coerce')
                    
                    year_col = f"{col}_year"
                    df_processed[year_col] = dt_series.dt.year.fillna(0).astype(int).astype(str)
                    derived_list.append({
                        "original_column": col,
                        "derived_column": year_col,
                        "transformation": "Extracted Year",
                        "reason": f"Enables annual trend and grouping analysis for '{col}'."
                    })
                    
                    month_col = f"{col}_month"
                    df_processed[month_col] = dt_series.dt.strftime('%Y-%m').fillna('Unknown')
                    derived_list.append({
                        "original_column": col,
                        "derived_column": month_col,
                        "transformation": "Extracted Year-Month",
                        "reason": f"Enables monthly seasonality visualization for '{col}'."
                    })

                    day_name_col = f"{col}_day_of_week"
                    df_processed[day_name_col] = dt_series.dt.day_name().fillna('Unknown')
                    derived_list.append({
                        "original_column": col,
                        "derived_column": day_name_col,
                        "transformation": "Extracted Day of Week",
                        "reason": f"Enables weekly cyclical pattern analysis for '{col}'."
                    })
                except Exception as e:
                    logger.warning(f"Failed to generate date features for '{col}': {e}")

        # 2. Meaningful Numerical Quantile / Range Bins (for continuous columns with > 50 distinct values)
        for col, meta in col_meta.items():
            if meta["data_type"] == "numerical" and meta["unique_count"] > 30 and len(df_processed) >= 20:
                try:
                    numeric_vals = pd.to_numeric(df_processed[col], errors='coerce')
                    if numeric_vals.dropna().nunique() > 20:
                        bucket_col = f"{col}_group"
                        # Create 3-4 quartile buckets
                        bins = 4 if len(df_processed) >= 50 else 3
                        labels = ["Low", "Medium-Low", "Medium-High", "High"] if bins == 4 else ["Low", "Medium", "High"]
                        df_processed[bucket_col] = pd.qcut(numeric_vals, q=bins, labels=labels, duplicates='drop').astype(str).fillna("Missing")
                        derived_list.append({
                            "original_column": col,
                            "derived_column": bucket_col,
                            "transformation": f"{bins}-Tier Quantile Bucketing ({', '.join(labels)})",
                            "reason": f"Creates intuitive categorical segment groupings for '{col}'."
                        })
                except Exception as e:
                    logger.debug(f"Could not bin numeric column '{col}': {e}")

        return df_processed, derived_list

    def preprocess_dataset(self, df: pd.DataFrame, col_meta: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        """
        Converts mixed number/text fields to text without stripping spaces or modifying data formatting.
        """
        clean_df, _ = self.identify_and_convert_mixed_columns(df)
        return clean_df

    def save_dataset_files(self, dataset_id: str, raw_content: bytes, processed_df: pd.DataFrame, filename: str) -> Tuple[str, str]:
        """
        Persists both original and processed CSV files to disk.
        """
        raw_path = os.path.join(UPLOAD_DIR, f"{dataset_id}_raw_{filename}")
        with open(raw_path, 'wb') as f:
            f.write(raw_content)

        proc_filename = f"{dataset_id}_processed_{filename}"
        proc_path = os.path.join(UPLOAD_DIR, proc_filename)
        processed_df.to_csv(proc_path, index=False, encoding='utf-8')

        return raw_path, proc_path

    def sanitize_sheet_name(self, name: str, existing_names: Optional[set] = None) -> str:
        """
        Sanitizes a sheet name to be valid for Excel (<=31 chars, no special characters, unique).
        """
        if not name:
            name = "Sheet"
        # Excel does not allow : \ / ? * [ ]
        clean = re.sub(r'[\\/*?:\[\]]', '_', str(name)).strip()
        clean = clean[:31] if clean else "Sheet"

        if existing_names is None:
            return clean

        base = clean
        counter = 2
        while clean.lower() in existing_names:
            suffix = f"_{counter}"
            max_base_len = 31 - len(suffix)
            clean = f"{base[:max_base_len]}{suffix}"
            counter += 1

        return clean

    def create_multisheet_workbook_bytes(self, sheets_dict: Dict[str, pd.DataFrame]) -> bytes:
        """
        Creates an in-memory Excel workbook (.xlsx) containing all DataFrames as distinct sheets.
        """
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            for sheet_name, df in sheets_dict.items():
                safe_name = self.sanitize_sheet_name(sheet_name)
                df_to_save = df.copy()
                df_to_save.columns = [str(c).strip() for c in df_to_save.columns]
                df_to_save.to_excel(writer, sheet_name=safe_name, index=False)
        buf.seek(0)
        return buf.getvalue()

    def save_multisheet_dataset_files(
        self,
        dataset_id: str,
        workbook_bytes: bytes,
        processed_df: pd.DataFrame,
        filename_prefix: str
    ) -> Tuple[str, str]:
        """
        Persists the multi-sheet Excel workbook as the raw dataset file and
        the active sheet processed CSV to disk.
        """
        raw_filename = f"{dataset_id}_raw_{filename_prefix}.xlsx"
        raw_path = os.path.join(UPLOAD_DIR, raw_filename)
        with open(raw_path, 'wb') as f:
            f.write(workbook_bytes)

        proc_filename = f"{dataset_id}_processed_{filename_prefix}.csv"
        proc_path = os.path.join(UPLOAD_DIR, proc_filename)
        processed_df.to_csv(proc_path, index=False, encoding='utf-8')

        return raw_path, proc_path

    def get_preview_data(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """
        Returns preview rows, column types, SQL types, and mixed column indicators for AG Grid.
        """
        df = pd.read_csv(file_path, nrows=limit, encoding='utf-8', on_bad_lines='skip')
        # Fill NaN for clean JSON serialization
        df_filled = df.where(pd.notnull(df), None)
        
        col_types = {}
        sql_types = {}
        mixed_cols = []
        for c in df.columns:
            is_mixed = self.is_mixed_number_and_text(df[c])
            if is_mixed:
                mixed_cols.append(c)
                col_types[c] = "text"
                sql_types[c] = "TEXT"
            else:
                detected = self._detect_series_type(df[c])
                col_types[c] = detected
                sql_types[c] = self._detect_sql_type(df[c], detected)

        return {
            "columns": list(df.columns),
            "rows": df_filled.to_dict(orient='records'),
            "total_columns": len(df.columns),
            "column_types": col_types,
            "sql_types": sql_types,
            "mixed_columns": mixed_cols
        }

dataset_service = DatasetService()
