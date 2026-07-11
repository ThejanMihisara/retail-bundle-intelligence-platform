const StatCard = ({ label, number, trend, trendColor = "green", icon }) => {
  const getTrendColor = () => {
    switch (trendColor) {
      case "red": return "text-red-600 bg-red-50";
      case "blue": return "text-blue-600 bg-blue-50";
      case "purple": return "text-indigo-600 bg-indigo-50";
      case "yellow": return "text-amber-600 bg-amber-50";
      default: return "text-emerald-600 bg-emerald-50";
    }
  };

  const getIconBg = () => {
    switch (trendColor) {
      case "red": return "bg-red-500/10 text-red-500";
      case "blue": return "bg-blue-500/10 text-blue-500";
      case "purple": return "bg-indigo-500/10 text-indigo-500";
      case "yellow": return "bg-amber-500/10 text-amber-500";
      default: return "bg-emerald-500/10 text-emerald-500";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-200/80 transition-all duration-300 hover:-translate-y-1 flex justify-between items-start group">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-extrabold text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors">{number}</p>
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getTrendColor()}`}>
              {trend}
            </span>
          </div>
        )}
      </div>
      {icon && (
        <div className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ${getIconBg()}`}>
          {icon}
        </div>
      )}
    </div>
  );
};

export default StatCard;
