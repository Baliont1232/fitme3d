// =====================================================================
// Logo.jsx – a FitMe3D logó: korall jel (vállfa) + "FitMe3D" szójel
// =====================================================================

/**
 * A jel: korall lekerekített négyzet, benne fehér vállfa, a horog 3/4-es körívben (360°-os forgatás).
 */
export function LogoMark({ size = 28 }) {       // méret pixelben
  return ( // az SVG rajz
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">{/* 64×64-es rajzlap, a megadott méretben */}
      {/* korall alap, 22% sarokkerekítés */}
      <rect width="64" height="64" rx="14" fill="var(--color-accent)" />
      {/* fehér, egyvonalas vállfa */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {/* a horog íve */}
        <path d="M32 24 a5.5 5.5 0 1 1 5.5 -5.5" />
        {/* a vállfa teste */}
        <path d="M32 24 L13 41 Q11.5 43.5 14.5 44 L49.5 44 Q52.5 43.5 51 41 Z" />
      </g>
    </svg>
  );                                            // return vége
}                                               // komponens vége

/**
 * A teljes logó: jel + szójel. A "Fit" és "Me" grafit, a "3D" korall.
 */
export default function Logo() {                // nincs paramétere
  return ( // jel + szójel
    <span className="logo">{/* egymás mellett */}
      {/* a jel */}
      <LogoMark />
      {/* a szójel */}
      <span className="logo__word">FitMe<span className="logo__3d">3D</span></span>
    </span>
  );                                            // return vége
}                                               // komponens vége
