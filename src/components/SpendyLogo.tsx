export function SpendyLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <defs>
          <linearGradient id="spg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd2b5" />
            <stop offset="60%" stopColor="#ff8a5c" />
            <stop offset="100%" stopColor="#e85a32" />
          </linearGradient>
        </defs>
        {/* stacked cards mark */}
        <rect x="4" y="11" width="26" height="18" rx="4" fill="url(#spg)" opacity=".55" transform="rotate(-10 17 20)"/>
        <rect x="8" y="10" width="26" height="18" rx="4" fill="url(#spg)"/>
        <rect x="12" y="15" width="14" height="2" rx="1" fill="#fff" opacity=".85"/>
        <rect x="12" y="19" width="8" height="2" rx="1" fill="#fff" opacity=".6"/>
      </svg>
      <span className="font-display text-2xl text-ink leading-none">spendy</span>
    </div>
  );
}
