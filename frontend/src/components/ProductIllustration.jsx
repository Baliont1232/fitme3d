// =====================================================================
// ProductIllustration.jsx – egyszerű, színezhető termékrajz (SVG)
// A prototípusban még nincsenek termékfotók, ezért a kártyán a ruha
// sziluettje látszik a választott színben, világos háttéren (4:5 arány).
// =====================================================================

const SHAPES = {                                // ruhatípus → SVG útvonal (100×125-ös rajzlapon)
  polo: 'M30 22 L42 16 Q50 22 58 16 L70 22 L88 36 L80 50 L72 45 L72 104 Q50 108 28 104 L28 45 L20 50 L12 36 Z', // póló: rövid ujj
  pulover: 'M31 20 L42 15 Q50 21 58 15 L69 20 L84 34 L92 92 L82 94 L72 50 L72 104 Q50 108 28 104 L28 50 L18 94 L8 92 L16 34 Z', // pulóver: hosszú ujj
  nadrag: 'M30 14 L70 14 L74 112 L56 112 L50 48 L44 112 L26 112 Z', // nadrág: két szár
  ov: 'M8 56 Q50 48 92 56 L92 66 Q50 58 8 66 Z',  // öv: ívelt szalag
};                                              // objektum vége

export default function ProductIllustration({ type, color }) { // ruhatípus és szín
  return ( // az SVG rajz
    <svg className="illustration" viewBox="0 0 100 125" role="img" aria-label="Termékillusztráció">{/* 100×125-ös rajzlap (4:5 arány) */}
      {/* a ruha sziluettje a választott színnel, vékony sötét körvonallal */}
      <path d={SHAPES[type] ?? SHAPES.polo} fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="1" strokeLinejoin="round" />
      {/* övnél a csat */}
      {type === 'ov' && <rect x="44" y="51" width="12" height="11" rx="2" fill="#B5B1AC" stroke="rgba(0,0,0,.25)" />}
      {/* nadrágnál a derékpánt vonala */}
      {type === 'nadrag' && <path d="M30 22 L70 22" stroke="rgba(0,0,0,.2)" strokeWidth="1.5" />}
    </svg>
  );                                            // return vége
}                                               // komponens vége
