<?php
$servidor = "localhost:3307";//poner sus credenciales
$usuario = "root";//poner sus credenciales
$clave = "1234";//poner sus credenciales
$bd = "proyecto_29797";//poner sus credenciales

$enlace = mysqli_connect($servidor, $usuario, $clave, $bd);
if (!$enlace) {
    die("Error de conexión");
}

mysqli_set_charset($enlace, "utf8mb4");
