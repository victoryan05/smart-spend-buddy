import type { Brand } from "@/lib/spendy-brands";

export function BrandLogo({ brand, size = 44 }: { brand: Brand; size?: number }) {
  const lines = brand.mono ? brand.mono.split("\n") : [brand.name[0]];
  // Pick a font size that fits ~6 chars on the longest line
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const fontSize = Math.max(8, Math.min(15, Math.round((size * 0.9) / longest)));
  return (
    <div
      className="grid place-items-center shrink-0 rounded-xl border border-black/5 shadow-sm overflow-hidden"
      style={{ background: brand.color, color: brand.fg, width: size, height: size }}
      aria-label={brand.name}
    >
      <div className="flex flex-col items-center justify-center leading-[1] text-center px-1">
        {lines.map((l, i) => (
          <span
            key={i}
            className="font-extrabold tracking-tight whitespace-nowrap"
            style={{ fontSize, lineHeight: 1.05 }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
