<?php
ini_set("display_errors","0");
ini_set("log_errors","1");
error_reporting(E_ALL);

header("Content-Type: application/json; charset=utf-8");

if (session_status() !== PHP_SESSION_ACTIVE) session_start();

require_once __DIR__ . "/conexion.php";
require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/auditoria.php";

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

set_exception_handler(function($e){
  fail("exception: ".$e->getMessage(), 500);
});
set_error_handler(function($severity, $message, $file, $line){
  throw new ErrorException($message, 0, $severity, $file, $line);
});

function audit_safe($accion, $tabla = null, $registro_id = null, $descripcion = "") {
  try {
    if (function_exists("audit")) {
      audit($accion, $tabla, $registro_id, $descripcion);
      return;
    }
    if (function_exists("auditar")) {
      auditar($accion, $tabla, $registro_id, $descripcion);
      return;
    }
  } catch (Throwable $t) {}
}

function require_login() {
  if (empty($_SESSION["usuario_id"])) fail("no autenticado", 401);
}
function require_active_user() {
  require_login();
  if (isset($_SESSION["activo"]) && (int)$_SESSION["activo"] !== 1) fail("usuario inactivo", 403);
}

function load_me() {
  global $enlace;
  if (empty($_SESSION["usuario_id"])) return null;
  $uid = (int)$_SESSION["usuario_id"];

  $sql = "SELECT u.id,u.usuario,u.nombres,u.apellidos,u.cedula,u.fecha_nacimiento,u.activo,
                 r.id AS rol_id, r.nombre AS rol, r.descripcion AS rol_desc
          FROM usuarios u
          LEFT JOIN roles r ON r.id=u.rol_id
          WHERE u.id=? LIMIT 1";
  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, "i", $uid);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);
  $me = mysqli_fetch_assoc($rs) ?: null;
  mysqli_stmt_close($st);
  if (!$me) return null;

  $perms = [];
  if (!empty($me["rol_id"])) {
    $rid = (int)$me["rol_id"];
    $sqlp = "SELECT p.modulo,p.accion
             FROM rol_permisos rp
             JOIN permisos p ON p.id=rp.permiso_id
             WHERE rp.rol_id=?";
    $sp = mysqli_prepare($enlace, $sqlp);
    mysqli_stmt_bind_param($sp, "i", $rid);
    mysqli_stmt_execute($sp);
    $rp = mysqli_stmt_get_result($sp);
    while ($row = mysqli_fetch_assoc($rp)) {
      $perms[] = $row["modulo"]."/".$row["accion"];
    }
    mysqli_stmt_close($sp);
  }

  $me["perms"] = $perms;
  return $me;
}

function has_perm($me, $mod, $acc) {
  $p = $me["perms"] ?? [];
  if (in_array("*", $p, true)) return true;
  return in_array($mod."/".$acc, $p, true);
}
function require_perm($mod, $acc) {
  $me = load_me();
  if (!$me) fail("no autenticado", 401);
  if (!has_perm($me, $mod, $acc)) fail("sin permisos", 403);
  return $me;
}

function to_hm($t) {
  if ($t === null || $t === "") return null;
  $s = (string)$t;
  if (strlen($s) >= 5) return substr($s, 0, 5);
  return $s;
}

if ($action === "me") {
  $me = load_me();
  ok(["me" => $me]);
}

if ($action === "login") {
  global $enlace;

  $usuario = trim((string)($body["usuario"] ?? ""));
  $password = (string)($body["password"] ?? "");

  if ($usuario === "" || $password === "") fail("datos incompletos", 400);

  $sql = "SELECT u.id,u.usuario,u.nombres,u.apellidos,u.password_hash,u.activo,u.rol_id,
                 u.intentos_fallidos,u.bloqueado_hasta,
                 r.nombre AS rol
          FROM usuarios u
          LEFT JOIN roles r ON r.id=u.rol_id
          WHERE u.usuario=? LIMIT 1";
  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, "s", $usuario);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);
  $u = mysqli_fetch_assoc($rs) ?: null;
  mysqli_stmt_close($st);

  if (!$u) {
    audit_safe("login_fail", "usuarios", null, "usuario inexistente");
    fail("credenciales inválidas", 401);
  }

  $uid = (int)$u["id"];

  if ((int)$u["activo"] !== 1) {
    audit_safe("login_fail", "usuarios", $uid, "usuario inactivo");
    fail("usuario inactivo", 403);
  }

  if (!empty($u["bloqueado_hasta"])) {
    $bh = strtotime($u["bloqueado_hasta"]);
    $now = time();
    if ($bh !== false && $bh > $now) {
      $mins = (int)ceil(($bh - $now) / 60);
      audit_safe("login_blocked", "usuarios", $uid, "bloqueado, mins_left=".$mins);
      fail("bloqueado, espera ".$mins." min", 403);
    }
  }

  if (!password_verify($password, (string)$u["password_hash"])) {
    $intentos = (int)$u["intentos_fallidos"] + 1;
    $bloq = null;
    if ($intentos >= 2) {
      $bloq = date("Y-m-d H:i:s", time() + 5 * 60);
      $intentos = 0;
    }

    if ($bloq) {
      $su = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos=?, bloqueado_hasta=? WHERE id=?");
      mysqli_stmt_bind_param($su, "isi", $intentos, $bloq, $uid);
      mysqli_stmt_execute($su);
      mysqli_stmt_close($su);
      audit_safe("login_fail_block", "usuarios", $uid, "bloqueado 5 min");
      fail("password incorrecta, bloqueado 5 min", 403);
    } else {
      $su = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos=? WHERE id=?");
      mysqli_stmt_bind_param($su, "ii", $intentos, $uid);
      mysqli_stmt_execute($su);
      mysqli_stmt_close($su);
      audit_safe("login_fail", "usuarios", $uid, "password incorrecta, intentos=".$intentos);
      fail("credenciales inválidas", 401);
    }
  }

  $su = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=?");
  mysqli_stmt_bind_param($su, "i", $uid);
  mysqli_stmt_execute($su);
  mysqli_stmt_close($su);

  $_SESSION["usuario_id"] = $uid;
  $_SESSION["rol"] = (string)($u["rol"] ?? "");
  $_SESSION["activo"] = (int)$u["activo"];

  audit_safe("login_ok", "usuarios", $uid, "inicio de sesión");
  ok(["me" => load_me()]);
}

if ($action === "logout") {
  $me = load_me();
  if ($me) audit_safe("logout", "usuarios", (int)$me["id"], "cierre de sesión");
  $_SESSION = [];
  if (ini_get("session.use_cookies")) {
    $p = session_get_cookie_params();
    setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
  }
  session_destroy();
  ok();
}

if ($action === "usuarios_list") {
  require_perm("usuarios","ver");
  global $enlace;

  $q = trim((string)($_GET["q"] ?? ""));
  $incluye_inactivos = (int)($_GET["incluye_inactivos"] ?? 0);

  $where = [];
  $params = [];
  $types = "";

  if (!$incluye_inactivos) {
    $where[] = "u.activo=1";
  }
  if ($q !== "") {
    $where[] = "(u.usuario LIKE CONCAT('%',?,'%') OR u.nombres LIKE CONCAT('%',?,'%') OR u.apellidos LIKE CONCAT('%',?,'%') OR u.cedula LIKE CONCAT('%',?,'%'))";
    $types .= "ssss";
    $params[] = $q; $params[] = $q; $params[] = $q; $params[] = $q;
  }

  $ws = $where ? ("WHERE ".implode(" AND ", $where)) : "";
  $sql = "SELECT u.id,u.usuario,u.nombres,u.apellidos,u.cedula,u.fecha_nacimiento,u.activo,u.rol_id,
                 r.nombre AS rol
          FROM usuarios u
          LEFT JOIN roles r ON r.id=u.rol_id
          $ws
          ORDER BY u.id DESC";

  $st = mysqli_prepare($enlace, $sql);
  if ($types !== "") mysqli_stmt_bind_param($st, $types, ...$params);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["rol_id"] = $row["rol_id"] === null ? null : (int)$row["rol_id"];
    $row["id"] = (int)$row["id"];
    $row["activo"] = (int)$row["activo"];
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["usuarios" => $out]);
}

if ($action === "usuarios_create") {
  $me = require_perm("usuarios","crear");
  global $enlace;

  $usuario = trim((string)($body["usuario"] ?? ""));
  $nombres = trim((string)($body["nombres"] ?? ""));
  $apellidos = trim((string)($body["apellidos"] ?? ""));
  $cedula = trim((string)($body["cedula"] ?? ""));
  $fecha_nacimiento = trim((string)($body["fecha_nacimiento"] ?? ""));
  $password = (string)($body["password"] ?? "");
  $rol_id = array_key_exists("rol_id",$body) ? (($body["rol_id"]===null||$body["rol_id"]==="") ? null : (int)$body["rol_id"]) : null;

  if ($usuario===""||$nombres===""||$apellidos===""||$cedula===""||$fecha_nacimiento===""||$password==="") fail("datos incompletos");

  $hash = password_hash($password, PASSWORD_BCRYPT);

  $st = mysqli_prepare($enlace, "INSERT INTO usuarios(usuario,nombres,apellidos,cedula,fecha_nacimiento,password_hash,rol_id,activo) VALUES(?,?,?,?,?,?,?,1)");
  mysqli_stmt_bind_param($st, "ssssssi", $usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $hash, $rol_id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo crear", 400);
  }
  $id = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($st);

  audit_safe("usuarios_create", "usuarios", $id, "creó usuario ".$usuario);
  ok(["id"=>$id]);
}

if ($action === "usuarios_update") {
  $me = require_perm("usuarios","editar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $usuario = trim((string)($body["usuario"] ?? ""));
  $nombres = trim((string)($body["nombres"] ?? ""));
  $apellidos = trim((string)($body["apellidos"] ?? ""));
  $cedula = trim((string)($body["cedula"] ?? ""));
  $fecha_nacimiento = trim((string)($body["fecha_nacimiento"] ?? ""));
  $rol_id = array_key_exists("rol_id",$body) ? (($body["rol_id"]===null||$body["rol_id"]==="") ? null : (int)$body["rol_id"]) : null;
  $activo = array_key_exists("activo",$body) ? (int)$body["activo"] : null;
  $password = array_key_exists("password",$body) ? (string)$body["password"] : null;

  $sets = [];
  $params = [];
  $types = "";

  if ($usuario!=="") { $sets[]="usuario=?"; $types.="s"; $params[]=$usuario; }
  if ($nombres!=="") { $sets[]="nombres=?"; $types.="s"; $params[]=$nombres; }
  if ($apellidos!=="") { $sets[]="apellidos=?"; $types.="s"; $params[]=$apellidos; }
  if ($cedula!=="") { $sets[]="cedula=?"; $types.="s"; $params[]=$cedula; }
  if ($fecha_nacimiento!=="") { $sets[]="fecha_nacimiento=?"; $types.="s"; $params[]=$fecha_nacimiento; }

  if (array_key_exists("rol_id",$body)) { $sets[]="rol_id=?"; $types.="i"; $params[]=$rol_id; }
  if (array_key_exists("activo",$body)) { $sets[]="activo=?"; $types.="i"; $params[]=$activo; }

  if ($password !== null && $password !== "") {
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $sets[]="password_hash=?";
    $types.="s";
    $params[]=$hash;
    $sets[]="intentos_fallidos=0";
    $sets[]="bloqueado_hasta=NULL";
  }

  if (!$sets) fail("nada que actualizar");

  $sql = "UPDATE usuarios SET ".implode(",", $sets)." WHERE id=?";
  $types .= "i";
  $params[] = $id;

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, $types, ...$params);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo actualizar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("usuarios_update", "usuarios", $id, "editó usuario ".$id);
  ok();
}

if ($action === "usuarios_delete") {
  $me = require_perm("usuarios","eliminar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $st = mysqli_prepare($enlace, "SELECT u.id,u.rol_id,r.nombre AS rol FROM usuarios u LEFT JOIN roles r ON r.id=u.rol_id WHERE u.id=? LIMIT 1");
  mysqli_stmt_bind_param($st, "i", $id);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);
  $u = mysqli_fetch_assoc($rs) ?: null;
  mysqli_stmt_close($st);
  if (!$u) fail("no existe");

  if (strtolower((string)($u["rol"] ?? "")) === "admin") fail("no se puede eliminar un admin", 403);

  $st = mysqli_prepare($enlace, "UPDATE usuarios SET activo=0 WHERE id=?");
  mysqli_stmt_bind_param($st, "i", $id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo desactivar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("usuarios_delete", "usuarios", $id, "desactivó usuario ".$id);
  ok();
}

if ($action === "roles_list") {
  require_perm("roles","ver");
  global $enlace;

  $st = mysqli_prepare($enlace, "SELECT id,nombre,descripcion,es_sistema,creado_por,creado_en FROM roles ORDER BY id DESC");
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $row["es_sistema"] = (int)$row["es_sistema"];
    $row["creado_por"] = $row["creado_por"] === null ? null : (int)$row["creado_por"];
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["roles"=>$out]);
}

if ($action === "roles_create") {
  $me = require_perm("roles","crear");
  global $enlace;

  $nombre = trim((string)($body["nombre"] ?? ""));
  $descripcion = trim((string)($body["descripcion"] ?? ""));
  if ($nombre==="") fail("nombre requerido");

  $uid = (int)$_SESSION["usuario_id"];

  $st = mysqli_prepare($enlace, "INSERT INTO roles(nombre,descripcion,es_sistema,creado_por) VALUES(?,?,0,?)");
  mysqli_stmt_bind_param($st, "ssi", $nombre, $descripcion, $uid);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo crear", 400);
  }
  $id = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($st);

  audit_safe("roles_create","roles",$id,"creó rol ".$nombre);
  ok(["id"=>$id]);
}

if ($action === "roles_update") {
  $me = require_perm("roles","editar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $st0 = mysqli_prepare($enlace, "SELECT es_sistema FROM roles WHERE id=? LIMIT 1");
  mysqli_stmt_bind_param($st0, "i", $id);
  mysqli_stmt_execute($st0);
  $rs0 = mysqli_stmt_get_result($st0);
  $r0 = mysqli_fetch_assoc($rs0) ?: null;
  mysqli_stmt_close($st0);
  if (!$r0) fail("no existe");
  if ((int)$r0["es_sistema"] === 1) fail("rol del sistema no editable", 403);

  $nombre = trim((string)($body["nombre"] ?? ""));
  $descripcion = trim((string)($body["descripcion"] ?? ""));

  $sets = [];
  $params = [];
  $types = "";

  if ($nombre!=="") { $sets[]="nombre=?"; $types.="s"; $params[]=$nombre; }
  if (array_key_exists("descripcion",$body)) { $sets[]="descripcion=?"; $types.="s"; $params[]=$descripcion; }

  if (!$sets) fail("nada que actualizar");

  $sql = "UPDATE roles SET ".implode(",", $sets)." WHERE id=?";
  $types.="i";
  $params[]=$id;

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, $types, ...$params);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo actualizar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("roles_update","roles",$id,"editó rol ".$id);
  ok();
}

if ($action === "roles_delete") {
  $me = require_perm("roles","eliminar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $st0 = mysqli_prepare($enlace, "SELECT es_sistema FROM roles WHERE id=? LIMIT 1");
  mysqli_stmt_bind_param($st0, "i", $id);
  mysqli_stmt_execute($st0);
  $rs0 = mysqli_stmt_get_result($st0);
  $r0 = mysqli_fetch_assoc($rs0) ?: null;
  mysqli_stmt_close($st0);
  if (!$r0) fail("no existe");
  if ((int)$r0["es_sistema"] === 1) fail("rol del sistema no eliminable", 403);

  $st = mysqli_prepare($enlace, "DELETE FROM roles WHERE id=?");
  mysqli_stmt_bind_param($st, "i", $id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo eliminar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("roles_delete","roles",$id,"eliminó rol ".$id);
  ok();
}

if ($action === "permisos_get") {
  $me = require_perm("permisos","ver");
  global $enlace;

  $rol_id = (int)($_GET["rol_id"] ?? 0);

  $perms = [];
  $st = mysqli_prepare($enlace, "SELECT id,modulo,accion,descripcion FROM permisos ORDER BY modulo,accion");
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $perms[] = $row;
  }
  mysqli_stmt_close($st);

  $asignados = [];
  if ($rol_id > 0) {
    $st2 = mysqli_prepare($enlace, "SELECT permiso_id FROM rol_permisos WHERE rol_id=?");
    mysqli_stmt_bind_param($st2, "i", $rol_id);
    mysqli_stmt_execute($st2);
    $rs2 = mysqli_stmt_get_result($st2);
    while ($r = mysqli_fetch_assoc($rs2)) $asignados[] = (int)$r["permiso_id"];
    mysqli_stmt_close($st2);
  }

  ok(["permisos"=>$perms,"asignados"=>$asignados]);
}

if ($action === "permisos_set") {
  $me = require_perm("permisos","editar");
  global $enlace;

  $rol_id = (int)($body["rol_id"] ?? 0);
  $perm_ids = $body["perm_ids"] ?? [];
  if ($rol_id<=0 || !is_array($perm_ids)) fail("datos inválidos");

  $st0 = mysqli_prepare($enlace, "SELECT es_sistema FROM roles WHERE id=? LIMIT 1");
  mysqli_stmt_bind_param($st0, "i", $rol_id);
  mysqli_stmt_execute($st0);
  $rs0 = mysqli_stmt_get_result($st0);
  $r0 = mysqli_fetch_assoc($rs0) ?: null;
  mysqli_stmt_close($st0);
  if (!$r0) fail("rol no existe");

  mysqli_begin_transaction($enlace);
  try {
    $sd = mysqli_prepare($enlace, "DELETE FROM rol_permisos WHERE rol_id=?");
    mysqli_stmt_bind_param($sd, "i", $rol_id);
    mysqli_stmt_execute($sd);
    mysqli_stmt_close($sd);

    $ins = mysqli_prepare($enlace, "INSERT INTO rol_permisos(rol_id,permiso_id) VALUES(?,?)");
    foreach ($perm_ids as $pid) {
      $pid = (int)$pid;
      if ($pid<=0) continue;
      mysqli_stmt_bind_param($ins, "ii", $rol_id, $pid);
      mysqli_stmt_execute($ins);
    }
    mysqli_stmt_close($ins);

    mysqli_commit($enlace);
  } catch (Throwable $t) {
    mysqli_rollback($enlace);
    fail("no se pudo guardar permisos", 400);
  }

  audit_safe("permisos_set","rol_permisos",$rol_id,"asignó ".count($perm_ids)." permiso(s) al rol ".$rol_id);
  ok();
}

if ($action === "cursos_list") {
  $me = require_perm("cursos","ver");
  global $enlace;

  $periodo = trim((string)($_GET["periodo"] ?? ""));
  $solo_activos = (int)($_GET["solo_activos"] ?? 1);
  $solo_mios = (int)($_GET["solo_mios"] ?? 0);

  $where = [];
  $params = [];
  $types = "";

  if ($solo_activos) $where[] = "c.activo=1";
  if ($periodo !== "") { $where[] = "c.periodo=?"; $types.="s"; $params[]=$periodo; }

  if ($solo_mios) {
    $uid = (int)($_SESSION["usuario_id"] ?? 0);
    $where[] = "c.docente_id=?";
    $types.="i"; $params[]=$uid;
  }

  $ws = $where ? ("WHERE ".implode(" AND ", $where)) : "";

  $sql = "SELECT c.id,c.nombre,c.paralelo,c.periodo,c.dia_semana,c.dia_semana2,
                 c.hora_inicio,c.hora_inicio2,c.hora_fin,c.hora_fin2,c.aula,c.docente_id,
                 c.creado_por,c.creado_en,c.activo,
                 CONCAT(u.nombres,' ',u.apellidos) AS docente_nombre,
                 u.usuario AS docente_usuario
          FROM cursos c
          LEFT JOIN usuarios u ON u.id=c.docente_id
          $ws
          ORDER BY c.id DESC";

  $st = mysqli_prepare($enlace, $sql);
  if ($types!=="") mysqli_stmt_bind_param($st, $types, ...$params);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $row["dia_semana"] = (int)$row["dia_semana"];
    $row["dia_semana2"] = $row["dia_semana2"] === null ? null : (int)$row["dia_semana2"];
    $row["docente_id"] = $row["docente_id"] === null ? null : (int)$row["docente_id"];
    $row["creado_por"] = $row["creado_por"] === null ? null : (int)$row["creado_por"];
    $row["activo"] = (int)$row["activo"];
    $row["hora_inicio"] = to_hm($row["hora_inicio"]);
    $row["hora_fin"] = to_hm($row["hora_fin"]);
    $row["hora_inicio2"] = to_hm($row["hora_inicio2"]);
    $row["hora_fin2"] = to_hm($row["hora_fin2"]);
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["cursos"=>$out]);
}

if ($action === "cursos_create") {
  $me = require_perm("cursos","crear");
  global $enlace;

  $nombre   = trim((string)($body["nombre"] ?? ""));
  $paralelo = trim((string)($body["paralelo"] ?? "A"));
  $periodo  = trim((string)($body["periodo"] ?? ""));

  $docente_id = array_key_exists("docente_id",$body)
    ? (($body["docente_id"]===""||$body["docente_id"]===null) ? null : (int)$body["docente_id"])
    : null;

  $dia1 = (int)($body["dia_semana"] ?? 1);
  $hi1  = trim((string)($body["hora_inicio"] ?? "07:00"));
  $hf1  = trim((string)($body["hora_fin"] ?? "08:00"));
  $aula1 = trim((string)($body["aula"] ?? ""));

  $dia2 = array_key_exists("dia_semana2",$body) ? $body["dia_semana2"] : null;
  $dia2 = ($dia2 === "" || $dia2 === null) ? null : (int)$dia2;
  $hi2  = trim((string)($body["hora_inicio2"] ?? ""));
  $hf2  = trim((string)($body["hora_fin2"] ?? ""));
  $aula2 = trim((string)($body["aula2"] ?? ""));

  if ($nombre==="" || $periodo==="") fail("datos incompletos");
  if ($dia1 < 1 || $dia1 > 7) fail("dia_semana inválido");
  if (!preg_match('/^\d{2}:\d{2}$/', $hi1) || !preg_match('/^\d{2}:\d{2}$/', $hf1)) fail("hora inválida (HH:MM)");
  if ($hi1 >= $hf1) fail("hora_inicio debe ser menor que hora_fin");

  $usa2 = ($dia2 !== null || $hi2 !== "" || $hf2 !== "" || $aula2 !== "");
  if ($usa2) {
    if ($dia2 === null || $dia2 < 1 || $dia2 > 7) fail("dia_semana2 inválido");
    if (!preg_match('/^\d{2}:\d{2}$/', $hi2) || !preg_match('/^\d{2}:\d{2}$/', $hf2)) fail("hora2 inválida (HH:MM)");
    if ($hi2 >= $hf2) fail("hora_inicio2 debe ser menor que hora_fin2");
  } else {
    $dia2 = null; $hi2 = null; $hf2 = null; $aula2 = null;
  }

  $uid = (int)$_SESSION["usuario_id"];

  $sql = "INSERT INTO cursos(
            nombre,paralelo,periodo,dia_semana,dia_semana2,
            hora_inicio,hora_inicio2,hora_fin,hora_fin2,aula,docente_id,creado_por,activo
          ) VALUES(
            ?,?,?,?,?,
            STR_TO_DATE(?,'%H:%i'),
            ".($hi2===null ? "NULL" : "STR_TO_DATE(?,'%H:%i')").",
            STR_TO_DATE(?,'%H:%i'),
            ".($hf2===null ? "NULL" : "STR_TO_DATE(?,'%H:%i')").",
            ?,?,?,1
          )";

  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno", 500);

  if ($hi2===null && $hf2===null) {
    mysqli_stmt_bind_param($st, "sssii ss s sii", $nombre, $paralelo, $periodo, $dia1, $dia2, $hi1, $hf1, $aula1, $docente_id, $uid);
  } else {
    mysqli_stmt_bind_param($st, "sssii s s s s ssii", $nombre, $paralelo, $periodo, $dia1, $dia2, $hi1, $hi2, $hf1, $hf2, $aula1, $docente_id, $uid);
  }

  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo crear", 400);
  }
  $id = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($st);

  audit_safe("cursos_create","cursos",$id,"creó curso ".$nombre." ".$paralelo." (".$periodo.")");
  ok(["id"=>$id]);
}

if ($action === "cursos_update") {
  $me = require_perm("cursos","editar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $sets = [];
  $params = [];
  $types = "";

  if (array_key_exists("nombre",$body)) { $sets[]="nombre=?"; $types.="s"; $params[]=trim((string)$body["nombre"]); }
  if (array_key_exists("paralelo",$body)) { $sets[]="paralelo=?"; $types.="s"; $params[]=trim((string)$body["paralelo"]); }
  if (array_key_exists("periodo",$body)) { $sets[]="periodo=?"; $types.="s"; $params[]=trim((string)$body["periodo"]); }

  if (array_key_exists("dia_semana",$body)) { $sets[]="dia_semana=?"; $types.="i"; $params[]=(int)$body["dia_semana"]; }
  if (array_key_exists("dia_semana2",$body)) {
    $v = $body["dia_semana2"];
    $v = ($v===""||$v===null) ? null : (int)$v;
    $sets[]="dia_semana2=?";
    $types.="i";
    $params[]=$v;
  }

  if (array_key_exists("hora_inicio",$body)) { $sets[]="hora_inicio=STR_TO_DATE(?,'%H:%i')"; $types.="s"; $params[]=trim((string)$body["hora_inicio"]); }
  if (array_key_exists("hora_fin",$body)) { $sets[]="hora_fin=STR_TO_DATE(?,'%H:%i')"; $types.="s"; $params[]=trim((string)$body["hora_fin"]); }

  if (array_key_exists("hora_inicio2",$body)) {
    $v = trim((string)$body["hora_inicio2"]);
    if ($v==="") $sets[]="hora_inicio2=NULL";
    else { $sets[]="hora_inicio2=STR_TO_DATE(?,'%H:%i')"; $types.="s"; $params[]=$v; }
  }
  if (array_key_exists("hora_fin2",$body)) {
    $v = trim((string)$body["hora_fin2"]);
    if ($v==="") $sets[]="hora_fin2=NULL";
    else { $sets[]="hora_fin2=STR_TO_DATE(?,'%H:%i')"; $types.="s"; $params[]=$v; }
  }

  if (array_key_exists("aula",$body)) { $sets[]="aula=?"; $types.="s"; $params[]=trim((string)$body["aula"]); }
  if (array_key_exists("docente_id",$body)) {
    $v = $body["docente_id"];
    $v = ($v===""||$v===null) ? null : (int)$v;
    $sets[]="docente_id=?";
    $types.="i";
    $params[]=$v;
  }
  if (array_key_exists("activo",$body)) { $sets[]="activo=?"; $types.="i"; $params[]=(int)$body["activo"]; }

  if (!$sets) fail("nada que actualizar");

  $sql = "UPDATE cursos SET ".implode(",", $sets)." WHERE id=?";
  $types .= "i";
  $params[] = $id;

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, $types, ...$params);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo actualizar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("cursos_update","cursos",$id,"editó curso ".$id);
  ok();
}

if ($action === "cursos_delete") {
  $me = require_perm("cursos","eliminar");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $st = mysqli_prepare($enlace, "UPDATE cursos SET activo=0 WHERE id=?");
  mysqli_stmt_bind_param($st, "i", $id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo desactivar", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("cursos_delete","cursos",$id,"desactivó curso ".$id);
  ok();
}

if ($action === "matriculas_list") {
  $me = require_perm("matriculas","ver");
  global $enlace;

  $curso_id = (int)($_GET["curso_id"] ?? 0);
  $estudiante_id = (int)($_GET["estudiante_id"] ?? 0);

  $where = [];
  $params = [];
  $types = "";

  if ($curso_id>0) { $where[]="m.curso_id=?"; $types.="i"; $params[]=$curso_id; }
  if ($estudiante_id>0) { $where[]="m.estudiante_id=?"; $types.="i"; $params[]=$estudiante_id; }

  $ws = $where ? ("WHERE ".implode(" AND ", $where)) : "";

  $sql = "SELECT m.id,m.curso_id,m.estudiante_id,m.estado,m.fecha,
                 c.nombre AS curso_nombre,c.paralelo,c.periodo,
                 e.usuario AS estudiante_usuario, CONCAT(e.nombres,' ',e.apellidos) AS estudiante_nombre
          FROM matriculas m
          JOIN cursos c ON c.id=m.curso_id
          JOIN usuarios e ON e.id=m.estudiante_id
          $ws
          ORDER BY m.id DESC";

  $st = mysqli_prepare($enlace, $sql);
  if ($types!=="") mysqli_stmt_bind_param($st, $types, ...$params);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $row["curso_id"] = (int)$row["curso_id"];
    $row["estudiante_id"] = (int)$row["estudiante_id"];
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["matriculas"=>$out]);
}

if ($action === "matriculas_create") {
  $me = require_perm("matriculas","crear");
  global $enlace;

  $curso_id = (int)($body["curso_id"] ?? 0);
  $estudiante_id = (int)($body["estudiante_id"] ?? 0);
  if ($curso_id<=0 || $estudiante_id<=0) fail("datos inválidos");

  $st = mysqli_prepare($enlace, "INSERT INTO matriculas(curso_id,estudiante_id,estado) VALUES(?,?,'ACTIVA')");
  mysqli_stmt_bind_param($st, "ii", $curso_id, $estudiante_id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo matricular", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("matriculas_create","matriculas",null,"matriculó estudiante ".$estudiante_id." en curso ".$curso_id);
  ok();
}

if ($action === "matriculas_anular") {
  $me = require_perm("matriculas","anular");
  global $enlace;

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $st = mysqli_prepare($enlace, "UPDATE matriculas SET estado='ANULADA' WHERE id=?");
  mysqli_stmt_bind_param($st, "i", $id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo anular", 400);
  }
  mysqli_stmt_close($st);

  audit_safe("matriculas_anular","matriculas",$id,"anuló matrícula ".$id);
  ok();
}

if ($action === "mis_cursos") {
  require_active_user();
  $me = load_me();
  global $enlace;

  $uid = (int)$me["id"];
  $rol = strtolower((string)($me["rol"] ?? ""));

  if ($rol === "docente") {
    if (!has_perm($me, "cursos", "ver") && !has_perm($me, "notas", "ver")) fail("sin permisos", 403);
    $st = mysqli_prepare($enlace, "SELECT id,nombre,paralelo,periodo,dia_semana,dia_semana2,hora_inicio,hora_inicio2,hora_fin,hora_fin2,aula,docente_id,activo
                                 FROM cursos
                                 WHERE activo=1 AND docente_id=?
                                 ORDER BY id DESC");
    mysqli_stmt_bind_param($st, "i", $uid);
  } else {
    $st = mysqli_prepare($enlace, "SELECT c.id,c.nombre,c.paralelo,c.periodo,c.dia_semana,c.dia_semana2,c.hora_inicio,c.hora_inicio2,c.hora_fin,c.hora_fin2,c.aula,c.docente_id,c.activo
                                 FROM matriculas m
                                 JOIN cursos c ON c.id=m.curso_id
                                 WHERE m.estudiante_id=? AND m.estado='ACTIVA' AND c.activo=1
                                 ORDER BY c.id DESC");
    mysqli_stmt_bind_param($st, "i", $uid);
  }

  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $row["dia_semana"] = (int)$row["dia_semana"];
    $row["dia_semana2"] = $row["dia_semana2"]===null ? null : (int)$row["dia_semana2"];
    $row["docente_id"] = $row["docente_id"]===null ? null : (int)$row["docente_id"];
    $row["activo"] = (int)$row["activo"];
    $row["hora_inicio"] = to_hm($row["hora_inicio"]);
    $row["hora_fin"] = to_hm($row["hora_fin"]);
    $row["hora_inicio2"] = to_hm($row["hora_inicio2"]);
    $row["hora_fin2"] = to_hm($row["hora_fin2"]);
    $out[] = $row;
  }
  mysqli_stmt_close($st);

  ok(["cursos"=>$out]);
}

if ($action === "curso_estudiantes") {
  $me = require_perm("notas","ver");
  global $enlace;

  $curso_id = (int)($_GET["curso_id"] ?? 0);
  if ($curso_id<=0) fail("curso_id inválido");

  $rol = strtolower((string)($me["rol"] ?? ""));
  if ($rol === "docente") {
    $stc = mysqli_prepare($enlace, "SELECT docente_id FROM cursos WHERE id=? AND activo=1 LIMIT 1");
    mysqli_stmt_bind_param($stc, "i", $curso_id);
    mysqli_stmt_execute($stc);
    $rsc = mysqli_stmt_get_result($stc);
    $c = mysqli_fetch_assoc($rsc) ?: null;
    mysqli_stmt_close($stc);
    if (!$c) fail("curso no existe", 404);
    if ((int)$c["docente_id"] !== (int)$me["id"]) fail("solo tu curso", 403);
  }

  $sql = "SELECT m.estudiante_id,
                 u.usuario, CONCAT(u.nombres,' ',u.apellidos) AS nombre,
                 n.p1_deberes,n.p1_prueba,n.p1_lab,n.p1_examen,n.p1_total,
                 n.p2_deberes,n.p2_prueba,n.p2_lab,n.p2_examen,n.p2_total,
                 n.p3_deberes,n.p3_prueba,n.p3_lab,n.p3_examen,n.p3_total,
                 n.nota_final,n.estado
          FROM matriculas m
          JOIN usuarios u ON u.id=m.estudiante_id
          LEFT JOIN notas n ON n.curso_id=m.curso_id AND n.estudiante_id=m.estudiante_id
          WHERE m.curso_id=? AND m.estado='ACTIVA'
          ORDER BY u.apellidos,u.nombres";

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, "i", $curso_id);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["estudiante_id"] = (int)$row["estudiante_id"];
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["estudiantes"=>$out]);
}

if ($action === "guardar_notas") {
  $me = require_perm("notas","editar");
  global $enlace;

  $curso_id = (int)($body["curso_id"] ?? 0);
  $items = $body["items"] ?? null;
  if ($curso_id<=0 || !is_array($items)) fail("datos inválidos");

  $rol = strtolower((string)($me["rol"] ?? ""));
  if ($rol === "docente") {
    $stc = mysqli_prepare($enlace, "SELECT docente_id FROM cursos WHERE id=? AND activo=1 LIMIT 1");
    mysqli_stmt_bind_param($stc, "i", $curso_id);
    mysqli_stmt_execute($stc);
    $rsc = mysqli_stmt_get_result($stc);
    $c = mysqli_fetch_assoc($rsc) ?: null;
    mysqli_stmt_close($stc);
    if (!$c) fail("curso no existe", 404);
    if ((int)$c["docente_id"] !== (int)$me["id"]) fail("solo tu curso", 403);
  }

  $uid = (int)$me["id"];

  mysqli_begin_transaction($enlace);
  try {
    $sql = "INSERT INTO notas(
              curso_id,estudiante_id,
              p1_deberes,p1_prueba,p1_lab,p1_examen,
              p2_deberes,p2_prueba,p2_lab,p2_examen,
              p3_deberes,p3_prueba,p3_lab,p3_examen,
              actualizado_por
            ) VALUES(
              ?,?,
              ?,?,?,?,
              ?,?,?,?,
              ?,?,?,?,
              ?
            )
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
              p3_examen=VALUES(p3_examen),
              actualizado_por=VALUES(actualizado_por)";

    $st = mysqli_prepare($enlace, $sql);

    foreach ($items as $it) {
      if (!is_array($it)) continue;
      $estudiante_id = (int)($it["estudiante_id"] ?? 0);
      if ($estudiante_id<=0) continue;

      $p1d = (float)($it["p1_deberes"] ?? 0);
      $p1p = (float)($it["p1_prueba"] ?? 0);
      $p1l = (float)($it["p1_lab"] ?? 0);
      $p1e = (float)($it["p1_examen"] ?? 0);

      $p2d = (float)($it["p2_deberes"] ?? 0);
      $p2p = (float)($it["p2_prueba"] ?? 0);
      $p2l = (float)($it["p2_lab"] ?? 0);
      $p2e = (float)($it["p2_examen"] ?? 0);

      $p3d = (float)($it["p3_deberes"] ?? 0);
      $p3p = (float)($it["p3_prueba"] ?? 0);
      $p3l = (float)($it["p3_lab"] ?? 0);
      $p3e = (float)($it["p3_examen"] ?? 0);

      mysqli_stmt_bind_param(
        $st,
        "iidddddddddd ddi",
        $curso_id, $estudiante_id,
        $p1d,$p1p,$p1l,$p1e,
        $p2d,$p2p,$p2l,$p2e,
        $p3d,$p3p,$p3l,$p3e,
        $uid
      );
      mysqli_stmt_execute($st);
    }
    mysqli_stmt_close($st);

    mysqli_commit($enlace);
  } catch (Throwable $t) {
    mysqli_rollback($enlace);
    fail("no se pudo guardar notas", 400);
  }

  audit_safe("notas_update","notas",$curso_id,"registró notas curso ".$curso_id);
  ok();
}

if ($action === "reporte_horario_docente") {
  $me = require_perm("horarios","ver");
  global $enlace;

  $docente_id = (int)($_GET["docente_id"] ?? 0);
  if ($docente_id<=0) fail("docente_id inválido");

  $sql = "SELECT c.id,c.nombre,c.paralelo,c.periodo,c.dia_semana,c.dia_semana2,
                 c.hora_inicio,c.hora_inicio2,c.hora_fin,c.hora_fin2,c.aula,c.activo
          FROM cursos c
          WHERE c.activo=1 AND c.docente_id=?
          ORDER BY c.periodo DESC, c.dia_semana, c.hora_inicio";

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, "i", $docente_id);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) {
    $row["id"] = (int)$row["id"];
    $row["dia_semana"] = (int)$row["dia_semana"];
    $row["dia_semana2"] = $row["dia_semana2"]===null ? null : (int)$row["dia_semana2"];
    $row["hora_inicio"] = to_hm($row["hora_inicio"]);
    $row["hora_fin"] = to_hm($row["hora_fin"]);
    $row["hora_inicio2"] = to_hm($row["hora_inicio2"]);
    $row["hora_fin2"] = to_hm($row["hora_fin2"]);
    $out[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["horario"=>$out]);
}

if ($action === "reporte_notas_estudiante") {
  $me = require_perm("notas","ver");
  global $enlace;

  $estudiante_id = (int)($_GET["estudiante_id"] ?? 0);
  if ($estudiante_id<=0) fail("estudiante_id inválido");

  $rol = strtolower((string)($me["rol"] ?? ""));
  if ($rol === "estudiante" || $rol === "usuario") {
    if ((int)$me["id"] !== $estudiante_id) fail("solo tus notas", 403);
  }

  $sql = "SELECT c.periodo,c.nombre,c.paralelo,
                 n.p1_total,n.p2_total,n.p3_total,n.nota_final,n.estado
          FROM notas n
          JOIN cursos c ON c.id=n.curso_id
          WHERE n.estudiante_id=?
          ORDER BY c.periodo DESC, c.nombre";

  $st = mysqli_prepare($enlace, $sql);
  mysqli_stmt_bind_param($st, "i", $estudiante_id);
  mysqli_stmt_execute($st);
  $rs = mysqli_stmt_get_result($st);

  $out = [];
  while ($row = mysqli_fetch_assoc($rs)) $out[] = $row;
  mysqli_stmt_close($st);

  ok(["notas"=>$out]);
}

fail("acción no válida", 404);
