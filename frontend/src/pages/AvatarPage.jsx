// =====================================================================
// AvatarPage.jsx – avatar készítő (UI terv 7.3)
// Bal oldalt a méretek (csúszka + számmező), jobb oldalt az élő 3D
// előnézet, amely minden mozdulatra azonnal frissül.
// A prototípusban az "egyoldalas" változat van; a 3 lépéses varázsló később jön.
// =====================================================================

import { useState } from 'react';               // állapot horog
import { useNavigate, useSearchParams } from 'react-router-dom'; // navigáció és URL paraméterek
import { Lock } from 'lucide-react';            // lakat ikon az adatvédelmi szöveghez
import Stage3D from '../three/Stage3D.jsx';     // 3D vászon
import MeasureSlider from '../components/MeasureSlider.jsx'; // csúszka + számmező
import { useAuth } from '../context/AuthContext.jsx'; // profil és mentés
import { useToast } from '../context/ToastContext.jsx'; // értesítések
import { fitConfig } from '../fit/fitCalc.js';  // tartományok és alapértékek
import { ApiError } from '../api/client.js';    // hibatípus

const FIELDS = ['height_cm', 'weight_kg', 'chest_cm', 'waist_cm', 'hip_cm']; // a mért mezők sorrendje
const HINTS = {                                 // mérési útmutatók a "?" ikonhoz
  height_cm: 'Állj mezítláb a falnak, a sarkad érjen a falhoz. Jelöld meg a fejed tetejét, és mérd le a padlótól.', // magasság
  weight_kg: 'Reggel, könnyű ruhában mérd, mérlegen.', // súly
  chest_cm: 'A mérőszalagot vízszintesen a mell legszélesebb részén, a hónalj alatt vezesd körbe. Ne húzd szorosra.', // mell
  waist_cm: 'A derék legkeskenyebb részén mérd, általában a köldök felett. Lélegezz ki nyugodtan.', // derék
  hip_cm: 'Állj össze zárt lábbal, és a csípő–fenék legszélesebb részén mérd körbe.', // csípő
};                                              // objektum vége

export default function AvatarPage() {          // oldal komponens
  const { profile, user, saveProfile } = useAuth(); // a jelenlegi profil, felhasználó, mentés
  const toast = useToast();                     // értesítések
  const navigate = useNavigate();               // programozott navigáció
  const [params] = useSearchParams();           // URL paraméterek
  const back = params.get('vissza');            // honnan jött (pl. a próbafülkéből)
  const [values, setValues] = useState(() => { // az űrlap értékei
    const base = profile ?? fitConfig.alapAvatar; // a mentett profil, vagy az alapavatar
    return { gender: Number(base.gender), ...Object.fromEntries(FIELDS.map((f) => [f, Number(base[f])])) }; // számokká alakítva
  });                                           // useState vége
  const [saving, setSaving] = useState(false);  // mentés folyamatban
  const [errors, setErrors] = useState({});     // szerver oldali hibák mezőnként

  const set = (field, value) => setValues((v) => ({ ...v, [field]: value })); // egy mező módosítása

  const onSave = async () => {                  // "Avatar mentése" gomb
    setSaving(true);                            // töltés jelzése
    setErrors({});                              // régi hibák törlése
    try {                                       // a mentés hibát dobhat
      const { savedToAccount } = await saveProfile(values); // mentés (fiókba vagy helyben)
      if (savedToAccount) {                     // fiókba mentve
        toast.show('Avatar mentve');            // siker
        navigate(back || '/ruhak');             // vissza oda, ahonnan jött, vagy a ruhákhoz
      } else {                                  // belépés nélkül
        toast.show('Az avatarod elkészült. Lépj be, hogy a fiókodba is elmentsük.', 'info'); // tájékoztatás
        navigate(`/belepes?vissza=${encodeURIComponent(back || '/ruhak')}`); // belépés, a méretek megmaradnak
      }                                         // if-else vége
    } catch (e) {                               // hiba
      if (e instanceof ApiError && e.fields) setErrors(e.fields); // mezőnkénti hibák a szervertől
      toast.show(e.message, 'error');           // hibaüzenet
    } finally {                                 // mindenképp
      setSaving(false);                         // töltés vége
    }                                           // try-catch-finally vége
  };                                            // függvény vége

  return ( // az oldal
    <div className="page avatar-page">{/* két oszlop: űrlap és előnézet */}
      {/* bal oldal: az űrlap */}
      <section className="avatar-page__form">
        <h1>Avatarom</h1>{/* oldalcím */}
        <p className="muted">Add meg a méreteidet. Az avatar minden változtatásra azonnal frissül.</p>{/* magyarázó szöveg */}

        {/* nem: két nagy választógomb */}
        <div className="panel-block">
          <span className="field__label">Nem</span>{/* címke */}
          <div className="segmented" role="radiogroup" aria-label="Nem">{/* két gomb egymás mellett */}
            <button type="button" role="radio" aria-checked={values.gender === 0} className={values.gender === 0 ? 'is-selected' : ''} onClick={() => set('gender', 0)}>Nő</button>{/* nő */}
            <button type="button" role="radio" aria-checked={values.gender === 1} className={values.gender === 1 ? 'is-selected' : ''} onClick={() => set('gender', 1)}>Férfi</button>{/* férfi */}
          </div>
        </div>

        {/* az öt mérés csúszkával és számmezővel */}
        {FIELDS.map((f) => (                    /* mezőnként */
          <div key={f}>{/* egy mérés */}
            <MeasureSlider field={fitConfig.meresek[f]} value={values[f]} onChange={(v) => set(f, v)} hint={HINTS[f]} />{/* csúszka + számmező a közös tartományokkal */}
            {/* a szerver által visszaküldött hiba (ha a frontend ellenőrzésén átjutott volna) */}
            {errors[f] && <p className="field__error">{errors[f]}</p>}
          </div>
        ))}

        {/* adatvédelem: lakat ikon a gomb fölött */}
        <p className="privacy"><Lock size={16} aria-hidden="true" /> A méreteidet csak te látod, a megosztott szetteken sem jelennek meg.</p>
        {/* mentés gomb (mobilon alul ragadós) */}
        <div className="sticky-cta sticky-cta--plain">
          <button type="button" className="btn btn--primary btn--block" onClick={onSave} disabled={saving} aria-busy={saving}>{/* mentés gomb (mentés közben tiltott) */}
            {saving ? <span className="spinner" aria-label="Mentés…" /> : 'Avatar mentése'}{/* töltés közben pörgő jel */}
          </button>
        </div>
        {!user && <p className="muted small">Mentéshez be kell lépned, de előtte nyugodtan kipróbálhatod. A beírt méretek megmaradnak.</p>}{/* belépés nélkül tájékoztatás */}
      </section>

      {/* jobb oldal: élő 3D előnézet */}
      <section className="avatar-page__stage" aria-label="Élő előnézet">
        <Stage3D profile={values} label="Az avatarod élő előnézete" />{/* az avatar a mostani értékekkel */}
      </section>
    </div>
  );                                            // return vége
}                                               // komponens vége
