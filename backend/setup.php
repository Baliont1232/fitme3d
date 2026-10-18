<?php
// =====================================================================
// setup.php – az adatbázis automatikus létrehozása parancssorból
//   php backend/setup.php          → csak akkor tölt be, ha még üres az adatbázis
//   php backend/setup.php --reset  → mindent töröl és újratölt (schema + seed)
// A Railway szerver minden induláskor lefuttatja (lásd docker/start.sh).
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

if (PHP_SAPI !== 'cli') {                 // ha nem parancssorból futtatják (hanem böngészőből)
    http_response_code(403);              // 403 = tiltott
    exit("Ez a script csak parancssorból futtatható.\n"); // biztonsági okból leállunk
}                                         // if vége

$config = require __DIR__ . '/config.php'; // beállítások
$db = $config['db'];                      // adatbázis rész
$reset = in_array('--reset', $argv, true); // megadták-e a --reset kapcsolót

/**
 * Üzenet kiírása időbélyeggel.
 */
function say(string $message): void       // szöveget kap, nem ad vissza semmit
{
    echo '[setup ' . date('H:i:s') . '] ' . $message . PHP_EOL; // pl. "[setup 14:05:12] Kész."
}                                         // függvény vége

// --- Csatlakozás, újrapróbálkozással (élesben az adatbázis lassabban indulhat) ---
$pdo = null;                              // még nincs kapcsolat
for ($attempt = 1; $attempt <= 30; $attempt++) { // legfeljebb 30 próbálkozás
    try {                                 // megpróbálunk csatlakozni
        $pdo = new PDO(                   // kapcsolat adatbázis-név NÉLKÜL (hátha még nem létezik)
            sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $db['host'], $db['port']), // szerver és port
            $db['user'],                  // felhasználó
            $db['pass'],                  // jelszó
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION] // hibánál kivétel
        );                                // new PDO vége
        break;                            // sikerült, kilépünk a ciklusból
    } catch (PDOException $e) {           // ha nem sikerült
        say("Az adatbázis még nem elérhető ({$attempt}/30): " . $e->getMessage()); // kiírjuk
        sleep(2);                         // várunk 2 másodpercet
    }                                     // try-catch vége
}                                         // for vége
if ($pdo === null) {                      // ha 30 próbálkozás után sem sikerült
    say('Nem sikerült csatlakozni, kilépés.'); // hibaüzenet
    exit(1);                              // 1-es kilépési kód = hiba
}                                         // if vége

try {                                     // megpróbáljuk létrehozni az adatbázist
    $pdo->exec(sprintf('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci', $db['name'])); // ha még nincs, létrejön
} catch (PDOException $e) {               // ha nincs rá jogunk (pl. Railway-en már létezik)
    say('Az adatbázist nem hoztam létre (valószínűleg már létezik): ' . $e->getMessage()); // csak jelezzük
}                                         // try-catch vége
$pdo->exec(sprintf('USE `%s`', $db['name'])); // átváltunk a projekt adatbázisára

$hasUsers = (bool) $pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn(); // létezik-e már a users tábla
if ($hasUsers && !$reset) {               // ha már fel van töltve, és nem kértek újratöltést
    say('Az adatbázis már fel van töltve, nincs teendő.'); // jelezzük
    exit(0);                              // 0-s kilépési kód = siker
}                                         // if vége

// --- A database mappa megkeresése ----------------------------------------
$dir = null;                              // még nem tudjuk, hol van
foreach ($config['database_dir_paths'] as $candidate) { // végignézzük a lehetséges helyeket
    if (is_file($candidate . '/schema.sql')) { // ha ott van a schema.sql
        $dir = $candidate;                // megtaláltuk
        break;                            // kilépés a ciklusból
    }                                     // if vége
}                                         // foreach vége
if ($dir === null) {                      // ha sehol nem találtuk
    say('Nem találom a schema.sql fájlt.'); // hibaüzenet
    exit(1);                              // hiba
}                                         // if vége

/**
 * Egy .sql fájl végrehajtása utasításonként. Kezeli a DELIMITER sorokat is
 * (azokat a phpMyAdmin és a mysql parancssor érti, a PDO nem, ezért itt dolgozzuk fel).
 */
function run_sql_file(PDO $pdo, string $file): int // kapcsolatot és fájlnevet kap, a lefuttatott utasítások számát adja
{
    $delimiter = ';';                     // alapból pontosvessző zárja az utasításokat
    $buffer = '';                         // ide gyűjtjük az aktuális utasítás sorait
    $count = 0;                           // lefuttatott utasítások száma
    foreach (file($file) as $line) {      // a fájl soronként
        $trimmed = trim($line);           // szóközök levágása
        if (preg_match('/^DELIMITER\s+(\S+)/i', $trimmed, $m)) { // ha DELIMITER sor
            $delimiter = $m[1];           // átállítjuk az elválasztót (pl. $$)
            continue;                     // ezt a sort nem küldjük az adatbázisnak
        }                                 // if vége
        if ($buffer === '' && ($trimmed === '' || str_starts_with($trimmed, '--'))) { // üres vagy megjegyzés sor egy utasítás előtt
            continue;                     // kihagyjuk
        }                                 // if vége
        $buffer .= $line;                 // a sort hozzáadjuk az aktuális utasításhoz
        $code = rtrim(preg_replace('/\s--\s.*$/', '', rtrim($line)) ?? ''); // a sor végi "-- megjegyzés" nélküli rész
        if (str_ends_with($code, $delimiter)) { // ha a sor az elválasztóval végződik, kész az utasítás
            $sql = rtrim(trim($buffer));  // az összegyűjtött szöveg
            $pdo->exec(substr(rtrim(preg_replace('/\s--\s[^\n]*$/', '', $sql) ?? $sql), 0, -strlen($delimiter))); // végrehajtás az elválasztó nélkül
            $buffer = '';                 // új utasítás kezdődik
            $count++;                     // számláló növelése
        }                                 // if vége
    }                                     // foreach vége
    return $count;                        // a lefuttatott utasítások száma
}                                         // függvény vége

say('Séma betöltése: ' . $dir . '/schema.sql'); // tájékoztatás
$n = run_sql_file($pdo, $dir . '/schema.sql'); // a táblák létrehozása
say("Séma kész ({$n} utasítás).");        // eredmény
say('Kezdő adatok betöltése: ' . $dir . '/seed.sql'); // tájékoztatás
$n = run_sql_file($pdo, $dir . '/seed.sql'); // az adatok beszúrása
say("Kezdő adatok kész ({$n} utasítás)."); // eredmény
say('Minden kész. Demó fiók: demo@fitme3d.hu / Demo1234'); // emlékeztető a demó fiókra
