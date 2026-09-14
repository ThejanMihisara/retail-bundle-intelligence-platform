import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import { pageLoaders } from "./routes/pageLoaders";

const AuthPage = lazy(pageLoaders["/auth"]);
const BundlesPage = lazy(pageLoaders["/bundles"]);
const DashboardPage = lazy(pageLoaders["/dashboard"]);
const FastSlowPage = lazy(pageLoaders["/fast-slow"]);
const ForecastPage = lazy(pageLoaders["/forecast"]);
const ReportsPage = lazy(pageLoaders["/reports"]);
const UploadPage = lazy(pageLoaders["/upload"]);
const ActualVsPredictedPage = lazy(pageLoaders["/actual-vs-predicted"]);
const SettingsPage = lazy(pageLoaders["/settings"]);

const protectedPage = (page) => (
  <ProtectedRoute>
    <AppLayout>{page}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <Suspense fallback={<LoadingSpinner label="Loading page..." fullPage />}>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/request-access" element={<AuthPage initialTab="request" />} />
      <Route path="/dashboard" element={protectedPage(<DashboardPage />)} />
      <Route path="/upload" element={protectedPage(<UploadPage />)} />
      <Route path="/fast-slow" element={protectedPage(<FastSlowPage />)} />
      <Route path="/forecast" element={protectedPage(<ForecastPage />)} />
      <Route path="/actual-vs-predicted" element={protectedPage(<ActualVsPredictedPage />)} />
      <Route path="/basket" element={<Navigate to="/dashboard" replace />} />
      <Route path="/bundles" element={protectedPage(<BundlesPage />)} />
      <Route path="/reports" element={protectedPage(<ReportsPage />)} />
      <Route path="/settings" element={protectedPage(<SettingsPage />)} />
    </Routes>
  </Suspense>
);

export default App;
