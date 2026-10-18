// =====================================================================
// AvatarBody.jsx – az avatar teste a jelenetben (törzs, lábak, karok,
// fej, kezek, lábfejek). Minden testméret-változásnál azonnal újraépül.
// =====================================================================

import { useEffect, useMemo } from 'react';     // React horgok: memorizálás és mellékhatás
import * as THREE from 'three';                 // Three.js
import { buildRingGeometry } from './loft.js';  // gyűrűkből geometria

/**
 * Egy ellipszoid (nyújtott gömb) a fejhez, kezekhez, lábfejekhez.
 */
function Ellipsoid({ center, radii, rotZ = 0, material }) { // középpont, sugarak, elforgatás, anyag
  // JSX: a Three.js objektumok React komponensként. FIGYELEM: a 3D fában nem lehet szóköz a
  // címkék között egy sorban, ezért a megjegyzések mindig külön sorban állnak.
  return (
    // háló a megadott helyen, elforgatva és nyújtva
    <mesh position={center} rotation={[0, 0, rotZ]} scale={radii} material={material}>
      {/* egységgömb 32×20 szegmensből, a scale nyújtja ellipszoiddá */}
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  );                                            // return vége
}                                               // komponens vége

/**
 * A teljes test. 'body' a buildBodyModel eredménye, 'faded' = halványabb (térkép bekapcsolva).
 */
export default function AvatarBody({ body, color, roughness = 0.9, faded = false }) { // props
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness }), [roughness]); // egyetlen közös, matt anyag
  useEffect(() => {                             // a szín beállítása, ha változik
    const c = new THREE.Color(color);           // a token színe
    if (faded) c.lerp(new THREE.Color('#FFFFFF'), 0.1); // térképnél 10%-kal világosabb (design terv 6.1)
    material.color.copy(c);                     // az anyag színe
  }, [material, color, faded]);                 // függőségek
  useEffect(() => () => material.dispose(), [material]); // az anyag felszabadítása, ha a komponens eltűnik

  const geometries = useMemo(() => {            // a test geometriái (csak ha a testmodell változik)
    const list = [buildRingGeometry(body.torso, undefined, body.torsoCaps)]; // törzs, alul lekerekítve
    for (const leg of body.legs) list.push(buildRingGeometry(leg.dense)); // két láb
    for (const arm of body.arms) list.push(buildRingGeometry(arm.dense, arm.frame, arm.caps)); // két kar a saját ferde keretükben
    return list;                                // a lista
  }, [body]);                                   // függőség: a testmodell
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]); // a régi geometriák felszabadítása (memória)

  return ( // a test elemei
    // a test elemei egy csoportba rendezve
    <group name="avatar">
      {/* minden geometriához egy háló a közös anyaggal (törzs, 2 láb, 2 kar) */}
      {geometries.map((g, i) => <mesh key={i} geometry={g} material={material} />)}
      {/* fej */}
      <Ellipsoid center={body.head.center} radii={body.head.radii} material={material} />
      {/* két kéz */}
      {body.hands.map((h, i) => <Ellipsoid key={`h${i}`} {...h} material={material} />)}
      {/* két lábfej */}
      {body.feet.map((f, i) => <Ellipsoid key={`f${i}`} {...f} material={material} />)}
    </group>
  );                                            // return vége
}                                               // komponens vége
