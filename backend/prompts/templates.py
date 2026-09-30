from datetime import datetime

def get_sql_generation_prompt(schema_context: str, user_question: str, conversation_history: str = "") -> str:
    current_date = datetime.now().strftime("%Y-%m-%d")
    
    prompt = f"""You are an expert SQL Developer specializing in SQLite. Your task is to convert natural language queries into valid SQLite queries based on the provided schema.

DATABASE SCHEMA:
{schema_context}

IMPORTANT GUIDELINES:

1. Generate ONLY SQLite-compatible SQL.
2. The query MUST be a single read-only SELECT statement.
3. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, REPLACE, TRUNCATE, PRAGMA, or ATTACH statements.
4. Use only tables and columns present in the provided schema.
5. Never invent tables, columns, aliases, or relationships.
6. Use only SQLite-supported syntax and functions.
7. Never use database-specific functions from PostgreSQL, SQL Server, Oracle, or MySQL.

Examples of unsupported functions include (not limited to):
- STDDEV
- STDDEV_POP
- STDDEV_SAMP
- VARIANCE
- DATEADD
- DATEDIFF
- STRING_AGG
- ARRAY_AGG
- TOP
- FULL OUTER JOIN

8. If the requested calculation is not directly supported by SQLite, rewrite it using SQLite-compatible expressions, CTEs, window functions, CASE expressions, or mathematical formulas.
9. Prefer CTEs for complex analytical queries.
10. Use window functions only if supported by SQLite.
11. Always qualify column names when joins are present.
12. Always return deterministic ordering using ORDER BY whenever appropriate.
13. Today's date is {current_date}.

CONVERSATION HISTORY:
{conversation_history}

USER QUESTION:
"{user_question}"

You MUST respond with a valid JSON object matching the following structure:
{{
    "reasoning": "Step-by-step thinking process of how the query was constructed and which tables/columns were selected.",
    "sql": "The exact, raw SQLite query. Do not wrap in markdown blocks like ```sql.",
    "explanation": "A very brief explanation of what the query calculates in plain English."
}}
"""
    return prompt

def get_sql_repair_prompt(schema_context: str, original_sql: str, error_message: str) -> str:
    prompt = f"""You are a SQL debugging assistant. A SQLite query was generated but failed execution. Your task is to repair the query so it runs successfully.

DATABASE SCHEMA:
{schema_context}

FAILED SQL:
```sql
{original_sql}
```

DATABASE ERROR MESSAGE:
{error_message}

INSTRUCTIONS

You are repairing a SQLite query.

Analyze the reported database error carefully.

Modify ONLY the portions of the SQL required to resolve the error.

Preserve:

- business logic
- selected columns
- filters
- joins
- grouping
- ordering

unless the reported error requires changing them.

The repaired query MUST:

- use only SQLite-supported syntax
- reference only existing tables
- reference only existing columns
- avoid unsupported SQLite functions
- avoid unsupported joins
- remain read-only

Never return the same failing SQL.

If the reported error references:

- missing column
- missing table
- unsupported function
- invalid syntax

ensure that exact issue is fully resolved before returning the query.

Return only the repaired SQL JSON.

You MUST respond with a valid JSON object matching the following structure:
{{
    "reasoning": "Explanation of why the previous query failed and how it is being repaired.",
    "sql": "The repaired, raw SQLite query. Do not wrap in markdown blocks.",
    "explanation": "A short summary of what was fixed."
}}
Before returning the SQL, internally verify:

✓ Every table exists.
✓ Every column exists.
✓ Every JOIN key exists.
✓ Every SQL function is supported by SQLite.
✓ The SQL answers the user's request.
✓ The SQL is syntactically valid SQLite.
"""
    return prompt

def get_insight_generation_prompt(user_question: str, sql: str, data_summary: str) -> str:
    prompt = f"""You are an elite Business Intelligence Analyst. Explain the database query results and provide rich, actionable insights.

USER QUESTION:
"{user_question}"

EXECUTED SQL:
```sql
{sql}
```

QUERY RESULT SUMMARY (First few rows):
{data_summary}

INSTRUCTIONS:
1. Format your response in clean, well-structured Markdown.
2. Use Markdown headings (`## Executive Summary`, `### Key Findings`, `### Business Impact`, `### Recommended Next Actions`).
3. Use bullet lists (`- `) and numbered lists (`1. `) for structured insights.
4. Use **bold text** for critical numbers, totals, percentages, and metrics.
5. Use Markdown blockquotes (`> Key Takeaway: ...`) to emphasize strategic observations.
6. Use Markdown tables (`| Metric | Value | ... |`) if comparing multiple data points.
7. Suggest 3 follow-up business questions.

Do NOT output JSON. Make the tone helpful, analytical, and authoritative.
"""
    return prompt

def get_chart_generation_prompt(user_question: str, columns: list, sample_rows: list) -> str:
    prompt = f"""You are a data visualization expert. Decide the most effective chart type to display the query results, and specify its mapping configuration.

USER QUESTION:
"{user_question}"

COLUMNS AVAILABLE:
{columns}

SAMPLE DATA (Up to 3 rows):
{sample_rows}

CHART TYPES SUPPORTED:
- "Bar" (Standard vertical bar chart)
- "Horizontal Bar" (Good for rankings and many categories)
- "Line" (Perfect for continuous values, trends over time)
- "Area" (Good for showing volume or cumulative values over time)
- "Pie" (Proportions of a whole, limit to <= 7 slices)
- "Donut" (Alternative to Pie chart)
- "Scatter" (Relationship between two numeric variables)
- "Bubble" (Relationship between three numeric variables: x, y, size)
- "Heatmap" (Correlation or matrix grid values)
- "Treemap" (Hierarchical categories, nested rectangles)
- "Stacked Bar" (Subcategories stacked on top of each other)
- "Stacked Area" (Volume trends with category breakdowns)
- "Histogram" (Distribution of a single numeric column)

INSTRUCTIONS:
1. Select the single best chart type from the supported list. If no chart makes sense (e.g. single scalar value), use "Bar" or "Line" as a fallback.
2. Determine which column should represent the x_axis (independent variable / category / timeline).
3. Determine which column(s) should represent the y_axis (dependent variables / metrics).
4. Specify the series details containing the series name and the column key.

You MUST respond with a valid JSON object matching the following structure:
{{
    "chart_type": "One of the supported chart types exactly as written above",
    "title": "A descriptive title for the chart based on the query",
    "x_axis": "column_name_for_x_axis",
    "y_axis": "column_name_for_y_axis",
    "series": [
        {{
            "name": "User-friendly name of the metric series",
            "data_key": "column_name_for_this_series"
        }}
    ]
}}
"""
    return prompt
