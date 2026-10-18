// =====================================================================
// CameraRig.jsx – kamera és forgatás (OrbitControls)
// Egérrel / ujjal forgatás, nagyítás, a nyilakkal is forgatható.
// Az "Elöl / Oldal / Hát" gombok a kamerát 400 ms alatt ívben fordítják.
// =====================================================================

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'; // React horgok
import { useFrame, useThree } from '@react-three/fiber'; // képkocka-horog és a jelenet adatai
import { OrbitControls } from '@react-three/drei'; // kész forgató vezérlő
import * as THREE from 'three';                 // Three.js

const VIEW_ANGLES = { front: 0, side: Math.PI / 2, back: Math.PI }; // nézetek vízszintes szöge (0 = szemből)
const easeOut = (t) => 1 - (1 - t) ** 3;        // lassuló átmenet

/**
 * A két szög közötti legrövidebb elfordulás (hogy ne forduljon körbe a hosszabb úton).
 */
function shortestDelta(from, to) {              // kiinduló és cél szög
  let d = (to - from) % (Math.PI * 2);          // a különbség egy körön belül
  if (d > Math.PI) d -= Math.PI * 2;            // ha több mint fél kör, a másik irányba rövidebb
  if (d < -Math.PI) d += Math.PI * 2;           // ugyanez negatív irányban
  return d;                                     // az elfordulás
}                                               // függvény vége

const CameraRig = forwardRef(function CameraRig({ height, config, autoRotate = false, enabled = true }, ref) { // props és a szülőnek adott ref
  const controls = useRef();                    // az OrbitControls példány
  const { camera, size } = useThree();          // a kamera és a vászon mérete
  const anim = useRef(null);                    // a futó kamera-animáció (vagy null)

  const frame = useMemo(() => {                 // a kezdő kameraállás kiszámítása
    const top = height * (1 + config.headroom); // a kép teteje: a fej fölött 8% szabad tér
    const targetY = top / 2;                    // a kép közepe függőlegesen
    const halfFov = THREE.MathUtils.degToRad(config.fov / 2); // a látószög fele radiánban
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.2); // a vászon képaránya
    const byHeight = (top / 2) * 1.04 / Math.tan(halfFov); // ennyire kell hátrálni, hogy a teljes magasság beférjen
    const byWidth = (height * 0.36) / (Math.tan(halfFov) * aspect); // keskeny vásznon a szélesség is számít
    const distance = Math.max(byHeight, byWidth); // a kettő közül a nagyobb
    const eyeY = height * 0.72;                 // a kamera a mellkas magasságában van
    return { targetY, distance, eyeY };         // kezdő adatok
  }, [height, size.width, size.height, config]); // újraszámolás, ha változik a magasság vagy a vászon

  useEffect(() => {                             // a kamera alaphelyzetbe állítása, ha a keret változik
    const dy = frame.eyeY - frame.targetY;      // a kamera ennyivel van a célpont fölött
    const horizontal = Math.sqrt(Math.max(frame.distance ** 2 - dy ** 2, 0.01)); // vízszintes távolság
    camera.position.set(0, frame.eyeY, horizontal); // szemből
    camera.fov = config.fov;                    // látószög
    camera.near = 0.05;                         // a közeli vágósík
    camera.far = 50;                            // a távoli vágósík
    camera.updateProjectionMatrix();            // a beállítások érvényesítése
    controls.current?.target.set(0, frame.targetY, 0); // a forgatás középpontja
    controls.current?.update();                 // a vezérlő frissítése
  }, [frame, camera, config.fov]);              // függőségek

  /**
   * Animáció indítása egy új vízszintes szögre és/vagy távolságra.
   */
  const animateTo = (azimuth, distance) => {    // cél szög és cél távolság
    const c = controls.current;                 // vezérlő
    if (!c) return;                             // ha még nincs, nincs mit tenni
    const offset = camera.position.clone().sub(c.target); // a kamera helye a célponthoz képest
    const sph = new THREE.Spherical().setFromVector3(offset); // gömbi koordinátákká alakítva (távolság, szögek)
    anim.current = {                            // az animáció adatai
      fromTheta: sph.theta,                     // kezdő vízszintes szög
      dTheta: azimuth == null ? 0 : shortestDelta(sph.theta, azimuth), // elfordulás
      fromR: sph.radius,                        // kezdő távolság
      toR: distance ?? sph.radius,              // cél távolság
      phi: sph.phi,                             // függőleges szög (nem változik)
      start: performance.now() / 1000,          // kezdés
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.001 : 0.4, // 400 ms, csökkentett mozgásnál azonnal
    };                                          // objektum vége
  };                                            // függvény vége

  useImperativeHandle(ref, () => ({             // a szülő komponens ezeket a függvényeket hívhatja
    view: (name) => animateTo(VIEW_ANGLES[name], null), // nézetgomb: Elöl / Oldal / Hát
    zoom: (factor) => {                         // nagyítás: factor < 1 közelebb, > 1 távolabb
      const c = controls.current;               // vezérlő
      if (!c) return;                           // ha nincs, kilépünk
      const r = camera.position.distanceTo(c.target) * factor; // új távolság
      animateTo(null, THREE.MathUtils.clamp(r, c.minDistance, c.maxDistance)); // a határokon belül
    },                                          // zoom vége
    reset: () => animateTo(0, frame.distance),  // alaphelyzet: szemből, eredeti távolság
    rotateBy: (deg) => {                        // elforgatás fokban (billentyűzethez)
      const c = controls.current;               // vezérlő
      if (!c) return;                           // ha nincs, kilépünk
      animateTo(c.getAzimuthalAngle() + THREE.MathUtils.degToRad(deg), null); // a mostani szöghöz képest
    },                                          // rotateBy vége
  }), [camera, frame.distance]);                // függőségek

  useFrame(() => {                              // képkockánként
    const a = anim.current;                     // futó animáció
    const c = controls.current;                 // vezérlő
    if (!a || !c) return;                       // ha nincs animáció, nincs teendő
    const t = Math.min(1, (performance.now() / 1000 - a.start) / a.duration); // eltelt arány
    const k = easeOut(t);                       // lassuló görbe
    const sph = new THREE.Spherical(a.fromR + (a.toR - a.fromR) * k, a.phi, a.fromTheta + a.dTheta * k); // a köztes kameraállás
    camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(sph)); // a kamera oda kerül
    c.update();                                 // a vezérlő frissítése
    if (t >= 1) anim.current = null;            // vége
  });                                           // useFrame vége

  return ( // a forgató vezérlő
    // forgató vezérlő: nincs eltolás, csillapított mozgás, a terv szerinti határok
    <OrbitControls
      ref={controls} // a példány elérése a fenti függvényekből
      makeDefault // ez lesz a jelenet alapértelmezett vezérlője
      enabled={enabled} // ki/be kapcsolható (a kezdőlapon csak forog)
      enablePan={false} // eltolás tiltva, az avatar mindig középen marad
      enableDamping // csillapítás: a forgatás finoman áll meg
      dampingFactor={0.1} // a csillapítás mértéke
      minPolarAngle={config.polar[0]} // nem lehet felülről nézni (70°)
      maxPolarAngle={config.polar[1]} // nem lehet alulról nézni (100°)
      minDistance={frame.distance / config.zoom[1]} // legnagyobb nagyítás: 2×
      maxDistance={frame.distance / config.zoom[0]} // legkisebb nagyítás: 0,8×
      autoRotate={autoRotate} // automatikus forgás (kezdőlap)
      autoRotateSpeed={60 / config.autoRotateSeconds} // 2,0 = 30 mp/kör, ebből számolva 20 mp/kör
      target={[0, frame.targetY, 0]} // a forgatás középpontja
    />
  );                                            // return vége
});                                             // komponens vége

export default CameraRig;                       // alapértelmezett export
