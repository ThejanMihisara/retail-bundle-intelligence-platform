import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Label } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import toast from "react-hot-toast";
import StatCard from "../../components/shared/StatCard";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getSales, getSalesSummary, getSalesMonthly, getSalesCategories } from "../../services/salesService";

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '1rem',
  backdropFilter: 'blur(10px)',
  boxShadow: 'var(--card-shadow)',
};

const ReportsPage = () => {
  const [sales, setSales] = useState([]);
  const [allSalesForTopSlow, setAllSalesForTopSlow] = useState([]);
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const chartGrid     = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tooltipBg     = theme === 'dark' ? '#0c1120' : '#1e293b';
  const tooltipBorder = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)';
  const labelColor    = theme === 'dark' ? '#94a3b8' : '#475569';

  const fetchSalesData = () => {
    const params = { page, limit: 10, ...(search && { search }), ...(category && { category }), ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) };
    getSales(params).then(res => { setSales(res.data.data); setTotalRecords(res.data.total); }).catch(() => toast.error("Failed to load sales transaction data."));

    const allParams = { page: 1, limit: 10000, include_total: false, ...(search && { search }), ...(category && { category }), ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) };
    getSales(allParams).then(res => { setAllSalesForTopSlow(res.data.data); }).catch(() => {});

    // Update filtered summary and monthly trends
    const filterParams = { ...(search && { search }), ...(category && { category }), ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) };
    getSalesSummary(filterParams).then(res => setSummary(res.data)).catch(() => {});
    getSalesMonthly(filterParams).then(res => setMonthlyData(res.data)).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([getSalesSummary(), getSalesMonthly(), getSalesCategories()])
      .then(([sumRes, monthRes, catRes]) => { setSummary(sumRes.data); setMonthlyData(monthRes.data); setCategories(catRes.data); })
      .catch(() => toast.error("Failed to load sales analytics metadata."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSalesData(); }, [page, category, startDate, endDate]);

  const aggregatedProducts = useMemo(() => {
    const productMap = {};
    allSalesForTopSlow.forEach(item => {
      const pid = item.product_id;
      if (!productMap[pid]) {
        productMap[pid] = {
          product_id: pid,
          product_name: item.product_name,
          quantity_sold: 0,
          total_revenue: 0,
          profit: 0
        };
      }
      productMap[pid].quantity_sold += item.quantity_sold;
      productMap[pid].total_revenue += item.total_revenue;
      productMap[pid].profit += item.profit;
    });
    return Object.values(productMap);
  }, [allSalesForTopSlow]);

  const totalRevenue = useMemo(() => aggregatedProducts.reduce((sum, p) => sum + p.total_revenue, 0), [aggregatedProducts]);
  const avgRevenue = useMemo(() => aggregatedProducts.length ? (totalRevenue / aggregatedProducts.length) : 0, [aggregatedProducts, totalRevenue]);

  const totalQty = useMemo(() => aggregatedProducts.reduce((sum, p) => sum + p.quantity_sold, 0), [aggregatedProducts]);
  const avgQty = useMemo(() => aggregatedProducts.length ? (totalQty / aggregatedProducts.length) : 0, [aggregatedProducts, totalQty]);

  const sortedSalesDesc = useMemo(() => {
    const filtered = [...aggregatedProducts].filter(p => p.total_revenue >= avgRevenue);
    const sorted = filtered.sort((a, b) => b.total_revenue - a.total_revenue);
    return {
      data: sorted.slice(0, 50),
      totalCount: sorted.length
    };
  }, [aggregatedProducts, avgRevenue]);

  const sortedSalesAsc = useMemo(() => {
    const filtered = [...aggregatedProducts].filter(p => p.quantity_sold < avgQty);
    const sorted = filtered.sort((a, b) => a.quantity_sold - b.quantity_sold);
    return {
      data: sorted.slice(0, 50),
      totalCount: sorted.length
    };
  }, [aggregatedProducts, avgQty]);

  const uniqueInvoicesCount = useMemo(() => new Set(allSalesForTopSlow.map(s => s.invoice_id)).size, [allSalesForTopSlow]);
  const totalRevenueSum = useMemo(() => allSalesForTopSlow.reduce((sum, s) => sum + s.total_revenue, 0), [allSalesForTopSlow]);
  const totalProfitSum = useMemo(() => allSalesForTopSlow.reduce((sum, s) => sum + s.profit, 0), [allSalesForTopSlow]);
  const totalQtySum = useMemo(() => allSalesForTopSlow.reduce((sum, s) => sum + s.quantity_sold, 0), [allSalesForTopSlow]);
  const uniqueProductsCount = useMemo(() => new Set(allSalesForTopSlow.map(s => s.product_id)).size, [allSalesForTopSlow]);

  const aov = useMemo(() => uniqueInvoicesCount > 0 ? (totalRevenueSum / uniqueInvoicesCount) : 0, [uniqueInvoicesCount, totalRevenueSum]);
  const avgItemsPerInvoice = useMemo(() => uniqueInvoicesCount > 0 ? (totalQtySum / uniqueInvoicesCount) : 0, [uniqueInvoicesCount, totalQtySum]);
  const avgProductRevenue = useMemo(() => uniqueProductsCount > 0 ? (totalRevenueSum / uniqueProductsCount) : 0, [uniqueProductsCount, totalRevenueSum]);
  const overallMargin = useMemo(() => totalRevenueSum > 0 ? ((totalProfitSum / totalRevenueSum) * 100) : 0, [totalProfitSum, totalRevenueSum]);

  const handleSearchSubmit = (e) => { e.preventDefault(); setPage(1); fetchSalesData(); };
  const handleClearFilters = () => { setSearch(""); setCategory(""); setStartDate(""); setEndDate(""); setPage(1); };

  if (loading) return <LoadingSpinner label="Loading Sales & Profit Analytics..." fullPage />;

  // Empty state — database has no transactions yet
  if (!summary || summary.total_records === 0) {
    return (
      <EmptyState
        title="No Sales Data Yet"
        message="Upload a sales transaction CSV file to populate the Sales Analytics dashboard with live data."
        actionText="Go to Upload CSV"
        onAction={() => navigate("/upload")}
      />
    );
  }

  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1000000) {
      return "Rs. " + (value / 1000000).toFixed(2) + "M";
    }
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1000000) return "Rs. " + (value / 1000000).toFixed(1) + "M";
    if (Math.abs(value) >= 1000) return "Rs. " + (value / 1000).toFixed(0) + "K";
    return "Rs. " + value;
  };

  const tooltipStyle = { contentStyle: { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: 'white' }, labelStyle: { fontWeight: 'bold', fontSize: '11px', color: '#94a3b8' }, itemStyle: { fontSize: '11px', color: 'white' } };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* Filters */}
      <div className="rounded-2xl p-6" style={card}>
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>Search Product</label>
            <input type="text" placeholder="Product name or ID..." className="input-dark" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>Category</label>
            <select className="input-dark" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>Start Date</label>
            <input type="date" className="input-dark" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>End Date</label>
            <input type="date" className="input-dark" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">Search</button>
            <button type="button" onClick={handleClearFilters} className="h-10 px-4 rounded-xl font-bold text-xs transition-all hover:bg-[var(--btn-ghost-bg-hover)]"
              style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body)' }}>
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard 
            label="Gross Analytics Revenue" 
            number={formatCurrency(summary.total_revenue)} 
            trend="Income" 
            trendColor="emerald" 
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard 
            label="Total Profit Margin" 
            number={formatCurrency(summary.total_profit)} 
            trend={`${
              summary.profit_margin != null
                ? summary.profit_margin
                : summary.total_revenue > 0
                  ? ((summary.total_profit / summary.total_revenue) * 100).toFixed(2)
                  : 0
            }% Margin`} 
            trendColor="blue" 
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
          <StatCard 
            label="Volume (Units Sold)" 
            number={(summary.quantity_sold ?? summary.total_quantity ?? 0).toLocaleString()} 
            trend="Total Qty" 
            trendColor="yellow" 
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />
          <StatCard 
            label="Analysis Datapoints" 
            number={summary.total_records.toLocaleString()} 
            trend="MySQL Rows" 
            trendColor="purple" 
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            }
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="rounded-2xl p-6 flex flex-col xl:col-span-2" style={card}>
          <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Revenue & Profit Analytics</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Chronological revenue and profitability patterns</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 10, fill: labelColor }} 
                  axisLine={false} 
                  tickLine={false} 
                  height={45}
                  interval={monthlyData.length > 15 ? Math.ceil(monthlyData.length / 8) : 0}
                >
                  <Label value="Time Period" offset={0} position="insideBottom" style={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--text-muted)' }} />
                </XAxis>
                <YAxis 
                  tick={{ fontSize: 10, fill: labelColor }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatYAxis}
                  width={75}
                >
                  <Label value="Revenue / Profit (Rs.)" angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fontWeight: 'bold', textAnchor: 'middle', fill: 'var(--text-muted)' }} />
                </YAxis>
                <Tooltip {...tooltipStyle} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-body)' }} />
                <Line name="Revenue" type="monotone" dataKey="revenue" stroke="var(--accent-green)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-green)' }} activeDot={{ r: 5 }} />
                <Line name="Profit"  type="monotone" dataKey="profit"  stroke="var(--accent-cyan)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-cyan)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl p-6 flex flex-col justify-between" style={card}>
          <div>
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Sales Performance KPIs</h2>
            <p className="text-[11px] mb-5" style={{ color: 'var(--text-muted)' }}>Key transaction indicators in active query</p>
            <div className="space-y-4">
              {[
                { 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  ),
                  title: 'Average Invoice Value (AOV)', 
                  val: formatCurrency(aov), 
                  desc: 'Average spending per checkout', 
                  color: 'var(--accent-green)', 
                  bg: 'rgba(16,185,129,0.1)' 
                },
                { 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  ),
                  title: 'Average Basket Size', 
                  val: `${avgItemsPerInvoice.toFixed(1)} Units`, 
                  desc: 'Items purchased per invoice transaction', 
                  color: 'var(--accent-cyan)', 
                  bg: 'rgba(6,182,212,0.1)'  
                },
                { 
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: 'Average Product Revenue', 
                  val: formatCurrency(avgProductRevenue), 
                  desc: 'Average gross revenue per retail product', 
                  color: '#a5b4fc', 
                  bg: 'rgba(99,102,241,0.1)' 
                },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                  <div>
                    <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{item.title}</h4>
                    <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.val}</div>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-very-muted)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl p-3.5 mt-5 text-[10px] leading-relaxed flex items-center justify-between" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Overall Profit Margin:</span>
            <span className="font-extrabold" style={{ color: 'var(--accent-green-text)' }}>{overallMargin.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Top/Slow Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[
          { title: 'Top-Grossing Products', data: sortedSalesDesc.data, totalCount: sortedSalesDesc.totalCount, revKey: 'total_revenue', valueColor: 'var(--text-primary)', valueLabel: 'Revenue' },
          { title: 'Slow-Moving Products', data: sortedSalesAsc.data, totalCount: sortedSalesAsc.totalCount, revKey: 'profit', valueColor: '#f87171', valueLabel: 'Profit' },
        ].map(section => (
          <div key={section.title} className="rounded-2xl p-6 flex flex-col h-[400px]" style={card}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{section.title}</h3>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)', color: 'var(--text-body-strong)' }}>
                {section.data.length}/{section.totalCount} Products
              </span>
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                    {['Product ID', 'Product Name', 'Sold Qty', section.valueLabel].map(h => (
                      <th 
                        key={h} 
                        className={`pb-3 text-[10px] font-bold uppercase tracking-wider ${h === 'Sold Qty' || h === section.valueLabel ? 'text-right' : ''}`} 
                        style={{ 
                          color: 'var(--text-label)', 
                          position: 'sticky', 
                          top: 0, 
                          backgroundColor: 'var(--sticky-header-bg)', 
                          zIndex: 10 
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.data.map(r => (
                    <tr key={r.product_id} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: '1px solid var(--divider-subtle)' }}>
                      <td className="py-3 font-semibold" style={{ color: 'var(--text-body)' }}>#{r.product_id}</td>
                      <td className="py-3 font-bold max-w-[150px] truncate" style={{ color: 'var(--text-primary)' }}>{r.product_name}</td>
                      <td className="py-3 text-right" style={{ color: 'var(--text-body)' }}>{r.quantity_sold.toLocaleString()}</td>
                      <td className="py-3 text-right font-bold" style={{ color: section.valueColor }}>{formatCurrency(r[section.revKey])}</td>
                    </tr>
                  ))}
                  {section.data.length === 0 && <tr><td colSpan="4" className="text-center py-6 text-xs" style={{ color: 'var(--text-body)' }}>No records found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl p-6" style={card}>
        <h3 className="text-sm font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Live Database Transactions Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                {['Invoice ID','Product ID','Product Name','Category','Qty','Retail Price','Total Revenue','Profit'].map((h, i) => (
                  <th key={h} className={`pb-3 text-[10px] font-bold uppercase tracking-wider ${i >= 4 ? 'text-right' : ''}`} style={{ color: 'var(--text-label)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((r, i) => (
                <tr key={i} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: '1px solid var(--divider-subtle)' }}>
                  <td className="py-3.5 font-bold" style={{ color: 'var(--text-primary)' }}>{r.invoice_id}</td>
                  <td className="py-3.5 font-semibold" style={{ color: 'var(--text-body)' }}>#{r.product_id}</td>
                  <td className="py-3.5 font-bold" style={{ color: 'var(--text-primary)' }}>{r.product_name}</td>
                  <td className="py-3.5" style={{ color: 'var(--text-body)' }}>{r.category}</td>
                  <td className="py-3.5 text-right" style={{ color: 'var(--text-body-strong)' }}>{r.quantity_sold}</td>
                  <td className="py-3.5 text-right" style={{ color: 'var(--text-body)' }}>{formatCurrency(r.retail_price)}</td>
                  <td className="py-3.5 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(r.total_revenue)}</td>
                  <td className="py-3.5 text-right font-bold" style={{ color: 'var(--accent-green-text)' }}>{formatCurrency(r.profit)}</td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan="8" className="text-center py-8 text-xs" style={{ color: 'var(--text-body)' }}>No records found matching filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {totalRecords > 10 && (
          <div className="flex justify-between items-center mt-5 pt-4" style={{ borderTop: '1px solid var(--divider)' }}>
            <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-very-muted)' }}>
              Showing {Math.min(totalRecords, (page - 1) * 10 + 1)} – {Math.min(totalRecords, page * 10)} of {totalRecords} records
            </span>
            <div className="flex gap-2">
              {[
                { label: 'Previous', action: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 },
                { label: 'Next',     action: () => setPage(p => Math.min(Math.ceil(totalRecords / 10), p + 1)), disabled: page >= Math.ceil(totalRecords / 10) },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={btn.disabled}
                  className="px-4 py-2 font-semibold text-xs rounded-lg transition-all disabled:opacity-30 hover:bg-[var(--btn-ghost-bg-hover)]"
                  style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body-strong)' }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
