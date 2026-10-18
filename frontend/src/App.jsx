// =====================================================================
// App.jsx – az alkalmazás váza: fejléc, útvonalak, lábléc
// Az útvonalak a UI terv 5.3 táblázatát követik (magyar URL-ek).
// =====================================================================

import { Route, Routes, Link } from 'react-router-dom'; // útválasztás
import Header from './components/Header.jsx';   // fejléc és mobil fülsáv
import HomePage from './pages/HomePage.jsx';    // kezdőlap
import ProductsPage from './pages/ProductsPage.jsx'; // ruhák böngészése
import ProductPage from './pages/ProductPage.jsx'; // termékoldal + próbafülke
import AvatarPage from './pages/AvatarPage.jsx'; // avatar készítő
import LoginPage from './pages/LoginPage.jsx';  // belépés / regisztráció
import { useAuth } from './context/AuthContext.jsx'; // betöltési állapot

/**
 * 404-es oldal: ha nincs ilyen útvonal.
 */
function NotFound() {                           // komponens
  return ( // a 404-es oldal tartalma
    <div className="page container empty">{/* üres állapot elrendezés */}
      <h1>Ez az oldal nem létezik</h1>{/* cím */}
      <Link to="/" className="btn btn--secondary">Vissza a kezdőlapra</Link>{/* vissza gomb */}
    </div>
  );                                            // return vége
}                                               // komponens vége

export default function App() {                 // az alkalmazás gyökere
  const { ready } = useAuth();                  // betöltöttük-e már a belépési állapotot
  return ( // az alkalmazás váza
    <>
      <Header />{/* fejléc minden oldalon */}
      <main id="tartalom">{/* a fő tartalom helye */}
        {/* amíg a belépést ellenőrizzük, nem rajzolunk oldalt (különben villanna a "Belépés" gomb) */}
        {ready && (
          <Routes>{/* útvonalak: URL → oldal */}
            <Route path="/" element={<HomePage />} />{/* kezdőlap */}
            <Route path="/ruhak" element={<ProductsPage />} />{/* ruhák böngészése */}
            <Route path="/termek/:id" element={<ProductPage />} />{/* termékoldal és próbafülke */}
            <Route path="/avatar" element={<AvatarPage />} />{/* avatar készítő */}
            <Route path="/belepes" element={<LoginPage />} />{/* belépés */}
            <Route path="/regisztracio" element={<LoginPage />} />{/* regisztráció (ugyanaz az oldal, másik füllel) */}
            <Route path="*" element={<NotFound />} />{/* minden más: 404 */}
          </Routes>
        )}
      </main>
      {/* lábléc */}
      <footer className="footer">FitMe3D – vizsgaremek prototípus · Balló Márk, Bari Dániel, Burcsa Bálint</footer>
    </>
  );                                            // return vége
}                                               // komponens vége
