// =====================================================================
// fitCalc.js – a méretajánló és az illeszkedési térkép KÖZÖS számítása
// (3D megvalósítási terv 5. és 6. fejezet). Egyetlen helyen van, hogy a
// térkép színe és az ajánlott méret soha ne mondjon ellent egymásnak.
// =====================================================================

import fitConfig from '../../../shared/fit-config.json'; // a közös konfiguráció (ugyanezt olvassa a PHP is)

export const REGIONS = ['chest', 'waist', 'hip']; // a mért testrégiók, felülről lefelé

// Az illeszkedés öt lehetséges állapota, mindegyikhez a színe (design token neve) és a szövege
export const FIT_STATUS = {                     // állapotok táblázata
  szorit: { level: 'danger', label: 'szorít', rank: 4 },      // piros: túl kicsi a ruha
  kisse_szuk: { level: 'warning', label: 'kissé szűk', rank: 2 }, // sárga: a tartomány alsó szélén
  jo: { level: 'success', label: 'jó', rank: 0 },             // zöld: a kívánt tartományban
  kisse_bo: { level: 'warning', label: 'kissé bő', rank: 1 },  // sárga: a tartomány felső szélén
  bo: { level: 'warning', label: 'bő', rank: 3 },             // sárga: jóval nagyobb a kelleténél
};                                              // objektum vége

/**
 * Melyik 3D ruhatípus tartozik egy kategóriához (pl. 'Pólók' → 'polo').
 */
export function garmentTypeForCategory(categoryName) { // kategória nevet kap
  return fitConfig.kategoriak[categoryName]?.ruhaTipus ?? null; // a konfigurációból, vagy null, ha ismeretlen
}                                               // függvény vége

/**
 * A ruhatípus küszöbei régiónként (csak azok a régiók, amelyeket ez a ruha méri).
 */
export function thresholdsFor(garmentType) {   // ruhatípust kap
  return fitConfig.rahagyas[garmentType] ?? {}; // a ráhagyás-küszöbök, vagy üres objektum
}                                               // függvény vége

/**
 * Egy régió állapota a ráhagyás (ease, cm) és a küszöbök alapján.
 * Visszaadja az állapot kulcsát és a "büntetőpontot" (mennyire esik ki a jó tartományból).
 */
export function classifyEase(ease, t) {        // ráhagyás és küszöbök
  if (ease < t.min - t.szukTures) {             // ha a szűk tűréshatáron is túl van
    return { status: 'szorit', penalty: (t.min - ease) * 2 }; // szorít; a szűkség kétszer annyit számít, mint a bőség
  }                                             // if vége
  if (ease < t.min) {                           // ha a jó tartomány alatt, de a tűrésen belül
    return { status: 'kisse_szuk', penalty: (t.min - ease) * 2 }; // kissé szűk
  }                                             // if vége
  if (ease <= t.max) {                          // ha a jó tartományban van
    return { status: 'jo', penalty: 0 };        // jó, nincs büntetés
  }                                             // if vége
  if (ease <= t.max + t.boTures) {              // ha a jó tartomány felett, de a tűrésen belül
    return { status: 'kisse_bo', penalty: ease - t.max }; // kissé bő
  }                                             // if vége
  return { status: 'bo', penalty: ease - t.max }; // ennél is nagyobb: bő
}                                               // függvény vége

/**
 * Egy méret kiértékelése: régiónként a ráhagyás és az állapot, plusz az összpontszám.
 * profile: testméretek (chest_cm, waist_cm, hip_cm), chartRow: a mérettáblázat egy sora.
 */
export function evaluateSize(profile, chartRow, garmentType) { // testprofil, mérettáblázat sor, ruhatípus
  const thresholds = thresholdsFor(garmentType); // a ruhatípus küszöbei
  const regions = [];                           // ide gyűjtjük a régiók eredményét
  let score = 0;                                // összes büntetőpont (kisebb = jobb)
  for (const region of REGIONS) {               // végigmegyünk a mell, derék, csípő régiókon
    const t = thresholds[region];               // a régió küszöbei
    const garmentCm = chartRow?.[`${region}_cm`]; // a ruha mérete ebben a régióban (pl. chest_cm)
    const bodyCm = profile?.[`${region}_cm`];   // a test mérete ebben a régióban
    if (!t || garmentCm == null || bodyCm == null) continue; // ha ezt a régiót a ruha nem méri, kihagyjuk
    const ease = Number(garmentCm) - Number(bodyCm); // ráhagyás = ruha - test (cm)
    const { status, penalty } = classifyEase(ease, t); // állapot és büntetés
    score += penalty;                           // hozzáadjuk az összpontszámhoz
    regions.push({                              // régió eredményének eltárolása
      region,                                   // régió kulcsa (chest/waist/hip)
      name: fitConfig.regiok[region].nev,       // magyar neve (Mell)
      where: fitConfig.regiok[region].hol,      // ragozott alak (mellben)
      ease: Math.round(ease * 10) / 10,         // ráhagyás egy tizedesre kerekítve
      status,                                   // állapot kulcsa
      ...FIT_STATUS[status],                    // szín szint, szöveg, súlyosság
    });                                         // push vége
  }                                             // for vége
  return { size: chartRow?.size, regions, score }; // méret, régiók, pontszám
}                                               // függvény vége

/**
 * Méretajánlás: minden elérhető méretet kiértékel, a legkisebb pontszámút ajánlja.
 * availableSizes: opcionális lista, ha csak a készleten lévő méretek közül választunk.
 */
export function recommendSize(profile, sizeChart, garmentType, availableSizes = null) { // testprofil, mérettáblázat, ruhatípus, elérhető méretek
  if (!profile || !Array.isArray(sizeChart) || sizeChart.length === 0) return null; // ha nincs mivel számolni, nincs ajánlás
  const rows = availableSizes                   // ha meg van adva, mely méretek elérhetők
    ? sizeChart.filter((r) => availableSizes.includes(r.size)) // csak azokat nézzük
    : sizeChart;                                // különben mindet
  if (rows.length === 0) return null;           // ha egy sem maradt, nincs ajánlás
  const evaluations = rows.map((row) => evaluateSize(profile, row, garmentType)); // minden méret kiértékelése
  let best = evaluations[0];                    // kezdetben az első a legjobb
  for (const e of evaluations) {                // végigmegyünk az összesen
    if (e.score < best.score - 1e-9) best = e;  // ha ez jobb (kisebb pontszám), ez lesz a legjobb
  }                                             // for vége
  return { size: best.size, best, evaluations }; // az ajánlott méret, a kiértékelése és az összes kiértékelés
}                                               // függvény vége

/**
 * Régiók felsorolása emberi nyelven: ["mellben", "derékban"] → "mellben és derékban".
 */
function joinHu(words) {                        // szavak listáját kapja
  if (words.length <= 1) return words.join(''); // egy szó: önmaga
  return `${words.slice(0, -1).join(', ')} és ${words[words.length - 1]}`; // több szó: vesszővel, az utolsó előtt "és"
}                                               // függvény vége

/**
 * Rövid indoklás egy kiértékelésből: "mellben és csípőben jó, derékban kissé bő".
 */
export function describeEvaluation(evaluation) { // egy evaluateSize eredményt kap
  const groups = new Map();                     // állapot → régiók listája
  for (const r of evaluation.regions) {         // régiónként
    if (!groups.has(r.status)) groups.set(r.status, []); // új csoport, ha még nincs
    groups.get(r.status).push(r.where);         // a régió ragozott neve a csoportba
  }                                             // for vége
  const order = Object.keys(FIT_STATUS).sort((a, b) => FIT_STATUS[a].rank - FIT_STATUS[b].rank); // a "jó" kerüljön előre, a súlyosabb hátra
  const parts = [];                             // mondatrészek
  for (const status of order) {                 // állapotok sorrendben
    const where = groups.get(status);           // a csoport régiói
    if (!where) continue;                       // ha nincs ilyen állapotú régió, kihagyjuk
    const allGood = status === 'jo' && where.length === evaluation.regions.length && where.length > 1; // minden régió jó-e
    parts.push(`${joinHu(where)}${allGood ? ' is' : ''} ${FIT_STATUS[status].label}`); // pl. "mellben és derékban is jó"
  }                                             // for vége
  return parts.join(', ');                      // részek vesszővel összefűzve
}                                               // függvény vége

/**
 * A méretajánló sáv szövege (UI terv 7.5): zöld vagy sárga változat.
 */
export function recommendationMessage(recommendation, selectedEvaluation) { // ajánlás és a kiválasztott méret kiértékelése
  if (!recommendation) return null;             // ha nincs ajánlás, nincs üzenet
  const rec = recommendation.size;              // ajánlott méret
  if (!selectedEvaluation || selectedEvaluation.size === rec) { // ha az ajánlott méret van kiválasztva
    return {                                    // zöld sáv
      tone: 'success',                          // szín
      text: `Neked az ${rec} méret ajánlott – ${describeEvaluation(recommendation.best)}`, // pl. "Neked az M méret ajánlott – mellben jó, derékban kissé bő"
    };                                          // objektum vége
  }                                             // if vége
  const worst = [...selectedEvaluation.regions].sort((a, b) => b.rank - a.rank)[0]; // a kiválasztott méret legrosszabb régiója
  const text = worst && worst.status !== 'jo'   // ha van problémás régió
    ? `Az ${selectedEvaluation.size} ${worst.where} ${worst.label} lehet neked` // pl. "Az L derékban bő lehet neked"
    : `Az ${selectedEvaluation.size} is jó lehet, de neked az ${rec} illik a legjobban`; // ha nincs problémás régió
  return { tone: 'warning', text, backTo: rec }; // sárga sáv "Vissza az M-re" linkkel
}                                               // függvény vége

/**
 * "Mell: jó · Derék: kissé bő" – a jelmagyarázat szöveges régiólistája.
 */
export function regionSummary(evaluation) {    // egy kiértékelést kap
  return (evaluation?.regions ?? [])            // a régiók (vagy üres lista)
    .map((r) => `${r.name}: ${r.label}`)        // "Mell: jó" alak
    .join(' · ');                               // középső ponttal elválasztva
}                                               // függvény vége

export { fitConfig };                           // a konfigurációt más modulok is innen érik el
