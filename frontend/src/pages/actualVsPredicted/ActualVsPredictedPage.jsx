import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Label } from "recharts";
import toast from "react-hot-toast";
import { useTheme } from "../../context/ThemeContext";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import StatCard from "../../components/shared/StatCard";
import { getActualVsPredicted, getFutureForecast, getComparisonDefaults } from "../../services/forecastService";

const cardStyle = {
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "1rem",
  backdropFilter: "blur(10px)",
  boxShadow: "var(--card-shadow)",
};

const ActualVsPredictedPage = () => {
  const { theme } = useTheme();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const getTodayStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Filters
  const [viewType, setViewType] = useState("weekly"); // default to weekly
  const [targetMetric, setTargetMetric] = useState("transactions"); // transactions, quantity_sold
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const chartGrid = theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
  const tooltipBg = theme === "dark" ? "#0c1120" : "#1e293b";
  const tooltipBorder = theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
  const labelColor = theme === "dark" ? "#94a3b8" : "#475569";

  const fetchComparison = (initial = false) => {
    if (!startDate || !endDate) {
      return toast.error("Please enter a valid date range.");
    }
    if (startDate > endDate) {
      return toast.error("Start date must be before or equal to end date.");
    }
    
    setLoading(true);
    getActualVsPredicted({
      start_date: startDate,
      end_date: endDate,
      view: viewType,
      target: targetMetric,
    })
      .then((res) => {
        setData(res.data.data || []);
        setSummary(res.data.summary || null);
        if (!initial) {
          toast.success("Comparison timeline updated.");
        }
      })
      .catch((err) => {
        console.error(err);
        const errMsg = err.response?.data?.detail || "Failed to load actual vs predicted data.";
        toast.error(errMsg);
      })
      .finally(() => setLoading(false));
  };

  // Load dynamic date defaults on mount
  useEffect(() => {
    getComparisonDefaults()
      .then((res) => {
        setStartDate(res.data.oldest_actual_date);
        setEndDate(res.data.tomorrow_date);
        setDefaultsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load date defaults:", err);
        setStartDate("2024-01-01");
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        setEndDate(tom.toISOString().split("T")[0]);
        setDefaultsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (defaultsLoaded) {
      fetchComparison(true);
    }
  }, [viewType, targetMetric, defaultsLoaded]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchComparison();
  };

  const handleReset = () => {
    setViewType("weekly");
    setTargetMetric("transactions");
    setLoading(true);
    getComparisonDefaults()
      .then((res) => {
        setStartDate(res.data.oldest_actual_date);
        setEndDate(res.data.tomorrow_date);
      })
      .catch(() => {
        setStartDate("2024-01-01");
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        setEndDate(tom.toISOString().split("T")[0]);
      })
      .finally(() => {
        setLoading(false);
        setTimeout(() => {
          fetchComparison();
        }, 50);
      });
  };

  // Format error sign (+ or -)
  const formatError = (error) => {
    if (error === null || error === undefined) return "—";
    if (error > 0) return `+${error.toLocaleString()}`;
    return error.toLocaleString();
  };

  const exportComparisonCSV = () => {
    if (!data || !data.length) {
      return toast.error("No comparison data available to export.");
    }

    const headers = "Period,Predicted,Actual,Error,Error %,Result,Coverage Days,Forecast Days\n";
    const rows = data.map((d) => {
      const label = d.period_label || d.date;
      const actualVal = d.actual !== null ? d.actual : "—";
      const errVal = d.error !== null ? d.error : "—";
      const errPct = d.error_percentage !== null ? `${d.error_percentage}%` : "—";
      return `"${label}",${d.predicted},${actualVal},${errVal},${errPct},"${d.result}",${d.actual_coverage_days},${d.forecast_days}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bundlemind_actual_vs_predicted_${viewType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tooltipStyle = {
    contentStyle: { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "12px", color: "white" },
    labelStyle: { fontWeight: "bold", fontSize: "11px", color: "#94a3b8" },
    itemStyle: { fontSize: "11px", color: "white" },
  };

  return (
    <div className="space-y-7 flex-1 flex flex-col">
      {/* Parameter Panel */}
      <div className="rounded-2xl p-6" style={cardStyle}>
        <form onSubmit={handleFilterSubmit} className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            {/* View Resolution */}
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

            {/* Target Metric Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                Target Metric
              </label>
              <select
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value)}
                className="h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 text-xs font-bold outline-none focus:border-emerald-400 text-[var(--text-primary)] transition-all"
              >
                <option value="transactions">Transactions</option>
                <option value="quantity_sold">Quantity Sold</option>
              </select>
            </div>

            {/* Start Date */}
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

            {/* End Date */}
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
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 active:scale-95 transition-all disabled:opacity-50"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="h-10 px-5 rounded-xl border border-[var(--btn-ghost-border)] bg-[var(--btn-ghost-bg)] hover:bg-[var(--btn-ghost-bg-hover)] text-[var(--text-body-strong)] font-bold text-xs transition-all"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading comparison timeline..." fullPage />
      ) : data.length === 0 ? (
        <EmptyState
          title="No Comparison Data"
          message="No saved predictions match the selected date range. Ensure predictions were generated for this period."
        />
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <StatCard
                label="Actual Total (Matched)"
                number={summary.actual_total.toLocaleString()}
                trend={`${summary.matched_dates} matched days`}
                trendColor="emerald"
              />
              <StatCard
                label="Matched Predicted Total"
                number={summary.matched_predicted_total.toLocaleString()}
                trend={`vs ${summary.actual_total.toLocaleString()} actual`}
                trendColor="blue"
              />
              <StatCard
                label="Forecast Accuracy"
                number={`${summary.forecast_accuracy}%`}
                trend={`MAPE: ${summary.mape}%`}
                trendColor={summary.forecast_accuracy > 80 ? "emerald" : "yellow"}
              />
              <StatCard
                label="Average Error (MAE)"
                number={summary.average_forecast_error.toLocaleString()}
                trend={`Bias: ${formatError(summary.forecast_bias)}`}
                trendColor={Math.abs(summary.forecast_bias) < 50 ? "emerald" : "yellow"}
              />
            </div>
          )}

          {/* Chart Section */}
          <div className="rounded-2xl p-6 flex flex-col" style={cardStyle}>
            <div className="mb-5">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Actual vs Predicted Timeline</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Comparing actual sales data with saved model predictions ({viewType} view for {targetMetric})
              </p>
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 15, right: 15, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="period_label" tick={{ fontSize: 9, fill: labelColor }} axisLine={false} tickLine={false} height={40}>
                    <Label value="Time Period" offset={0} position="insideBottom" style={{ fontSize: 10, fontWeight: "bold", fill: "var(--text-muted)" }} />
                  </XAxis>
                  <YAxis tick={{ fontSize: 10, fill: labelColor }} axisLine={false} tickLine={false} width={60}>
                    <Label
                      value={targetMetric === "transactions" ? "Transactions" : "Quantity Sold"}
                      angle={-90}
                      position="insideLeft"
                      offset={10}
                      style={{ fontSize: 10, fontWeight: "bold", textAnchor: "middle", fill: "var(--text-muted)" }}
                    />
                  </YAxis>
                  <Tooltip
                    {...tooltipStyle}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      const hasActual = item.has_actual;
                      return (
                        <div className="rounded-xl p-3.5 space-y-1.5 shadow-lg border text-xs" style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: "white" }}>
                          <p className="font-bold text-[#94a3b8]">Period: {label}</p>
                          <p className="font-semibold text-emerald-400">
                            Predicted: {item.predicted.toLocaleString()}
                            {item.is_partial_forecast_period && (
                              <span className="text-[10px] font-normal text-amber-400 ml-1">
                                ({item.forecast_days} of {item.calendar_days} days available)
                              </span>
                            )}
                          </p>
                          {hasActual ? (
                            <>
                              <p className="font-semibold text-cyan-400">
                                Actual: {item.actual.toLocaleString()}
                                {item.is_partial_actual_period && (
                                  <span className="text-[10px] font-normal text-yellow-400 ml-1">
                                    ({item.actual_coverage_days} of {item.forecast_days} days available)
                                  </span>
                                )}
                              </p>
                              <p className="font-semibold text-slate-300">Error: {formatError(item.error)}</p>
                            </>
                          ) : (
                            <p className="font-semibold text-slate-400">Actual: Awaiting uploaded data</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  
                  {/* Predicted Line (solid) */}
                  <Line
                    name="Predicted"
                    type="monotone"
                    dataKey="predicted"
                    stroke="var(--accent-cyan)"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />

                  {/* Actual Line (solid, will break or show nulls automatically in recharts) */}
                  <Line
                    name="Actual"
                    type="monotone"
                    dataKey="actual"
                    stroke="var(--accent-green)"
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table Section */}
          <div className="w-full rounded-2xl p-6 flex flex-col" style={cardStyle}>
            <div className="mb-5 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Detailed Schedule & Coverage</h2>
                <p className="text-[11px] text-[var(--text-muted)]">Comparison metrics and data completeness breakdown</p>
              </div>
              <button
                onClick={exportComparisonCSV}
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
                      Predicted
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Actual
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Error
                    </th>
                    <th className="pb-3 text-right font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Error %
                    </th>
                    <th className="pb-3 text-center font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, idx) => {
                    const label = d.period_label || d.date;
                    const hasActual = d.has_actual;
                    
                    let badgeColor = "text-slate-500 bg-slate-100 dark:bg-slate-800/80 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                    if (hasActual) {
                      if (d.result === "Overpredicted") {
                        badgeColor = "text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:text-amber-400 border-amber-200 dark:border-amber-900/30";
                      } else if (d.result === "Underpredicted") {
                        badgeColor = "text-blue-600 bg-blue-50 dark:bg-blue-900/10 dark:text-blue-400 border-blue-200 dark:border-blue-900/30";
                      } else if (d.result === "Accurate") {
                        badgeColor = "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30";
                      }
                    }

                    return (
                      <tr key={idx} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: "1px solid var(--divider-subtle)" }}>
                        <td className="py-3 font-bold text-[var(--text-primary)]">
                          {label}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-[var(--text-body-strong)]">{d.predicted.toLocaleString()}</span>
                            {d.is_partial_forecast_period && (
                              <span className="text-[10px] text-amber-500 font-normal">
                                {d.forecast_days} of {d.calendar_days} forecast days available
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          {hasActual ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-[var(--text-body-strong)]">{d.actual.toLocaleString()}</span>
                              {d.is_partial_actual_period && (
                                <span className="text-[10px] text-yellow-500 font-normal">
                                  {d.actual_coverage_days} of {d.forecast_days} actual days available
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className={`py-3 text-right font-semibold ${hasActual ? (d.error > 0 ? "text-amber-500" : "text-blue-500") : "text-[var(--text-muted)]"}`}>
                          {formatError(d.error)}
                        </td>
                        <td className="py-3 text-right font-semibold text-[var(--text-body)]">
                          {d.error_percentage !== null ? `${d.error_percentage}%` : "—"}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                            {d.result}
                          </span>
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

export default ActualVsPredictedPage;
