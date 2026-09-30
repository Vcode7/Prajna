import re
import sqlparse
from typing import Tuple, List, Set, Dict, Any, Optional
from backend.services.schema_service import schema_service
import logging

logger = logging.getLogger(__name__)

# Dangerous keywords that are explicitly forbidden
FORBIDDEN_KEYWORDS = {
    "delete", "drop", "alter", "update", "insert", "truncate", 
    "pragma", "attach", "detach", "vacuum", "create", "replace",
    "upsert", "grant", "revoke", "exec", "execute"
}

class SQLValidationError(Exception):
    """Exception raised for SQL validation failures."""
    pass

class SQLValidator:
    def _normalize_schema(self, schema_input: Any) -> Tuple[Set[str], Dict[str, Set[str]]]:
        """
        Normalizes any schema representation into:
        - valid_tables: Set of lowercase table names
        - table_columns: Dict of lowercase table name -> Set of lowercase column names
        """
        valid_tables: Set[str] = set()
        table_columns: Dict[str, Set[str]] = {}

        if not schema_input:
            return valid_tables, table_columns

        # Case 1: SchemaService format: {"tables": {"customers": {"columns": {"id": ...}}}}
        if isinstance(schema_input, dict) and "tables" in schema_input:
            tbl_data = schema_input["tables"]
            if isinstance(tbl_data, dict):
                for tbl_name, tbl_info in tbl_data.items():
                    norm_t = str(tbl_name).lower()
                    valid_tables.add(norm_t)
                    cols: Set[str] = set()
                    if isinstance(tbl_info, dict) and "columns" in tbl_info:
                        col_dict = tbl_info["columns"]
                        if isinstance(col_dict, dict):
                            cols = {str(c).lower() for c in col_dict.keys()}
                        elif isinstance(col_dict, list):
                            for c in col_dict:
                                cols.add(str(c.get("name") if isinstance(c, dict) else c).lower())
                    table_columns[norm_t] = cols

            elif isinstance(tbl_data, list):
                # Case 2: Multi-table format: {"tables": [{"table_name": ..., "columns": [...]}]}
                for t_entry in tbl_data:
                    if isinstance(t_entry, dict):
                        t_name = str(t_entry.get("table_name", "")).lower()
                        if t_name:
                            valid_tables.add(t_name)
                            cols = set()
                            for c in t_entry.get("columns", []):
                                c_name = str(c.get("name") if isinstance(c, dict) else c).lower()
                                if c_name:
                                    cols.add(c_name)
                            table_columns[t_name] = cols

        # Case 3: table_names list present in dict
        if isinstance(schema_input, dict) and "table_names" in schema_input:
            for tn in schema_input["table_names"]:
                valid_tables.add(str(tn).lower())

        # Case 4: flat dictionary: {"tbl_name": ["col1", "col2"]}
        if isinstance(schema_input, dict) and "tables" not in schema_input and "table_names" not in schema_input:
            for k, v in schema_input.items():
                norm_k = str(k).lower()
                valid_tables.add(norm_k)
                if isinstance(v, (list, set, tuple)):
                    table_columns[norm_k] = {str(col).lower() for col in v}

        return valid_tables, table_columns

    def validate(
        self,
        sql: str,
        schema: Optional[Any] = None,
        valid_tables: Optional[Set[str]] = None
    ) -> Tuple[bool, str]:
        """
        Validates the SQL query against syntax, forbidden keywords, and schema tables/columns.
        Supports both static database schemas and dynamic user-uploaded multi-sheet schemas.
        Returns (True, "") if valid, or (False, "reason") if invalid.
        """
        clean_sql = sql.strip().strip(";").lower()
        if not clean_sql:
            return False, "SQL query is empty"

        # 1. Check for dangerous keywords
        for keyword in FORBIDDEN_KEYWORDS:
            if keyword == "replace":
                if re.search(r'\b(create\s+or\s+replace|replace\s+into)\b', clean_sql):
                    return False, "Dangerous SQL query detected: contains forbidden keyword 'REPLACE INTO' / 'CREATE OR REPLACE'"
                continue
            pattern = rf"\b{keyword}\b"
            if re.search(pattern, clean_sql):
                return False, f"Dangerous SQL query detected: contains forbidden keyword '{keyword.upper()}'"

        # 2. Parse using sqlparse and verify statement types
        try:
            parsed = sqlparse.parse(sql)
            if not parsed:
                return False, "Failed to parse SQL query"
                
            for stmt in parsed:
                stmt_type = stmt.get_type()
                if stmt_type not in ("SELECT", "UNKNOWN"):
                    return False, f"Only SELECT queries are allowed. Detected statement type: {stmt_type}"
                    
                if stmt_type == "UNKNOWN":
                    first_token = stmt.token_first(skip_cm=True, skip_ws=True)
                    if not first_token or first_token.value.lower() not in ("with", "select"):
                        return False, "Only SELECT or CTE (WITH ...) queries are allowed."
        except Exception as e:
            return False, f"SQL syntax parsing error: {str(e)}"

        # 3. Resolve valid tables and columns from provided schema or fallback to schema_service
        table_columns: Dict[str, Set[str]] = {}
        if valid_tables is not None:
            resolved_tables = {str(t).lower() for t in valid_tables}
        elif schema is not None:
            resolved_tables, table_columns = self._normalize_schema(schema)
        else:
            default_schema = schema_service.get_schema()
            resolved_tables, table_columns = self._normalize_schema(default_schema)

        # Dataset aliases are always recognized as valid
        resolved_tables.update({"dataset", "data", "df"})

        # If CTEs are used, extract CTE aliases and allow them as valid tables
        cte_matches = re.findall(r'\bwith\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\b', clean_sql)
        for cte in cte_matches:
            resolved_tables.add(cte.lower())
        sub_ctes = re.findall(r',\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(', clean_sql)
        for scte in sub_ctes:
            resolved_tables.add(scte.lower())

        # Extract referenced tables from FROM and JOIN clauses
        referenced_tables = set(re.findall(r'\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)', clean_sql))
        for tbl in referenced_tables:
            if tbl not in resolved_tables:
                return False, f"Table '{tbl}' does not exist in the database schema."

        # Verify dotted column references (table_name.col_name) if column info is available
        dotted_refs = re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b", sql)
        for tbl_alias, col_name in dotted_refs:
            norm_alias = tbl_alias.lower()
            norm_col = col_name.lower()
            if norm_alias in table_columns and table_columns[norm_alias]:
                if norm_col not in table_columns[norm_alias]:
                    return False, f"Column '{col_name}' does not exist on table '{tbl_alias}'."

        return True, ""

    def _extract_tables(self, sql: str, valid_tables: Set[str]) -> Set[str]:
        words = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", sql.lower()))
        matched_tables = set()
        for tbl in valid_tables:
            if tbl.lower() in words:
                matched_tables.add(tbl)
        return matched_tables

sql_validator = SQLValidator()
