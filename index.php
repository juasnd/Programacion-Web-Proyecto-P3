<?php
if (isset($_GET["api"]) && $_GET["api"] === "1") {
    require_once __DIR__ . "/server/api.php";
    exit;
}
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>sistema web</title>
  <link rel="stylesheet" href="./css/estilos.css" />
</head>
<body>
  <div id="app"></div>

<script src="./js/api.js?v=3"></script>
<script src="./js/app.js?v=3"></script>

</body>
</html>
