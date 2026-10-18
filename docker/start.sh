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

# az adatbázis létrehozása és feltöltése, ha még üres (újraindításkor nem tölti újra)
php /var/www/html/api/setup.php

# az Apache indítása az előtérben (így a konténer fut, amíg az Apache fut)
exec apache2-foreground
