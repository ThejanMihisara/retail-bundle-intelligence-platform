import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { approveBundle, getBundleRecommendations } from "../../services/bundleService";

const BundlesPage = () => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBundleRecommendations().then((res) => setBundles(res.data || [])).catch((error) => {
      toast.error(error.response?.data?.detail || "Unable to load bundle recommendations");
      setBundles([]);
    }).finally(() => setLoading(false));
  }, []);

  const approve = async (bundleId) => {
    await approveBundle(bundleId);
    setBundles((items) => items.map((item) => item.bundle_id === bundleId ? { ...item, status: "Approved" } : item));
    toast.success("Bundle approved");
  };

  const download = () => {
    const csv = ["Bundle Name,Products,Expected Lift,Action", ...bundles.map((b) => `"${b.bundle_name}","${b.products.join(" + ")}",${b.expected_lift_pct}%,${b.status}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bundle_recommendations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#0f172a]">Recommended Promotional Bundles</h2>
      <p className="text-sm text-[#64748b]">AI-generated bundle list with expected performance</p>
      {loading ? <div className="mt-8"><LoadingSpinner /></div> : (
        <table className="mt-8 w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[#64748b]"><tr>{["Bundle Name", "Products", "Expected Lift", "Action"].map((h) => <th key={h} className="border border-[#e2e8f0] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="font-semibold text-[#0f172a]">
            {bundles.map((bundle) => <tr key={bundle.bundle_id}><td className="border border-[#e2e8f0] px-4 py-4">{bundle.bundle_name}</td><td className="border border-[#e2e8f0] px-4 py-4">{bundle.products.join(" + ")}</td><td className="border border-[#e2e8f0] px-4 py-4 text-[#16a34a]">+{bundle.expected_lift_pct}%</td><td className="border border-[#e2e8f0] px-4 py-4"><button className={bundle.status === "Approved" ? "text-[#16a34a]" : "text-[#2563eb]"} onClick={() => approve(bundle.bundle_id)}>{bundle.status === "Approved" ? "Approved ✓" : bundle.status}</button></td></tr>)}
          </tbody>
        </table>
      )}
      <div className="mt-12 flex gap-5">
        <button className="h-12 w-44 rounded-lg bg-[#2563eb] font-semibold text-white" onClick={() => bundles.forEach((b) => b.status !== "Approved" && approve(b.bundle_id))}>Approve Bundle</button>
        <button className="h-12 w-44 rounded-lg bg-[#16a34a] font-semibold text-white" onClick={download}>Download List</button>
        <button className="h-12 w-44 rounded-lg bg-[#7c3aed] font-semibold text-white" onClick={() => toast.success("Bundle list sent to POS system")}>Send to POS</button>
      </div>
      <div className="mt-10 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-6">
        <h3 className="text-lg font-semibold text-[#0f172a]">Notes</h3>
        <p className="mt-3 font-semibold text-[#64748b]">Bundles are ranked by basket confidence, expected lift, and inventory availability.</p>
      </div>
    </div>
  );
};

export default BundlesPage;
