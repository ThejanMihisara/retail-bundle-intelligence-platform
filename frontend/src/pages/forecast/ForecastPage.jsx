import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import StatCard from "../../components/shared/StatCard";
import { getDemandForecast, getForecastSummary } from "../../services/forecastService";

const ForecastPage = () => {
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forecasting, setForecasting] = useState(false);

  // Filter inputs
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [projectionMonths, setProjectionMonths] = useState(6);

  const fetchMetadata = () => {
    // We can fetch categories from forecast/sales endpoints
    // Note: getSalesCategories was imported from forecastService, wait, is it in forecastService?
    // Let's check: forecastService exports getForecastSummary, getDemandForecast, etc.
    // Let's import getSalesCategories from salesService instead! That is much cleaner.
    // Yes! Let's import getSalesCategories from salesService.
    Promise.all([
      getForecastSummary()
    ])
      .then(([sumRes]) => {
        setSummary(sumRes.data);
      })
      .catch(() => toast.error("Failed to load forecast summary."))
      .finally(() => setLoading(false));
  };

  // Re-fetch categories on load
  useEffect(() => {
    // Import categories from window/API
    import("../../services/salesService").then(({ getSalesCategories }) => {
      getSalesCategories().then(res => setCategories(res.data)).catch(() => {});
    });
    fetchMetadata();
    runForecast(true);
  }, []);

  const runForecast = (initial = false) => {
    setForecasting(true);
    const params = {
      months: projectionMonths,
      ...(searchProduct && { product_id: searchProduct }),
      ...(selectedCategory && { category: selectedCategory })
    };

    getDemandForecast(params)
      .then((res) => {
        setForecastResult(res.data);
        if (!initial) {
          toast.success("Prediction model completed successfully.");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Prediction failed. Verify product code or connection.");
      })
      .finally(() => setForecasting(false));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    runForecast();
  };

  const handleReset = () => {
    setSearchProduct("");
    setSelectedCategory("");
    setProjectionMonths(6);
    setTimeout(() => {
      runForecast();
    }, 50);
  };

  const formatCurrency = (value) => {
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const exportForecast = () => {
    if (!forecastResult || !forecastResult.forecast.length) {
      return toast.error("Generate forecast first.");
    }
    const csv = [
      "Month,Projected Quantity,Projected Revenue,Projected Profit,Confidence Lower,Confidence Upper",
      ...forecastResult.forecast.map(
        (f) => `${f.month},${f.quantity},${f.revenue},${f.profit},${f.confidence_lower},${f.confidence_upper}`
      )
    ].join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bundlemind_forecast_${selectedCategory || searchProduct || "store"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingSpinner label="Initializing forecasting environment..." fullPage />;
  }

  // Prep chart data
  const chartData = [];
  if (forecastResult) {
    forecastResult.historical.forEach((h) => {
      chartData.push({
        month: h.month,
        historical_revenue: h.revenue,
        historical_qty: h.quantity,
        type: "Historical"
      });
    });
    
    // Connect historical to forecast visually
    if (forecastResult.historical.length > 0 && forecastResult.forecast.length > 0) {
      const lastHist = forecastResult.historical[forecastResult.historical.length - 1];
      chartData.push({
        month: lastHist.month,
        forecasted_revenue: lastHist.revenue,
        forecasted_qty: lastHist.quantity,
        type: "Historical"
      });
    }

    forecastResult.forecast.forEach((f) => {
      chartData.push({
        month: f.month,
        forecasted_revenue: f.revenue,
        forecasted_qty: f.quantity,
        type: "Forecasted"
      });
    });
  }

  // Financial overview values
  const projectedRev = forecastResult ? forecastResult.forecast.reduce((sum, f) => sum + f.revenue, 0) : 0;
  const projectedProf = forecastResult ? forecastResult.forecast.reduce((sum, f) => sum + f.profit, 0) : 0;
  const projectedQty = forecastResult ? forecastResult.forecast.reduce((sum, f) => sum + f.quantity, 0) : 0;

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Search and Parameter Panel */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Code (ID)</label>
            <input
              type="text"
              placeholder="e.g. 1479"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={searchProduct}
              onChange={(e) => {
                setSearchProduct(e.target.value);
                setSelectedCategory(""); // Mutually exclusive
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Store Category</label>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSearchProduct(""); // Mutually exclusive
              }}
            >
              <option value="">Whole Store</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Forecast Horizon</label>
            <select
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={projectionMonths}
              onChange={(e) => setProjectionMonths(Number(e.target.value))}
            >
              <option value="3">Next 3 Months</option>
              <option value="6">Next 6 Months</option>
              <option value="12">Next 12 Months</option>
            </select>
          </div>

          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={forecasting}
              className="h-10 flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {forecasting ? "Projecting..." : "Generate Forecast"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Overview Stat Cards */}
      {forecastResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Projected Revenue"
            number={formatCurrency(projectedRev)}
            trend={`Over Next ${projectionMonths}M`}
            trendColor="emerald"
          />
          <StatCard
            label="Projected Profit Contribution"
            number={formatCurrency(projectedProf)}
            trend={`${Math.round(projectedRev ? (projectedProf / projectedRev) * 100 : 0)}% Margin`}
            trendColor="blue"
          />
          <StatCard
            label="Projected Volume (Units)"
            number={Math.round(projectedQty).toLocaleString()}
            trend="Demand Units"
            trendColor="yellow"
          />
        </div>
      )}

      {/* Main Forecast Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-800">Demand Forecasting Model</h2>
              <p className="text-xs text-slate-400">
                Projected demand for {forecastResult?.product_name || selectedCategory || "Whole Store"}
              </p>
            </div>
            {forecastResult && (
              <button
                onClick={exportForecast}
                className="text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Export CSV
              </button>
            )}
          </div>

          <div className="h-80 w-full flex-1">
            {forecasting ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner label="Running statistical regression..." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: 'white' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#cbd5e1' }}
                    itemStyle={{ fontSize: '12px', color: 'white' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line name="Historical Revenue" type="monotone" dataKey="historical_revenue" stroke="#94a3b8" strokeWidth={3} dot={{ r: 4 }} />
                  <Line name="Forecasted Revenue" type="monotone" dataKey="forecasted_revenue" stroke="#10b981" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Forecast Insights Box */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3">Model Parameters & Logic</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              When standard forecasting pickels are missing, BundleMind runs an advanced statistical forecasting module 
              that fits the historical monthly data using a three-factor time-series approach:
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Moving Average Base</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Estimates the baseline transaction volume level.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-blue-50 text-blue-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">MoM Linear Trend</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Estimates month-over-month sales trends and growth trajectory.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-purple-50 text-purple-500 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Sinusoidal Seasonality</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Adjusts predictions based on cyclical supermarket seasonal shifts.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-[10px] text-slate-400 leading-relaxed mt-6">
            Forecast parameters are computed dynamically in Python and are timezone-standardized.
          </div>
        </div>
      </div>

      {/* Forecast Output Table */}
      {forecastResult && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Detailed Monthly Demand Schedule</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                  <th className="pb-3">Projected Month</th>
                  <th className="pb-3 text-right">Predicted Quantity (Units)</th>
                  <th className="pb-3 text-right">Projected Revenue</th>
                  <th className="pb-3 text-right">Projected Profit Margin</th>
                  <th className="pb-3 text-right">Confidence Interval (Lower)</th>
                  <th className="pb-3 text-right">Confidence Interval (Upper)</th>
                  <th className="pb-3 text-center">Stock Advice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {forecastResult.forecast.map((f, idx) => {
                  let stockAdvice = "Maintain Stock";
                  let stockColor = "text-slate-500 bg-slate-50";
                  
                  // Compute simple direction
                  const prevVal = idx > 0 ? forecastResult.forecast[idx-1].quantity : forecastResult.historical[forecastResult.historical.length-1]?.quantity;
                  if (prevVal) {
                    if (f.quantity > prevVal * 1.05) {
                      stockAdvice = "Increase Stock";
                      stockColor = "text-emerald-600 bg-emerald-50";
                    } else if (f.quantity < prevVal * 0.95) {
                      stockAdvice = "Reduce Stock";
                      stockColor = "text-amber-600 bg-amber-50";
                    }
                  }

                  return (
                    <tr key={f.month} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-bold text-slate-700">{f.month}</td>
                      <td className="py-3.5 text-right">{Math.round(f.quantity).toLocaleString()}</td>
                      <td className="py-3.5 text-right font-bold text-slate-800">{formatCurrency(f.revenue)}</td>
                      <td className="py-3.5 text-right font-bold text-emerald-500">{formatCurrency(f.profit)}</td>
                      <td className="py-3.5 text-right text-slate-400">{Math.round(f.confidence_lower).toLocaleString()} units</td>
                      <td className="py-3.5 text-right text-slate-400">{Math.round(f.confidence_upper).toLocaleString()} units</td>
                      <td className="py-3.5 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${stockColor}`}>
                          {stockAdvice}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForecastPage;
