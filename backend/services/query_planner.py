import json
from typing import Dict, Any, List, Optional
from backend.llm.client import groq_client
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

class QueryPlanner:
    def __init__(self):
        self.erp_modules_context = """
BUSINESS MODULES & TABLES IN DATABASE:
- SALES MODULE:
  * regions: region_id, name, headquarters
  * salespersons: salesperson_id, first_name, last_name, region_id, target
  * customers: customer_id, company_name, contact_name, email, state, country, segment
  * categories: category_id, name, description
  * products: product_id, product_name, category_id, unit_price, cost_price, sku
  * orders: order_id, customer_id, salesperson_id, order_date, ship_date, ship_mode, status
  * order_items: item_id, order_id, product_id, quantity, unit_price, discount, profit
- INVENTORY MODULE:
  * warehouses: warehouse_id, name, location, capacity
  * reorder_levels: product_id, minimum_quantity, lead_time_days
  * inventory: inventory_id, product_id, warehouse_id, quantity_on_hand
  * stock_movement: movement_id, inventory_id, quantity, type ('INCOMING', 'OUTGOING', 'ADJUSTMENT'), movement_date
- SUPPLY CHAIN MODULE:
  * suppliers: supplier_id, name, contact_email, country
  * purchase_orders: po_id, supplier_id, order_date, status, total_amount
  * shipments: shipment_id, po_id, carrier, tracking_number, departure_date, delivery_date
- MANUFACTURING MODULE:
  * factories: factory_id, name, location
  * production_lines: line_id, factory_id, name, status
  * machines: machine_id, line_id, name, model, installation_date
  * production_orders: production_order_id, factory_id, product_id, quantity, status, start_date, end_date
  * machine_downtime: downtime_id, machine_id, duration_minutes, reason, downtime_date
  * production_costs: cost_id, production_order_id, material_cost, labor_cost, overhead_cost
- FINANCE MODULE:
  * expenses: expense_id, category, amount, expense_date, department_name
  * budgets: budget_id, department_name, fiscal_year, allocated_amount
  * payments: payment_id, order_id, amount, payment_date, payment_method, status
- HR MODULE:
  * departments: department_id, name, budget_code
  * employees: employee_id, first_name, last_name, email, department_id, salary, hire_date
  * attendance: attendance_id, employee_id, date, status ('Present', 'Absent', 'Leave', 'Sick')
  * performance_reviews: review_id, employee_id, review_date, score (1-5), notes
- CRM MODULE:
  * leads: lead_id, name, company, email, status, created_date
  * opportunities: opportunity_id, lead_id, value, stage, close_date
  * support_tickets: ticket_id, customer_id, subject, priority, status, created_date, resolution_time_hours
"""

    async def generate_plan(self, user_prompt: str, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Classifies user prompt into 'generator' or 'response' mode.
        - generator: creates an execution plan for analytics queries / dashboard requests.
        - response: answers system/software questions or politely declines off-topic requests.
        """
        system_prompt = f"""You are a senior Data Architect and AI Assistant for an Enterprise Business Intelligence platform.

YOUR MANDATORY FIRST TASK IS TO CLASSIFY THE USER'S INTENT INTO ONE OF TWO MODES: "generator" OR "response".

{self.erp_modules_context}

---

CLASSIFICATION & OUTPUT GUIDELINES:

1. MODE: "generator"
   Select "generator" when the user wants the system to generate, analyze, compare, visualize, explore, report, summarize, build a dashboard, create charts, discover trends, perform KPI analysis, or answer analytical questions using the database.

   Examples:
   - "Show monthly sales."
   - "Compare profit by category."
   - "Generate an inventory dashboard."
   - "Find top 10 customers."
   - "Analyze revenue trends."

   For "generator" mode, respond with valid JSON in this exact structure:
   {{
     "mode": "generator",
     "is_multi_query": true,
     "executive_title": "A high-level dashboard title (e.g., 'Enterprise Operations & Sales Performance Analysis')",
     "plan": [
       {{
         "id": "widget_1",
         "title": "Analysis Widget Title",
         "modules": ["Sales", "Inventory"],
         "description": "Short explanation of the chart/metric goal",
         "sql_instructions": "Detailed query requirements specifying tables, target keys, joins, where clauses, groupings, and ordering."
       }}
     ]
   }}

2. MODE: "response"
   Select "response" for all other requests that are NOT asking for database data analysis or dashboard generation.

   Examples:
   - "What can this software do?" -> Explain platform capabilities (natural language business analytics, SQLite querying, ECharts visualization, multi-query dashboards, CSV export).
   - "How do I create a dashboard?" -> Explain how to type natural language prompts to generate multi-metric dashboards.
   - "Explain SQL." -> Briefly explain SQL as the database query language.
   - "How do I use filters?" -> Explain global dashboard filter controls.
   - "Tell me a joke." -> Politely decline explaining the system purpose.
   - "Who is the Prime Minister?" -> Politely decline explaining the system purpose.

   Guidelines for "response_text":
   - Answer only questions related to this analytics software, its database, SQL capabilities, dashboard features, or how to use the system.
   - Politely decline unrelated requests by explaining that this application is designed specifically for database analytics, SQL generation, visualization, reporting, and business intelligence.
   - Never fabricate database query results or perform data analysis without executing SQL.

   For "response" mode, respond with valid JSON in this exact structure:
   {{
     "mode": "response",
     "response_text": "Your clear, professional response answering software/usage questions or politely declining unrelated requests."
   }}

Return ONLY valid JSON matching one of the two structures above.
"""

        messages = [
            {"role": "system", "content": "You are a professional database schema planner and AI assistant. Return valid JSON only."},
            {"role": "user", "content": f"{system_prompt}\n\nUSER PROMPT:\n\"{user_prompt}\""}
        ]

        logger.info(f"Analyzing prompt intent and mode: {user_prompt}")
        try:
            response_text = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.0,
                max_tokens=settings.query_planner_max_tokens,
                json_mode=True,
                task_name="Query Planner"
            )
            parsed = json.loads(response_text)
            if "mode" not in parsed:
                parsed["mode"] = "generator" if ("plan" in parsed or "is_multi_query" in parsed) else "response"
            return parsed
        except Exception as e:
            logger.error(f"Failed to generate query plan: {e}. Generating fallback generator plan.")
            return {
                "mode": "generator",
                "is_multi_query": False,
                "executive_title": "Analytics Summary",
                "plan": [{
                    "id": "query_1",
                    "title": "Data Report",
                    "modules": ["Sales"],
                    "description": "Standard business data lookup",
                    "sql_instructions": f"Extract details to answer: {user_prompt}"
                }]
            }

query_planner = QueryPlanner()
