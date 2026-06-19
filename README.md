<div align="center">

# BundleMind Frontend

### Retail analytics dashboard for smarter bundles, forecasts, and product decisions.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=ffffff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=ffffff)
![Axios](https://img.shields.io/badge/Axios-API-5A29E4?style=for-the-badge&logo=axios&logoColor=ffffff)

</div>

BundleMind is a modern React dashboard for retail bundle intelligence. It gives teams a clean workspace to upload sales data, identify fast and slow moving products, run forecasts, generate basket rules, review bundle recommendations, and export business reports.

---

## Preview

```text
Upload data -> Analyze movement -> Forecast demand -> Generate basket rules -> Approve bundles -> Export reports
```

## Highlights

| Area | What it does |
| --- | --- |
| Authentication | Login, registration, protected routes, and token based sessions |
| Dashboard | Sales, profit, and performance signals in one overview |
| Uploads | Dataset validation and save workflow |
| Fast/Slow Analysis | Identify product movement patterns |
| Forecasting | Run demand forecasting workflows |
| Basket Rules | Generate and apply basket based rules |
| Bundles | Review and approve recommended product bundles |
| Reports | View summaries and export CSV reports |

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18, Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| HTTP | Axios |
| Charts | Recharts |
| Notifications | React Hot Toast |

## Folder Structure

```text
bundlemind-frontend/
  src/
    components/
      layout/      App shell, sidebar, top bar, protected routes
      shared/      Reusable UI components
    config/        API base configuration
    context/       Authentication state and session helpers
    pages/         Route-level application screens
    services/      API request helpers
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

The app will run on the local Vite development URL shown in your terminal.

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |

## API Configuration

The frontend currently points to a local backend API:

```js
const BASE_URL = "http://localhost:8000/api";
```

You can update the backend URL in:

```text
src/config/api.js
```

## App Routes

| Route | Screen |
| --- | --- |
| `/auth` | Login and registration |
| `/dashboard` | Main analytics dashboard |
| `/upload` | Dataset upload and validation |
| `/fast-slow` | Fast and slow moving product analysis |
| `/forecast` | Forecasting workflow |
| `/basket` | Basket rule generation |
| `/bundles` | Bundle recommendations and approvals |
| `/reports` | Reporting and exports |

## Git Hygiene

This project keeps generated and local-only files out of version control:

```text
node_modules/
dist/
.env
.env.*
debug logs
```

## Commit Suggestion

If you are splitting the first push into multiple commits, this README fits nicely with the initial project setup commit:

```bash
git add README.md .gitignore package.json package-lock.json index.html vite.config.js postcss.config.js tailwind.config.js src/index.css src/main.jsx
git commit -m "Initialize Vite React frontend"
```

---

<div align="center">

Built for clear retail decisions, from raw sales data to approved bundle recommendations.

</div>
