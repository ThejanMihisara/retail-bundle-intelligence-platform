import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import toast from "react-hot-toast";
import StatCard from "../../components/shared/StatCard";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { 
  getOverview, 
  getMonthlySales, 
  getCategoryPerformance, 
  getTopProducts, 
  getRecentInsights 
} from "../../services/dashboardService";

const DashboardPage = () => {
  const [overview, setOverview] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getOverview(),
      getMonthlySales(),
      getCategoryPerformance(),
      getTopProducts(),
      getRecentInsights()
    ])
      .then(([overRes, monthRes, catRes, topRes, insRes]) => {
        setOverview(overRes.data);
        setMonthlyData(monthRes.data);
        setCategoryData(catRes.data);
        setTopProducts(topRes.data);
        setInsights(insRes.data);
      })
      .catch((error) => {
        console.error("Dashboard error:", error);
        toast.error("Failed to load dashboard metrics from backend.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading Executive Dashboard..." fullPage />;
  }

  // Format currencies nicely
  const formatCurrency = (value) => {
    return "Rs. " + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  };

  const hasData = overview && overview.total_products > 0;

  if (!hasData) {
    return (
      <EmptyState 
        title="Dashboard is Empty" 
        message="Upload a sales transaction CSV file to populate the executive dashboard metrics."
        actionText="Go to Upload"
        onAction={() => navigate("/upload")}
      />
    );
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard 
          label="Total Revenue" 
          number={formatCurrency(overview.total_revenue)} 
          trend="Store Live" 
          trendColor="emerald"
          icon={
            <span className="w-6 h-6 flex items-center justify-center text-lg font-bold font-sans">₹</span>
          }
        />
        <StatCard 
          label="Total Profit" 
          number={formatCurrency(overview.total_profit)} 
          trend={`${Math.round((overview.total_profit / overview.total_revenue) * 100)}% Margin`} 
          trendColor="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          }
        />
        <StatCard 
          label="Units Sold" 
          number={overview.total_sales.toLocaleString()} 
          trend="Quantity" 
          trendColor="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
          }
        />
        <StatCard 
          label="Invoices Count" 
          number={overview.total_invoices.toLocaleString()} 
          trend="Unique Sales" 
          trendColor="purple"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          }
        />
        <StatCard 
          label="Recommended Bundles" 
          number={overview.total_recommended_bundles} 
          trend="FP-Growth" 
          trendColor="emerald"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          }
        />
      </div>

      {/* Movement Velocity Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-sm">
              F
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Fast Moving</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{overview.fast_moving_count} Products</h3>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 uppercase">High Velocity</span>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Medium Moving</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{overview.medium_moving_count} Products</h3>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 uppercase">Stable</span>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-sm">
              S
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Slow Moving</p>
              <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{overview.slow_moving_count} Products</h3>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600 uppercase">Promote</span>
        </div>
      </div>

      {/* Chart Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Sales & Profit Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">Monthly Sales Trends</h2>
            <p className="text-xs text-slate-400">Monthly performance tracking for revenue and profit</p>
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
                <Line name="Revenue" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line name="Profit" type="monotone" dataKey="profit" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Performance Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">Category Share Performance</h2>
            <p className="text-xs text-slate-400">Revenue generation breakdown by product department</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: 'white' }}
                  itemStyle={{ fontSize: '12px', color: 'white' }}
                />
                <Bar name="Revenue" dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables and Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Top selling products table */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">Top-Selling Products</h2>
              <p className="text-xs text-slate-400">Highest grossing items sorted by revenue</p>
            </div>
            <button 
              onClick={() => navigate("/reports")} 
              className="text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-2">Rank</th>
                  <th className="pb-3 pr-2">Product Name</th>
                  <th className="pb-3 pr-2">Category</th>
                  <th className="pb-3 pr-2 text-right">Sold Qty</th>
                  <th className="pb-3 pr-2 text-right">Revenue</th>
                  <th className="pb-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.slice(0, 5).map((prod, index) => (
                  <tr key={prod.product_id} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-bold text-slate-400">#{index + 1}</td>
                    <td className="py-4 pr-2 font-bold text-slate-700 max-w-[200px] truncate">{prod.product_name}</td>
                    <td className="py-4 pr-2">{prod.category}</td>
                    <td className="py-4 pr-2 text-right font-medium">{prod.quantity_sold.toLocaleString()}</td>
                    <td className="py-4 pr-2 text-right font-bold text-slate-800">{formatCurrency(prod.revenue)}</td>
                    <td className="py-4 text-right font-bold text-emerald-500">{formatCurrency(prod.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights & Actions panel */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div className="flex-1 flex flex-col">
            <h2 className="text-base font-bold text-slate-800 mb-1">Recent Model Insights</h2>
            <p className="text-xs text-slate-400 mb-4">ML alerts generated from FP-Growth and Random Forest outputs</p>
            
            <div className="space-y-4 flex-1 overflow-y-auto">
              {insights.map((insight) => {
                let colorClass = "bg-blue-50 border-blue-200 text-blue-800";
                if (insight.type === "warning") colorClass = "bg-amber-50 border-amber-200 text-amber-800";
                if (insight.type === "success") colorClass = "bg-emerald-50 border-emerald-200 text-emerald-800";

                return (
                  <div key={insight.id} className={`rounded-xl border p-4 text-xs font-semibold leading-relaxed flex items-start gap-3 ${colorClass}`}>
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>{insight.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 grid grid-cols-2 gap-4">
            <button 
              onClick={() => navigate("/bundles")}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-3.5 shadow-md shadow-emerald-500/10 transition-colors"
            >
              Recommend Bundles
            </button>
            <button 
              onClick={() => navigate("/fast-slow")}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs py-3.5 transition-colors"
            >
              Review Slow Movers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
