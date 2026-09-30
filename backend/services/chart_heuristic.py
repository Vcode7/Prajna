"""
Heuristic Chart Generation Engine
Infers chart type from column names, detected data types, and sample values.
Returns a confidence level: 'high' | 'medium' | 'low'.
Only 'high' confidence results bypass the LLM chart generator.
"""
import re
from typing import List, Dict, Any, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Keyword sets for column name classification
# ─────────────────────────────────────────────────────────────────────────────
DATE_KEYWORDS = {"date", "month", "year", "week", "quarter", "day", "time", "period", "created", "updated", "at"}
CATEGORY_KEYWORDS = {"name", "category", "type", "status", "region", "country", "city", "state", "department",
                     "product", "brand", "segment", "group", "label", "tag", "code", "id", "class"}
NUMERIC_KEYWORDS = {"count", "total", "amount", "sum", "revenue", "sales", "value", "quantity", "qty",
                    "price", "cost", "profit", "loss", "score", "rate", "avg", "average", "ratio",
                    "balance", "budget", "expense", "salary", "hours", "days", "units", "margin"}
PERCENTAGE_KEYWORDS = {"percent", "pct", "rate", "ratio", "share", "proportion", "percentage", "growth"}


def _classify_column(col_name: str, sample_values: List[Any]) -> str:
    """Classify a column as 'date', 'category', 'numeric', or 'percentage'."""
    lower = col_name.lower()

    # Check for date keywords
    if any(kw in lower for kw in DATE_KEYWORDS):
        return "date"

    # Check for percentage / rate
    if any(kw in lower for kw in PERCENTAGE_KEYWORDS):
        return "percentage"

    # Check for numeric keywords
    if any(kw in lower for kw in NUMERIC_KEYWORDS):
        return "numeric"

    # Detect by sample value types
    if sample_values:
        non_null = [v for v in sample_values if v is not None]
        if non_null:
            # All values numeric → numeric column
            try:
                all(float(v) for v in non_null)
                return "numeric"
            except (ValueError, TypeError):
                pass

            # Looks like a date string
            first = str(non_null[0])
            if re.match(r'\d{4}-\d{2}', first):
                return "date"

    # Check category keywords after type detection
    if any(kw in lower for kw in CATEGORY_KEYWORDS):
        return "category"

    return "unknown"


class ChartHeuristicEngine:
    def infer(
        self,
        columns: List[str],
        rows: List[Dict[str, Any]],
        user_question: str = ""
    ) -> Dict[str, Any]:
        """
        Infer the best chart type heuristically.
        Returns dict with chart_type, x_axis, y_axis, series, confidence.
        """
        if not columns:
            return self._result("Bar", "", "", [], "low")

        # Build column classifications using first 3 rows as samples
        sample_rows = rows[:3] if rows else []
        col_types: Dict[str, str] = {}
        for col in columns:
            sample_vals = [r.get(col) for r in sample_rows]
            col_types[col] = _classify_column(col, sample_vals)

        date_cols = [c for c, t in col_types.items() if t == "date"]
        numeric_cols = [c for c, t in col_types.items() if t == "numeric"]
        pct_cols = [c for c, t in col_types.items() if t == "percentage"]
        cat_cols = [c for c, t in col_types.items() if t == "category"]

        n_cols = len(columns)
        n_rows = len(rows)

        # ── Single KPI ──────────────────────────────────────────────────────
        if n_rows == 1 and n_cols <= 2 and numeric_cols and not date_cols and not cat_cols:
            return self._result("Metric", columns[0], numeric_cols[0],
                                [{"name": numeric_cols[0].replace("_", " ").title(), "data_key": numeric_cols[0]}],
                                "high")

        # ── Date + Numeric ─── Line Chart ───────────────────────────────────
        if date_cols and numeric_cols:
            x = date_cols[0]
            if len(numeric_cols) == 1:
                y = numeric_cols[0]
                series = [{"name": y.replace("_", " ").title(), "data_key": y}]
                return self._result("Line", x, y, series, "high")
            else:
                # Multiple numeric → Multi-line
                y = numeric_cols[0]
                series = [{"name": c.replace("_", " ").title(), "data_key": c} for c in numeric_cols]
                return self._result("Line", x, y, series, "high")

        # ── Category + Percentage ─── Pie Chart ─────────────────────────────
        if cat_cols and pct_cols:
            x = cat_cols[0]
            y = pct_cols[0]
            series = [{"name": y.replace("_", " ").title(), "data_key": y}]
            return self._result("Pie", x, y, series, "high")

        # ── Category + Numeric ─── Bar Chart ────────────────────────────────
        if cat_cols and numeric_cols:
            x = cat_cols[0]
            y = numeric_cols[0]
            series = [{"name": y.replace("_", " ").title(), "data_key": y}]
            confidence = "high" if len(numeric_cols) == 1 else "medium"
            return self._result("Bar", x, y, series, confidence)

        # ── Two Numeric ─── Scatter Plot ─────────────────────────────────────
        if len(numeric_cols) >= 2 and not cat_cols and not date_cols:
            x = numeric_cols[0]
            y = numeric_cols[1]
            series = [{"name": y.replace("_", " ").title(), "data_key": y}]
            return self._result("Scatter", x, y, series, "medium")

        # ── Single Numeric Column ─── Bar (histogram-style) ──────────────────
        if len(numeric_cols) == 1 and n_cols == 1:
            y = numeric_cols[0]
            series = [{"name": y.replace("_", " ").title(), "data_key": y}]
            return self._result("Bar", y, y, series, "medium")

        # ── First column x, second column y fallback ──────────────────────────
        if n_cols >= 2:
            x = columns[0]
            y = columns[1]
            series = [{"name": y.replace("_", " ").title(), "data_key": y}]
            return self._result("Bar", x, y, series, "low")

        # ── Cannot infer ────────────────────────────────────────────────────
        return self._result("Bar", columns[0], columns[0], [], "low")

    def _result(self, chart_type: str, x_axis: str, y_axis: str,
                series: List[Dict[str, Any]], confidence: str) -> Dict[str, Any]:
        return {
            "chart_type": chart_type,
            "x_axis": x_axis,
            "y_axis": y_axis,
            "series": series,
            "confidence": confidence
        }


chart_heuristic = ChartHeuristicEngine()
