-- =====================================================================
-- FitMe3D – adatbázis séma (MySQL / MariaDB)
-- Az "FitMe3D – Adatbázis terv" dokumentum alapján, 18 tábla.
-- Futtatás: phpMyAdmin → Importálás, vagy a backend/setup.php automatikusan.
-- =====================================================================

SET NAMES utf8mb4;                                   -- a kapcsolat UTF-8 kódolású, így az ő és ű is jól tárolódik
SET FOREIGN_KEY_CHECKS = 0;                          -- idegen kulcs ellenőrzés ideiglenes kikapcsolása, hogy bármilyen sorrendben törölhessünk

-- A régi táblák törlése, ha a séma újra van futtatva (fejlesztés közben hasznos)
DROP TABLE IF EXISTS favorites;                      -- kedvencek tábla törlése
DROP TABLE IF EXISTS reviews;                        -- értékelések tábla törlése
DROP TABLE IF EXISTS order_items;                    -- rendelési tételek tábla törlése
DROP TABLE IF EXISTS orders;                         -- rendelések tábla törlése
DROP TABLE IF EXISTS order_status;                   -- rendelési státuszok tábla törlése
DROP TABLE IF EXISTS cart_items;                     -- kosár tábla törlése
DROP TABLE IF EXISTS outfit_items;                   -- szett darabjai tábla törlése
DROP TABLE IF EXISTS outfits;                        -- szettek tábla törlése
DROP TABLE IF EXISTS size_charts;                    -- mérettáblázat törlése
DROP TABLE IF EXISTS product_models;                 -- 3D modellek tábla törlése
DROP TABLE IF EXISTS product_variants;               -- termékváltozatok tábla törlése
DROP TABLE IF EXISTS product_images;                 -- termékképek tábla törlése
DROP TABLE IF EXISTS products;                       -- termékek tábla törlése
DROP TABLE IF EXISTS categories;                     -- kategóriák tábla törlése
DROP TABLE IF EXISTS body_profiles;                  -- testprofilok tábla törlése
DROP TABLE IF EXISTS user_secrets;                   -- jelszavak tábla törlése
DROP TABLE IF EXISTS users;                          -- felhasználók tábla törlése
DROP TABLE IF EXISTS user_roles;                     -- szerepkörök tábla törlése

SET FOREIGN_KEY_CHECKS = 1;                          -- idegen kulcs ellenőrzés visszakapcsolása

-- ---------------------------------------------------------------------
-- FELHASZNÁLÓK
-- ---------------------------------------------------------------------

CREATE TABLE user_roles (                            -- szerepkörök szótára (vásárló, admin)
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,       -- azonosító, automatikusan növekszik
  role_name VARCHAR(50) NOT NULL,                    -- a szerepkör neve
  PRIMARY KEY (id),                                  -- elsődleges kulcs az id
  UNIQUE KEY uq_user_roles_name (role_name)          -- két szerepkörnek nem lehet ugyanaz a neve
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- InnoDB motor (tud idegen kulcsot), magyar rendezés

CREATE TABLE users (                                 -- regisztrált felhasználók alapadatai
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító, automatikusan növekszik
  username VARCHAR(50) NOT NULL,                     -- felhasználónév
  first_name VARCHAR(50) NULL,                       -- keresztnév (nem kötelező)
  last_name VARCHAR(50) NULL,                        -- vezetéknév (nem kötelező)
  email VARCHAR(100) NOT NULL,                       -- e-mail cím, ezzel lép be
  role_id TINYINT UNSIGNED NOT NULL DEFAULT 1,       -- szerepkör, alapból 1 = vásárló
  is_banned BOOLEAN NOT NULL DEFAULT 0,              -- tiltott-e a fiók, alapból nem
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- regisztráció ideje, automatikusan kitöltődik
  PRIMARY KEY (id),                                  -- elsődleges kulcs az id
  UNIQUE KEY uq_users_email (email),                 -- egy e-mail címmel csak egy fiók lehet
  UNIQUE KEY uq_users_username (username),           -- egy felhasználónév csak egyszer szerepelhet
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES user_roles (id) -- a role_id a user_roles táblára mutat
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE user_secrets (                          -- jelszavak külön táblában, 1:1 a felhasználóval
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- melyik felhasználóé
  password CHAR(60) NOT NULL,                        -- bcrypt hash (mindig 60 karakter), soha nem sima szöveg
  last_used_pass CHAR(60) NULL,                      -- az előző jelszó hash-e, a trigger tölti ki
  pass_update_token VARCHAR(60) NULL,                -- jelszó-visszaállító token (később)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_user_secrets_user (user_id),         -- felhasználónként egy jelszó-rekord
  CONSTRAINT fk_user_secrets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE -- fiók törlésekor ez is törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE body_profiles (                         -- testméretek, ebből épül az avatar a böngészőben
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- melyik felhasználóé
  gender TINYINT UNSIGNED NOT NULL,                  -- nem: 0 = nő, 1 = férfi
  height_cm SMALLINT UNSIGNED NOT NULL,              -- magasság centiméterben
  weight_kg DECIMAL(5,1) NOT NULL,                   -- testsúly kilogrammban, egy tizedessel
  chest_cm DECIMAL(5,1) NOT NULL,                    -- mellbőség cm-ben
  waist_cm DECIMAL(5,1) NOT NULL,                    -- derékbőség cm-ben
  hip_cm DECIMAL(5,1) NOT NULL,                      -- csípőbőség cm-ben
  photo_path VARCHAR(255) NULL,                      -- fotó a méretbecsléshez (Extra szint, most üres)
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- utolsó módosítás, magától frissül
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_body_profiles_user (user_id),        -- felhasználónként egy testprofil
  CONSTRAINT fk_body_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, -- fiók törlésekor törlődik
  CONSTRAINT chk_body_gender CHECK (gender IN (0, 1)) -- a nem csak 0 vagy 1 lehet
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

-- ---------------------------------------------------------------------
-- KATALÓGUS
-- ---------------------------------------------------------------------

CREATE TABLE categories (                            -- termékkategóriák szótára
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,      -- azonosító
  name VARCHAR(50) NOT NULL,                         -- kategória neve (pl. Pólók)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_categories_name (name)               -- egy név csak egyszer
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE products (                              -- a webshop termékei
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  category_id SMALLINT UNSIGNED NOT NULL,            -- melyik kategóriába tartozik
  name VARCHAR(100) NOT NULL,                        -- terméknév
  description TEXT NULL,                             -- leírás, anyag és ápolás
  base_price INT UNSIGNED NOT NULL,                  -- alapár forintban
  is_active BOOLEAN NOT NULL DEFAULT 1,              -- látszik-e a boltban (törlés helyett 0-ra állítjuk)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- felvétel ideje
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  KEY idx_products_category_active (category_id, is_active), -- index a böngészéshez és szűréshez
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) -- kategóriára mutat
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE product_images (                        -- termékfotók
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  product_id INT UNSIGNED NOT NULL,                  -- melyik termék képe
  file_path VARCHAR(255) NOT NULL,                   -- a kép elérési útja
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE -- termékkel együtt törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE product_variants (                      -- méret + szín változatok, itt van a készlet
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  product_id INT UNSIGNED NOT NULL,                  -- melyik termék változata
  size VARCHAR(10) NOT NULL,                         -- méret (XS–XXL)
  color_name VARCHAR(30) NOT NULL,                   -- szín neve (pl. Sötétkék)
  color_hex CHAR(7) NOT NULL,                        -- szín hex kódja (pl. #1E3A5F), ezzel színezzük a 3D ruhát
  stock SMALLINT UNSIGNED NOT NULL DEFAULT 0,        -- készlet darabszám (UNSIGNED, így nem lehet negatív)
  price INT UNSIGNED NULL,                           -- változat ára, ha eltér az alapártól (különben NULL)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_variant (product_id, size, color_name), -- egy méret+szín csak egyszer egy terméken
  KEY idx_variants_product (product_id),             -- index a méret- és színválasztóhoz
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE -- termékkel együtt törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE product_models (                        -- a termék 3D modellje (GLB fájl)
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  product_id INT UNSIGNED NOT NULL,                  -- melyik termék modellje
  glb_path VARCHAR(255) NOT NULL,                    -- a GLB fájl elérési útja
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- feltöltés ideje
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_product_models_product (product_id), -- termékenként egy modell
  CONSTRAINT fk_product_models_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE -- termékkel együtt törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE size_charts (                           -- mérettáblázat: a RUHA méretei méretenként
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  product_id INT UNSIGNED NOT NULL,                  -- melyik termék mérettáblázata
  size VARCHAR(10) NOT NULL,                         -- méret (pl. M)
  chest_cm DECIMAL(5,1) NULL,                        -- a ruha mellbősége cm-ben (nadrágnál NULL)
  waist_cm DECIMAL(5,1) NULL,                        -- a ruha derékbősége cm-ben
  hip_cm DECIMAL(5,1) NULL,                          -- a ruha csípőbősége cm-ben (pólónál NULL)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_size_charts (product_id, size),      -- méretenként egy sor
  CONSTRAINT fk_size_charts_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE -- termékkel együtt törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

-- ---------------------------------------------------------------------
-- SZETTEK, KOSÁR, RENDELÉS
-- ---------------------------------------------------------------------

CREATE TABLE outfits (                               -- mentett szettek
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- kié a szett
  name VARCHAR(100) NOT NULL,                        -- a szett neve
  share_token VARCHAR(36) NOT NULL,                  -- megosztási kód (UUID)
  color_rating VARCHAR(30) NULL,                     -- színösszhang értékelés (Harmonikus, Elfogadható, Ütköző)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- mentés ideje
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_outfits_token (share_token),         -- a megosztott link egyedi
  CONSTRAINT fk_outfits_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE -- fiók törlésekor törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE outfit_items (                          -- a szett darabjai slotokba rendezve
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  outfit_id INT UNSIGNED NOT NULL,                   -- melyik szetthez tartozik
  variant_id INT UNSIGNED NOT NULL,                  -- melyik termékváltozat (méret + szín)
  slot TINYINT UNSIGNED NOT NULL,                    -- 0 = felső, 1 = nadrág, 2 = kiegészítő
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_outfit_slot (outfit_id, slot),       -- egy slotban csak egy darab
  CONSTRAINT fk_outfit_items_outfit FOREIGN KEY (outfit_id) REFERENCES outfits (id) ON DELETE CASCADE, -- szettel együtt törlődik
  CONSTRAINT fk_outfit_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id), -- változatra mutat
  CONSTRAINT chk_outfit_slot CHECK (slot BETWEEN 0 AND 2) -- a slot csak 0, 1 vagy 2 lehet
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE cart_items (                            -- kosár tartalma
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- kinek a kosara
  variant_id INT UNSIGNED NOT NULL,                  -- melyik változat van benne
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,     -- darabszám
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_cart (user_id, variant_id),          -- ugyanaz a változat egy sorban, a darabszám nő
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, -- fiók törlésekor törlődik
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id), -- változatra mutat
  CONSTRAINT chk_cart_quantity CHECK (quantity >= 1) -- legalább 1 darab
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE order_status (                          -- rendelési státuszok szótára
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,       -- azonosító
  status_name VARCHAR(50) NOT NULL,                  -- státusz neve (Feldolgozás, ...)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_order_status_name (status_name)      -- egy név csak egyszer
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE orders (                                -- leadott rendelések fejléce
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NULL,                         -- ki rendelte (NULL lehet: fióktörlés után megmarad a rendelés)
  status_id TINYINT UNSIGNED NOT NULL DEFAULT 1,     -- státusz, alapból 1 = Feldolgozás
  order_number VARCHAR(20) NOT NULL,                 -- rendelési szám a visszaigazoláson
  shipping_name VARCHAR(100) NOT NULL,               -- átvevő neve (rendeléskor lemásolva)
  shipping_zip VARCHAR(10) NOT NULL,                 -- irányítószám
  shipping_city VARCHAR(100) NOT NULL,               -- város
  shipping_address VARCHAR(255) NOT NULL,            -- utca, házszám
  total_price INT UNSIGNED NOT NULL,                 -- végösszeg forintban, rendeléskor rögzítve
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- rendelés ideje
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_orders_number (order_number),        -- a rendelési szám egyedi
  KEY idx_orders_user_date (user_id, created_at),    -- index a "Rendeléseim" listához
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL, -- fióktörléskor a rendelés marad, user_id NULL lesz
  CONSTRAINT fk_orders_status FOREIGN KEY (status_id) REFERENCES order_status (id) -- státuszra mutat
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE order_items (                           -- a rendelés tételei
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  order_id INT UNSIGNED NOT NULL,                    -- melyik rendeléshez tartozik
  variant_id INT UNSIGNED NOT NULL,                  -- melyik változatot rendelték
  quantity SMALLINT UNSIGNED NOT NULL,               -- darabszám
  unit_price INT UNSIGNED NOT NULL,                  -- egységár rendeléskor (későbbi áremelés nem érinti)
  is_returned BOOLEAN NOT NULL DEFAULT 0,            -- visszaküldték-e (statisztikához)
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  KEY idx_order_items_variant (variant_id),          -- index a népszerűségi statisztikához
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE, -- rendeléssel együtt törlődik
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id), -- változatra mutat
  CONSTRAINT chk_order_items_quantity CHECK (quantity >= 1) -- legalább 1 darab
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE reviews (                               -- értékelések
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- ki írta
  product_id INT UNSIGNED NOT NULL,                  -- melyik termékről
  rating TINYINT UNSIGNED NOT NULL,                  -- 1–5 csillag
  size_fit TINYINT UNSIGNED NOT NULL,                -- méretpontosság: 0 = kicsi, 1 = pont jó, 2 = nagy
  comment TEXT NULL,                                 -- szöveges vélemény
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- írás ideje
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_reviews_user_product (user_id, product_id), -- egy termékre egy értékelés felhasználónként
  KEY idx_reviews_product (product_id),              -- index a termékoldali összesítéshez
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, -- fiók törlésekor törlődik
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id), -- termékre mutat
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5), -- csak 1 és 5 közötti csillag
  CONSTRAINT chk_reviews_size_fit CHECK (size_fit BETWEEN 0 AND 2) -- csak 0, 1 vagy 2
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

CREATE TABLE favorites (                             -- kedvenc termékek
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,           -- azonosító
  user_id INT UNSIGNED NOT NULL,                     -- kinek a kedvence
  product_id INT UNSIGNED NOT NULL,                  -- melyik termék
  PRIMARY KEY (id),                                  -- elsődleges kulcs
  UNIQUE KEY uq_favorites (user_id, product_id),     -- egy termék csak egyszer lehet kedvenc
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, -- fiók törlésekor törlődik
  CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE -- termékkel együtt törlődik
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci; -- tábla beállítások

-- ---------------------------------------------------------------------
-- TRIGGER: jelszóváltáskor az előző hash elmentése
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_user_secrets_before_update; -- ha már létezik, töröljük

DELIMITER $$
-- A DELIMITER sor átállítja a parancs-elválasztót $$-ra, mert a trigger belsejében is van pontosvessző

CREATE TRIGGER trg_user_secrets_before_update        -- a trigger neve
BEFORE UPDATE ON user_secrets                        -- a user_secrets tábla módosítása ELŐTT fut le
FOR EACH ROW                                         -- minden módosított sorra külön
BEGIN                                                -- a trigger törzsének kezdete
  IF NEW.password <> OLD.password THEN               -- ha a jelszó tényleg megváltozott
    SET NEW.last_used_pass = OLD.password;           -- a régi hash bekerül a last_used_pass mezőbe
  END IF;                                            -- feltétel vége
END$$
-- a trigger vége, $$ zárja le a parancsot

DELIMITER ;
-- az elválasztó visszaállítása pontosvesszőre
