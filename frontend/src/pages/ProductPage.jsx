// =====================================================================
// ProductPage.jsx – termékoldal és virtuális próbafülke (UI terv 7.5)
// A webshop legfontosabb képernyője: bal oldalt a 3D vászon az avatarral
// a ruhában, jobb oldalt a termékpanel méret- és színválasztóval és a
// méretajánló sávval. Méret- és színváltáskor a ruha azonnal frissül.
// =====================================================================

import { useEffect, useMemo, useState } from 'react'; // React horgok
import { Link, useParams } from 'react-router-dom'; // útvonal paraméter és link
import { ChevronRight } from 'lucide-react';    // morzsamenü elválasztó
import { api } from '../api/client.js';         // API hívás
import { useAuth } from '../context/AuthContext.jsx'; // testprofil
import { useToast } from '../context/ToastContext.jsx'; // értesítések
import Stage3D from '../three/Stage3D.jsx';     // a 3D vászon
import SizeChips from '../components/SizeChips.jsx'; // méretválasztó
import ColorSwatches from '../components/ColorSwatches.jsx'; // színválasztó
import RecommendationBar from '../components/RecommendationBar.jsx'; // méretajánló sáv
import FitLegend from '../components/FitLegend.jsx'; // térkép jelmagyarázat
import { evaluateSize, garmentTypeForCategory, recommendSize, recommendationMessage, fitConfig } from '../fit/fitCalc.js'; // méretajánló logika
import { formatPrice } from '../utils/format.js'; // ár formázás

export default function ProductPage() {         // oldal komponens
  const { id } = useParams();                   // a termék azonosítója az URL-ből (/termek/:id)
  const { profile, isDraftProfile } = useAuth(); // a testprofil (fiókban vagy helyi vázlat)
  const toast = useToast();                     // értesítések
  const [product, setProduct] = useState(null); // a betöltött termék
  const [error, setError] = useState('');       // betöltési hiba
  const [color, setColor] = useState(null);     // kiválasztott szín neve
  const [size, setSize] = useState(null);       // kiválasztott méret
  const [fitMap, setFitMap] = useState(false);  // illeszkedési térkép be/ki

  useEffect(() => {                             // a termék betöltése, amikor változik az azonosító
    let cancelled = false;                      // ha közben elnavigál, ne írjuk felül az állapotot
    setProduct(null); setError(''); setSize(null); // alaphelyzet
    api(`/products/${id}`)                      // kérés
      .then((p) => { if (!cancelled) { setProduct(p); setColor(p.variants[0]?.color_name ?? null); } }) // siker: termék és első szín
      .catch((e) => { if (!cancelled) setError(e.message); }); // hiba
    return () => { cancelled = true; };         // takarítás
  }, [id]);                                     // függőség

  const type = product ? garmentTypeForCategory(product.category) : null; // a ruha 3D típusa
  const colors = useMemo(() => {                // egyedi színek listája a változatokból
    const seen = new Map();                     // név → szín
    for (const v of product?.variants ?? []) if (!seen.has(v.color_name)) seen.set(v.color_name, { name: v.color_name, hex: v.color_hex }); // első előfordulás
    return [...seen.values()];                  // tömbként
  }, [product]);                                // függőség
  const sizes = (product?.size_chart ?? []).map((r) => r.size); // méretek a mérettáblázat sorrendjében
  const soldOut = sizes.filter((s) => {         // elfogyott méretek a kiválasztott színben
    const v = product.variants.find((x) => x.size === s && x.color_name === color); // a változat
    return !v || v.stock <= 0;                  // nincs ilyen változat vagy 0 a készlet
  });                                           // filter vége
  const available = sizes.filter((s) => !soldOut.includes(s)); // elérhető méretek

  const recommendation = profile && product ? recommendSize(profile, product.size_chart, type, available) : null; // ajánlott méret (csak a készleten lévőkből)

  useEffect(() => {                             // kezdő méret: az ajánlott (vagy M), és ha elfogy a választott, váltunk
    if (!product) return;                       // még nincs termék
    if (size && available.includes(size)) return; // a kiválasztott méret még jó
    setSize(recommendation?.size ?? (available.includes('M') ? 'M' : available[0] ?? sizes[0])); // ajánlott, vagy M, vagy az első elérhető
  }, [product, color, recommendation?.size]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="page container"><p className="error-box">{error}</p><Link to="/ruhak" className="btn btn--secondary">Vissza a ruhákhoz</Link></div>; // hiba állapot
  if (!product || !size) return <div className="page container"><div className="skeleton skeleton--stage" /></div>; // betöltés: szürke sziluett helye

  const chartRow = product.size_chart.find((r) => r.size === size); // a kiválasztott méret sora
  const colorHex = colors.find((c) => c.name === color)?.hex ?? '#888888'; // a kiválasztott szín kódja
  const evaluation = profile ? evaluateSize(profile, chartRow, type) : null; // a kiválasztott méret kiértékelése
  const message = recommendationMessage(recommendation, evaluation); // a sáv szövege
  const variant = product.variants.find((v) => v.size === size && v.color_name === color); // a kiválasztott változat
  const price = variant?.price ?? product.price; // ár

  const addToCart = () => toast.show('Prototípus: a kosár a következő verzióban érkezik. A választásod: ' + `${product.name}, ${size}, ${color}`, 'info'); // a kosár még nincs kész

  return ( // az oldal
    <div className="page tryon">{/* két oszlop: vászon és panel */}
      {/* bal oldal: a 3D próbafülke */}
      <section className="tryon__stage" aria-label="Virtuális próbafülke">
        {profile ? ( // van avatar?
          <Stage3D // a próbafülke vászna
            profile={profile} // a testméretek
            garments={[{ type, chartRow, color: colorHex, evaluation }]} // a felpróbált ruha
            fitMap={fitMap} // térkép be/ki
            onToggleFitMap={() => setFitMap((v) => !v)} // kapcsoló
            label={`Avatar a(z) ${product.name} termékben, ${size} méret`} // képernyőolvasó leírás
          >{/* a nyitó címke vége */}
            {/* bekapcsolt térképnél a jelmagyarázat a vászon alján */}
            {fitMap && <FitLegend evaluation={evaluation} />}
          </Stage3D>
        ) : ( // nincs avatar:
          <Stage3D profile={fitConfig.alapAvatar} faded controls={false} interactive={false} label="Szürke alapavatar">{/* halvány alapavatar, nem forgatható */}
            {/* nincs avatar: kártya a vászon közepén (UI terv 7.5) */}
            <div className="stage__card">
              <h2>Előbb hozd létre az avatarodat!</h2>{/* cím */}
              <p>Add meg a méreteidet, és nézd meg, hogyan áll rajtad ez a ruha.</p>{/* magyarázat */}
              <Link to={`/avatar?vissza=/termek/${product.id}`} className="btn btn--primary">Avatar létrehozása</Link>{/* egyetlen korall gomb */}
            </div>
          </Stage3D>
        )}
      </section>

      {/* jobb oldal: termékpanel */}
      <section className="tryon__panel">
        {/* morzsamenü: Ruhák › Kategória › Termék */}
        <nav className="breadcrumb" aria-label="Morzsamenü">
          <Link to="/ruhak">Ruhák</Link><ChevronRight size={14} aria-hidden="true" />{/* első szint */}
          <Link to={`/ruhak?kategoria=${product.category_id}`}>{product.category}</Link><ChevronRight size={14} aria-hidden="true" />{/* második szint: kategória */}
          <span aria-current="page">{product.name}</span>{/* az aktuális oldal */}
        </nav>
        {/* terméknév és ár */}
        <h1 className="tryon__title">{product.name}</h1>
        <p className="price price--lg">{formatPrice(price)}</p>{/* ár */}

        {/* színválasztó: a 3D ruha színe azonnal változik, a modell nem töltődik újra */}
        <div className="panel-block">
          <h2 className="field__label">Szín</h2>{/* címke */}
          <ColorSwatches colors={colors} selected={color} onSelect={setColor} />{/* színkörök */}
        </div>

        {/* méretválasztó az "Ajánlott" jelvénnyel */}
        <div className="panel-block">
          <h2 className="field__label">Méret</h2>{/* címke */}
          <SizeChips sizes={sizes} selected={size} recommended={recommendation?.size} soldOut={soldOut} onSelect={setSize} />{/* méret chipek */}
          {soldOut.length > 0 && <p className="muted small">Az áthúzott méretek ebben a színben elfogytak.</p>}{/* magyarázat az áthúzott méretekhez */}
        </div>

        {/* méretajánló sáv (csak ha van avatar) */}
        {profile && <RecommendationBar message={message} evaluation={evaluation} onBack={() => setSize(message.backTo)} />}
        {isDraftProfile && <p className="muted small">Az avatarod csak ezen a gépen van elmentve. <Link to={`/belepes?vissza=/termek/${product.id}`}>Lépj be</Link>, hogy a fiókodba kerüljön.</p>}{/* vázlat profilnál figyelmeztetés */}

        {/* fő művelet: kosárba (mobilon alul ragadós sávban) */}
        <div className="sticky-cta">
          <span className="sticky-cta__price">{formatPrice(price)}</span>{/* ár (mobilon a gomb mellett) */}
          <button type="button" className={`btn btn--block ${profile ? 'btn--primary' : 'btn--secondary'}`} onClick={addToCart}>Kosárba</button>{/* avatar nélkül az "Avatar létrehozása" az egyetlen korall gomb */}
        </div>

        {/* lenyíló szakaszok */}
        <details className="accordion" open>
          <summary>Leírás, anyag és ápolás</summary>{/* szakasz címe */}
          <p>{product.description}</p>{/* a termék leírása */}
        </details>
        <details className="accordion">{/* második szakasz (alapból zárva) */}
          <summary>Mérettáblázat</summary>{/* szakasz címe */}
          {/* a ruha körméretei cm-ben; a méretajánló ezeket veti össze a testméreteiddel */}
          <table className="size-table">
            <thead>{/* fejléc */}
              <tr><th>Méret</th><th>Mell</th><th>Derék</th><th>Csípő</th></tr>{/* oszlopnevek */}
            </thead>
            <tbody>{/* törzs */}
              {product.size_chart.map((r) => (  /* soronként egy méret */
                <tr key={r.size} className={r.size === size ? 'is-current' : ''}>{/* egy sor, a kiválasztott méret kiemelve */}
                  <td>{r.size}</td><td>{r.chest_cm ?? '–'}</td><td>{r.waist_cm ?? '–'}</td><td>{r.hip_cm ?? '–'}</td>{/* méret és a három körméret */}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">A ruha körméretei centiméterben.</p>{/* megjegyzés */}
        </details>
      </section>
    </div>
  );                                            // return vége
}                                               // komponens vége
