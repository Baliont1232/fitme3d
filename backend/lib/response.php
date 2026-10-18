<?php
// =====================================================================
// response.php – JSON válaszok küldése és a kérés törzsének beolvasása
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * JSON válasz küldése a megadott HTTP státuszkóddal, majd a futás leállítása.
 */
function json_response(mixed $data, int $status = 200): never // bármilyen adatot kap, soha nem tér vissza (exit miatt)
{
    http_response_code($status);          // beállítjuk a HTTP státuszkódot (pl. 200, 404)
    header('Content-Type: application/json; charset=utf-8'); // jelezzük, hogy JSON jön UTF-8 kódolással
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); // kiírjuk JSON-ként, az ékezeteket nem kódoljuk át
    exit;                                 // leállítjuk a script futását, mert a válasz kész
}                                         // függvény vége

/**
 * Hibaválasz egységes formában: { "error": "...", "fields": {...} }
 */
function json_error(string $message, int $status = 400, array $fields = []): never // üzenet, státusz és mezőnkénti hibák
{
    $body = ['error' => $message];        // a válasz alapja a hibaüzenet
    if ($fields !== []) {                 // ha vannak mezőnkénti hibák (űrlapellenőrzés)
        $body['fields'] = $fields;        // azokat is hozzátesszük
    }                                     // if vége
    json_response($body, $status);        // elküldjük a választ
}                                         // függvény vége

/**
 * A kérés JSON törzsének beolvasása asszociatív tömbbe.
 */
function read_json_body(): array          // tömböt ad vissza
{
    $raw = file_get_contents('php://input'); // a nyers kéréstörzs beolvasása
    if ($raw === false || trim($raw) === '') { // ha nincs törzs
        return [];                        // üres tömböt adunk vissza
    }                                     // if vége
    $data = json_decode($raw, true);      // JSON szöveg átalakítása PHP tömbbé
    if (!is_array($data)) {               // ha nem sikerült (hibás JSON)
        json_error('Hibás JSON a kérésben.', 400); // 400-as hibát küldünk
    }                                     // if vége
    return $data;                         // a feldolgozott adat visszaadása
}                                         // függvény vége
