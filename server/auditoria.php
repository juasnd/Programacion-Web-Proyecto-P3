<?php
require_once __DIR__ . "/session.php";
require_once __DIR__ . "/conexion.php";

function get_ip() {
    return $_SERVER["REMOTE_ADDR"] ?? "unknown";
}

function auditoria($accion, $tabla = null, $registro_id = null, $descripcion = "") {
    global $enlace;

    $fecha = date("Y-m-d H:i:s");
    $usuario = $_SESSION["usuario"] ?? null;
    $usuario_id = ($_SESSION["tipo"] ?? "") === "ESTUDIANTE"
        ? ($_SESSION["estudiante_id"] ?? null)
        : ($_SESSION["usuario_id"] ?? null);

    $ip = get_ip();

    $stmt = mysqli_prepare($enlace, "
        INSERT INTO auditoria (fecha, usuario, usuario_id, ip, accion, tabla, registro_id, descripcion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    if (!$stmt) return;

    mysqli_stmt_bind_param(
        $stmt,
        "ssisssis",
        $fecha,
        $usuario,
        $usuario_id,
        $ip,
        $accion,
        $tabla,
        $registro_id,
        $descripcion
    );
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);
}

function audit($accion, $tabla = null, $registro_id = null, $descripcion = "") {
    auditoria($accion, $tabla, $registro_id, $descripcion);
}