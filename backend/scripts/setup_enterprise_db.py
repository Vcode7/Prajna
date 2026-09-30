import os
import sqlite3
import random
from datetime import datetime, timedelta

def create_enterprise_database():
    db_path = "e:/projects/sql-llm/backend/data/enterprise_erp.db"
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # ------------------ SCHEMA DEFINITIONS ------------------
    
    # Sales Module
    cursor.execute("""
    CREATE TABLE regions (
        region_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        headquarters TEXT
    );""")
    
    cursor.execute("""
    CREATE TABLE salespersons (
        salesperson_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        region_id INTEGER,
        target REAL,
        FOREIGN KEY (region_id) REFERENCES regions(region_id)
    );""")

    cursor.execute("""
    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT UNIQUE,
        state TEXT NOT NULL,
        country TEXT NOT NULL,
        segment TEXT CHECK(segment IN ('Enterprise', 'Mid-Market', 'SMB'))
    );""")

    cursor.execute("""
    CREATE TABLE categories (
        category_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );""")

    cursor.execute("""
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        category_id INTEGER,
        unit_price REAL NOT NULL,
        cost_price REAL NOT NULL,
        sku TEXT UNIQUE,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );""")

    cursor.execute("""
    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        salesperson_id INTEGER,
        order_date TEXT NOT NULL,
        ship_date TEXT,
        ship_mode TEXT CHECK(ship_mode IN ('Standard', 'Express', 'Overnight')),
        status TEXT CHECK(status IN ('Pending', 'Shipped', 'Delivered', 'Cancelled')),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (salesperson_id) REFERENCES salespersons(salesperson_id)
    );""")

    cursor.execute("""
    CREATE TABLE order_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL,
        discount REAL DEFAULT 0.0,
        profit REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );""")

    # Inventory Module
    cursor.execute("""
    CREATE TABLE warehouses (
        warehouse_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        capacity INTEGER
    );""")

    cursor.execute("""
    CREATE TABLE reorder_levels (
        product_id INTEGER PRIMARY KEY,
        minimum_quantity INTEGER NOT NULL,
        lead_time_days INTEGER DEFAULT 7,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );""")

    cursor.execute("""
    CREATE TABLE inventory (
        inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        quantity_on_hand INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(product_id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
        UNIQUE(product_id, warehouse_id)
    );""")

    cursor.execute("""
    CREATE TABLE stock_movement (
        movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        type TEXT CHECK(type IN ('INCOMING', 'OUTGOING', 'ADJUSTMENT')),
        movement_date TEXT NOT NULL,
        FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id)
    );""")

    # Supply Chain Module
    cursor.execute("""
    CREATE TABLE suppliers (
        supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_email TEXT,
        country TEXT
    );""")

    cursor.execute("""
    CREATE TABLE purchase_orders (
        po_id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        status TEXT CHECK(status IN ('Draft', 'Submitted', 'Approved', 'Shipped', 'Received')),
        total_amount REAL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    );""")

    cursor.execute("""
    CREATE TABLE shipments (
        shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        carrier TEXT,
        tracking_number TEXT,
        departure_date TEXT,
        delivery_date TEXT,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id)
    );""")

    # Manufacturing Module
    cursor.execute("""
    CREATE TABLE factories (
        factory_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL
    );""")

    cursor.execute("""
    CREATE TABLE production_lines (
        line_id INTEGER PRIMARY KEY AUTOINCREMENT,
        factory_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT CHECK(status IN ('Active', 'Maintenance', 'Idle')),
        FOREIGN KEY (factory_id) REFERENCES factories(factory_id)
    );""")

    cursor.execute("""
    CREATE TABLE machines (
        machine_id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        model TEXT,
        installation_date TEXT,
        FOREIGN KEY (line_id) REFERENCES production_lines(line_id)
    );""")

    cursor.execute("""
    CREATE TABLE production_orders (
        production_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        factory_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT CHECK(status IN ('Planned', 'In-Progress', 'Completed', 'Cancelled')),
        start_date TEXT,
        end_date TEXT,
        FOREIGN KEY (factory_id) REFERENCES factories(factory_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );""")

    cursor.execute("""
    CREATE TABLE machine_downtime (
        downtime_id INTEGER PRIMARY KEY AUTOINCREMENT,
        machine_id INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        reason TEXT,
        downtime_date TEXT NOT NULL,
        FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
    );""")

    cursor.execute("""
    CREATE TABLE production_costs (
        cost_id INTEGER PRIMARY KEY AUTOINCREMENT,
        production_order_id INTEGER NOT NULL,
        material_cost REAL NOT NULL,
        labor_cost REAL NOT NULL,
        overhead_cost REAL NOT NULL,
        FOREIGN KEY (production_order_id) REFERENCES production_orders(production_order_id)
    );""")

    # Finance Module
    cursor.execute("""
    CREATE TABLE expenses (
        expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT NOT NULL,
        department_name TEXT
    );""")

    cursor.execute("""
    CREATE TABLE budgets (
        budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL,
        fiscal_year INTEGER NOT NULL,
        allocated_amount REAL NOT NULL,
        UNIQUE(department_name, fiscal_year)
    );""")

    cursor.execute("""
    CREATE TABLE payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('Wire Transfer', 'Credit Card', 'ACH', 'Net 30')),
        status TEXT CHECK(status IN ('Pending', 'Completed', 'Failed')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );""")

    # HR Module
    cursor.execute("""
    CREATE TABLE departments (
        department_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        budget_code TEXT
    );""")

    cursor.execute("""
    CREATE TABLE employees (
        employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        department_id INTEGER,
        salary REAL,
        hire_date TEXT,
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
    );""")

    cursor.execute("""
    CREATE TABLE attendance (
        attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT CHECK(status IN ('Present', 'Absent', 'Leave', 'Sick')),
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
        UNIQUE(employee_id, date)
    );""")

    cursor.execute("""
    CREATE TABLE performance_reviews (
        review_id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        review_date TEXT NOT NULL,
        score INTEGER CHECK(score >= 1 AND score <= 5),
        notes TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
    );""")

    # CRM Module
    cursor.execute("""
    CREATE TABLE leads (
        lead_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        status TEXT CHECK(status IN ('New', 'Contacted', 'Qualified', 'Unqualified', 'Converted')),
        created_date TEXT NOT NULL
    );""")

    cursor.execute("""
    CREATE TABLE opportunities (
        opportunity_id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        value REAL NOT NULL,
        stage TEXT CHECK(stage IN ('Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost')),
        close_date TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(lead_id)
    );""")

    cursor.execute("""
    CREATE TABLE support_tickets (
        ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        subject TEXT,
        priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
        status TEXT CHECK(status IN ('Open', 'In-Progress', 'Resolved', 'Closed')),
        created_date TEXT NOT NULL,
        resolution_time_hours REAL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );""")

    # ------------------ SEEDING SAMPLE DATA ------------------

    # Regions
    regions = [("APAC", "Singapore"), ("AMER", "New York"), ("EMEA", "London"), ("LATAM", "Sao Paulo")]
    cursor.executemany("INSERT INTO regions (name, headquarters) VALUES (?, ?);", regions)
    
    # Salespersons
    salespersons = [
        ("Arjun", "Reddy", 1, 500000.0),
        ("John", "Doe", 2, 800000.0),
        ("Sarah", "Connor", 3, 600000.0),
        ("Carlos", "Santana", 4, 400000.0),
        ("Priya", "Patel", 1, 550000.0)
    ]
    cursor.executemany("INSERT INTO salespersons (first_name, last_name, region_id, target) VALUES (?, ?, ?, ?);", salespersons)

    # Customers
    customers = [
        ("Wipro", "Abhi Rao", "abhi@wipro.com", "Karnataka", "India", "Enterprise"),
        ("Infosys", "Kiran Sen", "kiran@infosys.com", "Karnataka", "India", "Enterprise"),
        ("TCS", "Niti Roy", "niti@tcs.com", "Maharashtra", "India", "Enterprise"),
        ("Acme Corp", "John Smith", "john@acme.com", "California", "United States", "Mid-Market"),
        ("Stark Ind", "Pepper Potts", "pepper@stark.com", "New York", "United States", "Enterprise"),
        ("Hooli", "Gavin Belson", "gavin@hooli.com", "California", "United States", "Enterprise"),
        ("Initech", "Peter Gibbons", "peter@initech.com", "Texas", "United States", "SMB"),
        ("Tata Group", "Vikas Rao", "vikas@tata.com", "Maharashtra", "India", "Enterprise"),
        ("Biocon", "Kavya Murthy", "kavya@biocon.com", "Karnataka", "India", "Mid-Market"),
        ("Reliance", "Nisha Shah", "nisha@reliance.com", "Gujarat", "India", "Enterprise")
    ]
    cursor.executemany("INSERT INTO customers (company_name, contact_name, email, state, country, segment) VALUES (?, ?, ?, ?, ?, ?);", customers)

    # Categories
    categories = [
        ("Cloud Infrastructure", "Cloud server hosting, compute, and databases"),
        ("Enterprise Storage", "SANS, High-speed flash arrays, NAS storage devices"),
        ("Network Hardware", "Industrial routers, switches, fiber opt cabling"),
        ("Business Software", "ERP, HRMS, and CRM licenses")
    ]
    cursor.executemany("INSERT INTO categories (name, description) VALUES (?, ?);", categories)

    # Products
    products = [
        ("AntiCloud Compute VM", 1, 150.0, 45.0, "SKU-COMP-01"),
        ("AntiCloud Database Instance", 1, 300.0, 90.0, "SKU-COMP-02"),
        ("BI-Vault HighSpeed SAN", 2, 4500.0, 2200.0, "SKU-STOR-01"),
        ("BI-Vault Cold Archive HDD", 2, 1200.0, 500.0, "SKU-STOR-02"),
        ("ConnectCore Core Router", 3, 3500.0, 1500.0, "SKU-NET-01"),
        ("ConnectCore Switch 48-Port", 3, 800.0, 320.0, "SKU-NET-02"),
        ("ERP License Annual", 4, 15000.0, 2000.0, "SKU-SOFT-01"),
        ("CRM Suite Premium", 4, 8000.0, 1200.0, "SKU-SOFT-02")
    ]
    cursor.executemany("INSERT INTO products (product_name, category_id, unit_price, cost_price, sku) VALUES (?, ?, ?, ?, ?);", products)

    # Warehouses
    warehouses = [
        ("Bengaluru Hub", "Bengaluru, Karnataka", 15000),
        ("Mumbai Terminal", "Mumbai, Maharashtra", 25000),
        ("Texas Storage", "Dallas, Texas", 30000),
        ("London Depo", "London, UK", 12000)
    ]
    cursor.executemany("INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?);", warehouses)

    # Suppliers
    suppliers = [
        ("Intel Corp", "orders@intel.com", "United States"),
        ("Samsung Electronics", "sales@samsung.com", "South Korea"),
        ("Cisco Logistics", "partner@cisco.com", "United States"),
        ("AWS Reselling", "billing@amazon.com", "United States")
    ]
    cursor.executemany("INSERT INTO suppliers (name, contact_email, country) VALUES (?, ?, ?);", suppliers)

    # Factories
    factories = [
        ("Factory Alpha", "Bengaluru, Karnataka"),
        ("Factory Beta", "Austin, Texas")
    ]
    cursor.executemany("INSERT INTO factories (name, location) VALUES (?, ?);", factories)

    # Production lines & Machines
    cursor.execute("INSERT INTO production_lines (factory_id, name, status) VALUES (1, 'Assembly Line 1', 'Active');")
    cursor.execute("INSERT INTO production_lines (factory_id, name, status) VALUES (1, 'Testing Line 2', 'Maintenance');")
    cursor.execute("INSERT INTO production_lines (factory_id, name, status) VALUES (2, 'Assembly Line 3', 'Active');")
    
    cursor.execute("INSERT INTO machines (line_id, name, model, installation_date) VALUES (1, 'Robotic Arm A1', 'ABB-IRB1200', '2023-01-15');")
    cursor.execute("INSERT INTO machines (line_id, name, model, installation_date) VALUES (1, 'Reflow Oven O1', 'Heller-1809', '2023-02-10');")
    cursor.execute("INSERT INTO machines (line_id, name, model, installation_date) VALUES (2, 'Tester Probe P1', 'Keysight-3070', '2023-05-18');")

    # Departments
    departments = [
        ("Sales", "DEPT-SAL-01"),
        ("Engineering", "DEPT-ENG-02"),
        ("Finance", "DEPT-FIN-03"),
        ("HR", "DEPT-HR-04"),
        ("Manufacturing", "DEPT-MFG-05")
    ]
    cursor.executemany("INSERT INTO departments (name, budget_code) VALUES (?, ?);", departments)

    # Employees
    employees = [
        ("Kunal", "Deshpande", "kunal@company.com", 2, 120000.0, "2023-04-12"),
        ("Siddharth", "Patil", "sid@company.com", 2, 95000.0, "2023-08-01"),
        ("Ramesh", "Reddy", "ramesh@company.com", 3, 110000.0, "2022-10-05"),
        ("Pooja", "Joshi", "pooja@company.com", 4, 85000.0, "2023-11-20"),
        ("Vikram", "Hegde", "vikram@company.com", 5, 75000.0, "2023-02-15"),
        ("Neha", "Kulkarni", "neha@company.com", 1, 90000.0, "2023-06-01")
    ]
    cursor.executemany("INSERT INTO employees (first_name, last_name, email, department_id, salary, hire_date) VALUES (?, ?, ?, ?, ?, ?);", employees)

    # Budgets
    budgets = [
        ("Sales", 2025, 2000000.0),
        ("Engineering", 2025, 3500000.0),
        ("Finance", 2025, 800000.0),
        ("HR", 2025, 500000.0),
        ("Manufacturing", 2025, 4500000.0),
        ("Sales", 2026, 2200000.0),
        ("Engineering", 2026, 3800000.0)
    ]
    cursor.executemany("INSERT INTO budgets (department_name, fiscal_year, allocated_amount) VALUES (?, ?, ?);", budgets)

    # Leads, Opportunities, Tickets
    leads = [
        ("Satish Kamat", "Kamat Infra", "satish@kamatinfra.com", "Qualified", "2025-01-10"),
        ("Meera Sen", "Sen Software", "meera@sensoft.com", "Converted", "2025-02-14"),
        ("Rohan Das", "Das Retail", "rohan@dasretail.com", "New", "2025-06-01")
    ]
    cursor.executemany("INSERT INTO leads (name, company, email, status, created_date) VALUES (?, ?, ?, ?, ?);", leads)

    cursor.execute("INSERT INTO opportunities (lead_id, value, stage, close_date) VALUES (1, 45000.0, 'Negotiation', '2025-04-15');")
    cursor.execute("INSERT INTO opportunities (lead_id, value, stage, close_date) VALUES (2, 90000.0, 'Won', '2025-03-20');")

    support_tickets = [
        (1, "Server latency issues in APAC region", "High", "Resolved", "2025-05-10", 4.5),
        (2, "Faulty billing statement under order #10", "Medium", "Resolved", "2025-05-12", 2.0),
        (3, "License activation error on suite suite", "Urgent", "Open", "2025-07-25", None)
    ]
    cursor.executemany("INSERT INTO support_tickets (customer_id, subject, priority, status, created_date, resolution_time_hours) VALUES (?, ?, ?, ?, ?, ?);", support_tickets)

    # ------------------ GENERATING ORDERS & DEPENDENT TIMELINE DATA ------------------
    base_date = datetime.now()
    orders_data = []
    order_items_data = []
    inventory_items = {} # (prod, wh) -> qty
    
    # Initialize basic stock
    for prod_id in range(1, 9):
        for wh_id in range(1, 5):
            qty = random.randint(100, 500)
            cursor.execute("INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand) VALUES (?, ?, ?);", (prod_id, wh_id, qty))
            inventory_items[(prod_id, wh_id)] = qty
            
            # Reorder levels
            cursor.execute("INSERT OR IGNORE INTO reorder_levels (product_id, minimum_quantity, lead_time_days) VALUES (?, ?, ?);", (prod_id, 150, random.choice([5, 7, 10])))
            
    order_id = 1
    # Loop over the last 730 days to build orders, order items, stock movements, and production costs
    for day_offset in range(730):
        current_date = base_date - timedelta(days=day_offset)
        date_str = current_date.strftime("%Y-%m-%d")
        
        # 1. Orders
        num_orders = random.choices([0, 1, 2, 3], weights=[0.4, 0.4, 0.15, 0.05])[0]
        for _ in range(num_orders):
            cust_id = random.randint(1, 10)
            sp_id = random.randint(1, 5)
            ship_date = current_date + timedelta(days=random.randint(1, 5))
            ship_date_str = ship_date.strftime("%Y-%m-%d")
            ship_mode = random.choice(["Standard", "Express", "Overnight"])
            status = "Delivered" if day_offset > 10 else random.choice(["Pending", "Shipped"])
            
            orders_data.append((cust_id, sp_id, date_str, ship_date_str, ship_mode, status))
            
            # Order items (1-3 items per order)
            num_items = random.randint(1, 3)
            prods = random.sample(range(1, 9), num_items)
            for prod_id in prods:
                qty = random.randint(1, 5)
                # Fetch price
                cursor.execute("SELECT unit_price, cost_price FROM products WHERE product_id = ?", (prod_id,))
                price_row = cursor.fetchone()
                unit_p, cost_p = price_row
                
                discount = random.choices([0.0, 0.05, 0.1], weights=[0.8, 0.15, 0.05])[0]
                final_revenue = (unit_p * (1 - discount)) * qty
                total_cost = cost_p * qty
                profit = final_revenue - total_cost
                
                order_items_data.append((order_id, prod_id, qty, unit_p, discount, profit))
                
                # Subtract stock from a warehouse
                wh_id = random.randint(1, 4)
                inventory_key = (prod_id, wh_id)
                current_qty = inventory_items.get(inventory_key, 200)
                new_qty = max(0, current_qty - qty)
                inventory_items[inventory_key] = new_qty
                
                # Update inventory Hand count
                cursor.execute("UPDATE inventory SET quantity_on_hand = ? WHERE product_id = ? AND warehouse_id = ?;", (new_qty, prod_id, wh_id))
                
                # Log stock movement
                cursor.execute("""
                INSERT INTO stock_movement (inventory_id, quantity, type, movement_date)
                VALUES ((SELECT inventory_id FROM inventory WHERE product_id = ? AND warehouse_id = ?), ?, 'OUTGOING', ?);
                """, (prod_id, wh_id, qty, date_str))
                
            order_id += 1
            
        # 2. Expenses (1 per day)
        expense_cat = random.choice(["Salaries", "Utility Bills", "Marketing Spend", "Factory Maintenance", "Logistics Shipping"])
        expense_amount = random.randint(200, 2000)
        expense_dept = random.choice(["Sales", "Engineering", "Finance", "HR", "Manufacturing"])
        cursor.execute("INSERT INTO expenses (category, amount, expense_date, department_name) VALUES (?, ?, ?, ?);", (expense_cat, expense_amount, date_str, expense_dept))
        
        # 3. Production Orders (1 every 5 days)
        if day_offset % 5 == 0:
            prod_product_id = random.randint(1, 8)
            prod_qty = random.randint(20, 100)
            prod_status = "Completed" if day_offset > 15 else "In-Progress"
            start_date_str = date_str
            end_date_str = (current_date + timedelta(days=3)).strftime("%Y-%m-%d")
            
            cursor.execute("INSERT INTO production_orders (factory_id, product_id, quantity, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?);",
                           (random.choice([1, 2]), prod_product_id, prod_qty, prod_status, start_date_str, end_date_str))
            
            # Feed product cost record
            po_id_ref = cursor.lastrowid
            mat_cost = (prod_qty * 15.0)
            lab_cost = (prod_qty * 8.0)
            ov_cost = 250.0
            cursor.execute("INSERT INTO production_costs (production_order_id, material_cost, labor_cost, overhead_cost) VALUES (?, ?, ?, ?);",
                           (po_id_ref, mat_cost, lab_cost, ov_cost))
            
            # Add stock back to inventory
            wh_dest_id = random.choice([1, 2]) # Add back to regional warehouse
            inv_key = (prod_product_id, wh_dest_id)
            current_qty = inventory_items.get(inv_key, 200)
            new_qty = current_qty + prod_qty
            inventory_items[inv_key] = new_qty
            cursor.execute("UPDATE inventory SET quantity_on_hand = ? WHERE product_id = ? AND warehouse_id = ?;", (new_qty, prod_product_id, wh_dest_id))
            
        # 4. Machine Downtimes (1 every 15 days)
        if day_offset % 15 == 0:
            machine_ref = random.choice([1, 2, 3])
            duration = random.randint(30, 240)
            reason = random.choice(["Belt Slippage", "Calibration Mismatch", "Sensor Cleaning", "Scheduled Checkup"])
            cursor.execute("INSERT INTO machine_downtime (machine_id, duration_minutes, reason, downtime_date) VALUES (?, ?, ?, ?);",
                           (machine_ref, duration, reason, date_str))
            
        # 5. Purchase Orders (1 every 10 days to replenish inventory)
        if day_offset % 10 == 0:
            supplier_ref = random.choice([1, 2, 3, 4])
            po_status = "Received" if day_offset > 8 else "Shipped"
            po_amt = random.randint(1500, 10000)
            cursor.execute("INSERT INTO purchase_orders (supplier_id, order_date, status, total_amount) VALUES (?, ?, ?, ?);",
                           (supplier_ref, date_str, po_status, po_amt))
            
            po_id_ref = cursor.lastrowid
            # Log shipment
            dep_date = date_str
            del_date = (current_date + timedelta(days=6)).strftime("%Y-%m-%d")
            cursor.execute("INSERT INTO shipments (po_id, carrier, tracking_number, departure_date, delivery_date) VALUES (?, 'FedEx Cargo', ?, ?, ?);",
                           (po_id_ref, f"TRK-{random.randint(1000, 9999)}", dep_date, del_date))

    # Save orders to DB
    cursor.executemany("INSERT INTO orders (customer_id, salesperson_id, order_date, ship_date, ship_mode, status) VALUES (?, ?, ?, ?, ?, ?);", orders_data)
    cursor.executemany("INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, profit) VALUES (?, ?, ?, ?, ?, ?);", order_items_data)

    # 6. Finance payments linking
    cursor.execute("SELECT order_id, order_date FROM orders;")
    orders_list = cursor.fetchall()
    for o_id, o_date in orders_list:
        # Fetch order revenue
        cursor.execute("SELECT SUM(quantity * unit_price * (1 - discount)) FROM order_items WHERE order_id = ?", (o_id,))
        order_rev = cursor.fetchone()[0] or 0.0
        pay_date = (datetime.strptime(o_date, "%Y-%m-%d") + timedelta(days=random.randint(1, 10))).strftime("%Y-%m-%d")
        pay_method = random.choice(["Wire Transfer", "Credit Card", "ACH", "Net 30"])
        cursor.execute("INSERT INTO payments (order_id, amount, payment_date, payment_method, status) VALUES (?, ?, ?, ?, 'Completed');",
                       (o_id, order_rev, pay_date, pay_method))

    # 7. Employee Attendance (Seed last 10 days for active employees)
    for emp_id in range(1, 7):
        for att_offset in range(10):
            att_date = (base_date - timedelta(days=att_offset)).strftime("%Y-%m-%d")
            att_status = random.choices(["Present", "Absent", "Leave"], weights=[0.9, 0.05, 0.05])[0]
            cursor.execute("INSERT OR IGNORE INTO attendance (employee_id, date, status) VALUES (?, ?, ?);", (emp_id, att_date, att_status))
            
        # Add performance review
        cursor.execute("INSERT INTO performance_reviews (employee_id, review_date, score, notes) VALUES (?, ?, ?, 'Reviews complete, hitting target quotas.');",
                       (emp_id, base_date.strftime("%Y-%m-%d"), random.choice([3, 4, 5])))

    conn.commit()
    conn.close()
    print(f"Enterprise ERP database successfully created and seeded at: {db_path}")

if __name__ == "__main__":
    create_enterprise_database()
