// =====================================================================
// Header.jsx – fejléc desktopon és alsó fülsáv mobilon (UI terv 5. fejezet)
// A prototípusban a Szettépítő, Kosár és Profil még nem él, ezért a
// menüben csak a működő oldalak szerepelnek.
// =====================================================================

import { Link, NavLink, useLocation } from 'react-router-dom'; // linkek a router-ből
import { Shirt, UserRound, LogIn, LogOut } from 'lucide-react'; // ikonok
import Logo from './Logo.jsx';                  // logó
import { useAuth } from '../context/AuthContext.jsx'; // belépési állapot

export default function Header() {              // fejléc komponens
  const { user, logout } = useAuth();           // a felhasználó és a kijelentkezés
  const location = useLocation();               // az aktuális oldal címe (a visszairányításhoz)
  const loginTarget = `/belepes?vissza=${encodeURIComponent(location.pathname)}`; // belépés után ide jön vissza

  return ( // fejléc és fülsáv
    <>
      {/* felső fejléc (desktopon menüvel, mobilon csak logóval) */}
      <header className="header">
        <div className="header__inner">{/* középre igazított belső sor */}
          {/* logó: kattintásra kezdőlap */}
          <Link to="/" className="header__logo" aria-label="FitMe3D kezdőlap"><Logo /></Link>
          {/* prototípus jelölés, hogy a csapattársak tudják, mi működik */}
          <span className="proto-badge">Prototípus</span>
          {/* középső menü (mobilon rejtett) */}
          <nav className="header__nav" aria-label="Főmenü">
            <NavLink to="/ruhak">Ruhák</NavLink>{/* menüpont: ruhák */}
            <NavLink to="/avatar">Avatarom</NavLink>{/* menüpont: avatar készítő */}
          </nav>
          {/* jobb oldal: belépés vagy a felhasználó neve + kijelentkezés */}
          <div className="header__right">
            {user ? ( // ha be van lépve:
              <>
                <span className="header__user"><UserRound size={18} aria-hidden="true" /> {user.username}</span>{/* a felhasználó neve ikonnal */}
                <button type="button" className="btn btn--text" onClick={logout}><LogOut size={18} aria-hidden="true" /> Kijelentkezés</button>{/* kijelentkezés gomb */}
              </>
            ) : ( // ha nincs belépve:
              <Link to={loginTarget} className="btn btn--secondary btn--sm">Belépés</Link> // belépés gomb (visszairányítással)
            )}
          </div>
        </div>
      </header>

      {/* alsó fülsáv mobilon: Ruhák, Avatarom (középen, korall kör), Profil/Belépés */}
      <nav className="tabbar" aria-label="Mobil menü">
        <NavLink to="/ruhak" className="tabbar__item"><Shirt size={22} aria-hidden="true" /><span>Ruhák</span></NavLink>{/* fül: ruhák */}
        <NavLink to="/avatar" className="tabbar__item tabbar__item--main"><span className="tabbar__circle"><UserRound size={24} aria-hidden="true" /></span><span>Avatarom</span></NavLink>{/* középső, kiemelt fül: avatar */}
        {user ? ( // belépve kijelentkezés, különben belépés
          <button type="button" className="tabbar__item" onClick={logout}><LogOut size={22} aria-hidden="true" /><span>Kilépés</span></button> // kilépés fül
        ) : ( // nincs belépve:
          <NavLink to={loginTarget} className="tabbar__item"><LogIn size={22} aria-hidden="true" /><span>Belépés</span></NavLink> // belépés fül
        )}
      </nav>
    </>
  );                                            // return vége
}                                               // komponens vége
