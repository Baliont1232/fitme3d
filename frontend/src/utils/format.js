// =====================================================================
// format.js – kis formázó segédfüggvények
// =====================================================================

const priceFormatter = new Intl.NumberFormat('hu-HU'); // magyar számformátum (ezres tagolás szóközzel)

/**
 * Ár forintban: 18990 → "18 990 Ft".
 */
export function formatPrice(value) {            // szám
  return `${priceFormatter.format(value)} Ft`;  // formázott szöveg
}                                               // függvény vége
