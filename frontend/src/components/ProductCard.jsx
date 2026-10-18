// =====================================================================
// ProductCard.jsx – termékkártya a böngészéshez (Design terv 4.4)
// Egyetlen kiemelt (korall) elem van rajta: a "Felpróbálom" gomb.
// Ha van avatar, a kép sarkában "Neked: M" jelvény mutatja az ajánlott méretet.
// =====================================================================

import { Link } from 'react-router-dom';        // link a termékoldalra
import { UserRound } from 'lucide-react';       // kis avatar ikon a jelvényben
import ProductIllustration from './ProductIllustration.jsx'; // termékrajz
import ColorSwatches from './ColorSwatches.jsx'; // színkörök
import { garmentTypeForCategory, recommendSize } from '../fit/fitCalc.js'; // méretajánló
import { formatPrice } from '../utils/format.js'; // ár formázása

export default function ProductCard({ product, profile }) { // termék és testprofil (ha van)
  const type = garmentTypeForCategory(product.category); // a ruha 3D típusa
  const rec = profile ? recommendSize(profile, product.size_chart, type) : null; // ajánlott méret (ha van avatar)
  return ( // a kártya
    <article className="product-card">{/* kártya keret */}
      {/* kép: a termékrajz az első színben, kattintásra a termékoldal */}
      <Link to={`/termek/${product.id}`} className="product-card__media" tabIndex={-1} aria-hidden="true">
        <ProductIllustration type={type} color={product.colors[0]?.hex ?? '#ccc'} />{/* a termék rajza az első színben */}
        {/* "Neked: M" jelvény */}
        {rec && <span className="for-you"><UserRound size={12} aria-hidden="true" /> Neked: {rec.size}</span>}
      </Link>
      <div className="product-card__body">{/* a kártya szöveges része */}
        {/* terméknév */}
        <h3 className="product-card__name"><Link to={`/termek/${product.id}`}>{product.name}</Link></h3>
        {/* színkörök és ár egy sorban */}
        <div className="product-card__meta">
          <ColorSwatches colors={product.colors} size="sm" />{/* elérhető színek kis körökkel */}
          <span className="price">{formatPrice(product.price)}</span>{/* ár */}
        </div>
        {/* a fő gomb: felpróbálás */}
        <Link to={`/termek/${product.id}`} className="btn btn--primary btn--block">Felpróbálom</Link>
      </div>
    </article>
  );                                            // return vége
}                                               // komponens vége
