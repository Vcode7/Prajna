import time
from typing import Dict, Any, List
from sqlalchemy import text
from backend.database.session import engine
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

class SQLExecutionError(Exception):
    """Exception raised during SQL execution."""
    def __init__(self, message: str, sql: str, original_error: Exception = None):
        super().__init__(message)
        self.sql = sql
        self.original_error = original_error

class SQLExecutor:
    def execute(self, sql: str, limit: int = None) -> Dict[str, Any]:
        """
        Executes a read-only SQL query on the database.
        Returns:
            {
                "columns": List[str],
                "rows": List[Dict[str, Any]],
                "execution_time_ms": float,
                "row_count": int
            }
        """
        if limit is None:
            limit = settings.max_rows_limit

        # Apply a safety LIMIT if not already present in the SQL query
        # We can append it or wrap it if the query doesn't already contain LIMIT
        # Note: If it's a simple SELECT, we can append " LIMIT x" if not present
        # To be safe and simple, we run the query, but we fetch at most `limit` rows.
        
        logger.info(f"Executing SQL: {sql}")
        start_time = time.perf_counter()
        
        try:
            with engine.connect() as conn:
                # Set a timeout for this connection/query execution (if supported by DB dialect)
                # SQLite execution timeout can be set via sqlite3 connect args (already set up in session)
                
                result = conn.execute(text(sql))
                
                # Fetch columns
                columns = list(result.keys())
                
                # Fetch rows (up to the limit)
                rows = []
                count = 0
                for r in result:
                    if count >= limit:
                        logger.warning(f"Query returned more than limit ({limit}) rows. Truncating.")
                        break
                    
                    # Convert row to dictionary
                    row_dict = {}
                    for idx, col in enumerate(columns):
                        val = r[idx]
                        # Handle datetime or other non-serializable objects by converting to string
                        if val is not None and not isinstance(val, (int, float, str, bool)):
                            val = str(val)
                        row_dict[col] = val
                    rows.append(row_dict)
                    count += 1
                
                execution_time_ms = (time.perf_counter() - start_time) * 1000.0
                
                return {
                    "columns": columns,
                    "rows": rows,
                    "execution_time_ms": round(execution_time_ms, 2),
                    "row_count": len(rows)
                }
                
        except Exception as e:
            execution_time_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"SQL Execution failed after {execution_time_ms:.2f}ms: {e}")
            raise SQLExecutionError(f"Database error: {str(e)}", sql, e)

sql_executor = SQLExecutor()
