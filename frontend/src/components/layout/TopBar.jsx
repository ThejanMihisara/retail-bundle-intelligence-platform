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
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-8 shadow-sm/50">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{current.title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{current.desc}</p>
      </div>
      <div className="flex items-center gap-6">
        {/* Search placeholder */}
        <div className="relative hidden md:block">
          <input
            className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-600 placeholder-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-all"
            placeholder="Search transactions, products..."
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-700">{user?.email || "Manager User"}</p>
            <p className="text-[10px] text-slate-400 capitalize font-medium">{user?.role || "Store Manager"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-sm font-semibold text-white shadow-md shadow-emerald-500/10">
            {user?.initial || "M"}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
