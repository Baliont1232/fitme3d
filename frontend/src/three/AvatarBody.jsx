// =====================================================================
// AvatarBody.jsx – az avatar teste a jelenetben (MakeHuman alapmodell)
// A háromszögek sosem változnak, ezért egyetlen geometriát tartunk meg,
// és méretváltáskor csak a pontok helyét írjuk felül (gyors, nincs villanás).
// =====================================================================

import { useEffect, useMemo } from 'react';     // React horgok
import * as THREE from 'three';                 // Three.js

/**
 * A test. 'human' a buildHuman eredménye, 'faded' = 10%-kal halványabb (térkép bekapcsolva).
 */
export default function AvatarBody({ human, color, roughness = 0.9, faded = false }) { // props
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness }), [roughness]); // matt anyag
  useEffect(() => {                             // a szín beállítása
    const c = new THREE.Color(color);           // a token színe
    if (faded) c.lerp(new THREE.Color('#FFFFFF'), 0.1); // térképnél világosabb (design terv 6.1)
    material.color.copy(c);                     // az anyag színe
  }, [material, color, faded]);                 // függőségek
  useEffect(() => () => material.dispose(), [material]); // felszabadítás

  const geometry = useMemo(() => {              // a geometria egyszer jön létre (a háromszögek állandók)
    const g = new THREE.BufferGeometry();       // új geometria
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(human.nBody * 3), 3)); // a pontok helye
    g.setIndex(new THREE.BufferAttribute(human.index, 1)); // háromszögek
    return g;                                   // kész
  }, [human.index, human.nBody]);               // csak ha más az alapháló
  useEffect(() => () => geometry.dispose(), [geometry]); // felszabadítás

  useEffect(() => {                             // új testméretek: a pontok frissítése
    const pos = geometry.getAttribute('position'); // a pontok tömbje
    pos.array.set(human.positions.subarray(0, human.nBody * 3)); // a test pontjai (az ízületi segédpontok nélkül)
    pos.needsUpdate = true;                     // jelezzük a videókártyának
    geometry.computeVertexNormals();            // fényezéshez a felület irányai
    geometry.computeBoundingSphere();           // befoglaló gömb
  }, [geometry, human]);                        // függőségek

  return (                                      // a megjelenítendő elem
    // a test hálója
    <mesh geometry={geometry} material={material} name="avatar" />
  );                                            // return vége
}                                               // komponens vége
