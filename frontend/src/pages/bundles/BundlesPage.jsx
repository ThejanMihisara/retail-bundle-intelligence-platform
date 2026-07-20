import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import EmptyState from "../../components/shared/EmptyState";
import { getBundlePeriodAnalysis } from "../../services/bundleService";

const card = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '1rem',
  backdropFilter: 'blur(10px)',
  boxShadow: 'var(--card-shadow)',
};

const formatDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseDate = (dateStr) => new Date(`${dateStr}T00:00:00`);

const getWeekRange = (dateStr) => {
  const base = parseDate(dateStr);
  const offset = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [formatDate(start), formatDate(end)];
};

const getMonthRange = (dateStr) => {
  const base = parseDate(dateStr);
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return [formatDate(start), formatDate(end)];
};

const APPROVED_BUNDLES_STORAGE_KEY = "bundlemind_approved_bundles";

const BundlesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected Date and Period Type from URL, with defaults
  const periodType = searchParams.get("period_type") || "day";
  const targetDate = searchParams.get("target_date") || formatDate(new Date());
  const defaultRange = periodType === "month" ? getMonthRange(targetDate) : getWeekRange(targetDate);
  const startDateParam = searchParams.get("start_date") || defaultRange[0];
  const endDateParam = searchParams.get("end_date") || defaultRange[1];
  const searchParam = searchParams.get("search") || "";
  const categoryParam = searchParams.get("category") || "";
  const movementParam = searchParams.get("movement") || "";
  const minLiftParam = searchParams.get("min_lift") || "";
  const minConfidenceParam = searchParams.get("min_confidence") || "";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  // Local state for debouncing search input
  const [searchInput, setSearchInput] = useState(searchParam);

  // API states
  const [bundles, setBundles] = useState([]);
  const [summary, setSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Approved bundles set
  const [approvedBundles, setApprovedBundles] = useState(() => {
    try {
      const saved = localStorage.getItem(APPROVED_BUNDLES_STORAGE_KEY);
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  // Cancel token reference to cancel stale requests
  const cancelTokenRef = useRef(null);

  const updateParams = (newParams) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        updated.delete(k);
      } else {
        updated.set(k, String(v));
      }
    });
    // Reset to page 1 if changing filters, unless explicitly setting page
    if (!newParams.hasOwnProperty("page")) {
      updated.set("page", "1");
    }
    setSearchParams(updated);
  };

  const handleToday = () => {
    const today = formatDate(new Date());
    if (periodType === "day") {
      updateParams({ target_date: today, start_date: "", end_date: "" });
      return;
    }
    const [start, end] = periodType === "week" ? getWeekRange(today) : getMonthRange(today);
    updateParams({ target_date: end, start_date: start, end_date: end });
  };

  const handlePrevPeriod = () => {
    const d = parseDate(periodType === "day" ? targetDate : endDateParam);
    if (isNaN(d.getTime())) return;
    if (periodType === "day") {
      d.setDate(d.getDate() - 1);
      updateParams({ target_date: formatDate(d) });
    } else if (periodType === "week") {
      d.setDate(d.getDate() - 7);
      const [start, end] = getWeekRange(formatDate(d));
      updateParams({ target_date: end, start_date: start, end_date: end });
    } else if (periodType === "month") {
      d.setMonth(d.getMonth() - 1);
      const [start, end] = getMonthRange(formatDate(d));
      updateParams({ target_date: end, start_date: start, end_date: end });
    }
  };

  const handleNextPeriod = () => {
    const d = parseDate(periodType === "day" ? targetDate : endDateParam);
    if (isNaN(d.getTime())) return;
    if (periodType === "day") {
      d.setDate(d.getDate() + 1);
      updateParams({ target_date: formatDate(d) });
    } else if (periodType === "week") {
      d.setDate(d.getDate() + 7);
      const [start, end] = getWeekRange(formatDate(d));
      updateParams({ target_date: end, start_date: start, end_date: end });
    } else if (periodType === "month") {
      d.setMonth(d.getMonth() + 1);
      const [start, end] = getMonthRange(formatDate(d));
      updateParams({ target_date: end, start_date: start, end_date: end });
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchParams({
      period_type: "day",
      target_date: formatDate(new Date()),
      page: "1"
    });
  };

  const handlePeriodTypeChange = (mode) => {
    if (mode === "day") {
      updateParams({ period_type: mode, target_date: targetDate, start_date: "", end_date: "" });
      return;
    }
    const [start, end] = mode === "week" ? getWeekRange(targetDate) : getMonthRange(targetDate);
    updateParams({ period_type: mode, target_date: end, start_date: start, end_date: end });
  };

  const handleRangeStartChange = (value) => {
    updateParams({ start_date: value });
  };

  const handleRangeEndChange = (value) => {
    updateParams({ end_date: value, target_date: value });
  };

  const handleApprove = (bundleId) => {
    const wasApproved = approvedBundles.has(bundleId);
    const updated = new Set(approvedBundles);
    if (updated.has(bundleId)) {
      updated.delete(bundleId);
    } else {
      updated.add(bundleId);
    }
    setApprovedBundles(updated);
    localStorage.setItem(APPROVED_BUNDLES_STORAGE_KEY, JSON.stringify([...updated]));
    toast.success(
      wasApproved
        ? `Bundle #${bundleId} removed from approvals.`
        : `Bundle #${bundleId} approved for POS promotion!`,
      { id: `bundle-approval-${bundleId}` }
    );
  };

  const formatCurrency = (value) => {
    return "Rs. " + new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;
  const formatLift = (value) => `${value.toFixed(2)}x`;
  const escapeCsvCell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const fetchPeriodAnalysis = useCallback(() => {
    if (periodType !== "day") {
      if (!startDateParam || !endDateParam) {
        toast.error("Please select both start and end dates.");
        return;
      }
      if (startDateParam > endDateParam) {
        toast.error("Start date must be on or before the end date.");
        return;
      }
    }

    setLoading(true);
    setError(false);

    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel("Stale request cancelled.");
    }
    const requestSource = axios.CancelToken.source();
    cancelTokenRef.current = requestSource;

    const params = {
      period_type: periodType,
      target_date: periodType === "day" ? targetDate : endDateParam,
      page: pageParam,
      limit: 12,
      ...(periodType !== "day" && { start_date: startDateParam, end_date: endDateParam }),
      ...(searchParam && { search: searchParam }),
      ...(categoryParam && { category: categoryParam }),
      ...(movementParam && { movement: movementParam }),
      ...(minLiftParam && { min_lift: parseFloat(minLiftParam) }),
      ...(minConfidenceParam && { min_confidence: parseFloat(minConfidenceParam) }),
    };

    getBundlePeriodAnalysis(params, { cancelToken: requestSource.token })
      .then(res => {
        setBundles(res.data.data || []);
        setSummary(res.data.summary || null);
        setPeriods(res.data.periods || []);
        setTotalRecords(res.data.total || 0);
      })
      .catch(err => {
        if (axios.isCancel(err)) {
          return;
        }
        console.error(err);
        setError(true);
        toast.error("Failed to load bundle recommendations.");
      })
      .finally(() => {
        if (cancelTokenRef.current === requestSource && !requestSource.token.reason) {
          setLoading(false);
        }
      });
  }, [periodType, targetDate, startDateParam, endDateParam, pageParam, searchParam, categoryParam, movementParam, minLiftParam, minConfidenceParam]);

  // Sync debounced search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== searchParam) {
        updateParams({ search: searchInput });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, searchParam]);

  // Sync local searchInput state if URL parameter changes directly
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  // Trigger analysis call
  useEffect(() => {
    fetchPeriodAnalysis();
  }, [fetchPeriodAnalysis]);

  useEffect(() => {
    return () => {
      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel("Bundle page unmounted.");
      }
    };
  }, []);

  const downloadList = () => {
    if (bundles.length === 0) return;
    const headers = ["Rank", "Bundle ID", "Product IDs", "Product Names", "Support", "Confidence", "Lift", "Normal Price", "Discount %", "Promo Price", "Promo Profit", "Promo Margin", "Status"];
    const rows = bundles.map(b => [
      b.bundle_rank,
      b.bundle_id,
      b.products.map(p => p.product_id).join(", "),
      b.products.map(p => p.product_name).join(" + "),
      formatPercent(b.support),
      formatPercent(b.confidence),
      b.lift.toFixed(2),
      (b.normal_bundle_retail_price ?? b.estimated_revenue).toFixed(2),
      formatPercent(b.suggested_discount_pct ?? 0),
      (b.promo_bundle_price ?? b.estimated_revenue).toFixed(2),
      (b.promo_bundle_profit ?? b.estimated_profit).toFixed(2),
      formatPercent(b.promo_profit_margin ?? 0),
      approvedBundles.has(b.bundle_id) ? "Approved" : "Pending",
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bundlemind_recommendations_${periodType}_${targetDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const summaryItems = summary ? [
    { label: 'Recommended Bundles', value: summary.recommended_bundles.toLocaleString(), badge: 'Total', badgeColor: 'var(--accent-indigo)', badgeBg: 'rgba(99,102,241,0.12)', badgeBorder: 'rgba(99,102,241,0.25)' },
    { label: 'Average Lift', value: `${summary.average_lift.toFixed(2)}x`, badge: 'Lift', badgeColor: 'var(--accent-cyan-text)', badgeBg: 'rgba(6,182,212,0.12)', badgeBorder: 'rgba(6,182,212,0.25)', numColor: 'var(--accent-cyan-text)' },
    { label: 'Average Confidence', value: `${Math.round(summary.average_confidence * 100)}%`, badge: 'Confidence', badgeColor: 'var(--accent-green-text)', badgeBg: 'rgba(16,185,129,0.12)', badgeBorder: 'rgba(16,185,129,0.25)', numColor: 'var(--accent-green-text)' },
    { label: 'Promo Revenue', value: formatCurrency(summary.expected_revenue !== undefined ? summary.expected_revenue : summary.average_revenue), badge: 'Revenue', badgeColor: 'var(--text-body-strong)', badgeBg: 'var(--tag-bg)', badgeBorder: 'var(--tag-border)' },
    { label: 'Promo Profit', value: formatCurrency(summary.expected_profit !== undefined ? summary.expected_profit : summary.average_profit), badge: 'Profit', badgeColor: 'var(--accent-green-text)', badgeBg: 'rgba(16,185,129,0.12)', badgeBorder: 'rgba(16,185,129,0.25)', numColor: 'var(--accent-green-text)' },
  ] : [];

  return (
    <div className="space-y-6 flex-1 flex flex-col animate-fade-in">
      {/* Control Panel Toolbar */}
      <div className="rounded-2xl p-6 flex flex-col gap-4" style={card}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Segmented Picker & Date controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
              {["day", "week", "month"].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handlePeriodTypeChange(mode)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize"
                  style={periodType === mode
                    ? { background: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(6,182,212,0.14))', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.25)' }
                    : { color: 'var(--text-body)', border: '1px solid transparent' }}
                >
                  {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>

            {periodType === "day" ? (
              <input
                type="date"
                className="input-dark text-xs"
                style={{ width: '150px' }}
                value={targetDate}
                onChange={(e) => updateParams({ target_date: e.target.value })}
              />
            ) : (
              <>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-label)' }}>
                    Start Date
                  </span>
                  <input
                    type="date"
                    className="input-dark text-xs"
                    style={{ width: '150px' }}
                    value={startDateParam}
                    onChange={(e) => handleRangeStartChange(e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-label)' }}>
                    End Date
                  </span>
                  <input
                    type="date"
                    className="input-dark text-xs"
                    style={{ width: '150px' }}
                    value={endDateParam}
                    onChange={(e) => handleRangeEndChange(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex gap-1.5">
              <button onClick={handlePrevPeriod} className="theme-toggle hover:scale-105 active:scale-95" title="Previous period" aria-label="Previous period">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={handleToday} className="theme-toggle font-bold text-xs px-3 hover:scale-105 active:scale-95">
                Today
              </button>
              <button onClick={handleNextPeriod} className="theme-toggle hover:scale-105 active:scale-95" title="Next period" aria-label="Next period">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Text and Select Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search products..."
              className="input-dark text-xs"
              style={{ width: '160px' }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            <select
              className="input-dark text-xs"
              style={{ width: '140px' }}
              value={categoryParam}
              onChange={(e) => updateParams({ category: e.target.value })}
            >
              <option value="">All Categories</option>
              <option value="Baby & Kids">Baby & Kids</option>
              <option value="Beverages">Beverages</option>
              <option value="Cleaning & Household">Cleaning & Household</option>
              <option value="Cooking Essentials">Cooking Essentials</option>
              <option value="Dairy & Chilled">Dairy & Chilled</option>
              <option value="General Grocery">General Grocery</option>
              <option value="Health & Medicine">Health & Medicine</option>
              <option value="Meat, Fish & Frozen">Meat, Fish & Frozen</option>
              <option value="Personal Care">Personal Care</option>
              <option value="Snacks & Confectionery">Snacks & Confectionery</option>
              <option value="Staples & Dry Groceries">Staples & Dry Groceries</option>
              <option value="Stationery">Stationery</option>
            </select>

            <select
              className="input-dark text-xs"
              style={{ width: '140px' }}
              value={movementParam}
              onChange={(e) => updateParams({ movement: e.target.value })}
            >
              <option value="">All Movements</option>
              <option value="Fast">Fast Moving</option>
              <option value="Medium">Medium Moving</option>
              <option value="Slow">Slow Moving</option>
            </select>

            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="Min Lift"
              className="input-dark text-xs"
              style={{ width: '90px' }}
              value={minLiftParam}
              onChange={(e) => updateParams({ min_lift: e.target.value })}
            />

            <div className="flex gap-1.5 ml-auto xl:ml-0">
              <button onClick={handleClearFilters} className="theme-toggle text-xs px-3 font-bold hover:bg-[rgba(239,68,68,0.1)] hover:text-red-400 hover:border-red-400" title="Clear filters">
                Clear
              </button>
              <button onClick={fetchPeriodAnalysis} className="theme-toggle" title="Refresh recommendations" aria-label="Refresh recommendations">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v6h6M20 20v-6h-6M5.6 15A7 7 0 0018 17.4M18.4 9A7 7 0 006 6.6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20 rounded-2xl" style={card}>
          <div className="text-red-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Failed to Load Recommendations</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Could not fetch period recommendations. Make sure the backend ML model is correctly loaded.</p>
          <button onClick={fetchPeriodAnalysis} className="btn-primary">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {!error && loading && (
        <LoadingSpinner label="Loading bundle recommendations..." fullPage />
      )}

      {/* Main recommendation display */}
      {!error && !loading && (
        <div className="space-y-6 flex-1 flex flex-col">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {summaryItems.map(s => (
                <div key={s.label} className="glass-card p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 h-[85px]"
                  style={{ '--glow-color': 'rgba(255,255,255,0.01)' }}>
                  <div className="flex justify-between items-start gap-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-label)' }}>{s.label}</p>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
                      style={{ background: s.badgeBg, color: s.badgeColor }}>{s.badge}</span>
                  </div>
                  <h3 className="text-lg font-black mt-1" style={{ color: s.numColor || 'var(--text-primary)' }}>{s.value}</h3>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {bundles.length === 0 ? (
            <div className="flex-1">
              <EmptyState title="No Bundle Recommendations Match" message="Try adjusting your filters or date to see historical purchasing associations." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bundles.map(bundle => {
                const isApproved = approvedBundles.has(bundle.bundle_id);
                return (
                  <div key={bundle.bundle_id} className="glass-card p-6 flex flex-col justify-between transition-all duration-300"
                    style={{
                      background: isApproved ? 'rgba(16,185,129,0.06)' : 'var(--card-bg)',
                      border: isApproved ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--card-border)',
                      boxShadow: isApproved ? '0 0 20px rgba(16,185,129,0.06)' : 'var(--card-shadow)',
                      '--glow-color': isApproved ? 'rgba(16,185,129,0.05)' : 'transparent'
                    }}>
                    <div className="space-y-4">
                      {/* Bundle Header info */}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Rank #{bundle.bundle_rank}
                          </p>
                          <h3 className="text-base font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            Bundle #{bundle.bundle_id}
                          </h3>
                        </div>
                      </div>

                      {/* Association Metrics Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl text-center" style={{ background: 'var(--tag-bg)', border: '1px solid var(--tag-border)' }}>
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Lift</p>
                          <p className="text-[11px] font-black" style={{ color: 'var(--accent-cyan-text)' }}>{formatLift(bundle.lift)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Confidence</p>
                          <p className="text-[11px] font-black" style={{ color: 'var(--text-primary)' }}>{formatPercent(bundle.confidence)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--text-muted)]">FP Supp.</p>
                          <p className="text-[11px] font-black" style={{ color: 'var(--accent-green-text)' }}>{formatPercent(bundle.support)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold uppercase text-[var(--text-muted)]">Pair Supp.</p>
                          <p className="text-[11px] font-black text-purple-300">{formatPercent(bundle.pair_support)}</p>
                        </div>
                      </div>

                      {/* Seasonal Score and metadata details */}
                      <div className="flex justify-between items-center text-[10px] px-1 text-[var(--text-muted)]">
                        <span>Seasonal Score: <strong className="text-indigo-300 font-extrabold">{bundle.seasonal_demand_score.toFixed(4)}</strong></span>
                      </div>

                      {/* Products List */}
                      <div className="space-y-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-very-muted)]">
                          Included Products ({bundle.product_count}):
                        </p>
                        <div className="space-y-1.5">
                          {bundle.products.map(product => {
                            let badgeClass = "badge-slate";
                            if (product.movement_label === "Fast Moving") badgeClass = "badge-green";
                            else if (product.movement_label === "Medium Moving") badgeClass = "badge-amber";
                            else if (product.movement_label === "Slow Moving") badgeClass = "badge-red";

                            return (
                              <div key={product.product_id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-[var(--row-hover)] hover:bg-[rgba(255,255,255,0.02)] transition-all">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="font-extrabold truncate" style={{ color: 'var(--text-primary)' }} title={product.product_name}>
                                    {product.product_name}
                                  </span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded flex-shrink-0 ${badgeClass}`}>
                                    {product.movement_label}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-2 flex-shrink-0">
                                  {formatCurrency(product.retail_price)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    <div className="mt-4 pt-4 space-y-4" style={{ borderTop: '1px solid var(--divider)' }}>
                      {/* Financial info */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[9px] font-semibold uppercase text-[var(--text-very-muted)]">Normal Price</p>
                          <p className="font-extrabold mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatCurrency(bundle.normal_bundle_retail_price ?? bundle.estimated_revenue)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-semibold uppercase text-[var(--text-very-muted)]">Discount</p>
                          <p className="font-extrabold mt-0.5 text-[var(--accent-cyan-text)]">{formatPercent(bundle.suggested_discount_pct ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-semibold uppercase text-[var(--text-very-muted)]">Promo Price</p>
                          <p className="font-extrabold mt-0.5" style={{ color: 'var(--text-primary)' }}>{formatCurrency(bundle.promo_bundle_price ?? bundle.estimated_revenue)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-semibold uppercase text-[var(--text-very-muted)]">Promo Profit</p>
                          <p className="font-extrabold mt-0.5 text-[var(--accent-green-text)]">{formatCurrency(bundle.promo_bundle_profit ?? bundle.estimated_profit)}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <button onClick={() => handleApprove(bundle.bundle_id)}
                        className="w-full font-bold text-xs py-2.5 rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 hover:bg-[var(--btn-ghost-bg-hover)]"
                        style={isApproved ? { background: 'linear-gradient(135deg, var(--accent-green), var(--accent-cyan))', color: 'white', boxShadow: '0 4px 14px rgba(16,185,129,0.2)', border: 'none' }
                          : { background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body)' }}>
                        {isApproved ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            Approved
                          </>
                        ) : "Approve POS Promotion"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Controls / CSV Export */}
          {bundles.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl gap-4" style={card}>
              <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-very-muted)' }}>
                Showing {Math.min(totalRecords, (pageParam - 1) * 12 + 1)} – {Math.min(totalRecords, pageParam * 12)} of {totalRecords} Recommendations
              </span>
              <div className="flex items-center gap-3">
                {totalRecords > 12 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateParams({ page: Math.max(1, pageParam - 1) })}
                      disabled={pageParam === 1}
                      className="px-4 py-2 font-semibold text-xs rounded-lg transition-all disabled:opacity-30 hover:bg-[var(--btn-ghost-bg-hover)]"
                      style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body-strong)' }}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => updateParams({ page: Math.min(Math.ceil(totalRecords / 12), pageParam + 1) })}
                      disabled={pageParam >= Math.ceil(totalRecords / 12)}
                      className="px-4 py-2 font-semibold text-xs rounded-lg transition-all disabled:opacity-30 hover:bg-[var(--btn-ghost-bg-hover)]"
                      style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body-strong)' }}
                    >
                      Next
                    </button>
                  </div>
                )}
                <button onClick={downloadList} className="flex items-center gap-2 rounded-xl font-bold text-xs px-5 py-2.5 transition-all hover:bg-[var(--btn-ghost-bg-hover)]"
                  style={{ background: 'var(--btn-ghost-bg)', border: '1px solid var(--btn-ghost-border)', color: 'var(--text-body-strong)' }}>
                  Export CSV List
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default BundlesPage;
