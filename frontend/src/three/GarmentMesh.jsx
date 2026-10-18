// =====================================================================
// GarmentMesh.jsx – egy ruhadarab a jelenetben
// - méretváltáskor a ruha 200 ms alatt "átúszik" az új formára
// - színváltáskor csak a szín cserélődik, a forma nem épül újra
// - az illeszkedési térkép be/kikapcsolása 200 ms-os áttűnés
// A forma a garments.js buildGarment függvényéből jön.
// =====================================================================

import { useEffect, useMemo, useRef } from 'react'; // React horgok
import { useFrame } from '@react-three/fiber';  // képkockánként lefutó függvény (animáció)
import * as THREE from 'three';                 // Three.js

const DURATION = 0.2;                           // animációk hossza: 200 ms (UI terv 11. fejezet)
const easeOut = (t) => 1 - (1 - t) ** 3;        // lassuló átmenet (ease-out)

/**
 * A ruha. garment = buildGarment eredménye, evaluation = a kiválasztott méret kiértékelése.
 */
export default function GarmentMesh({ garment, color, evaluation, fitMap, config }) { // props
  const geometryRef = useRef(new THREE.BufferGeometry()); // a ruha geometriája (egyszer jön létre, utána csak frissül)
  const anim = useRef({ from: null, to: null, start: 0, active: false }); // a forma-animáció állapota
  const blend = useRef({ value: fitMap ? 1 : 0, target: fitMap ? 1 : 0 }); // a térkép áttűnése (0 = ki, 1 = be)
  const colorsDirty = useRef(true);             // kell-e újraszámolni a színeket

  const material = useMemo(() => new THREE.MeshStandardMaterial({ // a ruha anyaga
    vertexColors: true,                         // a szín pontonként jön (így lehet a térkép színátmenetes)
    roughness: config.garmentRoughness,         // matt
    side: THREE.DoubleSide,                     // a belseje is látszik (pl. az ujj nyílásán át)
  }), [config.garmentRoughness]);               // egyszer jön létre
  useEffect(() => () => material.dispose(), [material]); // felszabadítás

  useEffect(() => {                             // új forma jött (méret- vagy testváltás)
    const geometry = geometryRef.current;       // a meglévő geometria
    const current = geometry.getAttribute('position'); // a jelenlegi pontok (ha vannak)
    if (current && current.count === garment.count) { // ugyanannyi pont: animálunk
      anim.current = {                          // az animáció beállítása
        from: Float32Array.from(current.array), // honnan: a mostani (akár félúton lévő) forma másolata
        to: garment.positions,                  // hová: az új forma
        start: performance.now() / 1000,        // kezdés ideje
        active: true,                           // fut
      };                                        // objektum vége
    } else {                                    // első megjelenés vagy más pontszám: azonnal beállítjuk
      geometry.setAttribute('position', new THREE.BufferAttribute(garment.positions.slice(), 3)); // pontok
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(garment.count * 3), 3)); // színek helye
      geometry.setIndex(new THREE.BufferAttribute(garment.index, 1)); // háromszögek
      geometry.computeVertexNormals();          // normálvektorok
      geometry.computeBoundingSphere();         // befoglaló gömb
      anim.current.active = false;              // nincs animáció
    }                                           // if-else vége
    colorsDirty.current = true;                 // újra kell színezni
  }, [garment]);                                // függőség: az új forma

  useEffect(() => { colorsDirty.current = true; }, [color, evaluation]); // szín vagy illeszkedés változott
  useEffect(() => { blend.current.target = fitMap ? 1 : 0; }, [fitMap]); // térkép kapcsoló
  useEffect(() => () => geometryRef.current.dispose(), []); // felszabadítás a végén

  const palette = useMemo(() => {               // a használt színek THREE.Color formában
    const statusColor = { success: new THREE.Color(config.fit.success), warning: new THREE.Color(config.fit.warning), danger: new THREE.Color(config.fit.danger) }; // a három állapotszín
    const byRegion = {};                        // régió → állapot színe
    for (const r of evaluation?.regions ?? []) byRegion[r.region] = statusColor[r.level]; // pl. waist → sárga
    return { base: new THREE.Color(color), byRegion }; // alapszín és régiószínek
  }, [color, evaluation, config]);              // függőségek

  useFrame(() => {                              // minden képkockánál
    const geometry = geometryRef.current;       // a geometria
    const a = anim.current;                     // forma-animáció
    if (a.active) {                             // ha épp animálunk
      const t = Math.min(1, (performance.now() / 1000 - a.start) / DURATION); // eltelt idő aránya
      const k = easeOut(t);                     // lassuló görbe
      const pos = geometry.getAttribute('position'); // a pontok
      for (let i = 0; i < pos.array.length; i++) pos.array[i] = a.from[i] + (a.to[i] - a.from[i]) * k; // régi és új között
      pos.needsUpdate = true;                   // frissítés jelzése
      geometry.computeVertexNormals();          // a fényezés is kövesse a formát
      if (t >= 1) { a.active = false; geometry.computeBoundingSphere(); } // vége
    }                                           // if vége

    const b = blend.current;                    // térkép áttűnés
    if (b.value !== b.target) {                 // ha még nem érte el a célt
      const step = 1 / (60 * DURATION);         // képkockánkénti lépés (kb. 200 ms alatt ér át)
      b.value = b.target > b.value ? Math.min(b.target, b.value + step) : Math.max(b.target, b.value - step); // közelítés
      colorsDirty.current = true;               // újraszínezés kell
    }                                           // if vége

    if (colorsDirty.current) {                  // ha újra kell színezni
      const colors = geometry.getAttribute('color'); // a színek tömbje
      if (!colors) return;                      // még nincs geometria
      const w = garment.weights;                // térkép súlyok (mell, derék, csípő, semleges)
      const mix = config.fitMix * b.value;      // mennyire keverjük be a térkép színét (max. 75%)
      const { base, byRegion } = palette;       // színek
      const regionList = [byRegion.chest, byRegion.waist, byRegion.hip]; // a súlyok sorrendjében
      for (let i = 0; i < garment.count; i++) { // minden pontra
        let r = 0; let g = 0; let bl = 0;       // a térkép szerinti szín
        for (let k = 0; k < 3; k++) {           // a három régióra
          const weight = w[i * 4 + k];          // a pont súlya a régióban
          const c = regionList[k] ?? base;      // a régió színe (ha nincs mérve, az alapszín)
          r += c.r * weight; g += c.g * weight; bl += c.b * weight; // súlyozott összeg
        }                                       // for vége
        const neutral = w[i * 4 + 3];           // semleges súly
        r += base.r * neutral; g += base.g * neutral; bl += base.b * neutral; // a semleges rész az alapszín
        colors.array[i * 3] = base.r + (r - base.r) * mix; // piros összetevő
        colors.array[i * 3 + 1] = base.g + (g - base.g) * mix; // zöld összetevő
        colors.array[i * 3 + 2] = base.b + (bl - base.b) * mix; // kék összetevő
      }                                         // for vége
      colors.needsUpdate = true;                // frissítés jelzése
      colorsDirty.current = false;              // kész
    }                                           // if vége
  });                                           // useFrame vége

  return (                                      // a megjelenítendő elemek
    // a ruha csoportja
    <group>
      {/* a ruha hálója */}
      <mesh geometry={geometryRef.current} material={material} />
      {/* az öv csatja: kis fémes doboz a has előtt */}
      {garment.buckle && (
        // a csat hálója a csat helyén
        <mesh position={garment.buckle.position}>
          {/* 5 × 4 × 0,8 cm-es doboz */}
          <boxGeometry args={[0.05, 0.04, 0.008]} />
          {/* fémes, szürke anyag */}
          <meshStandardMaterial color="#B5B1AC" metalness={0.8} roughness={0.35} />
        </mesh>
      )}
    </group>
  );                                            // return vége
}                                               // komponens vége
