import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const titles = {
  "/dashboard": { title: "Executive Dashboard", desc: "Overview of retail sales, predictive metrics, and insights" },
  "/upload": { title: "CSV Data Management", desc: "Upload and validate sales transactions into the MySQL database" },
  "/fast-slow": { title: "Product Movement Analysis", desc: "Identify fast, medium, and slow moving products via Random Forest" },
  "/forecast": { title: "Future Demand Forecast", desc: "Upcoming monthly volume and revenue projections" },
  "/basket": { title: "Model Performance & Insights", desc: "Monitor ML model health, features, and summaries" },
  "/bundles": { title: "Promotional Bundle Recommendations", desc: "Optimize sales bundle recommendations via FP-Growth outputs" },
  "/reports": { title: "Sales & Profit Analytics", desc: "Explore deep historical sales trends, profits, and category metrics" },
};

const TopBar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const current = titles[location.pathname] || { title: "BundleMind Suite", desc: "Supermarket retail intelligence and predictive analytics" };

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-800 bg-slate-900 px-8 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-white">{current.title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{current.desc}</p>
      </div>
      <div className="flex items-center gap-6">
        {/* User Card */}
        <div className="flex items-center gap-3 border-l border-slate-800 pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">{user?.email || "Manager User"}</p>
            <p className="text-[10px] text-slate-400 capitalize font-medium">{user?.role || "Store Manager"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-sm font-semibold text-white shadow-md shadow-emerald-500/10 animate-pulse-slow">
            {user?.initial || "M"}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
