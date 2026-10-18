<?php
// =====================================================================
// db.php – kapcsolódás a MySQL adatbázishoz PDO-val
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * Visszaadja a közös PDO kapcsolatot. Csak egyszer csatlakozik,
 * utána ugyanazt a kapcsolatot adja vissza (static változó).
 */
function db(): PDO                        // PDO objektumot ad vissza
{
    static $pdo = null;                   // a static változó megmarad a függvényhívások között
    if ($pdo instanceof PDO) {            // ha már van kapcsolat
        return $pdo;                      // azt adjuk vissza, nem csatlakozunk újra
    }                                     // if vége

    $config = require __DIR__ . '/../config.php'; // beolvassuk a beállításokat
    $db = $config['db'];                  // ebből csak az adatbázis rész kell

    $dsn = sprintf(                       // összerakjuk a kapcsolódási szöveget (DSN)
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', // formátum: szerver, port, adatbázis, kódolás
        $db['host'],                      // szerver címe
        $db['port'],                      // port
        $db['name']                       // adatbázis neve
    );                                    // sprintf vége

    try {                                 // megpróbálunk csatlakozni
        $pdo = new PDO($dsn, $db['user'], $db['pass'], [ // új PDO kapcsolat felhasználónévvel és jelszóval
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,      // SQL hibánál kivételt dob (így elkapható)
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // a sorokat asszociatív tömbként kapjuk (oszlopnév => érték)
            PDO::ATTR_EMULATE_PREPARES => false,              // valódi prepared statement, védelem SQL injection ellen
        ]);                               // beállítások vége
    } catch (PDOException $e) {           // ha nem sikerült csatlakozni
        error_log('DB kapcsolódási hiba: ' . $e->getMessage()); // a részletes hibát csak a szerver naplójába írjuk
        json_error('Az adatbázis nem érhető el.', 503); // a felhasználónak általános üzenet, 503 = szolgáltatás nem elérhető
    }                                     // try-catch vége

    return $pdo;                          // a kész kapcsolat visszaadása
}                                         // függvény vége
