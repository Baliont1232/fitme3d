// =====================================================================
// SizeChips.jsx – méretválasztó chipek (XS–XXL), "Ajánlott" jelvénnyel
// Az elfogyott méret áthúzva látszik és nem választható (UI terv 4.).
// =====================================================================

export default function SizeChips({ sizes, selected, recommended, soldOut = [], onSelect }) { // méretek, kiválasztott, ajánlott, elfogyottak, kezelő
  return ( // a méretválasztó
    <div className="size-chips" role="radiogroup" aria-label="Méret">{/* chipek sora */}
      {sizes.map((size) => {                    /* minden méretre egy chip */
        const isSoldOut = soldOut.includes(size); /* elfogyott-e */
        const isRec = size === recommended;     /* ajánlott-e */
        return ( // egy chip a jelvénnyel
          <div key={size} className="size-chip-wrap">{/* tároló (a jelvény ehhez igazodik) */}
            {/* "Ajánlott" jelvény a chip felett */}
            {isRec && <span className="badge badge--accent">Ajánlott</span>}
            <button // a méret gomb
              type="button" // sima gomb
              role="radio" // rádiógombként viselkedik
              aria-checked={selected === size} // ki van-e választva
              className={`size-chip ${selected === size ? 'is-selected' : ''} ${isSoldOut ? 'is-soldout' : ''}`} // állapot szerinti stílus
              disabled={isSoldOut} // elfogyottnál nem kattintható
              title={isSoldOut ? 'Ebből a méretből elfogyott' : undefined} // súgó szöveg
              onClick={() => onSelect(size)} // kiválasztás
            >{/* a nyitó címke vége */}
              {size}{/* a méret felirata (pl. M) */}
            </button>
          </div>
        );
      })}
    </div>
  );                                            // return vége
}                                               // komponens vége
