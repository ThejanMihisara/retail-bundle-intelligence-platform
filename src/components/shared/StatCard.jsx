const StatCard = ({ label, number, trend, trendColor = "green" }) => (
  <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
    <p className="text-sm font-semibold text-[#64748b]">{label}</p>
    <div className="mt-2 flex items-end justify-between">
      <p className="text-3xl font-bold text-[#0f172a]">{number}</p>
      {trend && (
        <span className={`text-sm font-semibold ${trendColor === "red" ? "text-[#dc2626]" : trendColor === "purple" ? "text-[#7c3aed]" : "text-[#16a34a]"}`}>
          {trend}
        </span>
      )}
    </div>
  </div>
);

export default StatCard;
