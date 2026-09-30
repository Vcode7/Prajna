import time
from typing import Dict, Any, List
from sqlalchemy import inspect, text
from backend.database.session import engine
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

class SchemaService:
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_time: float = 0.0

    def get_schema(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Retrieves the database schema including tables, columns, constraints, and relationships.
        Caches the schema based on settings.schema_cache_ttl.
        """
        current_time = time.time()
        if not force_refresh and self._cache and (current_time - self._cache_time < settings.schema_cache_ttl):
            logger.info("Returning cached database schema")
            return self._cache

        logger.info("Reading schema from SQLite database")
        try:
            inspector = inspect(engine)
            table_names = inspector.get_table_names()
            
            schema = {
                "tables": {},
                "relationships": []
            }
            
            for table_name in table_names:
                # Skip system/history tables if they reside in the same DB
                if table_name.startswith("sqlite_") or table_name == "query_history":
                    continue
                    
                columns = inspector.get_columns(table_name)
                pk_columns = inspector.get_pk_constraint(table_name).get("constrained_columns", [])
                foreign_keys = inspector.get_foreign_keys(table_name)
                
                cols_meta = {}
                for col in columns:
                    col_name = col["name"]
                    cols_meta[col_name] = {
                        "type": str(col["type"]),
                        "nullable": col["nullable"],
                        "default": str(col["default"]) if col["default"] is not None else None,
                        "primary_key": col_name in pk_columns
                    }
                
                # Fetch basic stats: Row count
                row_count = 0
                with engine.connect() as conn:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`"))
                    row_count = result.scalar()
                
                schema["tables"][table_name] = {
                    "columns": cols_meta,
                    "row_count": row_count,
                    "primary_key": pk_columns
                }
                
                # Capture foreign keys / relationships
                for fk in foreign_keys:
                    referred_table = fk["referred_table"]
                    referred_columns = fk["referred_columns"]
                    constrained_columns = fk["constrained_columns"]
                    
                    schema["relationships"].append({
                        "from_table": table_name,
                        "from_columns": constrained_columns,
                        "to_table": referred_table,
                        "to_columns": referred_columns
                    })
                    
            self._cache = schema
            self._cache_time = current_time
            return schema
            
        except Exception as e:
            logger.error(f"Error reading database schema: {e}")
            raise e

    def get_database_explorer_metadata(self) -> Dict[str, Any]:
        """
        Retrieves detailed schema info for tree view explorer:
        Includes unique value %, Null % and 5 sample rows for each table.
        """
        base_schema = self.get_schema()
        explorer_meta = {
            "tables": {},
            "relationships": base_schema["relationships"]
        }
        
        for table_name, table_info in base_schema["tables"].items():
            cols_meta = {}
            row_count = table_info["row_count"]
            
            # Fetch sample rows
            sample_rows = []
            columns_list = list(table_info["columns"].keys())
            
            with engine.connect() as conn:
                if row_count > 0:
                    sample_query = text(f"SELECT * FROM `{table_name}` LIMIT 5")
                    res = conn.execute(sample_query)
                    # Convert rows to dicts
                    for r in res:
                        # Convert values to strings if not JSON serializable
                        row_dict = {}
                        for idx, col in enumerate(res.keys()):
                            val = r[idx]
                            row_dict[col] = val
                        sample_rows.append(row_dict)
                
                # Calculate Null % and Unique values count for each column
                for col_name, col_prop in table_info["columns"].items():
                    null_pct = 0.0
                    unique_count = 0
                    
                    if row_count > 0:
                        # Count Nulls
                        null_res = conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}` WHERE `{col_name}` IS NULL"))
                        null_count = null_res.scalar()
                        null_pct = (null_count / row_count) * 100.0
                        
                        # Count Unique
                        unique_res = conn.execute(text(f"SELECT COUNT(DISTINCT `{col_name}`) FROM `{table_name}`"))
                        unique_count = unique_res.scalar()
                    
                    cols_meta[col_name] = {
                        **col_prop,
                        "null_percentage": round(null_pct, 2),
                        "unique_values_count": unique_count
                    }
                    
            explorer_meta["tables"][table_name] = {
                "row_count": row_count,
                "columns": cols_meta,
                "primary_key": table_info["primary_key"],
                "sample_rows": sample_rows
            }
            
        return explorer_meta

schema_service = SchemaService()
