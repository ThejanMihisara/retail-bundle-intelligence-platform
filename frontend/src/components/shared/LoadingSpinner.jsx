const LoadingSpinner = ({ label = "Loading...", fullPage = false }) => {
  // Compact inline spinner — works inside buttons (auth pages) and small spaces
  const inlineSpinner = (
    <div className="flex items-center gap-2.5">
      <svg
        className="animate-spin"
        style={{ width: '14px', height: '14px', flexShrink: 0 }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span>{label}</span>}
    </div>
  );

  // Full-page spinner — used in protected pages (dark theme)
  const fullPageSpinner = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-12 h-12">
        <svg
          className="animate-spin w-12 h-12"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12" cy="12" r="10"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <path
            fill="none"
            stroke="url(#spinGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            d="M12 2a10 10 0 0110 10"
          />
          <defs>
            <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-green)" />
              <stop offset="100%" stopColor="var(--accent-cyan)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {label && (
        <p className="text-xs font-semibold" style={{ color: 'rgba(148,163,184,0.6)' }}>{label}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex flex-1 h-full min-h-[400px] items-center justify-center">
        {fullPageSpinner}
      </div>
    );
  }

  return inlineSpinner;
};

export default LoadingSpinner;
