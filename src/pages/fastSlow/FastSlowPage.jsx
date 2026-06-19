import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { analyzeFastSlow } from "../../services/fastSlowService";

const FastSlowPage = () => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ category: "", dateRange: "Last 90 days" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    run();
  }, []);

  const categories = useMemo(() => [...new Set(products.map((item) => item.category).filter(Boolean))], [products]);
  const chartData = products.slice(0, 6).map((item) => ({ name: item.product_name, quantity: item.total_quantity_sold, label: item.velocity_label }));

  const run = async () => {
    setLoading(true);
    try {
      const res = await analyzeFastSlow({
        category_filter: filters.category || null,
      });
      setProducts(res.data || []);
      toast.success("Product analysis complete");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[2fr_0.9fr] gap-6">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0f172a]">Product Performance Analysis</h2>
          <p className="text-sm text-[#64748b]">Fast-moving vs slow-moving inventory</p>
          <div className="mt-8 h-64">
            {products.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="quantity" radius={[6, 6, 6, 6]}>
                    {chartData.map((entry) => <Cell key={entry.name} fill={entry.label === "Slow" ? "#ef4444" : "#16a34a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-[#64748b]">Run analysis to view product velocity</div>
            )}
          </div>
          <p className="mt-4 font-semibold text-[#64748b]">Fast-moving products have higher weekly velocity and margin contribution.</p>
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0f172a]">Filters</h2>
          <p className="text-sm text-[#64748b]">Segment analysis</p>
          <label className="mt-3 block text-sm font-semibold text-[#64748b]">Category</label>
          <select className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4 text-[#64748b]" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <label className="mt-4 block text-sm font-semibold text-[#64748b]">Date Range</label>
          <select className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4 text-[#64748b]" value={filters.dateRange} onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}>
            {["Last 30 days", "Last 90 days", "Last 6 months", "All time"].map((range) => <option key={range}>{range}</option>)}
          </select>
          <button className="mt-12 h-11 w-full rounded-lg bg-[#2563eb] font-semibold text-white" onClick={run} disabled={loading}>{loading ? <LoadingSpinner label="Running" /> : "Run Analysis"}</button>
        </div>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Product Lists</h2>
        <p className="text-sm text-[#64748b]">Prioritized actions</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[#64748b]"><tr>{["Product", "Velocity", "Status", "Recommended Action"].map((head) => <th key={head} className="border border-[#e2e8f0] px-4 py-3">{head}</th>)}</tr></thead>
          <tbody className="font-semibold text-[#0f172a]">
            {products.map((item) => {
              const fast = item.velocity_label === "Fast";
              return <tr key={item.product_name}><td className="border border-[#e2e8f0] px-4 py-3">{item.product_name}</td><td className={`border border-[#e2e8f0] px-4 py-3 ${fast ? "text-[#16a34a]" : "text-[#ef4444]"}`}>{fast ? "High" : "Low"}</td><td className="border border-[#e2e8f0] px-4 py-3">{fast ? "Fast-moving" : "Slow-moving"}</td><td className="border border-[#e2e8f0] px-4 py-3">{item.recommended_action}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FastSlowPage;
