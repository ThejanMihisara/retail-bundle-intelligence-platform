import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { exportCsv, getSummary } from "../../services/reportService";

const ReportsPage = () => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getSummary().then((res) => setSummary(res.data)).catch((error) => {
      toast.error(error.response?.data?.detail || "Unable to load report summary");
      setSummary(null);
    });
  }, []);

  const downloadCsv = async () => {
    const res = await exportCsv();
    const url = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bundle_report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const bars = (summary?.top_bundles || []).slice(0, 5).map((item, index) => ({ name: index + 1, value: item.expected_lift_pct || 0 }));
  const colors = ["#3b82f6", "#16a34a", "#8b5cf6", "#f59e0b", "#ef4444"];

  return (
    <div className="grid grid-cols-[1fr_1.2fr] gap-6">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Reports & Export</h2>
        <p className="text-sm text-[#64748b]">Download business-ready analytics</p>
        <div className="mx-auto mt-7 w-[380px] space-y-5">
          {[["Demand Forecast Summary", "PDF / Excel export"], ["Market Basket Report", "Rules, confidence, lift"], ["Bundle Recommendation Report", "Promo plan and expected lift"]].map(([title, subtitle]) => (
            <button key={title} className="block w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 text-left hover:bg-gray-50">
              <h3 className="font-bold text-[#0f172a]">{title}</h3>
              <p className="mt-3 text-sm font-semibold text-[#64748b]">{subtitle}</p>
            </button>
          ))}
          <div className="flex gap-5 pt-24">
            <button className="h-12 flex-1 rounded-lg bg-[#2563eb] font-semibold text-white" onClick={() => toast.success("PDF export is being generated...")}>Download PDF</button>
            <button className="h-12 flex-1 rounded-lg bg-[#16a34a] font-semibold text-white" onClick={downloadCsv}>Download CSV</button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Analytics Snapshot</h2>
        <p className="text-sm text-[#64748b]">Key outputs for presentation</p>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#e2e8f0] p-5"><p className="text-sm font-semibold text-[#64748b]">Forecast Accuracy</p><p className="mt-2 text-3xl font-bold text-[#0f172a]">{summary?.forecast_accuracy_pct ?? 0}%</p><p className="text-right text-sm font-semibold text-[#16a34a]">Model</p></div>
          <div className="rounded-xl border border-[#e2e8f0] p-5"><p className="text-sm font-semibold text-[#64748b]">Bundles Approved</p><p className="mt-2 text-3xl font-bold text-[#0f172a]">{summary?.bundles_approved_count || 0}</p><p className="text-right text-sm font-semibold text-[#7c3aed]">Current</p></div>
        </div>
        <div className="mx-auto mt-16 h-56 w-[470px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars}><XAxis dataKey="name" hide /><YAxis hide /><Tooltip /><Bar dataKey="value" radius={[5, 5, 5, 5]}>{bars.map((_, index) => <Cell key={index} fill={colors[index]} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-6 font-semibold text-[#64748b]">Exported reports include charts, product lists, association rules, and bundle actions.</p>
      </div>
    </div>
  );
};

export default ReportsPage;
