# BundleMind Frontend

BundleMind is a React dashboard for retail bundle intelligence. It gives teams a clean workspace to upload sales data, identify fast and slow moving products, run forecasts, generate basket rules, manage bundle recommendations, and export reports.

## Features

- Protected authentication flow with login and registration
- Dashboard overview for sales, profit, and model-driven performance signals
- Dataset upload and validation workflow
- Fast/slow product movement analysis
- Forecasting interface for product demand signals
- Basket rule generation and application
- Bundle recommendation review and approval
- Reporting summary with CSV export support

## Tech Stack

- React 18
- Vite
- React Router
- Axios
- Tailwind CSS
- Recharts
- React Hot Toast

## Project Structure

```text
src/
  components/
    layout/      App shell, sidebar, top bar, and protected route
    shared/      Reusable UI components
  config/        API base configuration
  context/       Authentication context
  pages/         Application screens
  services/      API service helpers
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## API Configuration

The frontend currently points to the local backend API:

```js
const BASE_URL = "http://localhost:8000/api";
```

You can update this in `src/config/api.js` when connecting to a deployed backend.

## App Routes

| Route | Description |
| --- | --- |
| `/auth` | Login and registration |
| `/dashboard` | Main analytics dashboard |
| `/upload` | Dataset upload and validation |
| `/fast-slow` | Fast and slow moving product analysis |
| `/forecast` | Forecasting workflow |
| `/basket` | Basket rule generation |
| `/bundles` | Bundle recommendations and approvals |
| `/reports` | Reporting and exports |

## Git Notes

The repository ignores generated and local-only files such as:

- `node_modules/`
- `dist/`
- `.env` files
- debug logs

This keeps commits focused on source code and configuration.
