# PRAJNA — Enterprise AI Analytics & Machine Learning Platform

PRAJNA (*Predictive Research & Analytics for Judgement, Navigation & Action*) is an enterprise-grade AI analytics and machine learning platform. It empowers teams to connect organizational databases and spreadsheets (CSV, Excel), query metrics using everyday natural language, generate automated visualizations, construct interactive executive dashboards, and train, evaluate, and deploy predictive ML and forecasting models without writing SQL or code.

---

## Table of Contents

1. [Key Architecture & Capabilities](#key-architecture--capabilities)
2. [Prerequisites](#prerequisites)
3. [LLM Integration & Resilient Fallback](#llm-integration--resilient-fallback)
4. [Environment Configuration (.env)](#environment-configuration-env)
5. [Backend Setup & Packaging with uv](#backend-setup--packaging-with-uv)
6. [Database Setup & Seeding](#database-setup--seeding)
7. [Frontend Setup & Build](#frontend-setup--build)
8. [Starting the Application & Port Configuration](#starting-the-application--port-configuration)
9. [Linux Production Deployment Guide](#linux-production-deployment-guide)
10. [Running Backend Tests](#running-backend-tests)
11. [API Endpoint Reference](#api-endpoint-reference)
12. [Troubleshooting & Linux Compatibility](#troubleshooting--linux-compatibility)

---

## Key Architecture & Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRAJNA PLATFORM ARCHITECTURE                  │
└────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────┐          ┌─────────────────────────┐
    │     React 19 + Vite     │          │    Nginx Reverse Proxy   │
    │  (Tailwind 4 + ECharts) │  ─────▶  │   Static Assets + /api  │
    └─────────────────────────┘          └────────────┬────────────┘
                                                      │
                                                      ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │                FastAPI Backend (Uvicorn / Gunicorn)                │
    ├────────────────────────────────────────────────────────────────────┤
    │  • V1 & V2 REST Endpoints (77 routes)                              │
    │  • Natural Language SQL Generator with Self-Correction             │
    │  • Server-Sent Events (SSE) Streaming Execution                    │
    │  • AutoML Pipeline (Classification, Regression, Clustering)        │
    │  • Time-Series Forecasting Engine (Lag-feature auto-selection)     │
    │  • Real-time Model Testing & Registry                              │
    │  • Interactive Dashboard Workspace Engine                          │
    └──────────────────┬───────────────────────────────┬─────────────────┘
                       │                               │
                       ▼                               ▼
    ┌─────────────────────────────────────┐   ┌──────────────────────────┐
    │    Multi-Tier LLM Cascade Engine    │   │  Storage & Data Engines  │
    │  1. Groq API (Primary + 4 Keys)     │   │  • SQLite (ERP & App DB) │
    │  2. Local Ollama Qwen               │   │  • SQLite (Chat History) │
    │  3. Local Ollama Gemma              │   │  • Uploads & Models Dir  │
    │  4. Local Ollama Any Clean Text     │   │  • Joblib Model Binaries │
    └─────────────────────────────────────┘   └──────────────────────────┘
```

- **Natural Language SQL Retrieval**: Translates natural language into SQLite queries with schema validation, query planning, automated zero-row query repair, and SSE streaming execution.
- **Enterprise AutoML Engine**: Automatic problem detection, correlation matrix calculation, feature preprocessing (scaling, imputation, one-hot encoding), training (Random Forest, Gradient Boosting, SVM, MLP, KNN, Ridge, Lasso, K-Means), and model evaluation.
- **Time-Series Forecasting**: Automated date/metric detection from chart configurations, intelligent model selection (Linear Trend, Ridge, Random Forest, Gradient Boosting), and actual vs. forecast overlays.
- **Interactive Visualizations & Dashboards**: Automated heuristic chart recommendations, dynamic Apache ECharts configuration generation, and drag-and-drop dashboard canvas.

---

## Prerequisites

### Operating System
- **Production**: Linux (Ubuntu 20.04+, Debian 11+, RHEL/Rocky Linux 8+, Amazon Linux 2023).
- **Development**: Linux, macOS, or Windows 10/11.

### Software Requirements
- **Python**: 3.10, 3.11, or 3.12 (Python 3.12 recommended).
- **Node.js**: 18.x or 20.x LTS with npm.
- **uv**: Modern, high-performance Python package and virtual environment manager.
  ```bash
  # Install uv on Linux/macOS:
  curl -LsSf https://astral.sh/uv/install.sh | sh

  # Install uv on Windows (PowerShell):
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```
- **SQLite3**: Pre-installed on virtually all modern Linux distributions.
- **Ollama** *(Optional, for offline/local LLM fallback)*:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

---

## LLM Integration & Resilient Fallback

PRAJNA implements a 4-tier fallback hierarchy to guarantee continuous availability even when external API quotas are exhausted or offline:

$$\text{Priority 1: Groq API} \longrightarrow \text{Priority 2: Ollama Qwen} \longrightarrow \text{Priority 3: Ollama Gemma} \longrightarrow \text{Priority 4: Other Ollama Model}$$

1. **Priority 1 — Groq Cloud API**:
   - Uses the primary `GROQ_API_KEY`.
   - If a rate limit (HTTP 429) occurs, PRAJNA's circuit breaker automatically cycles through up to 4 fallback keys (`GROQ_API_KEY_FALLBACK1` through `GROQ_API_KEY_FALLBACK4`).
   - If keys are missing, timeout occurs, or all keys fail, execution automatically falls back to Priority 2.
2. **Priority 2 — Local Ollama Qwen**:
   - Connects to `OLLAMA_BASE_URL` (default: `http://localhost:11434`).
   - Searches for an installed Qwen model (e.g., `qwen2.5:7b`, `qwen3:4b-instruct`).
3. **Priority 3 — Local Ollama Gemma**:
   - If Qwen is unavailable, searches for Gemma models (e.g., `gemma2:9b`, `gemma-4`).
4. **Priority 4 — Other Available Ollama Text Model**:
   - Automatically selects any clean text model installed locally (e.g., `llama3.2`, `mistral`, `phi3`), filtering out non-text models (such as OCR or vision-only models).
   - If no local models are available, raises a clear, descriptive error indicating that neither Groq nor local models could fulfill the request.

---

## Environment Configuration (.env)

### 1. Backend Configuration (`backend/.env`)

Copy the template from `backend/.env.example`:
```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` / `BACKEND_PORT` | `8000` | Port for the FastAPI server to listen on. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of CORS allowed origins. In Linux production, add your server domain or IP. |
| `GROQ_API_KEY` | *(Required for cloud)* | Primary Groq API key (`gsk_...`). |
| `GROQ_API_KEY_FALLBACK1..4` | *(Optional)* | Backup Groq keys for automatic rate-limit rotation. |
| `DEFAULT_MODEL` | `qwen/qwen3.8-27b` | Default Groq model used for generation. |
| `LLM_TEMPERATURE` | `0.0` | Sampling temperature (0.0 for deterministic SQL/analytics). |
| `LLM_MAX_TOKENS` | `4096` | Maximum token budget for LLM completions. |
| `GROQ_TIMEOUT` | `60.0` | Timeout in seconds for Groq API requests. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL of local or remote Ollama server. |
| `OLLAMA_MODEL` | `qwen3:4b-instruct` | Preferred local Ollama model. |
| `OLLAMA_TIMEOUT` | *(None / empty)* | Timeout for Ollama requests (empty disables timeout, recommended for CPU/GPU inference). |
| `DATABASE_URL` | `sqlite:///backend/data/enterprise_erp.db` | SQLAlchemy SQLite connection string for datasets & ML entities. |
| `HISTORY_DATABASE_URL` | `sqlite:///backend/data/history.db` | SQLAlchemy SQLite connection string for chat & SQL query history. |
| `SQL_EXECUTION_TIMEOUT` | `30.0` | Safety timeout in seconds for executing analytical queries. |
| `MAX_ROWS_LIMIT` | `1000` | Safety limit on rows returned per query. |
| `USE_AI_CHARTS` | `false` | Whether to engage LLM for automated visualization formatting. |

### 2. Frontend Configuration (`frontend/.env`)

Copy the template from `frontend/.env.example`:
```bash
cp frontend/.env.example frontend/.env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_PORT` | `5173` | Frontend local development server port. |
| `VITE_HOST` | `0.0.0.0` | Host interface for Vite dev server. |
| `VITE_BACKEND_HOST` | `127.0.0.1` | Target backend host address for Vite proxy. |
| `VITE_BACKEND_PORT` | `8000` | Target backend port for Vite proxy. |
| `VITE_BACKEND_URL` | `http://127.0.0.1:8000` | Full backend URL used by dev proxy. |
| `VITE_API_BASE` | `/api` | Base path for frontend API calls (`/api` when proxied, or full URL e.g. `http://server:8000/api`). |

---

## Backend Setup & Packaging with uv

The backend is fully packaged using standard `pyproject.toml` and locked with `uv.lock` for 100% reproducible Linux deployments.

### 1. Install Dependencies with `uv`

From the repository root:

```bash
# Option A: Standard environment with all dependencies
uv sync

# Option B: Production environment including Gunicorn (Linux servers)
uv sync --extra production

# Option C: Include development and testing tools (pytest)
uv sync --extra dev --extra production
```

`uv sync` will automatically create a `.venv` virtual environment in the project directory and install all locked dependencies within seconds.

### 2. Activate the Virtual Environment

```bash
# On Linux / macOS:
source .venv/bin/activate

# On Windows:
.venv\Scripts\activate
```

*(Note: You can also execute commands directly via `uv run <command>` without manual activation).*

---

## Database Setup & Seeding

Initialize the SQLite operational databases and optional demonstration datasets:

```bash
# 1. Initialize the Enterprise ERP database (Sales, Customers, Products, Inventory, Finance, HR)
uv run python backend/scripts/setup_enterprise_db.py

# 2. (Optional) Initialize the Sample Sales database
uv run python backend/scripts/setup_sample_db.py

# 3. (Optional) Seed the Manufacturing demo project with pre-computed charts, ML experiments, and deployments
uv run python backend/scripts/seed_manufacturing_data.py
```

All SQLite database files and uploaded artifacts will reside in `backend/data/`. Ensure write permissions are granted to this directory on Linux:
```bash
mkdir -p backend/data/uploads backend/data/models
chmod -R 775 backend/data
```

---

## Frontend Setup & Build

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Build for Production
```bash
npm run build
```
This compiles the application and generates the production-optimized static bundle in `frontend/dist/`.

---

## Starting the Application & Port Configuration

### Development Mode

**Terminal 1 — Backend:**
```bash
# Run with uvicorn via uv (defaults to port 8000)
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### How to Change Ports

1. **Changing Backend Port (e.g. to 9000)**:
   - In `backend/.env`, set:
     ```bash
     PORT=9000
     BACKEND_PORT=9000
     ```
   - In `frontend/.env`, update the target:
     ```bash
     VITE_BACKEND_PORT=9000
     VITE_BACKEND_URL=http://127.0.0.1:9000
     ```
   - Start backend:
     ```bash
     uv run uvicorn backend.main:app --host 0.0.0.0 --port 9000
     ```

2. **Changing Frontend Port (e.g. to 3000)**:
   - In `frontend/.env`, set:
     ```bash
     VITE_PORT=3000
     ```
   - In `backend/.env`, add the new origin to `ALLOWED_ORIGINS`:
     ```bash
     ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
     ```
   - Start frontend:
     ```bash
     npm run dev -- --port 3000
     ```

---

## Linux Production Deployment Guide

In Linux production, deploy using **Systemd** managing **Gunicorn + Uvicorn workers** behind an **Nginx** reverse proxy that serves the built frontend static assets.

```
 Internet ──▶ Nginx (:80/:443) ──┬──▶ /        ──▶ Static Files (/var/www/prajna/dist)
                                 └──▶ /api/... ──▶ Gunicorn ASGI (:8000)
```

### Step 1: Deploy Project Code & Build

Assume deployment to `/var/www/prajna`:
```bash
# Clone or copy project to production server
sudo mkdir -p /var/www/prajna
sudo chown -R $USER:$USER /var/www/prajna
cd /var/www/prajna

# Install backend dependencies with uv
uv sync --extra production

# Setup environment files
cp backend/.env.example backend/.env
# (Edit backend/.env with your production keys, domain, and settings)

# Initialize databases
uv run python backend/scripts/setup_enterprise_db.py

# Ensure write permissions on data directory
mkdir -p backend/data/uploads backend/data/models
chmod -R 775 backend/data

# Build frontend
cd frontend
cp .env.example .env
npm install
npm run build
cd ..
```

### Step 2: Configure Systemd Service

Create `/etc/systemd/system/prajna-backend.service`:
```ini
[Unit]
Description=PRAJNA AI Analytics Backend API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/prajna
Environment="PATH=/var/www/prajna/.venv/bin:/usr/local/bin:/usr/bin"
EnvironmentFile=/var/www/prajna/backend/.env
ExecStart=/var/www/prajna/.venv/bin/gunicorn \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    backend.main:app \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /var/log/prajna/access.log \
    --error-logfile /var/log/prajna/error.log

Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo mkdir -p /var/log/prajna
sudo chown -R www-data:www-data /var/log/prajna
sudo chown -R www-data:www-data /var/www/prajna/backend/data
sudo systemctl daemon-reload
sudo systemctl enable prajna-backend
sudo systemctl start prajna-backend
sudo systemctl status prajna-backend
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/prajna`:
```nginx
server {
    listen 80;
    server_name your-server-ip-or-domain.com;

    client_max_body_size 100M;

    # Frontend Static Files
    location / {
        root /var/www/prajna/frontend/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API & SSE Streaming
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Crucial for SSE Streaming (chat & SQL repair responses):
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # API Root Health Check
    location /api-health {
        proxy_pass http://127.0.0.1:8000/;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/prajna /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Running Backend Tests

The project includes an extensive test suite verifying all 77 API routes across V1 and V2, error handling, edge cases, and ML workflows:

```bash
# Run complete test suite (84 tests)
uv run pytest backend/tests

# Run tests with detailed output
uv run pytest backend/tests -v

# Run endpoint-specific test suite
uv run pytest backend/tests/test_all_endpoints.py -v
```

All 84 tests pass with 100% pass rate.

---

## API Endpoint Reference

The API is fully documented interactively at `/docs` (Swagger UI) and `/redoc` (ReDoc).

### Core V1 Endpoints (`/api`)
- `POST /api/chat`: Natural language SQL conversion, planning, and execution with SSE streaming.
- `POST /api/query`: Direct SQL execution with safety validation.
- `POST /api/query/execute`: Structured SQL execution endpoint.
- `POST /api/repair`: Automatic error diagnostics and SQL query self-repair.
- `POST /api/insights`: Natural language insights generated for SQL query results.
- `GET  /api/history`: Retrieval of historical query sessions.
- `DELETE /api/history`: Clear query history.
- `GET  /api/schema`: Inspect database tables, columns, and relationships.
- `GET  /api/health`: Health status and connectivity report.

### Core V2 Endpoints (`/api`)
- **Projects**:
  - `GET /api/projects`: List all active projects.
  - `GET /api/projects/{id}`: Detailed project information.
  - `GET /api/projects/{id}/tree`: Complete entity hierarchy (datasets, charts, models, deployments).
- **Datasets**:
  - `POST /api/datasets/upload`: Upload single-sheet or multi-sheet CSV/Excel files with automatic data profiling.
  - `GET  /api/datasets`: List uploaded dataset sessions.
  - `GET  /api/datasets/{id}`: Dataset metadata, columns, and profile.
  - `GET  /api/datasets/{id}/preview`: Paginated row preview.
  - `DELETE /api/datasets/{id}`: Delete dataset session and disk files.
- **Visualizations**:
  - `POST /api/visualizations/recommend`: Heuristic chart recommendations based on data types.
  - `POST /api/visualizations/generate`: Automated Apache ECharts configuration generation.
  - `POST /api/visualizations`: Save visualization widget.
  - `GET  /api/visualizations/dataset/{id}`: List saved visualizations for a dataset.
  - `PUT  /api/visualizations/{id}`: Update visualization settings.
  - `DELETE /api/visualizations/{id}`: Delete visualization.
- **AutoML & Training Engine**:
  - `GET  /api/ml/tasks`: Supported problem types and algorithm catalog.
  - `POST /api/ml/analyze`: Problem type detection, target correlation, and feature ranking.
  - `POST /api/ml/train`: Model training, validation, and evaluation pipeline.
  - `GET  /api/ml/experiments/dataset/{id}`: List experiments for a dataset.
  - `GET  /api/ml/experiments/{id}`: Experiment scorecards, metrics, and confusion matrix.
  - `POST /api/ml/experiments/{id}/deploy`: Promote trained experiment to deployed model registry.
- **Time-Series Forecasting**:
  - `POST /api/forecasting/detect`: Detect time-series feasibility from saved visualization metadata.
  - `POST /api/forecasting/train`: Train forecasting model with lag feature engineering.
  - `POST /api/forecasting/forecast`: Generate multi-step forecast with actual vs. predicted intervals.
- **Model Testing & Deployments**:
  - `GET  /api/deployments`: List active deployed models.
  - `GET  /api/deployments/{id}`: Deployment metadata and status.
  - `POST /api/deployments/{id}/predict`: Single-record real-time inference.
  - `POST /api/deployments/{id}/test-batch`: Batch file testing and validation.
  - `POST /api/deployments/{id}/insights`: AI-generated model performance review.
  - `GET  /api/deployments/{id}/download`: Download packaged `.joblib` model artifact bundle.
  - `PUT  /api/deployments/{id}`: Update deployment status.
  - `DELETE /api/deployments/{id}`: Remove deployed model.
- **Dashboards**:
  - `POST /api/dashboards`: Create interactive dashboard canvas.
  - `GET  /api/dashboards`: List dashboards.
  - `GET  /api/dashboards/{id}`: Dashboard cards, layouts, and theme.
  - `PUT  /api/dashboards/{id}`: Update cards, positions, and filters.
  - `DELETE /api/dashboards/{id}`: Delete dashboard.
  - `POST /api/dashboards/{id}/export`: Export dashboard layout and data snapshot.

---

## Troubleshooting & Linux Compatibility

### 1. SQLite Concurrent Access on Linux
In production with multiple Gunicorn worker processes (`-w 4`), SQLite may encounter concurrency contention if database writes occur simultaneously.
- **Solution**: Enable Write-Ahead Logging (WAL) on your SQLite databases:
  ```bash
  sqlite3 backend/data/enterprise_erp.db "PRAGMA journal_mode=WAL;"
  sqlite3 backend/data/history.db "PRAGMA journal_mode=WAL;"
  ```
  WAL mode enables concurrent readers while writing, significantly improving throughput on Linux.

### 2. File Permissions for Uploads and Trained Models
If file uploads fail with `Permission Denied` (HTTP 500):
```bash
sudo chown -R www-data:www-data /var/www/prajna/backend/data
sudo chmod -R 775 /var/www/prajna/backend/data
```

### 3. Server-Sent Events (SSE) Buffering in Nginx
If LLM responses or SQL self-correction streams appear delayed or dump all at once:
- Ensure `proxy_buffering off;` and `proxy_cache off;` are configured in your Nginx `/api/` location block.
- Ensure `X-Accel-Buffering: no` header is handled by Nginx.

### 4. Ollama Service Setup on Linux
To run Ollama as a managed background service:
```bash
# Check if Ollama service is active
systemctl status ollama

# Pull required models
ollama pull qwen2.5:7b
ollama pull gemma2:9b
```
Ensure Ollama is accessible by the backend user at `http://127.0.0.1:11434`.

### 5. Floating Point JSON Compliance (`NaN` / `Infinity`)
Starlette `JSONResponse` rejects non-standard `NaN` and `Infinity` floating point values. PRAJNA includes a recursive `sanitize_for_json()` helper that automatically converts out-of-range floats to `null` (`None`) and safely preserves booleans, preventing serialization errors in ML metrics.

---

## License

Internal Enterprise Analytics Platform. All rights reserved.
