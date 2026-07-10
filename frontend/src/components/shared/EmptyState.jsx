const EmptyState = ({ title = "No data available", message = "Upload a dataset first to begin.", actionText, onAction }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center max-w-md mx-auto my-8 flex flex-col items-center">
    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-6">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m0 4h.01m-6.99 3h3.99m-11.99-3h11.99"></path>
      </svg>
    </div>
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
    <p className="mt-2 text-xs text-slate-400 max-w-xs">{message}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs px-5 py-3 shadow-md shadow-emerald-500/10 transition-all duration-200"
      >
        {actionText}
      </button>
    )}
  </div>
);

export default EmptyState;
