<?php
require_once __DIR__ . "/auth.php";
global $enlace;

$action = $_GET["action"] ?? "";

function body_json() {
    $raw = file_get_contents("php://input");
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}


if ($action === "login") {
    $d = body_json();
    $usuario = trim($d["usuario"] ?? "");
    $password = (string)($d["password"] ?? "");

    if ($usuario === "" || $password === "") {
        json_out(["ok"=>false,"error"=>"datos incompletos"], 400);
    }

    $sql = "SELECT u.id,u.usuario,u.nombre_completo,u.password_hash,u.activo,
                   r.id AS rol_id,r.nombre AS rol
            FROM usuarios u
            JOIN roles r ON r.id=u.rol_id
            WHERE u.usuario=? LIMIT 1";
    $st = mysqli_prepare($enlace, $sql);
    mysqli_stmt_bind_param($st, "s", $usuario);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);
    $u = $res ? mysqli_fetch_assoc($res) : null;

    if (!$u || (int)$u["activo"] !== 1 || !password_verify($password, $u["password_hash"])) {
        auditoria("login_fail", "usuarios", null, "login fallido: $usuario");
        json_out(["ok"=>false,"error"=>"usuario o contraseña incorrectos"], 401);
    }

    $_SESSION["uid"] = (int)$u["id"];
    $_SESSION["usuario"] = $u["usuario"];
    $_SESSION["nombre"] = $u["nombre_completo"];
    $_SESSION["rol"] = $u["rol"];
    $_SESSION["rol_id"] = (int)$u["rol_id"];
    $_SESSION["last_activity"] = time();

    auditoria("login", "usuarios", (int)$u["id"], "inicio sesión");

    json_out(["ok"=>true, "user"=>[
        "id"=>(int)$u["id"],
        "usuario"=>$u["usuario"],
        "nombre"=>$u["nombre_completo"],
        "rol"=>$u["rol"]
    ]]);
}

if ($action === "logout") {
    require_login();

    auditoria("logout", "usuarios", (int)$_SESSION["uid"], "cerró sesión");

    session_unset();
    session_destroy();
    $_SESSION = [];

    if (ini_get("session.use_cookies")) {
        $p = session_get_cookie_params();
        setcookie(session_name(), "", time()-42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
    }

    json_out(["ok"=>true]);
}

if ($action === "me") {
    if (empty($_SESSION["uid"])) {
        json_out(["ok"=>true, "user"=>null]);
    }
    json_out(["ok"=>true,"user"=>[
        "id"=>(int)$_SESSION["uid"],
        "usuario"=>$_SESSION["usuario"],
        "nombre"=>$_SESSION["nombre"],
        "rol"=>$_SESSION["rol"]
    ]]);
}

if ($action === "roles_list") {
    require_login();
    $q = mysqli_query($enlace, "SELECT id,nombre,descripcion,es_sistema FROM roles ORDER BY es_sistema DESC,nombre ASC");
    $roles = [];
    while ($r = mysqli_fetch_assoc($q)) $roles[] = $r;
    json_out(["ok"=>true,"roles"=>$roles]);
}

if ($action === "roles_create") {
    require_login();

    $d = body_json();
    $nombre = trim($d["nombre"] ?? "");
    $descripcion = trim($d["descripcion"] ?? "");

    if (!preg_match("/^[a-z0-9_]{3,50}$/", $nombre)) {
        json_out(["ok"=>false,"error"=>"nombre inválido (minúsculas, números, _ )"], 400);
    }

    $sql = "INSERT INTO roles (nombre,descripcion,es_sistema) VALUES (?,?,0)";
    $st = mysqli_prepare($enlace, $sql);
    mysqli_stmt_bind_param($st, "ss", $nombre, $descripcion);

    if (!mysqli_stmt_execute($st)) {
        json_out(["ok"=>false,"error"=>"no se pudo crear rol (puede existir ya)"], 500);
    }

    $rid = mysqli_insert_id($enlace);

    auditoria("create", "roles", $rid, "creó rol $nombre");

    json_out(["ok"=>true, "id"=>$rid]);
}

if ($action === "roles_delete") {
    require_admin();

    $d = body_json();
    $rol_id = (int)($d["rol_id"] ?? 0);
    $rol_alt = (int)($d["rol_alternativo"] ?? 0);

    if ($rol_id <= 0 || $rol_alt <= 0) {
        json_out(["ok"=>false,"error"=>"datos incompletos"], 400);
    }

    $q = mysqli_query($enlace, "SELECT es_sistema,nombre FROM roles WHERE id=$rol_id");
    $r = $q ? mysqli_fetch_assoc($q) : null;

    if (!$r) json_out(["ok"=>false,"error"=>"rol no existe"], 404);
    if ((int)$r["es_sistema"] === 1) json_out(["ok"=>false,"error"=>"no se puede borrar rol del sistema"], 403);

    mysqli_query($enlace, "UPDATE usuarios SET rol_id=$rol_alt WHERE rol_id=$rol_id");
    mysqli_query($enlace, "DELETE FROM roles WHERE id=$rol_id");

    auditoria("delete", "roles", $rol_id, "eliminó rol ".$r["nombre"]);
    json_out(["ok"=>true]);
}


if ($action === "permisos_catalogo") {
    require_admin();
    $q = mysqli_query($enlace, "SELECT id,modulo,accion,descripcion FROM permisos ORDER BY modulo,accion");
    $p = [];
    while ($r = mysqli_fetch_assoc($q)) $p[] = $r;
    json_out(["ok"=>true,"permisos"=>$p]);
}

if ($action === "permisos_por_rol") {
    require_admin();
    $rol_id = (int)($_GET["rol_id"] ?? 0);

    $sql = "SELECT p.modulo,p.accion
            FROM rol_permisos rp
            JOIN permisos p ON p.id=rp.permiso_id
            WHERE rp.rol_id=?";
    $st = mysqli_prepare($enlace, $sql);
    mysqli_stmt_bind_param($st, "i", $rol_id);
    mysqli_stmt_execute($st);
    $res = mysqli_stmt_get_result($st);

    $out = [];
    while ($row = mysqli_fetch_assoc($res)) $out[] = $row;

    json_out(["ok"=>true,"asignados"=>$out]);
}

if ($action === "permisos_set") {
    require_admin();

    $d = body_json();
    $rol_id = (int)($d["rol_id"] ?? 0);
    $permisos = $d["permisos"] ?? [];

    if ($rol_id <= 0) json_out(["ok"=>false,"error"=>"rol inválido"], 400);

    mysqli_query($enlace, "DELETE FROM rol_permisos WHERE rol_id=$rol_id");

    foreach ($permisos as $pp) {
        $m = $pp["modulo"] ?? "";
        $a = $pp["accion"] ?? "";
        if ($m === "" || $a === "") continue;

        $sql = "SELECT id FROM permisos WHERE modulo=? AND accion=? LIMIT 1";
        $st = mysqli_prepare($enlace, $sql);
        mysqli_stmt_bind_param($st, "ss", $m, $a);
        mysqli_stmt_execute($st);
        $res = mysqli_stmt_get_result($st);
        $perm = $res ? mysqli_fetch_assoc($res) : null;
        if (!$perm) continue;

        $pid = (int)$perm["id"];
        mysqli_query($enlace, "INSERT INTO rol_permisos (rol_id,permiso_id) VALUES ($rol_id,$pid)");
    }

    auditoria("permisos_update", "rol_permisos", $rol_id, "actualizó permisos del rol $rol_id");
    json_out(["ok"=>true]);
}

if ($action === "usuarios_list") {
    require_admin();
    $q = mysqli_query($enlace, "SELECT u.id,u.usuario,u.nombre_completo,r.nombre AS rol
                               FROM usuarios u JOIN roles r ON r.id=u.rol_id
                               ORDER BY u.id ASC");
    $users = [];
    while ($r = mysqli_fetch_assoc($q)) $users[] = $r;
    json_out(["ok"=>true,"usuarios"=>$users]);
}

if ($action === "usuarios_create") {
    require_admin();

    $d = body_json();
    $usuario = trim($d["usuario"] ?? "");
    $nombre = trim($d["nombre"] ?? "");
    $password = (string)($d["password"] ?? "");
    $rol_id = (int)($d["rol_id"] ?? 0);

    if ($usuario==="" || $nombre==="" || $password==="" || $rol_id<=0) {
        json_out(["ok"=>false,"error"=>"datos incompletos"], 400);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);

    $sql = "INSERT INTO usuarios (usuario,nombre_completo,password_hash,rol_id) VALUES (?,?,?,?)";
    $st = mysqli_prepare($enlace, $sql);
    mysqli_stmt_bind_param($st, "sssi", $usuario, $nombre, $hash, $rol_id);

    if (!mysqli_stmt_execute($st)) {
        json_out(["ok"=>false,"error"=>"no se pudo crear usuario (puede existir ya)"], 500);
    }

    $id = mysqli_insert_id($enlace);
    auditoria("create", "usuarios", $id, "creó usuario $usuario");
    json_out(["ok"=>true,"id"=>$id]);
}

json_out(["ok"=>false,"error"=>"acción no válida"], 404);
