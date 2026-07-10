const StatCard = ({ label, number, trend, trendColor = "green", icon }) => {
  const getTrendColor = () => {
    switch (trendColor) {
      case "red": return "text-red-500 bg-red-50";
      case "blue": return "text-blue-500 bg-blue-50";
      case "purple": return "text-indigo-500 bg-indigo-50";
      case "yellow": return "text-amber-500 bg-amber-50";
      default: return "text-emerald-500 bg-emerald-50";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex justify-between items-start">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{number}</p>
        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTrendColor()}`}>
              {trend}
            </span>
          </div>
        )}
      </div>
      {icon && (
        <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
          {icon}
        </div>
      )}
    </div>
  );
};

export default StatCard;
