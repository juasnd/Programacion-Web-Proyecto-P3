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

function only_digits($s){ return preg_replace('/\D+/', '', (string)$s); }

function validar_cedula_ec($cedula) {
  $c = only_digits($cedula);
  if (strlen($c) !== 10) return [false, $c, "la cédula debe tener 10 dígitos"];
  $prov = (int)substr($c, 0, 2);
  $tercer = (int)$c[2];
  if ($prov < 1 || $prov > 24) return [false, $c, "provincia inválida"];
  if ($tercer > 5) return [false, $c, "cédula inválida"];

  $sum = 0;
  for ($i=0; $i<9; $i++){
    $v = (int)$c[$i];
    if ($i % 2 === 0) { $v *= 2; if ($v > 9) $v -= 9; }
    $sum += $v;
  }
  $decena = (int)(ceil($sum / 10) * 10);
  $dig = ($decena - $sum) % 10;
  $ver = (int)$c[9];
  if ($dig !== $ver) return [false, $c, "cédula inválida"];
  return [true, $c, ""];
}

function edad_desde_fecha($fecha){
  $f = trim((string)$fecha);
  $dt = DateTime::createFromFormat("Y-m-d", $f);
  if (!$dt || $dt->format("Y-m-d") !== $f) return null;
  $hoy = new DateTime("today");
  return $dt->diff($hoy)->y;
}

function is_duplicate_error($err){
  $e = strtolower((string)$err);
  return str_contains($e, "duplicate") || str_contains($e, "duplic");
}

function dup_field($err){
  $e = strtolower((string)$err);
  if (str_contains($e, "cedula") || str_contains($e, "ux_usuarios_cedula")) return "cedula";
  if (str_contains($e, "usuario")) return "usuario";
  if (str_contains($e, "roles_nombre") || str_contains($e, "ux_roles_nombre")) return "rol";
  return "unknown";
}

function load_me(){
  global $enlace;
  if (empty($_SESSION["usuario_id"])) return null;

  $id = (int)$_SESSION["usuario_id"];
  $stmt = mysqli_prepare($enlace, "
    SELECT u.id, u.usuario, u.nombres, u.apellidos, u.cedula, u.fecha_nacimiento, u.activo, u.rol_id,
           COALESCE(r.nombre,'') AS rol_nombre
    FROM usuarios u
    LEFT JOIN roles r ON r.id=u.rol_id
    WHERE u.id=? LIMIT 1
  ");
  if (!$stmt) return null;

  mysqli_stmt_bind_param($stmt, "i", $id);
  mysqli_stmt_execute($stmt);
  $res = mysqli_stmt_get_result($stmt);
  $me = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($stmt);

  if (!$me || (int)$me["activo"] !== 1) {
    $_SESSION = [];
    session_destroy();
    return null;
  }
  return $me;
}

function resp_me($me){
  $rolId = $me["rol_id"] === null ? 0 : (int)$me["rol_id"];
  $_SESSION["rol_id"] = $rolId;
  $_SESSION["rol_nombre"] = (string)($me["rol_nombre"] ?? "");

  if ($rolId <= 0) {
    $_SESSION["perms"] = [];
  } else {
    $_SESSION["perms"] = perms_user();
    if (!is_array($_SESSION["perms"])) $_SESSION["perms"] = [];
  }

  ok(["me" => [
    "id" => (int)$me["id"],
    "usuario" => (string)$me["usuario"],
    "nombres" => (string)($me["nombres"] ?? ""),
    "apellidos" => (string)($me["apellidos"] ?? ""),
    "cedula" => (string)($me["cedula"] ?? ""),
    "fecha_nacimiento" => $me["fecha_nacimiento"] ?? null,
    "rol_id" => $rolId,
    "rol_nombre" => $_SESSION["rol_nombre"],
    "is_admin" => is_admin(),
    "perms" => $_SESSION["perms"]
  ]]);
}

/* ===== auth ===== */

if ($action === "me") {
  $me = load_me();
  if (!$me) fail("no autenticado", 401);
  resp_me($me);
}

if ($action === "login") {
  global $enlace;

  $usuario = trim(strtolower((string)($body["usuario"] ?? "")));
  $password = (string)($body["password"] ?? "");
  if ($usuario === "" || $password === "") fail("datos incompletos");

  $stmt = mysqli_prepare($enlace, "
    SELECT u.id, u.usuario, u.nombres, u.apellidos, u.cedula, u.fecha_nacimiento,
           u.password_hash, u.activo, u.rol_id,
           u.intentos_fallidos, u.bloqueado_hasta,
           COALESCE(r.nombre,'') AS rol_nombre,
           (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS is_blocked,
           IF(u.bloqueado_hasta IS NULL, 0, TIMESTAMPDIFF(MINUTE, NOW(), u.bloqueado_hasta)) AS mins_left
    FROM usuarios u
    LEFT JOIN roles r ON r.id=u.rol_id
    WHERE u.usuario=? LIMIT 1
  ");
  if (!$stmt) fail("error interno", 500);

  mysqli_stmt_bind_param($stmt, "s", $usuario);
  mysqli_stmt_execute($stmt);
  $res = mysqli_stmt_get_result($stmt);
  $row = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($stmt);

  if (!$row) fail("usuario o contraseña incorrectos", 401);

  if ((int)$row["is_blocked"] === 1) {
    $m = (int)$row["mins_left"]; if ($m < 1) $m = 1;
    audit("login_blocked", "usuarios", (int)$row["id"], "bloqueado, mins_left={$m}");
    fail("demasiados intentos. intenta en {$m} min", 429);
  }

  if ((int)$row["activo"] !== 1) {
    audit("login_fail", "usuarios", (int)$row["id"], "usuario inactivo");
    fail("usuario inactivo", 403);
  }

  if (!password_verify($password, (string)$row["password_hash"])) {
    $intentos = (int)$row["intentos_fallidos"] + 1;

    if ($intentos >= 3) {
      $up = mysqli_prepare($enlace, "
        UPDATE usuarios
        SET intentos_fallidos=0,
            bloqueado_hasta=DATE_ADD(NOW(), INTERVAL 5 MINUTE)
        WHERE id=?
      ");
      mysqli_stmt_bind_param($up, "i", $row["id"]);
      mysqli_stmt_execute($up);
      mysqli_stmt_close($up);

      audit("login_fail_block", "usuarios", (int)$row["id"], "bloqueado 5 min");
      fail("demasiados intentos. intenta en 5 min", 429);
    }

    $up = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos=? WHERE id=?");
    mysqli_stmt_bind_param($up, "ii", $intentos, $row["id"]);
    mysqli_stmt_execute($up);
    mysqli_stmt_close($up);

    $r = 3 - $intentos;
    audit("login_fail", "usuarios", (int)$row["id"], "password incorrecta, intentos={$intentos}");
    fail("usuario o contraseña incorrectos. te quedan {$r} intento(s)", 401);
  }

  $up = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=?");
  mysqli_stmt_bind_param($up, "i", $row["id"]);
  mysqli_stmt_execute($up);
  mysqli_stmt_close($up);

  session_regenerate_id(true);

  $_SESSION["usuario_id"] = (int)$row["id"];
  $_SESSION["usuario"] = (string)$row["usuario"];
  $_SESSION["rol_id"] = $row["rol_id"] === null ? 0 : (int)$row["rol_id"];
  $_SESSION["rol_nombre"] = (string)($row["rol_nombre"] ?? "");
  $_SESSION["last_activity"] = time();

  audit("login_ok", "usuarios", (int)$row["id"], "inicio de sesión");

  $me = load_me();
  if (!$me) fail("error interno", 500);
  resp_me($me);
}

if ($action === "logout") {
  $uid = (int)($_SESSION["usuario_id"] ?? 0);
  if ($uid > 0) audit("logout", "usuarios", $uid, "cierre de sesión");
  $_SESSION = [];
  session_destroy();
  ok();
}

require_login();

/* ===================== USUARIOS ===================== */

if ($action === "usuarios_list") {
  require_perm("usuarios", "ver");

  $q = mysqli_query($enlace, "
    SELECT u.id, u.usuario, u.nombres, u.apellidos, u.cedula, u.fecha_nacimiento,
           u.activo, u.rol_id, COALESCE(r.nombre,'(sin rol)') AS rol_nombre
    FROM usuarios u
    LEFT JOIN roles r ON r.id=u.rol_id
    ORDER BY u.id DESC
  ");
  $data = [];
  while ($row = mysqli_fetch_assoc($q)) $data[] = $row;
  ok(["data" => $data]);
}

if ($action === "usuarios_create") {
  require_perm("usuarios", "crear");

  $usuario = trim(strtolower((string)($body["usuario"] ?? "")));
  $nombres = trim((string)($body["nombres"] ?? ""));
  $apellidos = trim((string)($body["apellidos"] ?? ""));
  $cedula_raw = (string)($body["cedula"] ?? "");
  $fecha_nacimiento = (string)($body["fecha_nacimiento"] ?? "");
  $pass = (string)($body["password"] ?? "");

  $rol_id = null;
  if (is_admin()) {
    $rol_raw = $body["rol_id"] ?? null;
    if ($rol_raw === "" || $rol_raw === "0" || $rol_raw === 0) $rol_raw = null;
    $rol_id = $rol_raw === null ? null : (int)$rol_raw;
    if ($rol_id !== null && $rol_id <= 0) $rol_id = null;
  }

  if ($usuario === "" || $nombres === "" || $apellidos === "" || $cedula_raw === "" || $fecha_nacimiento === "" || $pass === "") fail("datos incompletos");
  if (strlen($pass) < 8) fail("contraseña mínima 8 caracteres");

  [$okc, $cedula, $errc] = validar_cedula_ec($cedula_raw);
  if (!$okc) fail($errc);

  $edad = edad_desde_fecha($fecha_nacimiento);
  if ($edad === null) fail("fecha de nacimiento inválida");
  if ($edad < 18) fail("solo mayores de edad (18+)");

  $hash = password_hash($pass, PASSWORD_BCRYPT);

  if ($rol_id === null) {
    $st = mysqli_prepare($enlace, "
      INSERT INTO usuarios (usuario,nombres,apellidos,cedula,fecha_nacimiento,password_hash,activo,intentos_fallidos)
      VALUES (?,?,?,?,?,?,1,0)
    ");
    mysqli_stmt_bind_param($st, "ssssss", $usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $hash);
  } else {
    $st = mysqli_prepare($enlace, "
      INSERT INTO usuarios (usuario,nombres,apellidos,cedula,fecha_nacimiento,password_hash,rol_id,activo,intentos_fallidos)
      VALUES (?,?,?,?,?,?,?,1,0)
    ");
    mysqli_stmt_bind_param($st, "ssssssi", $usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $hash, $rol_id);
  }

  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) {
    if (is_duplicate_error($err)) {
      $f = dup_field($err);
      if ($f === "cedula") fail("cédula ya existe", 409);
      if ($f === "usuario") fail("usuario ya existe", 409);
      fail("registro duplicado", 409);
    }
    fail("error al crear usuario", 500);
  }

  $newId = (int)mysqli_insert_id($enlace);
  audit("usuarios_create", "usuarios", $newId > 0 ? $newId : null, "creó usuario {$usuario}");
  ok();
}

if ($action === "usuarios_update") {
  require_perm("usuarios", "editar");

  $id = (int)($body["id"] ?? 0);
  $usuario = trim(strtolower((string)($body["usuario"] ?? "")));
  $nombres = trim((string)($body["nombres"] ?? ""));
  $apellidos = trim((string)($body["apellidos"] ?? ""));
  $cedula_raw = (string)($body["cedula"] ?? "");
  $fecha_nacimiento = (string)($body["fecha_nacimiento"] ?? "");
  $activo = (int)($body["activo"] ?? 1);

  if ($id <= 0) fail("id inválido");
  if ($usuario === "" || $nombres === "" || $apellidos === "" || $cedula_raw === "" || $fecha_nacimiento === "") fail("datos incompletos");

  [$okc, $cedula, $errc] = validar_cedula_ec($cedula_raw);
  if (!$okc) fail($errc);

  $edad = edad_desde_fecha($fecha_nacimiento);
  if ($edad === null) fail("fecha de nacimiento inválida");
  if ($edad < 18) fail("solo mayores de edad (18+)");

  $passNew = isset($body["password"]) ? trim((string)$body["password"]) : "";
  $setPass = ($passNew !== "");
  $hash = null;
  if ($setPass) {
    if (strlen($passNew) < 8) fail("contraseña mínima 8 caracteres");
    $hash = password_hash($passNew, PASSWORD_BCRYPT);
  }

  $rol_id = null;
  $changeRol = false;
  if (is_admin() && array_key_exists("rol_id", $body)) {
    $changeRol = true;
    $rol_raw = $body["rol_id"];
    if ($rol_raw === "" || $rol_raw === "0" || $rol_raw === 0 || $rol_raw === null) $rol_id = null;
    else { $rol_id = (int)$rol_raw; if ($rol_id <= 0) $rol_id = null; }
  }

  $sql = "UPDATE usuarios SET usuario=?, nombres=?, apellidos=?, cedula=?, fecha_nacimiento=?, activo=?";
  $types = "sssssi";
  $params = [$usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $activo];

  if ($changeRol) {
    if ($rol_id === null) $sql .= ", rol_id=NULL";
    else { $sql .= ", rol_id=?"; $types .= "i"; $params[] = $rol_id; }
  }

  if ($setPass) { $sql .= ", password_hash=?"; $types .= "s"; $params[] = $hash; }

  $sql .= " WHERE id=?";
  $types .= "i";
  $params[] = $id;

  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno", 500);

  mysqli_stmt_bind_param($st, $types, ...$params);
  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) {
    if (is_duplicate_error($err)) {
      $f = dup_field($err);
      if ($f === "cedula") fail("cédula ya existe", 409);
      if ($f === "usuario") fail("usuario ya existe", 409);
      fail("registro duplicado", 409);
    }
    fail("error al actualizar usuario", 500);
  }

  audit("usuarios_update", "usuarios", $id, "editó usuario {$id} -> {$usuario}");
  ok();
}

if ($action === "usuarios_delete") {
  require_perm("usuarios", "eliminar");

  $id = (int)($body["id"] ?? 0);
  if ($id <= 0) fail("id inválido");

  $myId = (int)($_SESSION["usuario_id"] ?? 0);
  if ($id === $myId) fail("no puedes desactivarte");

  $st = mysqli_prepare($enlace, "
    SELECT u.id, COALESCE(r.nombre,'') AS rol_nombre
    FROM usuarios u
    LEFT JOIN roles r ON r.id=u.rol_id
    WHERE u.id=? LIMIT 1
  ");
  if (!$st) fail("error interno", 500);
  mysqli_stmt_bind_param($st, "i", $id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $target = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);

  if (!$target) fail("usuario no existe", 404);

  $rolTarget = strtolower(trim((string)($target["rol_nombre"] ?? "")));
  if ($rolTarget === "admin") fail("no se puede desactivar un usuario con rol admin", 403);

  $st2 = mysqli_prepare($enlace, "UPDATE usuarios SET activo=0 WHERE id=?");
  if (!$st2) fail("error interno", 500);
  mysqli_stmt_bind_param($st2, "i", $id);
  mysqli_stmt_execute($st2);
  mysqli_stmt_close($st2);

  audit("usuarios_delete", "usuarios", $id, "desactivó usuario {$id}");
  ok();
}


/* ===================== ROLES ===================== */

if ($action === "roles_list") {
  require_perm("roles", "ver");

  $q = mysqli_query($enlace, "SELECT id, nombre, descripcion, es_sistema FROM roles ORDER BY id DESC");
  $data = [];
  while ($r = mysqli_fetch_assoc($q)) $data[] = $r;
  ok(["data" => $data]);
}

/* crear roles: REGLA TUYA => si tiene rol_id > 0, puede crear roles aunque NO tenga roles.* */
if ($action === "roles_create") {
  $myRol = (int)($_SESSION["rol_id"] ?? 0);
  if ($myRol <= 0) fail("debes tener un rol asignado para crear roles", 403);

  $nombre = trim(strtolower((string)($body["nombre"] ?? "")));
  $desc = trim((string)($body["descripcion"] ?? ""));

  if ($nombre === "") fail("nombre requerido");
  if (!preg_match("/^[a-z0-9_]{3,50}$/", $nombre)) fail("nombre inválido (3-50, a-z 0-9 _ )");

  $st = mysqli_prepare($enlace, "INSERT INTO roles (nombre, descripcion, es_sistema) VALUES (?, ?, 0)");
  mysqli_stmt_bind_param($st, "ss", $nombre, $desc);
  $okExec = mysqli_stmt_execute($st);
  $err = mysqli_stmt_error($st);
  mysqli_stmt_close($st);

  if (!$okExec) {
    if (is_duplicate_error($err)) fail("rol ya existe", 409);
    fail("error al crear rol", 500);
  }

  $newId = (int)mysqli_insert_id($enlace);
  audit("roles_create", "roles", $newId > 0 ? $newId : null, "creó rol {$nombre}");
  ok();
}

/* editar rol: SOLO descripción, y respeta permisos (roles.editar). NO es solo admin. */
if ($action === "roles_update") {
  require_perm("roles", "editar");

  $id = (int)($body["id"] ?? 0);
  $desc = trim((string)($body["descripcion"] ?? ""));
  if ($id <= 0) fail("id inválido");

  $q = mysqli_query($enlace, "SELECT es_sistema FROM roles WHERE id={$id} LIMIT 1");
  $rr = $q ? mysqli_fetch_assoc($q) : null;
  if (!$rr) fail("rol no existe", 404);
  if ((int)$rr["es_sistema"] === 1) fail("no puedes editar un rol del sistema", 403);

  $st = mysqli_prepare($enlace, "UPDATE roles SET descripcion=? WHERE id=?");
  mysqli_stmt_bind_param($st, "si", $desc, $id);
  mysqli_stmt_execute($st);
  mysqli_stmt_close($st);

  audit("roles_update", "roles", $id, "editó rol {$id}");
  ok();
}

if ($action === "roles_delete") {
  fail("los roles no se eliminan", 403);
}

/* ===================== PERMISOS ===================== */

if ($action === "permisos_get") {
  require_perm("permisos", "ver");

  $roles = [];
  $q = mysqli_query($enlace, "SELECT id, nombre, descripcion FROM roles ORDER BY id DESC");
  while ($r = mysqli_fetch_assoc($q)) $roles[] = $r;

  $map = [];
  $q2 = mysqli_query($enlace, "
    SELECT rp.rol_id, p.modulo, p.accion
    FROM rol_permisos rp
    JOIN permisos p ON p.id=rp.permiso_id
  ");
  while ($x = mysqli_fetch_assoc($q2)) {
    $k = (string)$x["rol_id"];
    if (!isset($map[$k])) $map[$k] = [];
    $map[$k][] = $x["modulo"] . "." . $x["accion"];
  }

  ok(["roles" => $roles, "map" => $map]);
}

if ($action === "permisos_set") {
  require_perm("permisos", "editar");
  if (!is_admin()) fail("solo admin", 403);

  $rol_id = (int)($body["rol_id"] ?? 0);
  $perms = $body["perms"] ?? [];
  if ($rol_id <= 0) fail("rol inválido");

  mysqli_begin_transaction($enlace);

  $stDel = mysqli_prepare($enlace, "DELETE FROM rol_permisos WHERE rol_id=?");
  mysqli_stmt_bind_param($stDel, "i", $rol_id);
  mysqli_stmt_execute($stDel);
  mysqli_stmt_close($stDel);

  $stFind = mysqli_prepare($enlace, "SELECT id FROM permisos WHERE modulo=? AND accion=? LIMIT 1");
  $stIns  = mysqli_prepare($enlace, "INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)");

  $count = 0;
  foreach ($perms as $p) {
    $p = (string)$p;
    if (!str_contains($p, ".")) continue;
    [$m, $a] = explode(".", $p, 2);
    $m = trim($m); $a = trim($a);
    if ($m === "" || $a === "") continue;

    mysqli_stmt_bind_param($stFind, "ss", $m, $a);
    mysqli_stmt_execute($stFind);
    $res = mysqli_stmt_get_result($stFind);
    $row = $res ? mysqli_fetch_assoc($res) : null;

    if ($row && isset($row["id"])) {
      $pid = (int)$row["id"];
      mysqli_stmt_bind_param($stIns, "ii", $rol_id, $pid);
      mysqli_stmt_execute($stIns);
      $count++;
    }
  }

  mysqli_stmt_close($stFind);
  mysqli_stmt_close($stIns);

  mysqli_commit($enlace);

  audit("permisos_set", "rol_permisos", $rol_id, "asignó {$count} permiso(s) al rol {$rol_id}");
  ok();
}

fail("acción inválida", 404);
