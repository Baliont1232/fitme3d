// =====================================================================
// garments.js – a ruhák a valódi avatar felületéből
// Elv: a ruha = a test egy része (pl. póló: törzs + felkar fele), a test
// felületétől kifelé tolva. Hogy mennyivel, azt a mérettáblázat adja:
// ha a póló M méretének mellbősége 106 cm és a testé 100 cm, a ruha a
// mell magasságában pontosan 106 cm kerületű lesz (6 cm ráhagyás).
// Kisebb ruha a testre simul, a térkép pirossal jelzi, hogy szorít.
// Melyik pont melyik testrészé, azt a MakeHuman csontváz súlyaiból tudjuk.
// A pontok kiválasztása a mérettől független, ezért méretváltáskor a
// régi és az új forma között animálni lehet (UI terv 11. fejezet).
// =====================================================================

import { bandIndices, hullPerimeter } from './humanModel.js'; // sávok és kerület mérése

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // érték korlátozása
const lerp = (a, b, t) => a + (b - a) * t;     // lineáris átmenet
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }; // lágy S-görbe 0 és 1 között
const cm = (v) => (v == null ? null : v / 100); // cm → méter
const TWO_PI = Math.PI * 2;                     // 2π (kerület ↔ sugár)

const MIN_GAP = 0.004;                          // a ruha legalább 4 mm-re legyen a testtől (különben átlátszik a bőr)
const LAYER_GAP = 0.006;                        // egy felső réteg legalább 6 mm-re az alatta lévő ruhától
export const LAYER_ORDER = { nadrag: 0, polo: 1, pulover: 1, ov: 2 }; // rétegsorrend: nadrág legbelül, öv kívül

/**
 * A test pontjainak normálvektorai (merre "néz" a felület). Egyszer számoljuk ki avatarenként.
 */
function normalsOf(human) {                     // az avatar
  if (human._normals) return human._normals;    // ha már kiszámoltuk, azt adjuk vissza
  const { positions: P, index: I, nBody } = human; // pontok, háromszögek, darabszám
  const N = new Float32Array(nBody * 3);        // a normálvektorok
  for (let t = 0; t < I.length; t += 3) {       // minden háromszögre
    const a = I[t] * 3; const b = I[t + 1] * 3; const c = I[t + 2] * 3; // a három csúcs helye
    const ux = P[b] - P[a]; const uy = P[b + 1] - P[a + 1]; const uz = P[b + 2] - P[a + 2]; // első él
    const vx = P[c] - P[a]; const vy = P[c + 1] - P[a + 1]; const vz = P[c + 2] - P[a + 2]; // második él
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx; // vektoriális szorzat (a terület is benne van)
    for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; } // hozzáadás mindhárom csúcshoz
  }                                             // for vége
  for (let i = 0; i < nBody; i++) {             // egységnyi hosszúra
    const k = i * 3; const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1; // hossz
    N[k] /= l; N[k + 1] /= l; N[k + 2] /= l;    // osztás
  }                                             // for vége
  human._normals = N;                           // eltároljuk
  return N;                                     // kész
}                                               // függvény vége

/**
 * A test kerülete magasság szerint (fél centiméterenként), egy pontcsoportra.
 * Visszaad egy függvényt: y → kerület (méter).
 */
function circumferenceProfile(human, set, yLo, yHi, sideSign = 0) { // avatar, testrészek, tartomány, oldal (0 = mindkettő)
  const { positions: P, labels, nBody } = human; // adatok
  const step = 0.005;                           // fél centiméteres lépés
  const values = [];                            // a mért kerületek
  for (let y = yLo; y <= yHi + 1e-9; y += step) { // alulról felfelé
    let ids = bandIndices(P, labels, nBody, y, 0.007, set); // a sáv pontjai
    if (sideSign) ids = ids.filter((i) => Math.sign(P[i * 3]) === sideSign); // csak az egyik láb
    const xs = ids.map((i) => P[i * 3]); const zs = ids.map((i) => P[i * 3 + 2]); // vízszintes koordináták
    values.push(hullPerimeter(xs, zs));         // a burok kerülete
  }                                             // for vége
  return (y) => {                               // a lekérdező függvény
    const f = clamp((y - yLo) / step, 0, values.length - 1); // hányadik minta
    const i = Math.floor(f); const t = f - i;   // egész és tört rész
    return lerp(values[i], values[Math.min(i + 1, values.length - 1)], t); // lineáris átmenet két minta között
  };                                            // függvény vége
}                                               // függvény vége

/**
 * Felsők (póló, pulóver) célkerülete a törzsön (ugyanaz a logika, mint a mérettáblázatban):
 * lent a derék/csípő méret, középen derék → mell átmenet, fent a váll rásimul.
 */
function topTarget(L, chart, bodyC) {           // kulcsmagasságok, ruhaméretek (méter), test kerület-függvény
  return (y) => {                               // magasság → ruha kerülete
    const C = bodyC(y);                         // a test kerülete itt
    const gChest = chart.chest ?? C + 0.08;     // a ruha mellbősége
    const gWaist = chart.waist ?? gChest;       // derékbősége
    const gHip = chart.hip ?? gWaist;           // csípőbősége
    if (y <= L.hip) return Math.max(gHip, C + 0.02); // csípő alatt: a csípőméret
    if (y <= L.waist) return lerp(gHip, gWaist, smooth((y - L.hip) / (L.waist - L.hip))); // csípő → derék
    if (y <= L.chest) return lerp(gWaist, gChest, smooth((y - L.waist) / (L.chest - L.waist))); // derék → mell
    const top = L.shoulder - 0.01;              // a váll vonala
    if (y <= top) return lerp(Math.max(gChest, C + 0.02), C + 0.02, smooth((y - L.chest) / (top - L.chest))); // mell → váll: fokozatosan rásimul
    return C + 0.02;                            // a vállon és a nyakkivágásnál a testre simul
  };                                            // függvény vége
}                                               // függvény vége

/**
 * Egy pont helyzete a karon: 0 a vállízületnél, 1 a könyöknél, 2 a csuklónál.
 */
function armParam(P, i, J, side) {              // pontok, index, ízületek, oldal ('l'/'r')
  const s = J[`${side}-shoulder`]; const e = J[`${side}-elbow`]; const h = J[`${side}-hand`]; // váll, könyök, csukló
  const proj = (a, b) => {                      // vetítés az a→b szakaszra (0..1)
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const dz = b[2] - a[2]; // a szakasz iránya
    const len2 = dx * dx + dy * dy + dz * dz || 1; // hossz négyzete
    return ((P[i * 3] - a[0]) * dx + (P[i * 3 + 1] - a[1]) * dy + (P[i * 3 + 2] - a[2]) * dz) / len2; // skaláris szorzat / hossz²
  };                                            // függvény vége
  const t1 = proj(s, e);                        // felkaron
  return t1 <= 1 ? t1 : 1 + clamp(proj(e, h), 0, 1); // ha a könyökön túl van, az alkaron folytatjuk
}                                               // függvény vége

/**
 * Egy ruha felépítése az avataron.
 * type: polo / pulover / nadrag / ov; chartRow: mérettáblázat sor (cm); under: az alatta lévő rétegek eltolása pontonként.
 */
export function buildGarment(human, type, chartRow, under = null) { // avatar, típus, méret, alsó réteg
  if (!chartRow) return null;                   // méret nélkül nincs ruha
  const { positions: P, labels, nBody, joints: J, L, H, data } = human; // az avatar adatai
  const R = data.region;                        // testrész-kódok
  const N = normalsOf(human);                   // felületi irányok
  const chart = { chest: cm(chartRow.chest_cm), waist: cm(chartRow.waist_cm), hip: cm(chartRow.hip_cm) }; // ruhaméretek méterben
  const leftSign = Math.sign(J['l-shoulder'][0]) || 1; // a "bal" oldal x előjele
  const sideOf = (i) => (Math.sign(P[i * 3]) === leftSign ? 'l' : 'r'); // egy pont melyik oldalon van
  const torsoSet = new Set([R.chest, R.abdomen, R.pelvis, R.neck]); // a törzs testrészei
  const B = new Float32Array(P.subarray(0, nBody * 3)); // a ruha "alapja": a test pontjai (a széleken levágva, lásd lent)
  const y = (i) => B[i * 3 + 1];                // egy pont magassága

  // --- 1) Mely pontok tartoznak a ruhához, melyik zónába, és hol a széle ---
  // Minden pontnak van egy "vágási értéke" (magasság, vagy a karon a helyzete), és egy tartománya.
  const zone = new Int8Array(nBody).fill(-1);   // -1 = nem része; 0 = törzs, 1 = ujj, 2 = nadrágszár, 3 = öv
  const sval = new Float32Array(nBody);         // a vágási érték
  const lo = new Float32Array(nBody);           // a tartomány alja
  const hi = new Float32Array(nBody);           // a tartomány teteje
  const byArm = new Uint8Array(nBody);          // 1 = a karon mért helyzet szerint vágunk (ruhaujj)
  const mark = (i, z, value, a, b, arm = 0) => { zone[i] = z; sval[i] = value; lo[i] = a; hi[i] = b; byArm[i] = arm; }; // beállítás
  const pantsTop = L.waist - 0.015 * H;         // a nadrág teteje (kicsit a derék alatt)
  for (let i = 0; i < nBody; i++) {             // minden testponton
    const lab = labels[i];                      // a pont testrésze
    const yy = P[i * 3 + 1];                    // magassága
    if (type === 'polo' || type === 'pulover') { // felsők
      const hem = type === 'polo' ? L.hip + 0.03 * H : L.hip - 0.012 * H; // a ruha alja: póló a csípő felett, pulóver a csípőn
      if (lab === R.upperarm || lab === R.lowerarm || lab === R.shoulder || lab === R.hand) { // a kar: ruhaujj (a kéz csak a vágáshoz kell)
        mark(i, 1, armParam(P, i, J, sideOf(i)), -10, type === 'polo' ? 0.42 : 1.93, 1); // rövid ujj a felkar feléig, hosszú a csuklóig
      } else if (torsoSet.has(lab) || (lab === R.upperleg && yy > L.crotch)) { // törzs (a csípőnél a comb teteje is)
        mark(i, 0, yy, hem, L.neckBase - 0.01 * H); // az aljától a nyakkivágásig
      }                                         // if-else vége
    } else if (type === 'nadrag') {             // nadrág
      if (lab === R.pelvis || lab === R.abdomen || lab === R.chest) mark(i, 0, yy, -10, pantsTop); // a felső rész a derékpántig (a mellkas csak a vágáshoz kell)
      if (lab === R.upperleg || lab === R.lowerleg || lab === R.foot) mark(i, yy > L.crotch ? 0 : 2, yy, L.ankle + 0.012 * H, pantsTop); // comb és lábszár a bokáig (a lábfej csak a vágáshoz kell)
    } else if (type === 'ov') {                 // öv
      if (lab === R.pelvis || lab === R.abdomen || lab === R.chest) mark(i, 3, yy, pantsTop - 0.022 * H, pantsTop - 0.003 * H); // 3,5 cm-es szalag
    }                                           // if-else vége
  }                                             // for vége

  // A széleken a háló sorai nem egyenesek. Ezért a szél után következő pontsort is felvesszük, és
  // a pontjait az élük mentén pontosan a vágási vonalra csúsztatjuk: így egyenes lesz a szél.
  const inside = (i) => zone[i] >= 0 && sval[i] >= lo[i] && sval[i] <= hi[i]; // a tartományon belül van-e
  const members = [];                           // a ruha pontjai (testindexek)
  const clipped = new Uint8Array(nBody);        // 1 = levágott szélpont
  for (let i = 0; i < nBody; i++) {             // minden ponton
    if (zone[i] < 0) continue;                  // nem jelölt pont
    if (inside(i)) { members.push(i); continue; } // belső pont: marad
    const margin = byArm[i] ? 0.4 : 0.08;       // csak a szél közelében lévő pontsort vizsgáljuk (a lábszáron a háló sorai 4–5 cm-esek is lehetnek)
    if (sval[i] < lo[i] - margin || sval[i] > hi[i] + margin) continue; // távoli pont: kimarad
    const bound = sval[i] < lo[i] ? lo[i] : hi[i]; // melyik szélen van túl
    let best = -1; let bestDist = Infinity;     // a legközelebbi belső szomszéd
    for (let j = data.adjOffset[i]; j < data.adjOffset[i + 1]; j++) { // szomszédok
      const q = data.adj[j];                    // szomszéd
      if (!inside(q) || zone[q] !== zone[i]) continue; // csak ugyanannak a résznek a belső pontja
      const dist = Math.abs(sval[q] - bound);   // mennyire van közel a szélhez
      if (dist < bestDist) { bestDist = dist; best = q; } // a legközelebbi
    }                                           // for vége
    if (best < 0) continue;                     // nincs belső szomszéd: kimarad
    const f = clamp((bound - sval[best]) / ((sval[i] - sval[best]) || 1e-6), 0, 1); // hol metszi az él a vágási vonalat
    for (let k = 0; k < 3; k++) B[i * 3 + k] = P[best * 3 + k] + (P[i * 3 + k] - P[best * 3 + k]) * f; // a pont a vágási vonalra csúszik
    members.push(i);                            // a ruhához tartozik
    clipped[i] = 1;                             // szélpontként jelöljük
  }                                             // for vége

  // --- 2) Mennyivel toljuk ki a pontokat (eltolás méterben) ---
  const torsoC = circumferenceProfile(human, new Set([...torsoSet, R.upperleg]), L.crotch, L.neckBase); // a törzs kerülete magasság szerint
  const legC = { l: circumferenceProfile(human, new Set([R.upperleg, R.lowerleg]), L.ankle, L.crotch, leftSign), r: circumferenceProfile(human, new Set([R.upperleg, R.lowerleg]), L.ankle, L.crotch, -leftSign) }; // a lábak kerülete
  const chestEase = (chart.chest ?? 0) - human.measures.chestC; // mellráhagyás
  const hipEase = (chart.hip ?? 0) - human.measures.hipC; // csípőráhagyás
  let target = null;                            // a törzs célkerület-függvénye
  if (type === 'polo' || type === 'pulover') target = topTarget(L, chart, torsoC); // felsők
  if (type === 'nadrag') {                      // nadrág a törzsön: a ráhagyás (ruha − test) a csípő és a derékpánt között változik
    const waistEase = chart.waist - human.measures.waistC; // derékráhagyás
    target = (yy) => {                          // magasság → ruha kerülete
      const C = torsoC(yy);                     // a test kerülete
      if (yy >= L.hip) return C + lerp(hipEase, waistEase, smooth((yy - L.hip) / (pantsTop - L.hip))); // csípő → derékpánt
      return Math.max(C * (1 + hipEase / human.measures.hipC), C + 0.012); // a csípő alatt azonos arányú ráhagyás
    };                                          // függvény vége
  }                                             // if vége
  const hemC = Math.max((chart.hip ?? 1) * 0.385, 0.33); // a nadrágszár alja (egyenes szabás)
  const d = new Float32Array(nBody);            // pontonkénti eltolás
  for (const i of members) {                    // a ruha pontjain
    let off = MIN_GAP;                          // alap eltolás
    if (zone[i] === 0 && target) {              // törzs: a célkerület és a test kerülete közti különbség
      off = (target(y(i)) - torsoC(y(i))) / TWO_PI; // kerület-különbség / 2π = sugárirányú eltolás
    } else if (zone[i] === 1) {                 // ruhaujj
      const t = armParam(P, i, J, sideOf(i));   // hol van a karon
      const ease = lerp(clamp(0.05 + chestEase * 0.3, 0.035, 0.12), type === 'polo' ? clamp(0.055 + chestEase * 0.25, 0.035, 0.1) : 0.04, clamp(t / (type === 'polo' ? 0.42 : 1.93), 0, 1)); // ráhagyás a vállól az ujj végéig
      off = ease / TWO_PI;                      // eltolás
      if (type === 'pulover' && t > 1.82) off = 0.012 / TWO_PI + MIN_GAP; // a mandzsetta szorosabb
    } else if (zone[i] === 2) {                 // nadrágszár
      const side = sideOf(i);                   // melyik láb
      const C = legC[side](y(i));               // a láb kerülete
      const tKnee = smooth((y(i) - L.knee) / (L.crotch - L.knee)); // 0 a térdnél, 1 a lágyéknál
      const ease = lerp(0.05, clamp(hipEase * 0.5 + 0.04, 0.03, 0.12), tKnee); // combnál bővebb
      const straight = y(i) < L.knee ? hemC : lerp(hemC, 0, smooth((y(i) - L.knee) / (0.1 * H))); // térd alatt egyenes szár
      off = (Math.max(C + ease, straight) - C) / TWO_PI; // eltolás
    } else if (zone[i] === 3) {                 // öv
      off = 0.006;                              // 6 mm a test fölött (vagy az alsó réteg fölött, lásd lent)
    }                                           // if-else vége
    if (under && under[i] > 0) off = Math.max(off, under[i] + LAYER_GAP); // ha alatta ruha van, afölé kerül
    d[i] = Math.max(off, MIN_GAP);              // legalább a minimális távolság
  }                                             // for vége

  // --- 3) Kitolás, majd simítás (a homorú részeket – pl. a mellek között – áthidalja, mint a valódi anyag) ---
  const inRuha = new Uint8Array(nBody);         // gyors ellenőrzés: része-e a ruhának
  for (const i of members) inRuha[i] = 1;       // jelölés
  const Q = new Float32Array(nBody * 3);        // a ruha pontjai (csak a tagoké érdekes)
  const lockY = (i) => {                        // a vízszintesen vágott szélek egyenesen tartása
    if (byArm[i]) return;                       // a ruhaujjakat a karon mért helyzet szerint vágtuk: ott nincs teendő
    if (clipped[i]) Q[i * 3 + 1] = B[i * 3 + 1]; // a szélpont pontosan a vágási vonalon marad
    else Q[i * 3 + 1] = clamp(Q[i * 3 + 1], lo[i], hi[i]); // a belső pont nem lóghat túl a szélen
  };                                            // függvény vége
  for (const i of members) { for (let k = 0; k < 3; k++) Q[i * 3 + k] = B[i * 3 + k] + N[i * 3 + k] * d[i]; lockY(i); } // kitolás a normál mentén (a szél egyenes marad)
  const tmp = new Float32Array(nBody * 3);      // ideiglenes tömb a simításhoz
  for (let it = 0; it < 6; it++) {              // 6 kör simítás
    for (const i of members) {                  // a ruha pontjain
      if (clipped[i] && byArm[i]) { tmp.set(Q.subarray(i * 3, i * 3 + 3), i * 3); continue; } // az ujj vége rögzítve marad (egyenes szél)
      let sx = 0; let sy = 0; let sz = 0; let m = 0; // a ruhán belüli szomszédok összege
      for (let j = data.adjOffset[i]; j < data.adjOffset[i + 1]; j++) { const q = data.adj[j]; if (!inRuha[q]) continue; sx += Q[q * 3]; sy += Q[q * 3 + 1]; sz += Q[q * 3 + 2]; m++; } // összeadás
      if (!m) { tmp.set(Q.subarray(i * 3, i * 3 + 3), i * 3); continue; } // szomszéd nélkül marad
      tmp[i * 3] = lerp(Q[i * 3], sx / m, 0.5); tmp[i * 3 + 1] = lerp(Q[i * 3 + 1], sy / m, 0.5); tmp[i * 3 + 2] = lerp(Q[i * 3 + 2], sz / m, 0.5); // félúton a szomszédok átlaga felé
    }                                           // for vége
    for (const i of members) {                  // visszaírás és korlát: ne menjen a testbe (vagy az alsó rétegbe)
      const k = i * 3;                          // hely
      const dot = (tmp[k] - B[k]) * N[k] + (tmp[k + 1] - B[k + 1]) * N[k + 1] + (tmp[k + 2] - B[k + 2]) * N[k + 2]; // mennyire van kint a test felületétől
      const minD = Math.max(MIN_GAP, under && under[i] > 0 ? under[i] + LAYER_GAP : 0) * 0.9; // minimum távolság
      const push = dot < minD ? minD - dot : 0; // ha túl közel van, kitoljuk
      Q[k] = tmp[k] + N[k] * push; Q[k + 1] = tmp[k + 1] + N[k + 1] * push; Q[k + 2] = tmp[k + 2] + N[k + 2] * push; // új hely
      lockY(i);                                 // a szél egyenes marad
    }                                           // for vége
  }                                             // for vége

  // --- 4) Kimenet: tömör pont-, index- és súlytömbök a ruha pontjaira ---
  const local = new Int32Array(nBody).fill(-1); // testindex → ruhaindex
  members.forEach((i, k) => { local[i] = k; }); // átszámozás
  const positions = new Float32Array(members.length * 3); // a ruha pontjai
  members.forEach((i, k) => positions.set(Q.subarray(i * 3, i * 3 + 3), k * 3)); // másolás
  const idx = [];                               // a ruha háromszögei
  const I = human.index;                        // a test háromszögei
  for (let t = 0; t < I.length; t += 3) {       // minden háromszögre
    const a = local[I[t]]; const b = local[I[t + 1]]; const c = local[I[t + 2]]; // ruhaindexek
    if (a >= 0 && b >= 0 && c >= 0) idx.push(a, b, c); // csak ha mindhárom csúcs a ruhához tartozik
  }                                             // for vége
  const offsets = new Float32Array(nBody);      // a végleges eltolások (a következő rétegnek)
  for (const i of members) { const k = i * 3; offsets[i] = (Q[k] - B[k]) * N[k] + (Q[k + 1] - B[k + 1]) * N[k + 1] + (Q[k + 2] - B[k + 2]) * N[k + 2]; } // vetület a normálra

  // --- 5) Az illeszkedési térkép súlyai: pontonként mell / derék / csípő / semleges ---
  const weights = new Float32Array(members.length * 4); // 4 szám pontonként
  const regions = Object.keys(chartRow).filter((k) => k.endsWith('_cm') && chartRow[k] != null).map((k) => k.replace('_cm', '')); // a ruha által mért régiók
  const anchors = { chest: L.chest, waist: L.waist, hip: L.hip }; // a régiók mérési magasságai
  const order = ['hip', 'waist', 'chest'].filter((r) => regions.includes(r)); // alulról felfelé
  const slot = { chest: 0, waist: 1, hip: 2 };  // helyük a 4-es csoportban
  members.forEach((i, k) => {                   // minden ruhaponton
    const w = [0, 0, 0, 0];                     // súlyok
    const z = zone[i];                          // a pont zónája
    if (z === 3 && regions.includes('waist')) w[1] = 1; // öv: derék
    else if (z === 0 && order.length) {         // törzs: magasság szerint, a régiók között 4 cm-es lágy átmenettel
      let cur = order[0];                       // a legalsó régióval kezdünk
      let done = false;                         // beírtuk-e már
      for (let r = 1; r < order.length && !done; r++) { // a régióhatárokon
        const b = (anchors[order[r - 1]] + anchors[order[r]]) / 2; // határ félúton
        const t = smooth((y(i) - (b - 0.02)) / 0.04); // átmenet ±2 cm-en
        if (t <= 0) break;                      // a határ alatt
        if (t >= 1) { cur = order[r]; continue; } // a határ felett
        w[slot[order[r - 1]]] = 1 - t; w[slot[order[r]]] = t; done = true; // az átmenetben mindkettő
      }                                         // for vége
      if (!done) w[slot[cur]] = 1;              // egyetlen régió
    } else if (z === 2 && regions.includes('hip')) { // nadrágszár: fent a csípő színe, lefelé elhalványul
      const t = smooth((y(i) - (L.crotch - 0.12 * H)) / (0.12 * H)); // 1 a lágyéknál, 0 a comb közepén
      w[2] = t; w[3] = 1 - t;                   // csípő és semleges
    } else w[3] = 1;                            // minden más (pl. ruhaujj): az eredeti szín
    weights.set(w, k * 4);                      // beírás
  });                                           // forEach vége

  // --- 6) Öv csat: a szalag legelöl lévő pontja elé ---
  let buckle = null;                            // csat helye
  if (type === 'ov' && members.length) {        // csak övnél
    let best = members[0];                      // a legelöl lévő pont
    for (const i of members) if (Q[i * 3 + 2] > Q[best * 3 + 2]) best = i; // legnagyobb z (előre)
    buckle = { position: [0, Q[best * 3 + 1], Q[best * 3 + 2] + 0.004] }; // középen, kicsit a szalag előtt
  }                                             // if vége

  return { type, positions, index: Uint32Array.from(idx), weights, count: members.length, offsets, buckle }; // a kész ruha
}                                               // függvény vége
