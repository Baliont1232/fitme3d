# FitMe3D – Virtuális próbafülke (vizsgaremek)

Ruha webshop, ahol a vásárló a saját testméreteiből készült 3D avatarján próbálja fel a ruhákat.
Készítették: Balló Márk, Bari Dániel, Burcsa Bálint.

> **Állapot: prototípus.** A fókusz a 3D mag: paraméteres avatar, ruhák, méretváltás, illeszkedési térkép és méretajánló. A kosár, a rendelés, a szettépítő és az admin a következő körökben jön.

## Mi működik most

| Funkció | Hol |
| --- | --- |
| Paraméteres 3D avatar a méretekből (nem, magasság, súly, mell, derék, csípő), élő előnézettel | `/avatar` |
| Ruhák kódból generált 3D modellje: póló, pulóver, nadrág, öv | `frontend/src/three/garments.js` |
| Méret- és színváltás a próbafülkében, a ruha 200 ms alatt "átúszik" az új méretre | `/termek/:id` |
| Illeszkedési térkép (zöld / sárga / piros) régiónként, jelmagyarázattal | próbafülke, "Illeszkedési térkép" gomb |
| Méretajánló indoklással ("Neked az M méret ajánlott – derékban kissé szűk") és "Miért?" részletekkel | próbafülke |
| Elöl / Oldal / Hát nézet, nagyítás, forgatás egérrel, ujjal és a nyilakkal | próbafülke |
| Ruhák böngészése kategóriával és kereséssel, "Neked: M" jelvény | `/ruhak` |
| Regisztráció, belépés (saját JWT), testprofil mentése a fiókba | `/belepes` |
| MySQL séma mind a 18 táblával, triggerrel, seed adatokkal | `database/` |

Demó fiók: **demo@fitme3d.hu / Demo1234** (van testprofilja). Admin: admin@fitme3d.hu / Admin1234.

## Felépítés

```
fitme3d/
├── frontend/          React + Three.js (Vite)
│   └── src/
│       ├── three/     A 3D MAG: bodyModel.js (test), garments.js (ruhák), loft.js (geometria),
│       │              Stage3D.jsx (vászon), GarmentMesh.jsx (ruha + animáció), CameraRig.jsx (kamera)
│       ├── fit/       fitCalc.js – a méretajánló és a térkép KÖZÖS számítása + unit tesztek
│       ├── pages/     oldalak (kezdőlap, ruhák, termék/próbafülke, avatar, belépés)
│       ├── components/ újrahasznosítható UI elemek
│       ├── context/   belépés + testprofil, értesítések
│       └── styles/    tokens.css (design tokenek), base/components/pages.css
├── backend/           PHP REST API (sima PHP + PDO, keretrendszer nélkül)
│   ├── index.php      belépési pont és útválasztás
│   ├── routes/        végpontok: auth, products, body_profile
│   ├── lib/           db, jwt, auth, response, fit_config (méretellenőrzés)
│   └── setup.php      adatbázis létrehozása parancssorból
├── database/          schema.sql (18 tábla + trigger), seed.sql (6 termék, demó fiókok)
├── shared/            fit-config.json – mérettartományok, ráhagyás-küszöbök (a PHP és a React is ezt olvassa)
├── docker/            Railway / Docker indítás (Apache beállítás, start.sh)
└── docs/              a tervdokumentumok
```

## API végpontok

| Metódus | Útvonal | Leírás | Belépés kell? |
| --- | --- | --- | --- |
| GET | `/api/health` | Működik-e a szerver és az adatbázis | nem |
| POST | `/api/auth/register` | Regisztráció (email, password, password_confirm) | nem |
| POST | `/api/auth/login` | Belépés, JWT tokent ad | nem |
| GET | `/api/auth/me` | Saját adatok | igen |
| GET | `/api/categories` | Kategóriák | nem |
| GET | `/api/products?category=1&q=farmer` | Terméklista szűréssel | nem |
| GET | `/api/products/{id}` | Termék változatokkal és mérettáblázattal | nem |
| GET / PUT | `/api/body-profile` | Saját testprofil lekérése / mentése | igen |

## Futtatás a saját gépen (XAMPP + Node.js)

Kell hozzá: **XAMPP** (Apache, MySQL, PHP) és **Node.js 20+** (csak a frontend fordításához és fejlesztéséhez).

1. **Adatbázis:** indítsd el a MySQL-t a XAMPP Control Panelben. A phpMyAdminban hozz létre egy `fitme3d` adatbázist (`utf8mb4_hungarian_ci`), és importáld a `database/schema.sql`, majd a `database/seed.sql` fájlt.
   Vagy parancssorból: `C:\xampp\php\php.exe backend\setup.php`
2. **PHP API:** a projekt mappájában:
   ```
   C:\xampp\php\php.exe -S localhost:8000 backend/router.php
   ```
   Ellenőrzés: <http://localhost:8000/api/health> → `{"ok":true,"db":true}`
3. **Frontend:** egy másik terminálban:
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Az oldal: <http://localhost:5173> (a `/api` kéréseket a Vite továbbítja a PHP szervernek).
4. **Tesztek:** `cd frontend && npm test` (a méretajánló unit tesztjei).

Az adatbázis kapcsolat alapból a XAMPP beállításait használja (`root`, üres jelszó, `fitme3d` adatbázis). Ha más kell, környezeti változókkal felülírható: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `JWT_SECRET`.

## Online (Railway)

A Railway a gyökérben lévő `Dockerfile`-ból építi az oldalt: lefordítja a React frontendet, és egy PHP + Apache szerverre teszi az API-val együtt. Induláskor a `setup.php` feltölti az üres adatbázist. A Railway projektben két szolgáltatás van: az oldal és egy MySQL adatbázis. Az oldal a **`main` ágról** frissül: minden push a `main`-re pár perc alatt automatikusan megjelenik az élő oldalon.

Élő oldal: <https://web-production-41258.up.railway.app>

## Hogyan működik a 3D

- **Avatar:** nincs Blender modell. A test egymás fölé tett keresztmetszetekből (gyűrűkből) épül, ezeket a `loft.js` köti össze háromszögekké. A mell-, derék- és csípőgyűrű kerülete **pontosan** a megadott cm érték. A többi arányt (váll, nyak, végtagok) átlagos emberi arányokból számolja a `bodyModel.js`.
- **Ruha:** a test gyűrűi kinagyítva. A póló M méretének mellbősége a mérettáblázatban 106 cm, ezért a 3D ruha gyűrűje a mell magasságában pontosan 106 cm kerületű. Ha a ruha kisebb a testnél, rásimul, és a térkép pirossal jelzi, hogy szorít.
- **Illeszkedés:** ráhagyás = ruha mérete − test mérete. A küszöbök ruhatípusonként a `shared/fit-config.json`-ban vannak, nem a kódban. A méretajánló és a térkép ugyanazt a függvényt használja (`fitCalc.js`), így soha nem mondanak ellent egymásnak.
- **Később:** a kódból generált avatar lecserélhető egy Blenderes, morph targetes GLB modellre ugyanazzal a méretleképezéssel. A `product_models` tábla és az API már fogadja a GLB útvonalat (3D megvalósítási terv 3.4 és 4.1).

## Kódolási szabály a csapatban

**Minden sor mellé (vagy JSX-ben fölé) magyar komment kerül, ami elmondja, mit csinál.** Így bármelyik sort el tudjuk magyarázni a vizsgán.
Két kivétel van: a JSON fájlokba (pl. `package.json`, `fit-config.json`) nem lehet kommentet írni, ezért ott a `leiras` mező magyaráz; a 3D-s JSX-ben pedig a megjegyzés mindig külön sorba kerül, mert a sorközi szóköz hibát okoz a 3D fában.

## Git munkafolyamat

Minden a `main` ágon van, és az élő oldal is ebből frissül. Nagyobb feladatokhoz érdemes `feature/...` ágat nyitni, és pull requesttel, kölcsönös code review után a `main`-be fésülni.
