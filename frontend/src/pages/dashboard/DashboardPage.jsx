import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Label } from "recharts";
import toast from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";
import StatCard from "../../components/shared/StatCard";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getFullOverview, getOverview, getSalesTimeseries, getCategoryPerformance, getTopProducts } from "../../services/dashboardService";
import { getMovementPredictions } from "../../services/productService";

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '1rem',
  backdropFilter: 'blur(10px)',
  boxShadow: 'var(--card-shadow)',
};

const DashboardPage = () => {
  const [overview, setOverview] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [importantAlerts, setImportantAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Temporary inputs (for form controls)
  const [granularity, setGranularity] = useState("Month");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("");

  // Active chart filters
  const [activeGranularity, setActiveGranularity] = useState("Month");
  const [activeStartDate, setActiveStartDate] = useState("2024-01-01");
  const [activeEndDate, setActiveEndDate] = useState("");

  const chartGrid = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tooltipBg = theme === 'dark' ? '#0c1120' : '#1e293b';
  const tooltipBorder = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)';
  const labelColor = theme === 'dark' ? '#94a3b8' : '#475569';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getOverview(),
      getSalesTimeseries({ granularity: "month" }),
      getCategoryPerformance(),
      getTopProducts(),
    ])
      .then(([overRes, monthRes, catRes, topRes]) => {
        if (cancelled) return;
        setOverview(overRes.data);
        const months = monthRes.data || [];
        setMonthlyData(months);
        // Force parse numerical revenue values to prevent chart axis sorting/layout bugs
        setCategoryData((catRes.data || []).map(item => ({ ...item, revenue: parseFloat(item.revenue || 0) })));
        setTopProducts(topRes.data);

        // Dynamically set default date range based on actual dataset bounds
        if (months.length > 0) {
          const firstMonth = months[0].month;
          const start = `${firstMonth}-01`;

          setStartDate(start);
          setActiveStartDate(start);
        }
      })
      .catch(() => toast.error("Failed to load dashboard metrics from backend."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    let cancelled = false;
    setAlertsLoading(true);

    const movementSummaryPromise = getMovementPredictions({
      period_type: "day",
      selected_date: todayStr,
      page: 1,
      limit: 1,
    });
    const fullOverviewPromise = getFullOverview();
    const fastAlertPromise = getMovementPredictions({
      period_type: "day",
      selected_date: todayStr,
      movement_level: "Fast Moving",
      sort_by: "movement_confidence",
      sort_desc: true,
      page: 1,
      limit: 1,
    });
    const slowAlertPromise = getMovementPredictions({
      period_type: "day",
      selected_date: todayStr,
      movement_level: "Slow Moving",
      sort_by: "movement_confidence",
      sort_desc: true,
      page: 1,
      limit: 1,
    });

    Promise.allSettled([movementSummaryPromise, fullOverviewPromise, fastAlertPromise, slowAlertPromise])
      .then(([movementResult, fullOverviewResult, fastResult, slowResult]) => {
        if (cancelled) return;

        const movementSummary = movementResult.status === "fulfilled" ? movementResult.value.data?.summary : null;
        const fullOverview = fullOverviewResult.status === "fulfilled" ? fullOverviewResult.value.data : null;
        setOverview((currentOverview) => {
          if (!currentOverview) return currentOverview;
          return {
            ...currentOverview,
            fast_moving_count: movementSummary?.fast_moving_count ?? currentOverview.fast_moving_count,
            medium_moving_count: movementSummary?.medium_moving_count ?? currentOverview.medium_moving_count,
            slow_moving_count: movementSummary?.slow_moving_count ?? currentOverview.slow_moving_count,
            total_recommended_bundles: fullOverview?.total_recommended_bundles ?? currentOverview.total_recommended_bundles,
          };
        });

        const fastItem = fastResult.status === "fulfilled" ? fastResult.value.data?.data?.[0] || null : null;
        const slowItem = slowResult.status === "fulfilled" ? slowResult.value.data?.data?.[0] || null : null;
        setImportantAlerts([
          { type: "fast", title: "Highest Fast Moving Confidence", item: fastItem },
          { type: "slow", title: "Highest Slow Moving Confidence", item: slowItem },
        ]);
      })
      .finally(() => {
        if (!cancelled) setAlertsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, todayStr]);

  useEffect(() => {
    if (!isChartFullscreen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsChartFullscreen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChartFullscreen]);

  const formatCurrency = (value) => {
    if (Math.abs(value) >= 1000000) {
      return "Rs. " + (value / 1000000).toFixed(2) + "M";
    }
    return "Rs. " + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
  };

  const formatYAxis = (value) => {
    if (Math.abs(value) >= 1000000) return "Rs. " + (value / 1000000).toFixed(1) + "M";
    if (Math.abs(value) >= 1000) return "Rs. " + (value / 1000).toFixed(0) + "K";
    return "Rs. " + value;
  };

  const tooltipStyle = { contentStyle: { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: 'white' }, labelStyle: { fontWeight: 'bold', fontSize: '11px', color: '#94a3b8' }, itemStyle: { fontSize: '11px', color: 'white' } };

  const formatDateStr = (dateStr) => {
    if (!dateStr) return "All";
    // Parse as UTC to avoid timezone day-shift on YYYY-MM-DD strings
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${String(d).padStart(2, '0')} ${monthNames[m - 1]} ${y}`;
  };

  const DEFAULT_GRANULARITY = "Month";
  const DEFAULT_START_DATE = "2024-01-01";
  const DEFAULT_END_DATE = "";

  const loadSalesChartData = (nextGranularity, nextStartDate, nextEndDate) => {
    setChartLoading(true);
    return getSalesTimeseries({
      granularity: nextGranularity.toLowerCase(),
      start_date: nextStartDate || undefined,
      end_date: nextEndDate || undefined,
    })
      .then((res) => {
        setMonthlyData(res.data || []);
        return true;
      })
      .catch(() => {
        toast.error("Failed to load chart data from uploaded sales.");
        return false;
      })
      .finally(() => setChartLoading(false));
  };

  const handleApplyFilter = () => {
    // Reject empty / invalid date values (browser returns "" for impossible dates like Feb 30)
    if (!startDate) {
      toast.error("Please enter a valid start date.");
      return;
    }
    if (endDate && startDate > endDate) {
      toast.error("Start date must be on or before the end date.");
      return;
    }
    loadSalesChartData(granularity, startDate, endDate).then((loaded) => {
      if (!loaded) return;
      setActiveGranularity(granularity);
      setActiveStartDate(startDate);
      setActiveEndDate(endDate);
      toast.success("Filters applied successfully.");
    });
  };

  const handleResetFilter = () => {
    setGranularity(DEFAULT_GRANULARITY);
    setStartDate(DEFAULT_START_DATE);
    setEndDate(DEFAULT_END_DATE);
    loadSalesChartData(DEFAULT_GRANULARITY, DEFAULT_START_DATE, DEFAULT_END_DATE).then((loaded) => {
      if (!loaded) return;
      setActiveGranularity(DEFAULT_GRANULARITY);
      setActiveStartDate(DEFAULT_START_DATE);
      setActiveEndDate(DEFAULT_END_DATE);
      toast.success("Filters reset to default.");
    });
  };

  const isFilterDirty =
    granularity !== DEFAULT_GRANULARITY ||
    startDate !== DEFAULT_START_DATE ||
    endDate !== DEFAULT_END_DATE;

  const displayEndDate = activeEndDate || (
    monthlyData.length > 0
      ? monthlyData[monthlyData.length - 1].period_start || monthlyData[monthlyData.length - 1].month
      : ""
  );

  const processedChartData = monthlyData;

  const openChartFullscreen = () => {
    setIsChartFullscreen(true);
  };

  const minimizeChartFullscreen = () => {
    setIsChartFullscreen(false);
  };

  const renderChartHeader = (fullscreen = false) => (
    <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h2 className={fullscreen ? "text-base font-bold" : "text-sm font-bold"} style={{ color: 'var(--text-primary)' }}>Revenue & Profit Analytics</h2>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {activeGranularity} view&nbsp;·&nbsp;
          {activeStartDate ? formatDateStr(activeStartDate) : "All"}
          {" → "}
          {displayEndDate ? formatDateStr(displayEndDate) : "All"}
        </p>
      </div>

      <div className="flex items-end gap-1.5 flex-nowrap shrink-0 overflow-x-auto pb-1 md:pb-0">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>View</span>
          <div className="relative w-[82px] shrink-0">
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="appearance-none h-8 w-full pl-2.5 pr-7 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer outline-none focus:border-emerald-400 transition-all duration-200"
            >
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month">Month</option>
              <option value="Year">Year</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-[var(--text-muted)]">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>Start Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-[122px] px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-emerald-400 transition-all duration-200 shrink-0"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>End Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-[122px] px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-emerald-400 transition-all duration-200 shrink-0"
          />
        </label>

        <button
          onClick={handleApplyFilter}
          disabled={chartLoading}
          className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-60 disabled:active:scale-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {chartLoading ? "Loading" : "Filter"}
        </button>

        <button
          onClick={handleResetFilter}
          disabled={chartLoading}
          title="Reset filters to default"
          className="h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-60 disabled:active:scale-100"
          style={{
            background: isFilterDirty ? 'rgba(239,68,68,0.12)' : 'var(--btn-ghost-bg)',
            border: isFilterDirty ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--btn-ghost-border)',
            color: isFilterDirty ? '#f87171' : 'var(--text-muted)',
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>

        <button
          onClick={fullscreen ? minimizeChartFullscreen : openChartFullscreen}
          title={fullscreen ? "Minimize chart" : "View chart full screen"}
          aria-label={fullscreen ? "Minimize full screen chart" : "Open full screen chart"}
          className={`${fullscreen ? "px-3" : "w-8"} h-8 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 shrink-0`}
          style={{
            background: 'var(--btn-ghost-bg)',
            border: '1px solid var(--btn-ghost-border)',
            color: 'var(--text-muted)',
          }}
        >
          {fullscreen ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3m8 0v-3a2 2 0 012-2h3" />
              </svg>
              Minimize
            </>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  const renderRevenueChart = (heightClass = "h-[460px]") => (
    <div className={`${heightClass} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={processedChartData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: labelColor }}
            axisLine={false}
            tickLine={false}
            height={45}
            interval={processedChartData.length > 15 ? Math.ceil(processedChartData.length / 8) : 0}
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
          <Tooltip
            {...tooltipStyle}
            labelFormatter={(label) => label}
            formatter={(value, name) => [value == null ? "No data" : formatCurrency(Number(value)), name]}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-body)' }} />
          <Line name="Revenue" type="monotone" dataKey="revenue" stroke="var(--accent-green)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-green)' }} activeDot={{ r: 5 }} />
          <Line name="Profit" type="monotone" dataKey="profit" stroke="var(--accent-cyan)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-cyan)' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  if (loading) return <LoadingSpinner label="Loading Executive Dashboard..." fullPage />;

  if (!overview || overview.total_products === 0) {
    return <EmptyState title="Dashboard is Empty" message="Upload a sales transaction CSV file to populate the executive dashboard metrics." actionText="Go to Upload" onAction={() => navigate("/upload")} />;
  }

  if (isChartFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] p-3 md:p-5 flex flex-col" style={{ background: 'var(--app-bg, #f8fafc)' }}>
        <div className="w-full h-full rounded-2xl p-4 md:p-6 flex flex-col" style={card}>
          {renderChartHeader(true)}
          {renderRevenueChart("flex-1 min-h-0")}
        </div>
      </div>
    );
  }

  const lightMode = theme === "light";
  const velocityCards = [
    { label: 'Fast Moving', count: overview.fast_moving_count, badge: 'High Velocity', letter: 'F', color: lightMode ? '#059669' : 'var(--accent-green)', bg: lightMode ? 'rgba(5,150,105,0.12)' : 'rgba(16,185,129,0.1)', badgeBg: lightMode ? 'rgba(5,150,105,0.10)' : 'rgba(16,185,129,0.12)', badgeColor: lightMode ? '#059669' : 'var(--accent-green-text)', badgeBorder: lightMode ? 'rgba(5,150,105,0.28)' : 'rgba(16,185,129,0.22)' },
    { label: 'Medium Moving', count: overview.medium_moving_count, badge: 'Stable', letter: 'M', color: lightMode ? '#0891b2' : 'var(--accent-cyan)', bg: lightMode ? 'rgba(8,145,178,0.12)' : 'rgba(6,182,212,0.1)', badgeBg: lightMode ? 'rgba(8,145,178,0.10)' : 'rgba(6,182,212,0.12)', badgeColor: lightMode ? '#0891b2' : 'var(--accent-cyan-text)', badgeBorder: lightMode ? 'rgba(8,145,178,0.28)' : 'rgba(6,182,212,0.22)' },
    { label: 'Slow Moving', count: overview.slow_moving_count, badge: 'Promote', letter: 'S', color: lightMode ? '#d97706' : '#f59e0b', bg: lightMode ? 'rgba(217,119,6,0.12)' : 'rgba(245,158,11,0.1)', badgeBg: lightMode ? 'rgba(217,119,6,0.10)' : 'rgba(245,158,11,0.12)', badgeColor: lightMode ? '#d97706' : '#fbbf24', badgeBorder: lightMode ? 'rgba(217,119,6,0.28)' : 'rgba(245,158,11,0.22)' },
  ];

  const alertCards = importantAlerts.filter((alert) => alert.item);

  return (
    <div className="space-y-7 flex-1 flex flex-col">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        <StatCard label="Total Revenue" number={formatCurrency(overview.total_revenue)} trend="Store Live" trendColor="emerald"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard label="Total Profit" number={formatCurrency(overview.total_profit)} trend={`${Math.round((overview.total_profit / overview.total_revenue) * 100)}% Margin`} trendColor="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard label="Units Sold" number={overview.total_sales.toLocaleString()} trend="Quantity" trendColor="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />
        <StatCard label="Invoices Count" number={overview.total_invoices.toLocaleString()} trend="Unique Sales" trendColor="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        />
        <StatCard label="Total Predicted Bundles" number={overview.total_recommended_bundles} trend="Model Output" trendColor="emerald"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Velocity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {velocityCards.map((v) => (
          <div key={v.label} className="glass-card p-5 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 group"
            style={{
              borderLeft: `2px solid ${v.color}`,
              '--glow-color': v.bg
            }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-transform duration-300 group-hover:scale-110" style={{ background: v.bg, color: v.color }}>{v.letter}</div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: v.color }}>{v.label}</p>
                <h3 className="text-xl font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>{v.count} Products</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>Today</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: v.badgeBg, color: v.badgeColor, border: `1px solid ${v.badgeBorder}` }}>{v.badge}</span>
          </div>
        ))}
      </div>

      {/* Sales Revenue Chart Card (Full Width) */}
      <div className="w-full rounded-2xl p-6 flex flex-col" style={card}>
        <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Revenue & Profit Analytics</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {activeGranularity} view&nbsp;·&nbsp;
              {activeStartDate ? formatDateStr(activeStartDate) : "All"}
              {" → "}
              {displayEndDate ? formatDateStr(displayEndDate) : "All"}
            </p>
          </div>

          {/* Filter Section */}
          <div className="flex items-end gap-1.5 flex-nowrap shrink-0">
            {/* Granularity Dropdown */}
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>View</span>
              <div className="relative w-[82px] shrink-0">
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value)}
                  className="appearance-none h-8 w-full pl-2.5 pr-7 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer outline-none focus:border-emerald-400 transition-all duration-200"
                >
                  <option value="Day">Day</option>
                  <option value="Week">Week</option>
                  <option value="Month">Month</option>
                  <option value="Year">Year</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-[var(--text-muted)]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </label>

            {/* Start Date */}
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-[122px] px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-emerald-400 transition-all duration-200 shrink-0"
              />
            </label>

            {/* End Date */}
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-[122px] px-2 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] font-bold text-xs outline-none focus:border-emerald-400 transition-all duration-200 shrink-0"
              />
            </label>

            {/* Filter Apply Button */}
            <button
              onClick={handleApplyFilter}
              disabled={chartLoading}
              className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-60 disabled:active:scale-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {chartLoading ? "Loading" : "Filter"}
            </button>

            {/* Reset Button */}
            <button
              onClick={handleResetFilter}
              disabled={chartLoading}
              title="Reset filters to default"
              className="h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-60 disabled:active:scale-100"
              style={{
                background: isFilterDirty ? 'rgba(239,68,68,0.12)' : 'var(--btn-ghost-bg)',
                border: isFilterDirty ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--btn-ghost-border)',
                color: isFilterDirty ? '#f87171' : 'var(--text-muted)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>

            <button
              onClick={openChartFullscreen}
              title="View chart full screen"
              aria-label="Open full screen chart"
              className="h-8 w-8 rounded-lg font-bold text-xs flex items-center justify-center active:scale-95 transition-all duration-150 shrink-0"
              style={{
                background: 'var(--btn-ghost-bg)',
                border: '1px solid var(--btn-ghost-border)',
                color: 'var(--text-muted)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3" />
              </svg>
            </button>
          </div>
        </div>
        <div className="h-[460px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedChartData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: labelColor }}
                axisLine={false}
                tickLine={false}
                height={45}
                interval={processedChartData.length > 15 ? Math.ceil(processedChartData.length / 8) : 0}
              >
                <Label value="Time Period" offset={0} position="insideBottom" style={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--text-muted)' }} />
              </XAxis>
              {/* Single Y-Axis */}
              <YAxis
                tick={{ fontSize: 10, fill: labelColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                width={75}
              >
                <Label value="Revenue / Profit (Rs.)" angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fontWeight: 'bold', textAnchor: 'middle', fill: 'var(--text-muted)' }} />
              </YAxis>
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(label) => label}
                formatter={(value, name) => [value == null ? "No data" : formatCurrency(Number(value)), name]}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-body)' }} />
              {/* Both lines mapped to the same left Y-Axis */}
              <Line name="Revenue" type="monotone" dataKey="revenue" stroke="var(--accent-green)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-green)' }} activeDot={{ r: 5 }} />
              <Line name="Profit" type="monotone" dataKey="profit" stroke="var(--accent-cyan)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-cyan)' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights & Category Share Row (Side-by-side) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Important Alert */}
        <div className="rounded-2xl p-6 flex flex-col justify-between xl:col-span-1" style={card}>
          <div className="flex-1 flex flex-col">
            <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Important Alert</h2>
            <p className="text-[11px] mb-5" style={{ color: 'var(--text-muted)' }}>
              Daily movement priorities for {formatDateStr(todayStr)}.
            </p>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
              {alertCards.map((alert) => {
                const item = alert.item;
                const isBundle = alert.type === "bundle";
                const isFast = alert.type === "fast";
                const style = isBundle
                  ? { background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)', color: 'var(--accent-cyan-text)' }
                  : isFast
                    ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', color: 'var(--accent-green-text)' }
                    : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' };
                if (isBundle) {
                  return (
                    <div key={alert.type} className="rounded-xl p-4 text-[11px] leading-relaxed" style={style}>
                      <div className="flex items-start gap-3">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wider">{alert.title}</p>
                          <h3 className="mt-1 text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
                            Bundle #{item.bundle_id}
                          </h3>
                          <p className="mt-0.5 font-semibold" style={{ color: 'var(--text-body)' }}>
                            {item.product_count} products · {item.fast_product_count} fast / {item.slow_product_count} slow
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                          <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Lift</p>
                          <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{item.lift.toFixed(2)}x</p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                          <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Confidence</p>
                          <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{Math.round(item.confidence * 100)}%</p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                          <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Profit</p>
                          <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.estimated_profit)}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={alert.type} className="rounded-xl p-4 text-[11px] leading-relaxed" style={style}>
                    <div className="flex items-start gap-3">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isFast ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider">{alert.title}</p>
                        <h3 className="mt-1 text-sm font-extrabold truncate" style={{ color: 'var(--text-primary)' }} title={item.product_name}>
                          {item.product_name}
                        </h3>
                        <p className="mt-0.5 font-semibold" style={{ color: 'var(--text-body)' }}>{item.category}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Confidence</p>
                        <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{Math.round(item.movement_confidence * 100)}%</p>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Total Sold</p>
                        <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{(item.overall_quantity ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-label)' }}>Revenue</p>
                        <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.expected_revenue)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {alertsLoading && alertCards.length === 0 && (
                <LoadingSpinner label="Loading important alerts..." />
              )}
              {!alertsLoading && alertCards.length === 0 && (
                <div className="rounded-xl p-4 text-[11px] font-semibold" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)', color: 'var(--text-muted)' }}>
                  No daily movement alerts found for {formatDateStr(todayStr)}.
                </div>
              )}
            </div>
          </div>
          <div className="pt-5 mt-5 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--divider)' }}>
            <button onClick={() => navigate("/bundles")} className="flex items-center justify-center rounded-xl text-white font-bold text-xs py-3 transition-all duration-200 active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-cyan))', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' }}>
              Bundles
            </button>
            <button onClick={() => navigate("/fast-slow")} className="flex items-center justify-center rounded-xl font-bold text-xs py-3 transition-all duration-200 active:scale-95 hover:bg-[var(--btn-ghost-bg-hover)]"
              style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body-strong)' }}>
              Product Movement
            </button>
          </div>
        </div>

        {/* Category Share Performance */}
        <div className="rounded-2xl p-6 flex flex-col justify-between xl:col-span-2" style={card}>
          <div className="mb-5">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Product Category Performance</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Revenue distribution by retail product category</p>
          </div>
          <div className="h-[340px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 15, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis
                  dataKey="category"
                  height={70}
                  tick={{ fontSize: 9, fill: labelColor }}
                  angle={-20}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                >
                  <Label value="Product Categories" offset={0} position="insideBottom" style={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--text-muted)' }} />
                </XAxis>
                <YAxis
                  tick={{ fontSize: 10, fill: labelColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatYAxis}
                  width={75}
                >
                  <Label value="Revenue (Rs.)" angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fontWeight: 'bold', textAnchor: 'middle', fill: 'var(--text-muted)' }} />
                </YAxis>
                <Tooltip {...tooltipStyle} cursor={{ fill: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)', radius: 6 }} />
                <Bar name="Revenue" dataKey="revenue" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top-Selling Products Table Row (Full Width) */}
      <div className="w-full rounded-2xl p-6 flex flex-col" style={card}>
        <div className="mb-5 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Top Performing Products Leaderboard</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Overview of the top 10 retail items ranked by total profit</p>
          </div>
          <button onClick={() => navigate("/reports")} className="text-[11px] font-bold transition-colors" style={{ color: 'var(--accent-green)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-green-text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--accent-green)'}>
            View All →
          </button>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider)' }}>
                {['Rank', 'Product Name', 'Category', 'Sold Qty', 'Revenue', 'Profit'].map(h => {
                  const isNumeric = ['Sold Qty', 'Revenue', 'Profit'].includes(h);
                  return (
                    <th
                      key={h}
                      className={`pb-3 pr-3 text-[10px] font-bold uppercase tracking-wider ${isNumeric ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--text-label)' }}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {topProducts.slice(0, 10).map((prod, index) => (
                <tr key={prod.product_id} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: '1px solid var(--divider-subtle)' }}>
                  <td className="py-3.5 font-bold" style={{ color: 'var(--text-muted)' }}>#{index + 1}</td>
                  <td className="py-3.5 pr-3 font-bold max-w-[280px] truncate" style={{ color: 'var(--text-primary)' }}>{prod.product_name}</td>
                  <td className="py-3.5 pr-3" style={{ color: 'var(--text-body)' }}>{prod.category}</td>
                  <td className="py-3.5 pr-3 text-right" style={{ color: 'var(--text-body-strong)' }}>{prod.quantity_sold.toLocaleString()}</td>
                  <td className="py-3.5 pr-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(prod.revenue)}</td>
                  <td className="py-3.5 text-right font-bold" style={{ color: 'var(--accent-green-text)' }}>{formatCurrency(prod.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
