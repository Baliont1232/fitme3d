<?php
// =====================================================================
// routes/body_profile.php – a testprofil lekérése és mentése (/api/body-profile)
// A testméretek privátak: mindig csak a bejelentkezett felhasználóé olvasható.
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * Egy body_profiles sort a frontend által várt formára alakít.
 */
function format_profile(array $row): array // adatbázis sort kap, válasz tömböt ad
{
    return [                              // új tömb
        'gender' => (int) $row['gender'], // nem: 0 vagy 1
        'height_cm' => (int) $row['height_cm'], // magasság egész számként
        'weight_kg' => (float) $row['weight_kg'], // súly tizedes számként
        'chest_cm' => (float) $row['chest_cm'],   // mellbőség
        'waist_cm' => (float) $row['waist_cm'],   // derékbőség
        'hip_cm' => (float) $row['hip_cm'],       // csípőbőség
        'updated_at' => $row['updated_at'],       // utolsó módosítás ideje
    ];                                    // tömb vége
}                                         // függvény vége

/**
 * GET /api/body-profile – a saját testprofil.
 */
function body_profile_get(): never        // nem tér vissza
{
    $user = require_user();               // csak belépve
    $stmt = db()->prepare('SELECT * FROM body_profiles WHERE user_id = ?'); // a saját profil lekérése
    $stmt->execute([(int) $user['id']]);  // végrehajtás a saját azonosítóval (más profilját nem lehet kérni)
    $row = $stmt->fetch();                // a sor (vagy false)
    if (!$row) {                          // ha még nincs profil
        json_error('Előbb hozd létre az avatarodat!', 404); // UI terv szövege, 404
    }                                     // if vége
    json_response(format_profile($row));  // a profil visszaadása
}                                         // függvény vége

/**
 * PUT /api/body-profile – a testprofil létrehozása vagy módosítása.
 */
function body_profile_save(): never       // nem tér vissza
{
    $user = require_user();               // csak belépve
    $input = read_json_body();            // a beküldött méretek
    $clean = null;                        // ide kerülnek a megtisztított értékek
    $errors = validate_body_profile($input, $clean); // ellenőrzés a közös tartományokkal
    if ($errors !== []) {                 // ha valamelyik érték nem reális
        json_error('Hibás testméretek', 422, $errors); // 422 mezőnkénti hibákkal
    }                                     // if vége

    $stmt = db()->prepare(                // beszúrás, vagy ha már van profil, frissítés
        'INSERT INTO body_profiles (user_id, gender, height_cm, weight_kg, chest_cm, waist_cm, hip_cm)
         VALUES (:uid, :gender, :height, :weight, :chest, :waist, :hip)
         ON DUPLICATE KEY UPDATE
           gender = VALUES(gender), height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg),
           chest_cm = VALUES(chest_cm), waist_cm = VALUES(waist_cm), hip_cm = VALUES(hip_cm)'
    );                                    // az ON DUPLICATE KEY a user_id egyedi kulcsa miatt működik
    $stmt->execute([                      // végrehajtás névvel jelölt paraméterekkel
        ':uid' => (int) $user['id'],      // saját azonosító
        ':gender' => $clean['gender'],    // nem
        ':height' => (int) round($clean['height_cm']), // magasság egészre kerekítve (SMALLINT)
        ':weight' => $clean['weight_kg'], // súly
        ':chest' => $clean['chest_cm'],   // mell
        ':waist' => $clean['waist_cm'],   // derék
        ':hip' => $clean['hip_cm'],       // csípő
    ]);                                   // execute vége

    $read = db()->prepare('SELECT * FROM body_profiles WHERE user_id = ?'); // visszaolvassuk a mentett sort
    $read->execute([(int) $user['id']]);  // végrehajtás
    json_response(format_profile($read->fetch())); // a mentett profil visszaadása
}                                         // függvény vége
