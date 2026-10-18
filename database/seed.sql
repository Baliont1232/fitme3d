-- =====================================================================
-- FitMe3D – kezdő (seed) adatok a prototípushoz
-- Szótárak, 6 termék változatokkal és mérettáblázattal, 2 demó fiók.
-- A schema.sql UTÁN kell futtatni.
-- =====================================================================

SET NAMES utf8mb4;                                   -- UTF-8 kapcsolat, hogy az ékezetek jól menjenek

-- Szerepkörök (az id-k fontosak: 1 = vásárló, 2 = admin)
INSERT INTO user_roles (id, role_name) VALUES        -- szerepkörök beszúrása
  (1, 'vásárló'),                                    -- alap szerepkör minden új regisztrálónak
  (2, 'admin');                                      -- adminisztrátor

-- Rendelési státuszok a UI terv idővonala szerint
INSERT INTO order_status (id, status_name) VALUES    -- státuszok beszúrása
  (1, 'Feldolgozás'),                                -- 1. lépés
  (2, 'Csomagolás'),                                 -- 2. lépés
  (3, 'Szállítás'),                                  -- 3. lépés
  (4, 'Kézbesítve');                                 -- 4. lépés

-- Kategóriák (a frontend a névből tudja, milyen 3D ruhát kell építeni)
INSERT INTO categories (id, name) VALUES             -- kategóriák beszúrása
  (1, 'Pólók'),                                      -- rövid ujjú felsők
  (2, 'Felsők'),                                     -- pulóverek
  (3, 'Nadrágok'),                                   -- hosszú nadrágok
  (4, 'Kiegészítők');                                -- öv

-- ---------------------------------------------------------------------
-- Termékek
-- ---------------------------------------------------------------------
INSERT INTO products (id, category_id, name, description, base_price) VALUES -- termékek beszúrása
  (1, 1, 'Basic pamut póló', 'Klasszikus, egyenes szabású póló 100% pamutból. Mosás 30 °C-on, kifordítva.', 5990), -- 1. termék
  (2, 1, 'Slim fit póló', 'Testhez simuló póló sztreccses pamutból (95% pamut, 5% elasztán). Mosás 30 °C-on.', 6990), -- 2. termék
  (3, 2, 'Kerek nyakú pulóver', 'Puha, lazább szabású kötött pulóver. 70% pamut, 30% gyapjú. Kézi mosás.', 12990), -- 3. termék
  (4, 3, 'Egyenes szárú farmer', 'Középmagas derekú, egyenes szárú farmer. 99% pamut, 1% elasztán.', 14990), -- 4. termék
  (5, 3, 'Slim chino nadrág', 'Elegáns, karcsúsított chino nadrág. 98% pamut, 2% elasztán.', 11990), -- 5. termék
  (6, 4, 'Bőr öv', 'Marhabőr öv fém csattal, 3,5 cm széles. Méret a derékbőség szerint.', 4990); -- 6. termék

-- ---------------------------------------------------------------------
-- Mérettáblázat: a RUHA körméretei cm-ben (nem a testé!)
-- A méretajánló ezt hasonlítja a testméretekhez: ráhagyás = ruha - test
-- ---------------------------------------------------------------------
INSERT INTO size_charts (product_id, size, chest_cm, waist_cm, hip_cm) VALUES -- mérettáblázat sorai
  (1, 'S',  96.0,  92.0, NULL),                      -- Basic póló S: mell 96, derék 92 (csípőt nem mérünk)
  (1, 'M', 106.0, 102.0, NULL),                      -- Basic póló M
  (1, 'L', 116.0, 112.0, NULL),                      -- Basic póló L
  (1, 'XL',126.0, 122.0, NULL),                      -- Basic póló XL
  (2, 'S',  92.0,  86.0, NULL),                      -- Slim póló S: szűkebb, mint a Basic
  (2, 'M', 100.0,  94.0, NULL),                      -- Slim póló M
  (2, 'L', 108.0, 102.0, NULL),                      -- Slim póló L
  (2, 'XL',116.0, 110.0, NULL),                      -- Slim póló XL
  (3, 'S', 100.0,  96.0,  96.0),                     -- Pulóver S: mell, derék és csípő is számít
  (3, 'M', 110.0, 106.0, 106.0),                     -- Pulóver M
  (3, 'L', 120.0, 116.0, 116.0),                     -- Pulóver L
  (3, 'XL',130.0, 126.0, 126.0),                     -- Pulóver XL
  (4, 'S', NULL,  76.0,  96.0),                      -- Farmer S: derék 76, csípő 96 (mellet nem mérünk)
  (4, 'M', NULL,  84.0, 104.0),                      -- Farmer M
  (4, 'L', NULL,  92.0, 112.0),                      -- Farmer L
  (4, 'XL',NULL, 100.0, 120.0),                      -- Farmer XL
  (5, 'S', NULL,  74.0,  94.0),                      -- Chino S: szűkebb csípő
  (5, 'M', NULL,  82.0, 100.0),                      -- Chino M
  (5, 'L', NULL,  90.0, 108.0),                      -- Chino L
  (5, 'XL',NULL,  98.0, 116.0),                      -- Chino XL
  (6, 'S', NULL,  80.0, NULL),                       -- Öv S: a középső lyuk hossza 80 cm
  (6, 'M', NULL,  90.0, NULL),                       -- Öv M
  (6, 'L', NULL, 100.0, NULL),                       -- Öv L
  (6, 'XL',NULL, 110.0, NULL);                       -- Öv XL

-- ---------------------------------------------------------------------
-- Változatok (méret + szín + készlet). A 0 készlet az "elfogyott" állapotot mutatja be.
-- ---------------------------------------------------------------------
INSERT INTO product_variants (product_id, size, color_name, color_hex, stock) VALUES -- változatok beszúrása
  (1, 'S', 'Fehér', '#F5F5F4', 12), (1, 'M', 'Fehér', '#F5F5F4', 20), (1, 'L', 'Fehér', '#F5F5F4', 15), (1, 'XL', 'Fehér', '#F5F5F4', 6),           -- Basic póló fehér, 4 méret
  (1, 'S', 'Fekete', '#26292E', 10), (1, 'M', 'Fekete', '#26292E', 18), (1, 'L', 'Fekete', '#26292E', 0), (1, 'XL', 'Fekete', '#26292E', 4),        -- Basic póló fekete, L elfogyott
  (1, 'S', 'Sötétkék', '#1E3A5F', 8), (1, 'M', 'Sötétkék', '#1E3A5F', 14), (1, 'L', 'Sötétkék', '#1E3A5F', 11), (1, 'XL', 'Sötétkék', '#1E3A5F', 3), -- Basic póló sötétkék
  (1, 'S', 'Korall', '#E8735A', 5), (1, 'M', 'Korall', '#E8735A', 9), (1, 'L', 'Korall', '#E8735A', 7), (1, 'XL', 'Korall', '#E8735A', 2),            -- Basic póló korall
  (2, 'S', 'Szürke melír', '#9CA3AF', 9), (2, 'M', 'Szürke melír', '#9CA3AF', 12), (2, 'L', 'Szürke melír', '#9CA3AF', 10), (2, 'XL', 'Szürke melír', '#9CA3AF', 4), -- Slim póló szürke
  (2, 'S', 'Olívazöld', '#5B6B3A', 6), (2, 'M', 'Olívazöld', '#5B6B3A', 0), (2, 'L', 'Olívazöld', '#5B6B3A', 8), (2, 'XL', 'Olívazöld', '#5B6B3A', 3),  -- Slim póló olíva, M elfogyott
  (2, 'S', 'Bordó', '#7A1F2B', 7), (2, 'M', 'Bordó', '#7A1F2B', 10), (2, 'L', 'Bordó', '#7A1F2B', 6), (2, 'XL', 'Bordó', '#7A1F2B', 2),               -- Slim póló bordó
  (3, 'S', 'Bézs', '#D6C3A5', 5), (3, 'M', 'Bézs', '#D6C3A5', 8), (3, 'L', 'Bézs', '#D6C3A5', 6), (3, 'XL', 'Bézs', '#D6C3A5', 3),                    -- Pulóver bézs
  (3, 'S', 'Sötétzöld', '#1F4D3A', 4), (3, 'M', 'Sötétzöld', '#1F4D3A', 7), (3, 'L', 'Sötétzöld', '#1F4D3A', 5), (3, 'XL', 'Sötétzöld', '#1F4D3A', 2),   -- Pulóver sötétzöld
  (3, 'S', 'Antracit', '#374151', 6), (3, 'M', 'Antracit', '#374151', 9), (3, 'L', 'Antracit', '#374151', 7), (3, 'XL', 'Antracit', '#374151', 4),     -- Pulóver antracit
  (4, 'S', 'Középkék', '#4A6A9A', 8), (4, 'M', 'Középkék', '#4A6A9A', 12), (4, 'L', 'Középkék', '#4A6A9A', 10), (4, 'XL', 'Középkék', '#4A6A9A', 5),   -- Farmer középkék
  (4, 'S', 'Sötétkék', '#1F2A44', 7), (4, 'M', 'Sötétkék', '#1F2A44', 11), (4, 'L', 'Sötétkék', '#1F2A44', 9), (4, 'XL', 'Sötétkék', '#1F2A44', 4),     -- Farmer sötétkék
  (4, 'S', 'Fekete', '#1A1D23', 6), (4, 'M', 'Fekete', '#1A1D23', 10), (4, 'L', 'Fekete', '#1A1D23', 8), (4, 'XL', 'Fekete', '#1A1D23', 0),             -- Farmer fekete, XL elfogyott
  (5, 'S', 'Homok', '#C8B48A', 6), (5, 'M', 'Homok', '#C8B48A', 9), (5, 'L', 'Homok', '#C8B48A', 7), (5, 'XL', 'Homok', '#C8B48A', 3),                 -- Chino homok
  (5, 'S', 'Sötétkék', '#1E3A5F', 5), (5, 'M', 'Sötétkék', '#1E3A5F', 8), (5, 'L', 'Sötétkék', '#1E3A5F', 6), (5, 'XL', 'Sötétkék', '#1E3A5F', 2),     -- Chino sötétkék
  (5, 'S', 'Khaki', '#6E6A45', 4), (5, 'M', 'Khaki', '#6E6A45', 7), (5, 'L', 'Khaki', '#6E6A45', 5), (5, 'XL', 'Khaki', '#6E6A45', 2),                 -- Chino khaki
  (6, 'S', 'Barna', '#6B4226', 10), (6, 'M', 'Barna', '#6B4226', 14), (6, 'L', 'Barna', '#6B4226', 9), (6, 'XL', 'Barna', '#6B4226', 5),               -- Öv barna
  (6, 'S', 'Fekete', '#1F2328', 8), (6, 'M', 'Fekete', '#1F2328', 12), (6, 'L', 'Fekete', '#1F2328', 7), (6, 'XL', 'Fekete', '#1F2328', 4);           -- Öv fekete

-- ---------------------------------------------------------------------
-- Demó fiókok. Jelszavak: demo@fitme3d.hu → Demo1234, admin@fitme3d.hu → Admin1234
-- A jelszó bcrypt hash-ként van tárolva (PHP password_hash függvénnyel készült).
-- ---------------------------------------------------------------------
INSERT INTO users (id, username, first_name, last_name, email, role_id) VALUES -- felhasználók beszúrása
  (1, 'demo', 'Demó', 'Vásárló', 'demo@fitme3d.hu', 1),                    -- vásárló szerepkörű demó fiók
  (2, 'admin', 'Admin', 'FitMe3D', 'admin@fitme3d.hu', 2);                 -- admin szerepkörű demó fiók

INSERT INTO user_secrets (user_id, password) VALUES  -- jelszó hash-ek beszúrása
  (1, '$2y$10$eWF0H8GiqUvxfkBp.Gi/ru3xJIJxV00sAa8avoY1gHry4ciQpvUBa'),     -- Demo1234 hash-e
  (2, '$2y$10$fxi3FFv5MVVcpumTfUv9geIebGiwOX7FRvw2liypHpCd9Vc7DKKty');     -- Admin1234 hash-e

-- A demó vásárlónak már van testprofilja, így belépés után azonnal lehet próbálni
INSERT INTO body_profiles (user_id, gender, height_cm, weight_kg, chest_cm, waist_cm, hip_cm) VALUES -- testprofil beszúrása
  (1, 1, 180, 78.0, 100.0, 86.0, 100.0);             -- férfi, 180 cm, 78 kg, mell 100, derék 86, csípő 100
