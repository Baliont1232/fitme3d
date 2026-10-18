// =====================================================================
// client.js – kommunikáció a PHP REST API-val
// Minden kérés a /api/... címre megy, JSON-t küld és fogad. Ha a
// felhasználó be van lépve, a token az Authorization fejlécbe kerül.
// =====================================================================

const TOKEN_KEY = 'fitme3d_token';              // ezen a kulcson tároljuk a tokent a böngészőben

/**
 * Saját hibatípus: tartalmazza a HTTP státuszt és a mezőnkénti hibákat is.
 */
export class ApiError extends Error {           // a beépített Error kiterjesztése
  constructor(message, status, fields = {}) {   // üzenet, státusz, mezőhibák
    super(message);                             // az Error konstruktora kapja az üzenetet
    this.status = status;                       // HTTP státuszkód (pl. 401, 422)
    this.fields = fields;                       // pl. { email: 'Érvénytelen e-mail cím' }
  }                                             // konstruktor vége
}                                               // osztály vége

/**
 * A mentett token kiolvasása (vagy null).
 */
export function getToken() {                    // szöveget vagy null-t ad
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } // privát módban a tároló hibát dobhat
}                                               // függvény vége

/**
 * Token mentése vagy törlése (null esetén).
 */
export function setToken(token) {               // tokent kap
  try {                                         // a tároló hibát dobhat
    if (token) localStorage.setItem(TOKEN_KEY, token); // mentés
    else localStorage.removeItem(TOKEN_KEY);    // törlés (kijelentkezés)
  } catch { /* nem baj, akkor csak erre a munkamenetre marad bent */ } // hibakezelés
}                                               // függvény vége

/**
 * Általános kérés függvény. Példa: api('/products/3'), api('/auth/login', { method: 'POST', body: {...} })
 */
export async function api(path, { method = 'GET', body } = {}) { // útvonal és opciók
  const headers = { Accept: 'application/json' }; // JSON választ várunk
  if (body !== undefined) headers['Content-Type'] = 'application/json'; // ha küldünk adatot, az is JSON
  const token = getToken();                     // a belépési token
  if (token) headers.Authorization = `Bearer ${token}`; // ha van, elküldjük

  let response;                                 // a szerver válasza
  try {                                         // a hálózati hiba kivételt dob
    response = await fetch(`/api${path}`, {     // kérés küldése
      method,                                   // GET, POST, PUT...
      headers,                                  // fejlécek
      body: body !== undefined ? JSON.stringify(body) : undefined, // az adat JSON szövegként
    });                                         // fetch vége
  } catch {                                     // nincs kapcsolat
    throw new ApiError('Nem sikerült betölteni, ellenőrizd a kapcsolatot.', 0); // UI terv 8. fejezet szövege
  }                                             // try-catch vége

  const text = await response.text();           // a válasz szövege
  let data = null;                              // a feldolgozott válasz
  try { data = text ? JSON.parse(text) : null; } catch { data = null; } // JSON-ná alakítás (ha nem JSON, null)

  if (!response.ok) {                           // ha hibakód jött (4xx, 5xx)
    throw new ApiError(data?.error ?? 'Váratlan hiba történt.', response.status, data?.fields ?? {}); // saját hiba a részletekkel
  }                                             // if vége
  return data;                                  // sikeres válasz adatai
}                                               // függvény vége
