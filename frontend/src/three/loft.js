// =====================================================================
// loft.js – geometria építése "gyűrűkből" (keresztmetszetekből)
// Az avatar és a ruhák is így készülnek: egymás fölé tett ellipszis-
// szerű gyűrűket kötünk össze háromszögekkel, mint egy esztergált,
// de nem kör alakú testet. Így minden testméretből (cm) közvetlenül
// számolható a forma, Blender modell nélkül (3D terv 3.4 fejezet).
// =====================================================================

import * as THREE from 'three';                 // a Three.js könyvtár

export const SEGMENTS = 48;                     // ennyi pontból áll egy gyűrű (több = simább, de lassabb)

/**
 * Egy gyűrű egy pontja a gyűrű saját síkjában.
 * A gyűrű egy "szuperellipszis": a = fél szélesség, bF = előre mért mélység,
 * bB = hátra mért mélység (így lehet mellkas elöl, fenék hátul), p = szögletesség.
 */
export function ringLocalPoint(theta, ring) {   // szög (radián) és a gyűrű adatai
  const c = Math.cos(theta);                    // a szög koszinusza (oldalirány)
  const s = Math.sin(theta);                    // a szög szinusza (elöl-hátul irány)
  const e = 2 / (ring.p ?? 2.2);                // kitevő: p=2 ellipszis, nagyobb p szögletesebb
  const depth = s >= 0 ? ring.bF : ring.bB;     // elöl (s>=0) az elülső, hátul a hátsó mélység számít
  return {                                      // a pont koordinátái a gyűrű síkjában
    x: ring.a * Math.sign(c) * Math.abs(c) ** e + (ring.cx ?? 0), // vízszintes (oldal) koordináta + eltolás
    z: depth * Math.sign(s) * Math.abs(s) ** e + (ring.cz ?? 0),  // mélységi koordináta + eltolás
  };                                            // objektum vége
}                                               // függvény vége

/**
 * Egy gyűrű kerülete (méterben), sok pontból összeadott szakaszhosszakkal.
 */
export function ringCircumference(ring, samples = 96) { // gyűrű és a mintavételi pontok száma
  let total = 0;                                // összeg
  let prev = ringLocalPoint(0, ring);           // az első pont
  for (let i = 1; i <= samples; i++) {          // körbemegyünk
    const p = ringLocalPoint((i / samples) * Math.PI * 2, ring); // következő pont
    total += Math.hypot(p.x - prev.x, p.z - prev.z); // a két pont távolsága hozzáadva
    prev = p;                                   // továbblépünk
  }                                             // for vége
  return total;                                 // a kerület
}                                               // függvény vége

/**
 * Gyűrű méretezése úgy, hogy a kerülete pontosan a megadott legyen (a forma arányai maradnak).
 * Így lesz a 3D test mellbősége pontosan annyi, amennyit a felhasználó beírt.
 */
export function ringWithCircumference(shape, circumference) { // forma (arányok) és a kívánt kerület
  const unit = { ...shape, cx: 0, cz: 0 };      // az eltolás nélküli forma (a kerületet nem befolyásolja)
  const k = circumference / ringCircumference(unit); // ennyiszeresére kell nagyítani
  return { ...shape, a: shape.a * k, bF: shape.bF * k, bB: shape.bB * k }; // minden méret arányosan nagyítva
}                                               // függvény vége

/**
 * Gyűrű nagyítása egy szorzóval a saját középpontja körül (a ruháknál használjuk).
 */
export function scaleRing(ring, factor) {       // gyűrű és szorzó
  return { ...ring, a: ring.a * factor, bF: ring.bF * factor, bB: ring.bB * factor }; // a középpont (cx, cz) változatlan
}                                               // függvény vége

const NUMERIC_KEYS = ['a', 'bF', 'bB', 'p', 'cx', 'cz']; // a gyűrű simítandó számadatai

/**
 * Catmull–Rom görbe egy számra: a 4 szomszédos kulcsérték között sima átmenetet ad.
 */
function catmull(p0, p1, p2, p3, t) {           // négy érték és a 0..1 közötti helyzet
  const t2 = t * t;                             // t négyzete
  const t3 = t2 * t;                            // t köbe
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); // a Catmull–Rom képlet
}                                               // függvény vége

/**
 * Kulcsgyűrűkből sűrű, sima gyűrűsor készítése. A kulcsok 's' szerint növekvő sorrendben vannak
 * (törzsnél s = magasság, végtagnál s = távolság a tengely mentén). Minden szakaszt
 * 'steps' részre osztunk, így a pontok száma nem függ a testmérettől (ez kell az animációhoz).
 */
export function densifyRings(keys, steps = 6) { // kulcsgyűrűk és szakaszonkénti lépésszám
  const out = [];                               // a sűrű gyűrűk
  for (let i = 0; i < keys.length - 1; i++) {   // minden szomszédos kulcspáron
    const k0 = keys[Math.max(0, i - 1)];        // előző kulcs (a görbéhez kell)
    const k1 = keys[i];                         // szakasz eleje
    const k2 = keys[i + 1];                     // szakasz vége
    const k3 = keys[Math.min(keys.length - 1, i + 2)]; // következő kulcs
    for (let j = 0; j < steps; j++) {           // a szakasz belső pontjai
      const t = j / steps;                      // helyzet a szakaszon belül (0..1)
      const ring = { s: k1.s + (k2.s - k1.s) * t }; // a pozíció egyenletesen
      for (const key of NUMERIC_KEYS) {         // minden számadatra
        const v = (k) => k[key] ?? (key === 'p' ? 2.2 : 0); // hiányzó érték alapja (p=2.2, eltolás=0)
        ring[key] = catmull(v(k0), v(k1), v(k2), v(k3), t); // sima átmenet a kulcsok között
      }                                         // for vége
      ring.a = Math.max(ring.a, 0.002);         // a méret soha ne legyen nulla vagy negatív
      ring.bF = Math.max(ring.bF, 0.002);       // ugyanez az elülső mélységre
      ring.bB = Math.max(ring.bB, 0.002);       // ugyanez a hátsó mélységre
      out.push(ring);                           // hozzáadjuk a listához
    }                                           // for vége
  }                                             // for vége
  out.push({ ...keys[keys.length - 1], p: keys[keys.length - 1].p ?? 2.2, cx: keys[keys.length - 1].cx ?? 0, cz: keys[keys.length - 1].cz ?? 0 }); // az utolsó kulcs is bekerül
  return out;                                   // a sűrű gyűrűsor
}                                               // függvény vége

/**
 * Egy tetszőleges 's' helyen lévő gyűrű a sűrű sorból (lineáris átmenettel két gyűrű között).
 * A ruhák ezzel kérdezik le: "milyen széles a test ezen a magasságon?"
 */
export function ringAt(dense, s) {              // sűrű gyűrűsor és a hely
  if (s <= dense[0].s) return { ...dense[0] };  // az elejénél kisebb: az első gyűrű
  const last = dense[dense.length - 1];         // utolsó gyűrű
  if (s >= last.s) return { ...last };          // a végénél nagyobb: az utolsó gyűrű
  let lo = 0;                                   // bináris keresés alsó határa
  let hi = dense.length - 1;                    // felső határa
  while (hi - lo > 1) {                         // amíg két szomszédos gyűrűt nem találunk
    const mid = (lo + hi) >> 1;                 // középső index
    if (dense[mid].s <= s) lo = mid; else hi = mid; // a megfelelő félben folytatjuk
  }                                             // while vége
  const r0 = dense[lo];                         // alsó gyűrű
  const r1 = dense[hi];                         // felső gyűrű
  const t = (s - r0.s) / (r1.s - r0.s || 1);    // helyzet a kettő között (0..1)
  const ring = { s };                           // új gyűrű
  for (const key of NUMERIC_KEYS) ring[key] = r0[key] + (r1[key] - r0[key]) * t; // minden adat lineárisan
  return ring;                                  // az interpolált gyűrű
}                                               // függvény vége

/**
 * Egy "keret" (frame) a gyűrűk elhelyezéséhez a térben:
 * origin = kezdőpont, axis = merre halad a sor, u = a gyűrű oldaliránya, w = mélységiránya.
 * A törzsnél és a lábaknál a tengely függőleges, a karoknál ferde.
 */
export const VERTICAL_FRAME = {                 // függőleges keret (törzs, láb)
  origin: new THREE.Vector3(0, 0, 0),           // a világ origója
  axis: new THREE.Vector3(0, 1, 0),             // felfelé halad
  u: new THREE.Vector3(1, 0, 0),                // oldalirány: x
  w: new THREE.Vector3(0, 0, 1),                // mélység: z (előre)
};                                              // objektum vége

/**
 * A gyűrűsor összes pontjának kiszámítása egy Float32Array-be (x, y, z hármasok).
 * Ha 'target' meg van adva, abba ír (így nem kell új memóriát foglalni frissítéskor).
 */
export function ringsToPositions(rings, frame = VERTICAL_FRAME, caps = {}, target = null) { // gyűrűk, keret, kupakok, cél tömb
  const capCount = (caps.start ? 1 : 0) + (caps.end ? 1 : 0); // hány kupak-középpont kell
  const count = rings.length * SEGMENTS + capCount; // összes pont
  const pos = target ?? new Float32Array(count * 3); // a tömb (meglévő vagy új)
  const tmp = new THREE.Vector3();              // segédvektor, hogy ne foglaljunk újat minden pontnál
  let i = 0;                                    // írási index
  const put = (v) => { pos[i++] = v.x; pos[i++] = v.y; pos[i++] = v.z; }; // egy pont beírása
  for (const ring of rings) {                   // minden gyűrűre
    for (let k = 0; k < SEGMENTS; k++) {        // a gyűrű minden pontjára
      const lp = ringLocalPoint((k / SEGMENTS) * Math.PI * 2, ring); // pont a gyűrű síkjában
      tmp.copy(frame.origin)                    // kiindulás a keret origójából
        .addScaledVector(frame.axis, ring.s)    // előre a tengely mentén s-sel
        .addScaledVector(frame.u, lp.x)         // oldalra
        .addScaledVector(frame.w, lp.z);        // előre-hátra
      put(tmp);                                 // beírjuk
    }                                           // for vége
  }                                             // for vége
  const capPoint = (ring, extra) => {           // kupak középpontja: a gyűrű közepe, kicsit kijjebb tolva
    tmp.copy(frame.origin)                      // keret origója
      .addScaledVector(frame.axis, ring.s + extra) // a tengely mentén a gyűrűn túl
      .addScaledVector(frame.u, ring.cx ?? 0)   // oldaleltolás
      .addScaledVector(frame.w, ring.cz ?? 0);  // mélységi eltolás
    put(tmp);                                   // beírjuk
  };                                            // függvény vége
  if (caps.start) capPoint(rings[0], caps.start); // alsó/kezdő kupak
  if (caps.end) capPoint(rings[rings.length - 1], caps.end); // felső/záró kupak
  return pos;                                   // a pontok tömbje
}                                               // függvény vége

/**
 * Háromszögek (indexek) a gyűrűsorhoz: két szomszédos gyűrű pontjait téglalapokká,
 * azokat két-két háromszöggé kötjük. A sorrend miatt a felület kifelé néz.
 */
export function ringIndices(ringCount, caps = {}, flip = false) { // gyűrűk száma, kupakok, fordított körüljárás kell-e
  const idx = [];                               // indexek listája
  for (let r = 0; r < ringCount - 1; r++) {     // minden gyűrűpárra
    for (let k = 0; k < SEGMENTS; k++) {        // a gyűrű minden szakaszára
      const k2 = (k + 1) % SEGMENTS;            // a következő pont (körbeér, nincs varrat)
      const a = r * SEGMENTS + k;               // alsó gyűrű, aktuális pont
      const b = r * SEGMENTS + k2;              // alsó gyűrű, következő pont
      const c = (r + 1) * SEGMENTS + k;         // felső gyűrű, aktuális pont
      const d = (r + 1) * SEGMENTS + k2;        // felső gyűrű, következő pont
      idx.push(a, c, b, b, c, d);               // két háromszög, kifelé néző körüljárással
    }                                           // for vége
  }                                             // for vége
  let next = ringCount * SEGMENTS;              // a kupak-középpontok indexe a gyűrűk után jön
  if (caps.start) {                             // kezdő kupak
    const center = next++;                      // a középpont indexe
    for (let k = 0; k < SEGMENTS; k++) idx.push(center, k, (k + 1) % SEGMENTS); // legyező a középpontból az első gyűrűre
  }                                             // if vége
  if (caps.end) {                               // záró kupak
    const center = next++;                      // a középpont indexe
    const base = (ringCount - 1) * SEGMENTS;    // az utolsó gyűrű első pontja
    for (let k = 0; k < SEGMENTS; k++) idx.push(center, base + (k + 1) % SEGMENTS, base + k); // legyező, fordított körüljárással
  }                                             // if vége
  if (flip) {                                   // ha a keret "tükrözött" (pl. a jobb kar), a háromszögeket meg kell fordítani
    for (let i = 0; i < idx.length; i += 3) {   // háromszögenként
      const t = idx[i + 1];                     // a 2. csúcs ideiglenes mentése
      idx[i + 1] = idx[i + 2];                  // 2. és 3. csúcs cseréje...
      idx[i + 2] = t;                           // ...így a felület a másik irányba néz
    }                                           // for vége
  }                                             // if vége
  return idx;                                   // az indexek
}                                               // függvény vége

/**
 * Igaz, ha a keret tükrözött (balkezes) koordináta-rendszert ad, ilyenkor fordítani kell a háromszögeket.
 */
export function frameIsMirrored(frame) {        // keretet kap
  return frame.u.clone().cross(frame.axis).dot(frame.w) < 0; // u × tengely iránya ellentétes w-vel → tükrözött
}                                               // függvény vége

/**
 * Teljes BufferGeometry a gyűrűsorból (pontok + háromszögek + normálvektorok a fényhez).
 */
export function buildRingGeometry(rings, frame = VERTICAL_FRAME, caps = {}) { // gyűrűk, keret, kupakok
  const geometry = new THREE.BufferGeometry();  // új, üres geometria
  geometry.setAttribute('position', new THREE.BufferAttribute(ringsToPositions(rings, frame, caps), 3)); // pontok, 3 szám pontonként
  geometry.setIndex(ringIndices(rings.length, caps, frameIsMirrored(frame))); // háromszögek (tükrözött keretnél fordítva)
  geometry.computeVertexNormals();              // normálvektorok (merre néz a felület) a fényezéshez
  return geometry;                              // kész geometria
}                                               // függvény vége

/**
 * Ferde keret egy végtaghoz: a tengely az 'axis' irányába mutat, u merőleges rá az x–y síkban.
 */
export function limbFrame(origin, axis) {       // kezdőpont és irány
  const dir = axis.clone().normalize();         // egységnyi hosszú irányvektor
  const u = new THREE.Vector3(-dir.y, dir.x, 0); // az irányra merőleges vektor az x–y síkban (90°-kal elforgatva)
  if (u.x * Math.sign(origin.x || 1) < 0) u.multiplyScalar(-1); // u mindig kifelé (a testtől el) mutasson
  return { origin: origin.clone(), axis: dir, u: u.normalize(), w: new THREE.Vector3(0, 0, 1) }; // a kész keret
}                                               // függvény vége
