// =====================================================================
// ColorSwatches.jsx – színválasztó színkörök (UI terv 4., Design terv 4.2)
// A kiválasztott kör körül grafit gyűrű, a szín neve a kör alatt is látszik.
// =====================================================================

export default function ColorSwatches({ colors, selected, onSelect, size = 'md' }) { // színek [{name, hex}], kiválasztott név, kezelő, méret
  const current = colors.find((c) => c.name === selected); // a kiválasztott szín adatai
  return ( // a színválasztó
    <div className={`swatches swatches--${size}`}>{/* tároló, méret szerinti stílussal */}
      <div className="swatches__row" role={onSelect ? 'radiogroup' : undefined} aria-label="Szín">{/* a körök sora */}
        {colors.map((c) => (                    /* minden színre egy kör */
          onSelect ? ( // ha választható: gomb
            <button // színkör gomb
              key={c.name} // egyedi kulcs
              type="button" // sima gomb
              role="radio" // rádiógombként
              aria-checked={selected === c.name} // kiválasztott-e
              aria-label={c.name} // a szín neve képernyőolvasónak
              title={c.name} // tooltip
              className={`swatch ${selected === c.name ? 'is-selected' : ''}`} // stílus
              style={{ '--swatch': c.hex }} // a kör színe
              onClick={() => onSelect(c.name)} // kiválasztás
            />
          ) : ( // különben: csak megjelenítés
            <span key={c.name} className="swatch swatch--static" title={c.name} style={{ '--swatch': c.hex }} /> // nem kattintható színkör (pl. kártyán)
          )
        ))}
      </div>
      {/* a kiválasztott szín neve a körök alatt */}
      {onSelect && current && <span className="swatches__name">{current.name}</span>}
    </div>
  );                                            // return vége
}                                               // komponens vége
