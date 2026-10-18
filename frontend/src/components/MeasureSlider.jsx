// =====================================================================
// MeasureSlider.jsx – csúszka + számmező egy testmérethez (UI terv 4.)
// A kettő együtt mozog. A számmezőbe beírt, tartományon kívüli értéknél
// hibaüzenet jelenik meg a mező elhagyásakor, a csúszka a határon marad.
// =====================================================================

import { useEffect, useId, useState } from 'react'; // React horgok
import { HelpCircle } from 'lucide-react';       // "?" ikon a mérési útmutatóhoz

/**
 * field: a fit-config.json "meresek" bejegyzése (nev, min, max, lepes, egyseg); hint: mérési útmutató szöveg.
 */
export default function MeasureSlider({ field, value, onChange, hint }) { // props
  const id = useId();                           // egyedi azonosító a címke és a mező összekötéséhez
  const [text, setText] = useState(String(value)); // a számmező szövege (gépelés közben eltérhet az értéktől)
  const [error, setError] = useState('');       // hibaüzenet
  const [showHint, setShowHint] = useState(false); // látszik-e az útmutató

  useEffect(() => { setText(String(value)); }, [value]); // ha kívülről változik az érték (pl. csúszka), a mező is frissül

  const commit = (raw) => {                     // a beírt szöveg érvényesítése
    const num = Number(String(raw).replace(',', '.')); // tizedesvessző is elfogadott
    if (!Number.isFinite(num) || raw === '') {  // ha nem szám
      setError(`Add meg a ${field.targyrag} értékét.`); // hibaüzenet
      return;                                   // nincs változás
    }                                           // if vége
    if (num < field.min || num > field.max) {   // ha kívül esik a tartományon
      setError(`A ${field.targyrag} értéke nem reális (${field.min}–${field.max} ${field.egyseg})`); // UI terv szerinti szöveg
      onChange(Math.min(field.max, Math.max(field.min, num))); // az avatar a legközelebbi határértékkel épül
      return;                                   // vége
    }                                           // if vége
    setError('');                               // nincs hiba
    onChange(num);                              // új érték
  };                                            // függvény vége

  const percent = ((value - field.min) / (field.max - field.min)) * 100; // a csúszka kitöltött része százalékban

  return ( // a mérés blokkja
    <div className={`measure ${error ? 'has-error' : ''}`}>{/* hibánál piros stílus */}
      {/* címke és "?" gomb */}
      <div className="measure__head">
        <label htmlFor={id} className="field__label">{field.nev}</label>{/* a mező címkéje (a számmezőhöz kötve) */}
        {hint && ( // ha van útmutató, "?" gomb
          <button type="button" className="icon-btn icon-btn--ghost" aria-label={`Hogyan mérjem: ${field.nev}`} aria-expanded={showHint} onClick={() => setShowHint((v) => !v)}>{/* "?" gomb, kattintásra nyit/zár */}
            <HelpCircle size={18} />{/* kérdőjel ikon */}
          </button>
        )}
      </div>
      {/* mérési útmutató (kinyitható) */}
      {showHint && <p className="measure__hint">{hint}</p>}
      <div className="measure__row">{/* csúszka és szám egy sorban */}
        {/* csúszka: a sín kitöltése CSS változóval */}
        <input
          type="range" // csúszka típus
          className="slider" // stílus
          min={field.min} // alsó határ
          max={field.max} // felső határ
          step={field.lepes} // lépésköz
          value={value} // aktuális érték
          style={{ '--fill': `${percent}%` }} // a kitöltött rész szélessége
          onChange={(e) => { setError(''); onChange(Number(e.target.value)); }} // húzáskor azonnal frissül az avatar
          aria-label={`${field.nev} csúszka`} // képernyőolvasónak
        />
        {/* számmező mértékegységgel */}
        <div className="measure__number">
          <input // a számmező
            id={id} // a címkéhez kötve
            className="input input--number" // stílus
            inputMode="decimal" // mobilon számbillentyűzet
            value={text} // a mező szövege
            onChange={(e) => setText(e.target.value)} // gépelés közben csak a szöveg változik
            onBlur={() => commit(text)} // a mező elhagyásakor ellenőrzés
            onKeyDown={(e) => { if (e.key === 'Enter') commit(text); }} // Enterre is
            aria-invalid={!!error} // hibás-e (képernyőolvasónak)
            aria-describedby={error ? `${id}-err` : undefined} // a hibaüzenet hozzárendelése
          />
          <span className="measure__unit">{field.egyseg}</span>{/* mértékegység a mező jobb szélén */}
        </div>
      </div>
      {/* hibaüzenet a mező alatt, pirossal, ikonnal */}
      {error && <p id={`${id}-err`} className="field__error"><span className="field__error-icon" aria-hidden="true">!</span>{error}</p>}
    </div>
  );                                            // return vége
}                                               // komponens vége
