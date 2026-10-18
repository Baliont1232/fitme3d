<?php
// =====================================================================
// routes/auth.php – regisztráció, belépés, saját adatok (/api/auth/...)
// =====================================================================

declare(strict_types=1); // szigorú típusellenőrzés

/**
 * Token készítése egy felhasználóhoz.
 */
function issue_token(array $user): string // felhasználó tömböt kap, token szöveget ad
{
    $config = require __DIR__ . '/../config.php'; // beállítások (titkos kulcs, élettartam)
    return jwt_create(                    // új token készítése
        ['sub' => (int) $user['id'], 'role' => $user['role_name'] ?? 'vásárló'], // a tokenbe az azonosító és a szerepkör kerül
        $config['jwt']['secret'],         // titkos kulcs
        $config['jwt']['ttl']             // élettartam
    );                                    // jwt_create vége
}                                         // függvény vége

/**
 * Megnézi, van-e a felhasználónak testprofilja (a frontend ebből tudja, kell-e avatar).
 */
function user_has_profile(int $userId): bool // azonosítót kap, igaz/hamis értéket ad
{
    $stmt = db()->prepare('SELECT 1 FROM body_profiles WHERE user_id = ?'); // létezik-e sor
    $stmt->execute([$userId]);            // végrehajtás
    return (bool) $stmt->fetchColumn();   // ha van sor, igaz
}                                         // függvény vége

/**
 * POST /api/auth/register – új fiók létrehozása.
 */
function auth_register(): never           // nem tér vissza, mert mindig választ küld
{
    $body = read_json_body();             // a kérés adatai
    $email = strtolower(trim((string) ($body['email'] ?? ''))); // e-mail kisbetűsítve, szóközök nélkül
    $password = (string) ($body['password'] ?? '');            // jelszó
    $confirm = (string) ($body['password_confirm'] ?? '');     // jelszó megerősítése
    $errors = [];                         // ide gyűjtjük a mezőnkénti hibákat

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { // ha nem érvényes e-mail formátum
        $errors['email'] = 'Érvénytelen e-mail cím';  // UI terv szerinti szöveg
    }                                     // if vége
    if (strlen($password) < 8) {          // ha a jelszó rövidebb 8 karakternél
        $errors['password'] = 'A jelszó legalább 8 karakter legyen'; // hibaüzenet
    }                                     // if vége
    if ($password !== $confirm) {         // ha a két jelszó nem egyezik
        $errors['password_confirm'] = 'A két jelszó nem egyezik'; // UI terv szerinti szöveg
    }                                     // if vége
    if ($errors !== []) {                 // ha volt bármilyen hiba
        json_error('Hibás adatok', 422, $errors); // 422 = feldolgozhatatlan adat, mezőnkénti hibákkal
    }                                     // if vége

    $pdo = db();                          // adatbázis kapcsolat
    $check = $pdo->prepare('SELECT 1 FROM users WHERE email = ?'); // foglalt-e az e-mail
    $check->execute([$email]);            // végrehajtás
    if ($check->fetchColumn()) {          // ha van már ilyen
        json_error('Hibás adatok', 409, ['email' => 'Ez az e-mail cím már foglalt']); // 409 = ütközés
    }                                     // if vége

    $base = preg_replace('/[^a-z0-9]/', '', strstr($email, '@', true)) ?: 'felhasznalo'; // felhasználónév az e-mail @ előtti részéből, csak betű és szám
    $username = $base;                    // első próbálkozás
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE username = ?'); // foglalt-e a felhasználónév
    for ($i = 2; ; $i++) {                // addig próbálkozunk, amíg szabad nevet nem találunk
        $exists->execute([$username]);    // ellenőrzés
        if (!$exists->fetchColumn()) {    // ha szabad
            break;                        // kilépünk a ciklusból
        }                                 // if vége
        $username = $base . $i;           // különben számot teszünk a végére (demo2, demo3...)
    }                                     // for vége

    $pdo->beginTransaction();             // tranzakció: vagy mindkét beszúrás sikerül, vagy egyik sem
    try {                                 // hibakezelés kezdete
        $insertUser = $pdo->prepare('INSERT INTO users (username, email, role_id) VALUES (?, ?, 1)'); // új felhasználó vásárló szerepkörrel
        $insertUser->execute([$username, $email]); // beszúrás
        $userId = (int) $pdo->lastInsertId();      // az új sor azonosítója
        $insertSecret = $pdo->prepare('INSERT INTO user_secrets (user_id, password) VALUES (?, ?)'); // jelszó külön táblába
        $insertSecret->execute([$userId, password_hash($password, PASSWORD_BCRYPT)]); // bcrypt hash-sel, soha nem sima szövegként
        $pdo->commit();                   // véglegesítés
    } catch (Throwable $e) {              // ha bármi hiba történt
        $pdo->rollBack();                 // visszavonjuk az egészet
        throw $e;                         // továbbdobjuk a hibát (az index.php kezeli)
    }                                     // try-catch vége

    $user = ['id' => $userId, 'username' => $username, 'email' => $email, 'first_name' => null, 'last_name' => null, 'role_name' => 'vásárló']; // az új felhasználó adatai
    json_response([                       // sikeres válasz
        'token' => issue_token($user),    // belépési token, így regisztráció után rögtön be is van lépve
        'user' => public_user($user),     // a felhasználó nyilvános adatai
        'has_profile' => false,           // új fióknak még nincs testprofilja
    ], 201);                              // 201 = létrehozva
}                                         // függvény vége

/**
 * POST /api/auth/login – belépés e-maillel és jelszóval.
 */
function auth_login(): never              // nem tér vissza
{
    $body = read_json_body();             // a kérés adatai
    $email = strtolower(trim((string) ($body['email'] ?? ''))); // e-mail kisbetűsítve
    $password = (string) ($body['password'] ?? '');            // jelszó

    $stmt = db()->prepare(                // felhasználó és jelszó hash lekérése
        'SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_banned, r.role_name, s.password
           FROM users u
           JOIN user_roles r ON r.id = u.role_id
           JOIN user_secrets s ON s.user_id = u.id
          WHERE u.email = ?'              // az e-mail alapján
    );                                    // prepare vége
    $stmt->execute([$email]);             // végrehajtás
    $user = $stmt->fetch();               // a sor (vagy false)

    if (!$user) {                         // ha nincs ilyen e-mail
        json_error('Hibás adatok', 401, ['email' => 'Nincs fiók ezzel az e-mail címmel']); // 401 hiba
    }                                     // if vége
    if (!password_verify($password, $user['password'])) { // a jelszó összevetése a hash-sel
        json_error('Hibás adatok', 401, ['password' => 'Hibás jelszó']); // UI terv szerinti szöveg
    }                                     // if vége
    if ((int) $user['is_banned'] === 1) { // ha a fiók tiltva van
        json_error('Ez a fiók le van tiltva.', 403); // 403 = tiltott
    }                                     // if vége

    json_response([                       // sikeres válasz
        'token' => issue_token($user),    // belépési token
        'user' => public_user($user),     // nyilvános adatok (a jelszó hash NEM kerül bele)
        'has_profile' => user_has_profile((int) $user['id']), // van-e már avatarja
    ]);                                   // json_response vége
}                                         // függvény vége

/**
 * GET /api/auth/me – a bejelentkezett felhasználó adatai.
 */
function auth_me(): never                 // nem tér vissza
{
    $user = require_user();               // csak belépve érhető el
    json_response([                       // válasz
        'user' => public_user($user),     // nyilvános adatok
        'has_profile' => user_has_profile((int) $user['id']), // van-e testprofil
    ]);                                   // json_response vége
}                                         // függvény vége
