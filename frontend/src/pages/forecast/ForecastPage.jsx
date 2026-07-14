import { useEffect, useState } from "react";
import { Line, Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Label } from "recharts";
import toast from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import StatCard from "../../components/shared/StatCard";
import { getFutureForecast } from "../../services/forecastService";

const cardStyle = {
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "1rem",
  backdropFilter: "blur(10px)",
  boxShadow: "var(--card-shadow)",
};

const ForecastPage = () => {
  const { theme } = useTheme();
  const [forecastResult, setForecastResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [targetMetric, setTargetMetric] = useState("transactions"); // transactions or quantity_sold
  
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getFutureDateStr = (days) => {
    const today = new Date();
    today.setDate(today.getDate() + days);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filter states
  const [viewType, setViewType] = useState("daily"); // daily, weekly, monthly
  const [periodOption, setPeriodOption] = useState("30"); // 7, 14, 30, custom
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getFutureDateStr(30));

  const chartGrid = theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  const tooltipBg = theme === "dark" ? "#0c1120" : "#1e293b";
  const tooltipBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
  const labelColor = theme === "dark" ? "#94a3b8" : "#475569";

  const fetchForecast = (initial = false) => {
    setLoading(true);
    const params = {
      view: viewType,
    };

    if (periodOption === "custom") {
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    } else {
      params.days = Number(periodOption);
    }

    getFutureForecast(params)
      .then((res) => {
        setForecastResult(res.data || []);
        if (!initial) {
          toast.success("Predictions generated successfully.");
        }
      })
      .catch((err) => {
        console.error(err);
        const errMsg = err.response?.data?.detail || "Failed to generate forecasts.";
        toast.error(errMsg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchForecast(true);
  }, [viewType, periodOption]);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      return toast.error("Please specify both start and end dates.");
    }
    if (startDate > endDate) {
      return toast.error("Start date must be before or equal to end date.");
    }
    fetchForecast();
  };

  const handleReset = () => {
    setViewType("daily");
    setPeriodOption("30");
    setStartDate(getTodayStr());
    setEndDate(getFutureDateStr(30));
    toast.success("Filters reset to default.");
  };

  const exportForecastCSV = () => {
    if (!forecastResult || !forecastResult.length) {
      return toast.error("No forecast data available to export.");
    }

    const headers = "Period Label,Start Date,End Date,Predicted Transactions,Tx Lower,Tx Upper,Predicted Quantity,Qty Lower,Qty Upper\n";
    const rows = forecastResult.map((f) => {
      const label = f.period_label || f.forecast_date;
      const start = f.period_start || f.forecast_date;
      const end = f.period_end || f.forecast_date;
      return `"${label}",${start},${end},${f.predicted_transactions},${f.transaction_lower},${f.transaction_upper},${f.predicted_quantity_sold},${f.quantity_lower},${f.quantity_upper}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bundlemind_future_forecast_${viewType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculations for StatCards
  const totalTx = forecastResult.reduce((sum, f) => sum + f.predicted_transactions, 0);
  const totalQty = forecastResult.reduce((sum, f) => sum + f.predicted_quantity_sold, 0);

  // Map Recharts chart data
  const chartData = forecastResult.map((f) => {
    const label = f.period_label || f.forecast_date;
    return {
      name: label,
      predicted_transactions: f.predicted_transactions,
      transaction_lower: f.transaction_lower,
      transaction_upper: f.transaction_upper,
      predicted_quantity_sold: f.predicted_quantity_sold,
      quantity_lower: f.quantity_lower,
      quantity_upper: f.quantity_upper,
      tx_range: [f.transaction_lower, f.transaction_upper],
      qty_range: [f.quantity_lower, f.quantity_upper],
    };
  });

  const tooltipStyle = {
    contentStyle: { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "12px", color: "white" },
    labelStyle: { fontWeight: "bold", fontSize: "11px", color: "#94a3b8" },
    itemStyle: { fontSize: "11px", color: "white" },
  };

  return (
    <div className="space-y-7 flex-1 flex flex-col">
      {/* Search and Parameter Panel */}
      <div className="rounded-2xl p-6" style={cardStyle}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            {/* View Type Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                View Resolution
              </label>
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
                className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-xs font-bold outline-none focus:border-emerald-400 text-[var(--text-primary)] transition-all"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Quick Period Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                Forecast Period
              </label>
              <select
                value={periodOption}
                onChange={(e) => setPeriodOption(e.target.value)}
                className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-xs font-bold outline-none focus:border-emerald-400 text-[var(--text-primary)] transition-all"
              >
                <option value="7">Next 7 Days</option>
                <option value="14">Next 14 Days</option>
                <option value="30">Next 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Custom Start Date */}
            {periodOption === "custom" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-xs font-bold outline-none focus:border-emerald-400 text-[var(--text-primary)] transition-all"
                />
              </div>
            )}

            {/* Custom End Date */}
            {periodOption === "custom" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-xs font-bold outline-none focus:border-emerald-400 text-[var(--text-primary)] transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {periodOption === "custom" && (
              <button
                onClick={handleCustomSubmit}
                disabled={loading}
                className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Forecast"}
              </button>
            )}
            <button
              onClick={handleReset}
              className="h-10 px-5 rounded-xl border border-[var(--btn-ghost-border)] bg-[var(--btn-ghost-bg)] hover:bg-[var(--btn-ghost-bg-hover)] text-[var(--text-body-strong)] font-bold text-xs transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Generating future forecasts from hybrid model bundles..." fullPage />
      ) : forecastResult.length === 0 ? (
        <EmptyState
          title="No Forecast Generated"
          message="Adjust your dates or quick range parameters to generate a future forecast schedule."
        />
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              label="Total Projected Transactions"
              number={totalTx.toLocaleString()}
              trend="Transaction Count"
              trendColor="emerald"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <StatCard
              label="Total Projected Quantity Sold"
              number={totalQty.toLocaleString()}
              trend="Quantity Units"
              trendColor="yellow"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              }
            />
          </div>

          {/* Composed Chart Visualizer */}
          <div className="rounded-2xl p-6 flex flex-col" style={cardStyle}>
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Future Forecast Horizon</h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Ensemble predictions with confidence intervals ({viewType} view)
                </p>
              </div>

              {/* Target Selector tabs */}
              <div className="flex p-0.5 rounded-lg border border-[var(--divider)] bg-[var(--btn-ghost-bg)] select-none shrink-0 self-start">
                <button
                  onClick={() => setTargetMetric("transactions")}
                  className={`px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                    targetMetric === "transactions"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setTargetMetric("quantity_sold")}
                  className={`px-3 py-1.5 rounded-md font-bold text-xs transition-all ${
                    targetMetric === "quantity_sold"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Quantity Sold
                </button>
              </div>
            </div>

            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: labelColor }} axisLine={false} tickLine={false} height={40}>
                    <Label value="Time Period" offset={0} position="insideBottom" style={{ fontSize: 10, fontWeight: "bold", fill: "var(--text-muted)" }} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 10, fill: labelColor }} axisLine={false} tickLine={false} width={60}>
                    <Label
                      value={targetMetric === "transactions" ? "Transactions count" : "Quantity units"}
                      angle={-90}
                      position="insideLeft"
                      offset={10}
                      style={{ fontSize: 10, fontWeight: "bold", textAnchor: "middle", fill: "var(--text-muted)" }}
                    />
                  </YAxis>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name) => {
                      if (name === "Confidence Range") {
                        return [`${value[0].toLocaleString()} - ${value[1].toLocaleString()}`, "Range"];
                      }
                      return [value.toLocaleString(), name === "prediction" ? "Predicted" : name];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  
                  {/* Confidence Interval band */}
                  <Area
                    name="Confidence Range"
                    dataKey={targetMetric === "transactions" ? "tx_range" : "qty_range"}
                    fill={targetMetric === "transactions" ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)"}
                    stroke={targetMetric === "transactions" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />

                  {/* Point Forecast line */}
                  <Line
                    name="Prediction"
                    type="monotone"
                    dataKey={targetMetric === "transactions" ? "predicted_transactions" : "predicted_quantity_sold"}
                    stroke={targetMetric === "transactions" ? "var(--accent-green)" : "var(--accent-cyan)"}
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table Schedule */}
          <div className="w-full rounded-2xl p-6 flex flex-col" style={cardStyle}>
            <div className="mb-5 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Detailed Forecast Schedule</h2>
                <p className="text-[11px] text-[var(--text-muted)]">Granular predictions and uncertainty thresholds</p>
              </div>
              <button
                onClick={exportForecastCSV}
                className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                    <th className="pb-3 text-left font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Period
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Predicted Transactions
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Transactions Range
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Predicted Quantity
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Quantity Range
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forecastResult.map((f, idx) => {
                    const label = f.period_label || f.forecast_date;
                    return (
                      <tr key={idx} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: "1px solid var(--divider-subtle)" }}>
                        <td className="py-3 font-bold text-[var(--text-primary)]">
                          {label} {f.day_of_week && <span className="text-[10px] font-normal text-[var(--text-muted)]">({f.day_of_week})</span>}
                        </td>
                        <td className="py-3 text-right font-bold text-[var(--text-body-strong)]">
                          {f.predicted_transactions.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-[var(--text-muted)]">
                          {f.transaction_lower.toLocaleString()} – {f.transaction_upper.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-bold text-[var(--text-body-strong)]">
                          {f.predicted_quantity_sold.toLocaleString()}
                        </td>
                        <td className="py-3 text-right text-[var(--text-muted)]">
                          {f.quantity_lower.toLocaleString()} – {f.quantity_upper.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ForecastPage;
