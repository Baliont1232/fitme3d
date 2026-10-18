// =====================================================================
// GarmentMesh.jsx – egy ruhadarab a jelenetben
// - méretváltáskor a ruha 200 ms alatt "átúszik" az új formára
// - színváltáskor csak a szín cserélődik, a forma nem épül újra
// - az illeszkedési térkép be/kikapcsolása 200 ms-os áttűnés
// =====================================================================

import { useEffect, useMemo, useRef } from 'react'; // React horgok
import { useFrame } from '@react-three/fiber';  // képkockánként lefutó függvény (animáció)
import * as THREE from 'three';                 // Three.js
import { partPositions, partIndices, regionWeights } from './garments.js'; // ruha geometria segédfüggvények
import { SEGMENTS } from './loft.js';           // pontok száma gyűrűnként

const DURATION = 0.2;                           // animációk hossza: 200 ms (UI terv 11. fejezet)
const easeOut = (t) => 1 - (1 - t) ** 3;        // lassuló átmenet (ease-out)

/**
 * A ruha részeit (törzs, ujjak, szárak) egyetlen pont- és indexlistába fűzi össze.
 */
function mergeParts(body, parts, regions) {     // testmodell, ruha részek, mért régiók
  const positions = [];                         // pont tömbök részenként
  const weights = [];                           // térkép súlyok részenként
  const index = [];                             // háromszög indexek
  let offset = 0;                               // az aktuális rész első pontjának sorszáma
  for (const p of parts) {                      // minden részre
    const pos = partPositions(p);               // a rész pontjai
    positions.push(pos);                        // eltesszük
    weights.push(regionWeights(body, p, regions)); // a térkép súlyai
    for (const i of partIndices(p)) index.push(i + offset); // indexek eltolva az eddigi pontok számával
    offset += pos.length / 3;                   // a következő rész ennyivel később kezdődik
  }                                             // for vége
  const concat = (arrays, size) => {            // több Float32Array összefűzése egybe
    const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0)); // az összes elem helye
    let at = 0;                                 // írási pozíció
    for (const a of arrays) { out.set(a, at); at += a.length; } // egymás után másoljuk
    return out;                                 // az eredmény
  };                                            // függvény vége
  return { positions: concat(positions), weights: concat(weights), index, count: offset }; // összefűzött adatok
}                                               // függvény vége

/**
 * A ruha. parts = buildGarmentParts eredménye, evaluation = a kiválasztott méret kiértékelése.
 */
export default function GarmentMesh({ body, parts, regions, color, evaluation, fitMap, config, buckle }) { // props
  const geometryRef = useRef(new THREE.BufferGeometry()); // a ruha geometriája (egyszer jön létre, utána csak frissül)
  const anim = useRef({ from: null, to: null, start: 0, active: false }); // a forma-animáció állapota
  const blend = useRef({ value: fitMap ? 1 : 0, target: fitMap ? 1 : 0 }); // a térkép áttűnésének állapota (0 = ki, 1 = be)
  const colorsDirty = useRef(true);             // kell-e újraszámolni a színeket

  const material = useMemo(() => new THREE.MeshStandardMaterial({ // a ruha anyaga
    vertexColors: true,                         // a szín pontonként jön (így lehet a térkép színátmenetes)
    roughness: config.garmentRoughness,         // matt
    side: THREE.DoubleSide,                     // a belseje is látszik (pl. az ujj nyílásán át)
  }), [config.garmentRoughness]);               // csak egyszer jön létre
  useEffect(() => () => material.dispose(), [material]); // felszabadítás

  const merged = useMemo(() => mergeParts(body, parts, regions), [body, parts, regions]); // a ruha összefűzött adatai

  useEffect(() => {                             // ha új forma jött (méret- vagy testváltás)
    const geometry = geometryRef.current;       // a meglévő geometria
    const current = geometry.getAttribute('position'); // a jelenlegi pontok (ha vannak)
    if (current && current.count === merged.count) { // ha ugyanannyi pont van: animálhatunk
      anim.current = {                          // az animáció beállítása
        from: Float32Array.from(current.array), // honnan: a mostani (akár félúton lévő) forma másolata
        to: merged.positions,                   // hová: az új forma
        start: performance.now() / 1000,        // kezdés ideje másodpercben
        active: true,                           // fut
      };                                        // objektum vége
    } else {                                    // első megjelenés vagy más pontszám: azonnal beállítjuk
      geometry.setAttribute('position', new THREE.BufferAttribute(merged.positions.slice(), 3)); // pontok
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(merged.count * 3), 3)); // színek helye
      geometry.setIndex(merged.index);          // háromszögek
      geometry.computeVertexNormals();          // normálvektorok
      geometry.computeBoundingSphere();         // befoglaló gömb (a láthatóság-vizsgálathoz)
      anim.current.active = false;              // nincs animáció
    }                                           // if-else vége
    colorsDirty.current = true;                 // a súlyok változhattak, újra kell színezni
  }, [merged]);                                 // függőség: az új forma

  useEffect(() => { colorsDirty.current = true; }, [color, evaluation]); // szín vagy illeszkedés változott: újraszínezés
  useEffect(() => { blend.current.target = fitMap ? 1 : 0; }, [fitMap]); // térkép kapcsoló: az áttűnés célja
  useEffect(() => () => geometryRef.current.dispose(), []); // a geometria felszabadítása a végén

  const palette = useMemo(() => {               // a használt színek THREE.Color formában
    const statusColor = { success: new THREE.Color(config.fit.success), warning: new THREE.Color(config.fit.warning), danger: new THREE.Color(config.fit.danger) }; // a három állapotszín
    const byRegion = {};                        // régió → állapot színe
    for (const r of evaluation?.regions ?? []) byRegion[r.region] = statusColor[r.level]; // pl. waist → sárga
    return { base: new THREE.Color(color), byRegion }; // alapszín és régiószínek
  }, [color, evaluation, config]);              // függőségek

  useFrame(() => {                              // minden képkockánál lefut
    const geometry = geometryRef.current;       // a geometria
    const a = anim.current;                     // forma-animáció
    if (a.active) {                             // ha épp animálunk
      const t = Math.min(1, (performance.now() / 1000 - a.start) / DURATION); // eltelt idő aránya (0..1)
      const k = easeOut(t);                     // lassuló görbe
      const pos = geometry.getAttribute('position'); // a pontok
      for (let i = 0; i < pos.array.length; i++) pos.array[i] = a.from[i] + (a.to[i] - a.from[i]) * k; // minden koordináta a régi és az új között
      pos.needsUpdate = true;                   // jelezzük a videókártyának, hogy frissült
      geometry.computeVertexNormals();          // a fényezés is kövesse a formát
      if (t >= 1) { a.active = false; geometry.computeBoundingSphere(); } // vége az animációnak
    }                                           // if vége

    const b = blend.current;                    // térkép áttűnés
    if (b.value !== b.target) {                 // ha még nem érte el a célt
      const step = 1 / (60 * DURATION);         // ennyit lép képkockánként (kb. 200 ms alatt ér át)
      b.value = b.target > b.value ? Math.min(b.target, b.value + step) : Math.max(b.target, b.value - step); // közelítés a célhoz
      colorsDirty.current = true;               // a színeket újra kell számolni
    }                                           // if vége

    if (colorsDirty.current) {                  // ha újra kell színezni
      const colors = geometry.getAttribute('color'); // a színek tömbje
      if (!colors) return;                      // még nincs geometria
      const w = merged.weights;                 // térkép súlyok pontonként (mell, derék, csípő, semleges)
      const mix = config.fitMix * b.value;      // mennyire keverjük be a térkép színét
      const { base, byRegion } = palette;       // színek
      const regionList = [byRegion.chest, byRegion.waist, byRegion.hip]; // a súlyok sorrendjében
      for (let i = 0; i < merged.count; i++) {  // minden pontra
        let r = 0; let g = 0; let bl = 0;       // a térkép szerinti szín összetevői
        for (let k = 0; k < 3; k++) {           // a három régióra
          const weight = w[i * 4 + k];          // a pont súlya ebben a régióban
          const c = regionList[k] ?? base;      // a régió színe (ha a ruha nem méri, az alapszín)
          r += c.r * weight; g += c.g * weight; bl += c.b * weight; // súlyozott összeadás
        }                                       // for vége
        const neutral = w[i * 4 + 3];           // semleges súly
        r += base.r * neutral; g += base.g * neutral; bl += base.b * neutral; // a semleges rész az alapszín
        colors.array[i * 3] = base.r + (r - base.r) * mix;       // piros összetevő: alapszín → térkép szín
        colors.array[i * 3 + 1] = base.g + (g - base.g) * mix;   // zöld összetevő
        colors.array[i * 3 + 2] = base.b + (bl - base.b) * mix;  // kék összetevő
      }                                         // for vége
      colors.needsUpdate = true;                // frissítés jelzése
      colorsDirty.current = false;              // kész
    }                                           // if vége
  });                                           // useFrame vége

  return ( // a ruha
    // a ruha csoportja
    <group>
      {/* a ruha hálója a közös geometriával és a pontonként színezett anyaggal */}
      <mesh geometry={geometryRef.current} material={material} />
      {/* az öv csatja: kis fémes doboz a has előtt */}
      {buckle && (
        <mesh position={buckle.position}>{/* a csat helye */}
          {/* 5 × 4 × 0,8 cm-es doboz */}
          <boxGeometry args={[0.05, 0.04, 0.008]} />
          {/* fémes, szürke anyag */}
          <meshStandardMaterial color="#B5B1AC" metalness={0.8} roughness={0.35} />
        </mesh>
      )}
    </group>
  );                                            // return vége
}                                               // komponens vége

export { SEGMENTS };                            // (a pontszámot más modulok is innen érhetik el)
