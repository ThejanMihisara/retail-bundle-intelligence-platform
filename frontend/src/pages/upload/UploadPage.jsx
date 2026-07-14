import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import ConfirmModal from "../../components/shared/ConfirmModal";
import { clearSales, getSales, uploadCsv } from "../../services/salesService";

const card = {
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "1rem",
  backdropFilter: "blur(10px)",
  boxShadow: "var(--card-shadow)",
};

const schema = [
  { name: "invoice_id", ex: "INV-29004", desc: "Unique code identifying invoice (String)" },
  { name: "sale_date", ex: "2026-05-22", desc: "Calendar timestamp of transaction (Date)" },
  { name: "product_id", ex: "1479", desc: "Unique code identifying product (String)" },
  { name: "product_name", ex: "White Sugar 1kg", desc: "Retail name of inventory item (String)" },
  { name: "category", ex: "Staples & Dry Groceries", desc: "General retail store category (String)" },
  { name: "quantity_sold", ex: "15", desc: "Physical units of product sold (Integer)" },
  { name: "cost_price", ex: "210.0", desc: "Acquisition wholesale unit cost (Float)" },
  { name: "retail_price", ex: "230.0", desc: "Point-of-sales retail unit price (Float)" },
  { name: "total_revenue", ex: "3450.0", desc: "Gross income: quantity x retail (Float)" },
  { name: "profit", ex: "300.0", desc: "Gross profit margin: revenue - cost (Float)" },
];

const requiredColumns = schema.map((col) => col.name);

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""));
  return values;
};

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [salesRows, setSalesRows] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const [filters, setFilters] = useState({ search: "", startDate: "", endDate: "" });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const inputRef = useRef(null);

  const validateCsv = async (selected) => {
    const headerSample = await selected.slice(0, 65536).text();
    const firstLineEnd = headerSample.search(/\r?\n/);
    if (firstLineEnd === -1) {
      return {
        valid: false,
        rowCount: 0,
        headers: [],
        missing: requiredColumns,
        extra: [],
        message: "CSV must include a header row.",
      };
    }

    const headerLine = headerSample.slice(0, firstLineEnd).replace(/^\uFEFF/, "");
    const headers = parseCsvLine(headerLine).map((header) => header.trim());
    const headerSet = new Set(headers);
    const missing = requiredColumns.filter((col) => !headerSet.has(col));
    const extra = headers.filter((col) => !requiredColumns.includes(col));

    return {
      valid: missing.length === 0,
      rowCount: null,
      headers,
      missing,
      extra,
      message: missing.length === 0
        ? "Validation passed. CSV is ready to upload."
        : `Missing required columns: ${missing.join(", ")}`,
    };
  };

  const fetchSalesData = (targetPage = salesPage, activeFilters = filters) => {
    setSalesLoading(true);
    const endDate = activeFilters.endDate ? `${activeFilters.endDate}T23:59:59` : "";
    getSales({
      page: targetPage,
      limit: 10,
      ...(activeFilters.search && { search: activeFilters.search }),
      ...(activeFilters.startDate && { start_date: activeFilters.startDate }),
      ...(endDate && { end_date: endDate }),
    })
      .then((res) => {
        setSalesRows(res.data.data || []);
        setSalesTotal(res.data.total || 0);
        setSalesPage(targetPage);
      })
      .catch(() => toast.error("Failed to load uploaded sales data."))
      .finally(() => setSalesLoading(false));
  };

  useEffect(() => { fetchSalesData(1); }, []);

  const chooseFile = async (selected) => {
    setValidation(null);
    setResult(null);
    if (!selected || !selected.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      toast.error("Please select a valid CSV file.");
      return;
    }

    try {
      const validationResult = await validateCsv(selected);
      setFile(selected);
      setValidation(validationResult);
      if (validationResult.valid) toast.success("Validation passed. Upload is now available.");
      else toast.error(validationResult.message);
    } catch {
      setFile(null);
      setValidation({ valid: false, rowCount: 0, headers: [], missing: requiredColumns, extra: [], message: "Could not read the CSV file." });
      toast.error("Could not validate the CSV file.");
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error("Please choose a CSV file first."); return; }
    if (!validation?.valid) { toast.error("CSV validation must pass before upload."); return; }
    setUploading(true);
    setResult(null);
    try {
      const res = await uploadCsv(file);
      setResult(res.data);
      if (res.data.status === "success") {
        toast.success(`Successfully uploaded! ${res.data.inserted_count} transactions saved.`);
        setFile(null);
        setValidation(null);
        fetchSalesData(1);
      } else if (res.data.status === "partial_success") {
        toast.success(`Partial upload. ${res.data.inserted_count} saved. Check logs for errors.`);
        fetchSalesData(1);
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : (detail?.message || "File upload failed. Ensure the format is correct."));
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setIsConfirmOpen(true);
  };

  const confirmClear = async () => {
    setClearing(true);
    try {
      const res = await clearSales();
      toast.success(res.data?.message || "Successfully cleared the latest uploaded dataset.");
      setResult(null);
      setFile(null);
      setValidation(null);
      fetchSalesData(1);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : (detail?.message || "Failed to clear sales transactions."));
    } finally {
      setClearing(false);
    }
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchSalesData(1);
  };

  const clearFilters = () => {
    const emptyFilters = { search: "", startDate: "", endDate: "" };
    setFilters(emptyFilters);
    fetchSalesData(1, emptyFilters);
  };

  const formatCurrency = (value) => {
    const number = Number(value || 0);
    if (Math.abs(number) >= 1000000) return "Rs. " + (number / 1000000).toFixed(2) + "M";
    return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(number);
  };

  return (
    <div className="space-y-6 flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl p-7 flex flex-col gap-6 lg:col-span-2" style={card}>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>CSV Data Management</h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Validate first, then upload sales transaction records into MySQL</p>
            </div>
            <button type="button" onClick={handleClear} disabled={clearing}
              className="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 hover:enabled:bg-[rgba(239,68,68,0.14)]"
              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {clearing ? <LoadingSpinner label="Clearing..." /> : "Clear Latest Upload"}
            </button>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); chooseFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className="flex flex-col items-center justify-center min-h-[420px] rounded-2xl cursor-pointer transition-all duration-300"
            style={{
              minHeight: "420px",
              border: `2px dashed ${dragOver ? "var(--accent-green)" : validation?.valid ? "rgba(16,185,129,0.55)" : validation?.valid === false ? "rgba(248,113,113,0.45)" : "var(--card-border-hover)"}`,
              background: dragOver ? "rgba(16,185,129,0.05)" : validation?.valid ? "rgba(16,185,129,0.035)" : validation?.valid === false ? "rgba(248,113,113,0.035)" : "var(--tag-bg)",
            }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: file ? "rgba(16,185,129,0.12)" : "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <svg className="w-6 h-6" style={{ color: validation?.valid ? "var(--accent-green)" : validation?.valid === false ? "#f87171" : "var(--text-placeholder)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{file ? file.name : "Drag & Drop transaction CSV"}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{file ? "CSV selected. Validation result is shown below." : "or click here to browse files"}</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => chooseFile(e.target.files[0])} />
          </div>

          {validation && (
            <div className="rounded-2xl p-4" style={{ background: validation.valid ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${validation.valid ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.22)"}` }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: validation.valid ? "var(--accent-green-text)" : "#f87171" }}>
                    {validation.valid ? "Validation Passed" : "Validation Failed"}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>{validation.message}</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="px-2.5 py-1 rounded-lg" style={{ color: "var(--accent-cyan-text)", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.18)" }}>Header checked</span>
                  <span className="px-2.5 py-1 rounded-lg" style={{ color: validation.missing.length ? "#f87171" : "var(--accent-green-text)", background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>{validation.missing.length} missing</span>
                </div>
              </div>
              {validation.missing.length > 0 && (
                <p className="text-[11px] mt-3" style={{ color: "#fca5a5" }}>Missing fields: {validation.missing.join(", ")}</p>
              )}
            </div>
          )}

          {file && validation?.valid && (
            <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold truncate max-w-[360px]" style={{ color: "var(--text-primary)" }}>{file.name}</span>
                <span style={{ color: "var(--text-body)" }}>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <button onClick={handleUpload} disabled={uploading} className="w-full h-11 rounded-xl text-white font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent-green), var(--accent-cyan))", boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
                {uploading ? <LoadingSpinner label="Uploading Transactions..." /> : "Upload to MySQL DB"}
              </button>
            </div>
          )}

          {result && (
            <div className="p-5 rounded-2xl flex flex-col gap-5" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
              <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-label)" }}>Upload Statistics</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: "Processed", value: result.total_rows_processed, color: "var(--text-body-strong)" },
                  { label: "Inserted", value: result.inserted_count, color: "var(--accent-green-text)" },
                  { label: "Duplicates", value: result.duplicate_count, color: "#fbbf24" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: "var(--text-label)" }}>{s.label}</span>
                    <p className="text-2xl font-extrabold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
              {result.validation_errors?.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-xl p-3 text-[10px] font-mono space-y-1"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#fca5a5" }}>
                  {result.validation_errors.map((err, i) => <div key={i}>- {err}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-7 flex flex-col self-start" style={{ ...card, maxHeight: "430px" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>CSV Template Schema</h2>
          <p className="text-[11px] mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>Validate your headers before uploading</p>
          <div className="overflow-y-auto pr-2" style={{ height: "288px", maxHeight: "288px" }}>
            {schema.map((col) => (
              <div key={col.name} className="flex justify-between items-center text-xs" style={{ height: "72px", minHeight: "72px", borderBottom: "1px solid var(--divider-subtle)" }}>
                <div className="min-w-0 pr-3">
                  <span className="font-bold" style={{ color: "var(--text-primary)" }}>{col.name}</span>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-very-muted)" }}>{col.desc}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold ml-2 flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.18)" }}>{col.ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={card}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Uploaded Sales Data</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Search and filter all uploaded transactions</p>
          </div>
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap gap-2">
            <input className="input-dark" style={{ width: "240px" }} placeholder="Search invoice, product, ID..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            <input className="input-dark" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            <input className="input-dark" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            <button type="submit" className="btn-primary">Filter</button>
            <button type="button" onClick={clearFilters} className="h-10 px-4 rounded-xl font-bold text-xs transition-all hover:bg-[var(--btn-ghost-bg-hover)]"
              style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body)" }}>
              Clear
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                {["Invoice", "Date", "Product", "Category", "Qty", "Revenue", "Profit"].map((head) => (
                  <th key={head} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${["Qty", "Revenue", "Profit"].includes(head) ? "text-right" : ""}`} style={{ color: "var(--text-label)" }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesLoading ? (
                <tr><td colSpan="7" className="py-12 text-center"><LoadingSpinner label="Loading uploaded data..." /></td></tr>
              ) : salesRows.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>No uploaded sales rows found.</td></tr>
              ) : salesRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--row-hover)]" style={{ borderBottom: "1px solid var(--divider-subtle)" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-body)" }}>{row.invoice_id}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-body)" }}>{row.sale_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: "var(--text-primary)" }}>{row.product_name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-body)" }}>{row.category}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text-body-strong)" }}>{row.quantity_sold?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(row.total_revenue)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: "var(--accent-green-text)" }}>{formatCurrency(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {salesTotal > 10 && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-5 gap-3">
            <span className="text-[11px] font-bold uppercase" style={{ color: "var(--text-very-muted)" }}>
              Showing {Math.min(salesTotal, (salesPage - 1) * 10 + 1)} - {Math.min(salesTotal, salesPage * 10)} of {salesTotal} rows
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={salesPage === 1} onClick={() => fetchSalesData(Math.max(1, salesPage - 1))}
                className="px-4 py-2 font-semibold text-xs rounded-lg transition-all disabled:opacity-30 hover:bg-[var(--btn-ghost-bg-hover)]"
                style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body-strong)" }}>Previous</button>
              <button type="button" disabled={salesPage >= Math.ceil(salesTotal / 10)} onClick={() => fetchSalesData(Math.min(Math.ceil(salesTotal / 10), salesPage + 1))}
                className="px-4 py-2 font-semibold text-xs rounded-lg transition-all disabled:opacity-30 hover:bg-[var(--btn-ghost-bg-hover)]"
                style={{ background: "var(--btn-ghost-bg)", border: "1px solid var(--btn-ghost-border)", color: "var(--text-body-strong)" }}>Next</button>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmClear}
        title="Undo Latest Upload"
        message="Are you sure you want to delete the latest uploaded dataset? This will undo your most recent upload batch and cannot be undone."
        confirmText="Yes, Delete Batch"
        cancelText="Cancel"
      />
    </div>
  );
};

export default UploadPage;
