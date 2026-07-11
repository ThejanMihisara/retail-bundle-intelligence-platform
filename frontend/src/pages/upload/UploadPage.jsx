import { useRef, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { uploadCsv, clearSales } from "../../services/salesService";

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const chooseFile = (selected) => {
    if (selected && selected.name.toLowerCase().endsWith(".csv")) {
      setFile(selected);
      setResult(null);
    } else {
      toast.error("Please select a valid CSV file.");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please choose a CSV file first.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const res = await uploadCsv(file);
      setResult(res.data);
      if (res.data.status === "success") {
        toast.success(`Successfully uploaded! ${res.data.inserted_count} transactions saved.`);
        setFile(null);
      } else if (res.data.status === "partial_success") {
        toast.success(`Partial upload. ${res.data.inserted_count} saved. Check logs for errors.`);
      }
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (detail?.message || "File upload failed. Ensure the format is correct.");
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    const confirmClear = window.confirm(
      "Are you sure you want to delete all uploaded sales transactions from the database? This action cannot be undone."
    );
    if (!confirmClear) return;

    setClearing(true);
    try {
      await clearSales();
      toast.success("Successfully cleared all sales transactions from the database.");
      setResult(null);
      setFile(null);
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (detail?.message || "Failed to clear sales transactions.");
      toast.error(msg);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
      {/* Upload Target Box and Status Panel */}
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm lg:col-span-2 flex flex-col justify-between gap-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-slate-800">CSV Data Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload sales transaction records into MySQL database</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="px-4 py-2.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 active:scale-[0.98] border border-red-200/40 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {clearing ? <LoadingSpinner label="Clearing..." /> : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Database
              </>
            )}
          </button>
        </div>

        {/* Drag and Drop Container */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            chooseFile(e.dataTransfer.files[0]);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 cursor-pointer transition-all duration-200 min-h-[220px] ${
            dragOver 
              ? "border-emerald-500 bg-emerald-50/10" 
              : file 
                ? "border-emerald-300 bg-slate-50/20" 
                : "border-slate-200 bg-slate-50/30 hover:border-slate-300"
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100/80 flex items-center justify-center text-slate-400 mb-4">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">
            {file ? "File Selected Ready to Save" : "Drag & Drop transaction CSV"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {file ? file.name : "or click here to browse files"}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files[0])}
          />
        </div>

        {/* Selected File Details & Upload Button */}
        {file && (
          <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600 truncate max-w-[240px]">{file.name}</span>
              <span className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-xs shadow-md shadow-emerald-500/10 hover:from-emerald-600 hover:to-cyan-600 transition-all flex items-center justify-center"
            >
              {uploading ? <LoadingSpinner label="Uploading Transactions..." /> : "Upload to MySQL DB"}
            </button>
          </div>
        )}

        {/* Upload Results Summary */}
        {result && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Upload Statistics</h4>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Processed</span>
                <p className="text-xl font-bold text-slate-700 mt-0.5">{result.total_rows_processed}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Inserted</span>
                <p className="text-xl font-bold text-emerald-500 mt-0.5">{result.inserted_count}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Duplicates</span>
                <p className="text-xl font-bold text-amber-500 mt-0.5">{result.duplicate_count}</p>
              </div>
            </div>

            {/* Error logs */}
            {result.validation_errors && result.validation_errors.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-bold text-red-500">Validation Errors ({result.validation_errors.length}):</p>
                <div className="max-h-32 overflow-y-auto bg-red-50/50 rounded-xl p-3 border border-red-100 text-[10px] text-red-700 space-y-1 font-mono">
                  {result.validation_errors.map((err, i) => (
                    <div key={i}>- {err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Required Columns Side Information */}
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm flex flex-col justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">CSV Template Schema</h2>
          <p className="text-xs text-slate-400 mt-0.5">Validate your headers before uploading</p>

          <div className="mt-6 space-y-4">
            <p className="text-xs font-semibold text-slate-500 leading-relaxed">
              Your CSV file must contain the following columns exactly (case-insensitive headers will be mapped):
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {[
                { name: "invoice_id", desc: "Unique code identifying invoice (String)", ex: "INV-29004" },
                { name: "sale_date", desc: "Calendar timestamp of transaction (Date)", ex: "2026-05-22" },
                { name: "product_id", desc: "Unique code identifying product (String)", ex: "1479" },
                { name: "product_name", desc: "Retail name of inventory item (String)", ex: "White Sugar 1kg" },
                { name: "category", desc: "General retail store category (String)", ex: "Staples & Dry Groceries" },
                { name: "quantity_sold", desc: "Physical units of product sold (Integer)", ex: "15" },
                { name: "cost_price", desc: "Acquisition wholesale unit cost (Float)", ex: "210.0" },
                { name: "retail_price", desc: "Point-of-sales retail unit price (Float)", ex: "230.0" },
                { name: "total_revenue", desc: "Gross income: quantity * retail (Float)", ex: "3450.0" },
                { name: "profit", desc: "Gross profit margin: revenue - cost (Float)", ex: "300.0" }
              ].map((col) => (
                <div key={col.name} className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-bold text-slate-700">{col.name}</span>
                    <p className="text-[10px] text-slate-400">{col.desc}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-50 font-mono text-slate-500 font-semibold">{col.ex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 text-[10px] text-slate-400 leading-relaxed mt-6">
          Duplicate prevention is enforced based on `invoice_id + product_id + sale_date` to prevent transactional inflation.
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
