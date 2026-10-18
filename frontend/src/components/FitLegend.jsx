// =====================================================================
// FitLegend.jsx – az illeszkedési térkép jelmagyarázata
// A szín mellett mindig szöveg is van, mert a piros–zöld párost a
// színtévesztők nem tudják megkülönböztetni (UI terv 10.1).
// =====================================================================

import { regionSummary } from '../fit/fitCalc.js'; // "Mell: jó · Derék: kissé bő" szöveg

export default function FitLegend({ evaluation }) { // a kiválasztott méret kiértékelése
  return ( // a jelmagyarázat
    <div className="fit-legend">{/* fehér doboz a vászon alján */}
      {/* a három szín jelentése */}
      <ul className="fit-legend__keys">
        <li><span className="dot dot--success" aria-hidden="true" /> jó</li>{/* zöld = jó */}
        <li><span className="dot dot--warning" aria-hidden="true" /> kissé szűk / bő</li>{/* sárga = kissé szűk vagy bő */}
        <li><span className="dot dot--danger" aria-hidden="true" /> szorít</li>{/* piros = szorít */}
      </ul>
      {/* szöveges régiólista */}
      <p className="fit-legend__regions">{regionSummary(evaluation)}</p>
    </div>
  );                                            // return vége
}                                               // komponens vége
