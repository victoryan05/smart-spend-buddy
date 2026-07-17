export function SpendyLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size * 1.2} height={size} viewBox="0 0 48 40" fill="none" aria-hidden>
        {/* back card, tilted left, lighter peach */}
        <rect
          x="2" y="8" width="24" height="30" rx="5"
          fill="#f7c9a8"
          transform="rotate(-14 14 23)"
        />
        {/* front card, tilted slightly right, deeper peach */}
        <rect
          x="10" y="6" width="24" height="30" rx="5"
          fill="#f0a988"
          transform="rotate(6 22 21)"
        />
      </svg>
      <span
        className="text-2xl leading-none lowercase"
        style={{
          color: "#ee7a5f",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          fontFamily:
            "'Nunito', 'Quicksand', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
        }}
      >
        spendy
      </span>
    </div>
  );
}
