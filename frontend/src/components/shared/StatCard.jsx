const DARK_COLORS = {
  emerald: { icon: { background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green-text)' }, badge: { background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green-text)', border: '1px solid rgba(16,185,129,0.22)' }, glow: 'rgba(16,185,129,0.12)' },
  blue:    { icon: { background: 'rgba(6,182,212,0.15)',  color: 'var(--accent-cyan-text)' }, badge: { background: 'rgba(6,182,212,0.12)',  color: 'var(--accent-cyan-text)', border: '1px solid rgba(6,182,212,0.22)'  }, glow: 'rgba(6,182,212,0.12)'  },
  purple:  { icon: { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }, badge: { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.22)' }, glow: 'rgba(99,102,241,0.12)' },
  yellow:  { icon: { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }, badge: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }, glow: 'rgba(245,158,11,0.12)' },
  red:     { icon: { background: 'rgba(239,68,68,0.15)',  color: '#fca5a5' }, badge: { background: 'rgba(239,68,68,0.12)',  color: '#fca5a5', border: '1px solid rgba(239,68,68,0.22)'  }, glow: 'rgba(239,68,68,0.12)'  },
};

const LIGHT_COLORS = {
  emerald: { icon: { background: 'rgba(5,150,105,0.14)', color: '#059669', border: '1px solid rgba(5,150,105,0.18)' }, badge: { background: 'rgba(5,150,105,0.11)', color: '#059669', border: '1px solid rgba(5,150,105,0.28)' }, glow: 'rgba(5,150,105,0.10)' },
  blue:    { icon: { background: 'rgba(8,145,178,0.14)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.18)' }, badge: { background: 'rgba(8,145,178,0.11)', color: '#0891b2', border: '1px solid rgba(8,145,178,0.28)' }, glow: 'rgba(8,145,178,0.10)' },
  purple:  { icon: { background: 'rgba(79,70,229,0.12)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.18)' }, badge: { background: 'rgba(79,70,229,0.10)', color: '#4f46e5', border: '1px solid rgba(79,70,229,0.24)' }, glow: 'rgba(79,70,229,0.10)' },
  yellow:  { icon: { background: 'rgba(217,119,6,0.13)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }, badge: { background: 'rgba(217,119,6,0.10)', color: '#d97706', border: '1px solid rgba(217,119,6,0.26)' }, glow: 'rgba(217,119,6,0.10)' },
  red:     { icon: { background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.18)' }, badge: { background: 'rgba(220,38,38,0.10)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.24)' }, glow: 'rgba(220,38,38,0.10)' },
};

const StatCard = ({ label, number, trend, trendColor = "emerald", icon }) => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const palette = isLight ? LIGHT_COLORS : DARK_COLORS;
  const theme = palette[trendColor] || palette.emerald;

  return (
    <div
      className="glass-card p-5 flex flex-col justify-between h-[120px] group transition-all duration-300 hover:-translate-y-1"
      style={{
        '--glow-color': theme.glow,
      }}
    >
      {/* Top Row: Label and Icon */}
      <div className="flex justify-between items-center gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-label)' }}>{label}</p>
        {icon && (
          <div className="p-2 rounded-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110" style={theme.icon}>
            {icon}
          </div>
        )}
      </div>

      {/* Bottom Row: Value and Trend */}
      <div className="space-y-1.5 mt-auto">
        <p className="text-[22px] font-extrabold tracking-tight leading-none truncate" style={{ color: 'var(--text-primary)' }}>{number}</p>
        {trend && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={theme.badge}>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
