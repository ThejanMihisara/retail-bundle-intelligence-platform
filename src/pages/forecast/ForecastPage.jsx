import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { getForecastProducts, runForecast } from "../../services/forecastService";

const ForecastPage = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [horizon, setHorizon] = useState(30);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getForecastProducts().then((res) => {
      setProducts(res.data || []);
      setSelectedProduct(res.data?.[0] || "");
    }).catch((error) => {
      toast.error(error.response?.data?.detail || "Unable to load forecast products");
      setProducts([]);
    });
  }, []);

  const chartData = forecastData ? [
    ...forecastData.historical.map((item) => ({ date: item.date, historical: item.quantity })),
    ...forecastData.forecast.map((item) => ({ date: item.date, forecast: item.yhat })),
  ] : [];

  const run = async () => {
    setLoading(true);
    try {
      const res = await runForecast({ product_name: selectedProduct, horizon_days: Number(horizon) });
      setForecastData(res.data);
      toast.success("Forecast generated");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Forecast failed");
    } finally {
      setLoading(false);
    }
  };

  const exportForecast = () => {
    if (!forecastData) return toast.error("Run forecast first");
    const csv = ["Date,Yhat,Yhat Lower,Yhat Upper", ...forecastData.forecast.map((r) => `${r.date},${r.yhat},${r.yhat_lower},${r.yhat_upper}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "forecast.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[2fr_0.85fr] gap-6">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0f172a]">Future Demand Prediction</h2>
          <p className="text-sm text-[#64748b]">Forecast generated using historical sales</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" hide /><YAxis hide /><Tooltip />
                <Line dataKey="historical" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "white", stroke: "#2563eb" }} />
                <Line dataKey="forecast" stroke="#2563eb" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, fill: "#2563eb" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0f172a]">Forecast Inputs</h2>
          <p className="text-sm text-[#64748b]">Model setup</p>
          <label className="block text-sm font-semibold text-[#64748b]">Product</label>
          <select className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>{products.map((product) => <option key={product}>{product}</option>)}</select>
          <label className="mt-4 block text-sm font-semibold text-[#64748b]">Horizon</label>
          <input className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4" type="number" min="7" max="90" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          <button className="mt-12 h-11 w-full rounded-lg bg-[#2563eb] font-semibold text-white" onClick={run} disabled={loading || !selectedProduct}>{loading ? <LoadingSpinner label="Running" /> : "Run Forecast"}</button>
          <button className="mt-4 h-11 w-full rounded-lg bg-[#16a34a] font-semibold text-white" onClick={exportForecast}>Export Forecast</button>
        </div>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Forecast Summary</h2>
        <p className="text-sm text-[#64748b]">Expected demand and confidence</p>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[#64748b]"><tr>{["Product", "Predicted Units", "Confidence", "Stock Advice"].map((h) => <th key={h} className="border border-[#e2e8f0] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="font-semibold text-[#0f172a]">
            {forecastData && <tr><td className="border border-[#e2e8f0] px-4 py-4">{forecastData.product_name}</td><td className="border border-[#e2e8f0] px-4 py-4">{forecastData.summary.predicted_total_units}</td><td className="border border-[#e2e8f0] px-4 py-4">{forecastData.summary.confidence_pct}%</td><td className="border border-[#e2e8f0] px-4 py-4">{forecastData.summary.stock_advice}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForecastPage;
