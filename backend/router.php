<?php
// =====================================================================
// router.php – csak a PHP beépített fejlesztői szerveréhez kell:
//   php -S localhost:8000 backend/router.php
// Minden kérést az index.php-ra irányít (ahogy élesben az Apache).
// =====================================================================

require __DIR__ . '/index.php'; // minden kérés az API belépési pontjára fut
