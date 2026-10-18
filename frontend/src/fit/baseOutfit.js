// =====================================================================
// baseOutfit.js – a kezdőlapi forgó avatar szettje (Basic póló + farmer, M)
// A mérettáblázat sorai megegyeznek a seed.sql M méreteivel.
// =====================================================================

export const BASE_OUTFIT = [                    // a szett darabjai
  { type: 'nadrag', chartRow: { size: 'M', chest_cm: null, waist_cm: 84, hip_cm: 104 }, color: '#4A6A9A' }, // egyenes szárú farmer, középkék
  { type: 'polo', chartRow: { size: 'M', chest_cm: 106, waist_cm: 102, hip_cm: null }, color: '#E8735A' },  // basic póló, korall
];                                              // tömb vége
