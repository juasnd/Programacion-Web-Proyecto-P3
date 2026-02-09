<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/conexion.php";
require_once __DIR__ . "/auditoria.php";
require_once __DIR__ . "/auth.php";

header("Content-Type: application/json; charset=utf-8");

$action = $_GET["action"] ?? "";
$raw = file_get_contents("php://input");
$body = $raw ? json_decode($raw, true) : [];
if (!is_array($body)) $body = [];

function ok($arr = []) {
  echo json_encode(array_merge(["ok" => true], $arr), JSON_UNESCAPED_UNICODE);
  exit;
}
function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(["ok" => false, "error" => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

require_login();

/* ===================== helpers ===================== */

function get_curso($curso_id) {
  global $enlace;
  $cid = (int)$curso_id;
  if ($cid <= 0) return null;

  $st = mysqli_prepare($enlace, "
    SELECT c.id,c.nombre,c.paralelo,c.periodo,c.docente_id,c.creado_por,c.creado_en,c.activo,
           COALESCE(u.usuario,'') AS docente_usuario,
           CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,'')) AS docente_nombre
    FROM cursos c
    LEFT JOIN usuarios u ON u.id=c.docente_id
    WHERE c.id=? LIMIT 1
  ");
  if (!$st) return null;
  mysqli_stmt_bind_param($st, "i", $cid);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $row = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);
  return $row;
}

function can_docente_curso($curso_id) {
  global $enlace;
  $cid = (int)$curso_id;
  $uid = (int)($_SESSION["usuario_id"] ?? 0);
  if ($cid <= 0 || $uid <= 0) return false;

  $st = mysqli_prepare($enlace, "SELECT 1 FROM cursos WHERE id=? AND docente_id=? AND activo=1 LIMIT 1");
  if (!$st) return false;
  mysqli_stmt_bind_param($st, "ii", $cid, $uid);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $ok = ($res && mysqli_fetch_row($res)) ? true : false;
  mysqli_stmt_close($st);
  return $ok;
}

/* ===================== CURSOS ===================== */

if ($action === "cursos_list") {
  require_perm("cursos", "ver");

  $rol = strtolower((string)($_SESSION["rol_nombre"] ?? ""));
  $uid = (int)($_SESSION["usuario_id"] ?? 0);
  $scope = strtolower((string)($_GET["scope"] ?? "all"));

  if ($rol === "docente") {
    $st = mysqli_prepare($enlace, "
      SELECT c.id,c.nombre,c.paralelo,c.periodo,c.docente_id,c.activo,
             COALESCE(u.usuario,'') AS docente_usuario,
             CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,'')) AS docente_nombre
      FROM cursos c
      LEFT JOIN usuarios u ON u.id=c.docente_id
      WHERE c.docente_id=? AND c.activo=1
      ORDER BY c.id DESC
    ");
    mysqli_stmt_bind_param($st, "i", $uid);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $data = [];
    while ($row = $res ? mysqli_fetch_assoc($res) : null) {
      $data[] = $row;
      if (!$res) break;
    }
    mysqli_stmt_close($st);
    ok(["data" => $data]);
  }

  if ($scope === "active") {
    $q = mysqli_query($enlace, "
      SELECT c.id,c.nombre,c.paralelo,c.periodo,c.docente_id,c.activo,
             COALESCE(u.usuario,'') AS docente_usuario,
             CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,'')) AS docente_nombre
      FROM cursos c
      LEFT JOIN usuarios u ON u.id=c.docente_id
      WHERE c.activo=1
      ORDER BY c.id DESC
    ");
  } else {
    $q = mysqli_query($enlace, "
      SELECT c.id,c.nombre,c.paralelo,c.periodo,c.docente_id,c.activo,
             COALESCE(u.usuario,'') AS docente_usuario,
             CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,'')) AS docente_nombre
      FROM cursos c
      LEFT JOIN usuarios u ON u.id=c.docente_id
      ORDER BY c.id DESC
    ");
  }

  $data = [];
  while ($row = mysqli_fetch_assoc($q)) $data[] = $row;
  ok(["data" => $data]);
}

if ($action === "cursos_create") {
  require_perm("cursos", "crear");

  $nombre = trim((string)($body["nombre"] ?? ""));
  $paralelo = trim((string)($body["paralelo"] ?? "A"));
  $periodo = trim((string)($body["periodo"] ?? ""));
  $docente_id = $body["docente_id"] ?? null;

  if ($nombre === "" || $periodo === "") fail("datos incompletos");
  if ($paralelo === "") $paralelo = "A";

  $docId = null;
  if ($docente_id !== null && $docente_id !== "" && (int)$docente_id > 0) $docId = (int)$docente_id;

  $uid = (int)($_SESSION["usuario_id"] ?? 0);

  if ($docId === null) {
    $st = mysqli_prepare($enlace, "
      INSERT INTO cursos (nombre,paralelo,periodo,docente_id,creado_por,activo)
      VALUES (?,?,?,NULL,?,1)
    ");
    mysqli_stmt_bind_param($st, "sssi", $nombre, $paralelo, $periodo, $uid);
  } else {
    $st = mysqli_prepare($enlace, "
      INSERT INTO cursos (nombre,paralelo,periodo,docente_id,creado_por,activo)
      VALUES (?,?,?,?,?,1)
    ");
    mysqli_stmt_bind_param($st, "sssii", $nombre, $paralelo, $periodo, $docId, $uid);
  }

  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) fail("error al crear curso: ".$err, 500);

  $newId = (int)mysqli_insert_id($enlace);
  audit("cursos_create", "cursos", $newId > 0 ? $newId : null, "creó curso {$nombre}");
  ok(["id" => $newId]);
}

if ($action === "cursos_update") {
  require_perm("cursos", "editar");

  $id = (int)($body["id"] ?? 0);
  $nombre = trim((string)($body["nombre"] ?? ""));
  $paralelo = trim((string)($body["paralelo"] ?? ""));
  $periodo = trim((string)($body["periodo"] ?? ""));
  $activo = isset($body["activo"]) ? (int)$body["activo"] : 1;

  if ($id <= 0) fail("id inválido");
  if ($nombre === "" || $paralelo === "" || $periodo === "") fail("datos incompletos");

  $st = mysqli_prepare($enlace, "UPDATE cursos SET nombre=?, paralelo=?, periodo=?, activo=? WHERE id=?");
  mysqli_stmt_bind_param($st, "sssii", $nombre, $paralelo, $periodo, $activo, $id);
  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) fail("error al actualizar curso: ".$err, 500);

  audit("cursos_update", "cursos", $id, "editó curso {$id}");
  ok();
}

if ($action === "cursos_delete") {
  require_perm("cursos", "eliminar");

  $id = (int)($body["id"] ?? 0);
  if ($id <= 0) fail("id inválido");

  $curso = get_curso($id);
  if (!$curso) fail("curso no existe", 404);

  $st = mysqli_prepare($enlace, "UPDATE cursos SET activo=0 WHERE id=?");
  mysqli_stmt_bind_param($st, "i", $id);
  mysqli_stmt_execute($st);
  mysqli_stmt_close($st);

  audit("cursos_delete", "cursos", $id, "desactivó curso {$id}");
  ok();
}

/* ===================== NOTAS ===================== */

if ($action === "notas_list_curso") {
  require_perm("notas", "ver");

  $curso_id = (int)($_GET["curso_id"] ?? 0);
  if ($curso_id <= 0) fail("curso_id requerido");

  $rol = strtolower((string)($_SESSION["rol_nombre"] ?? ""));
  if ($rol === "docente" && !can_docente_curso($curso_id)) fail("no autorizado", 403);

  $st = mysqli_prepare($enlace, "
    SELECT m.estudiante_id,
           u.usuario,
           CONCAT(u.nombres,' ',u.apellidos) AS estudiante_nombre,
           u.cedula,
           COALESCE(n.id,0) AS nota_id,
           COALESCE(n.p1_deberes,0) AS p1_deberes,
           COALESCE(n.p1_prueba,0)  AS p1_prueba,
           COALESCE(n.p1_lab,0)     AS p1_lab,
           COALESCE(n.p1_examen,0)  AS p1_examen,
           COALESCE(n.p1_total,0)   AS p1_total,
           COALESCE(n.p2_deberes,0) AS p2_deberes,
           COALESCE(n.p2_prueba,0)  AS p2_prueba,
           COALESCE(n.p2_lab,0)     AS p2_lab,
           COALESCE(n.p2_examen,0)  AS p2_examen,
           COALESCE(n.p2_total,0)   AS p2_total,
           COALESCE(n.p3_deberes,0) AS p3_deberes,
           COALESCE(n.p3_prueba,0)  AS p3_prueba,
           COALESCE(n.p3_lab,0)     AS p3_lab,
           COALESCE(n.p3_examen,0)  AS p3_examen,
           COALESCE(n.p3_total,0)   AS p3_total,
           COALESCE(n.nota_final,0) AS nota_final,
           COALESCE(n.estado,'REPROBADO') AS estado,
           COALESCE(n.actualizado_en,NULL) AS actualizado_en
    FROM matriculas m
    JOIN usuarios u ON u.id=m.estudiante_id
    LEFT JOIN notas n ON n.curso_id=m.curso_id AND n.estudiante_id=m.estudiante_id
    WHERE m.curso_id=? AND m.estado='ACTIVA'
    ORDER BY u.apellidos,u.nombres
  ");
  mysqli_stmt_bind_param($st, "i", $curso_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $data = [];
  while ($row = $res ? mysqli_fetch_assoc($res) : null) {
    $data[] = $row;
    if (!$res) break;
  }
  mysqli_stmt_close($st);

  ok(["data" => $data]);
}

if ($action === "notas_my") {
  require_perm("notas", "ver");

  $uid = (int)($_SESSION["usuario_id"] ?? 0);
  $st = mysqli_prepare($enlace, "
    SELECT c.id AS curso_id,c.nombre,c.paralelo,c.periodo,
           COALESCE(n.nota_final,0) AS nota_final,
           COALESCE(n.estado,'REPROBADO') AS estado,
           COALESCE(n.p1_total,0) AS p1_total,
           COALESCE(n.p2_total,0) AS p2_total,
           COALESCE(n.p3_total,0) AS p3_total,
           COALESCE(n.actualizado_en,NULL) AS actualizado_en
    FROM matriculas m
    JOIN cursos c ON c.id=m.curso_id
    LEFT JOIN notas n ON n.curso_id=m.curso_id AND n.estudiante_id=m.estudiante_id
    WHERE m.estudiante_id=? AND m.estado='ACTIVA' AND c.activo=1
    ORDER BY c.periodo DESC, c.id DESC
  ");
  mysqli_stmt_bind_param($st, "i", $uid);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $data = [];
  while ($row = $res ? mysqli_fetch_assoc($res) : null) {
    $data[] = $row;
    if (!$res) break;
  }
  mysqli_stmt_close($st);

  ok(["data" => $data]);
}

if ($action === "notas_upsert") {
  require_perm("notas", "editar");

  $curso_id = (int)($body["curso_id"] ?? 0);
  $estudiante_id = (int)($body["estudiante_id"] ?? 0);
  if ($curso_id <= 0 || $estudiante_id <= 0) fail("datos incompletos");

  $rol = strtolower((string)($_SESSION["rol_nombre"] ?? ""));
  if ($rol === "docente" && !can_docente_curso($curso_id)) fail("no autorizado", 403);

  $stM = mysqli_prepare($enlace, "
    SELECT 1 FROM matriculas
    WHERE curso_id=? AND estudiante_id=? AND estado='ACTIVA'
    LIMIT 1
  ");
  mysqli_stmt_bind_param($stM, "ii", $curso_id, $estudiante_id);
  mysqli_stmt_execute($stM);
  $resM = mysqli_stmt_get_result($stM);
  $okMat = ($resM && mysqli_fetch_row($resM)) ? true : false;
  mysqli_stmt_close($stM);
  if (!$okMat) fail("estudiante no matriculado en este curso", 409);

  $fields = [
    "p1_deberes","p1_prueba","p1_lab","p1_examen",
    "p2_deberes","p2_prueba","p2_lab","p2_examen",
    "p3_deberes","p3_prueba","p3_lab","p3_examen"
  ];

  $vals = [];
  foreach ($fields as $f) {
    $v = $body[$f] ?? 0;
    $v = is_numeric($v) ? (float)$v : 0.0;
    $vals[$f] = $v;
  }

  $st = mysqli_prepare($enlace, "
    INSERT INTO notas (
      curso_id,estudiante_id,
      p1_deberes,p1_prueba,p1_lab,p1_examen,
      p2_deberes,p2_prueba,p2_lab,p2_examen,
      p3_deberes,p3_prueba,p3_lab,p3_examen
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      p1_deberes=VALUES(p1_deberes),
      p1_prueba=VALUES(p1_prueba),
      p1_lab=VALUES(p1_lab),
      p1_examen=VALUES(p1_examen),
      p2_deberes=VALUES(p2_deberes),
      p2_prueba=VALUES(p2_prueba),
      p2_lab=VALUES(p2_lab),
      p2_examen=VALUES(p2_examen),
      p3_deberes=VALUES(p3_deberes),
      p3_prueba=VALUES(p3_prueba),
      p3_lab=VALUES(p3_lab),
      p3_examen=VALUES(p3_examen)
  ");
  if (!$st) fail("error interno", 500);

  mysqli_stmt_bind_param(
    $st,
    "iiddddddddddddd",
    $curso_id,
    $estudiante_id,
    $vals["p1_deberes"], $vals["p1_prueba"], $vals["p1_lab"], $vals["p1_examen"],
    $vals["p2_deberes"], $vals["p2_prueba"], $vals["p2_lab"], $vals["p2_examen"],
    $vals["p3_deberes"], $vals["p3_prueba"], $vals["p3_lab"], $vals["p3_examen"]
  );

  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) fail("error al guardar notas: ".$err, 500);

  audit("notas_upsert", "notas", null, "actualizó notas est={$estudiante_id} curso={$curso_id}");
  ok();
}

fail("acción inválida", 404);
