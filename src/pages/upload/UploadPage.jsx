import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import LoadingSpinner from "../../components/shared/LoadingSpinner";
import { getDatasets, saveDataset, validateDataset } from "../../services/uploadService";

const UploadPage = () => {
  const [file, setFile] = useState(null);
  const [datasetName, setDatasetName] = useState("");
  const [channelStore, setChannelStore] = useState("");
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState("");
  const [count, setCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    getDatasets().then((res) => setCount(res.data.length)).catch(() => setCount(0));
  }, []);

  const chooseFile = (selected) => {
    setFile(selected);
    setDatasetName(selected?.name || "");
    setValidated(false);
  };

  const validate = async () => {
    if (!file || !datasetName || !channelStore) {
      toast.error("Choose a file and fill dataset details");
      return;
    }
    setLoading("validate");
    try {
      const res = await validateDataset(file);
      setValidated(true);
      toast.success(`Dataset valid! ${res.data.row_count} rows detected.`);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Dataset validation failed");
    } finally {
      setLoading("");
    }
  };

  const upload = async () => {
    setLoading("upload");
    try {
      await saveDataset(file, datasetName, channelStore);
      toast.success("Dataset uploaded successfully!");
      setFile(null);
      setDatasetName("");
      setChannelStore("");
      setValidated(false);
      setCount((value) => value + 1);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-6">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">CSV Upload & Validation</h2>
        <p className="text-sm text-[#64748b]">Clean and map retail transaction data</p>
        <p className="mt-2 text-sm font-semibold text-[#64748b]">{count} existing datasets</p>
        <div
          className="mx-auto mt-8 flex h-48 w-[520px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0]);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <p className="text-2xl font-bold text-[#0f172a]">Drag & drop CSV / Excel</p>
          <p className="mt-3 text-sm font-semibold text-[#64748b]">or browse local files</p>
          <button type="button" className="mt-8 h-11 w-64 rounded-lg bg-[#2563eb] font-semibold text-white">Choose File</button>
          <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => chooseFile(e.target.files[0])} />
        </div>
        {file && <p className="mx-auto mt-4 w-[520px] text-sm font-semibold text-[#16a34a]">{file.name}</p>}
        <div className="mx-auto mt-6 w-[520px] space-y-4">
          <label className="block text-sm font-semibold text-[#64748b]">Dataset name</label>
          <input className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4 outline-none" placeholder="Q4_transactions.csv" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
          <label className="block text-sm font-semibold text-[#64748b]">Channel / Store</label>
          <input className="h-11 w-full rounded-lg border border-[#dbe3ec] px-4 outline-none" placeholder="Main outlet" value={channelStore} onChange={(e) => setChannelStore(e.target.value)} />
          <div className="flex gap-5 pt-8">
            <button className="h-12 w-44 rounded-lg bg-[#2563eb] font-semibold text-white" onClick={validate} disabled={loading === "validate"}>{loading === "validate" ? <LoadingSpinner label="Validating" /> : "Validate Dataset"}</button>
            <button className="h-12 w-40 rounded-lg bg-[#16a34a] font-semibold text-white disabled:opacity-50" onClick={upload} disabled={!validated || loading === "upload"}>{loading === "upload" ? <LoadingSpinner label="Uploading" /> : "Upload"}</button>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0f172a]">Required Columns</h2>
        <p className="text-sm text-[#64748b]">Minimum schema</p>
        <table className="mt-5 w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[#64748b]">
            <tr><th className="border border-[#e2e8f0] px-4 py-3">Column</th><th className="border border-[#e2e8f0] px-4 py-3">Example</th></tr>
          </thead>
          <tbody className="font-semibold text-[#0f172a]">
            {[["Order ID", "#1004"], ["Product", "Milk 1L"], ["Quantity", "2"], ["Date", "2026-05-25"], ["Price", "4.99"]].map(([column, example]) => (
              <tr key={column}><td className="border border-[#e2e8f0] px-4 py-4">{column}</td><td className="border border-[#e2e8f0] px-4 py-4">{example}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UploadPage;
