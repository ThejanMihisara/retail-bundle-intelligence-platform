import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";
import StatCard from "../../components/shared/StatCard";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { getDashboardStats } from "../../services/reportService";
import { useAuth } from "../../context/AuthContext";

const ChartCard = ({ title, subtitle, data }) => (
  <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-[#0f172a]">{title}</h2>
    <p className="text-sm text-[#64748b]">{subtitle}</p>
    <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["dataMin - 30", "dataMax + 30"]} />
          <Tooltip />
          <Line dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "white", stroke: "#2563eb", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    getDashboardStats()
      .then((res) => setStats(res.data))
      .catch((error) => toast.error(error.response?.data?.detail || "Unable to load dashboard stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  const chartData = (stats?.monthly_patterns || []).map((item) => ({
    label: item.month_name || item.month,
    value: Math.round((item.support || 0) * 10000),
  }));
  const focusRows = stats?.recommended_focus || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-6">
        {isAdmin ? (
          <>
            <StatCard label="Products" number={stats?.products_count ?? 0} trend="Model" />
            <StatCard label="Forecasts" number={stats?.forecasts_count ?? 0} trend="Ready" />
            <StatCard label="Alerts" number={stats?.alerts_count ?? 0} trend="Slow" trendColor="red" />
            <StatCard label="New Bundles" number={stats?.new_bundles_count ?? 0} trend="Artifact" />
          </>
        ) : (
          <>
            <StatCard label="Products" number={stats?.products_count ?? 0} trend="Model" />
            <StatCard label="Revenue" number={Math.round((stats?.total_revenue || 0) / 1000)} trend="K" />
            <StatCard label="Alerts" number={stats?.alerts_count ?? 0} trend="Needs review" trendColor="red" />
            <StatCard label="Bundle Ideas" number={stats?.new_bundles_count ?? 0} trend="New" trendColor="purple" />
          </>
        )}
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <ChartCard title={isAdmin ? "Sales & Profit Overview" : "Store Performance"} subtitle={isAdmin ? "Model monthly pattern support" : "Manager view with model demand signals"} data={chartData} />
        {isAdmin ? (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0f172a]">Quick Actions</h2>
            <p className="text-sm text-[#64748b]">Admin workflow shortcuts</p>
            <button className="mt-5 h-11 w-full rounded-lg bg-[#2563eb] font-semibold text-white" onClick={() => toast("User management coming soon")}>Manage Users</button>
            <button className="mt-3 h-11 w-full rounded-lg bg-[#16a34a] font-semibold text-white" onClick={() => navigate("/upload")}>Upload Data</button>
            <button className="mt-3 h-11 w-full rounded-lg bg-[#7c3aed] font-semibold text-white" onClick={() => navigate("/reports")}>View Reports</button>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0f172a]">Tasks</h2>
            <p className="text-sm text-[#64748b]">Today</p>
            <button className="mt-3 block w-full rounded-lg border border-[#f59e0b] bg-[#fef9c3] p-4 text-left font-semibold text-[#0f172a]" onClick={() => navigate("/fast-slow")}>Review slow movers</button>
            <button className="mt-3 block w-full rounded-lg border border-[#22c55e] bg-[#dcfce7] p-4 text-left font-semibold text-[#0f172a]" onClick={() => navigate("/bundles")}>Approve bundle</button>
            <button className="mt-3 block w-full rounded-lg border border-[#3b82f6] bg-[#dbeafe] p-4 text-left font-semibold text-[#0f172a]" onClick={() => navigate("/reports")}>Export forecast</button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">{isAdmin ? "Recent System Activity" : "Recommended Focus"}</h2>
        <p className="text-sm text-[#64748b]">{isAdmin ? "Latest uploads and model runs" : "High-impact retail actions"}</p>
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead className="rounded-lg bg-[#f8fafc] text-[#64748b]">
            <tr>
              {(isAdmin ? ["Activity", "Owner", "Status", "Time"] : ["Item", "Reason", "Action"]).map((head) => (
                <th key={head} className="border border-[#e2e8f0] px-4 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(isAdmin ? stats?.recent_activity || [] : focusRows).map((row, index) => (
              <tr key={index} className="font-semibold text-[#0f172a]">
                {isAdmin ? (
                  <>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.activity}</td>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.owner}</td>
                    <td className="border border-[#e2e8f0] px-4 py-3 text-[#16a34a]">{row.status}</td>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.time}</td>
                  </>
                ) : (
                  <>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.item}</td>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.reason}</td>
                    <td className="border border-[#e2e8f0] px-4 py-3">{row.action}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;
