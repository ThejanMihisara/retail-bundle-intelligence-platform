import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AuthPage from "./pages/auth/AuthPage";
import BundlesPage from "./pages/bundles/BundlesPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import FastSlowPage from "./pages/fastSlow/FastSlowPage";
import ForecastPage from "./pages/forecast/ForecastPage";
import ReportsPage from "./pages/reports/ReportsPage";
import UploadPage from "./pages/upload/UploadPage";
import ActualVsPredictedPage from "./pages/actualVsPredicted/ActualVsPredictedPage";
import SettingsPage from "./pages/settings/SettingsPage";

const protectedPage = (page) => (
  <ProtectedRoute>
    <AppLayout>{page}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
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
);

export default App;
