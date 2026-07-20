import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getCurrentUser } from "../../services/userManagementService";
import { BrandMark } from "../shared/BrandLogo";

const titles = {
  "/dashboard": { title: "Dashboard", desc: "Overview of store sales, predictive analytics, and retail intelligence insights" },
  "/upload": { title: "CSV Data Management", desc: "Upload and validate sales transactions into the MySQL database" },
  "/fast-slow": { title: "Product Velocity Analytics", desc: "Identify fast, medium, and slow moving products via Random Forest" },
  "/forecast": { title: "Future Demand Forecast", desc: "Upcoming monthly volume and revenue projections" },
  "/basket": { title: "Model Performance & Insights", desc: "Monitor ML model health, features, and summaries" },
  "/bundles": { title: "Promotional Bundle Recommendations", desc: "Optimize sales bundle recommendations via FP-Growth outputs" },
  "/reports": { title: "Sales Analytics & Reports", desc: "Detailed ledger of store transactions, product rankings, and chronological revenue patterns" },
  "/actual-vs-predicted": { title: "Actual vs Predicted Analysis", desc: "Compare uploaded sales results against saved model predictions" },
};

/* ── Theme Toggle Icon ───────────────────────────────── */
const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const TopBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const current = titles[location.pathname] || { title: "BundleMind Settings", desc: "Supermarket retail intelligence and predictive analytics" };
  const displayUser = profile || user;
  const displayName = displayUser?.full_name || "User";
  const displayRole = displayUser?.role || "manager";

  useEffect(() => {
    getCurrentUser()
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, [user?.email]);

  return (
    <header
      className="sticky top-0 z-20 flex h-[70px] items-center justify-between px-8"
      style={{
        background: 'var(--topbar-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--topbar-border)',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Left — Title */}
      <div>
        <h2 className="text-base font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {current.title}
        </h2>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{current.desc}</p>
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-3">

        {/* ── Theme Toggle ── */}
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* ── Divider ── */}
        <div className="w-px h-7" style={{ background: 'var(--divider)' }} />

        {/* ── User card ── */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
            <p className="text-[10px] capitalize font-medium" style={{ color: 'var(--accent-green-text)' }}>{displayRole}</p>
          </div>
          <BrandMark size="sm" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
