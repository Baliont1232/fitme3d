<?php
// =====================================================================
// auth.php – a bejelentkezett felhasználó azonosítása a kérésből
// A frontend minden kérésnél elküldi: Authorization: Bearer <token>
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

require_once __DIR__ . '/jwt.php';        // a token ellenőrző függvények
require_once __DIR__ . '/db.php';         // az adatbázis kapcsolat
require_once __DIR__ . '/response.php';   // a JSON válasz függvények

/**
 * Az Authorization fejlécből kiolvassa a tokent (vagy null, ha nincs).
 */
function bearer_token(): ?string          // szöveget vagy null-t ad vissza
{
    $header = $_SERVER['HTTP_AUTHORIZATION']          // a legtöbb szerveren itt van a fejléc
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']    // Apache átirányításnál néha ide kerül
        ?? '';                                        // ha egyik sincs, üres szöveg
    if ($header === '' && function_exists('apache_request_headers')) { // ha üres, és Apache alatt futunk
        $headers = apache_request_headers();          // lekérjük az összes fejlécet
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? ''; // kis- vagy nagybetűs változat
    }                                     // if vége
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) { // ha "Bearer <token>" alakú
        return trim($m[1]);               // visszaadjuk a token részt
    }                                     // if vége
    return null;                          // nincs token
}                                         // függvény vége

/**
 * Visszaadja a bejelentkezett felhasználót, vagy null-t, ha nincs belépve.
 */
function current_user(): ?array          // felhasználó tömb vagy null
{
    $token = bearer_token();              // token kiolvasása
    if ($token === null) {                // ha nincs token
        return null;                      // nincs bejelentkezve
    }                                     // if vége
    $config = require __DIR__ . '/../config.php'; // beállítások (a titkos kulcs miatt)
    $payload = jwt_verify($token, $config['jwt']['secret']); // token ellenőrzése
    if ($payload === null) {              // ha érvénytelen vagy lejárt
        return null;                      // nincs bejelentkezve
    }                                     // if vége

    $stmt = db()->prepare(                // lekérdezés előkészítése (a ? helyére biztonságosan kerül az érték)
        'SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_banned, r.role_name
           FROM users u JOIN user_roles r ON r.id = u.role_id
          WHERE u.id = ?'                 // a felhasználó adatai a szerepkör nevével együtt
    );                                    // prepare vége
    $stmt->execute([(int) $payload['sub']]); // végrehajtás a tokenben lévő felhasználó-azonosítóval (sub)
    $user = $stmt->fetch();               // egy sor lekérése

    if (!$user || (int) $user['is_banned'] === 1) { // ha nincs ilyen felhasználó, vagy tiltva van
        return null;                      // nem engedjük be
    }                                     // if vége
    return $user;                         // a felhasználó adatai
}                                         // függvény vége

/**
 * Mint a current_user, de ha nincs belépve, 401-es hibát küld és leáll.
 */
function require_user(): array            // mindig tömböt ad vissza (különben kilép)
{
    $user = current_user();               // felhasználó lekérése
    if ($user === null) {                 // ha nincs belépve
        json_error('A munkameneted lejárt, lépj be újra.', 401); // 401 = nincs hitelesítve (UI terv szövege)
    }                                     // if vége
    return $user;                         // a felhasználó adatai
}                                         // függvény vége

/**
 * Felhasználó adatainak "tisztítása" a válaszhoz (csak a szükséges mezők).
 */
function public_user(array $user): array  // a teljes sort kapja, a nyilvános részt adja vissza
{
    return [                              // új tömb a válaszhoz
        'id' => (int) $user['id'],        // azonosító számként
        'username' => $user['username'],  // felhasználónév
        'email' => $user['email'],        // e-mail cím
        'first_name' => $user['first_name'], // keresztnév
        'last_name' => $user['last_name'],   // vezetéknév
        'role' => $user['role_name'] ?? 'vásárló', // szerepkör neve
    ];                                    // tömb vége
}                                         // függvény vége
