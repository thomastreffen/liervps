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
          <linearGradient id="hpFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#f7f9fb" />
            <stop offset="100%" stopColor="#e6ebf0" />
          </linearGradient>
          <linearGradient id="hpVent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--mcs-navy))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--mcs-navy))" stopOpacity="0.06" />
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
                <ellipse cx="100" cy="106" rx="52" ry="4" fill="hsl(var(--mcs-navy))" fillOpacity="0.07" />
                <rect x="54" y="44" width="92" height="60" rx="12" fill="url(#hpFace)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.28" strokeWidth="1.6" />
                <path d="M62 50h76" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
                <rect x="64" y="88" width="72" height="8" rx="4" fill="url(#hpVent)" />
                <path d="M64 62h48" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.09" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="132" cy="62" r="2.4" fill="hsl(var(--mcs-orange))" />
              </g>
            ) : (
              <g>
                {/* soft shadow under the unit */}
                <ellipse cx="100" cy="70" rx="60" ry="5" fill="hsl(var(--mcs-navy))" fillOpacity="0.07" />
                {/* main body — slim, rounded, modern */}
                <rect x="34" y="28" width="132" height="36" rx="17" fill="url(#hpFace)" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.28" strokeWidth="1.6" />
                {/* top surface highlight */}
                <path d="M44 34h112" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
                {/* louvre / air outlet */}
                <rect x="44" y="53" width="112" height="7" rx="3.5" fill="url(#hpVent)" />
                <path d="M46 56.5h108" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" />
                {/* subtle front seam + display */}
                <path d="M44 45h74" stroke="hsl(var(--mcs-navy))" strokeOpacity="0.09" strokeWidth="1.4" strokeLinecap="round" />
                <rect x="132" y="41" width="22" height="6" rx="3" fill="hsl(var(--mcs-navy))" fillOpacity="0.08" />
                <circle cx="151" cy="44" r="2.2" fill="hsl(var(--mcs-orange))" />
              </g>
            )}
            {/* airflow */}
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={
                  variant === "floor"
                    ? `M${74 + i * 24} 104c6 5 6 9 0 14`
                    : `M${72 + i * 26} 70c6 6 6 11 0 17`
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
