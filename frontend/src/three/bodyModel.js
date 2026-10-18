// =====================================================================
// bodyModel.js – a paraméteres avatar "receptje"
// A testméretekből (cm, kg) kiszámolja a test kulcsmagasságait és a
// keresztmetszeteit. A mell-, derék- és csípőgyűrű kerülete PONTOSAN a
// megadott érték, így a ruha ráhagyása a 3D-ben is ugyanannyi, mint a
// méretajánlóban. A többi arányt átlagos emberi arányokból becsüljük.
// Mértékegység a 3D térben: méter, a talp a y = 0 síkon áll, arccal +z felé.
// =====================================================================

import * as THREE from 'three';                 // Three.js (vektorokhoz)
import { densifyRings, ringWithCircumference, limbFrame, ringAt, ringCircumference } from './loft.js'; // gyűrűs geometria segédfüggvények

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // érték korlátozása lo és hi közé
const cm = (v) => v / 100;                      // centiméter → méter

export const ARM_ANGLE = THREE.MathUtils.degToRad(11); // a karok 11°-ban eltartva (A-póz), hogy a ruhaujj kiférjen

/**
 * A teljes testmodell kiszámítása egy testprofilból.
 */
export function buildBodyModel(profile) {       // testprofil: gender, height_cm, weight_kg, chest_cm, waist_cm, hip_cm
  const female = Number(profile.gender) === 0;  // nő-e (0 = nő, 1 = férfi)
  const H = cm(profile.height_cm);              // magasság méterben
  const chestC = cm(profile.chest_cm);          // mellbőség méterben
  const waistC = cm(profile.waist_cm);          // derékbőség méterben
  const hipC = cm(profile.hip_cm);              // csípőbőség méterben
  const bmi = profile.weight_kg / (H * H);      // testtömegindex (BMI)
  const fat = clamp((bmi - 22) / 10, -0.6, 1.5); // 0 = átlagos, pozitív = teltebb, negatív = vékonyabb alkat

  // --- Kulcsmagasságok a testmagasság arányában (átlagos emberi arányok) ---
  const L = {                                   // landmarkok (y koordináták, méter)
    ankle: 0.045 * H,                           // boka
    knee: 0.285 * H,                            // térd
    crotch: (female ? 0.462 : 0.47) * H,        // lágyék (ahol a lábak szétválnak)
    hip: (female ? 0.515 : 0.52) * H,           // csípő (legszélesebb pont)
    waist: (female ? 0.615 : 0.605) * H,        // derék
    underbust: 0.68 * H,                        // mell alatt
    chest: 0.72 * H,                            // mellkas (mellbőség mérési helye)
    armpit: 0.745 * H,                          // hónalj
    shoulder: 0.812 * H,                        // váll teteje
    neckBase: 0.842 * H,                        // nyak alja
    neckTop: 0.878 * H,                         // nyak teteje
  };                                            // objektum vége

  // --- Keresztmetszet-formák: a = fél szélesség, bF/bB = mélység előre/hátra (arányok) ---
  const shape = (a, bF, bB, p = 2.3, cz = 0) => ({ a, bF, bB, p, cz }); // rövidítő függvény egy formához
  const hipShape = female ? shape(1, 0.36, 0.47) : shape(1, 0.34, 0.41); // csípő: hátul a fenék miatt mélyebb
  const waistShape = female                      // derék formája
    ? shape(1, 0.36 + fat * 0.06, 0.34)          // nő: kicsit lapos, teltebb alkatnál előre domborodik
    : shape(1, 0.40 + fat * 0.10, 0.36);         // férfi: a has előre domborodik a BMI-vel
  const chestShape = female ? shape(1, 0.47, 0.33, 2.2) : shape(1, 0.37, 0.34, 2.4); // mellkas: nőnél elöl a mell
  const neckC = female ? chestC * 0.37 : chestC * 0.385; // nyak kerülete a mellbőség arányában
  const neckR = neckC / (2 * Math.PI);          // nyak sugara

  const ringC = (y, shp, C) => ({ s: y, ...ringWithCircumference(shp, C) }); // gyűrű adott magasságon, adott kerülettel
  const chestRing = ringC(L.chest, chestShape, chestC); // a mellkas gyűrűje (a kerülete pontosan chestC)
  const chestA = chestRing.a;                   // a mellkas fél szélessége (ebből jön a váll)
  const jointX = Math.max((female ? 0.093 : 0.103) * H, chestA + 0.012); // a vállízület oldaltávolsága

  // --- A törzs kulcsgyűrűi alulról felfelé ---
  const torsoKeys = [                           // kulcsgyűrűk listája
    ringC(L.crotch - 0.012 * H, hipShape, hipC * 0.6),  // a törzs alja a lábak között (kicsi, a lábak takarják)
    ringC(L.crotch + 0.012 * H, hipShape, hipC * 0.9),  // lágyék felett
    ringC(L.hip, hipShape, hipC),                        // CSÍPŐ – pontosan a megadott csípőbőség
    ringC((L.hip + L.waist) / 2, { ...waistShape, bB: (waistShape.bB + hipShape.bB) / 2 }, (hipC + waistC) / 2 + 0.01), // csípő és derék között
    ringC(L.waist, waistShape, waistC),                  // DERÉK – pontosan a megadott derékbőség
    ringC(L.underbust, chestShape.bF > 0.4 ? shape(1, 0.36, 0.33, 2.3) : chestShape, female ? chestC * 0.9 : chestC * 0.95), // mell alatt (nőnél kisebb, a mell miatt)
    chestRing,                                           // MELLKAS – pontosan a megadott mellbőség
    ringC(L.armpit, shape(1, female ? 0.38 : 0.35, 0.34, 2.4), chestC * (female ? 0.95 : 0.985)), // hónalj magasság
    { s: 0.78 * H, a: jointX * 0.93, bF: chestA * 0.31, bB: chestA * 0.31, p: 2.6, cz: 0 },  // felső mellkas, a váll felé szélesedik
    { s: L.shoulder, a: jointX * 0.86, bF: chestA * 0.22, bB: chestA * 0.26, p: 2.5, cz: -0.003 * H }, // váll teteje
    { s: 0.832 * H, a: neckR * 2.0, bF: neckR * 1.05, bB: neckR * 1.3, p: 2.2, cz: -0.004 * H },   // trapézizom (a nyak felé lejt)
    { s: L.neckBase, a: neckR * 1.1, bF: neckR * 1.0, bB: neckR * 1.08, p: 2.0, cz: -0.005 * H },  // nyak alja
    { s: L.neckTop, a: neckR, bF: neckR * 0.98, bB: neckR, p: 2.0, cz: -0.004 * H },               // nyak teteje (a fej takarja)
  ];                                            // tömb vége
  const torso = densifyRings(torsoKeys, 6);     // sűrű, sima gyűrűsor a törzshöz

  // --- Lábak: jobb (+1) és bal (-1) oldal ---
  const hipRing = ringAt(torso, L.hip);         // a csípő gyűrűje a sűrű sorból
  const thighC = hipC * (female ? 0.585 : 0.565); // comb kerülete a csípő arányában
  const kneeC = hipC * 0.37;                    // térd kerülete
  const calfC = hipC * (female ? 0.375 : 0.38); // vádli kerülete
  const ankleC = 0.122 * H * (1 + fat * 0.08);  // boka kerülete (alig függ a súlytól)
  const legShape = shape(1, 0.93, 0.98, 2.05);  // a láb keresztmetszete majdnem kör
  const calfShape = shape(1, 0.86, 1.06, 2.05); // a vádli hátul domborúbb
  const legs = [1, -1].map((side) => {          // mindkét oldalra
    const topX = side * hipRing.a * 0.55;       // a comb teteje oldalra eltolva (a külső széle a csípő vonalát folytatja)
    const ankleX = side * 0.036 * H;            // a boka oldaltávolsága
    const x = (y) => ankleX + (topX - ankleX) * clamp((y - L.ankle) / (L.crotch - L.ankle), 0, 1); // a láb közepe magasság szerint (enyhén befelé dől)
    const legRing = (y, shp, C) => ({ s: y, ...ringWithCircumference(shp, C), cx: x(y) }); // lábgyűrű adott magasságon
    const keys = [                              // kulcsgyűrűk alulról felfelé
      legRing(0.028 * H, legShape, ankleC * 0.98), // boka alja (a lábfej takarja)
      legRing(L.ankle, legShape, ankleC),        // boka
      legRing(0.13 * H, calfShape, calfC * 0.76), // vádli alja
      legRing(0.21 * H, calfShape, calfC),       // vádli legszélesebb része
      legRing(0.255 * H, legShape, kneeC * 1.02), // térd alatt
      legRing(L.knee, legShape, kneeC),          // térd
      legRing(0.31 * H, legShape, kneeC * 1.08), // térd felett
      legRing(0.38 * H, legShape, thighC * 0.86), // comb közepe
      legRing(L.crotch - 0.02 * H, legShape, thighC), // comb teteje
      legRing(L.crotch + 0.022 * H, legShape, thighC * 0.96), // a törzsbe nyúló rész (átfedés, hogy ne legyen rés), de nem lóg ki a csípőnél
    ];                                          // tömb vége
    return { side, dense: densifyRings(keys, 5) }; // sűrű gyűrűsor
  });                                           // map vége

  // --- Karok: a vállízülettől lefelé, ferdén ---
  const upperArmC = chestC * (female ? 0.295 : 0.32); // felkar kerülete
  const elbowC = upperArmC * 0.8;               // könyök
  const forearmC = upperArmC * 0.84;            // alkar
  const wristC = (female ? 0.088 : 0.094) * H * (1 + fat * 0.08); // csukló
  const armShape = shape(1, 1.05, 1.05, 2.0);   // a kar keresztmetszete kicsit mélyebb, mint széles
  const arms = [1, -1].map((side) => {          // mindkét oldalra
    const origin = new THREE.Vector3(side * jointX, 0.806 * H, -0.006 * H); // vállízület helye
    const axis = new THREE.Vector3(side * Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0); // lefelé és kissé kifelé
    const frame = limbFrame(origin, axis);      // a kar saját koordináta-rendszere
    const armRing = (t, C, k = 1) => ({ s: t * H, ...ringWithCircumference({ ...armShape, bF: armShape.bF * k, bB: armShape.bB * k }, C) }); // kargyűrű t*H távolságra a vállól
    const keys = [                              // kulcsgyűrűk a vállól a csuklóig
      armRing(-0.034, upperArmC * 0.5),         // a váll legteteje (lekerekítés)
      armRing(-0.018, upperArmC * 0.92),        // deltaizom teteje
      armRing(0.012, upperArmC * 1.1),          // deltaizom
      armRing(0.07, upperArmC * 1.0),           // felkar
      armRing(0.135, upperArmC * 0.9),          // felkar alja
      armRing(0.188, elbowC),                   // könyök
      armRing(0.235, forearmC, 1.08),           // alkar (kicsit laposabb)
      armRing(0.29, forearmC * 0.8, 1.1),       // alkar alja
      armRing(0.338, wristC, 1.15),             // csukló
    ];                                          // tömb vége
    return { side, frame, dense: densifyRings(keys, 5), caps: { start: -0.007 * H } }; // lekerekített kupak a váll tetején
  });                                           // map vége

  // --- Fej, kezek, lábfejek: egyszerű ellipszoidok ---
  const head = {                                // fej
    center: new THREE.Vector3(0, 0.936 * H, 0.004 * H), // középpont
    radii: new THREE.Vector3(0.0445 * H, 0.066 * H, 0.054 * H), // sugarak: szélesség, magasság, mélység
  };                                            // objektum vége
  const hands = arms.map(({ side, frame }) => ({ // kezek a csukló után
    center: frame.origin.clone().addScaledVector(frame.axis, 0.338 * H + 0.05 * H), // a csuklón túl
    radii: new THREE.Vector3(0.0135 * H, 0.052 * H, 0.026 * H), // vastagság, hossz, szélesség
    rotZ: side * ARM_ANGLE,                     // a kar dőlésszögével elforgatva
  }));                                          // map vége
  const feet = legs.map(({ side }) => ({        // lábfejek
    center: new THREE.Vector3(side * 0.04 * H, 0.021 * H, 0.046 * H), // a boka előtt
    radii: new THREE.Vector3(0.028 * H, 0.021 * H, 0.074 * H), // szélesség, magasság, hossz
  }));                                          // map vége

  return {                                      // a teljes testmodell
    H, female, fat, L, jointX,                  // alapadatok
    torso, legs, arms, head, hands, feet,       // testrészek
    torsoCaps: { start: -0.008 * H },           // a törzs aljának lekerekítése
    measures: { chestC, waistC, hipC },         // a megadott körméretek (méter)
  };                                            // objektum vége
}                                               // függvény vége

/**
 * A test kerülete egy adott helyen (méter): törzsnél magasság, végtagnál tengely menti távolság.
 */
export function bodyCircumference(dense, s) {   // sűrű gyűrűsor és hely
  return ringCircumference(ringAt(dense, s), 64); // a gyűrű kerülete
}                                               // függvény vége
