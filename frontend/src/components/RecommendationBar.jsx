// =====================================================================
// RecommendationBar.jsx – a méretajánló sáv (UI terv 7.5, Design terv 4.3)
// Zöld: az ajánlott méret van kiválasztva. Sárga: eltérő méret, "Vissza" linkkel.
// A "Miért?" régiónként mutatja a ráhagyást, hogy az ajánlásnak hinni lehessen.
// =====================================================================

import { useState } from 'react';               // állapot horog
import { CheckCircle2, AlertTriangle } from 'lucide-react'; // ikonok

export default function RecommendationBar({ message, evaluation, onBack }) { // üzenet, kiértékelés, "vissza" kezelő
  const [open, setOpen] = useState(false);      // nyitva van-e a "Miért?" rész
  if (!message) return null;                    // ha nincs ajánlás, semmi sem jelenik meg
  const Icon = message.tone === 'success' ? CheckCircle2 : AlertTriangle; // zöldnél pipa, sárgánál figyelmeztetés

  return ( // a sáv
    <div className={`rec-bar rec-bar--${message.tone}`} role="status">{/* zöld vagy sárga háttér a hangnem szerint */}
      {/* ikon a bal oldalon */}
      <Icon size={20} className="rec-bar__icon" aria-hidden="true" />
      <div className="rec-bar__body">{/* szöveges rész */}
        {/* a fő mondat, pl. "Neked az M méret ajánlott – derékban kissé bő" */}
        <p className="rec-bar__text">{message.text}</p>
        <div className="rec-bar__links">{/* linkek egy sorban */}
          {/* sárga sávnál: vissza az ajánlott méretre */}
          {message.backTo && <button type="button" className="btn btn--text" onClick={onBack}>Vissza az {message.backTo}-re</button>}
          {/* részletek ki/be */}
          <button type="button" className="btn btn--text" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Miért?</button>
        </div>
        {/* régiónkénti részletek: a ruha hány cm-rel nagyobb a testnél */}
        {open && evaluation && (
          <ul className="rec-bar__details">{/* részletek listája */}
            {evaluation.regions.map((r) => (     /* minden mért régióra egy sor */
              <li key={r.region}>{/* egy régió sora */}
                <span className={`dot dot--${r.level}`} aria-hidden="true" />{/* a régió állapotszíne */}
                {r.name}: {r.label} <span className="muted">({r.ease > 0 ? '+' : ''}{r.ease} cm ráhagyás)</span>{/* pl. "Derék: kissé szűk (−2 cm ráhagyás)" */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );                                            // return vége
}                                               // komponens vége
