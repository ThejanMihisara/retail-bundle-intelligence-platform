import logoImage from "../../assets/bundlemind-logo.png";

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

const BrandMark = ({ size = "md", className = "" }) => (
  <img
    src={logoImage}
    alt=""
    className={`${sizeClasses[size] || sizeClasses.md} flex-shrink-0 object-contain drop-shadow-[0_10px_18px_rgba(16,185,129,0.24)] ${className}`}
    aria-hidden="true"
  />
);

const BrandLogo = ({
  size = "md",
  title = "BundleMind",
  subtitle = "Retail Intelligence",
  centered = false,
  lightText = false,
  className = "",
}) => (
  <div className={`flex items-center gap-3 ${centered ? "justify-center" : ""} ${className}`}>
    <BrandMark size={size} />
    <div>
      <h1
        className={`${size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-[15px]"} font-extrabold tracking-tight leading-none ${
          lightText ? "text-white" : "text-gradient-brand"
        }`}
      >
        {title}
      </h1>
      <p
        className={`${size === "lg" ? "mt-2 text-xs" : "mt-1 text-[9px]"} uppercase tracking-widest font-bold`}
        style={{ color: lightText ? "rgba(255,255,255,0.86)" : "var(--accent-green)" }}
      >
        {subtitle}
      </p>
    </div>
  </div>
);

export { BrandMark };
export default BrandLogo;
