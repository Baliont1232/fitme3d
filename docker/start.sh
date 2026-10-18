#!/bin/sh
# =====================================================================
# start.sh – a konténer indító scriptje
# =====================================================================

# hiba esetén álljon le a script
set -e

# a Railway a PORT változóban adja meg, melyik porton kell figyelni (alapból 80)
PORT="${PORT:-80}"
# az Apache ezen a porton figyeljen
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf

# az Apache-ban egyszerre csak egy "MPM" (kérésfeldolgozó modul) lehet; a PHP modulhoz a prefork kell,
# ezért a másik kettőt kikapcsoljuk (különben: "More than one MPM loaded" hiba)
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
# a prefork modul bekapcsolása (ha már be van kapcsolva, nem csinál semmit)
a2enmod mpm_prefork >/dev/null 2>&1 || true

# az adatbázis létrehozása és feltöltése, ha még üres (újraindításkor nem tölti újra)
php /var/www/html/api/setup.php

# az Apache indítása az előtérben (így a konténer fut, amíg az Apache fut)
exec apache2-foreground
