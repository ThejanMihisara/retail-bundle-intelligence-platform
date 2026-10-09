export const pageLoaders = {
  "/auth": () => import("../pages/auth/AuthPage"),
  "/request-access": () => import("../pages/auth/AuthPage"),
  "/dashboard": () => import("../pages/dashboard/DashboardPage"),
  "/upload": () => import("../pages/upload/UploadPage"),
  "/fast-slow": () => import("../pages/fastSlow/FastSlowPage"),
  "/forecast": () => import("../pages/forecast/ForecastPage"),
  "/actual-vs-predicted": () => import("../pages/actualVsPredicted/ActualVsPredictedPage"),
  "/bundles": () => import("../pages/bundles/BundlesPage"),
  "/reports": () => import("../pages/reports/ReportsPage"),
  "/settings": () => import("../pages/settings/SettingsPage"),
};

const preloadedPages = new Set();

export const preloadPage = (path) => {
  const loader = pageLoaders[path];

  if (!loader || preloadedPages.has(path)) {
    return;
  }

  preloadedPages.add(path);
  loader().catch(() => {
    preloadedPages.delete(path);
  });
};
