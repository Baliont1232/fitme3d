<?php
// =====================================================================
// routes/products.php – kategóriák és termékek (/api/categories, /api/products)
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * GET /api/categories – az összes kategória.
 */
function categories_list(): never         // nem tér vissza
{
    $rows = db()->query('SELECT id, name FROM categories ORDER BY id')->fetchAll(); // kategóriák azonosító szerint rendezve
    foreach ($rows as &$row) {            // végigmegyünk a sorokon (referenciával, így módosíthatjuk őket)
        $row['id'] = (int) $row['id'];    // az id-t számmá alakítjuk (a PDO szövegként adná)
    }                                     // foreach vége
    unset($row);                          // a referencia megszüntetése (PHP jó gyakorlat)
    json_response($rows);                 // lista visszaadása
}                                         // függvény vége

/**
 * Egy termék mérettáblázatát adja vissza: [{size, chest_cm, waist_cm, hip_cm}, ...]
 */
function load_size_chart(int $productId): array // termék azonosítót kap, tömböt ad
{
    $stmt = db()->prepare(                // mérettáblázat lekérése
        "SELECT size, chest_cm, waist_cm, hip_cm FROM size_charts
          WHERE product_id = ?
          ORDER BY FIELD(size, 'XS', 'S', 'M', 'L', 'XL', 'XXL')" // méretek logikus sorrendben (nem ábécé szerint)
    );                                    // prepare vége
    $stmt->execute([$productId]);         // végrehajtás
    $rows = $stmt->fetchAll();            // összes sor
    return array_map(static fn(array $r): array => [ // minden sort átalakítunk
        'size' => $r['size'],             // méret
        'chest_cm' => $r['chest_cm'] === null ? null : (float) $r['chest_cm'], // mell (vagy null)
        'waist_cm' => $r['waist_cm'] === null ? null : (float) $r['waist_cm'], // derék (vagy null)
        'hip_cm' => $r['hip_cm'] === null ? null : (float) $r['hip_cm'],       // csípő (vagy null)
    ], $rows);                            // array_map vége
}                                         // függvény vége

/**
 * GET /api/products?category=1&q=farmer – terméklista szűréssel és kereséssel.
 */
function products_list(): never           // nem tér vissza
{
    $where = ['p.is_active = 1'];         // alapfeltétel: csak az aktív termékek
    $params = [];                         // a ? helyére kerülő értékek

    if (isset($_GET['category']) && ctype_digit((string) $_GET['category'])) { // ha van kategória szűrő és szám
        $where[] = 'p.category_id = ?';   // feltétel hozzáadása
        $params[] = (int) $_GET['category']; // érték hozzáadása
    }                                     // if vége
    $q = trim((string) ($_GET['q'] ?? '')); // keresőszó (szóközök nélkül)
    if ($q !== '') {                      // ha van keresőszó
        $where[] = '(p.name LIKE ? OR p.description LIKE ?)'; // névben vagy leírásban keresünk
        $params[] = '%' . $q . '%';       // a % jelek miatt bárhol lehet a szövegben
        $params[] = '%' . $q . '%';       // ugyanez a leíráshoz
    }                                     // if vége

    $sql = 'SELECT p.id, p.name, p.base_price, p.category_id, c.name AS category_name
              FROM products p JOIN categories c ON c.id = p.category_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY p.id';              // a feltételeket AND-del fűzzük össze
    $stmt = db()->prepare($sql);          // előkészítés
    $stmt->execute($params);              // végrehajtás a paraméterekkel
    $products = $stmt->fetchAll();        // termékek

    $colorStmt = db()->prepare(           // a termék színei (egyedi lista)
        'SELECT color_name, color_hex, SUM(stock) AS stock
           FROM product_variants WHERE product_id = ?
          GROUP BY color_name, color_hex
          ORDER BY MIN(id)'               // színenként összegezve, a felvétel sorrendjében
    );                                    // prepare vége

    $result = [];                         // ide gyűjtjük a választ
    foreach ($products as $p) {           // minden terméken végigmegyünk
        $colorStmt->execute([$p['id']]);  // színek lekérése
        $colors = array_map(static fn(array $c): array => [ // színek átalakítása
            'name' => $c['color_name'],   // szín neve
            'hex' => $c['color_hex'],     // hex kód
        ], $colorStmt->fetchAll());       // array_map vége
        $result[] = [                     // termék hozzáadása a válaszhoz
            'id' => (int) $p['id'],       // azonosító
            'name' => $p['name'],         // név
            'price' => (int) $p['base_price'], // ár
            'category_id' => (int) $p['category_id'], // kategória azonosító
            'category' => $p['category_name'], // kategória neve (ebből tudja a frontend a 3D ruhatípust)
            'colors' => $colors,          // színek
            'size_chart' => load_size_chart((int) $p['id']), // mérettáblázat (a "Neked: M" jelvényhez)
        ];                                // tömb vége
    }                                     // foreach vége
    json_response($result);               // lista visszaadása
}                                         // függvény vége

/**
 * GET /api/products/{id} – egy termék minden adata a termékoldalhoz és a próbafülkéhez.
 */
function product_detail(int $id): never  // termék azonosítót kap
{
    $stmt = db()->prepare(                // termék és kategória lekérése
        'SELECT p.id, p.name, p.description, p.base_price, p.category_id, c.name AS category_name
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.id = ? AND p.is_active = 1' // csak aktív termék
    );                                    // prepare vége
    $stmt->execute([$id]);                // végrehajtás
    $p = $stmt->fetch();                  // a sor
    if (!$p) {                            // ha nincs ilyen termék
        json_error('A termék nem található.', 404); // 404 hiba
    }                                     // if vége

    $variantStmt = db()->prepare(         // változatok lekérése
        'SELECT id, size, color_name, color_hex, stock, price FROM product_variants
          WHERE product_id = ? ORDER BY id' // felvétel sorrendjében
    );                                    // prepare vége
    $variantStmt->execute([$id]);         // végrehajtás
    $variants = array_map(static fn(array $v): array => [ // változatok átalakítása
        'id' => (int) $v['id'],           // változat azonosító (a kosár ide hivatkozik majd)
        'size' => $v['size'],             // méret
        'color_name' => $v['color_name'], // szín neve
        'color_hex' => $v['color_hex'],   // szín hex kódja
        'stock' => (int) $v['stock'],     // készlet
        'price' => $v['price'] === null ? (int) $p['base_price'] : (int) $v['price'], // saját ár vagy alapár
    ], $variantStmt->fetchAll());         // array_map vége

    $modelStmt = db()->prepare('SELECT glb_path FROM product_models WHERE product_id = ?'); // 3D modell (ha van)
    $modelStmt->execute([$id]);           // végrehajtás
    $glb = $modelStmt->fetchColumn();     // a GLB útvonala vagy false

    $imageStmt = db()->prepare('SELECT file_path FROM product_images WHERE product_id = ? ORDER BY id'); // képek
    $imageStmt->execute([$id]);           // végrehajtás

    json_response([                       // válasz
        'id' => (int) $p['id'],           // azonosító
        'name' => $p['name'],             // név
        'description' => $p['description'], // leírás
        'price' => (int) $p['base_price'],  // alapár
        'category_id' => (int) $p['category_id'], // kategória azonosító
        'category' => $p['category_name'],  // kategória neve
        'variants' => $variants,          // méret + szín változatok készlettel
        'size_chart' => load_size_chart($id), // mérettáblázat a méretajánlóhoz
        'model' => $glb ? ['glb_path' => $glb] : null, // ha nincs GLB, a frontend kódból építi a ruhát
        'images' => $imageStmt->fetchAll(PDO::FETCH_COLUMN), // képek útvonalai
    ]);                                   // json_response vége
}                                         // függvény vége
