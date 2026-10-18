// =====================================================================
// HomePage.jsx – kezdőlap (UI terv 7.1)
// Cél: fél perc alatt megértse a látogató, hogy itt a saját alakján
// próbálhat ruhát. Jobb oldalt lassan forgó avatar egy kész szettben.
// =====================================================================

import { useEffect, useState } from 'react';    // React horgok
import { Link } from 'react-router-dom';        // linkek
import { Ruler, Shirt, PackageCheck } from 'lucide-react'; // ikonok a "Hogyan működik" részhez
import Stage3D from '../three/Stage3D.jsx';     // 3D vászon
import ProductCard from '../components/ProductCard.jsx'; // termékkártya
import ProductIllustration from '../components/ProductIllustration.jsx'; // kategória csempe rajza
import { api } from '../api/client.js';         // API
import { useAuth } from '../context/AuthContext.jsx'; // felhasználó és profil
import { fitConfig, garmentTypeForCategory } from '../fit/fitCalc.js'; // alapavatar és kategória-típus
import { BASE_OUTFIT } from '../fit/baseOutfit.js'; // a kezdőlapi szett

const TILE_COLORS = { polo: '#1E3A5F', pulover: '#D6C3A5', nadrag: '#4A6A9A', ov: '#6B4226' }; // a kategória csempék színei

export default function HomePage() {            // oldal komponens
  const { user, profile, isDraftProfile } = useAuth(); // felhasználó és profil
  const [products, setProducts] = useState([]); // népszerű termékek
  const [categories, setCategories] = useState([]); // kategóriák

  useEffect(() => {                             // adatok betöltése
    api('/products').then((list) => setProducts(list.slice(0, 8))).catch(() => {}); // legfeljebb 8 termék
    api('/categories').then(setCategories).catch(() => {}); // kategóriák
  }, []);                                       // csak egyszer

  const returning = user && profile && !isDraftProfile; // visszatérő, avatarral rendelkező vásárló

  return ( // a kezdőlap
    <div className="page home">{/* oldal tároló */}
      {/* hero: bal oldalt szöveg és gombok, jobb oldalt a forgó avatar */}
      <section className="hero container">
        <div className="hero__text">{/* szöveges oszlop */}
          <h1>{returning ? 'Üdv újra!' : 'Próbáld fel, mielőtt megveszed.'}</h1>{/* főcím */}
          <p className="hero__lead">{returning ? 'Az avatarod kész. Válassz egy ruhát, és nézd meg magadon.' : 'Add meg a méreteidet, és nézd meg minden szögből, hogyan áll rajtad.'}</p>{/* bevezető mondat */}
          <div className="hero__actions">{/* gombok */}
            {/* egy elsődleges (korall) gomb a képernyőn */}
            <Link to={returning ? '/ruhak' : '/avatar'} className="btn btn--primary">{returning ? 'Ruhák böngészése' : 'Avatarom elkészítése'}</Link>
            <Link to={returning ? '/avatar' : '/ruhak'} className="btn btn--secondary">{returning ? 'Avatarom szerkesztése' : 'Ruhák böngészése'}</Link>{/* másodlagos gomb */}
          </div>
        </div>
        <div className="hero__stage">{/* a 3D vászon helye */}
          {/* a semleges alapavatar (vagy a saját avatar) lassan forog egy kész szettben */}
          <Stage3D profile={returning ? profile : fitConfig.alapAvatar} garments={BASE_OUTFIT} controls={false} autoRotate interactive={false} label="Forgó avatar pólóban és farmerben" />
        </div>
      </section>

      {/* hogyan működik: három lépés */}
      <section className="container section">
        <h2>Hogyan működik?</h2>{/* szekciócím */}
        <ol className="steps">{/* számozott lista */}
          <li><span className="steps__icon"><Ruler size={24} aria-hidden="true" /></span><h3>Add meg a méreteidet</h3><p className="muted">Magasság, súly, mell-, derék- és csípőbőség.</p></li>{/* 1. lépés */}
          <li><span className="steps__icon"><Shirt size={24} aria-hidden="true" /></span><h3>Próbáld fel a ruhákat</h3><p className="muted">Forgasd körbe az avatart, nézd meg, hol szorít vagy bő.</p></li>{/* 2. lépés */}
          <li><span className="steps__icon"><PackageCheck size={24} aria-hidden="true" /></span><h3>Rendeld meg a jó méretet</h3><p className="muted">A méretajánló megmondja, melyik illik hozzád.</p></li>{/* 3. lépés */}
        </ol>
      </section>

      {/* kategória csempék */}
      <section className="container section">
        <h2>Kategóriák</h2>{/* szekciócím */}
        <div className="tiles">{/* csempék rácsa */}
          {categories.map((c) => {              /* kategóriánként egy csempe */
            const t = garmentTypeForCategory(c.name); /* a kategória ruhatípusa a rajzhoz */
            return ( // egy csempe
              <Link key={c.id} to={`/ruhak?kategoria=${c.id}`} className="tile">{/* link a szűrt listára */}
                <h3>{c.name}</h3>{/* kategória neve */}
                <ProductIllustration type={t} color={TILE_COLORS[t] ?? '#999'} />{/* jellemző termék rajza */}
              </Link>
            );
          })}
        </div>
      </section>

      {/* népszerű termékek */}
      <section className="container section">
        <h2>Népszerű termékek</h2>{/* szekciócím */}
        <div className="grid">{/* termékrács */}
          {products.map((p) => <ProductCard key={p.id} product={p} profile={profile} />)}{/* termékkártyák */}
        </div>
      </section>
    </div>
  );                                            // return vége
}                                               // komponens vége
