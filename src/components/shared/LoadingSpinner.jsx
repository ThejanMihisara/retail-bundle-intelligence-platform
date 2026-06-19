const LoadingSpinner = ({ label = "Loading" }) => (
  <span className="inline-flex items-center gap-2">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    {label}
  </span>
);

export default LoadingSpinner;
