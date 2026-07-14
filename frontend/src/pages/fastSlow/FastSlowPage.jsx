import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getMovementPredictions } from "../../services/productService";
import StatCard from "../../components/shared/StatCard";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '1rem',
  backdropFilter: 'blur(10px)',
  boxShadow: 'var(--card-shadow)',
};

const COLORS = {
  "Fast Moving": "#10b981",
  "Medium Moving": "#06b6d4",
  "Slow Moving": "#fbbf24"
};

const FastSlowPage = () => {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // Bottom table state
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("expected_revenue");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Prediction control card state
  const [periodType, setPeriodType] = useState("month");
  const [selectedDate, setSelectedDate] = useState("2026-01-15");
  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState([]);

  // Insights, distribution, and top lists state
  const [distribution, setDistribution] = useState([]);
  const [topFastProducts, setTopFastProducts] = useState([]);
  const [topSlowProducts, setTopSlowProducts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);

  const fetchMovementPredictionsData = (resetPage = false) => {
    setSubmitting(true);
    setErrorState(null);

    const targetPage = resetPage ? 1 : page;
    if (resetPage) {
      setPage(1);
    }

    let levelParam = null;
    if (activeTab === "fast")   levelParam = "Fast Moving";
    if (activeTab === "medium") levelParam = "Medium Moving";
    if (activeTab === "slow")   levelParam = "Slow Moving";

    const params = {
      period_type: periodType,
      selected_date: selectedDate,
      page: targetPage,
      limit: 15,
      sort_by: sortBy,
      sort_desc: sortDesc,
      ...(search && { search }),
      ...(levelParam && { movement_level: levelParam }),
      ...(category && category !== "all" && { category })
    };

    getMovementPredictions(params)
      .then((res) => {
        const data = res.data;
        setProducts(data.data || []);
        setTotalRecords(data.total || 0);
        setSummary(data.summary || null);
        setDistribution(data.distribution || []);
        setTopFastProducts(data.top_fast_products || []);
        setTopSlowProducts(data.top_slow_products || []);
        setInsights(data.insights || []);
        setModelInfo(data.model || null);

        // Standard categories for fallback and merge
        const standardCategories = [
          "Baby & Kids",
          "Beverages",
          "Cleaning & Household",
          "Cooking Essentials",
          "Dairy & Chilled",
          "General Grocery",
          "Health & Medicine",
          "Meat, Fish & Frozen",
          "Personal Care",
          "Snacks & Confectionery",
          "Staples & Dry Groceries",
          "Stationery"
        ];
        const uniqueCats = Array.from(new Set([
          ...standardCategories,
          ...(data.data || []).map(p => p.category)
        ])).filter(Boolean).sort();
        setCategories(uniqueCats);
      })
      .catch((err) => {
        console.error(err);
        const errMsg = err.response?.data?.detail || "Prediction request failed.";
        setErrorState(errMsg);
        toast.error(errMsg);
      })
      .finally(() => {
        setSubmitting(false);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMovementPredictionsData(false);
  }, [page, activeTab, sortBy, sortDesc]);

  const handlePredictSubmit = (e) => {
    e.preventDefault();
    fetchMovementPredictionsData(true);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMovementPredictionsData(true);
  };

  const handleToggleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
    setPage(1);
  };

  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1000000) {
      return "Rs. " + (value / 1000000).toFixed(2) + "M";
    }
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  if (loading) {
    return <LoadingSpinner label="Loading product movement prediction..." fullPage />;
  }

  if (errorState) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 space-y-4 p-8">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4" style={card}>
          <h3 className="text-lg font-bold text-red-400">Model Prediction Unavailable</h3>
          <p className="text-xs text-[var(--text-body)]">{errorState}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchMovementPredictionsData(true);
            }}
            className="btn-primary w-full"
          >
            Retry Request
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "all",    label: "All Items" },
    { id: "fast",   label: "Fast" },
    { id: "medium", label: "Medium" },
    { id: "slow",   label: "Slow" },
  ];

  // Map distribution data for Recharts Pie
  const chartData = distribution.map(d => ({
    name: d.movement_level,
    value: d.count,
    percentage: d.percentage
  }));

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* Prediction Controls */}
      <div className="rounded-2xl p-6 space-y-5" style={card}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Predictive Product Movement</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure parameters and run the Random Forest predictor model</p>
          </div>
          <form onSubmit={handlePredictSubmit} className="flex flex-wrap items-center gap-3">
            {/* View Mode */}
            <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
              {[
                { id: "day", label: "Daily" },
                { id: "week", label: "Weekly" },
                { id: "month", label: "Monthly" },
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPeriodType(mode.id)}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={periodType === mode.id
                    ? { background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.25)' }
                    : { color: 'var(--text-body)', border: '1px solid transparent' }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Date Picker */}
            <div className="flex flex-col">
              <input
                type="date"
                className="input-dark"
                style={{ width: '160px' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
              />
            </div>

            {/* Category Select */}
            <select
              className="input-dark"
              style={{ width: '180px' }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Movement Filter Dropdown (Syncs with activeTab) */}
            <select
              className="input-dark"
              style={{ width: '160px' }}
              value={activeTab}
              onChange={(e) => {
                setActiveTab(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Movement</option>
              <option value="fast">Fast Moving</option>
              <option value="medium">Medium Moving</option>
              <option value="slow">Slow Moving</option>
            </select>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2"
              disabled={submitting}
              style={{ height: '38px', minWidth: '150px' }}
            >
              {submitting ? 'Running...' : 'Predict Movement'}
            </button>
          </form>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          <StatCard
            label="Total Predicted"
            number={summary.total_products.toLocaleString()}
            trendColor="purple"
          />
          <StatCard
            label="Expected Fast"
            number={summary.fast_moving_count.toLocaleString()}
            trendColor="emerald"
            trend={summary.total_products > 0 ? `${((summary.fast_moving_count / summary.total_products) * 100).toFixed(1)}%` : '0%'}
          />
          <StatCard
            label="Expected Medium"
            number={summary.medium_moving_count.toLocaleString()}
            trendColor="blue"
            trend={summary.total_products > 0 ? `${((summary.medium_moving_count / summary.total_products) * 100).toFixed(1)}%` : '0%'}
          />
          <StatCard
            label="Expected Slow"
            number={summary.slow_moving_count.toLocaleString()}
            trendColor="yellow"
            trend={summary.total_products > 0 ? `${((summary.slow_moving_count / summary.total_products) * 100).toFixed(1)}%` : '0%'}
          />
          <StatCard
            label="Avg Confidence"
            number={`${(summary.average_confidence * 100).toFixed(0)}%`}
            trendColor="emerald"
          />
        </div>
      )}

      {/* Chart, Insights and Model Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Distribution Chart */}
        <div className="glass-card p-5 flex flex-col justify-between" style={card}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-label)' }}>
            Movement Distribution
          </h3>
          <div className="h-[200px] w-full flex items-center justify-center">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name] || "#8884d8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      borderColor: 'var(--card-border)',
                      borderRadius: '0.5rem',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(value, name, props) => [
                      `${value} (${props.payload.percentage}%)`,
                      name
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-[10px] font-bold" style={{ color: 'var(--text-body)' }}>{value.replace(" Moving", "")}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No data for chart</p>
            )}
          </div>
        </div>

        {/* Middle: Insights */}
        <div className="glass-card p-5 flex flex-col" style={card}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-label)' }}>
            Automated Insights
          </h3>
          <ul className="space-y-3 overflow-y-auto max-h-[200px]">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-body)' }}>
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-cyan-text)' }}></span>
                <span>{insight}</span>
              </li>
            ))}
            {insights.length === 0 && (
              <li className="text-xs" style={{ color: 'var(--text-muted)' }}>No insights generated for this period.</li>
            )}
          </ul>
        </div>

        {/* Right: Model status */}
        <div className="glass-card p-5 flex flex-col justify-between" style={card}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-label)' }}>
            Model Status Info
          </h3>
          {modelInfo ? (
            <div className="space-y-3 text-xs flex-1 flex flex-col justify-center">
              <div className="flex justify-between border-b border-[var(--divider-subtle)] pb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Model Family</span>
                <span className="font-bold text-[var(--text-primary)]">{modelInfo.model_name}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--divider-subtle)] pb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Version</span>
                <span className="font-bold text-[var(--text-primary)]">{modelInfo.model_version}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--divider-subtle)] pb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Training Period</span>
                <span className="font-bold text-[var(--text-primary)]">{modelInfo.training_start_date} - {modelInfo.training_end_date}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span className="text-emerald-400 font-bold">Active</span>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No model metadata found.</p>
          )}
        </div>
      </div>

      {/* Row 4: Top 5 Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Fast Products */}
        <div className="glass-card p-5 space-y-4" style={card}>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-green-text)' }}>
              Top 5 Expected Fast Moving
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Highest model probability for fast flow</p>
          </div>
          <div className="space-y-2">
            {topFastProducts.map(p => (
              <div key={p.product_id} className="flex justify-between items-center p-3 rounded-lg border border-[var(--tag-border)] bg-[var(--tag-bg)]">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-xs font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{p.product_name}</p>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{p.category}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black" style={{ color: 'var(--accent-green-text)' }}>{p.expected_quantity}</p>
                    <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-very-muted)' }}>Expected Qty</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" 
                    style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    {(p.movement_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
            {topFastProducts.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No fast moving products found.</p>
            )}
          </div>
        </div>

        {/* Top Slow Products */}
        <div className="glass-card p-5 space-y-4" style={card}>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
              Top 5 Expected Slow Moving
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Highest model probability for slow velocity</p>
          </div>
          <div className="space-y-2">
            {topSlowProducts.map(p => (
              <div key={p.product_id} className="flex justify-between items-center p-3 rounded-lg border border-[var(--tag-border)] bg-[var(--tag-bg)]">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-xs font-extrabold truncate" style={{ color: 'var(--text-primary)' }}>{p.product_name}</p>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{p.category}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-black" style={{ color: '#fca5a5' }}>{p.expected_quantity}</p>
                    <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-very-muted)' }}>Expected Qty</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" 
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {(p.movement_confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
            {topSlowProducts.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No slow moving products found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Model Notice and Disclaimer */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 py-1 gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <p>Predictions are based on recurring product movement patterns learned from the 2024–2025 dataset.</p>
        {modelInfo && (
          <p>Model: {modelInfo.model_name} ({modelInfo.model_version}) | Values shown below are model-based estimates.</p>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="rounded-2xl flex-1 flex flex-col" style={card}>
        {/* Toolbar */}
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--divider)' }}>
          <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--tag-bg)' }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setPage(1); }}
                className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 hover:text-[var(--text-primary)]"
                style={activeTab === t.id ? { background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.25)' }
                  : { color: 'var(--text-body)', border: '1px solid transparent' }}>
                {t.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input type="text" placeholder="Search by Product Name or Category..." className="input-dark" style={{ width: '300px' }} value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="submit" className="btn-primary">Filter</button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                {[
                  { label: 'Product Name', key: 'product_name' }, { label: 'Category', key: null },
                  { label: 'Quantity Sold', key: 'total_quantity_sold', right: true }, { label: 'Total Revenue', key: 'total_revenue', right: true },
                  { label: 'Total Profit', key: 'total_profit', right: true }, { label: 'Classification', key: null, center: true },
                  { label: 'Movement Confidence (F/M/S)', key: null, center: true },
                ].map(h => (
                  <th key={h.label} className={`px-4 pb-3 pt-4 text-[10px] font-bold uppercase tracking-wider ${h.key ? 'cursor-pointer select-none' : ''} ${h.right ? 'text-right' : h.center ? 'text-center' : ''}`}
                    style={{ color: 'var(--text-label)' }} onClick={h.key ? () => handleToggleSort(h.key) : undefined}>
                    {h.label} {h.key && sortBy === h.key && (sortDesc ? '↓' : '↑')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submitting ? (
                <tr><td colSpan="7" className="text-center py-20"><LoadingSpinner label="Refreshing predictions..." /></td></tr>
              ) : (
                products.map((item) => {
                  let badgeStyle = { background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' };
                  if (item.movement_level === "Fast Moving")   badgeStyle = { background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.25)' };
                  if (item.movement_level === "Medium Moving") badgeStyle = { background: 'rgba(6,182,212,0.12)',  color: 'var(--accent-cyan-text)', border: '1px solid rgba(6,182,212,0.25)'  };
                  if (item.movement_level === "Slow Moving")   badgeStyle = { background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)'   };
                  return (
                    <tr key={item.product_id} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: '1px solid var(--divider-subtle)' }}>
                      <td className="px-4 py-4 font-bold pr-4" style={{ color: 'var(--text-primary)' }}>{item.product_name}</td>
                      <td className="py-4" style={{ color: 'var(--text-body)' }}>{item.category}</td>
                      <td className="py-4 text-right" style={{ color: 'var(--text-body-strong)' }}>{item.quantity_sold.toLocaleString()}</td>
                      <td className="py-4 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.revenue)}</td>
                      <td className="py-4 text-right font-bold" style={{ color: 'var(--accent-green-text)' }}>{formatCurrency(item.profit)}</td>
                      <td className="py-4 text-center"><span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={badgeStyle}>{item.movement_level}</span></td>
                      <td className="py-4 text-center text-[10px] font-bold pr-4">
                        <span style={{ color: 'var(--accent-green-text)' }}>{Math.round(item.probabilities.fast * 100)}%</span>{" / "}
                        <span style={{ color: 'var(--accent-cyan-text)' }}>{Math.round(item.probabilities.medium * 100)}%</span>{" / "}
                        <span style={{ color: '#fca5a5' }}>{Math.round(item.probabilities.slow * 100)}%</span>
                      </td>
                    </tr>
                  );
                })
              )}
              {products.length === 0 && !submitting && (
                <tr><td colSpan="7" className="py-12"><EmptyState title="No classification rows found" message="Verify filters or upload another dataset." /></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 15 && (
          <div className="p-5 flex justify-between items-center" style={{ borderTop: '1px solid var(--divider)' }}>
            <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-very-muted)' }}>
              Showing {Math.min(totalRecords, (page - 1) * 15 + 1)} – {Math.min(totalRecords, page * 15)} of {totalRecords} items
            </span>
            <div className="flex gap-2">
              {[
                { label: 'Previous', action: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 },
                { label: 'Next',     action: () => setPage(p => Math.min(Math.ceil(totalRecords / 15), p + 1)), disabled: page >= Math.ceil(totalRecords / 15) },
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

export default FastSlowPage;
