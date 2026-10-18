<?php
// =====================================================================
// jwt.php – JSON Web Token készítése és ellenőrzése (HS256), külső
// könyvtár nélkül. A token három része: fejléc.adatok.aláírás
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * Base64url kódolás: mint a base64, de URL-barát (+ helyett -, / helyett _, nincs = a végén).
 */
function base64url_encode(string $data): string // szöveget kap, kódolt szöveget ad vissza
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); // base64, karaktercsere, a záró = jelek levágása
}                                         // függvény vége

/**
 * Base64url dekódolás (a fenti fordítottja).
 */
function base64url_decode(string $data): string|false // kódolt szöveget kap, eredetit (vagy false-t) ad vissza
{
    $padded = str_pad($data, strlen($data) + (4 - strlen($data) % 4) % 4, '='); // visszatesszük a levágott = jeleket, hogy 4-gyel osztható legyen
    return base64_decode(strtr($padded, '-_', '+/'), true); // visszacseréljük a karaktereket és dekódolunk (szigorú mód)
}                                         // függvény vége

/**
 * Új token készítése a megadott adatokkal (payload).
 */
function jwt_create(array $payload, string $secret, int $ttlSeconds): string // adatok, titkos kulcs, élettartam
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT']; // fejléc: HMAC-SHA256 aláírás, típus JWT
    $now = time();                        // a jelenlegi időpont (Unix időbélyeg, másodperc)
    $payload['iat'] = $now;               // iat = kiállítás ideje
    $payload['exp'] = $now + $ttlSeconds; // exp = lejárat ideje

    $headerPart = base64url_encode(json_encode($header));   // fejléc JSON-ként, majd kódolva
    $payloadPart = base64url_encode(json_encode($payload)); // adatok JSON-ként, majd kódolva
    $signature = hash_hmac('sha256', $headerPart . '.' . $payloadPart, $secret, true); // aláírás a titkos kulccsal (nyers bájtok)

    return $headerPart . '.' . $payloadPart . '.' . base64url_encode($signature); // a három rész ponttal összefűzve
}                                         // függvény vége

/**
 * Token ellenőrzése. Ha érvényes, az adatokat adja vissza, különben null-t.
 */
function jwt_verify(string $token, string $secret): ?array // tokent és kulcsot kap, tömböt vagy null-t ad
{
    $parts = explode('.', $token);        // szétszedjük a tokent a pontoknál
    if (count($parts) !== 3) {            // ha nem pontosan 3 rész van
        return null;                      // érvénytelen
    }                                     // if vége
    [$headerPart, $payloadPart, $signaturePart] = $parts; // a három rész külön változókba

    $expected = base64url_encode(hash_hmac('sha256', $headerPart . '.' . $payloadPart, $secret, true)); // kiszámoljuk, milyen aláírásnak kellene lennie
    if (!hash_equals($expected, $signaturePart)) { // időzítés-biztos összehasonlítás (nem árul el semmit a futási idővel)
        return null;                      // ha nem egyezik, valaki módosította a tokent
    }                                     // if vége

    $json = base64url_decode($payloadPart); // az adatrész dekódolása
    $payload = $json === false ? null : json_decode($json, true); // JSON-ból tömb (ha a dekódolás sikerült)
    if (!is_array($payload)) {            // ha nem tömb lett
        return null;                      // érvénytelen
    }                                     // if vége
    if (!isset($payload['exp']) || $payload['exp'] < time()) { // ha nincs lejárat, vagy már lejárt
        return null;                      // érvénytelen
    }                                     // if vége

    return $payload;                      // minden rendben, visszaadjuk az adatokat
}                                         // függvény vége
