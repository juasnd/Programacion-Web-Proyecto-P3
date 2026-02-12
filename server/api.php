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

/* =====================
   AUTH helpers (cuentas)
   ===================== */

function load_me() {
  global $enlace;

  $tipo = $_SESSION["tipo"] ?? "";
  if ($tipo !== "SISTEMA" && $tipo !== "ESTUDIANTE") return null;

  if ($tipo === "SISTEMA") {
    $uid = (int)($_SESSION["usuario_id"] ?? 0);
    if ($uid <= 0) return null;

    $st = mysqli_prepare($enlace, "
      SELECT u.id, u.usuario, u.nombres, u.apellidos, u.cedula, u.fecha_nacimiento, u.activo, u.rol_id,
             COALESCE(r.nombre,'') AS rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON r.id=u.rol_id
      WHERE u.id=? LIMIT 1
    ");
    if (!$st) return null;
    mysqli_stmt_bind_param($st, "i", $uid);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $me = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);

    if (!$me || (int)$me["activo"] !== 1) return null;
    $me["tipo"] = "SISTEMA";
    return $me;
  }

  // ESTUDIANTE
  $eid = (int)($_SESSION["estudiante_id"] ?? 0);
  if ($eid <= 0) return null;

  $st = mysqli_prepare($enlace, "
    SELECT e.id, c.usuario, e.nombres, e.apellidos, e.cedula, e.fecha_nacimiento, e.activo, e.rol_id,
           COALESCE(r.nombre,'') AS rol_nombre
    FROM estudiantes e
    JOIN cuentas c ON c.id=e.cuenta_id
    LEFT JOIN roles r ON r.id=e.rol_id
    WHERE e.id=? LIMIT 1
  ");
  if (!$st) return null;
  mysqli_stmt_bind_param($st, "i", $eid);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $me = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);

  if (!$me || (int)$me["activo"] !== 1) return null;
  $me["tipo"] = "ESTUDIANTE";
  return $me;
}

function resp_me($me){
  $rolId = $me["rol_id"] === null ? 0 : (int)$me["rol_id"];
  $_SESSION["rol_id"] = $rolId;
  $_SESSION["rol_nombre"] = (string)($me["rol_nombre"] ?? "");

  if ($rolId <= 0) $_SESSION["perms"] = [];
  else {
    $_SESSION["perms"] = perms_user();
    if (!is_array($_SESSION["perms"])) $_SESSION["perms"] = [];
  }

  $out = [
    "id" => (int)$me["id"],
    "usuario" => (string)($me["usuario"] ?? ""),
    "nombres" => (string)($me["nombres"] ?? ""),
    "apellidos" => (string)($me["apellidos"] ?? ""),
    "cedula" => (string)($me["cedula"] ?? ""),
    "fecha_nacimiento" => $me["fecha_nacimiento"] ?? null,
    "rol_id" => $rolId,
    "rol_nombre" => $_SESSION["rol_nombre"],
    "is_admin" => is_admin(),
    "perms" => $_SESSION["perms"],
    "tipo" => (string)($me["tipo"] ?? "SISTEMA"),
  ];
  if (($me["tipo"] ?? "") === "ESTUDIANTE") {
    $out["estudiante_id"] = (int)$me["id"];
  } else {
    $out["usuario_id"] = (int)$me["id"];
  }
  ok(["me" => $out]);
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

  // 1) buscar cuenta
  $st = mysqli_prepare($enlace, "SELECT id, usuario, password_hash, tipo, activo FROM cuentas WHERE usuario=? LIMIT 1");
  if (!$st) fail("error interno", 500);
  mysqli_stmt_bind_param($st, "s", $usuario);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $acc = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);

  if (!$acc) fail("usuario o contraseña incorrectos", 401);
  if ((int)$acc["activo"] !== 1) {
    audit("login_fail", "cuentas", (int)$acc["id"], "cuenta inactiva");
    fail("cuenta inactiva", 403);
  }

  $tipo = (string)$acc["tipo"];
  if ($tipo !== "SISTEMA" && $tipo !== "ESTUDIANTE") fail("tipo de cuenta inválido", 500);

  // 2) validar password (en cuentas)
  if (!password_verify($password, (string)$acc["password_hash"])) {
    audit("login_fail", "cuentas", (int)$acc["id"], "password incorrecta");
    fail("usuario o contraseña incorrectos", 401);
  }

  // 3) cargar perfil según tipo
  session_regenerate_id(true);
  $_SESSION["cuenta_id"] = (int)$acc["id"];
  $_SESSION["usuario"] = (string)$acc["usuario"];
  $_SESSION["tipo"] = $tipo;
  $_SESSION["last_activity"] = time();

  if ($tipo === "SISTEMA") {
    $st = mysqli_prepare($enlace, "
      SELECT u.id, u.activo, u.rol_id, COALESCE(r.nombre,'') AS rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON r.id=u.rol_id
      WHERE u.cuenta_id=? LIMIT 1
    ");
    if (!$st) fail("cuenta sin usuario del sistema", 403);
    mysqli_stmt_bind_param($st, "i", $acc["id"]);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $u = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);

    if (!$u) fail("cuenta sin usuario del sistema", 403);
    if ((int)$u["activo"] !== 1) fail("usuario inactivo", 403);

    $_SESSION["usuario_id"] = (int)$u["id"];
    $_SESSION["rol_id"] = $u["rol_id"] === null ? 0 : (int)$u["rol_id"];
    $_SESSION["rol_nombre"] = (string)($u["rol_nombre"] ?? "");
    audit("login_ok", "usuarios", (int)$u["id"], "inicio de sesión sistema");
  } else {
    $st = mysqli_prepare($enlace, "
      SELECT e.id, e.activo, e.rol_id, COALESCE(r.nombre,'') AS rol_nombre
      FROM estudiantes e
      LEFT JOIN roles r ON r.id=e.rol_id
      WHERE e.cuenta_id=? LIMIT 1
    ");
    if (!$st) fail("cuenta sin estudiante", 403);
    mysqli_stmt_bind_param($st, "i", $acc["id"]);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $e = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);

    if (!$e) fail("cuenta sin estudiante", 403);
    if ((int)$e["activo"] !== 1) fail("estudiante inactivo", 403);

    $_SESSION["estudiante_id"] = (int)$e["id"];
    $_SESSION["rol_id"] = $e["rol_id"] === null ? 0 : (int)$e["rol_id"];
    $_SESSION["rol_nombre"] = (string)($e["rol_nombre"] ?? "");
    audit("login_ok", "estudiantes", (int)$e["id"], "inicio de sesión estudiante");
  }

  $me = load_me();
  if (!$me) fail("error interno", 500);
  resp_me($me);
}

if ($action === "logout") {
  $tipo = (string)($_SESSION["tipo"] ?? "");
  if ($tipo === "SISTEMA") {
    $uid = (int)($_SESSION["usuario_id"] ?? 0);
    if ($uid > 0) audit("logout", "usuarios", $uid, "cierre de sesión");
  } else if ($tipo === "ESTUDIANTE") {
    $eid = (int)($_SESSION["estudiante_id"] ?? 0);
    if ($eid > 0) audit("logout", "estudiantes", $eid, "cierre de sesión");
  }

  $_SESSION = [];
  session_destroy();
  ok();
}

require_login();

/* ===================== USUARIOS (SISTEMA) ===================== */

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
  while ($q && ($row = mysqli_fetch_assoc($q))) $data[] = $row;
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

  mysqli_begin_transaction($enlace);

  // cuentas
  $stAcc = mysqli_prepare($enlace, "INSERT INTO cuentas(usuario,password_hash,tipo,activo) VALUES(?,?,'SISTEMA',1)");
  if (!$stAcc) { mysqli_rollback($enlace); fail("error interno",500); }
  mysqli_stmt_bind_param($stAcc, "ss", $usuario, $hash);
  $okExec = mysqli_stmt_execute($stAcc);
  $err = mysqli_stmt_error($stAcc);
  $accId = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($stAcc);

  if (!$okExec) {
    mysqli_rollback($enlace);
    if (is_duplicate_error($err)) fail("usuario ya existe", 409);
    fail("error al crear cuenta", 500);
  }

  // usuarios (duplicamos hash para no romper esquema actual)
  if ($rol_id === null) {
    $st = mysqli_prepare($enlace, "
      INSERT INTO usuarios (cuenta_id,usuario,nombres,apellidos,cedula,fecha_nacimiento,password_hash,activo,intentos_fallidos)
      VALUES (?,?,?,?,?,?,?,1,0)
    ");
    if (!$st) { mysqli_rollback($enlace); fail("error interno",500); }
    mysqli_stmt_bind_param($st, "issssss", $accId, $usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $hash);
  } else {
    $st = mysqli_prepare($enlace, "
      INSERT INTO usuarios (cuenta_id,usuario,nombres,apellidos,cedula,fecha_nacimiento,password_hash,rol_id,activo,intentos_fallidos)
      VALUES (?,?,?,?,?,?,?, ?,1,0)
    ");
    if (!$st) { mysqli_rollback($enlace); fail("error interno",500); }
    mysqli_stmt_bind_param($st, "issssssi", $accId, $usuario, $nombres, $apellidos, $cedula, $fecha_nacimiento, $hash, $rol_id);
  }

  $okExec = mysqli_stmt_execute($st);
  $err2 = mysqli_stmt_error($st);
  $newId = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($st);

  if (!$okExec) {
    mysqli_rollback($enlace);
    if (is_duplicate_error($err2)) {
      fail("registro duplicado (cédula o usuario)", 409);
    }
    fail("error al crear usuario", 500);
  }

  mysqli_commit($enlace);

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

  // obtener cuenta_id del usuario
  $st = mysqli_prepare($enlace, "SELECT cuenta_id FROM usuarios WHERE id=? LIMIT 1");
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $row = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);
  if (!$row) fail("usuario no existe", 404);
  $cuenta_id = (int)($row["cuenta_id"] ?? 0);
  if ($cuenta_id <= 0) fail("usuario sin cuenta", 500);

  mysqli_begin_transaction($enlace);

  // update usuarios
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

  $stU = mysqli_prepare($enlace, $sql);
  if (!$stU) { mysqli_rollback($enlace); fail("error interno",500); }
  mysqli_stmt_bind_param($stU, $types, ...$params);
  $okExec = mysqli_stmt_execute($stU);
  $err1 = mysqli_stmt_error($stU);
  mysqli_stmt_close($stU);

  if (!$okExec) { mysqli_rollback($enlace); if (is_duplicate_error($err1)) fail("cédula o usuario ya existe",409); fail("error al actualizar usuario",500); }

  // update cuentas (usuario, activo, password)
  $sql2 = "UPDATE cuentas SET usuario=?, activo=?";
  $types2 = "si";
  $params2 = [$usuario, $activo];
  if ($setPass) { $sql2 .= ", password_hash=?"; $types2 .= "s"; $params2[] = $hash; }
  $sql2 .= " WHERE id=? AND tipo='SISTEMA'";
  $types2 .= "i"; $params2[] = $cuenta_id;

  $stC = mysqli_prepare($enlace, $sql2);
  if (!$stC) { mysqli_rollback($enlace); fail("error interno",500); }
  mysqli_stmt_bind_param($stC, $types2, ...$params2);
  $okExec = mysqli_stmt_execute($stC);
  $err2 = mysqli_stmt_error($stC);
  mysqli_stmt_close($stC);

  if (!$okExec) { mysqli_rollback($enlace); if (is_duplicate_error($err2)) fail("usuario ya existe",409); fail("error al actualizar cuenta",500); }

  mysqli_commit($enlace);

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
    SELECT u.id, u.cuenta_id, COALESCE(r.nombre,'') AS rol_nombre
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

  mysqli_begin_transaction($enlace);

  $st2 = mysqli_prepare($enlace, "UPDATE usuarios SET activo=0 WHERE id=?");
  if (!$st2) { mysqli_rollback($enlace); fail("error interno",500); }
  mysqli_stmt_bind_param($st2, "i", $id);
  mysqli_stmt_execute($st2);
  mysqli_stmt_close($st2);

  $cid = (int)($target["cuenta_id"] ?? 0);
  if ($cid > 0) {
    $st3 = mysqli_prepare($enlace, "UPDATE cuentas SET activo=0 WHERE id=? AND tipo='SISTEMA'");
    if (!$st3) { mysqli_rollback($enlace); fail("error interno",500); }
    mysqli_stmt_bind_param($st3, "i", $cid);
    mysqli_stmt_execute($st3);
    mysqli_stmt_close($st3);
  }

  mysqli_commit($enlace);

  audit("usuarios_delete", "usuarios", $id, "desactivó usuario {$id}");
  ok();
}


/* ===================== ESTUDIANTES ===================== */
if ($action === "estudiantes_list") {
    require_perm("estudiantes", "ver");
    global $enlace;
    
    $sql = "
        SELECT e.id, e.nombres, e.apellidos, e.cedula, e.fecha_nacimiento,
               e.correo, e.telefono, e.activo, e.cuenta_id,
               c.usuario AS cuenta_usuario
        FROM estudiantes e
        LEFT JOIN cuentas c ON c.id = e.cuenta_id
        ORDER BY e.id DESC
    ";
    $q = mysqli_query($enlace, $sql);
    $data = [];
    while ($q && ($row = mysqli_fetch_assoc($q))) $data[] = $row;
    ok(["data" => $data]);
}

if ($action === "estudiantes_create") {
    require_perm("estudiantes", "crear");
    global $enlace;
    
    $nombres = trim((string)($body["nombres"] ?? ""));
    $apellidos = trim((string)($body["apellidos"] ?? ""));
    $cedula_raw = (string)($body["cedula"] ?? "");
    $fecha_nacimiento = (string)($body["fecha_nacimiento"] ?? "");
    $correo = trim((string)($body["correo"] ?? ""));
    $telefono = trim((string)($body["telefono"] ?? ""));
    $crear_cuenta = (int)($body["crear_cuenta"] ?? 0);
    
    if ($nombres === "" || $apellidos === "" || $cedula_raw === "" || $fecha_nacimiento === "") {
        fail("datos incompletos");
    }
    
    [$okc, $cedula, $errc] = validar_cedula_ec($cedula_raw);
    if (!$okc) fail($errc);
    
    $edad = edad_desde_fecha($fecha_nacimiento);
    if ($edad === null) fail("fecha de nacimiento inválida");
    
    mysqli_begin_transaction($enlace);
    
    $cuenta_id = null;
    
    if ($crear_cuenta) {
        // Usuario = cédula, password = cédula
        $usuario = $cedula;
        $hash = password_hash($cedula, PASSWORD_BCRYPT);
        
        $stAcc = mysqli_prepare($enlace, "INSERT INTO cuentas(usuario,password_hash,tipo,activo) VALUES(?,?,'ESTUDIANTE',1)");
        if (!$stAcc) { mysqli_rollback($enlace); fail("error interno",500); }
        mysqli_stmt_bind_param($stAcc, "ss", $usuario, $hash);
        $okExec = mysqli_stmt_execute($stAcc);
        $err = mysqli_stmt_error($stAcc);
        $cuenta_id = (int)mysqli_insert_id($enlace);
        mysqli_stmt_close($stAcc);
        
        if (!$okExec) {
            mysqli_rollback($enlace);
            if (is_duplicate_error($err)) fail("usuario ya existe", 409);
            fail("error al crear cuenta", 500);
        }
    }
    
    // Insertar estudiante
    if ($cuenta_id) {
        $st = mysqli_prepare($enlace, "
            INSERT INTO estudiantes (nombres, apellidos, cedula, fecha_nacimiento, correo, telefono, cuenta_id, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ");
        if (!$st) { mysqli_rollback($enlace); fail("error interno",500); }
        mysqli_stmt_bind_param($st, "ssssssi", $nombres, $apellidos, $cedula, $fecha_nacimiento, $correo, $telefono, $cuenta_id);
    } else {
        $st = mysqli_prepare($enlace, "
            INSERT INTO estudiantes (nombres, apellidos, cedula, fecha_nacimiento, correo, telefono, activo)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ");
        if (!$st) { mysqli_rollback($enlace); fail("error interno",500); }
        mysqli_stmt_bind_param($st, "ssssss", $nombres, $apellidos, $cedula, $fecha_nacimiento, $correo, $telefono);
    }
    
    $okExec = mysqli_stmt_execute($st);
    $err2 = mysqli_stmt_error($st);
    $newId = (int)mysqli_insert_id($enlace);
    mysqli_stmt_close($st);
    
    if (!$okExec) {
        mysqli_rollback($enlace);
        if (is_duplicate_error($err2)) fail("cédula duplicada", 409);
        fail("error al crear estudiante", 500);
    }
    
    mysqli_commit($enlace);
    
    audit("estudiantes_create", "estudiantes", $newId, "creó estudiante {$cedula}");
    ok(["id" => $newId]);
}

if ($action === "estudiantes_update") {
    require_perm("estudiantes", "editar");
    global $enlace;
    
    $id = (int)($body["id"] ?? 0);
    $nombres = trim((string)($body["nombres"] ?? ""));
    $apellidos = trim((string)($body["apellidos"] ?? ""));
    $cedula_raw = (string)($body["cedula"] ?? "");
    $fecha_nacimiento = (string)($body["fecha_nacimiento"] ?? "");
    $correo = trim((string)($body["correo"] ?? ""));
    $telefono = trim((string)($body["telefono"] ?? ""));
    $activo = (int)($body["activo"] ?? 1);
    
    if ($id <= 0) fail("id inválido");
    if ($nombres === "" || $apellidos === "" || $cedula_raw === "" || $fecha_nacimiento === "") {
        fail("datos incompletos");
    }
    
    [$okc, $cedula, $errc] = validar_cedula_ec($cedula_raw);
    if (!$okc) fail($errc);
    
    $edad = edad_desde_fecha($fecha_nacimiento);
    if ($edad === null) fail("fecha de nacimiento inválida");
    
    $st = mysqli_prepare($enlace, "
        UPDATE estudiantes 
        SET nombres=?, apellidos=?, cedula=?, fecha_nacimiento=?, correo=?, telefono=?, activo=?
        WHERE id=?
    ");
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "ssssssii", $nombres, $apellidos, $cedula, $fecha_nacimiento, $correo, $telefono, $activo, $id);
    
    if (!mysqli_stmt_execute($st)) {
        $err = mysqli_stmt_error($st);
        mysqli_stmt_close($st);
        if (is_duplicate_error($err)) fail("cédula duplicada", 409);
        fail("error al actualizar estudiante", 500);
    }
    mysqli_stmt_close($st);
    
    audit("estudiantes_update", "estudiantes", $id, "editó estudiante {$id}");
    ok();
}

if ($action === "estudiantes_delete") {
    require_perm("estudiantes", "eliminar");
    global $enlace;
    
    $id = (int)($body["id"] ?? 0);
    if ($id <= 0) fail("id inválido");
    
    mysqli_begin_transaction($enlace);
    
    // Obtener cuenta_id
    $st = mysqli_prepare($enlace, "SELECT cuenta_id FROM estudiantes WHERE id=? LIMIT 1");
    mysqli_stmt_bind_param($st, "i", $id);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $row = mysqli_fetch_assoc($res);
    $cuenta_id = $row ? (int)($row["cuenta_id"] ?? 0) : 0;
    mysqli_stmt_close($st);
    
    // Desactivar estudiante
    $st2 = mysqli_prepare($enlace, "UPDATE estudiantes SET activo=0 WHERE id=?");
    mysqli_stmt_bind_param($st2, "i", $id);
    mysqli_stmt_execute($st2);
    mysqli_stmt_close($st2);
    
    // Desactivar cuenta si existe
    if ($cuenta_id > 0) {
        $st3 = mysqli_prepare($enlace, "UPDATE cuentas SET activo=0 WHERE id=? AND tipo='ESTUDIANTE'");
        mysqli_stmt_bind_param($st3, "i", $cuenta_id);
        mysqli_stmt_execute($st3);
        mysqli_stmt_close($st3);
    }
    
    mysqli_commit($enlace);
    
    audit("estudiantes_delete", "estudiantes", $id, "desactivó estudiante {$id}");
    ok();
}

/* ===================== ROLES ===================== */

if ($action === "roles_list") {
  require_perm("roles", "ver");

  $q = mysqli_query($enlace, "SELECT id, nombre, descripcion, es_sistema FROM roles ORDER BY id DESC");
  $data = [];
  while ($q && ($r = mysqli_fetch_assoc($q))) $data[] = $r;
  ok(["data" => $data]);
}

if ($action === "roles_create") {
  $myRol = (int)($_SESSION["rol_id"] ?? 0);
  if ($myRol <= 0) fail("debes tener un rol asignado para crear roles", 403);

  $nombre = trim(strtolower((string)($body["nombre"] ?? "")));
  $desc = trim((string)($body["descripcion"] ?? ""));

  if ($nombre === "") fail("nombre requerido");
  if (!preg_match("/^[a-z0-9_]{3,50}$/", $nombre)) fail("nombre inválido (3-50, a-z 0-9 _ )");

  $st = mysqli_prepare($enlace, "INSERT INTO roles (nombre, descripcion, es_sistema) VALUES (?, ?, 0)");
  if (!$st) fail("error interno",500);
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
  if (!$st) fail("error interno",500);
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
  while ($q && ($r = mysqli_fetch_assoc($q))) $roles[] = $r;

  $map = [];
  $q2 = mysqli_query($enlace, "
    SELECT rp.rol_id, p.modulo, p.accion
    FROM rol_permisos rp
    JOIN permisos p ON p.id=rp.permiso_id
  ");
  while ($q2 && ($x = mysqli_fetch_assoc($q2))) {
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
  if (!$stDel) { mysqli_rollback($enlace); fail("error interno",500); }
  mysqli_stmt_bind_param($stDel, "i", $rol_id);
  mysqli_stmt_execute($stDel);
  mysqli_stmt_close($stDel);

  $stFind = mysqli_prepare($enlace, "SELECT id FROM permisos WHERE modulo=? AND accion=? LIMIT 1");
  $stIns  = mysqli_prepare($enlace, "INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)");
  if (!$stFind || !$stIns) { mysqli_rollback($enlace); fail("error interno",500); }

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

/* =========================
   cursos (ONLINE)
   campos permitidos: nombre, descripcion, duracion_semanas, costo, dia_semana, hora_inicio, hora_fin, docente_id
   ========================= */

if ($action === "cursos_list") {
  require_active_user();


  $sql = "
    SELECT c.id, c.nombre, c.descripcion, c.duracion_semanas, c.costo,
           c.dia_semana,
           TIME_FORMAT(c.hora_inicio,'%H:%i') hora_inicio,
           TIME_FORMAT(c.hora_fin,'%H:%i') hora_fin,
           c.docente_id, c.activo,
           CONCAT(IFNULL(u.nombres,''),' ',IFNULL(u.apellidos,'')) AS docente_nombre
    FROM cursos c
    LEFT JOIN usuarios u ON u.id=c.docente_id
    WHERE c.activo=1
    ORDER BY c.id DESC
  ";
  $r = mysqli_query($enlace, $sql);
  $rows = [];
  while ($r && ($row = mysqli_fetch_assoc($r))) $rows[] = $row;
  ok(["rows"=>$rows]);
}

function validar_hora_hhmm($h){
  return preg_match('/^\d{2}:\d{2}$/', $h) === 1;
}

if ($action === "cursos_create") {
  require_active_user();
  require_perm("cursos","crear");

  $nombre = trim((string)($body["nombre"] ?? ""));
  $descripcion = trim((string)($body["descripcion"] ?? ""));
  $dur = (int)($body["duracion_semanas"] ?? 4);
  $costo = (float)($body["costo"] ?? 0);

  $docente_id_raw = array_key_exists("docente_id",$body) ? $body["docente_id"] : null;
  $docente_id = ($docente_id_raw === "" || $docente_id_raw === null) ? null : (int)$docente_id_raw;

  $dia = (int)($body["dia_semana"] ?? 1);
  $hi = trim((string)($body["hora_inicio"] ?? "07:00"));
  $hf = trim((string)($body["hora_fin"] ?? "08:00"));

  if ($nombre==="") fail("nombre requerido");
  if ($dur <= 0 || $dur > 52) fail("duración inválida");
  if ($costo < 0) fail("costo inválido");
  if ($dia < 1 || $dia > 7) fail("dia_semana inválido");
  if (!validar_hora_hhmm($hi) || !validar_hora_hhmm($hf)) fail("hora inválida (HH:MM)");
  if ($hi >= $hf) fail("hora_inicio debe ser menor que hora_fin");

  $stmt = mysqli_prepare($enlace, "
    INSERT INTO cursos (
      nombre, descripcion, duracion_semanas, costo, 
      dia_semana, hora_inicio, hora_fin, docente_id, activo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  ");
  
  if (!$stmt) {
    error_log("Error prepare: " . mysqli_error($enlace));
    fail("error interno", 500);
  }

  mysqli_stmt_bind_param($stmt, "ssidiiss", 
    $nombre,
    $descripcion,
    $dur,
    $costo,
    $dia,
    $hi,
    $hf,
    $docente_id
  );

  if (!mysqli_stmt_execute($stmt)) {
    $error = mysqli_stmt_error($stmt);
    error_log("Error execute: " . $error);
    mysqli_stmt_close($stmt);
    fail("no se pudo crear: " . ($error ?: "error desconocido"), 400);
  }
  
  $id = (int)mysqli_insert_id($enlace);
  mysqli_stmt_close($stmt);

  audit("cursos_create","cursos",$id,"creó curso {$nombre}");
  ok(["id"=>$id]);
}



if ($action === "cursos_update") {
  require_active_user();
  require_perm("cursos","editar");

  $id = (int)($body["id"] ?? 0);
  $nombre = trim((string)($body["nombre"] ?? ""));
  $descripcion = trim((string)($body["descripcion"] ?? ""));
  $dur = (int)($body["duracion_semanas"] ?? 4);
  $costo = (float)($body["costo"] ?? 0);

  $docente_id_raw = array_key_exists("docente_id",$body) ? $body["docente_id"] : null;
  $docente_id = ($docente_id_raw === "" || $docente_id_raw === null) ? null : (int)$docente_id_raw;

  $dia = (int)($body["dia_semana"] ?? 1);
  $hi = trim((string)($body["hora_inicio"] ?? "07:00"));
  $hf = trim((string)($body["hora_fin"] ?? "08:00"));

  if ($id<=0) fail("id inválido");
  if ($nombre==="") fail("nombre requerido");
  if ($dur <= 0 || $dur > 52) fail("duración inválida");
  if ($costo < 0) fail("costo inválido");
  if ($dia < 1 || $dia > 7) fail("dia_semana inválido");
  if (!validar_hora_hhmm($hi) || !validar_hora_hhmm($hf)) fail("hora inválida (HH:MM)");
  if ($hi >= $hf) fail("hora_inicio debe ser menor que hora_fin");

  $stmt = mysqli_prepare($enlace, "
    UPDATE cursos
    SET nombre=?, descripcion=?, duracion_semanas=?, costo=?,
        dia_semana=?, hora_inicio=?, hora_fin=?,
        docente_id=?
    WHERE id=?
  ");
  
  if (!$stmt) fail("error interno: " . mysqli_error($enlace), 500);

  mysqli_stmt_bind_param($stmt, "ssidiissi",
    $nombre,
    $descripcion,
    $dur,
    $costo,
    $dia,
    $hi,
    $hf,
    $docente_id,
    $id
  );

  if (!mysqli_stmt_execute($stmt)) {
    $error = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    fail("no se pudo actualizar: " . ($error ?: "error desconocido"), 400);
  }
  
  mysqli_stmt_close($stmt);
  audit("cursos_update","cursos",$id,"editó curso {$id}");
  ok();
}

if ($action === "cursos_delete") {
  require_active_user();
  require_perm("cursos","eliminar");

  $id = (int)($body["id"] ?? 0);
  if ($id<=0) fail("id inválido");

  $stmt = mysqli_prepare($enlace, "UPDATE cursos SET activo=0 WHERE id=?");
  if (!$stmt) fail("error interno",500);
  mysqli_stmt_bind_param($stmt, "i", $id);
  mysqli_stmt_execute($stmt);
  mysqli_stmt_close($stmt);

  audit("cursos_delete","cursos",$id,"desactivó curso {$id}");
  ok();
}

/* =========================
   matriculas (ESTUDIANTE)
   - estudiante se matricula/anula a sí mismo
   - listado del horario (parte de abajo)
   ========================= */

function require_student_session(){
  $t = (string)($_SESSION["tipo"] ?? "");
  if ($t !== "ESTUDIANTE") fail("solo estudiante", 403);
}

if ($action === "matriculas_create") {
  require_active_user();
  require_student_session();
  global $enlace;

  $curso_id = (int)($body["curso_id"] ?? 0);
  if ($curso_id<=0) fail("curso inválido");

  $estudiante_id = (int)($_SESSION["estudiante_id"] ?? 0);
  if ($estudiante_id<=0) fail("estudiante inválido", 401);

  // obtener datos del curso (día/hora) para choque
  $st = mysqli_prepare($enlace, "
    SELECT dia_semana,
           TIME_FORMAT(hora_inicio,'%H:%i') hi,
           TIME_FORMAT(hora_fin,'%H:%i') hf
    FROM cursos
    WHERE id=? AND activo=1
    LIMIT 1
  ");
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $curso_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $crow = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);
  if (!$crow) fail("curso no existe o inactivo");

  $dia = (int)$crow["dia_semana"];
  $hi = (string)$crow["hi"];
  $hf = (string)$crow["hf"];

  // choque: mismo día + traslape
  $sql = "
    SELECT m.curso_id
    FROM matriculas m
    JOIN cursos c ON c.id=m.curso_id
    WHERE m.estudiante_id=? AND m.estado='ACTIVA'
      AND c.activo=1
      AND c.dia_semana=?
      AND NOT (TIME(c.hora_fin) <= STR_TO_DATE(?, '%H:%i')
               OR TIME(c.hora_inicio) >= STR_TO_DATE(?, '%H:%i'))
    LIMIT 1
  ";
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "iiss", $estudiante_id,$dia,$hi,$hf);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $conf = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);
  if ($conf) fail("choque de horario con otro curso (mismo día y traslape)", 409);

  // insertar / reactivar
  $st = mysqli_prepare($enlace, "
    INSERT INTO matriculas(curso_id,estudiante_id,estado)
    VALUES(?,?,'ACTIVA')
    ON DUPLICATE KEY UPDATE estado='ACTIVA'
  ");
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "ii", $curso_id,$estudiante_id);
  if (!mysqli_stmt_execute($st)) {
    $e = mysqli_stmt_error($st);
    mysqli_stmt_close($st);
    fail($e ?: "no se pudo matricular", 400);
  }
  mysqli_stmt_close($st);

  audit("matriculas_create","matriculas",null,"matriculó estudiante {$estudiante_id} en curso {$curso_id}");
  ok();
}

if ($action === "matriculas_anular") {
  require_active_user();
  require_student_session();
  global $enlace;

  $curso_id = (int)($body["curso_id"] ?? 0);
  if ($curso_id<=0) fail("curso inválido");

  $estudiante_id = (int)($_SESSION["estudiante_id"] ?? 0);
  if ($estudiante_id<=0) fail("estudiante inválido", 401);

  $st = mysqli_prepare($enlace, "
    UPDATE matriculas
    SET estado='ANULADA'
    WHERE curso_id=? AND estudiante_id=?
  ");
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "ii", $curso_id,$estudiante_id);
  mysqli_stmt_execute($st);
  mysqli_stmt_close($st);

  audit("matriculas_anular","matriculas",null,"anuló matrícula estudiante {$estudiante_id} curso {$curso_id}");
  ok();
}

if ($action === "matriculas_list_estudiante") {
  require_active_user();
  global $enlace;

  // estudiante: solo su propio horario. sistema: requiere permiso (opcional)
  $tipo = (string)($_SESSION["tipo"] ?? "");
  if ($tipo === "ESTUDIANTE") {
    $estudiante_id = (int)($_SESSION["estudiante_id"] ?? 0);
  } else {
    require_perm("matriculas", "ver");
    $estudiante_id = (int)($_GET["estudiante_id"] ?? 0);
  }

  if ($estudiante_id<=0) fail("estudiante_id inválido");

  $sql = "
    SELECT m.curso_id,
           c.nombre, c.descripcion, c.dia_semana,
           TIME_FORMAT(c.hora_inicio,'%H:%i') hora_inicio,
           TIME_FORMAT(c.hora_fin,'%H:%i') hora_fin,
           c.duracion_semanas, c.costo,
           CONCAT(IFNULL(u.nombres,''),' ',IFNULL(u.apellidos,'')) AS docente_nombre
    FROM matriculas m
    JOIN cursos c ON c.id=m.curso_id
    LEFT JOIN usuarios u ON u.id=c.docente_id
    WHERE m.estudiante_id=? AND m.estado='ACTIVA' AND c.activo=1
    ORDER BY c.dia_semana ASC, c.hora_inicio ASC
  ";
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $estudiante_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);

  ok(["rows"=>$rows]);
}

/* =========================
   notas (docente / admin)
   ========================= */

if ($action === "mis_cursos") {
  require_active_user();
  require_perm("notas","ver");
  global $enlace;

  $isAdmin = is_admin();
  $docente_id = $isAdmin ? (int)($_GET["docente_id"] ?? 0) : (int)($_SESSION["usuario_id"] ?? 0);

  if ($isAdmin && $docente_id > 0) {
    $sql = "SELECT id,nombre,dia_semana,
                   TIME_FORMAT(hora_inicio,'%H:%i') hora_inicio,
                   TIME_FORMAT(hora_fin,'%H:%i') hora_fin,
                   docente_id
            FROM cursos
            WHERE activo=1 AND docente_id=?
            ORDER BY id DESC";
    $st = mysqli_prepare($enlace, $sql);
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "i", $docente_id);
  } else if ($isAdmin) {
    $sql = "SELECT id,nombre,dia_semana,
                   TIME_FORMAT(hora_inicio,'%H:%i') hora_inicio,
                   TIME_FORMAT(hora_fin,'%H:%i') hora_fin,
                   docente_id
            FROM cursos
            WHERE activo=1
            ORDER BY id DESC";
    $st = mysqli_prepare($enlace, $sql);
    if (!$st) fail("error interno",500);
  } else {
    $sql = "SELECT id,nombre,dia_semana,
                   TIME_FORMAT(hora_inicio,'%H:%i') hora_inicio,
                   TIME_FORMAT(hora_fin,'%H:%i') hora_fin
            FROM cursos
            WHERE activo=1 AND docente_id=?
            ORDER BY id DESC";
    $st = mysqli_prepare($enlace, $sql);
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "i", $docente_id);
  }

  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);
  ok(["rows"=>$rows]);
}

if ($action === "curso_estudiantes") {
  require_active_user();
  require_perm("notas","ver");
  global $enlace;

  $curso_id = (int)($_GET["curso_id"] ?? 0);
  if ($curso_id<=0) fail("curso_id inválido");

  // docente solo puede ver estudiantes de sus cursos (admin puede todo)
  if (!is_admin()) {
    $docente_id = (int)($_SESSION["usuario_id"] ?? 0);
    $st = mysqli_prepare($enlace, "SELECT id FROM cursos WHERE id=? AND docente_id=? AND activo=1 LIMIT 1");
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "ii", $curso_id,$docente_id);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $okc = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);
    if (!$okc) fail("no autorizado",403);
  } else {
    $st = mysqli_prepare($enlace, "SELECT id FROM cursos WHERE id=? AND activo=1 LIMIT 1");
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "i", $curso_id);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $okc = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);
    if (!$okc) fail("curso no existe o inactivo",404);
  }

  $sql = "
    SELECT e.id estudiante_id, cta.usuario, e.nombres, e.apellidos, e.cedula,
           n.p1_total, n.p2_total, n.p3_total, n.nota_final, n.estado, n.supletorio_nota
    FROM matriculas m
    JOIN estudiantes e ON e.id=m.estudiante_id
    JOIN cuentas cta ON cta.id=e.cuenta_id
    LEFT JOIN notas n ON n.curso_id=m.curso_id AND n.estudiante_id=m.estudiante_id
    WHERE m.curso_id=? AND m.estado='ACTIVA'
    ORDER BY e.apellidos ASC, e.nombres ASC
  ";
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $curso_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);

  ok(["rows"=>$rows]);
}

if ($action === "guardar_notas") {
  require_active_user();
  require_perm("notas","editar");
  global $enlace;

  $curso_id = (int)($body["curso_id"] ?? 0);
  $items = $body["items"] ?? [];
  if ($curso_id<=0 || !is_array($items)) fail("datos inválidos");

  $actualizado_por = (int)($_SESSION["usuario_id"] ?? 0);
  
  // Verificar permiso
  if (!is_admin()) {
    $st = mysqli_prepare($enlace, "SELECT id FROM cursos WHERE id=? AND docente_id=? AND activo=1 LIMIT 1");
    if (!$st) fail("error interno",500);
    mysqli_stmt_bind_param($st, "ii", $curso_id,$actualizado_por);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $okc = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($st);
    if (!$okc) fail("no autorizado",403);
  }

  mysqli_begin_transaction($enlace);

  foreach ($items as $it) {
    $eid = (int)($it["estudiante_id"] ?? 0);
    if ($eid<=0) { mysqli_rollback($enlace); fail("estudiante inválido"); }

    // Obtener notas
    $p1 = (float)($it["p1_total"] ?? 0);
    $p2 = (float)($it["p2_total"] ?? 0);
    $p3 = (float)($it["p3_total"] ?? 0);
    $sup = $it["supletorio_nota"] ?? null;
    if ($sup === "" || $sup === "null") $sup = null;
    
    // Calcular promedio
    $promedio = round(($p1 + $p2 + $p3) / 3, 2);
    
    // ===== LÓGICA DE NOTAS CORREGIDA =====
    $nota_final = $promedio;
    $estado = "REPROBADO";
    
    if ($promedio >= 14) {
        // APRUEBA DIRECTAMENTE
        $nota_final = $promedio;
        $estado = "APROBADO";
        $sup = null;
    } 
    elseif ($promedio >= 10 && $promedio < 14) {
        // VA A SUPLETORIO
        if ($sup !== null) {
            // YA TIENE NOTA DE SUPLETORIO
            $nota_final = $promedio; // ✅ LA NOTA FINAL ES EL PROMEDIO
            $estado = ($sup >= 14) ? "APROBADO" : "REPROBADO";
            // CONSERVAMOS $sup PARA GUARDARLO
        } else {
            // ESPERANDO SUPLETORIO
            $nota_final = $promedio;
            $estado = "SUPLETORIO";
            $sup = null;
        }
    } 
    else {
        // REPROBADO DIRECTO
        $nota_final = $promedio;
        $estado = "REPROBADO";
        $sup = null;
    }

    // Verificar si ya existe el registro
    $check = mysqli_prepare($enlace, "SELECT id FROM notas WHERE curso_id=? AND estudiante_id=?");
    mysqli_stmt_bind_param($check, "ii", $curso_id, $eid);
    mysqli_stmt_execute($check);
    $exists = mysqli_stmt_get_result($check)->num_rows > 0;
    mysqli_stmt_close($check);

    if ($exists) {
      // UPDATE
      $sql = "UPDATE notas SET 
              p1_total = ?, p2_total = ?, p3_total = ?,
              supletorio_nota = ?, nota_final = ?, estado = ?, actualizado_por = ?
              WHERE curso_id = ? AND estudiante_id = ?";
      $stmt = mysqli_prepare($enlace, $sql);
      mysqli_stmt_bind_param($stmt, "dddddsiii", 
        $p1, $p2, $p3, $sup, $nota_final, $estado, $actualizado_por, $curso_id, $eid);
    } else {
      // INSERT
      $sql = "INSERT INTO notas 
              (curso_id, estudiante_id, p1_total, p2_total, p3_total, supletorio_nota, nota_final, estado, actualizado_por) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
      $stmt = mysqli_prepare($enlace, $sql);
      mysqli_stmt_bind_param($stmt, "iidddddsi", 
        $curso_id, $eid, $p1, $p2, $p3, $sup, $nota_final, $estado, $actualizado_por);
    }

    if (!mysqli_stmt_execute($stmt)) {
      $error = mysqli_stmt_error($stmt);
      mysqli_stmt_close($stmt);
      mysqli_rollback($enlace);
      fail("Error al guardar: " . $error, 400);
    }
    mysqli_stmt_close($stmt);
  }

  mysqli_commit($enlace);
  audit("notas_guardar", "notas", $curso_id, "guardó notas curso {$curso_id}");
  ok();
}

/* =========================
   reportes (JSON)
   ========================= */
/* =========================
   REPORTES 
   ========================= */

if ($action === "reporte_horario_docente") {
  require_active_user();
  require_perm("horarios","ver");
  global $enlace;

  $docente_id = (int)($_SESSION["usuario_id"] ?? 0);
  $sql = "SELECT id, nombre, paralelo, periodo, dia_semana,
                 TIME_FORMAT(hora_inicio,'%H:%i') hora_inicio,
                 TIME_FORMAT(hora_fin,'%H:%i') hora_fin,
                 aula
          FROM cursos
          WHERE activo=1 AND docente_id=?
          ORDER BY periodo DESC, dia_semana ASC, hora_inicio ASC";
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $docente_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);
  ok(["rows"=>$rows]);
}
if ($action === "reporte_notas_estudiante") {
  require_active_user();
  require_perm("reportes","ver");
  global $enlace;

  $tipo = (string)($_SESSION["tipo"] ?? "");
  if ($tipo !== "ESTUDIANTE") fail("solo estudiante", 403);
  $eid = (int)($_SESSION["estudiante_id"] ?? 0);

  $sql = "SELECT 
            c.nombre,
            COALESCE(n.p1_total, 0) as p1_total,
            COALESCE(n.p2_total, 0) as p2_total,
            COALESCE(n.p3_total, 0) as p3_total,
            COALESCE(n.nota_final, 0) as nota_final,
            COALESCE(n.estado, 'REPROBADO') as estado,
            n.supletorio_nota,
            CONCAT(u.nombres, ' ', u.apellidos) as docente_nombre,
            c.dia_semana,
            TIME_FORMAT(c.hora_inicio, '%H:%i') as hora_inicio,
            TIME_FORMAT(c.hora_fin, '%H:%i') as hora_fin
          FROM matriculas m
          JOIN cursos c ON c.id = m.curso_id
          LEFT JOIN usuarios u ON u.id = c.docente_id
          LEFT JOIN notas n ON n.curso_id = m.curso_id AND n.estudiante_id = m.estudiante_id
          WHERE m.estudiante_id = ? AND m.estado = 'ACTIVA' AND c.activo = 1
          ORDER BY c.nombre ASC";
  
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno", 500);
  mysqli_stmt_bind_param($st, "i", $eid);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) {
    $rows[] = $row;
  }
  mysqli_stmt_close($st);
  ok(["rows" => $rows]);
}
if ($action === "reporte_cursos_docente") {
  require_active_user();
  require_perm("reportes","ver");
  global $enlace;

  $docente_id = (int)($_SESSION["usuario_id"] ?? 0);
  
  $sql = "SELECT 
            c.id,
            c.nombre,
            c.paralelo,
            c.periodo,
            c.dia_semana,
            TIME_FORMAT(c.hora_inicio,'%H:%i') hora_inicio,
            TIME_FORMAT(c.hora_fin,'%H:%i') hora_fin,
            c.aula,
            (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id AND m.estado = 'ACTIVA') as total_estudiantes
          FROM cursos c
          WHERE c.activo = 1 AND c.docente_id = ?
          ORDER BY c.periodo DESC, c.nombre ASC";
  
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "i", $docente_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);
  ok(["rows"=>$rows]);
}

if ($action === "reporte_notas_curso_docente") {
  require_active_user();
  require_perm("reportes","ver");
  global $enlace;

  $docente_id = (int)($_SESSION["usuario_id"] ?? 0);
  $curso_id = (int)($_GET["curso_id"] ?? 0);
  
  if ($curso_id <= 0) fail("curso_id requerido", 400);
  
  $sql = "SELECT 
            e.id as estudiante_id,
            e.nombres,
            e.apellidos,
            e.cedula,
            COALESCE(n.p1_total, 0) as p1_total,
            COALESCE(n.p2_total, 0) as p2_total,
            COALESCE(n.p3_total, 0) as p3_total,
            COALESCE(n.nota_final, 0) as nota_final,
            COALESCE(n.estado, 'REPROBADO') as estado,
            n.supletorio_nota
          FROM cursos c
          JOIN matriculas m ON m.curso_id = c.id
          JOIN estudiantes e ON e.id = m.estudiante_id
          LEFT JOIN notas n ON n.curso_id = c.id AND n.estudiante_id = e.id
          WHERE c.id = ? AND c.docente_id = ? AND c.activo = 1 AND m.estado = 'ACTIVA'
          ORDER BY e.apellidos ASC, e.nombres ASC";
  
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno",500);
  mysqli_stmt_bind_param($st, "ii", $curso_id, $docente_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $rows = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) $rows[] = $row;
  mysqli_stmt_close($st);
  ok(["rows"=>$rows]);
}
/* =========================
   MI PERFIL (ESTUDIANTE)
   SOLO EDITABLE: correo, telefono, fecha_nacimiento, usuario, password
   ========================= */

if ($action === "mi_perfil") {
  require_active_user();
  global $enlace;

  $tipo = (string)($_SESSION["tipo"] ?? "");
  if ($tipo !== "ESTUDIANTE") fail("solo estudiantes", 403);
  
  $estudiante_id = (int)($_SESSION["estudiante_id"] ?? 0);
  if ($estudiante_id <= 0) fail("estudiante no identificado", 401);

  $sql = "SELECT 
            e.id,
            e.nombres,
            e.apellidos,
            e.cedula,
            e.fecha_nacimiento,
            e.correo,
            e.telefono,
            e.activo,
            c.id as cuenta_id,
            c.usuario,
            c.tipo
          FROM estudiantes e
          JOIN cuentas c ON c.id = e.cuenta_id
          WHERE e.id = ? AND e.activo = 1 AND c.activo = 1";
  
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno", 500);
  mysqli_stmt_bind_param($st, "i", $estudiante_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $perfil = $res ? mysqli_fetch_assoc($res) : null;
  mysqli_stmt_close($st);

  if (!$perfil) fail("perfil no encontrado", 404);

  ok(["perfil" => $perfil]);
}

if ($action === "mi_perfil_actualizar") {
  require_active_user();
  global $enlace;

  $tipo = (string)($_SESSION["tipo"] ?? "");
  if ($tipo !== "ESTUDIANTE") fail("solo estudiantes", 403);
  
  $estudiante_id = (int)($_SESSION["estudiante_id"] ?? 0);
  if ($estudiante_id <= 0) fail("estudiante no identificado", 401);

  // SOLO CAMPOS EDITABLES
  $fecha_nacimiento = (string)($body["fecha_nacimiento"] ?? "");
  $correo = trim((string)($body["correo"] ?? ""));
  $telefono = trim((string)($body["telefono"] ?? ""));
  $usuario = trim(strtolower((string)($body["usuario"] ?? "")));
  $password = (string)($body["password"] ?? "");

  // Validar fecha de nacimiento (mayor de 18)
  if ($fecha_nacimiento === "") {
    fail("fecha de nacimiento es obligatoria", 400);
  }

  $edad = edad_desde_fecha($fecha_nacimiento);
  if ($edad === null) fail("fecha de nacimiento inválida", 400);
  if ($edad < 18) fail("debes ser mayor de edad (18+)", 400);

  mysqli_begin_transaction($enlace);

  // 1. Actualizar SOLO fecha_nacimiento, correo, telefono del estudiante
  $sql = "UPDATE estudiantes 
          SET fecha_nacimiento = ?, 
              correo = ?, 
              telefono = ? 
          WHERE id = ?";
  $st = mysqli_prepare($enlace, $sql);
  if (!$st) { mysqli_rollback($enlace); fail("error interno", 500); }
  mysqli_stmt_bind_param($st, "sssi", $fecha_nacimiento, $correo, $telefono, $estudiante_id);
  
  if (!mysqli_stmt_execute($st)) {
    mysqli_rollback($enlace);
    fail("error al actualizar datos personales", 500);
  }
  mysqli_stmt_close($st);

  // 2. Obtener cuenta_id
  $st = mysqli_prepare($enlace, "SELECT cuenta_id FROM estudiantes WHERE id = ?");
  mysqli_stmt_bind_param($st, "i", $estudiante_id);
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  $row = mysqli_fetch_assoc($res);
  $cuenta_id = (int)($row["cuenta_id"] ?? 0);
  mysqli_stmt_close($st);

  if ($cuenta_id <= 0) {
    mysqli_rollback($enlace);
    fail("cuenta de usuario no encontrada", 404);
  }

  // 3. Actualizar usuario SOLO si se proporcionó y es válido
  if ($usuario !== "") {
    if (strlen($usuario) < 4) {
      mysqli_rollback($enlace);
      fail("el usuario debe tener al menos 4 caracteres", 400);
    }
    
    $st = mysqli_prepare($enlace, "UPDATE cuentas SET usuario = ? WHERE id = ? AND tipo = 'ESTUDIANTE'");
    mysqli_stmt_bind_param($st, "si", $usuario, $cuenta_id);
    if (!mysqli_stmt_execute($st)) {
      $err = mysqli_stmt_error($st);
      mysqli_stmt_close($st);
      mysqli_rollback($enlace);
      if (is_duplicate_error($err)) fail("el nombre de usuario ya está en uso", 409);
      fail("error al actualizar usuario", 500);
    }
    mysqli_stmt_close($st);
    
    $_SESSION["usuario"] = $usuario;
  }

  // 4. Actualizar contraseña SOLO si se proporcionó
  if ($password !== "") {
    if (strlen($password) < 8) {
      mysqli_rollback($enlace);
      fail("la contraseña debe tener al menos 8 caracteres", 400);
    }
    
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $st = mysqli_prepare($enlace, "UPDATE cuentas SET password_hash = ? WHERE id = ? AND tipo = 'ESTUDIANTE'");
    mysqli_stmt_bind_param($st, "si", $hash, $cuenta_id);
    if (!mysqli_stmt_execute($st)) {
      mysqli_stmt_close($st);
      mysqli_rollback($enlace);
      fail("error al actualizar contraseña", 500);
    }
    mysqli_stmt_close($st);
  }

  mysqli_commit($enlace);

  audit("perfil_update", "estudiantes", $estudiante_id, "actualizó su perfil");
  ok(["mensaje" => "perfil actualizado correctamente"]);
}

if ($action === "auditoria_list") {
  require_perm("auditoria", "ver");
  global $enlace;

  $search = trim((string)($_GET["search"] ?? ""));
  $accion = trim((string)($_GET["accion"] ?? ""));
  $limit = isset($_GET["limit"]) ? (int)$_GET["limit"] : 100;
  $offset = isset($_GET["offset"]) ? (int)$_GET["offset"] : 0;

  $sql = "SELECT 
            id,
            DATE_FORMAT(fecha, '%d/%m/%Y %H:%i:%s') as fecha,
            usuario,
            usuario_id,
            ip,
            accion,
            tabla,
            descripcion as detalle
          FROM auditoria
          WHERE 1=1";
  $params = [];
  $types = "";

  if ($search !== "") {
    $sql .= " AND (usuario LIKE ? OR ip LIKE ? OR accion LIKE ? OR tabla LIKE ? OR descripcion LIKE ?)";
    $s = "%$search%";
    $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s;
    $types .= "sssss";
  }

  if ($accion !== "") {
    $sql .= " AND accion = ?";
    $params[] = $accion;
    $types .= "s";
  }

  $sql .= " ORDER BY fecha DESC LIMIT ? OFFSET ?";
  $params[] = $limit;
  $params[] = $offset;
  $types .= "ii";

  $st = mysqli_prepare($enlace, $sql);
  if (!$st) fail("error interno", 500);
  
  if (!empty($params)) {
    mysqli_stmt_bind_param($st, $types, ...$params);
  }
  
  mysqli_stmt_execute($st);
  $res = mysqli_stmt_get_result($st);
  
  $data = [];
  while ($res && ($row = mysqli_fetch_assoc($res))) {
    $data[] = $row;
  }
  mysqli_stmt_close($st);

  // contar total para paginación
  $sqlCount = "SELECT COUNT(*) as total FROM auditoria WHERE 1=1";
  $paramsCount = [];
  $typesCount = "";

  if ($search !== "") {
    $sqlCount .= " AND (usuario LIKE ? OR ip LIKE ? OR accion LIKE ? OR tabla LIKE ? OR descripcion LIKE ?)";
    $paramsCount = [$s, $s, $s, $s, $s];
    $typesCount .= "sssss";
  }

  if ($accion !== "") {
    $sqlCount .= " AND accion = ?";
    $paramsCount[] = $accion;
    $typesCount .= "s";
  }

  $total = 0;
  if (!empty($paramsCount)) {
    $stCount = mysqli_prepare($enlace, $sqlCount);
    if ($stCount) {
      mysqli_stmt_bind_param($stCount, $typesCount, ...$paramsCount);
      mysqli_stmt_execute($stCount);
      $resCount = mysqli_stmt_get_result($stCount);
      $rowCount = $resCount ? mysqli_fetch_assoc($resCount) : null;
      $total = $rowCount ? (int)$rowCount["total"] : 0;
      mysqli_stmt_close($stCount);
    }
  } else {
    $q = mysqli_query($enlace, $sqlCount);
    $r = $q ? mysqli_fetch_assoc($q) : null;
    $total = $r ? (int)$r["total"] : 0;
  }

  ok(["data" => $data, "total" => $total, "rows" => $data]);
}

fail("acción inválida", 404);
