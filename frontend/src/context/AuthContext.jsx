// =====================================================================
// AuthContext.jsx – a belépett felhasználó és a testprofil állapota
// Bárhonnan elérhető a useAuth() horoggal: ki van belépve, mi a
// testprofilja, és itt van a belépés, regisztráció, profilmentés is.
// Belépés nélkül az avatar egy helyi vázlatként él a böngészőben, és
// belépéskor automatikusan a fiókba kerül (UI terv 6: "a beírt méretek megmaradnak").
// =====================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'; // React horgok
import { api, getToken, setToken } from '../api/client.js'; // API hívások és token tárolás

const AuthContext = createContext(null);        // a közös "csatorna"
const DRAFT_KEY = 'fitme3d_avatar_vazlat';      // a helyi avatar-vázlat kulcsa

/**
 * Helyi vázlat kiolvasása (vagy null).
 */
function readDraft() {                          // objektumot vagy null-t ad
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); } catch { return null; } // JSON-ból objektum
}                                               // függvény vége

/**
 * Helyi vázlat mentése vagy törlése.
 */
function writeDraft(value) {                    // objektum vagy null
  try {                                         // a tároló hibát dobhat
    if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); // mentés JSON szövegként
    else localStorage.removeItem(DRAFT_KEY);    // törlés
  } catch { /* privát módban nem tárolható, nem baj */ } // hibakezelés
}                                               // függvény vége

/**
 * Szolgáltató komponens az alkalmazás körül.
 */
export function AuthProvider({ children }) {    // gyerek komponensek
  const [user, setUser] = useState(null);       // a belépett felhasználó (vagy null)
  const [serverProfile, setServerProfile] = useState(null); // a fiókban mentett testprofil
  const [draft, setDraft] = useState(() => readDraft()); // a helyi vázlat (belépés nélkül)
  const [ready, setReady] = useState(false);    // betöltöttük-e már az induló állapotot

  const loadProfile = useCallback(async () => { // a fiók testprofiljának betöltése
    try {                                       // 404 jön, ha még nincs profil
      setServerProfile(await api('/body-profile')); // a profil eltárolása
    } catch {                                   // nincs profil vagy hiba
      setServerProfile(null);                   // nincs profil
    }                                           // try-catch vége
  }, []);                                       // nincs függősége

  useEffect(() => {                             // induláskor: ha van mentett token, betöltjük a felhasználót
    (async () => {                              // azonnal futó aszinkron függvény
      if (getToken()) {                         // van token
        try {                                   // lehet, hogy lejárt
          const me = await api('/auth/me');     // ki vagyok
          setUser(me.user);                     // felhasználó eltárolása
          if (me.has_profile) await loadProfile(); // ha van profilja, azt is betöltjük
        } catch {                               // lejárt vagy érvénytelen token
          setToken(null);                       // töröljük
        }                                       // try-catch vége
      }                                         // if vége
      setReady(true);                           // kész az indulás
    })();                                       // függvény meghívása
  }, [loadProfile]);                            // függőség

  /**
   * Belépés vagy regisztráció utáni közös teendők.
   */
  const afterAuth = useCallback(async (result) => { // a szerver válasza
    setToken(result.token);                     // token mentése
    setUser(result.user);                       // felhasználó
    const localDraft = readDraft();             // van-e helyi vázlat
    if (localDraft && !result.has_profile) {    // ha van vázlat, de a fióknak nincs profilja
      try {                                     // mentés a fiókba
        setServerProfile(await api('/body-profile', { method: 'PUT', body: localDraft })); // a vázlat a fiókba kerül
        writeDraft(null);                       // a helyi vázlat már nem kell
        setDraft(null);                         // állapot frissítése
      } catch { /* ha nem sikerül, a vázlat megmarad */ } // hibakezelés
    } else if (result.has_profile) {            // ha a fióknak már van profilja
      await loadProfile();                      // betöltjük
    }                                           // if-else vége
  }, [loadProfile]);                            // függőség

  const login = useCallback(async (email, password) => { // belépés
    await afterAuth(await api('/auth/login', { method: 'POST', body: { email, password } })); // kérés, majd közös teendők
  }, [afterAuth]);                              // függőség

  const register = useCallback(async (email, password, passwordConfirm) => { // regisztráció
    await afterAuth(await api('/auth/register', { method: 'POST', body: { email, password, password_confirm: passwordConfirm } })); // kérés, majd közös teendők
  }, [afterAuth]);                              // függőség

  const logout = useCallback(() => {            // kijelentkezés
    setToken(null);                             // token törlése
    setUser(null);                              // nincs felhasználó
    setServerProfile(null);                     // a fiók profilja sem látszik többé
  }, []);                                       // nincs függősége

  /**
   * Testprofil mentése: belépve a fiókba, különben helyi vázlatként.
   * Visszaadja: { savedToAccount: true/false }.
   */
  const saveProfile = useCallback(async (values) => { // a méretek
    if (user) {                                 // ha be van lépve
      setServerProfile(await api('/body-profile', { method: 'PUT', body: values })); // mentés a fiókba (hibánál kivételt dob)
      writeDraft(null);                         // a vázlat törlése
      setDraft(null);                           // állapot frissítése
      return { savedToAccount: true };          // eredmény
    }                                           // if vége
    writeDraft(values);                         // belépés nélkül: helyi vázlat
    setDraft(values);                           // állapot frissítése
    return { savedToAccount: false };           // eredmény
  }, [user]);                                   // függőség

  const value = useMemo(() => ({                // a megosztott érték
    user,                                       // felhasználó
    ready,                                      // betöltött-e
    profile: serverProfile ?? draft ?? null,    // a használt testprofil: a fiókban mentett, vagy a helyi vázlat
    isDraftProfile: !serverProfile && !!draft,  // igaz, ha csak helyi vázlat van
    login, register, logout, saveProfile,       // műveletek
  }), [user, ready, serverProfile, draft, login, register, logout, saveProfile]); // függőségek

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>; // a gyerekek elérik az értéket
}                                               // komponens vége

/**
 * Horog: const { user, profile, login } = useAuth();
 */
export function useAuth() {                     // horog
  return useContext(AuthContext);               // a közös érték
}                                               // horog vége
