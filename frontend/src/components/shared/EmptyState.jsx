const EmptyState = ({ title = "No Data Found", message = "There is nothing to display here.", actionText, onAction }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-5 animate-fade-in">
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center"
      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', boxShadow: '0 0 30px rgba(99,102,241,0.07)' }}
    >
      <svg className="w-9 h-9" style={{ color: 'rgba(99,102,241,0.5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <div className="text-center max-w-xs">
      <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
    {actionText && onAction && (
      <button onClick={onAction} className="btn-primary" style={{ height: '2.25rem', padding: '0 1.25rem', fontSize: '0.75rem' }}>
        {actionText}
      </button>
    )}
  </div>
);

export default EmptyState;
