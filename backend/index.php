<?php
// =====================================================================
// index.php – a REST API belépési pontja (front controller)
// Minden /api/... kérés ide fut be, és az útvonal alapján a megfelelő
// függvény válaszol. Így egyetlen helyen van az útválasztás.
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

require_once __DIR__ . '/lib/response.php';   // JSON válasz függvények
require_once __DIR__ . '/lib/db.php';         // adatbázis kapcsolat
require_once __DIR__ . '/lib/jwt.php';        // token kezelés
require_once __DIR__ . '/lib/auth.php';       // bejelentkezett felhasználó
require_once __DIR__ . '/lib/fit_config.php'; // közös konfiguráció és méretellenőrzés
require_once __DIR__ . '/routes/auth.php';         // /api/auth/... végpontok
require_once __DIR__ . '/routes/products.php';     // /api/categories és /api/products végpontok
require_once __DIR__ . '/routes/body_profile.php'; // /api/body-profile végpontok

$config = require __DIR__ . '/config.php'; // beállítások betöltése

// --- CORS fejlécek: megmondják a böngészőnek, honnan hívható az API -----
header('Access-Control-Allow-Origin: ' . $config['cors_origin']); // engedélyezett forrás
header('Access-Control-Allow-Headers: Content-Type, Authorization'); // engedélyezett fejlécek (a token miatt kell az Authorization)
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS'); // engedélyezett HTTP metódusok

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET'; // a kérés metódusa (GET, POST, ...)
if ($method === 'OPTIONS') {              // a böngésző "előzetes" (preflight) kérése
    http_response_code(204);              // 204 = nincs tartalom, de minden rendben
    exit;                                 // nincs több teendő
}                                         // if vége

// --- Az útvonal kiszámítása: mindent levágunk az "/api" részig ------------
$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'; // a teljes útvonal (a ?... rész nélkül)
$apiPos = strpos($uriPath, '/api/');      // hol kezdődik az /api/ rész
$path = $apiPos === false ? '/' : substr($uriPath, $apiPos + 4); // ami utána jön, pl. "/products/3"
$path = '/' . trim($path, '/');           // egységes alak: perjellel kezdődik, perjel nélkül végződik

// --- Útválasztás ----------------------------------------------------------
try {                                     // minden váratlan hibát elkapunk
    if ($path === '/health' && $method === 'GET') { // állapotjelzés (a Railway is ezt nézheti)
        db()->query('SELECT 1');          // kipróbáljuk az adatbázist
        json_response(['ok' => true, 'db' => true]); // minden működik
    }                                     // if vége
    if ($path === '/auth/register' && $method === 'POST') { // regisztráció
        auth_register();                  // a függvény választ küld és kilép
    }                                     // if vége
    if ($path === '/auth/login' && $method === 'POST') { // belépés
        auth_login();                     // választ küld
    }                                     // if vége
    if ($path === '/auth/me' && $method === 'GET') { // saját adatok
        auth_me();                        // választ küld
    }                                     // if vége
    if ($path === '/categories' && $method === 'GET') { // kategóriák
        categories_list();                // választ küld
    }                                     // if vége
    if ($path === '/products' && $method === 'GET') { // terméklista
        products_list();                  // választ küld
    }                                     // if vége
    if (preg_match('#^/products/(\d+)$#', $path, $m) && $method === 'GET') { // egy termék, pl. /products/3
        product_detail((int) $m[1]);      // a számot átadjuk azonosítóként
    }                                     // if vége
    if ($path === '/body-profile' && $method === 'GET') { // saját testprofil
        body_profile_get();               // választ küld
    }                                     // if vége
    if ($path === '/body-profile' && $method === 'PUT') { // testprofil mentése
        body_profile_save();              // választ küld
    }                                     // if vége

    json_error('Nincs ilyen végpont: ' . $method . ' ' . $path, 404); // ha egyik sem illett, 404
} catch (Throwable $e) {                  // bármilyen nem várt hiba
    error_log('API hiba: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine()); // részletek a szerver naplójába
    json_error('Váratlan szerverhiba. Próbáld újra később.', 500); // a felhasználónak általános üzenet
}                                         // try-catch vége
