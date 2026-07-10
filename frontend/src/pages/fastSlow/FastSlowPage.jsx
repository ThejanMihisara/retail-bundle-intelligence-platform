import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getProductMovement, getMovementSummary } from "../../services/productService";

const FastSlowPage = () => {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'fast', 'medium', 'slow'
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("total_revenue");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchSummary = () => {
    getMovementSummary()
      .then((res) => setSummary(res.data))
      .catch(() => toast.error("Failed to load movement summary metrics."));
  };

  const fetchMovementData = (showToast = false) => {
    setSubmitting(true);
    
    // Map tabs to exact backend movement levels
    let levelParam = null;
    if (activeTab === "fast") levelParam = "Fast Moving";
    else if (activeTab === "medium") levelParam = "Medium Moving";
    else if (activeTab === "slow") levelParam = "Slow Moving";

    const params = {
      page,
      limit: 15,
      sort_by: sortBy,
      sort_desc: sortDesc,
      ...(search && { search }),
      ...(levelParam && { level: levelParam })
    };

    getProductMovement(params)
      .then((res) => {
        setProducts(res.data.data);
        setTotalRecords(res.data.total);
        if (showToast) {
          toast.success("Random Forest predictions updated.");
        }
      })
      .catch(() => toast.error("Failed to query product movement predictions."))
      .finally(() => {
        setSubmitting(false);
        setLoading(false);
      });
  };

  // Initial fetch
  useEffect(() => {
    fetchSummary();
  }, []);

  // Re-fetch when page, tab, sorting options change
  useEffect(() => {
    fetchMovementData(false);
  }, [page, activeTab, sortBy, sortDesc]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMovementData(true);
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
    return "Rs. " + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  if (loading) {
    return <LoadingSpinner label="Querying Random Forest movement predictions..." fullPage />;
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Top summary widgets */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Products</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{summary.total_products.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Fast Moving</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{summary.fast_moving_count.toLocaleString()}</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">High Flow</span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Medium Moving</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{summary.medium_moving_count.toLocaleString()}</h3>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Stable</span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Slow Moving</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{summary.slow_moving_count.toLocaleString()}</h3>
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Discount Target</span>
          </div>
        </div>
      )}

      {/* Main filter toolbar and product list */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm flex-1 flex flex-col">
        {/* Toolbar header */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit">
            {[
              { id: "all", label: "All Items" },
              { id: "fast", label: "Fast" },
              { id: "medium", label: "Medium" },
              { id: "slow", label: "Slow" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  setPage(1);
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === t.id
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by Product Name or ID..."
              className="h-10 w-64 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs outline-none focus:border-emerald-400 focus:bg-white transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-colors"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase">
                <th className="p-6 pb-3">Product ID</th>
                <th className="pb-3 cursor-pointer select-none" onClick={() => handleToggleSort("product_name")}>
                  Product Name {sortBy === "product_name" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-right cursor-pointer select-none" onClick={() => handleToggleSort("total_quantity_sold")}>
                  Quantity Sold {sortBy === "total_quantity_sold" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="pb-3 text-right cursor-pointer select-none" onClick={() => handleToggleSort("total_revenue")}>
                  Total Revenue {sortBy === "total_revenue" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="pb-3 text-right cursor-pointer select-none" onClick={() => handleToggleSort("total_profit")}>
                  Total Profit {sortBy === "total_profit" && (sortDesc ? "↓" : "↑")}
                </th>
                <th className="pb-3 text-center">RF Classification</th>
                <th className="pb-3 text-center pr-6">RF Probabilities (F / M / S)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submitting ? (
                <tr>
                  <td colSpan="8" className="text-center py-20">
                    <LoadingSpinner label="Refreshing predictions..." />
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  let badgeColor = "bg-slate-100 text-slate-700";
                  if (item.movement_level === "Fast Moving") badgeColor = "bg-emerald-50 text-emerald-600";
                  if (item.movement_level === "Medium Moving") badgeColor = "bg-blue-50 text-blue-600";
                  if (item.movement_level === "Slow Moving") badgeColor = "bg-red-50 text-red-600";

                  return (
                    <tr key={item.product_id} className="text-slate-600 hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 py-4 font-semibold text-slate-500">#{item.product_id}</td>
                      <td className="py-4 font-bold text-slate-700 pr-4">{item.product_name}</td>
                      <td className="py-4">{item.category}</td>
                      <td className="py-4 text-right font-medium">{item.quantity_sold.toLocaleString()}</td>
                      <td className="py-4 text-right font-bold text-slate-800">{formatCurrency(item.revenue)}</td>
                      <td className="py-4 text-right font-bold text-emerald-500">{formatCurrency(item.profit)}</td>
                      <td className="py-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                          {item.movement_level}
                        </span>
                      </td>
                      <td className="py-4 text-center text-[10px] font-bold text-slate-400 pr-6">
                        <span className="text-emerald-500">{Math.round(item.probabilities.fast * 100)}%</span> /{" "}
                        <span className="text-blue-500">{Math.round(item.probabilities.medium * 100)}%</span> /{" "}
                        <span className="text-red-500">{Math.round(item.probabilities.slow * 100)}%</span>
                      </td>
                    </tr>
                  );
                })
              )}
              {products.length === 0 && !submitting && (
                <tr>
                  <td colSpan="8" className="text-center py-12">
                    <EmptyState title="No classification rows found" message="Verify filters or upload another dataset." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalRecords > 15 && (
          <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">
              Showing {Math.min(totalRecords, (page-1)*15 + 1)} - {Math.min(totalRecords, page*15)} of {totalRecords} classification items
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-semibold text-xs rounded-lg transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalRecords / 15), p + 1))}
                disabled={page >= Math.ceil(totalRecords / 15)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-semibold text-xs rounded-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FastSlowPage;
