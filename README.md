<div align="center">

# BundleMind

### Retail analytics platform for smarter bundles, forecasts, product movement analysis, and business reports.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=ffffff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=ffffff)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=ffffff)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=ffffff)
![Python](https://img.shields.io/badge/Python-ML_Analytics-3776AB?style=for-the-badge&logo=python&logoColor=ffffff)

</div>

BundleMind is a full-stack retail intelligence system that helps teams upload sales transaction CSVs, analyze fast and slow moving products, generate market basket rules, recommend product bundles, forecast demand, approve bundles, and export business reports.

This repository contains both the **frontend** and **backend** in one place.

---

## Workflow

```text
Upload data -> Analyze product movement -> Forecast demand -> Generate basket rules -> Recommend bundles -> Approve bundles -> Export reports
```

---

## Main Features

| Area | What it does |
| --- | --- |
| Authentication | User registration, login, protected routes, JWT sessions, and admin approval |
| Dashboard | Sales, profit, performance, and model status overview |
| Sales Uploads | Validate and save retail transaction CSVs for analytics workflows |
| Fast/Slow Analysis | Identify product movement patterns and suggest inventory actions |
| Forecasting | Run product-level demand forecasting workflows |
| Basket Analysis | Generate and apply market basket rules |
| Bundle Recommendations | Review and approve recommended product bundles |
| Reports | View summaries and export CSV-ready reports |
| Admin Management | Approve users and manage user access |

---

## Tech Stack

### Frontend

| Layer | Tools |
| --- | --- |
| UI | React 18, Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| HTTP Client | Axios |
| Charts | Recharts |
| Notifications | React Hot Toast |

### Backend

| Layer | Tools |
| --- | --- |
| API | FastAPI |
| Database ORM | SQLAlchemy |
| Database | MySQL with PyMySQL |
| Validation | Pydantic |
| Data Processing | Pandas, NumPy |
| Machine Learning | scikit-learn, mlxtend, Prophet |
| Authentication | JWT using `python-jose` |
| Password Security | `passlib` and `bcrypt` |

---

## Repository Structure

```text
BundleMind/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/        # App shell, sidebar, top bar, protected routes
│   │   │   └── shared/        # Reusable UI components
│   │   ├── config/            # API base configuration
│   │   ├── context/           # Authentication state and session helpers
│   │   ├── pages/             # Route-level application screens
│   │   └── services/          # API request helpers
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── main.py                # FastAPI app, middleware, router registration
│   ├── database.py            # Database engine, session, and table initialization
│   ├── requirements.txt       # Python dependencies
│   ├── routers/               # API route modules
│   ├── services/              # Business logic and ML artifact loading
│   ├── schemas/               # Pydantic request/response models
│   ├── models/                # SQLAlchemy database models
│   ├── ml/                    # ML helper code
│   ├── ml_models/             # Trained model artifacts
│   └── utils/                 # Shared utilities
│
├── README.md
└── .gitignore
```

> If your folders use different names, update the `frontend/` and `backend/` paths in this README.

---

## Getting Started

### Prerequisites

Install these before running the project:

- Node.js and npm
- Python 3.10+
- MySQL Server
- Git

---

## Backend Setup

### 1. Go to the backend folder

```bash
cd backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Create the MySQL database

Open MySQL and run:

```sql
CREATE DATABASE bundlemind_db;
```

### 5. Configure environment variables

Create a `.env` file inside the `backend/` folder.

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update the `.env` file:

```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/bundlemind_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ML_MODELS_DIR=./ml_models
UPLOAD_DIR=./uploads
```

### 6. Add ML artifacts

Place trained model files inside:

```text
backend/ml_models/
```

Required:

```text
bundle_recommendation_model.pkl
```

Optional:

```text
fast_slow_product_model.pkl
association_rules.pkl
bundle_recommendations.pkl
frequent_itemsets.pkl
product_mapping.pkl
category_mapping.pkl
analysis_summary.pkl
transaction_encoder.pkl
```

### 7. Run the backend API

```bash
uvicorn main:app --reload
```

Backend API:

```text
http://127.0.0.1:8000
```

Swagger API docs:

```text
http://127.0.0.1:8000/docs
```

---

## Frontend Setup

Open a new terminal.

### 1. Go to the frontend folder

```bash
cd frontend
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure backend API URL

The frontend should connect to the backend API:

```text
http://localhost:8000/api
```

Update it in:

```text
frontend/src/config/api.js
```

Example:

```js
const BASE_URL = "http://localhost:8000/api";
```

### 4. Start the frontend development server

```bash
npm run dev
```

The frontend will run on the local Vite URL shown in your terminal, usually:

```text
http://localhost:5173
```

---

## Available Scripts

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |

### Backend

| Command | Description |
| --- | --- |
| `uvicorn main:app --reload` | Run the FastAPI development server |
| `pip install -r requirements.txt` | Install backend dependencies |
| `python -m venv .venv` | Create a Python virtual environment |

---

## App Routes

| Route | Screen |
| --- | --- |
| `/auth` | Login and registration |
| `/dashboard` | Main analytics dashboard |
| `/upload` | Sales transaction CSV upload and validation |
| `/fast-slow` | Fast and slow moving product analysis |
| `/forecast` | Forecasting workflow |
| `/basket` | Basket rule generation |
| `/bundles` | Bundle recommendations and approvals |
| `/reports` | Reporting and exports |

---

## API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/` | Health check |
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive a JWT token |
| POST | `/api/auth/admin/approve/{user_id}` | Approve a user |
| GET | `/api/auth/users` | List users |
| POST | `/api/fast-slow/analyze` | Analyze fast/slow moving products |
| GET | `/api/fast-slow/results/{dataset_id}` | Get movement results by dataset |
| GET | `/api/fast-slow/results` | Get all movement results |
| POST | `/api/forecast/run` | Run product forecast |
| GET | `/api/forecast/products/{dataset_id}` | List forecastable products |
| GET | `/api/forecast/products` | List all forecastable products |
| POST | `/api/basket/generate` | Generate basket rules |
| GET | `/api/basket/rules/{dataset_id}` | Get basket rules by dataset |
| GET | `/api/basket/rules` | Get all basket rules |
| POST | `/api/basket/apply` | Apply basket rules |
| GET | `/api/bundles/recommendations/{dataset_id}` | Get bundle recommendations |
| GET | `/api/bundles/recommendations` | Get all bundle recommendations |
| POST | `/api/bundles/approve/{bundle_id}` | Approve a bundle |
| GET | `/api/bundles/approved` | List approved bundles |
| GET | `/api/reports/summary/{dataset_id}` | Get report summary |
| GET | `/api/reports/summary` | Get overall report summary |
| GET | `/api/reports/export/csv/{dataset_id}` | Export bundle report CSV |
| GET | `/api/reports/export/csv` | Export overall bundle report CSV |
| GET | `/api/dashboard/stats` | Get dashboard stats |
| GET | `/api/dashboard/models/status` | Get loaded model artifact status |

---

## Default Admin Account

On startup, the backend creates an admin account if one does not already exist.

```text
Email: admin@bundlemind.com
Password: Admin@1234
```

Change this password after first login and use a strong `SECRET_KEY` in production.

---

## Quick Health Check

After starting the backend, test it with:

```bash
curl http://127.0.0.1:8000/
```

Expected response:

```json
{
  "message": "BundleMind API is running"
}
```

---

## Production Notes

Before deployment:

- Use a strong `SECRET_KEY`.
- Do not commit `.env` files.
- Update the frontend API base URL to your deployed backend URL.
- Keep large trained ML model files out of Git unless the team intentionally tracks them.
- Use HTTPS in production.
- Change the default admin password.
- Configure MySQL credentials securely.
- Check CORS settings in the backend for your frontend domain.

---

## Git Hygiene

Add generated files, secrets, and local-only files to `.gitignore`.

Recommended:

```text
# Frontend
frontend/node_modules/
frontend/dist/

# Backend
backend/.venv/
backend/__pycache__/
backend/uploads/
backend/.env

# Environment files
.env
.env.*

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# OS / Editor
.DS_Store
.vscode/
.idea/
```

---

<div align="center">

Built for clear retail decisions, from raw sales data to approved bundle recommendations.

</div>
