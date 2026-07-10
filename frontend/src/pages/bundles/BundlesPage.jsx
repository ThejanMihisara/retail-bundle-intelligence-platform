import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getBundles, getBundlesSummary, recommendBundles } from "../../services/bundleService";

const BundlesPage = () => {
  const [bundles, setBundles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [approvedBundles, setApprovedBundles] = useState(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchSummary = () => {
    getBundlesSummary()
      .then((res) => setSummary(res.data))
      .catch(() => toast.error("Failed to load bundle summary metrics."));
  };

  const fetchBundlesData = (isSearch = false) => {
    setSearching(true);
    
    if (isSearch && searchQuery.trim()) {
      recommendBundles(searchQuery.trim())
        .then((res) => {
          setBundles(res.data);
          setTotalRecords(res.data.length);
        })
        .catch(() => toast.error("Failed to fetch product-specific recommendations."))
        .finally(() => {
          setSearching(false);
          setLoading(false);
        });
    } else {
      const params = {
        page,
        limit: 10,
        ...(searchQuery && { search: searchQuery })
      };

      getBundles(params)
        .then((res) => {
          setBundles(res.data.data);
          setTotalRecords(res.data.total);
        })
        .catch(() => toast.error("Failed to load recommended bundles."))
        .finally(() => {
          setSearching(false);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchBundlesData(false);
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBundlesData(true);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setPage(1);
    // Directly fetch without query
    setSearching(true);
    getBundles({ page: 1, limit: 10 })
      .then((res) => {
        setBundles(res.data.data);
        setTotalRecords(res.data.total);
      })
      .finally(() => setSearching(false));
  };

  const handleApprove = (bundleId) => {
    setApprovedBundles((prev) => {
      const updated = new Set(prev);
      if (updated.has(bundleId)) {
        updated.delete(bundleId);
        toast.success(`Bundle #${bundleId} removed from approvals.`);
      } else {
        updated.add(bundleId);
        toast.success(`Bundle #${bundleId} approved for POS promotion!`);
      }
      return updated;
    });
  };

  const formatCurrency = (value) => {
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const downloadList = () => {
    if (bundles.length === 0) return;
    const csvContent = [
      "Bundle ID,Product IDs,Product Names,Expected Lift,Confidence,Support,Estimated Revenue,Estimated Profit,Status",
      ...bundles.map((b) => {
        const prodIds = b.products.map(p => p.product_id).join(";");
        const prodNames = b.products.map(p => p.product_name).join(" + ");
        const status = approvedBundles.has(b.bundle_id) ? "Approved" : "Pending";
        return `${b.bundle_id},"${prodIds}","${prodNames}",${b.lift.toFixed(2)},${b.confidence.toFixed(4)},${b.support.toFixed(4)},${b.estimated_revenue.toFixed(2)},${b.estimated_profit.toFixed(2)},${status}`;
      })
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bundlemind_promo_bundles.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingSpinner label="Running FP-Growth market basket analytics..." fullPage />;
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Top summary widgets */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-semibold">Total Recommended Bundles</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{summary.total_bundles.toLocaleString()}</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">FP-Growth</span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-semibold">Average Basket Lift</p>
              <h3 className="text-2xl font-extrabold text-emerald-500 mt-1">{summary.avg_lift.toFixed(2)}x</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Signal</span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-semibold">Average Confidence</p>
              <h3 className="text-2xl font-extrabold text-blue-500 mt-1">{Math.round(summary.avg_confidence * 100)}%</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Support</span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 font-semibold">Avg Bundle Margin</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{formatCurrency(summary.avg_profit)}</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Financial</span>
          </div>
        </div>
      )}

      {/* Toolbar Filter */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Explore Retail Recommendations</h2>
          <p className="text-xs text-slate-400 mt-0.5">Filter rules by specific product names or codes</p>
        </div>
        
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Type Product Name or Code (e.g. Sugar)..."
            className="h-10 w-80 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-all active:scale-95"
          >
            Recommend
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-10 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs transition-colors"
          >
            Clear
          </button>
        </form>
      </div>

      {/* Grid of Bundle Cards */}
      <div className="flex-1 flex flex-col">
        {searching ? (
          <div className="text-center py-20 flex-1">
            <LoadingSpinner label="Searching recommendations..." />
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex-1">
            <EmptyState title="No bundles found" message="Ensure the search product exists or remove search parameters." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bundles.map((bundle) => {
              const isApproved = approvedBundles.has(bundle.bundle_id);
              return (
                <div 
                  key={bundle.bundle_id} 
                  className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md ${
                    isApproved ? "border-emerald-300 ring-2 ring-emerald-500/5 bg-emerald-50/10" : "border-slate-100"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400">FP-Growth Output</span>
                        <h3 className="text-lg font-extrabold text-slate-800 mt-0.5">Bundle #{bundle.bundle_id}</h3>
                      </div>
                      
                      {/* Metric Badges */}
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          {bundle.lift.toFixed(2)}x Lift
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          Conf: {Math.round(bundle.confidence * 100)}% | Supp: {bundle.support.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {/* Product List */}
                    <div className="space-y-2 mb-6">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Included Products ({bundle.product_count}):</p>
                      <div className="grid grid-cols-1 gap-2 bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                        {bundle.products.map((p) => (
                          <div key={p.product_id} className="flex items-center justify-between text-xs py-1">
                            <span className="font-bold text-slate-700">{p.product_name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">#{p.product_id}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial Estimations */}
                    <div className="grid grid-cols-2 gap-4 mb-6 border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Est. Retail Price</p>
                        <p className="text-sm font-bold text-slate-800">{formatCurrency(bundle.estimated_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Est. Margin Contribution</p>
                        <p className="text-sm font-extrabold text-emerald-600">{formatCurrency(bundle.estimated_profit)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 border-t border-slate-100 pt-4">
                    <button
                      onClick={() => handleApprove(bundle.bundle_id)}
                      className={`flex-1 font-bold text-xs py-3 rounded-xl border transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 ${
                        isApproved
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                          </svg>
                          Approved
                        </>
                      ) : (
                        "Approve Promotion"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List Action Buttons */}
        {bundles.length > 0 && !searching && (
          <div className="flex justify-between items-center mt-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold uppercase pl-2">
              Currently Auditing {bundles.length} Bundle Recommendations
            </span>
            <div className="flex gap-3">
              <button 
                onClick={downloadList}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs px-5 py-3 transition-all duration-200 active:scale-95"
              >
                Export CSV List
              </button>
              <button 
                onClick={() => toast.success("Approved bundles synchronised with POS cash register.")}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 shadow-md shadow-indigo-600/10 transition-all duration-200 active:scale-95"
              >
                Push Approved to POS
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BundlesPage;
