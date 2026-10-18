// =====================================================================
// ProductsPage.jsx – ruhák böngészése (UI terv 7.4)
// Kategória fülek, kereső, termékrács. Avatarral minden kártyán
// "Neked: M" jelvény. A szűrők az URL-ben vannak (?kategoria=1&q=farmer),
// így a link megosztható és a vissza gomb is jól működik.
// =====================================================================

import { useEffect, useState } from 'react';    // React horgok
import { useSearchParams } from 'react-router-dom'; // URL paraméterek
import { Search, SearchX } from 'lucide-react'; // ikonok
import { api } from '../api/client.js';         // API
import { useAuth } from '../context/AuthContext.jsx'; // testprofil a jelvényekhez
import ProductCard from '../components/ProductCard.jsx'; // termékkártya

export default function ProductsPage() {        // oldal komponens
  const { profile } = useAuth();                // testprofil (ha van)
  const [params, setParams] = useSearchParams(); // URL paraméterek olvasása és írása
  const category = params.get('kategoria') ?? ''; // kiválasztott kategória azonosító ('' = összes)
  const q = params.get('q') ?? '';              // keresőszó
  const [search, setSearch] = useState(q);      // a keresőmező szövege
  const [categories, setCategories] = useState([]); // kategóriák
  const [products, setProducts] = useState(null); // termékek (null = töltés)
  const [error, setError] = useState('');       // hiba

  useEffect(() => { api('/categories').then(setCategories).catch(() => {}); }, []); // kategóriák betöltése egyszer
  useEffect(() => { setSearch(q); }, [q]);      // ha az URL változik, a mező is kövesse

  useEffect(() => {                             // termékek betöltése a szűrők alapján
    setProducts(null);                          // töltés jelzése
    setError('');                               // hiba törlése
    const query = new URLSearchParams();        // lekérdezés összeállítása
    if (category) query.set('category', category); // kategória szűrő
    if (q) query.set('q', q);                   // keresőszó
    api(`/products?${query}`).then(setProducts).catch((e) => setError(e.message)); // kérés
  }, [category, q]);                            // függőségek

  const update = (next) => {                    // URL paraméterek módosítása
    const p = new URLSearchParams(params);      // a jelenlegi paraméterek másolata
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); } // üres értéket törlünk
    setParams(p);                               // új URL
  };                                            // függvény vége

  return ( // az oldal
    <div className="page container">{/* tároló */}
      <h1>Ruhák</h1>{/* oldalcím */}
      {/* felső sáv: kategória fülek és kereső */}
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Kategóriák">{/* fülek sora */}
          <button type="button" role="tab" aria-selected={!category} className={!category ? 'is-active' : ''} onClick={() => update({ kategoria: '' })}>Összes</button>{/* "Összes" fül */}
          {categories.map((c) => (              /* kategóriánként egy fül */
            <button key={c.id} type="button" role="tab" aria-selected={category === String(c.id)} className={category === String(c.id) ? 'is-active' : ''} onClick={() => update({ kategoria: String(c.id) })}>{c.name}</button> // kategória fül
          ))}
        </div>
        {/* kereső: Enterre vagy a gombra keres */}
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }}>
          <Search size={18} aria-hidden="true" className="search__icon" />{/* nagyító ikon */}
          <input className="input" type="search" placeholder="Keresés a ruhák között" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Keresés" />{/* keresőmező */}
        </form>
      </div>

      {/* találatszám */}
      {products && <p className="muted">{products.length} termék</p>}
      {/* hiba */}
      {error && <p className="error-box">{error}</p>}

      {/* termékrács: töltés közben skeleton kártyák */}
      <div className="grid">
        {products === null && !error && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton--card" />)}{/* töltés közben 6 skeleton kártya */}
        {products?.map((p) => <ProductCard key={p.id} product={p} profile={profile} />)}{/* a termékkártyák */}
      </div>

      {/* nincs találat állapot (UI terv 8.) */}
      {products?.length === 0 && (
        <div className="empty">{/* üres állapot */}
          <span className="empty__icon"><SearchX size={28} aria-hidden="true" /></span>{/* ikon körben */}
          <p>Nincs találat{q ? ` erre: »${q}«` : ''}</p>{/* üzenet a keresőszóval */}
          <button type="button" className="btn btn--secondary" onClick={() => setParams(new URLSearchParams())}>Szűrők törlése</button>{/* szűrők törlése */}
        </div>
      )}
    </div>
  );                                            // return vége
}                                               // komponens vége
