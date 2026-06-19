import { NavLink } from "react-router-dom";

const navItems = [
  ["Dashboard", "/dashboard"],
  ["Upload Data", "/upload"],
  ["Fast / Slow", "/fast-slow"],
  ["Forecast", "/forecast"],
  ["Market Basket", "/basket"],
  ["Bundles", "/bundles"],
  ["Reports", "/reports"],
];

const Sidebar = () => (
  <aside className="fixed left-0 top-0 h-screen w-[240px] bg-[#0f172a] px-4 py-6">
    <div className="mb-8 px-2">
      <div className="text-2xl font-bold text-white">BundleMind</div>
      <div className="mt-2 text-sm text-[#94a3b8]">Retail intelligence suite</div>
    </div>
    <nav className="space-y-2">
      {navItems.map(([label, path]) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `mx-0 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${
              isActive ? "bg-[#2563eb] text-white" : "text-[#94a3b8] hover:bg-[#1e293b] hover:text-white"
            }`
          }
        >
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
          {label}
        </NavLink>
      ))}
    </nav>
  </aside>
);

export default Sidebar;
