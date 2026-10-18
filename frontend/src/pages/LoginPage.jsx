// =====================================================================
// LoginPage.jsx – belépés és regisztráció két füllel (UI terv 7.2)
// Siker után visszairányít oda, ahonnan a felhasználó jött (?vissza=...).
// =====================================================================

import { useState } from 'react';               // állapot horog
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'; // navigáció
import { Eye, EyeOff } from 'lucide-react';     // jelszó megjelenítés ikonok
import { useAuth } from '../context/AuthContext.jsx'; // belépés, regisztráció
import { useToast } from '../context/ToastContext.jsx'; // értesítések
import { LogoMark } from '../components/Logo.jsx'; // logó jel

/**
 * Egyszerű jelszóerősség: 0 = gyenge, 1 = közepes, 2 = erős.
 */
function passwordStrength(pw) {                 // jelszó
  let score = 0;                                // pontszám
  if (pw.length >= 8) score++;                  // legalább 8 karakter
  if (/[A-ZÁÉÍÓÖŐÚÜŰ]/.test(pw) && /[a-záéíóöőúüű]/.test(pw)) score++; // kis- és nagybetű is
  if (/\d/.test(pw) && pw.length >= 10) score++; // szám és hosszabb
  return Math.min(2, Math.max(0, score - 1));   // 0..2 közé
}                                               // függvény vége

const STRENGTH = ['gyenge', 'közepes', 'erős']; // az erősség szövegei

export default function LoginPage() {           // oldal komponens
  const location = useLocation();               // aktuális útvonal (/belepes vagy /regisztracio)
  const [params] = useSearchParams();           // URL paraméterek
  const back = params.get('vissza') || '/';     // ide megyünk vissza siker után
  const [mode, setMode] = useState(location.pathname === '/regisztracio' ? 'register' : 'login'); // melyik fül aktív
  const [email, setEmail] = useState('');       // e-mail
  const [password, setPassword] = useState(''); // jelszó
  const [confirm, setConfirm] = useState('');   // jelszó megerősítése
  const [showPw, setShowPw] = useState(false);  // látszik-e a jelszó
  const [errors, setErrors] = useState({});     // mezőnkénti hibák
  const [busy, setBusy] = useState(false);      // folyamatban
  const { login, register } = useAuth();        // műveletek
  const toast = useToast();                     // értesítések
  const navigate = useNavigate();               // navigáció

  const submit = async (e) => {                 // űrlap elküldése
    e.preventDefault();                         // ne töltse újra az oldalt
    setErrors({});                              // régi hibák törlése
    if (mode === 'register' && password !== confirm) { setErrors({ password_confirm: 'A két jelszó nem egyezik' }); return; } // gyors ellenőrzés a böngészőben
    setBusy(true);                              // töltés jelzése (a gomb tiltva, nem küldhető el kétszer)
    try {                                       // a kérés hibát dobhat
      if (mode === 'login') await login(email, password); // belépés
      else await register(email, password, confirm); // regisztráció
      toast.show(mode === 'login' ? 'Sikeres belépés' : 'Sikeres regisztráció'); // siker
      navigate(back);                           // vissza oda, ahonnan jött
    } catch (err) {                             // hiba
      setErrors(Object.keys(err.fields ?? {}).length ? err.fields : { general: err.message }); // mezőhibák vagy általános hiba
    } finally {                                 // mindenképp
      setBusy(false);                           // töltés vége
    }                                           // try-catch-finally vége
  };                                            // függvény vége

  const strength = passwordStrength(password);  // a jelszó erőssége

  return ( // az oldal
    <div className="page auth">{/* szürke háttér */}
      <div className="auth__card">{/* fehér kártya */}
        {/* logó */}
        <div className="auth__logo"><LogoMark size={40} /></div>
        {/* fülek */}
        <div className="tabs tabs--full" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setErrors({}); }}>Bejelentkezés</button>{/* bejelentkezés fül */}
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setErrors({}); }}>Regisztráció</button>{/* regisztráció fül */}
        </div>

        <form onSubmit={submit} noValidate>{/* az űrlap (a böngésző saját ellenőrzése kikapcsolva) */}
          {/* e-mail mező, a hiba alatta */}
          <label className="field">
            <span className="field__label">E-mail cím</span>{/* címke */}
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} required />{/* e-mail mező */}
            {errors.email && <span className="field__error"><span className="field__error-icon" aria-hidden="true">!</span>{errors.email}</span>}{/* hibaüzenet ikonnal */}
          </label>
          {/* jelszó mező szem ikonnal */}
          <label className="field">
            <span className="field__label">Jelszó</span>{/* címke */}
            <span className="input-wrap">{/* mező + szem ikon tároló */}
              <input className="input" type={showPw ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} required />{/* jelszó mező */}
              <button type="button" className="input-wrap__btn" aria-label={showPw ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'} onClick={() => setShowPw((v) => !v)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>{/* szem ikon: jelszó mutatása/elrejtése */}
            </span>
            {errors.password && <span className="field__error"><span className="field__error-icon" aria-hidden="true">!</span>{errors.password}</span>}{/* hibaüzenet */}
          </label>
          {mode === 'register' && ( // csak regisztrációnál:
            <>
              {/* jelszóerősség sáv */}
              {password && <div className={`strength strength--${strength}`}><span /><span /><span /><em>{STRENGTH[strength]}</em></div>}
              {/* jelszó megerősítése */}
              <label className="field">
                <span className="field__label">Jelszó megerősítése</span>{/* címke */}
                <input className="input" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.password_confirm} required />{/* megerősítő mező */}
                {errors.password_confirm && <span className="field__error"><span className="field__error-icon" aria-hidden="true">!</span>{errors.password_confirm}</span>}{/* hibaüzenet */}
              </label>
            </>
          )}
          {/* általános hiba */}
          {errors.general && <p className="error-box">{errors.general}</p>}
          {/* küldés gomb: töltés közben pörgő jel és tiltott */}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
            {busy ? <span className="spinner" aria-label="Folyamatban…" /> : (mode === 'login' ? 'Bejelentkezés' : 'Regisztráció')}{/* töltés közben pörgő jel, különben a felirat */}
          </button>
        </form>

        {/* prototípus: demó fiók a csapattársaknak */}
        <p className="demo-hint">Demó fiók: <strong>demo@fitme3d.hu</strong> / <strong>Demo1234</strong></p>
        <p className="muted small center"><Link to="/">Vissza a kezdőlapra</Link></p>{/* vissza link */}
      </div>
    </div>
  );                                            // return vége
}                                               // komponens vége
