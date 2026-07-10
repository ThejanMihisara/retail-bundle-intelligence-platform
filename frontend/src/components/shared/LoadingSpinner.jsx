const LoadingSpinner = ({ label = "Loading data...", fullPage = false }) => {
  const spinnerElement = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
        <div className="w-6 h-6 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin absolute rotate-45"></div>
      </div>
      {label && <p className="text-xs font-semibold text-slate-500 animate-pulse">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        {spinnerElement}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-slate-500">
      <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin"></div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
};

export default LoadingSpinner;
