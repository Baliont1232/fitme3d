// =====================================================================
// fitCalc.test.js – unit tesztek a méretajánlóhoz (futtatás: npm test)
// A seed.sql mérettáblázatait és a demó testprofilt használjuk.
// =====================================================================

import { describe, it, expect } from 'vitest'; // a Vitest tesztkeretrendszer függvényei
import {                                        // a tesztelt függvények
  classifyEase,                                 // egy régió állapota
  evaluateSize,                                 // egy méret kiértékelése
  recommendSize,                                // méretajánlás
  recommendationMessage,                        // a sáv szövege
  describeEvaluation,                           // indoklás
  garmentTypeForCategory,                       // kategória → ruhatípus
} from './fitCalc.js';                          // import vége

const demo = { chest_cm: 100, waist_cm: 86, hip_cm: 100 }; // a seed demó felhasználójának méretei

const basicTee = [                              // Basic pamut póló mérettáblázata (seed.sql)
  { size: 'S', chest_cm: 96, waist_cm: 92, hip_cm: null },   // S
  { size: 'M', chest_cm: 106, waist_cm: 102, hip_cm: null }, // M
  { size: 'L', chest_cm: 116, waist_cm: 112, hip_cm: null }, // L
  { size: 'XL', chest_cm: 126, waist_cm: 122, hip_cm: null }, // XL
];                                              // tömb vége

const slimTee = [                               // Slim fit póló mérettáblázata
  { size: 'S', chest_cm: 92, waist_cm: 86, hip_cm: null },   // S
  { size: 'M', chest_cm: 100, waist_cm: 94, hip_cm: null },  // M
  { size: 'L', chest_cm: 108, waist_cm: 102, hip_cm: null }, // L
  { size: 'XL', chest_cm: 116, waist_cm: 110, hip_cm: null }, // XL
];                                              // tömb vége

const jeans = [                                 // Egyenes szárú farmer mérettáblázata
  { size: 'S', chest_cm: null, waist_cm: 76, hip_cm: 96 },   // S
  { size: 'M', chest_cm: null, waist_cm: 84, hip_cm: 104 },  // M
  { size: 'L', chest_cm: null, waist_cm: 92, hip_cm: 112 },  // L
  { size: 'XL', chest_cm: null, waist_cm: 100, hip_cm: 120 }, // XL
];                                              // tömb vége

describe('classifyEase', () => {                // az állapot-besorolás tesztjei
  const t = { min: 6, max: 16, szukTures: 5, boTures: 10 }; // póló mell küszöbei
  it('a tartományon belül jó', () => {          // teszteset
    expect(classifyEase(10, t).status).toBe('jo'); // 10 cm ráhagyás jó
  });                                           // it vége
  it('negatív ráhagyásnál szorít', () => {      // teszteset
    expect(classifyEase(-2, t).status).toBe('szorit'); // kisebb a ruha, mint a test
  });                                           // it vége
  it('a határ közelében kissé szűk / kissé bő', () => { // teszteset
    expect(classifyEase(3, t).status).toBe('kisse_szuk'); // 6 alatt, de 1 felett
    expect(classifyEase(20, t).status).toBe('kisse_bo');  // 16 felett, de 26 alatt
    expect(classifyEase(30, t).status).toBe('bo');        // 26 felett
  });                                           // it vége
});                                             // describe vége

describe('recommendSize', () => {               // a méretajánló tesztjei
  it('a Basic pólóból M-et ajánl a demó profilnak', () => { // teszteset
    expect(recommendSize(demo, basicTee, 'polo').size).toBe('M'); // várt eredmény: M
  });                                           // it vége
  it('a Slim pólóból egy mérettel nagyobbat (L) ajánl', () => { // teszteset
    expect(recommendSize(demo, slimTee, 'polo').size).toBe('L'); // a szűkebb szabás miatt L
  });                                           // it vége
  it('a farmerből M-et ajánl, derékban kissé szűk indoklással', () => { // teszteset
    const rec = recommendSize(demo, jeans, 'nadrag'); // ajánlás
    expect(rec.size).toBe('M');                 // M méret
    expect(describeEvaluation(rec.best)).toBe('csípőben jó, derékban kissé szűk'); // indoklás
  });                                           // it vége
  it('csak az elérhető méretek közül választ', () => { // teszteset
    expect(recommendSize(demo, basicTee, 'polo', ['L', 'XL']).size).toBe('L'); // M nincs készleten → L
  });                                           // it vége
  it('profil nélkül nincs ajánlás', () => {     // teszteset
    expect(recommendSize(null, basicTee, 'polo')).toBeNull(); // null az eredmény
  });                                           // it vége
});                                             // describe vége

describe('recommendationMessage', () => {       // a sáv szövegének tesztjei
  it('zöld sáv az ajánlott méretnél', () => {   // teszteset
    const rec = recommendSize(demo, basicTee, 'polo'); // ajánlás
    const msg = recommendationMessage(rec, rec.best); // üzenet az ajánlott mérettel
    expect(msg.tone).toBe('success');           // zöld
    expect(msg.text).toBe('Neked az M méret ajánlott – mellben és derékban is jó'); // pontos szöveg
  });                                           // it vége
  it('sárga sáv eltérő méretnél, "Vissza" céllal', () => { // teszteset
    const rec = recommendSize(demo, basicTee, 'polo'); // ajánlás
    const xl = evaluateSize(demo, basicTee[3], 'polo'); // XL kiértékelése
    const msg = recommendationMessage(rec, xl); // üzenet
    expect(msg.tone).toBe('warning');           // sárga
    expect(msg.backTo).toBe('M');               // vissza az M-re
    expect(msg.text).toBe('Az XL derékban bő lehet neked'); // a legrosszabb régió alapján
  });                                           // it vége
});                                             // describe vége

describe('garmentTypeForCategory', () => {      // kategória-leképezés tesztje
  it('a kategórianevekből ruhatípust ad', () => { // teszteset
    expect(garmentTypeForCategory('Pólók')).toBe('polo'); // póló
    expect(garmentTypeForCategory('Nadrágok')).toBe('nadrag'); // nadrág
    expect(garmentTypeForCategory('Ismeretlen')).toBeNull(); // ismeretlen kategória
  });                                           // it vége
});                                             // describe vége
