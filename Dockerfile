# =====================================================================
# Dockerfile – a Railway (vagy bármely Docker tárhely) ebből építi az oldalt
# Két lépés: 1) Node.js-szel lefordítjuk a React frontendet sima
# HTML/JS fájlokká, 2) egy PHP + Apache képbe másoljuk a kész oldalt és
# a PHP API-t. A szerveren tehát csak Apache + PHP fut, mint XAMPP-ban.
# =====================================================================

# --- 1. lépés: a frontend lefordítása ---------------------------------
# Node.js 20-as kép, csak a fordításhoz kell
FROM node:20-alpine AS frontend
# munkakönyvtár a képen belül
WORKDIR /app
# a közös konfiguráció (a frontend importálja a fit-config.json-t)
COPY shared ./shared
# először csak a csomaglistát másoljuk, így a telepítés gyorsítótárazható
COPY frontend/package.json frontend/package-lock.json ./frontend/
# a függőségek pontos telepítése a package-lock.json szerint
RUN cd frontend && npm ci
# a frontend forráskódja
COPY frontend ./frontend
# fordítás: az eredmény a frontend/dist mappába kerül
RUN cd frontend && npm run build

# --- 2. lépés: PHP + Apache szerver ------------------------------------
# hivatalos PHP 8.3 kép beépített Apache-csal
FROM php:8.3-apache
# MySQL PDO meghajtó telepítése, az URL-átíró és a tömörítő (deflate) modul bekapcsolása
RUN docker-php-ext-install pdo_mysql && a2enmod rewrite deflate
# Apache beállítás: SPA útvonalak, /api a PHP-hoz
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
# a lefordított frontend a webszerver gyökerébe
COPY --from=frontend /app/frontend/dist /var/www/html
# a PHP API az /api mappába (a .htaccess-szel együtt)
COPY backend /var/www/html/api
# a közös konfiguráció a backend mellé (a config.php itt is keresi)
COPY shared /var/www/html/api/shared
# az SQL fájlok a setup.php-nak (kívülről nem érhetők el, lásd apache.conf)
COPY database /var/www/html/api/database
# indító script
COPY docker/start.sh /usr/local/bin/start.sh
# futtathatóvá tesszük (Windows-on szerkesztve a sorvégek is javítva)
RUN sed -i 's/\r$//' /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh
# induláskor ez fut: adatbázis feltöltése, majd Apache
CMD ["start.sh"]
