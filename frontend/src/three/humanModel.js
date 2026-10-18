// =====================================================================
// humanModel.js – a valódi emberi avatar (MakeHuman alapmodell, CC0)
// A testméretekből (nem, magasság, súly, mell, derék, csípő) kiszámolja
// a test pontjait:
//   1) nem + súly: a MakeHuman "makró" targetjei (BMI alapján)
//   2) magasság: magasság target, majd pontos méretarányos nagyítás
//   3) mell-, derék-, csípőbőség: a mérés targetek súlyát addig állítjuk,
//      amíg a 3D test kerülete pontosan a megadott cm érték nem lesz
//   4) az arcvonásokat elsimítjuk (semleges, bábuszerű fej – Design terv 2.2)
// Az adatcsomagot a tools/build_avatar.py készíti (public/avatar/).
// =====================================================================

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // érték korlátozása

let loading = null;                             // a betöltés ígérete (csak egyszer töltünk be)

/**
 * Az adatcsomag betöltése (avatar.json + avatar.bin), és a tömbök "nézeteinek" létrehozása.
 */
export function loadHumanData(base = '/avatar/') { // a csomag helye
  if (loading) return loading;                  // ha már folyamatban van / kész, ugyanazt adjuk vissza
  loading = (async () => {                      // aszinkron betöltés
    const [meta, buffer] = await Promise.all([  // a két fájl párhuzamosan
      fetch(`${base}avatar.json`).then((r) => r.json()), // leíró
      fetch(`${base}avatar.bin`).then((r) => r.arrayBuffer()), // bináris adat
    ]);                                         // Promise.all vége
    const view = (name, Type) => {              // egy szakasz tömbként (másolás nélkül)
      const [offset, length] = meta.sections[name]; // kezdet és elemszám
      return new Type(buffer, offset, length);  // típusos nézet a bufferre
    };                                          // függvény vége
    const data = {                              // a feldolgozott adatok
      meta,                                     // leíró
      nBody: meta.nBody,                        // a test pontjainak száma
      nAll: meta.nAll,                          // összes pont (ízületi segédpontokkal)
      base: view('base', Float32Array),         // alap pontok (dm)
      index: view('index', Uint16Array),        // háromszögek
      labels: view('labels', Uint8Array),       // testrész-címkék
      adjOffset: view('adjOffset', Uint32Array), // szomszédsági lista kezdőpozíciók
      adj: view('adj', Uint16Array),            // szomszédok
      dense: {},                                // sűrű targetek
      sparse: {},                               // ritka targetek
      region: Object.fromEntries(meta.regions.map((r, i) => [r, i])), // testrész neve → kód
    };                                          // objektum vége
    for (const [name, scale] of Object.entries(meta.dense)) { // sűrű targetek
      data.dense[name] = { d: view(`d_${name}`, Int16Array), scale }; // egész számok + visszaszorzó
    }                                           // for vége
    for (const [name, scale] of Object.entries(meta.sparse)) { // ritka targetek
      data.sparse[name] = { i: view(`si_${name}`, Uint16Array), d: view(`sd_${name}`, Int16Array), scale }; // indexek, eltolások, szorzó
    }                                           // for vége
    return data;                                // kész
  })();                                         // azonnal meghívjuk
  return loading;                               // az ígéret
}                                               // függvény vége

/**
 * Egy sűrű target hozzáadása w súllyal a pontokhoz.
 */
function addDense(P, t, w) {                    // pontok, target, súly
  if (!w) return;                               // nulla súlynál nincs teendő
  const k = w * t.scale;                        // a súly és a visszaszorzó együtt
  for (let i = 0; i < P.length; i++) P[i] += t.d[i] * k; // minden koordinátához
}                                               // függvény vége

/**
 * Egy ritka target hozzáadása w súllyal.
 */
function addSparse(P, t, w) {                   // pontok, target, súly
  if (!w) return;                               // nulla súlynál nincs teendő
  const k = w * t.scale;                        // szorzó
  for (let n = 0; n < t.i.length; n++) {        // az érintett pontokon
    const j = t.i[n] * 3;                       // a pont helye a tömbben
    P[j] += t.d[n * 3] * k; P[j + 1] += t.d[n * 3 + 1] * k; P[j + 2] += t.d[n * 3 + 2] * k; // x, y, z eltolás
  }                                             // for vége
}                                               // függvény vége

/**
 * A test magassága (a test pontjainak legalsó és legfelső y értéke közti különbség).
 */
function bodyHeight(P, n) {                     // pontok, testpontok száma
  let lo = Infinity; let hi = -Infinity;        // szélsőértékek
  for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; } // végignézzük
  return { lo, hi, h: hi - lo };                // alsó, felső, magasság
}                                               // függvény vége

/**
 * Konvex burok kerülete 2D pontokból (mint amikor a mérőszalagot körbetekerjük: a homorú
 * részeket – pl. a mellek között – áthidalja). Monoton lánc algoritmus.
 */
export function hullPerimeter(xs, zs) {         // a pontok két koordinátája
  const n = xs.length;                          // pontok száma
  if (n < 3) return 0;                          // kevés pontnál nincs értelme
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b] || zs[a] - zs[b]); // rendezés x, majd z szerint
  const cross = (o, a, b) => (xs[a] - xs[o]) * (zs[b] - zs[o]) - (zs[a] - zs[o]) * (xs[b] - xs[o]); // irányított terület (balra/jobbra kanyar)
  const lower = []; const upper = [];           // alsó és felső lánc
  for (const i of idx) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], i) <= 0) lower.pop(); lower.push(i); } // alsó lánc
  for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], i) <= 0) upper.pop(); upper.push(i); } // felső lánc
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1)); // a burok pontjai sorban
  let per = 0;                                  // kerület
  for (let k = 0; k < hull.length; k++) {       // a burok élein
    const a = hull[k]; const b = hull[(k + 1) % hull.length]; // két szomszédos pont
    per += Math.hypot(xs[b] - xs[a], zs[b] - zs[a]); // a távolságuk
  }                                             // for vége
  return per;                                   // a kerület
}                                               // függvény vége

/**
 * Egy vízszintes sávban lévő, megadott testrészekhez tartozó pontok indexei.
 */
export function bandIndices(P, labels, n, y, half, allowed) { // pontok, címkék, darab, magasság, félszélesség, engedett címkék
  const out = [];                               // találatok
  for (let i = 0; i < n; i++) {                 // minden testponton
    if (!allowed.has(labels[i])) continue;      // csak a megengedett testrészek
    if (Math.abs(P[i * 3 + 1] - y) <= half) out.push(i); // ha a sávban van
  }                                             // for vége
  return out;                                   // indexek
}                                               // függvény vége

/**
 * Kerület egy pontcsoportra (indexek), a P pontokból.
 */
function circumference(P, ids) {               // pontok, indexek
  const xs = new Float64Array(ids.length);      // x koordináták
  const zs = new Float64Array(ids.length);      // z koordináták
  ids.forEach((i, k) => { xs[k] = P[i * 3]; zs[k] = P[i * 3 + 2]; }); // kigyűjtés
  return hullPerimeter(xs, zs);                 // burok kerülete
}                                               // függvény vége

/**
 * Az ízületek helye: az ízületi segédpontok átlaga.
 */
function jointsOf(meta, P) {                    // leíró, pontok
  const out = {};                               // ízület neve → [x, y, z]
  for (const [name, ids] of Object.entries(meta.joints)) { // minden ízületre
    const c = [0, 0, 0];                        // összeg
    for (const i of ids) { c[0] += P[i * 3]; c[1] += P[i * 3 + 1]; c[2] += P[i * 3 + 2]; } // összeadás
    out[name] = c.map((v) => v / ids.length);   // átlag
  }                                             // for vége
  return out;                                   // ízületek
}                                               // függvény vége

/**
 * Taubin-simítás a megadott pontokon (nem zsugorít, mint a sima átlagolás):
 * így tűnnek el az arcvonások, a fej formája megmarad.
 */
function taubin(P, data, ids, fixed, iterations, lambda = 0.6, mu = -0.63) { // pontok, adatok, simítandó pontok, rögzített pontok, ismétlés
  const tmp = new Float32Array(ids.length * 3); // ideiglenes új pozíciók
  for (let it = 0; it < iterations * 2; it++) { // minden körben egy simító és egy "visszafújó" lépés
    const f = it % 2 === 0 ? lambda : mu;       // páros lépés: simít, páratlan: visszatágít
    ids.forEach((i, k) => {                     // minden simítandó ponton
      const a = data.adjOffset[i]; const b = data.adjOffset[i + 1]; // a szomszédok tartománya
      let sx = 0; let sy = 0; let sz = 0;       // a szomszédok összege
      for (let j = a; j < b; j++) { const q = data.adj[j] * 3; sx += P[q]; sy += P[q + 1]; sz += P[q + 2]; } // összeadás
      const m = b - a || 1;                     // szomszédok száma
      const p = i * 3;                          // a pont helye
      tmp[k * 3] = P[p] + f * (sx / m - P[p]);  // x a szomszédok átlaga felé
      tmp[k * 3 + 1] = P[p + 1] + f * (sy / m - P[p + 1]); // y
      tmp[k * 3 + 2] = P[p + 2] + f * (sz / m - P[p + 2]); // z
    });                                         // forEach vége
    ids.forEach((i, k) => { if (!fixed.has(i)) { P[i * 3] = tmp[k * 3]; P[i * 3 + 1] = tmp[k * 3 + 1]; P[i * 3 + 2] = tmp[k * 3 + 2]; } }); // visszaírás (a rögzítettek maradnak)
  }                                             // for vége
}                                               // függvény vége

/**
 * A BMI-ből a MakeHuman súly-értéke (0 = sovány, 0,5 = átlagos, 1 = telt).
 */
function weightValue(bmi) {                     // testtömegindex
  if (bmi <= 22) return clamp(0.5 * (bmi - 16) / 6, 0, 0.5); // 16 → 0, 22 → 0,5
  return clamp(0.5 + 0.5 * (bmi - 22) / 10, 0.5, 1); // 22 → 0,5, 32 → 1
}                                               // függvény vége

/**
 * A teljes számítás: testprofil → a test pontjai méterben, ízületek, mérési magasságok.
 */
export function buildHuman(data, profile) {     // adatok és testprofil (cm, kg)
  const { meta, nBody, nAll, labels } = data;   // gyakran használt adatok
  const R = data.region;                        // testrész-kódok
  const g = Number(profile.gender) === 0 ? 'female' : 'male'; // nem
  const Hm = profile.height_cm / 100;           // kívánt magasság méterben
  const P = new Float32Array(data.base);        // az alap pontok másolata (dm)

  // 1) nem + súly
  const girth = (profile.chest_cm + profile.waist_cm + profile.hip_cm) / 3 / profile.height_cm; // "teltség": átlagos körméret a magassághoz képest (átlagos ember ≈ 0,52)
  const wvGirth = girth <= 0.524 ? clamp(0.5 * (girth - 0.45) / 0.074, 0, 0.5) : clamp(0.5 + 0.5 * (girth - 0.524) / 0.096, 0.5, 1); // ugyanez súly-értékké alakítva (legfeljebb 1: a telt targetet nem toljuk túl, mert túlzó combokat adna)
  const wv = (weightValue(profile.weight_kg / (Hm * Hm)) + wvGirth) / 2; // a BMI és a körméretek átlaga, így a karok és a combok is követik a teltséget
  const wLevels = wv < 0.5                      // a három súlyszint keverési aránya
    ? { minweight: (0.5 - wv) * 2, averageweight: 1 - (0.5 - wv) * 2, maxweight: 0 } // sovány és átlagos között
    : { minweight: 0, averageweight: Math.max(0, 1 - (wv - 0.5) * 2), maxweight: (wv - 0.5) * 2 }; // átlagos és telt között (1 fölött a telt target erősebben hat)
  for (const [wl, w] of Object.entries(wLevels)) addDense(P, data.dense[`macro_${g}_${wl}`], w); // makró targetek

  // 1b) az arcvonások elsimítása (a fej pontjain, a nyakhoz kapcsolódó perem rögzítve)
  const head = [];                              // a fej pontjai
  for (let i = 0; i < nBody; i++) if (labels[i] === R.head) head.push(i); // kigyűjtés
  const fixed = new Set();                      // rögzített (perem) pontok
  for (const i of head) {                       // a fej pontjain
    for (let j = data.adjOffset[i]; j < data.adjOffset[i + 1]; j++) if (labels[data.adj[j]] !== R.head) { fixed.add(i); break; } // ha nem fej szomszédja van, perem
  }                                             // for vége
  taubin(P, data, head, fixed, 90);             // 90 kör erős simítás: arcvonás nélküli, bábuszerű fej (Design terv 2.2)

  // 1c) apró részletek elsimítása a törzsön (mellbimbó, köldök, lágyék), mint egy kirakati bábunál
  const detail = [];                            // a simítandó pontok
  for (let i = 0; i < nBody; i++) if (labels[i] === R.chest || labels[i] === R.abdomen || labels[i] === R.pelvis) detail.push(i); // törzs pontjai
  const detailFixed = new Set();                // a karok és lábak felé eső perem marad
  for (const i of detail) for (let j = data.adjOffset[i]; j < data.adjOffset[i + 1]; j++) { const l = labels[data.adj[j]]; if (l !== R.chest && l !== R.abdomen && l !== R.pelvis) { detailFixed.add(i); break; } } // perem keresése
  taubin(P, data, detail, detailFixed, 6);      // csak néhány kör: a kis részletek eltűnnek, a test formája (és a mért kerületek) marad

  // 2) magasság: a magasság targettel közelítünk, a maradékot arányos nagyítás pótolja
  const target = profile.height_cm / 10;        // kívánt magasság deciméterben (a csomag mértékegysége)
  const h0 = bodyHeight(P, nBody).h;            // jelenlegi magasság
  const dir = target > h0 ? 'maxheight' : 'minheight'; // magasabb vagy alacsonyabb irány
  const probe = new Float32Array(P);            // próbapéldány a target hatásának méréséhez
  for (const [wl, w] of Object.entries(wLevels)) addDense(probe, data.dense[`height_${g}_${wl}_${dir}`], w); // teljes súllyal
  const h1 = bodyHeight(probe, nBody).h;        // magasság a teljes targettel
  const hw = clamp((target - h0) / ((h1 - h0) || 1e-6), 0, 1); // ekkora részben kell alkalmazni
  for (const [wl, w] of Object.entries(wLevels)) addDense(P, data.dense[`height_${g}_${wl}_${dir}`], w * hw); // alkalmazás
  const hb = bodyHeight(P, nBody);              // magasság a target után
  const s = target / hb.h / 10;                 // nagyítás + átváltás deciméterből méterbe
  for (let i = 0; i < nAll; i++) {              // minden pontra
    P[i * 3] *= s; P[i * 3 + 1] = (P[i * 3 + 1] - hb.lo) * s; P[i * 3 + 2] *= s; // nagyítás, a talp a y = 0 síkra
  }                                             // for vége

  // 3) mell-, derék-, csípőbőség pontos illesztése
  const H = Hm;                                 // magasság méterben (rövidítés)
  const torso = new Set([R.chest, R.abdomen, R.pelvis, R.neck]); // a törzs testrészei (a karok és a kezek nélkül)
  const hipSet = new Set([R.abdomen, R.pelvis, R.upperleg]); // a csípőnél a comb teteje is számít (mint a mérőszalagnál)
  const BAND = 0.007;                           // a mérősáv félszélessége (7 mm), hogy mindig egy teljes pontkört fogjon
  const findY = (lo, hi, set, pickMax) => {     // a legnagyobb/legkisebb kerületű magasság keresése
    let best = null;                            // eddigi legjobb
    for (let y = lo * H; y <= hi * H; y += 0.005) { // fél centiméterenként
      const C = circumference(P, bandIndices(P, labels, nBody, y, BAND, set)); // kerület ezen a magasságon
      if (C > 0 && (!best || (pickMax ? C > best.C : C < best.C))) best = { y, C }; // jobb-e
    }                                           // for vége
    return best;                                // magasság és kerület
  };                                            // függvény vége
  const J0 = jointsOf(meta, P);                 // az ízületek a méretezés után (a derék helyéhez kell)
  const waistAt = () => {                       // a derék magassága
    const y = g === 'female'                    // nőknél a derék magasabban van (a köldök felett)
      ? (J0['spine-3'][1] * 2 + J0['spine-2'][1]) / 3 // a 3. és 2. gerinc-ízület között, az alsóhoz közelebb
      : J0['spine-3'][1];                       // férfiaknál a 3. gerinc-ízület magassága (köldök)
    return { y, C: circumference(P, bandIndices(P, labels, nBody, y, BAND, torso)) }; // magasság és kerület
  };                                            // függvény vége
  const hipJointY = (J0['l-upper-leg'][1] + J0['r-upper-leg'][1]) / 2; // a csípőízületek magassága
  const crotchY = hipJointY - 0.06 * H;         // a lágyék kb. 6%-kal a csípőízület alatt
  const hipY = hipJointY - 0.025 * H;           // a csípőbőség mérési helye: a fenék legszélesebb része
  const regions = [                             // a három mérési hely
    { name: 'bust', cm: profile.chest_cm, find: () => findY(0.68, 0.76, torso, true), set: torso }, // mell: a legnagyobb kerület a mellkason
    { name: 'waist', cm: profile.waist_cm, find: () => waistAt(), set: torso }, // derék: anatómiai hely (a köldök magassága a gerinc ízületéből)
    { name: 'hips', cm: profile.hip_cm, find: () => ({ y: hipY }), set: hipSet }, // csípő: anatómiai hely (a fenék legszélesebb része, kicsit a csípőízület alatt)
  ];                                            // tömb vége
  const scaledSparse = (name) => ({ ...data.sparse[name], scale: data.sparse[name].scale * s }); // a ritka targetek is méterben
  for (const r of regions) {                    // mérési helyek előkészítése
    r.y = r.find().y;                           // a mérési magasság
    r.ids = bandIndices(P, labels, nBody, r.y, BAND, r.set); // a sáv pontjai
    r.w = 0;                                    // a target súlya (pozitív: növelés, negatív: csökkentés)
  }                                             // for vége
  const apply = (Q, r, w) => {                  // egy régió targetjének alkalmazása w súllyal
    if (w > 0) addSparse(Q, scaledSparse(`${r.name}_incr`), w); // növelés
    else if (w < 0) addSparse(Q, scaledSparse(`${r.name}_decr`), -w); // csökkentés
  };                                            // függvény vége
  const measureWith = (r, weights) => {         // a kerület adott súlyokkal (csak a sáv pontjain számolva, gyors)
    const Q = new Float32Array(P);              // másolat
    regions.forEach((x, k) => apply(Q, x, weights[k])); // mindhárom target
    return circumference(Q, r.ids);             // a régió kerülete
  };                                            // függvény vége
  const weights = [0, 0, 0];                    // a három target súlya
  for (let round = 0; round < 4; round++) {     // négy kör (a targetek kicsit hatnak egymásra)
    regions.forEach((r, k) => {                 // régiónként
      const want = r.cm / 100;                  // kívánt kerület méterben
      const c0 = measureWith(r, weights);       // jelenlegi kerület
      const trial = [...weights]; trial[k] += c0 < want ? 0.3 : -0.3; // próba lépés a megfelelő irányba
      const c1 = measureWith(r, trial);         // kerület a próbával
      const slope = (c1 - c0) / (trial[k] - weights[k]); // változás súlyegységenként
      if (Math.abs(slope) > 1e-6) weights[k] = clamp(weights[k] + (want - c0) / slope, -1.5, 1.5); // Newton-lépés; a targetet csak kicsit visszük túl az eredeti tartományán (különben torz)
    });                                         // forEach vége
  }                                             // for vége
  regions.forEach((r, k) => apply(P, r, weights[k])); // a végleges súlyok alkalmazása

  // 3b) a törzs apró részleteinek elsimítása a végső formán is (a mell target visszahozhatja őket)
  taubin(P, data, detail, detailFixed, 8);      // néhány kör

  // 3c) pontos illesztés lágy, kör alakú tágítással/szűkítéssel: ami a targetekből hiányzik,
  //     azt a mérési magasság körül egyenletesen pótoljuk (harang alakú átmenet, nincs dudor)
  const sigma = 0.06 * H;                       // az átmenet szélessége (kb. 10 cm)
  for (let round = 0; round < 4; round++) {     // néhány kör, mert a három régió kicsit hat egymásra
    for (const r of regions) {                  // régiónként
      const C = circumference(P, r.ids);        // jelenlegi kerület
      const k = r.cm / 100 / C;                 // ennyiszeresére kell nagyítani
      if (Math.abs(k - 1) < 1e-4) continue;     // ha már pontos, nincs teendő
      let cx = 0; let cz = 0;                   // a sáv középpontja
      for (const i of r.ids) { cx += P[i * 3]; cz += P[i * 3 + 2]; } // összeg
      cx /= r.ids.length; cz /= r.ids.length;   // átlag
      for (let i = 0; i < nAll; i++) {          // minden ponton (a karok és lábak is mozdulnak, így nem lógnak bele a testbe)
        const dy = P[i * 3 + 1] - r.y;          // függőleges távolság a mérési magasságtól
        const sg = r.name === 'hips' && dy < 0 ? sigma * 0.5 : sigma; // a csípő alatt gyorsabban csökken (a combok ne dudorodjanak ki)
        const f = Math.exp(-((dy / sg) ** 2));  // harang alakú súly: 1 a mérési magasságban, kifelé csökken
        if (f < 1e-3) continue;                 // távol nincs hatás
        const m = 1 + (k - 1) * f;              // a helyi nagyítás
        P[i * 3] = cx + (P[i * 3] - cx) * m;    // x a középponttól
        P[i * 3 + 2] = cz + (P[i * 3 + 2] - cz) * m; // z a középponttól
      }                                         // for vége
    }                                           // for vége
  }                                             // for vége

  // --- Eredmény: ízületek és kulcsmagasságok ---
  const J = jointsOf(meta, P);                  // ízületek helye
  const avgY = (a, b) => (J[a][1] + J[b][1]) / 2; // két ízület átlagos magassága
  const measured = regions.map((r) => circumference(P, r.ids)); // a ténylegesen elért kerületek (ellenőrzéshez)
  const L = {                                   // kulcsmagasságok (méter)
    chest: regions[0].y,                        // mellbőség mérési helye
    waist: regions[1].y,                        // derék
    hip: regions[2].y,                          // csípő
    crotch: crotchY,                            // lágyék
    hipJoint: hipJointY,                        // csípőízület
    knee: avgY('l-knee', 'r-knee'),             // térd
    ankle: avgY('l-ankle', 'r-ankle'),          // boka
    shoulder: avgY('l-shoulder', 'r-shoulder'), // vállízület
    neckBase: J.neck[1],                        // nyak alja
  };                                            // objektum vége
  return {                                      // a kész avatar
    positions: P,                               // pontok (méter; az ízületi segédpontok is a végén)
    nBody, labels, index: data.index, data,     // háló adatai
    joints: J, L, H,                            // ízületek, magasságok, testmagasság
    measures: { chestC: measured[0], waistC: measured[1], hipC: measured[2] }, // elért kerületek (méter)
  };                                            // objektum vége
}                                               // függvény vége
