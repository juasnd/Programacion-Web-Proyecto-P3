<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/conexion.php";

function json_out($data, $code = 200) {
    http_response_code($code);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function require_login() {
    if (empty($_SESSION["usuario_id"])) {
        json_out(["ok" => false, "error" => "no autenticado"], 401);
    }
}

function require_admin() {
    require_login();
    if (!is_admin()) {
        json_out(["ok" => false, "error" => "acceso denegado"], 403);
    }
}

function is_admin() {
    $r = $_SESSION["rol_nombre"] ?? "";
    $r = strtolower(trim((string)$r));
    return $r === "admin";
}

function perms_user() {
    global $enlace;

    if (is_admin()) return ["*"];

    $rol_id = (int)($_SESSION["rol_id"] ?? 0);
    if ($rol_id <= 0) return [];

    $perms = [];

    $stmt = mysqli_prepare($enlace, "
        SELECT p.modulo, p.accion
        FROM rol_permisos rp
        JOIN permisos p ON p.id = rp.permiso_id
        WHERE rp.rol_id = ?
    ");
    if (!$stmt) return [];

    mysqli_stmt_bind_param($stmt, "i", $rol_id);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);

    while ($row = mysqli_fetch_assoc($res)) {
        $perms[] = $row["modulo"] . "." . $row["accion"];
    }

    mysqli_stmt_close($stmt);
    return $perms;
}

function can($mod, $acc) {
    $perms = $_SESSION["perms"] ?? [];
    if (in_array("*", $perms, true)) return true;
    return in_array($mod . "." . $acc, $perms, true);
}

function can_any($mod) {
    $perms = $_SESSION["perms"] ?? [];
    if (in_array("*", $perms, true)) return true;
    foreach ($perms as $p) {
        $p = (string)$p;
        if (str_starts_with($p, $mod . ".")) return true;
    }
    return false;
}

function require_perm($mod, $acc) {
    if (!can($mod, $acc)) {
        json_out(["ok" => false, "error" => "acceso denegado"], 403);
    }
}

function require_perm_any($mod) {
    if (!can_any($mod)) {
        json_out(["ok" => false, "error" => "acceso denegado"], 403);
    }
}

function require_active_user() {
    global $enlace;

    require_login();
    $uid = (int)$_SESSION["usuario_id"];

    $stmt = mysqli_prepare($enlace, "SELECT activo FROM usuarios WHERE id = ? LIMIT 1");
    if (!$stmt) json_out(["ok" => false, "error" => "error interno"], 500);

    mysqli_stmt_bind_param($stmt, "i", $uid);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $row = mysqli_fetch_assoc($res);
    mysqli_stmt_close($stmt);

    if (!$row || (int)$row["activo"] !== 1) {
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $p = session_get_cookie_params();
            setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
        }
        session_destroy();
        json_out(["ok" => false, "error" => "usuario inactivo"], 401);
    }
}
