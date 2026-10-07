import os
import sys
import json
import sqlite3
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.config import settings
from backend.services.dataset_service import dataset_service
from backend.services.visualization_service import visualization_service
from backend.services.training_engine import training_engine
from backend.models.models import DatasetSession, SavedVisualization, MLExperiment, DeployedModel, init_app_db
from backend.models.history import QueryHistory, init_history_db
from backend.database.session import SessionLocal, history_engine, engine

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

def clear_all_history_and_projects():
    """Wipes all previous query history and dataset sessions."""
    print("Clearing old history and database sessions...")
    
    # 1. Clear query history using direct sqlite connection for 100% clean wipe
    hist_path = settings.history_database_url.replace("sqlite:///", "")
    if os.path.exists(hist_path):
        conn = sqlite3.connect(hist_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM query_history;")
        conn.commit()
        conn.close()
        print("-> query_history wiped successfully.")

    # 2. Clear dataset sessions and downstream entities in enterprise_erp.db
    app_db_path = settings.database_url.replace("sqlite:///", "")
    if os.path.exists(app_db_path):
        conn = sqlite3.connect(app_db_path)
        cur = conn.cursor()
        for tbl in ["prediction_logs", "deployed_models", "ml_experiments", "saved_visualizations", "dataset_sessions"]:
            try:
                cur.execute(f"DELETE FROM {tbl};")
            except Exception:
                pass
        conn.commit()
        conn.close()
        print("-> dataset_sessions, visualizations, and ML experiments wiped.")

    # 3. Clean up uploaded files in uploads dir
    for f in os.listdir(UPLOADS_DIR):
        fp = os.path.join(UPLOADS_DIR, f)
        if os.path.isfile(fp):
            try: os.remove(fp)
            except Exception: pass
    print("-> Uploads directory cleaned.")

def generate_manufacturing_workbook() -> str:
    """Generates an enterprise-grade multi-sheet Excel file with realistic manufacturing data."""
    print("Generating Apex Precision Manufacturing multi-sheet dataset...")
    random.seed(42)
    np.random.seed(42)

    products = [
        {"id": "PRD-101", "name": "Titanium Turbine Rotor", "category": "Aerospace", "base_cost": 450, "base_price": 850},
        {"id": "PRD-102", "name": "Electric Powertrain Inverter", "category": "Automotive", "base_cost": 180, "base_price": 340},
        {"id": "PRD-103", "name": "Precision Hydraulic Actuator", "category": "Robotics", "base_cost": 220, "base_price": 420},
        {"id": "PRD-104", "name": "Carbon Composite Strut", "category": "Aerospace", "base_cost": 310, "base_price": 610},
        {"id": "PRD-105", "name": "Micro-Optical LiDAR Sensor", "category": "Automotive", "base_cost": 95, "base_price": 210},
        {"id": "PRD-106", "name": "High-Torque Planetary Gear", "category": "Robotics", "base_cost": 140, "base_price": 290},
        {"id": "PRD-107", "name": "High-Pressure Valve Assembly", "category": "Industrial", "base_cost": 75, "base_price": 165},
        {"id": "PRD-108", "name": "Silicon Carbide Power Module", "category": "Industrial", "base_cost": 260, "base_price": 520},
    ]

    plants = ["Detroit Advanced Plant", "Stuttgart Facility", "Nagoya Precision Hub", "Austin GigaWorks"]
    machines = ["CNC-Mill-01", "CNC-Mill-02", "5-Axis-Lathe-03", "Robotic-Welder-04", "Laser-Sinter-05", "EDM-Wire-06"]
    shifts = ["Morning", "Evening", "Night"]
    regions = ["North America", "Europe", "Asia-Pacific", "Latin America"]
    
    suppliers = [
        {"id": "SUP-01", "name": "Apex Titanium & Alloys", "rating": 96.5},
        {"id": "SUP-02", "name": "Nordic Precision Steels", "rating": 94.2},
        {"id": "SUP-03", "name": "Nippon Advanced Composites", "rating": 98.1},
        {"id": "SUP-04", "name": "Rheinland MicroElectronics", "rating": 89.4},
        {"id": "SUP-05", "name": "Continental Polymers & Resins", "rating": 91.8},
        {"id": "SUP-06", "name": "Pacific Sensors & Optics", "rating": 93.0},
    ]

    base_date = datetime(2026, 1, 1)

    # ─────────────────────────────────────────────────────────────────
    # Sheet 1: Manufacturing_Production (120 records)
    # ─────────────────────────────────────────────────────────────────
    prod_rows = []
    for i in range(120):
        dt = base_date + timedelta(days=i // 2, hours=random.choice([8, 14, 20]))
        p = random.choice(products)
        units = random.randint(35, 280)
        downtime = round(float(np.random.exponential(scale=2.2)) if random.random() > 0.3 else 0.0, 1)
        if downtime > 12.0: downtime = round(random.uniform(8.0, 14.5), 1)
        defect_count = int(units * random.uniform(0.008, 0.055) + (downtime * 1.5 if downtime > 5 else 0))
        m_cost = round(units * p["base_cost"] * random.uniform(0.95, 1.08) + (downtime * 120), 2)
        efficiency = round(max(65.0, min(99.5, 100.0 - (downtime * 2.8) - (defect_count / units * 80))), 1)

        prod_rows.append({
            "production_id": f"PRD-{1000 + i}",
            "date": dt.strftime("%Y-%m-%d"),
            "plant_location": random.choice(plants),
            "product_id": p["id"],
            "product_name": p["name"],
            "category": p["category"],
            "units_manufactured": units,
            "machine_id": random.choice(machines),
            "downtime_hours": downtime,
            "defect_count": defect_count,
            "manufacturing_cost": m_cost,
            "shift": random.choice(shifts),
            "efficiency_pct": efficiency
        })
    df_prod = pd.DataFrame(prod_rows)

    # ─────────────────────────────────────────────────────────────────
    # Sheet 2: Supply_Chain_Logistics (100 records)
    # ─────────────────────────────────────────────────────────────────
    supply_rows = []
    for i in range(100):
        dt = base_date + timedelta(days=i * 2)
        p = random.choice(products)
        s = random.choice(suppliers)
        lead_time = int(np.random.normal(loc=14, scale=4))
        lead_time = max(5, min(30, lead_time))
        stock = random.randint(150, 1200)
        reorder = random.randint(250, 500)
        raw_mat_cost = round(p["base_cost"] * 0.45 * random.uniform(0.92, 1.12), 2)
        status = "On-Time" if lead_time <= 16 else ("Delayed" if lead_time > 22 else "Expedited")

        supply_rows.append({
            "supply_id": f"SUPP-{2000 + i}",
            "date": dt.strftime("%Y-%m-%d"),
            "product_id": p["id"],
            "supplier_id": s["id"],
            "supplier_name": s["name"],
            "raw_material_cost": raw_mat_cost,
            "lead_time_days": lead_time,
            "stock_on_hand": stock,
            "reorder_level": reorder,
            "safety_stock": int(reorder * 0.4),
            "supply_capacity": random.randint(800, 3000),
            "delivery_status": status,
            "supplier_reliability_score": s["rating"]
        })
    df_supply = pd.DataFrame(supply_rows)

    # ─────────────────────────────────────────────────────────────────
    # Sheet 3: Market_Demand_Pricing (100 records)
    # ─────────────────────────────────────────────────────────────────
    demand_rows = []
    for i in range(100):
        dt = base_date + timedelta(days=i * 2)
        p = random.choice(products)
        unit_price = round(p["base_price"] * random.uniform(0.94, 1.08), 2)
        comp_price = round(unit_price * random.uniform(0.93, 1.07), 2)
        discount = random.choice([0.0, 2.5, 5.0, 7.5, 10.0])
        effective_price = round(unit_price * (1 - discount / 100.0), 2)
        # Price elasticity: higher relative price reduces demand
        price_ratio = effective_price / comp_price
        base_dem = random.randint(80, 320)
        units_demanded = int(base_dem * (1.8 - 0.8 * price_ratio))
        units_demanded = max(30, units_demanded)
        revenue = round(units_demanded * effective_price, 2)
        prod_cost = round(units_demanded * p["base_cost"], 2)
        gross_margin = round(((revenue - prod_cost) / max(1, revenue)) * 100.0, 1)

        demand_rows.append({
            "demand_id": f"DMD-{3000 + i}",
            "date": dt.strftime("%Y-%m-%d"),
            "product_id": p["id"],
            "region": random.choice(regions),
            "units_demanded": units_demanded,
            "unit_price": unit_price,
            "competitor_price": comp_price,
            "discount_pct": discount,
            "gross_margin_pct": gross_margin,
            "market_sentiment_index": round(random.uniform(62.0, 94.0), 1),
            "revenue": revenue
        })
    df_demand = pd.DataFrame(demand_rows)

    # ─────────────────────────────────────────────────────────────────
    # Sheet 4: Quality_Defects (80 records)
    # ─────────────────────────────────────────────────────────────────
    defect_types = ["Dimensional Variance", "Surface Flaw", "Thermal Fatigue", "Tolerance Mismatch", "Micro-Crack"]
    defect_rows = []
    for i in range(80):
        dt = base_date + timedelta(days=int(i * 2.5))
        p = random.choice(products)
        sev = random.randint(1, 10)
        status = "Scrapped" if sev >= 8 else ("Reworked" if sev >= 4 else "Passed with Deviation")
        scrap_cost = round(sev * p["base_cost"] * random.uniform(0.3, 0.9), 2)

        defect_rows.append({
            "defect_id": f"DEF-{4000 + i}",
            "date": dt.strftime("%Y-%m-%d"),
            "product_id": p["id"],
            "batch_number": f"BATCH-{2026}-{(i % 15) + 1:02d}",
            "defect_type": random.choice(defect_types),
            "severity_score": sev,
            "inspection_station": f"QC-Station-{random.randint(1, 4)}",
            "scrap_cost": scrap_cost,
            "pass_fail_status": status
        })
    df_defects = pd.DataFrame(defect_rows)

    # Save to Multi-sheet Excel workbook
    excel_path = os.path.join(DATA_DIR, "Apex_Precision_Manufacturing_Corp.xlsx")
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        df_prod.to_excel(writer, sheet_name="Manufacturing_Production", index=False)
        df_supply.to_excel(writer, sheet_name="Supply_Chain_Logistics", index=False)
        df_demand.to_excel(writer, sheet_name="Market_Demand_Pricing", index=False)
        df_defects.to_excel(writer, sheet_name="Quality_Defects", index=False)

    print(f"-> Excel workbook created with 4 sheets at: {excel_path}")
    return excel_path

def seed_project_and_history(excel_path: str):
    """Initializes project session, visualizations, ML model, and realistic query history."""
    print("Seeding database project sessions and history...")

    db = SessionLocal()
    with open(excel_path, "rb") as f:
        excel_bytes = f.read()

    sheet_names = dataset_service.get_sheet_names(excel_bytes, "Apex_Precision_Manufacturing_Corp.xlsx")
    primary_sheet = sheet_names[0]
    df_primary = dataset_service.read_excel_sheet(excel_bytes, primary_sheet)
    
    col_meta, data_quality = dataset_service.profile_dataset(df_primary)
    df_proc, derived = dataset_service.generate_derived_features(df_primary, col_meta)
    col_meta_proc, _ = dataset_service.profile_dataset(df_proc)
    col_meta_proc["_sheets"] = sheet_names
    col_meta_proc["_active_sheet"] = primary_sheet

    # Create project session
    session_id = "apex-mfg-corp-session"
    raw_path, proc_path = dataset_service.save_dataset_files(
        session_id, excel_bytes, df_proc, "Apex_Precision_Manufacturing_Corp.xlsx"
    )

    proj = DatasetSession(
        id=session_id,
        name="Apex Precision Manufacturing Operations",
        original_filename="Apex_Precision_Manufacturing_Corp.xlsx",
        file_path=raw_path,
        processed_file_path=proc_path,
        file_size_bytes=len(excel_bytes),
        row_count=len(df_proc),
        column_count=len(df_proc.columns),
        column_metadata=col_meta_proc,
        data_quality=data_quality,
        derived_features=derived,
        data_transformations=[
            {"type": "derived_features", "summary": "Extracted year, month, and day-of-week seasonality features from 'date'"},
            {"type": "efficiency_index", "summary": "Integrated machine downtime and defect counts into overall efficiency index"}
        ],
        saved_queries=[
            "SELECT product_name, SUM(units_manufactured) as total_units, ROUND(AVG(efficiency_pct), 1) as avg_efficiency FROM dataset GROUP BY product_name ORDER BY total_units DESC LIMIT 10",
            "SELECT plant_location, SUM(units_manufactured) as units, SUM(downtime_hours) as total_downtime FROM dataset GROUP BY plant_location",
            "SELECT m.product_name, m.units_manufactured, s.stock_on_hand, d.units_demanded, d.unit_price FROM manufacturing_production m JOIN supply_chain_logistics s ON m.product_id = s.product_id JOIN market_demand_pricing d ON m.product_id = d.product_id LIMIT 20"
        ]
    )
    db.add(proj)
    db.commit()

    # Visualizations
    vis_items = [
        SavedVisualization(
            dataset_id=session_id,
            category="two_variables",
            chart_type="Bar",
            x_variable="product_name",
            y_variable="units_manufactured",
            aggregation="sum",
            title="Total Units Manufactured by Product Line",
            description="Comparative output volume across all precision engineering product components.",
            configuration={"color": "#8b5cf6", "sort": "desc"}
        ),
        SavedVisualization(
            dataset_id=session_id,
            category="two_variables",
            chart_type="Scatter",
            x_variable="downtime_hours",
            y_variable="defect_count",
            aggregation="none",
            title="Machine Downtime vs Defect Rate Correlation",
            description="Analyzes the impact of equipment downtime duration on subsequent component defect occurrences.",
            configuration={"trendline": True, "color": "#f43f5e"}
        ),
        SavedVisualization(
            dataset_id=session_id,
            category="single_variable",
            chart_type="Bar",
            x_variable="plant_location",
            y_variable="efficiency_pct",
            aggregation="avg",
            title="Average Manufacturing Efficiency by Plant Location",
            description="Benchmark of overall operating equipment efficiency across Detroit, Stuttgart, Nagoya, and Austin plants.",
            configuration={"color": "#10b981"}
        ),
        SavedVisualization(
            dataset_id=session_id,
            category="two_variables",
            chart_type="Line",
            x_variable="date_month",
            y_variable="manufacturing_cost",
            aggregation="sum",
            title="Monthly Operating Manufacturing Cost Trend",
            description="Tracking operational expenditure over time to detect seasonal cost inflation and peak production runs.",
            configuration={"color": "#3b82f6"}
        )
    ]
    for v in vis_items:
        db.add(v)
    db.commit()

    # Train ML Model: Predictive Efficiency & Downtime
    print("Training sample ML model for manufacturing project...")
    try:
        train_res = training_engine.train_model(
            experiment_id="exp-mfg-efficiency-v1",
            file_path=proc_path,
            model_name="Machine Performance & Downtime Predictor",
            problem_type="regression",
            target_column="downtime_hours",
            feature_columns=["units_manufactured", "defect_count", "manufacturing_cost", "shift", "plant_location"],
            algorithm="Random Forest",
            hyperparameters={"n_estimators": 25, "max_depth": 6},
            train_config={"test_size": 0.2, "random_state": 42}
        )

        exp = MLExperiment(
            id="exp-mfg-efficiency-v1",
            dataset_id=session_id,
            model_name="Machine Performance & Downtime Predictor",
            problem_type="regression",
            target_column="downtime_hours",
            feature_columns=["units_manufactured", "defect_count", "manufacturing_cost", "shift", "plant_location"],
            algorithm="Random Forest",
            hyperparameters={"n_estimators": 25, "max_depth": 6},
            train_config={"test_size": 0.2, "random_state": 42},
            metrics=train_res["metrics"],
            feature_importances=train_res.get("feature_importances", []),
            model_artifact_path=train_res["model_artifact_path"],
            status="completed"
        )
        db.add(exp)
        db.commit()

        # Deploy Model
        dep = DeployedModel(
            id="dep-mfg-downtime-prod",
            experiment_id="exp-mfg-efficiency-v1",
            deployment_name="Apex Machine Downtime Forecaster (Prod)",
            version="1.0.0",
            status="active"
        )
        db.add(dep)
        db.commit()
        print("-> ML model trained and deployed successfully.")
    except Exception as e:
        print(f"ML training note: {e}")

    db.close()

    # ─────────────────────────────────────────────────────────────────
    # Seed Realistic Query History in history.db
    # ─────────────────────────────────────────────────────────────────
    print("Seeding rich query history entries into history.db...")
    history_entries = [
        {
            "conversation_id": "conv-mfg-analytics-01",
            "prompt": "Compare units manufactured against market demand across regions",
            "generated_sql": """SELECT 
    m.product_name,
    d.region,
    SUM(m.units_manufactured) AS total_manufactured,
    SUM(d.units_demanded) AS total_demanded,
    (SUM(m.units_manufactured) - SUM(d.units_demanded)) AS supply_demand_gap
FROM manufacturing_production m
JOIN market_demand_pricing d ON m.product_id = d.product_id
GROUP BY m.product_name, d.region
ORDER BY supply_demand_gap ASC;""",
            "execution_time_ms": 34.2,
            "rows_count": 32,
            "chart_type": "bar",
            "chart_config": json.dumps({
                "xAxis": {"type": "category", "data": ["Titanium Turbine Rotor (EU)", "Electric Powertrain Inverter (NA)", "Micro-Optical LiDAR Sensor (APAC)", "High-Torque Planetary Gear (NA)"]},
                "series": [
                    {"name": "Units Manufactured", "type": "bar", "data": [480, 620, 890, 410], "itemStyle": {"color": "#8b5cf6"}},
                    {"name": "Units Demanded", "type": "bar", "data": [540, 590, 950, 380], "itemStyle": {"color": "#06b6d4"}}
                ]
            }),
            "insights": "Europe and Asia-Pacific show tight supply deficits for Titanium Turbine Rotors and Micro-Optical LiDAR Sensors (demand outstripping production by ~12.5%). Increasing shift allocation at Stuttgart and Nagoya is strongly recommended.",
            "database_name": "Apex_Precision_Manufacturing_Corp",
            "model_used": "llama-3.3-70b-versatile",
            "is_favorite": True,
            "is_pinned": True,
            "session_name": "Supply & Demand Balance Analysis"
        },
        {
            "conversation_id": "conv-mfg-analytics-01",
            "prompt": "Which suppliers have the highest lead time and risk of causing production delays?",
            "generated_sql": """SELECT 
    supplier_name,
    ROUND(AVG(lead_time_days), 1) AS avg_lead_time_days,
    ROUND(AVG(supplier_reliability_score), 1) AS avg_reliability,
    SUM(CASE WHEN delivery_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed_shipments_count,
    COUNT(*) AS total_shipments
FROM supply_chain_logistics
GROUP BY supplier_name
ORDER BY avg_lead_time_days DESC;""",
            "execution_time_ms": 28.5,
            "rows_count": 6,
            "chart_type": "bar",
            "chart_config": json.dumps({
                "xAxis": {"type": "category", "data": ["Rheinland MicroElectronics", "Continental Polymers", "Pacific Sensors", "Nordic Precision", "Apex Titanium", "Nippon Composites"]},
                "series": [{"name": "Avg Lead Time (Days)", "type": "bar", "data": [19.2, 17.5, 15.8, 14.1, 13.0, 11.2], "itemStyle": {"color": "#f59e0b"}}]
            }),
            "insights": "Rheinland MicroElectronics exhibits the highest average lead time (19.2 days) and lowest reliability score (89.4%). Recommend increasing safety stock on Silicon Carbide power modules by 20% to prevent assembly line pauses.",
            "database_name": "Apex_Precision_Manufacturing_Corp",
            "model_used": "llama-3.3-70b-versatile",
            "is_favorite": True,
            "is_pinned": False,
            "session_name": "Supplier Vulnerability & Lead Time"
        },
        {
            "conversation_id": "conv-mfg-analytics-02",
            "prompt": "Calculate profit margin and revenue by product category considering manufacturing and raw material costs",
            "generated_sql": """SELECT 
    m.category,
    COUNT(DISTINCT m.product_id) AS active_products,
    ROUND(SUM(d.revenue), 2) AS total_revenue,
    ROUND(SUM(m.manufacturing_cost), 2) AS total_mfg_cost,
    ROUND(SUM(d.revenue) - SUM(m.manufacturing_cost), 2) AS gross_profit,
    ROUND(((SUM(d.revenue) - SUM(m.manufacturing_cost)) / SUM(d.revenue)) * 100, 2) AS profit_margin_pct
FROM manufacturing_production m
JOIN market_demand_pricing d ON m.product_id = d.product_id
GROUP BY m.category
ORDER BY gross_profit DESC;""",
            "execution_time_ms": 31.8,
            "rows_count": 4,
            "chart_type": "pie",
            "chart_config": json.dumps({
                "series": [{
                    "name": "Gross Profit Share",
                    "type": "pie",
                    "radius": ["40%", "70%"],
                    "data": [
                        {"name": "Aerospace", "value": 482000, "itemStyle": {"color": "#6366f1"}},
                        {"name": "Robotics", "value": 318000, "itemStyle": {"color": "#10b981"}},
                        {"name": "Automotive", "value": 274000, "itemStyle": {"color": "#f59e0b"}},
                        {"name": "Industrial", "value": 195000, "itemStyle": {"color": "#ec4899"}}
                    ]
                }]
            }),
            "insights": "Aerospace leads overall profitability with 46.2% gross margin and ₹48.2 Lakh net contribution, driven by strong pricing power on Titanium Turbine Rotors. Industrial components yield high volume but compressed margins (28.4%).",
            "database_name": "Apex_Precision_Manufacturing_Corp",
            "model_used": "llama-3.3-70b-versatile",
            "is_favorite": True,
            "is_pinned": True,
            "session_name": "Product Profitability Matrix"
        },
        {
            "conversation_id": "conv-mfg-analytics-02",
            "prompt": "Find the machines with downtime exceeding 10 hours and correlated defect rates",
            "generated_sql": """SELECT 
    machine_id,
    plant_location,
    COUNT(*) AS total_shifts,
    ROUND(SUM(downtime_hours), 1) AS total_downtime_hours,
    SUM(defect_count) AS total_defects,
    ROUND(AVG(efficiency_pct), 1) AS avg_efficiency_pct
FROM manufacturing_production
WHERE downtime_hours > 5.0
GROUP BY machine_id, plant_location
ORDER BY total_downtime_hours DESC;""",
            "execution_time_ms": 22.1,
            "rows_count": 6,
            "chart_type": "bar",
            "chart_config": json.dumps({
                "xAxis": {"type": "category", "data": ["CNC-Mill-01 (Detroit)", "5-Axis-Lathe-03 (Stuttgart)", "Laser-Sinter-05 (Austin)", "Robotic-Welder-04 (Nagoya)"]},
                "series": [
                    {"name": "Downtime (Hours)", "type": "bar", "data": [48.2, 41.5, 36.0, 29.8], "itemStyle": {"color": "#ef4444"}},
                    {"name": "Defects Produced", "type": "bar", "data": [112, 94, 78, 62], "itemStyle": {"color": "#f97316"}}
                ]
            }),
            "insights": "Strong positive correlation observed between downtime on CNC-Mill-01 and thermal tooling defects. Initiating preventative spindle overhaul on CNC-Mill-01 will reduce scrap by an estimated ₹1.84 Lakh monthly.",
            "database_name": "Apex_Precision_Manufacturing_Corp",
            "model_used": "llama-3.3-70b-versatile",
            "is_favorite": False,
            "is_pinned": False,
            "session_name": "Maintenance & Downtime Audit"
        },
        {
            "conversation_id": "conv-mfg-analytics-03",
            "prompt": "Analyze price elasticity: how does unit selling price affect units demanded?",
            "generated_sql": """SELECT 
    p.product_name,
    ROUND(AVG(d.unit_price), 2) AS avg_unit_price,
    ROUND(AVG(d.competitor_price), 2) AS avg_competitor_price,
    ROUND(AVG(d.unit_price / d.competitor_price), 3) AS price_competitiveness_ratio,
    SUM(d.units_demanded) AS total_units_demanded,
    ROUND(SUM(d.revenue), 2) AS total_revenue
FROM market_demand_pricing d
JOIN (SELECT DISTINCT product_id, product_name FROM manufacturing_production) p ON d.product_id = p.product_id
GROUP BY p.product_name
ORDER BY total_revenue DESC;""",
            "execution_time_ms": 25.4,
            "rows_count": 8,
            "chart_type": "scatter",
            "chart_config": json.dumps({
                "xAxis": {"name": "Avg Selling Price (₹)", "type": "value"},
                "yAxis": {"name": "Units Demanded", "type": "value"},
                "series": [{
                    "type": "scatter",
                    "data": [[850, 1420], [610, 1850], [520, 2100], [420, 2600], [340, 3100], [290, 3450], [210, 4200], [165, 4800]],
                    "itemStyle": {"color": "#8b5cf6"}
                }]
            }),
            "insights": "Demonstrates classical downward-sloping elasticity curve. Automotive LiDAR sensors exhibit elastic demand (-1.45 elasticity), showing a 5% discount expands order volume by 8.2%, boosting total revenue.",
            "database_name": "Apex_Precision_Manufacturing_Corp",
            "model_used": "llama-3.3-70b-versatile",
            "is_favorite": True,
            "is_pinned": False,
            "session_name": "Price Elasticity & Revenue Modeling"
        }
    ]

    hist_conn = sqlite3.connect(settings.history_database_url.replace("sqlite:///", ""))
    hist_cur = hist_conn.cursor()
    
    for entry in history_entries:
        hist_cur.execute("""
            INSERT INTO query_history (
                conversation_id, prompt, generated_sql, edited_sql, execution_time_ms,
                rows_count, chart_type, chart_config, insights, timestamp, database_name,
                model_used, is_favorite, is_pinned, session_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry["conversation_id"], entry["prompt"], entry["generated_sql"], None,
            entry["execution_time_ms"], entry["rows_count"], entry["chart_type"],
            entry["chart_config"], entry["insights"], datetime.utcnow().isoformat(),
            entry["database_name"], entry["model_used"], entry["is_favorite"],
            entry["is_pinned"], entry["session_name"]
        ))

    hist_conn.commit()
    hist_conn.close()
    print("-> 5 rich manufacturing query history records successfully seeded into history.db.")

def main():
    clear_all_history_and_projects()
    excel_path = generate_manufacturing_workbook()
    seed_project_and_history(excel_path)
    print("\nSUCCESS! All old history deleted and fresh Multi-Sheet Manufacturing data seeded cleanly.")

if __name__ == "__main__":
    main()
