import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const titles = {
  "/dashboard": "Dashboard",
  "/upload": "Upload Dataset",
  "/fast-slow": "Fast / Slow Products",
  "/forecast": "Demand Prediction",
  "/basket": "Market Basket",
  "/bundles": "Bundle Recommendations",
  "/reports": "Reports",
};

const TopBar = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f172a]">{titles[location.pathname] || "Dashboard"}</h1>
        <p className="text-sm text-[#64748b]">Prototype desktop layout imported from the mobile BundleMind concept</p>
      </div>
      <div className="flex items-center gap-4">
        <input
          className="h-10 w-64 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-5 text-sm text-[#64748b] outline-none"
          placeholder="Search reports, products..."
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2563eb] bg-[#dbeafe] text-sm font-semibold text-[#1d4ed8]">
          {user?.initial || "M"}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
