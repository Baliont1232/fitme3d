// =====================================================================
// useHuman.js – React horog: betölti az avatar adatcsomagot, és a
// testprofilból kiszámolja az avatart (csak ha a méretek változnak)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'; // React horgok
import { loadHumanData, buildHuman } from './humanModel.js'; // a valódi emberi modell

/**
 * Visszaadja a kiszámolt avatart, vagy null-t, amíg az adatcsomag töltődik.
 */
export function useHuman(profile) {             // testprofil
  const [data, setData] = useState(null);       // a betöltött adatcsomag
  const [error, setError] = useState(null);     // betöltési hiba

  useEffect(() => {                             // betöltés az első használatkor
    let alive = true;                           // ha közben eltűnik a komponens, ne írjuk az állapotot
    loadHumanData()                             // a csomag letöltése (csak egyszer történik meg)
      .then((d) => { if (alive) setData(d); })  // siker
      .catch((e) => { if (alive) setError(e); }); // hiba
    return () => { alive = false; };            // takarítás
  }, []);                                       // csak egyszer

  const key = profile ? [profile.gender, profile.height_cm, profile.weight_kg, profile.chest_cm, profile.waist_cm, profile.hip_cm].join('|') : ''; // a méretek "ujjlenyomata"
  const human = useMemo(                        // az avatar kiszámítása
    () => (data && profile ? buildHuman(data, profile) : null), // csak ha van adat és profil
    [data, key],                                // eslint-disable-line react-hooks/exhaustive-deps -- csak valódi méretváltozáskor számol újra
  );                                            // useMemo vége
  return { human, error, loading: !data && !error }; // avatar, hiba, töltés állapota
}                                               // horog vége
