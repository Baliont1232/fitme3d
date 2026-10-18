// =====================================================================
// garments.js – a ruhák geometriája a testmodellből és a mérettáblázatból
// A ruha = a test gyűrűi kinagyítva. A nagyítás mértékét a mérettáblázat
// adja: ha a póló M méretének mellbősége 106 cm, a ruha gyűrűje a mell
// magasságában pontosan 106 cm kerületű lesz. Ha a ruha kisebb, mint a
// test, a ruha "rásimul" (a térkép pirossal jelzi, hogy szorít).
// Minden ruhatípus pontjainak száma állandó, így méretváltáskor a régi
// és az új forma között animálni lehet (UI terv 11: "a ruha átúszik").
// =====================================================================

import { ringAt, ringCircumference, scaleRing, ringsToPositions, ringIndices, frameIsMirrored, SEGMENTS, VERTICAL_FRAME } from './loft.js'; // gyűrűs segédfüggvények

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // érték korlátozása
const lerp = (a, b, t) => a + (b - a) * t;     // lineáris átmenet a és b között
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }; // lágy (S-alakú) átmenet 0 és 1 között
const cm = (v) => (v == null ? null : v / 100); // centiméter → méter (a null marad null)

const MIN_GAP = 0.006;                          // a ruha legalább 6 mm-rel a test fölött legyen (különben "átlátszik" a test)
const LAYER_GAP = 0.012;                        // egy felső réteg legalább 12 mm-rel legyen az alatta lévő ruha fölött

/**
 * Egyenletes mintavétel a..b között n ponttal (a ruha gyűrűinek helyei).
 */
function samples(a, b, n) {                     // kezdet, vég, darabszám
  return Array.from({ length: n }, (_, i) => lerp(a, b, i / (n - 1))); // n darab egyenletesen elosztott érték
}                                               // függvény vége

/**
 * Egy ruharész gyűrűi: a test gyűrűi az adott helyeken, a célkerületre nagyítva.
 * targetC(s, bodyC) adja meg, mekkora legyen a ruha kerülete az adott helyen.
 */
function garmentRings(dense, positions, targetC, minC = () => 0) { // test gyűrűsor, helyek, célkerület függvény, alsó réteg kerülete
  return positions.map((s) => {                 // minden helyre
    const body = ringAt(dense, s);              // a test gyűrűje ezen a helyen
    const bodyC = ringCircumference(body, 64);  // a test kerülete itt
    const wanted = targetC(s, bodyC);           // a ruha kívánt kerülete
    const C = Math.max(wanted, bodyC + MIN_GAP, minC(s) + LAYER_GAP); // nem lehet kisebb a testnél és az alatta lévő rétegnél
    return { ...scaleRing(body, C / bodyC), C }; // a test gyűrűje kinagyítva, a kerülettel együtt
  });                                           // map vége
}                                               // függvény vége

/**
 * Egy ruharész (pl. póló törzse, egyik ujja) leírása: gyűrűk, keret, kupak, színezési zóna.
 */
function part(rings, frame, zone, caps = {}) {  // gyűrűk, keret, zóna (a térkép színezéséhez), kupakok
  return { rings, frame, zone, caps };          // egyszerű objektum
}                                               // függvény vége

/**
 * A ruha célkerülete a törzsön a mérettáblázat alapján (felsőkhöz).
 * Lent a derék/csípő, középen a derék→mell átmenet, fent a válla rásimul a testre.
 */
function topTarget(body, chart, { hemFlare = 0 } = {}) { // testmodell, mérettáblázat sor (méterben), opciók
  const { L } = body;                           // kulcsmagasságok
  return (y, bodyC) => {                        // a függvény: magasság és testkerület → ruha kerülete
    const gChest = chart.chest ?? bodyC + 0.08; // a ruha mellbősége (ha nincs megadva, bő)
    const gWaist = chart.waist ?? gChest;       // a ruha derékbősége
    const gHip = chart.hip ?? gWaist;           // a ruha csípőbősége
    if (y <= L.hip) return Math.max(gHip, bodyC + 0.02) + hemFlare; // csípő alatt: a csípőméret (az alja kicsit bővülhet)
    if (y <= L.waist) return lerp(gHip, gWaist, smooth((y - L.hip) / (L.waist - L.hip))); // csípő→derék átmenet
    if (y <= L.chest) return lerp(gWaist, gChest, smooth((y - L.waist) / (L.chest - L.waist))); // derék→mell átmenet
    if (y <= L.armpit) return gChest;           // mell és hónalj között a mellbőség
    const t = smooth((y - L.armpit) / (L.shoulder - L.armpit)); // 0 a hónaljnál, 1 a váll tetején
    const shoulderC = bodyC + 0.018;            // a váll tetején a ruha szinte rásimul
    if (y <= L.shoulder) return lerp(Math.max(gChest, bodyC + 0.02), shoulderC, t); // hónalj→váll szűkül
    return bodyC + lerp(0.018, 0.04, smooth((y - L.shoulder) / (L.neckBase - L.shoulder))); // a nyakkivágás kicsit eláll a nyaktól
  };                                            // függvény vége
}                                               // függvény vége

/**
 * Ruhaujjak a karokra. 'length' = az ujj hossza a vállól (a testmagasság arányában).
 */
function sleeves(body, { length, rings, easeTop, easeEnd, cuff = 0 }) { // testmodell és ujj-beállítások
  return body.arms.map((arm) => {               // mindkét karra
    const pos = samples(-0.05 * body.H, length * body.H, rings); // gyűrűk helyei a kar mentén (a váll tetejétől)
    const ringsOut = garmentRings(arm.dense, pos, (s, bodyC) => { // ujj gyűrűi
      const t = clamp((s + 0.05 * body.H) / ((length + 0.05) * body.H), 0, 1); // 0 a vállnál, 1 az ujj végén
      let ease = lerp(easeTop, easeEnd, t);     // a ráhagyás a váll és a vég között változik
      if (s < 0.005 * body.H) ease += 0.03;     // a váll tetején bővebb, hogy fedje a deltaizmot
      if (cuff && t > 0.92) ease -= cuff;       // a mandzsetta (ujj vége) szűkebb
      return bodyC + ease;                      // a kívánt kerület
    });                                         // garmentRings vége
    return part(ringsOut, arm.frame, 'sleeve', { start: -0.014 * body.H }); // ujj, kupakkal a váll tetején (a test kupakjánál nagyobb, hogy takarja)
  });                                           // map vége
}                                               // függvény vége

/**
 * PÓLÓ: törzs a csípő fölött végződik, rövid ujj.
 */
function buildPolo(body, chart, under) {        // testmodell, mérettáblázat (méter), alsó réteg
  const { L, H } = body;                        // kulcsmagasságok és magasság
  const ys = samples(L.hip + 0.022 * H, L.neckBase - 0.003 * H, 36); // 36 gyűrű a pólószéltől a nyakig
  const torso = garmentRings(body.torso, ys, topTarget(body, chart), under); // a törzs gyűrűi
  const chestEase = (chart.chest ?? 1) - body.measures.chestC; // mellráhagyás (méter)
  const sl = sleeves(body, { length: 0.115, rings: 10, easeTop: clamp(0.05 + chestEase * 0.3, 0.035, 0.11), easeEnd: clamp(0.055 + chestEase * 0.25, 0.035, 0.1) }); // rövid ujjak
  return [part(torso, VERTICAL_FRAME, 'torso'), ...sl]; // törzs + két ujj
}                                               // függvény vége

/**
 * PULÓVER: hosszabb, a csípőt is takarja, hosszú ujj mandzsettával.
 */
function buildPulover(body, chart, under) {     // testmodell, mérettáblázat, alsó réteg
  const { L, H } = body;                        // kulcsmagasságok
  const ys = samples(L.hip - 0.028 * H, L.neckBase + 0.002 * H, 40); // 40 gyűrű a csípő alatttól a nyakig
  const target = topTarget(body, chart, { hemFlare: 0 }); // célkerület függvény
  const torso = garmentRings(body.torso, ys, (y, bodyC) => { // a törzs gyűrűi
    const base = target(y, bodyC);              // alap célkerület
    if (y < L.hip - 0.02 * H) return Math.max(base - 0.03, bodyC + 0.012); // a bordázott alja kicsit szűkebb
    return base;                                // különben az alap
  }, under);                                    // garmentRings vége
  const chestEase = (chart.chest ?? 1) - body.measures.chestC; // mellráhagyás
  const sl = sleeves(body, { length: 0.335, rings: 22, easeTop: clamp(0.07 + chestEase * 0.3, 0.05, 0.13), easeEnd: 0.045, cuff: 0.025 }); // hosszú ujjak
  return [part(torso, VERTICAL_FRAME, 'torso'), ...sl]; // törzs + két ujj
}                                               // függvény vége

/**
 * NADRÁG: a derékig érő felső rész + két nadrágszár a bokáig.
 */
function buildNadrag(body, chart) {             // testmodell, mérettáblázat
  const { L, H } = body;                        // kulcsmagasságok
  const gWaist = chart.waist;                   // a nadrág derékbősége
  const gHip = chart.hip ?? gWaist + 0.18;      // a nadrág csípőbősége
  const ys = samples(L.crotch - 0.004 * H, L.waist + 0.004 * H, 22); // a felső rész gyűrűi a lágyéktól a derékig
  const top = garmentRings(body.torso, ys, (y, bodyC) => { // a felső rész célkerülete
    if (y >= L.waist) return gWaist;            // derékban a nadrág derékbősége
    if (y >= L.hip) return lerp(gHip, gWaist, smooth((y - L.hip) / (L.waist - L.hip))); // csípő→derék átmenet
    return Math.max(bodyC * (gHip / body.measures.hipC), bodyC + 0.012); // csípő alatt a test formáját követi, ugyanakkora arányú ráhagyással
  });                                           // garmentRings vége
  const hipEase = gHip - body.measures.hipC;    // csípőráhagyás
  const hemC = Math.max(gHip * 0.385, 0.33);    // a nadrágszár alja (egyenes szabás)
  const legs = body.legs.map((leg) => {         // mindkét lábra
    const lys = samples(0.05 * H, L.crotch + 0.04 * H, 30); // a szár gyűrűi a bokától a lágyék fölé
    const rings = garmentRings(leg.dense, lys, (y, bodyC) => { // a szár célkerülete
      const tKnee = smooth((y - L.knee) / (L.crotch - L.knee)); // 0 a térdnél, 1 a lágyéknál
      const ease = lerp(0.05, clamp(hipEase * 0.5 + 0.03, 0.02, 0.1), tKnee); // a combnál a csípőráhagyás fele
      const straight = y < L.knee ? hemC : lerp(hemC, 0, smooth((y - L.knee) / (0.1 * H))); // térd alatt egyenes szár
      const hipBlend = smooth((y - (L.crotch - 0.07 * H)) / (0.11 * H)) * (0.05 + Math.max(hipEase, 0) * 0.4); // a szár teteje kiszélesedik, hogy a csípő vonala folytatódjon
      return Math.max(bodyC + ease + hipBlend, straight); // a kettő közül a nagyobb
    });                                         // garmentRings vége
    return part(rings, VERTICAL_FRAME, 'leg');  // nadrágszár
  });                                           // map vége
  return [part(top, VERTICAL_FRAME, 'torso', { start: -0.008 * H }), ...legs]; // felső rész (alul lezárva) + két szár
}                                               // függvény vége

/**
 * ÖV: keskeny szalag a derék alatt, a nadrág fölött.
 */
function buildOv(body, chart, under) {          // testmodell, mérettáblázat, alsó réteg
  const { L, H } = body;                        // kulcsmagasságok
  const ys = samples(L.waist - 0.024 * H, L.waist - 0.004 * H, 4); // 4 gyűrű: kb. 3,5 cm széles szalag
  const rings = garmentRings(body.torso, ys, (y, bodyC) => bodyC + 0.022, under); // a testre/nadrágra simul
  return [part(rings, VERTICAL_FRAME, 'belt')]; // egyetlen rész
}                                               // függvény vége

const BUILDERS = { polo: buildPolo, pulover: buildPulover, nadrag: buildNadrag, ov: buildOv }; // ruhatípus → építő függvény
export const LAYER_ORDER = { nadrag: 0, polo: 1, pulover: 1, ov: 2 }; // rétegsorrend: nadrág legbelül, öv legkívül

/**
 * Egy ruha összes része (törzs, ujjak, szárak) a testre szabva.
 * chartRow: mérettáblázat sor cm-ben; under(y): az alatta lévő rétegek kerülete a törzsön.
 */
export function buildGarmentParts(body, garmentType, chartRow, under = () => 0) { // testmodell, típus, méretsor, alsó réteg
  const build = BUILDERS[garmentType];          // a típus építő függvénye
  if (!build || !chartRow) return [];           // ismeretlen típus vagy hiányzó méret: nincs ruha
  const chart = { chest: cm(chartRow.chest_cm), waist: cm(chartRow.waist_cm), hip: cm(chartRow.hip_cm) }; // cm → méter
  return build(body, chart, under);             // a ruha részei
}                                               // függvény vége

/**
 * A ruha törzsrészének kerülete egy magasságon (a felette lévő réteg ehhez igazodik).
 */
export function torsoCircumferenceFn(parts) {   // ruha részek
  const torso = parts.find((p) => p.zone === 'torso' || p.zone === 'belt'); // a törzsrész
  if (!torso) return () => 0;                   // ha nincs, nem számít
  const first = torso.rings[0].s;               // a legalsó gyűrű magassága
  const last = torso.rings[torso.rings.length - 1].s; // a legfelső
  return (y) => {                               // a függvény magasságot kap
    if (y < first || y > last) return 0;        // a ruhán kívül nem számít
    const r = ringAt(torso.rings, y);           // a ruha gyűrűje ott
    return ringCircumference(r, 48);            // a kerülete
  };                                            // függvény vége
}                                               // függvény vége

/**
 * Egy rész pontjai (pozíciók) – frissítéskor ugyanazt a tömböt írjuk felül.
 */
export function partPositions(p, target = null) { // ruharész és opcionális cél tömb
  return ringsToPositions(p.rings, p.frame, p.caps, target); // a gyűrűk pontjai a térben
}                                               // függvény vége

/**
 * Egy rész háromszögei.
 */
export function partIndices(p) {                // ruharész
  return ringIndices(p.rings.length, p.caps, frameIsMirrored(p.frame)); // indexek (tükrözött keretnél fordítva)
}                                               // függvény vége

/**
 * Az illeszkedési térkép súlyai pontonként: minden ponthoz megmondja, mennyire tartozik
 * a mell / derék / csípő régióhoz (a többi rész semleges, eredeti színű marad).
 * 'regions' = azok a régiók, amelyeket a ruha mér (pl. pólónál mell és derék).
 * A régiók között 4 cm-es lágy átmenet van (design terv 6.1).
 */
export function regionWeights(body, p, regions) { // testmodell, ruharész, mért régiók
  const count = p.rings.length * SEGMENTS + (p.caps.start ? 1 : 0) + (p.caps.end ? 1 : 0); // pontok száma
  const weights = new Float32Array(count * 4);  // pontonként 4 szám: mell, derék, csípő, semleges
  const anchors = { chest: body.L.chest, waist: body.L.waist, hip: body.L.hip }; // a régiók mérési magasságai
  const order = ['hip', 'waist', 'chest'].filter((r) => regions.includes(r)); // a mért régiók alulról felfelé
  const slot = { chest: 0, waist: 1, hip: 2 };  // melyik régió hányadik helyre kerül a 4-es csoportban
  const band = 0.02;                            // fél átmeneti szélesség: 2 cm (összesen 4 cm)
  const ringY = (ri) => p.rings[Math.min(ri, p.rings.length - 1)].s; // egy gyűrű magassága / helye
  for (let i = 0; i < count; i++) {             // minden pontra
    const ri = Math.floor(i / SEGMENTS);        // melyik gyűrűhöz tartozik
    const w = [0, 0, 0, 0];                     // a pont súlyai
    if (p.zone === 'belt' && regions.includes('waist')) { // öv: az egész a derékhoz tartozik
      w[1] = 1;                                 // derék súly 1
    } else if (p.zone === 'torso' && order.length > 0) { // törzsrész
      const y = ringY(ri);                      // a pont magassága
      let current = order[0];                   // kezdetben a legalsó régió
      for (let k = 1; k < order.length; k++) {  // a régióhatárokon végig
        const boundary = (anchors[order[k - 1]] + anchors[order[k]]) / 2; // két régió közötti határ (félúton)
        const t = smooth((y - (boundary - band)) / (2 * band)); // 0 a határ alatt, 1 felette, lágy átmenettel
        if (t <= 0) break;                      // a határ alatt vagyunk: marad az alsó régió
        if (t >= 1) { current = order[k]; continue; } // a határ felett: a felső régió
        w[slot[order[k - 1]]] = 1 - t;          // az átmenetben: mindkét régió részben
        w[slot[order[k]]] = t;                  // ...a másik részben
        current = null;                         // jelezzük, hogy már beírtuk
        break;                                  // kész
      }                                         // for vége
      if (current) w[slot[current]] = 1;        // ha nem átmenetben van, egyetlen régióé
    } else if (p.zone === 'leg' && regions.includes('hip')) { // nadrágszár: fent a csípő színe, lefelé elhalványul
      const y = ringY(ri);                      // a pont magassága
      const t = smooth((y - (body.L.crotch - 0.12 * body.H)) / (0.1 * body.H)); // 1 a lágyéknál, 0 a comb közepe alatt
      w[2] = t;                                 // csípő súly
      w[3] = 1 - t;                             // a többi semleges
    } else {                                    // minden más (pl. ruhaujj)
      w[3] = 1;                                 // semleges: az eredeti szín
    }                                           // if-else vége
    weights.set(w, i * 4);                      // beírjuk a tömbbe
  }                                             // for vége
  return weights;                               // a súlyok
}                                               // függvény vége
