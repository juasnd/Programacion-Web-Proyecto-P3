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

function load_me() {
    global $enlace;

    if (empty($_SESSION["usuario_id"])) return null;

    $id = (int)$_SESSION["usuario_id"];
    $stmt = mysqli_prepare($enlace, "
        SELECT u.id, u.usuario, u.nombre_completo, u.activo, u.rol_id,
               COALESCE(r.nombre, '') AS rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.rol_id
        WHERE u.id = ?
        LIMIT 1
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

function resp_me($me) {
    $rolId = $me["rol_id"] === null ? null : (int)$me["rol_id"];
    $_SESSION["rol_id"] = $rolId === null ? 0 : $rolId;
    $_SESSION["rol_nombre"] = (string)($me["rol_nombre"] ?? "");

    if ($rolId === null || $rolId <= 0) {
        $_SESSION["perms"] = [];
    } else {
        $_SESSION["perms"] = perms_user();
        if (!is_array($_SESSION["perms"])) $_SESSION["perms"] = [];
    }

    ok(["me" => [
        "id" => (int)$me["id"],
        "usuario" => $me["usuario"],
        "nombre_completo" => $me["nombre_completo"],
        "rol_id" => $rolId,
        "rol_nombre" => $_SESSION["rol_nombre"],
        "is_admin" => is_admin(),
        "perms" => $_SESSION["perms"]
    ]]);
}

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
        SELECT u.id, u.usuario, u.nombre_completo,
               u.password_hash, u.activo, u.rol_id,
               u.intentos_fallidos, u.bloqueado_hasta,
               COALESCE(r.nombre,'') AS rol_nombre,
               (u.bloqueado_hasta IS NOT NULL AND u.bloqueado_hasta > NOW()) AS is_blocked,
               IF(u.bloqueado_hasta IS NULL, 0, TIMESTAMPDIFF(MINUTE, NOW(), u.bloqueado_hasta)) AS mins_left
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.rol_id
        WHERE u.usuario = ?
        LIMIT 1
    ");
    if (!$stmt) fail("error interno", 500);

    mysqli_stmt_bind_param($stmt, "s", $usuario);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $row = $res ? mysqli_fetch_assoc($res) : null;
    mysqli_stmt_close($stmt);

    if (!$row) {
        $prevU = $_SESSION["usuario"] ?? null;
        $prevId = $_SESSION["usuario_id"] ?? null;
        $_SESSION["usuario"] = $usuario;
        $_SESSION["usuario_id"] = null;
        audit("login_fail", "usuarios", null, "usuario inexistente");
        if ($prevU === null) unset($_SESSION["usuario"]); else $_SESSION["usuario"] = $prevU;
        if ($prevId === null) unset($_SESSION["usuario_id"]); else $_SESSION["usuario_id"] = $prevId;

        fail("usuario o contraseña incorrectos", 401);
    }

    if ((int)$row["is_blocked"] === 1) {
        $m = (int)$row["mins_left"];
        if ($m < 1) $m = 1;

        $prevU = $_SESSION["usuario"] ?? null;
        $prevId = $_SESSION["usuario_id"] ?? null;
        $_SESSION["usuario"] = $usuario;
        $_SESSION["usuario_id"] = (int)$row["id"];
        audit("login_blocked", "usuarios", (int)$row["id"], "bloqueado, mins_left={$m}");
        if ($prevU === null) unset($_SESSION["usuario"]); else $_SESSION["usuario"] = $prevU;
        if ($prevId === null) unset($_SESSION["usuario_id"]); else $_SESSION["usuario_id"] = $prevId;

        fail("demasiados intentos. intenta en {$m} min", 429);
    }

    if ((int)$row["activo"] !== 1) {
        $prevU = $_SESSION["usuario"] ?? null;
        $prevId = $_SESSION["usuario_id"] ?? null;
        $_SESSION["usuario"] = $usuario;
        $_SESSION["usuario_id"] = (int)$row["id"];
        audit("login_fail", "usuarios", (int)$row["id"], "usuario inactivo");
        if ($prevU === null) unset($_SESSION["usuario"]); else $_SESSION["usuario"] = $prevU;
        if ($prevId === null) unset($_SESSION["usuario_id"]); else $_SESSION["usuario_id"] = $prevId;

        fail("usuario inactivo", 403);
    }

    if (!password_verify($password, $row["password_hash"])) {
        $intentos = (int)$row["intentos_fallidos"] + 1;

        if ($intentos >= 3) {
            $up = mysqli_prepare($enlace, "
                UPDATE usuarios
                SET intentos_fallidos = 0,
                    bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                WHERE id = ?
            ");
            mysqli_stmt_bind_param($up, "i", $row["id"]);
            mysqli_stmt_execute($up);
            mysqli_stmt_close($up);

            $prevU = $_SESSION["usuario"] ?? null;
            $prevId = $_SESSION["usuario_id"] ?? null;
            $_SESSION["usuario"] = $usuario;
            $_SESSION["usuario_id"] = (int)$row["id"];
            audit("login_fail_block", "usuarios", (int)$row["id"], "bloqueado 5 min");
            if ($prevU === null) unset($_SESSION["usuario"]); else $_SESSION["usuario"] = $prevU;
            if ($prevId === null) unset($_SESSION["usuario_id"]); else $_SESSION["usuario_id"] = $prevId;

            fail("demasiados intentos. intenta en 5 min", 429);
        }

        $up = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?");
        mysqli_stmt_bind_param($up, "ii", $intentos, $row["id"]);
        mysqli_stmt_execute($up);
        mysqli_stmt_close($up);

        $prevU = $_SESSION["usuario"] ?? null;
        $prevId = $_SESSION["usuario_id"] ?? null;
        $_SESSION["usuario"] = $usuario;
        $_SESSION["usuario_id"] = (int)$row["id"];
        audit("login_fail", "usuarios", (int)$row["id"], "password incorrecta, intentos={$intentos}");
        if ($prevU === null) unset($_SESSION["usuario"]); else $_SESSION["usuario"] = $prevU;
        if ($prevId === null) unset($_SESSION["usuario_id"]); else $_SESSION["usuario_id"] = $prevId;

        $r = 3 - $intentos;
        fail("usuario o contraseña incorrectos. te quedan {$r} intento(s)", 401);
    }

    $up = mysqli_prepare($enlace, "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?");
    mysqli_stmt_bind_param($up, "i", $row["id"]);
    mysqli_stmt_execute($up);
    mysqli_stmt_close($up);

    session_regenerate_id(true);

    $_SESSION["usuario_id"] = (int)$row["id"];
    $_SESSION["usuario"] = $row["usuario"];
    $_SESSION["nombre_completo"] = $row["nombre_completo"];
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

if ($action === "usuarios_list") {
    require_perm("usuarios", "ver");

    $q = mysqli_query($enlace, "
        SELECT u.id, u.usuario, u.nombre_completo, u.activo, u.rol_id,
               COALESCE(r.nombre,'(sin rol)') AS rol_nombre
        FROM usuarios u
        LEFT JOIN roles r ON r.id = u.rol_id
        ORDER BY u.id DESC
    ");

    $data = [];
    while ($row = mysqli_fetch_assoc($q)) $data[] = $row;
    ok(["data" => $data]);
}

if ($action === "usuarios_create") {
    require_perm("usuarios", "crear");

    $usuario = trim(strtolower($body["usuario"] ?? ""));
    $nombre = trim($body["nombre_completo"] ?? "");
    $pass = (string)($body["password"] ?? "");

    $rol_raw = $body["rol_id"] ?? null;
    if ($rol_raw === "" || $rol_raw === "0" || $rol_raw === 0) $rol_raw = null;
    $rol_id = $rol_raw === null ? null : (int)$rol_raw;
    if ($rol_id !== null && $rol_id <= 0) $rol_id = null;

    if ($usuario === "" || $nombre === "" || $pass === "") fail("datos incompletos");
    if (strlen($pass) < 8) fail("contraseña mínima 8 caracteres");

    $hash = password_hash($pass, PASSWORD_BCRYPT);

    if ($rol_id === null) {
        $st = mysqli_prepare($enlace, "
            INSERT INTO usuarios (usuario, nombre_completo, password_hash, activo, intentos_fallidos)
            VALUES (?, ?, ?, 1, 0)
        ");
        mysqli_stmt_bind_param($st, "sss", $usuario, $nombre, $hash);
    } else {
        $st = mysqli_prepare($enlace, "
            INSERT INTO usuarios (usuario, nombre_completo, password_hash, rol_id, activo, intentos_fallidos)
            VALUES (?, ?, ?, ?, 1, 0)
        ");
        mysqli_stmt_bind_param($st, "sssi", $usuario, $nombre, $hash, $rol_id);
    }

    $okExec = mysqli_stmt_execute($st);
    $err = mysqli_stmt_error($st);
    mysqli_stmt_close($st);

    if (!$okExec) {
        if (str_contains(strtolower($err), "duplicate") || str_contains(strtolower($err), "duplic")) {
            fail("usuario ya existe", 409);
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
    $usuario = trim(strtolower($body["usuario"] ?? ""));
    $nombre = trim($body["nombre_completo"] ?? "");
    $activo = (int)($body["activo"] ?? 1);

    $rol_raw = $body["rol_id"] ?? null;
    if ($rol_raw === "" || $rol_raw === "0" || $rol_raw === 0) $rol_raw = null;
    $rol_id = $rol_raw === null ? null : (int)$rol_raw;
    if ($rol_id !== null && $rol_id <= 0) $rol_id = null;

    if ($id <= 0) fail("id inválido");
    if ($usuario === "" || $nombre === "") fail("datos incompletos");

    $passNew = isset($body["password"]) ? trim((string)$body["password"]) : "";

    if ($rol_id === null) {
        if ($passNew !== "") {
            if (strlen($passNew) < 8) fail("contraseña mínima 8 caracteres");
            $hash = password_hash($passNew, PASSWORD_BCRYPT);
            $st = mysqli_prepare($enlace, "
                UPDATE usuarios
                SET usuario=?, nombre_completo=?, rol_id=NULL, activo=?, password_hash=?
                WHERE id=?
            ");
            mysqli_stmt_bind_param($st, "ssisi", $usuario, $nombre, $activo, $hash, $id);
        } else {
            $st = mysqli_prepare($enlace, "
                UPDATE usuarios
                SET usuario=?, nombre_completo=?, rol_id=NULL, activo=?
                WHERE id=?
            ");
            mysqli_stmt_bind_param($st, "ssii", $usuario, $nombre, $activo, $id);
        }
    } else {
        if ($passNew !== "") {
            if (strlen($passNew) < 8) fail("contraseña mínima 8 caracteres");
            $hash = password_hash($passNew, PASSWORD_BCRYPT);
            $st = mysqli_prepare($enlace, "
                UPDATE usuarios
                SET usuario=?, nombre_completo=?, rol_id=?, activo=?, password_hash=?
                WHERE id=?
            ");
            mysqli_stmt_bind_param($st, "ssiisi", $usuario, $nombre, $rol_id, $activo, $hash, $id);
        } else {
            $st = mysqli_prepare($enlace, "
                UPDATE usuarios
                SET usuario=?, nombre_completo=?, rol_id=?, activo=?
                WHERE id=?
            ");
            mysqli_stmt_bind_param($st, "ssiii", $usuario, $nombre, $rol_id, $activo, $id);
        }
    }

    $okExec = mysqli_stmt_execute($st);
    $err = mysqli_stmt_error($st);
    mysqli_stmt_close($st);

    if (!$okExec) {
        if (str_contains(strtolower($err), "duplicate") || str_contains(strtolower($err), "duplic")) {
            fail("usuario ya existe", 409);
        }
        fail("error al actualizar usuario", 500);
    }

    $desc = "editó usuario {$id} -> {$usuario}";
    if ($passNew !== "") $desc .= " (cambio pass)";
    audit("usuarios_update", "usuarios", $id, $desc);

    ok();
}

if ($action === "usuarios_delete") {
    require_perm("usuarios", "eliminar");

    $id = (int)($body["id"] ?? 0);
    if ($id <= 0) fail("id inválido");
    if ($id === (int)$_SESSION["usuario_id"]) fail("no puedes desactivarte");

    $st = mysqli_prepare($enlace, "UPDATE usuarios SET activo = 0 WHERE id = ?");
    mysqli_stmt_bind_param($st, "i", $id);
    mysqli_stmt_execute($st);
    mysqli_stmt_close($st);

    audit("usuarios_delete", "usuarios", $id, "desactivó usuario {$id}");

    ok();
}

if ($action === "roles_list") {
    require_perm("roles", "ver");

    $q = mysqli_query($enlace, "SELECT id, nombre, descripcion, es_sistema FROM roles ORDER BY id DESC");
    $data = [];
    while ($r = mysqli_fetch_assoc($q)) $data[] = $r;
    ok(["data" => $data]);
}

if ($action === "roles_create") {
    require_perm("roles", "crear");
    if (!is_admin()) fail("solo admin", 403);

    $nombre = trim(strtolower($body["nombre"] ?? ""));
    $desc = trim($body["descripcion"] ?? "");
    if ($nombre === "") fail("nombre requerido");

    $st = mysqli_prepare($enlace, "INSERT INTO roles (nombre, descripcion, es_sistema) VALUES (?, ?, 0)");
    mysqli_stmt_bind_param($st, "ss", $nombre, $desc);
    $okExec = mysqli_stmt_execute($st);
    $err = mysqli_stmt_error($st);
    mysqli_stmt_close($st);

    if (!$okExec) {
        if (str_contains(strtolower($err), "duplicate") || str_contains(strtolower($err), "duplic")) {
            fail("rol ya existe", 409);
        }
        fail("error al crear rol", 500);
    }

    $newId = (int)mysqli_insert_id($enlace);
    audit("roles_create", "roles", $newId > 0 ? $newId : null, "creó rol {$nombre}");

    ok();
}

if ($action === "roles_update") {
    require_perm("roles", "editar");
    if (!is_admin()) fail("solo admin", 403);

    $id = (int)($body["id"] ?? 0);
    $desc = trim($body["descripcion"] ?? "");
    if ($id <= 0) fail("id inválido");

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

if ($action === "permisos_get") {
    require_perm("permisos", "ver");

    $roles = [];
    $q = mysqli_query($enlace, "SELECT id, nombre, descripcion FROM roles ORDER BY id DESC");
    while ($r = mysqli_fetch_assoc($q)) $roles[] = $r;

    $map = [];
    $q2 = mysqli_query($enlace, "
        SELECT rp.rol_id, p.modulo, p.accion
        FROM rol_permisos rp
        JOIN permisos p ON p.id = rp.permiso_id
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

    $stDel = mysqli_prepare($enlace, "DELETE FROM rol_permisos WHERE rol_id = ?");
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
        $m = trim($m);
        $a = trim($a);
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
