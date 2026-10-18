<?php
// =====================================================================
// fit_config.php – a közös shared/fit-config.json beolvasása és a
// testméretek ellenőrzése ugyanazokkal a határokkal, mint a frontend
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * A közös konfiguráció betöltése (csak egyszer olvassuk be a fájlt).
 */
function fit_config(): array              // tömböt ad vissza
{
    static $cache = null;                 // a beolvasott konfiguráció megjegyzése
    if ($cache !== null) {                // ha már beolvastuk
        return $cache;                    // azt adjuk vissza
    }                                     // if vége
    $config = require __DIR__ . '/../config.php'; // backend beállítások (itt vannak a lehetséges útvonalak)
    foreach ($config['fit_config_paths'] as $path) { // végignézzük a lehetséges helyeket
        if (is_file($path)) {             // ha ott van a fájl
            $cache = json_decode((string) file_get_contents($path), true); // beolvassuk és tömbbé alakítjuk
            return $cache;                // visszaadjuk
        }                                 // if vége
    }                                     // foreach vége
    throw new RuntimeException('A shared/fit-config.json nem található.'); // ha sehol nincs, hibát dobunk
}                                         // függvény vége

/**
 * Testméretek ellenőrzése. Visszaadja a hibákat mezőnként (üres tömb = minden rendben),
 * és a $clean tömbbe teszi a számmá alakított értékeket.
 */
function validate_body_profile(array $input, ?array &$clean): array // bemenet, kimenet referencia, hibák
{
    $ranges = fit_config()['meresek'];    // a min–max tartományok a közös fájlból
    $errors = [];                         // ide gyűjtjük a hibákat
    $clean = [];                          // ide a megtisztított értékeket

    $gender = $input['gender'] ?? null;   // a nem kiolvasása (vagy null)
    if (!in_array((string) $gender, ['0', '1'], true)) { // csak 0 (nő) vagy 1 (férfi) lehet
        $errors['gender'] = 'Válaszd ki a nemet.'; // hibaüzenet
    } else {                              // ha jó
        $clean['gender'] = (int) $gender; // egész számként eltesszük
    }                                     // if-else vége

    foreach (['height_cm', 'weight_kg', 'chest_cm', 'waist_cm', 'hip_cm'] as $field) { // végigmegyünk az öt méreten
        $range = $ranges[$field];         // a mező tartománya (min, max, név)
        $value = $input[$field] ?? null;  // a beküldött érték
        if (!is_numeric($value)) {        // ha nem szám (vagy hiányzik)
            $errors[$field] = 'Add meg a ' . $range['targyrag'] . ' értékét.'; // pl. "Add meg a derékbőség értékét."
            continue;                     // ugrás a következő mezőre
        }                                 // if vége
        $number = (float) $value;         // tizedes számmá alakítás
        if ($number < $range['min'] || $number > $range['max']) { // ha kívül esik a tartományon
            $errors[$field] = sprintf(    // összerakjuk a UI terv szerinti hibaüzenetet
                'A %s értéke nem reális (%s–%s %s)', // pl. "A derékbőség értéke nem reális (55–130 cm)"
                $range['targyrag'],       // a mező neve
                $range['min'],            // alsó határ
                $range['max'],            // felső határ
                $range['egyseg']          // mértékegység
            );                            // sprintf vége
            continue;                     // ugrás a következő mezőre
        }                                 // if vége
        $clean[$field] = round($number, 1); // egy tizedesre kerekítve eltesszük
    }                                     // foreach vége

    return $errors;                       // a hibák listája (üres, ha minden jó)
}                                         // függvény vége
