from typing import Dict, Any, Set, List
import re
from backend.services.schema_service import schema_service

class ContextBuilder:
    @staticmethod
    def get_related_tables(matched_tables: Set[str], relationships: List[Dict[str, Any]], depth: int = 2) -> Set[str]:
        """
        Retrieves tables connected to matched tables via foreign keys up to N hops.
        """
        related_tables = set(matched_tables)
        for _ in range(depth):
            current_snapshot = set(related_tables)
            for rel in relationships:
                from_t = rel["from_table"]
                to_t = rel["to_table"]
                if from_t in current_snapshot:
                    related_tables.add(to_t)
                if to_t in current_snapshot:
                    related_tables.add(from_t)
        return related_tables

    def build_schema_context(self, user_question: str) -> str:
        """
        Builds a comprehensive SQLite schema context string for LLM SQL generation.
        Includes all table definitions and foreign key links to ensure accuracy.
        """
        schema = schema_service.get_schema()
        tables = schema["tables"]
        relationships = schema["relationships"]
        
        # When table count is small (<30), pass full database schema to prevent missing join targets
        if len(tables) <= 30:
            matched_tables = set(tables.keys())
        else:
            # Tokenize user question into clean lowercase words
            words = set(re.findall(r'\b\w+\b', user_question.lower()))
            extended_words = set(words)
            for w in words:
                if w.endswith('s') and len(w) > 3:
                    extended_words.add(w[:-1])
                if w.endswith('es') and len(w) > 4:
                    extended_words.add(w[:-2])
            
            matched_tables: Set[str] = set()
            for table_name, table_info in tables.items():
                t_lower = table_name.lower()
                if t_lower in extended_words or any(word in t_lower for word in extended_words):
                    matched_tables.add(table_name)
                    continue
                for col_name in table_info["columns"].keys():
                    c_lower = col_name.lower()
                    if c_lower in extended_words or any(word in c_lower for word in extended_words):
                        matched_tables.add(table_name)
                        break
                        
            if not matched_tables:
                matched_tables = set(tables.keys())
            else:
                matched_tables = self.get_related_tables(matched_tables, relationships, depth=2)
            
        context_lines = []
        context_lines.append("## SQLite Database Schema\n")
        
        for table_name in sorted(matched_tables):
            if table_name not in tables:
                continue
            table_info = tables[table_name]
            
            table_fks = {r["from_columns"][0]: f"FK->{r['to_table']}.{r['to_columns'][0]}" 
                         for r in relationships if r["from_table"] == table_name and r["from_columns"] and r["to_columns"]}
            
            col_strs = []
            for col_name, col_meta in table_info["columns"].items():
                col_desc = col_name
                if col_meta["primary_key"]:
                    col_desc += " PK"
                elif col_name in table_fks:
                    col_desc += f" {table_fks[col_name]}"
                else:
                    col_desc += f" {col_meta['type']}"
                col_strs.append(col_desc)
                
            context_lines.append(f"- {table_name} ({', '.join(col_strs)})")
            
        return "\n".join(context_lines)

context_builder = ContextBuilder()


