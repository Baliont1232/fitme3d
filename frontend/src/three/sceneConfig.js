// =====================================================================
// sceneConfig.js – a 3D jelenet beállításai a Design terv 6. fejezete szerint
// A színeket a tokens.css-ből olvassuk ki, így a felület és a 3D vászon
// ugyanazt a színt használja, és csak egy helyen kell módosítani.
// =====================================================================

import * as THREE from 'three';                 // Three.js

/**
 * Egy CSS változó (design token) értéke, pl. cssVar('--color-success').
 * Ha a böngészőn kívül futunk (pl. teszt), a megadott alapértéket adja.
 */
export function cssVar(name, fallback) {        // a token neve és alapérték
  if (typeof window === 'undefined') return fallback; // nincs böngésző (teszt): alapérték
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); // a :root-on beállított érték
  return value || fallback;                     // ha üres, az alapérték
}                                               // függvény vége

/**
 * A jelenet összes beállítása. Függvény, mert a CSS csak az oldal betöltése után olvasható.
 */
export function sceneConfig() {                 // objektumot ad vissza
  return {                                      // beállítások
    background: cssVar('--color-canvas-3d', '#ECEDEF'), // vászon háttér: semleges szürke
    avatarColor: cssVar('--color-avatar-3d', '#D6D3D1'), // az avatar matt, meleg szürke színe
    avatarRoughness: 0.9,                       // matt felület (nem csillog)
    garmentRoughness: 0.8,                      // a ruha anyaga is matt
    hemisphere: { sky: '#FFFFFF', ground: '#D4D4D8', intensity: 0.9 }, // félgömb fény: fentről fehér, lentről szürkés
    keyLight: { position: [-2.2, 3.2, 2.6], intensity: 1.2 }, // fő fény elölről-balról, 45°-ban felülről
    fillLight: { position: [2.5, 1.6, -2.0], intensity: 0.35 }, // gyenge derítőfény hátulról, hogy a hát se legyen fekete
    shadow: { opacity: 0.35, blur: 2.4, scale: 2.2, far: 1.2 }, // puha kontaktárnyék a talp alatt
    exposure: 1.0,                              // expozíció
    fov: 35,                                    // kamera látószöge fokban
    headroom: 0.08,                             // 8% szabad tér a fej fölött
    polar: [THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(100)], // függőleges forgatás határai
    zoom: [0.8, 2],                             // nagyítás határai (0,8× – 2×)
    fitMix: 0.75,                               // az illeszkedési szín 75%-ban keveredik a ruha színével
    fit: {                                      // a térkép színei a felület tokenjeiből
      success: cssVar('--color-success', '#1F9D61'), // zöld: jó
      warning: cssVar('--color-warning', '#F2A516'), // sárga: kissé szűk/bő
      danger: cssVar('--color-danger', '#D92D20'),   // piros: szorít
    },                                          // fit vége
    autoRotateSeconds: 20,                      // a kezdőlapi avatar 20 mp alatt fordul körbe
  };                                            // objektum vége
}                                               // függvény vége

/**
 * Igaz, ha a felhasználó a rendszerben "csökkentett mozgást" kért (akkor nincs automatikus forgás).
 */
export function prefersReducedMotion() {        // logikai értéket ad
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // a média lekérdezés eredménye
}                                               // függvény vége

/**
 * Ellenőrzi, hogy a böngésző tud-e WebGL-t (3D rajzolást).
 */
export function hasWebGL() {                    // logikai értéket ad
  try {                                         // a teszt hibát dobhat
    const canvas = document.createElement('canvas'); // ideiglenes vászon
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); // van-e 3D környezet
  } catch {                                     // ha hiba volt
    return false;                               // nincs WebGL
  }                                             // try-catch vége
}                                               // függvény vége
