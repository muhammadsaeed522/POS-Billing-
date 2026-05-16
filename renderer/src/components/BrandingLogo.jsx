const SIZE = {
  xs: "h-8 w-8",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-20 w-20"
};

export function BrandingLogo({
  url,
  alt = "Store logo",
  size = "md",
  className = "",
  rounded = "rounded-xl",
  showFallback = true
}) {
  const dim = SIZE[size] ?? SIZE.md;

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className={`${dim} shrink-0 object-contain ${rounded} ${className}`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  if (!showFallback) return null;

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 ${rounded} ${className}`}
      aria-hidden={alt ? undefined : true}
    >
      POS
    </div>
  );
}
