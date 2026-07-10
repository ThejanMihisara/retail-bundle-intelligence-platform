import { useEffect, useState } from "react";
import { Line, LineChart, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import toast from "react-hot-toast";
import StatCard from "../../components/shared/StatCard";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { getSales, getSalesSummary, getSalesMonthly, getSalesCategories } from "../../services/salesService";

const ReportsPage = () => {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchSalesData = () => {
    const params = {
      page,
      limit: 10,
      ...(search && { search }),
      ...(category && { category }),
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    };

    getSales(params)
      .then((res) => {
        setSales(res.data.data);
        setTotalRecords(res.data.total);
      })
      .catch(() => toast.error("Failed to load sales transaction data."));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSalesSummary(),
      getSalesMonthly(),
      getSalesCategories(),
    ])
      .then(([sumRes, monthRes, catRes]) => {
        setSummary(sumRes.data);
        setMonthlyData(monthRes.data);
        setCategories(catRes.data);
      })
      .catch(() => toast.error("Failed to load sales analytics metadata."))
      .finally(() => setLoading(false));
  }, []);

  // Fetch sales records whenever filters or pages change
  useEffect(() => {
    fetchSalesData();
  }, [page, category, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSalesData();
  };

  const handleClearFilters = () => {
    setSearch("");
    setCategory("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  if (loading) {
    return <LoadingSpinner label="Loading Sales & Profit Analytics..." fullPage />;
  }

  const formatCurrency = (value) => {
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  // Derive top & slow selling products from current sales list (or sorted predictions)
  const sortedSalesDesc = [...sales].sort((a, b) => b.total_revenue - a.total_revenue);
  const sortedSalesAsc = [...sales].sort((a, b) => a.quantity_sold - b.quantity_sold);

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Filters Card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Product</label>
            <input
              type="text"
              placeholder="Enter product name or ID..."
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</label>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="h-10 flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Stats Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Gross Analytics Revenue" 
            number={formatCurrency(summary.total_revenue)} 
            trend="Income" 
            trendColor="emerald"
          />
          <StatCard 
            label="Total Profit Margin" 
            number={formatCurrency(summary.total_profit)} 
            trend={`${summary.profit_margin}% Margin`} 
            trendColor="blue"
          />
          <StatCard 
            label="Volume (Units Sold)" 
            number={summary.quantity_sold.toLocaleString()} 
            trend="Total Qty" 
            trendColor="yellow"
          />
          <StatCard 
            label="Analysis Datapoints" 
            number={summary.total_records.toLocaleString()} 
            trend="MySQL Rows" 
            trendColor="purple"
          />
        </div>
      )}

      {/* Charting Rows */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">Monthly Sales Trends</h2>
            <p className="text-xs text-slate-400">Chronological revenue and profitability patterns</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: 'white' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#cbd5e1' }}
                  itemStyle={{ fontSize: '12px', color: 'white' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line name="Revenue" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                <Line name="Profit" type="monotone" dataKey="profit" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Snapshot / Explanation Panel */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Analytics Capabilities</h2>
            <p className="text-xs text-slate-400 mb-6">Explore transaction intelligence</p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Date Range Filters</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Narrow down transaction audits to specific store periods or calendar seasons.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-50 text-cyan-500 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Department Performance</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Track category margins and product volume shares to identify high-performing sectors.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-50 rounded-lg text-indigo-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Integrations</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Calculated results feed into the FP-Growth and Random Forest recommenders.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-xl p-4 text-[10px] text-slate-400 leading-relaxed mt-6">
            Verify retail parameters such as individual product pricing margins. Click headers in tabular grids to organize information.
          </div>
        </div>
      </div>

      {/* Top vs Slow Selling Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top selling */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Top Grossing Products (in current query)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase pb-2">
                  <th className="pb-3">Product ID</th>
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-right">Sold Qty</th>
                  <th className="pb-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSalesDesc.slice(0, 5).map((r) => (
                  <tr key={r.product_id} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-semibold text-slate-500">#{r.product_id}</td>
                    <td className="py-3 font-bold text-slate-700">{r.product_name}</td>
                    <td className="py-3 text-right font-medium">{r.quantity_sold.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-slate-800">{formatCurrency(r.total_revenue)}</td>
                  </tr>
                ))}
                {sortedSalesDesc.length === 0 && (
                  <tr><td colSpan="4" className="text-center py-6 text-slate-400">No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slow selling */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Slowest Moving Products (by Quantity Sold)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase pb-2">
                  <th className="pb-3">Product ID</th>
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3 text-right">Sold Qty</th>
                  <th className="pb-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSalesAsc.slice(0, 5).map((r) => (
                  <tr key={r.product_id} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-semibold text-slate-500">#{r.product_id}</td>
                    <td className="py-3 font-bold text-slate-700">{r.product_name}</td>
                    <td className="py-3 text-right font-medium">{r.quantity_sold.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-red-500">{formatCurrency(r.profit)}</td>
                  </tr>
                ))}
                {sortedSalesAsc.length === 0 && (
                  <tr><td colSpan="4" className="text-center py-6 text-slate-400">No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Paginated Transactions List Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Live Database Transactions Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                <th className="pb-3">Invoice ID</th>
                <th className="pb-3">Product ID</th>
                <th className="pb-3">Product Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Retail Price</th>
                <th className="pb-3 text-right">Total Revenue</th>
                <th className="pb-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((r, i) => (
                <tr key={i} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 font-bold text-slate-700">{r.invoice_id}</td>
                  <td className="py-3.5 font-semibold text-slate-500">#{r.product_id}</td>
                  <td className="py-3.5 font-bold text-slate-700">{r.product_name}</td>
                  <td className="py-3.5">{r.category}</td>
                  <td className="py-3.5 text-right">{r.quantity_sold}</td>
                  <td className="py-3.5 text-right">{formatCurrency(r.retail_price)}</td>
                  <td className="py-3.5 text-right font-bold text-slate-800">{formatCurrency(r.total_revenue)}</td>
                  <td className="py-3.5 text-right font-bold text-emerald-500">{formatCurrency(r.profit)}</td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan="8" className="text-center py-8 text-slate-400">No records found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalRecords > 10 && (
          <div className="flex justify-between items-center mt-6 border-t border-slate-100 pt-4">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">
              Showing {Math.min(totalRecords, (page-1)*10 + 1)} - {Math.min(totalRecords, page*10)} of {totalRecords} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-semibold text-xs rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalRecords / 10), p + 1))}
                disabled={page >= Math.ceil(totalRecords / 10)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-semibold text-xs rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
