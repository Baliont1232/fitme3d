<?php
// =====================================================================
// config.php – a backend beállításai egy helyen
// Az értékek környezeti változókból jönnek (Railway-en ezeket a felületen
// állítjuk be), ha nincsenek megadva, a XAMPP alapértékei érvényesek.
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés: ha egy függvény int-et vár, ne fogadjon el szöveget

/**
 * Egy környezeti változó kiolvasása több lehetséges névvel, alapértékkel.
 * Példa: env(['DB_HOST', 'MYSQLHOST'], '127.0.0.1')
 */
if (!function_exists('env')) {            // a fájlt többször is betöltjük, ezért csak egyszer definiáljuk a függvényt
    function env(array $names, string $default): string // a függvény neveket és egy alapértéket kap, szöveget ad vissza
    {
        foreach ($names as $name) {       // végigmegyünk a lehetséges változóneveken
            $value = getenv($name);       // kiolvassuk a környezeti változót (false, ha nincs ilyen)
            if ($value !== false && $value !== '') { // ha létezik és nem üres
                return $value;            // akkor ezt adjuk vissza
            }                             // if vége
        }                                 // foreach vége
        return $default;                  // ha egyik sem létezett, az alapérték jön
    }                                     // függvény vége
}                                         // if vége

return [                                  // a fájl egy tömböt ad vissza, ezt a require-rel kapjuk meg
    'db' => [                             // adatbázis beállítások
        'host' => env(['DB_HOST', 'MYSQLHOST'], '127.0.0.1'),      // szerver címe (Railway: MYSQLHOST, XAMPP: 127.0.0.1)
        'port' => (int) env(['DB_PORT', 'MYSQLPORT'], '3306'),     // port, egész számmá alakítva
        'name' => env(['DB_NAME', 'MYSQLDATABASE'], 'fitme3d'),    // adatbázis neve
        'user' => env(['DB_USER', 'MYSQLUSER'], 'root'),           // felhasználó (XAMPP-ban alapból root)
        'pass' => env(['DB_PASS', 'MYSQLPASSWORD'], ''),           // jelszó (XAMPP-ban alapból üres)
    ],                                    // db tömb vége
    'jwt' => [                            // a belépési token (JWT) beállításai
        'secret' => env(['JWT_SECRET'], 'fejlesztoi-titok-csak-helyi-gepre'), // titkos kulcs, élesben KÖTELEZŐ felülírni
        'ttl' => 60 * 60 * 24 * 7,        // a token élettartama másodpercben: 7 nap
    ],                                    // jwt tömb vége
    'cors_origin' => env(['CORS_ORIGIN'], '*'), // honnan hívhatja a böngésző az API-t (* = bárhonnan, token alapú, így ez rendben van)
    'fit_config_paths' => [               // a közös fit-config.json lehetséges helyei
        __DIR__ . '/../shared/fit-config.json', // a repóban: backend/../shared
        __DIR__ . '/shared/fit-config.json',    // ha a shared mappa a backend mellé van másolva
    ],                                    // tömb vége
    'database_dir_paths' => [             // a schema.sql és seed.sql lehetséges helyei
        __DIR__ . '/../database',         // a repóban: backend/../database
        __DIR__ . '/database',            // ha a database mappa a backend mellé van másolva
    ],                                    // tömb vége
];                                        // a visszaadott tömb vége
