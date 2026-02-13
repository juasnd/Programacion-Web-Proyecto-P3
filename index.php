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
<link rel="stylesheet" href="./css/estilos.css?v=<?=time()?>">
</head>
<body>
  <div id="app"></div>

<script src="./js/api.js?v=<?=time()?>"></script>
<script src="./js/app.js?v=<?=time()?>"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>


</body>
</html>
