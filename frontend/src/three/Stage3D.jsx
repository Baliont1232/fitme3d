// =====================================================================
// Stage3D.jsx – a 3D vászon: avatar + ruhák + fények + vezérlők
// Ezt használja a kezdőlap (forgó avatar), az avatar készítő (élő
// előnézet) és a próbafülke (ruha, illeszkedési térkép, nézetgombok).
// =====================================================================

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'; // React horgok
import { Canvas } from '@react-three/fiber';    // a 3D vászon React komponense
import { ContactShadows } from '@react-three/drei'; // puha árnyék a talp alatt
import * as THREE from 'three';                 // Three.js
import { Minus, Plus, RotateCcw, Layers } from 'lucide-react'; // ikonok
import { useHuman } from './useHuman.js';      // a valódi emberi avatar (MakeHuman) a méretekből
import { buildGarment, LAYER_ORDER } from './garments.js'; // ruhák a test felületéből
import { sceneConfig, prefersReducedMotion, hasWebGL } from './sceneConfig.js'; // jelenet beállítások
import AvatarBody from './AvatarBody.jsx';      // az avatar teste
import GarmentMesh from './GarmentMesh.jsx';    // egy ruhadarab
import CameraRig from './CameraRig.jsx';        // kamera és forgatás

const HINT_KEY = 'fitme3d_forgatas_sugo';       // ezzel a kulccsal jegyezzük meg, hogy a súgót már látta

/**
 * A jelenet tartalma (a vásznon belül): fények, árnyék, avatar, ruhák, kamera.
 */
function Scene({ human, height, dressed, fitMap, faded, config, rigRef, autoRotate, interactive }) { // props
  return ( // a jelenet elemei
    <>
      {/* háttérszín: semleges szürke a színhű ruhamegjelenítéshez */}
      <color attach="background" args={[config.background]} />
      {/* félgömb fény: fentről fehér, lentről szürkés */}
      <hemisphereLight args={[config.hemisphere.sky, config.hemisphere.ground, config.hemisphere.intensity]} />
      {/* fő fény elölről-balról, felülről */}
      <directionalLight position={config.keyLight.position} intensity={config.keyLight.intensity} />
      {/* gyenge derítőfény hátulról */}
      <directionalLight position={config.fillLight.position} intensity={config.fillLight.intensity} />
      {/* az avatar teste (térképnél halványabb); amíg töltődik, nincs test */}
      {human && <AvatarBody human={human} color={config.avatarColor} roughness={config.avatarRoughness} faded={faded || fitMap} />}
      {/* a ruhák a rétegsorrendben */}
      {dressed.map((g) => (
        <GarmentMesh // egy ruha a jelenetben
          key={g.type} // típusonként egy háló; méretváltáskor ugyanaz marad, így animálható
          garment={g.garment} // a ruha formája (pontok, háromszögek, térkép súlyok)
          color={g.color} // a választott szín
          evaluation={g.evaluation} // a méret kiértékelése (a térkép színeihez)
          fitMap={fitMap} // térkép be/ki
          config={config} // beállítások
        />
      ))}
      {/* puha kontaktárnyék a talp alatt */}
      <ContactShadows position={[0, 0.001, 0]} opacity={config.shadow.opacity} scale={config.shadow.scale} blur={config.shadow.blur} far={config.shadow.far} resolution={512} />
      {/* kamera és forgatás */}
      <CameraRig ref={rigRef} height={height} config={config} autoRotate={autoRotate} enabled={interactive} />
    </>
  );                                            // return vége
}                                               // komponens vége

/**
 * A teljes 3D vászon a vezérlőgombokkal.
 * profile: testméretek; garments: [{ type, chartRow, color, evaluation }];
 * controls: nézet- és nagyítógombok; onToggleFitMap: ha meg van adva, látszik a térkép kapcsoló.
 */
export default function Stage3D({                // props
  profile,                                      // testprofil
  garments = [],                                // felpróbált ruhák
  fitMap = false,                               // illeszkedési térkép be van-e kapcsolva
  onToggleFitMap = null,                        // térkép kapcsoló kezelője
  controls = true,                              // látszanak-e a vezérlőgombok
  autoRotate = false,                           // forogjon-e magától
  interactive = true,                           // forgatható-e kézzel
  faded = false,                                // halvány avatar (pl. "nincs avatar" állapot)
  label = '3D avatar',                          // képernyőolvasó szöveg
  className = '',                               // extra CSS osztály
  children,                                     // extra rátét (pl. jelmagyarázat)
}) {                                            // paraméterlista vége
  const config = useMemo(() => sceneConfig(), []); // a beállítások egyszer kiolvasva
  const rigRef = useRef(null);                  // a kamera vezérlő függvényei
  const [webgl] = useState(() => hasWebGL());   // tud-e a böngésző 3D-t
  const [showHint, setShowHint] = useState(false); // látszik-e a "Húzd a forgatáshoz" súgó

  const { human, loading } = useHuman(profile); // a valódi avatar (amíg töltődik: null)
  const height = Number(profile?.height_cm ?? 175) / 100; // a magasság a kamerához (már töltés közben is tudjuk)

  const shapeKey = garments.map((g) => `${g.type}:${JSON.stringify(g.chartRow)}`).join('|'); // a ruhák formáját meghatározó adatok
  const dressedShapes = useMemo(() => {         // a ruhák geometriája (szín- és térképváltáskor NEM számol újra)
    if (!human) return [];                      // amíg nincs avatar, nincs ruha
    const sorted = [...garments].sort((a, b) => (LAYER_ORDER[a.type] ?? 0) - (LAYER_ORDER[b.type] ?? 0)); // belső rétegek előre
    let under = null;                           // az eddig felvett rétegek eltolása pontonként
    const out = [];                             // az eredmény
    for (const g of sorted) {                   // minden ruhára
      const garment = buildGarment(human, g.type, g.chartRow, under); // a ruha a test felületéből
      if (!garment) continue;                   // ha nem sikerült (pl. nincs méret), kihagyjuk
      out.push({ type: g.type, garment });      // eltároljuk
      if (!under) under = new Float32Array(human.nBody); // az első réteg után létrehozzuk
      for (let i = 0; i < under.length; i++) under[i] = Math.max(under[i], garment.offsets[i]); // a következő réteg ezek fölé kerül
    }                                           // for vége
    return out;                                 // a ruhák formája
  }, [human, shapeKey]);                        // eslint-disable-line react-hooks/exhaustive-deps
  const dressed = dressedShapes.map((d) => {    // a formához hozzátesszük a színt és a kiértékelést
    const g = garments.find((x) => x.type === d.type); // az eredeti ruha adatai
    return { ...d, color: g?.color ?? '#999999', evaluation: g?.evaluation ?? null }; // szín és kiértékelés
  });                                           // map vége

  useEffect(() => {                             // a súgó megjelenítése az első látogatáskor
    if (!controls) return;                      // csak az interaktív vásznon
    let seen = false;                           // látta-e már
    try { seen = localStorage.getItem(HINT_KEY) === '1'; } catch { /* privát módban a tároló nem elérhető */ } // kiolvasás
    if (seen) return;                           // ha már látta, nincs súgó
    setShowHint(true);                          // megjelenítés
    const timer = setTimeout(() => {            // 3 másodperc múlva...
      setShowHint(false);                       // ...eltűnik
      try { localStorage.setItem(HINT_KEY, '1'); } catch { /* nem baj, ha nem sikerül */ } // megjegyezzük
    }, 3000);                                   // 3000 ms
    return () => clearTimeout(timer);           // takarítás, ha közben eltűnik a komponens
  }, [controls]);                               // függőség

  const onKeyDown = (e) => {                    // billentyűzet: a nyilakkal forgatható (akadálymentesség)
    if (e.key === 'ArrowLeft') { e.preventDefault(); rigRef.current?.rotateBy(-20); } // balra 20°
    if (e.key === 'ArrowRight') { e.preventDefault(); rigRef.current?.rotateBy(20); } // jobbra 20°
    if (e.key === '+') rigRef.current?.zoom(0.8); // nagyítás
    if (e.key === '-') rigRef.current?.zoom(1.25); // kicsinyítés
  };                                            // függvény vége

  if (!webgl) {                                 // ha nincs WebGL: a UI terv 8. fejezetének szövege
    return ( // szöveges tartalék
      <div className={`stage stage--fallback ${className}`}>{/* a vászon helyén üzenet */}
        <p>Ezen az eszközön a 3D próba nem érhető el, a méretajánló így is működik.</p>{/* UI terv 8. fejezet szövege */}
        {children}{/* a rátét (pl. "nincs avatar" kártya) */}
      </div>
    );                                          // return vége
  }                                             // if vége

  return ( // a vászon a vezérlőkkel
    <div // a vászon kerete
      className={`stage ${className}`} // a vászon kerete
      tabIndex={controls ? 0 : -1} // Tab-bal elérhető, ha interaktív
      onKeyDown={controls ? onKeyDown : undefined} // billentyűkezelés
      role="img" // képernyőolvasónak: ez egy kép
      aria-label={label} // a kép leírása (pl. "Avatar a Basic pólóban, M méret")
    >{/* a nyitó címke vége */}
      {/* a 3D vászon; a dpr a nagy felbontású kijelzőkhöz (max. 2×) */}
      <Canvas
        dpr={[1, 2]} // képpontsűrűség határai
        camera={{ fov: config.fov, position: [0, 1.3, 3.5] }} // kezdő kamera (a CameraRig rögtön beállítja)
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: config.exposure, outputColorSpace: THREE.SRGBColorSpace, preserveDrawingBuffer: true }} // ACES tónusleképezés, sRGB kimenet
      >{/* a nyitó címke vége */}
        <Suspense fallback={null}>{/* amíg valami töltődik, nem rajzol semmit */}
          <Scene human={human} height={height} dressed={dressed} fitMap={fitMap} faded={faded} config={config} rigRef={rigRef} autoRotate={autoRotate && !prefersReducedMotion()} interactive={interactive} />{/* a jelenet tartalma */}
        </Suspense>
      </Canvas>

      {controls && ( // a vezérlőgombok csak interaktív módban
        <>
          {/* bal felső sarok: nézetgombok */}
          <div className="stage__views" role="group" aria-label="Nézet">
            <button type="button" className="chip-btn" onClick={() => rigRef.current?.view('front')}>Elöl</button>{/* szemből */}
            <button type="button" className="chip-btn" onClick={() => rigRef.current?.view('side')}>Oldal</button>{/* oldalról */}
            <button type="button" className="chip-btn" onClick={() => rigRef.current?.view('back')}>Hát</button>{/* hátulról */}
          </div>
          {/* jobb felső sarok: térkép kapcsoló, nagyítás, alaphelyzet */}
          <div className="stage__tools">
            {onToggleFitMap && ( // térkép kapcsoló (ha a szülő kéri)
              <button type="button" className={`chip-btn ${fitMap ? 'is-on' : ''}`} aria-pressed={fitMap} onClick={onToggleFitMap}>{/* be/ki kapcsoló gomb */}
                <Layers size={16} aria-hidden="true" /> Illeszkedési térkép{/* ikon és felirat */}
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="Nagyítás" onClick={() => rigRef.current?.zoom(0.8)}><Plus size={18} /></button>{/* nagyítás */}
            <button type="button" className="icon-btn" aria-label="Kicsinyítés" onClick={() => rigRef.current?.zoom(1.25)}><Minus size={18} /></button>{/* kicsinyítés */}
            <button type="button" className="icon-btn" aria-label="Alaphelyzet" onClick={() => rigRef.current?.reset()}><RotateCcw size={18} /></button>{/* alaphelyzet */}
          </div>
        </>
      )}
      {/* az avatar adatcsomag töltése közben */}
      {loading && <div className="stage__loading" role="status">Avatar betöltése…</div>}
      {/* első látogatáskor 3 mp-ig látható súgó */}
      {showHint && <div className="stage__hint" aria-hidden="true">Húzd a forgatáshoz</div>}
      {/* extra rátét (pl. jelmagyarázat, "nincs avatar" kártya) */}
      {children}
    </div>
  );                                            // return vége
}                                               // komponens vége
