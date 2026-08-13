type Variant = "wall" | "floor" | "multi" | "water" | "commercial";

/**
 * Clean stylized illustration of a heat pump unit.
 * Used as fallback while no rights-cleared product photo exists in
 * `src/assets/lier/products/`. Never a generic abstract icon.
 */
export function HeatPumpIllustration({
  variant = "wall",
  label,
}: {
  variant?: Variant;
  label?: string;
}) {
  return (
    <div className="aspect-[4/3] w-full bg-gradient-to-br from-[hsl(var(--warm-sand))] to-[hsl(var(--warm-beige))] flex flex-col items-center justify-center gap-2 px-4">
      <svg
        viewBox="0 0 200 120"
        role="img"
        aria-label="Illustrasjon av varmepumpe"
        className="w-full max-w-[190px]"
      >
        <defs>
          <linearGradient id="hpBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#eef1f4" />
          </linearGradient>
        </defs>

        {/* wall / floor reference line */}
        <line
          x1="10"
          y1={variant === "floor" ? 104 : 22}
          x2="190"
          y2={variant === "floor" ? 104 : 22}
          stroke="hsl(var(--mcs-navy))"
          strokeOpacity="0.18"
          strokeWidth="2"
        />

        {variant === "water" ? (
          <>
            {/* outdoor unit */}
            <rect x="30" y="38" width="80" height="58" rx="8" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="70" cy="67" r="18" fill="none" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="70" cy="67" r="4" fill="hsl(var(--mcs-orange))" />
            {/* water tank */}
            <rect x="126" y="30" width="44" height="66" rx="10" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <path d="M148 48c8 8 8 12 0 18-8-6-8-10 0-18z" fill="hsl(var(--mcs-orange))" fillOpacity="0.75" />
            <line x1="110" y1="60" x2="126" y2="60" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="3" />
          </>
        ) : variant === "commercial" ? (
          <>
            {/* building silhouette + outdoor units */}
            <rect x="18" y="34" width="74" height="62" rx="6" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.3" strokeWidth="2" />
            {[0, 1, 2].map((r) =>
              [0, 1, 2].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={28 + c * 20}
                  y={44 + r * 17}
                  width="12"
                  height="10"
                  rx="2"
                  fill="hsl(var(--mcs-navy))"
                  fillOpacity="0.16"
                />
              ))
            )}
            <rect x="104" y="46" width="72" height="50" rx="8" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="140" cy="71" r="16" fill="none" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="140" cy="71" r="4" fill="hsl(var(--mcs-orange))" />
          </>
        ) : variant === "multi" ? (
          <>
            {/* two indoor units + one outdoor */}
            <rect x="16" y="30" width="70" height="20" rx="9" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <line x1="24" y1="45" x2="78" y2="45" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.25" strokeWidth="2" />
            <rect x="16" y="66" width="70" height="20" rx="9" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <line x1="24" y1="81" x2="78" y2="81" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.25" strokeWidth="2" />
            <rect x="112" y="44" width="66" height="50" rx="8" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="145" cy="69" r="16" fill="none" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
            <circle cx="145" cy="69" r="4" fill="hsl(var(--mcs-orange))" />
            <path d="M86 40h14v29h12" fill="none" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.3" strokeWidth="2" />
            <path d="M86 76h14" fill="none" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.3" strokeWidth="2" />
          </>
        ) : (
          <>
            {/* indoor unit — wall mounted or floor standing */}
            {variant === "floor" ? (
              <g>
                <rect x="52" y="46" width="96" height="58" rx="10" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
                <line x1="62" y1="92" x2="138" y2="92" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.25" strokeWidth="3" />
                <line x1="62" y1="60" x2="110" y2="60" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.15" strokeWidth="2" />
                <circle cx="134" cy="60" r="3" fill="hsl(var(--mcs-orange))" />
              </g>
            ) : (
              <g>
                <rect x="38" y="30" width="124" height="34" rx="14" fill="url(#hpBody)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.35" strokeWidth="2" />
                <line x1="50" y1="55" x2="150" y2="55" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.25" strokeWidth="3" />
                <line x1="50" y1="43" x2="112" y2="43" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.12" strokeWidth="2" />
                <circle cx="150" cy="43" r="3" fill="hsl(var(--mcs-orange))" />
              </g>
            )}
            {/* airflow */}
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={
                  variant === "floor"
                    ? `M${68 + i * 26} 34c6 5 6 9 0 14`
                    : `M${70 + i * 26} 74c6 6 6 11 0 17`
                }
                fill="none"
                stroke="hsl(var(--mcs-orange))"
                strokeOpacity={0.55 - i * 0.12}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
          </>
        )}
      </svg>
      {label && (
        <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--mcs-navy))]/45">
          {label}
        </span>
      )}
    </div>
  );
}
