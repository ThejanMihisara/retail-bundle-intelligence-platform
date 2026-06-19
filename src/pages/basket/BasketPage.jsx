import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { applyRules, generateRules, getRules } from "../../services/basketService";

const colors = ["border-orange-300 bg-[#fff7ed]", "border-yellow-300 bg-[#fefce8]", "border-emerald-300 bg-[#f0fdf4]"];

const BasketPage = () => {
  const [rules, setRules] = useState([]);
  const [thresholds, setThresholds] = useState({ minSupport: 0.05, minConfidence: 0.6, minLift: 1.2 });
  const [loading, setLoading] = useState("");

  useEffect(() => {
    getRules().then((res) => setRules(res.data.rules || [])).catch((error) => {
      toast.error(error.response?.data?.detail || "Unable to load association rules");
      setRules([]);
    });
  }, []);

  const generate = async () => {
    setLoading("generate");
    try {
      const res = await generateRules({ min_support: Number(thresholds.minSupport), min_confidence: Number(thresholds.minConfidence), min_lift: Number(thresholds.minLift) });
      setRules(res.data.rules || []);
      toast.success(`${res.data.rules_count} rules discovered!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Rule generation failed");
    } finally {
      setLoading("");
    }
  };

  const apply = async () => {
    setLoading("apply");
    try {
      await applyRules();
      toast.success("Rules applied successfully. Go to Bundles to view recommendations.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Apply rules failed");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="grid grid-cols-[2fr_0.9fr] gap-6">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Market Basket Analysis</h2>
        <p className="text-sm text-[#64748b]">Discover product association rules</p>
        <div className="mt-8 space-y-5">
          {rules.slice(0, 3).map((rule, index) => (
            <div key={index} className={`rounded-xl border p-5 ${colors[index]}`}>
              <h3 className="text-lg font-bold text-[#0f172a]">{rule.antecedents.join(" + ")} + {rule.consequents.join(" + ")}</h3>
              <p className="mt-2 text-sm font-semibold text-[#64748b]">Confidence {Math.round(rule.confidence * 100)}% · Lift {rule.lift}x</p>
            </div>
          ))}
        </div>
        <div className="mt-24 flex gap-5">
          <button className="h-12 w-44 rounded-lg bg-[#2563eb] font-semibold text-white" onClick={generate} disabled={loading === "generate"}>{loading === "generate" ? <LoadingSpinner label="Generating" /> : "Generate Rules"}</button>
          <button className="h-12 w-40 rounded-lg bg-[#16a34a] font-semibold text-white" onClick={apply} disabled={loading === "apply"}>{loading === "apply" ? <LoadingSpinner label="Applying" /> : "Apply Rules"}</button>
        </div>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Rule Metrics</h2>
        <p className="text-sm text-[#64748b]">Threshold controls</p>
        {[["minSupport", "Min Support", "0.01"], ["minConfidence", "Min Confidence", "0.01"], ["minLift", "Min Lift", "0.1"]].map(([key, label, step]) => (
          <label key={key} className="mt-4 block text-sm font-semibold text-[#64748b]">
            {label}
            <input className="mt-1 h-11 w-full rounded-lg border border-[#dbe3ec] px-4" type="number" step={step} value={thresholds[key]} onChange={(e) => setThresholds({ ...thresholds, [key]: e.target.value })} />
          </label>
        ))}
      </div>
    </div>
  );
};

export default BasketPage;
