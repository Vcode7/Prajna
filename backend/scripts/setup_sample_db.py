import os
import sqlite3
import random
from datetime import datetime, timedelta

def create_sample_database():
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample_sales.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Remove existing database if it exists to start fresh
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create tables
    cursor.execute("""
    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        city TEXT,
        state TEXT NOT NULL,
        country TEXT NOT NULL,
        segment TEXT CHECK(segment IN ('Consumer', 'Corporate', 'Home Office'))
    );
    """)
    
    cursor.execute("""
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        unit_price REAL NOT NULL,
        cost_price REAL NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE employees (
        employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        title TEXT NOT NULL,
        region TEXT NOT NULL,
        reports_to INTEGER,
        FOREIGN KEY (reports_to) REFERENCES employees(employee_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        employee_id INTEGER,
        order_date TEXT NOT NULL, -- YYYY-MM-DD
        ship_date TEXT,          -- YYYY-MM-DD
        ship_mode TEXT CHECK(ship_mode IN ('Standard Class', 'Second Class', 'First Class', 'Same Day')),
        status TEXT CHECK(status IN ('Shipped', 'Pending', 'Cancelled', 'Delivered')),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE order_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL,
        discount REAL DEFAULT 0.0 CHECK(discount >= 0.0 AND discount <= 0.8),
        profit REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
    """)
    
    # Seed Customers
    first_names = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "John", "Sarah", "Michael", "Emily", "David"]
    last_names = ["Sharma", "Patel", "Kumar", "Reddy", "Joshi", "Smith", "Johnson", "Brown", "Davis", "Wilson"]
    states_cities = [
        ("Karnataka", "Bengaluru"), ("Karnataka", "Mysuru"),
        ("Maharashtra", "Mumbai"), ("Maharashtra", "Pune"),
        ("Tamil Nadu", "Chennai"), ("Tamil Nadu", "Coimbatore"),
        ("Delhi", "New Delhi"),
        ("California", "Los Angeles"), ("California", "San Francisco"),
        ("Texas", "Houston"), ("Texas", "Austin"),
        ("New York", "New York City")
    ]
    segments = ["Consumer", "Corporate", "Home Office"]
    
    customers_data = []
    for i in range(50):
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        email = f"{fname.lower()}.{lname.lower()}{i}@example.com"
        state, city = random.choice(states_cities)
        country = "India" if state in ["Karnataka", "Maharashtra", "Tamil Nadu", "Delhi"] else "United States"
        segment = random.choice(segments)
        customers_data.append((fname, lname, email, city, state, country, segment))
        
    cursor.executemany("""
    INSERT INTO customers (first_name, last_name, email, city, state, country, segment)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, customers_data)
    
    # Seed Employees
    employees_data = [
        ("Rajesh", "Nair", "Sales Director", "APAC", None),
        ("Susan", "Miller", "Sales Manager", "AMER", None),
        ("Karthik", "Rao", "Sales Executive", "APAC", 1),
        ("Anjali", "Deshmukh", "Sales Executive", "APAC", 1),
        ("James", "Wilson", "Sales Executive", "AMER", 2)
    ]
    cursor.executemany("""
    INSERT INTO employees (first_name, last_name, title, region, reports_to)
    VALUES (?, ?, ?, ?, ?);
    """, employees_data)
    
    # Seed Products
    products_list = [
        # Electronics
        ("iPhone 15", "Electronics", "Phones", 999.0, 750.0),
        ("Samsung Galaxy S24", "Electronics", "Phones", 899.0, 680.0),
        ("MacBook Air M3", "Electronics", "Computers", 1199.0, 900.0),
        ("Dell XPS 15", "Electronics", "Computers", 1499.0, 1150.0),
        ("Sony WH-1000XM5", "Electronics", "Accessories", 399.0, 250.0),
        # Furniture
        ("Ergonomic Office Chair", "Furniture", "Chairs", 299.0, 180.0),
        ("Standing Desk", "Furniture", "Tables", 499.0, 320.0),
        ("L-Shaped Sectional Sofa", "Furniture", "Sofas", 1299.0, 850.0),
        ("Wooden Dining Table", "Furniture", "Tables", 799.0, 500.0),
        # Office Supplies
        ("Gel Pens (Pack of 12)", "Office Supplies", "Pens", 15.0, 5.0),
        ("A4 Copy Paper (5 Reams)", "Office Supplies", "Paper", 35.0, 15.0),
        ("Heavy Duty Stapler", "Office Supplies", "Tools", 25.0, 12.0),
        # Clothing
        ("Classic Denim Jacket", "Clothing", "Outerwear", 79.0, 35.0),
        ("Running Shoes", "Clothing", "Footwear", 120.0, 60.0),
        ("Leather Belt", "Clothing", "Accessories", 45.0, 18.0)
    ]
    cursor.executemany("""
    INSERT INTO products (product_name, category, sub_category, unit_price, cost_price)
    VALUES (?, ?, ?, ?, ?);
    """, products_list)
    
    # Seed Orders & Order Items
    # Generate orders over the last 730 days (2 years)
    base_date = datetime.now()
    orders_data = []
    order_items_data = []
    
    ship_modes = ["Standard Class", "Second Class", "First Class", "Same Day"]
    statuses = ["Shipped", "Delivered", "Pending"]
    
    # We want at least 200 orders to have smooth monthly curves
    order_counter = 1
    for day_offset in range(730):
        # Determine number of orders on this day (0 to 3)
        num_orders = random.choices([0, 1, 2, 3], weights=[0.4, 0.4, 0.15, 0.05])[0]
        order_date = base_date - timedelta(days=day_offset)
        order_date_str = order_date.strftime("%Y-%m-%d")
        
        for _ in range(num_orders):
            customer_id = random.randint(1, 50)
            employee_id = random.randint(1, 5)
            ship_offset = random.randint(1, 7)
            ship_date = order_date + timedelta(days=ship_offset)
            ship_date_str = ship_date.strftime("%Y-%m-%d")
            ship_mode = random.choice(ship_modes)
            status = random.choice(statuses)
            
            orders_data.append((customer_id, employee_id, order_date_str, ship_date_str, ship_mode, status))
            
            # 1 to 4 items per order
            num_items = random.randint(1, 4)
            selected_products = random.sample(range(1, len(products_list) + 1), num_items)
            for prod_id in selected_products:
                # Fetch product details
                p_name, p_cat, p_subcat, unit_price, cost_price = products_list[prod_id - 1]
                quantity = random.choices([1, 2, 3, 4, 5], weights=[0.5, 0.3, 0.1, 0.07, 0.03])[0]
                discount = random.choices([0.0, 0.1, 0.2], weights=[0.7, 0.2, 0.1])[0]
                
                selling_price = unit_price * (1 - discount)
                total_revenue = selling_price * quantity
                total_cost = cost_price * quantity
                profit = total_revenue - total_cost
                
                order_items_data.append((order_counter, prod_id, quantity, unit_price, discount, profit))
                
            order_counter += 1
            
    cursor.executemany("""
    INSERT INTO orders (customer_id, employee_id, order_date, ship_date, ship_mode, status)
    VALUES (?, ?, ?, ?, ?, ?);
    """, orders_data)
    
    cursor.executemany("""
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount, profit)
    VALUES (?, ?, ?, ?, ?, ?);
    """, order_items_data)
    
    conn.commit()
    conn.close()
    print(f"Sample database created successfully at: {db_path}")

if __name__ == "__main__":
    create_sample_database()
