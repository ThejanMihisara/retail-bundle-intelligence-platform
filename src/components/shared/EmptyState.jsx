const EmptyState = ({ title = "No data available", message = "Upload a dataset first." }) => (
  <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-8 text-center">
    <h3 className="text-lg font-semibold text-[#0f172a]">{title}</h3>
    <p className="mt-2 text-sm text-[#64748b]">{message}</p>
  </div>
);

export default EmptyState;
